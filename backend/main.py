import os
import uvicorn
from uuid import uuid4
from contextlib import asynccontextmanager
from typing import List
from collections import Counter

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Form,
    Query,
    Header,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import hmac

# --- INTERNAL MODULES ---
# Pastikan file database.py, models.py, utils.py ada di folder yang sama!
from database import create_db_and_tables, get_session, engine
from models import Issue, wita_now
from utils import process_analysis, TOKEN

# 1. LOAD ENVIRONMENT
load_dotenv()

# 2. LIFESPAN MANAGER
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bikin tabel kalau belum ada
    create_db_and_tables()
    print("[SYSTEM] Database Connected & Tables Ready.")

    # Recovery: cari Issue yang nyangkut di PENDING karena server restart
    # atau crash. Kalau raw file-nya masih ada di disk, proses ulang.
    try:
        from sqlmodel import Session as _Session
        with _Session(engine) as s:
            stuck = s.exec(
                select(Issue).where(Issue.status == "PENDING")
            ).all()
            if stuck:
                print(f"[RECOVERY] {len(stuck)} laporan PENDING ditemukan, "
                      "cek apakah file-nya masih ada...")
                recovered = 0
                for iss in stuck:
                    # Cari raw_path dari fid. id field bisa dipake karena
                    # upload pakai uuid4().hex[:8] untuk nama file,
                    # tapi field id DB autoincrement. Pakai pattern fallback:
                    # uploads_raw/{iss.id}.jpg.
                    cand_raw = f"uploads_raw/{iss.id}.jpg"
                    if os.path.exists(cand_raw):
                        print(f"[RECOVERY] Re-queue Issue #{iss.id}")
                        # langsung panggil worker-nya (sync, aman di startup)
                        run_analysis_background(iss.id, cand_raw)
                        recovered += 1
                    else:
                        # File hilang, tandai error biar gak nyangkut selamanya
                        iss.status = "ERROR"
                        if not isinstance(iss.meta_data, dict):
                            iss.meta_data = {}
                        iss.meta_data["recovery_error"] = "Raw file tidak ditemukan saat startup"
                        s.add(iss)
                if recovered:
                    s.commit()
                    print(f"[RECOVERY] Selesai, {recovered} laporan diproses ulang.")
    except Exception as e:
        print(f"[RECOVERY][ERROR] {e}")

    yield


# 3. SETUP APP
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="BaliCivic AI Backend",
    version="Release 1.0",
    lifespan=lifespan,
)

# Setup Middleware & Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: whitelist domain dari env (CORS_ORIGINS, dipisah koma).
# Default: hanya localhost dev. Di produksi isi domain resmi, contoh:
#   CORS_ORIGINS=https://balicivicai.site,https://www.balicivicai.site
_cors_env = os.getenv("CORS_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000,http://localhost:3000")
allow_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
if allow_origins == ["*"]:
    print("[SECURITY][WARN] CORS_ORIGINS='*' (semua origin diizinkan). "
          "Ganti ke domain resmi sebelum produksi.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,  # WAJIB False kalau pakai "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Static Files
#
# Privasi & EXIF:
# - uploads_raw/  : file asli dari warga (dipakai YOLO, JANGAN diserve publik).
# - uploads/      : annotated image (re-encode cv2 → EXIF otomatis ter-strip).
# Folder uploads/ yang di-mount publik HANYA berisi file _detected.jpg.
# Foto asli (yang masih bawa GPS di EXIF) tetap di uploads_raw/ dan tidak
# terekspos dari network.
UPLOAD_DIR = "uploads"           # publik via /static
UPLOAD_RAW_DIR = "uploads_raw"   # private (lokal saja)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(UPLOAD_RAW_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")


# --- BACKGROUND TASK WRAPPER ---
def run_analysis_background(issue_id: str, image_path: str):
    """
    Worker yang jalan di background_task FastAPI.
    Buka Session sendiri, lalu lempar ke process_analysis di utils.
    """
    from sqlmodel import Session as SQLModelSession  # biar eksplisit

    with SQLModelSession(engine) as session:
        print(f"[BG TASK] Memulai analisis untuk {issue_id}.")
        process_analysis(issue_id, image_path, session)


# --- API ENDPOINTS ---

@app.get("/")
def health_check():
    return {"status": "online", "system": "BaliCivic AI Engine V.Release"}


@app.get("/health")
def health_liveness():
    """
    Liveness/readiness probe untuk monitoring (k8s, supervisor, dll).
    Cek DB juga untuk tau apakah siap menerima traffic.
    """
    db_ok = False
    try:
        with Session(engine) as s:
            s.exec(select(Issue).limit(1))
            db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "ok" if db_ok else "error",
        "system": "BaliCivic AI",
    }


@app.post("/api/analyze")
@limiter.limit("5/minute")
async def analyze_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lat: float | None = Form(None),
    long: float | None = Form(None),
    session: Session = Depends(get_session),
):
    """
    Endpoint utama untuk menerima foto + koordinat,
    simpan Issue awal, lalu lempar analisis ke background task.
    """
    fid = uuid4().hex[:8]
    # File asli disimpan di folder PRIVATE (uploads_raw/), bukan publik.
    # EXIF (termasuk GPS) tetap ada di sini untuk analisis internal,
    # tapi tidak bisa diakses via HTTP.
    raw_path = f"{UPLOAD_RAW_DIR}/{fid}.jpg"

    try:
        # Validasi input di trust boundary: harus gambar & maksimal 10MB
        if file.content_type and not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File harus berupa gambar (jpg/png)")
        MAX_UPLOAD = 10 * 1024 * 1024
        size = 0
        with open(raw_path, "wb") as f:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD:
                    raise HTTPException(status_code=413, detail="Ukuran file maksimal 10MB")
                f.write(chunk)
    except HTTPException:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal simpan file: {str(e)}")

    if lat is not None and not (-90 <= lat <= 90):
        raise HTTPException(status_code=400, detail="Latitude tidak valid")
    if long is not None and not (-180 <= long <= 180):
        raise HTTPException(status_code=400, detail="Longitude tidak valid")

    new_issue = Issue(
        title="Sedang Menganalisis",
        description="Menunggu antrean pemrosesan AI.",
        latitude=lat,
        longitude=long,
        issue_class="processing",
        severity_label="LOW",
        final_score=0,
        # image_url diisi setelah analyze selesai (annotated sudah EXIF-strip)
        image_url=None,
        status="PENDING",
        breakdown_score={},
        secondary_issues=[],
        meta_data={},
    )

    session.add(new_issue)
    session.commit()
    session.refresh(new_issue)

    # Worker pakai raw_path (asli, untuk YOLO), output publik = annotated
    background_tasks.add_task(run_analysis_background, new_issue.id, raw_path)

    return {
        "message": "Laporan diterima & sedang diproses",
        "id": new_issue.id,
        "status": "PENDING",
        "image_url": new_issue.image_url,  # null sampai annotate selesai
    }



@app.get("/api/issues", response_model=List[Issue])
def read_issues(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(
        None, alias="status", pattern="^(PENDING|IN_PROGRESS|DONE|ERROR)$"
    ),
    issue_class: str | None = Query(None),
    session: Session = Depends(get_session),
):
    """
    Ambil issue dengan pagination + filter.
    Query params:
      ?limit=50&offset=0&status=PENDING&issue_class=jalan_bolong
    """
    stmt = select(Issue).order_by(Issue.created_at.desc())
    if status_filter:
        stmt = stmt.where(Issue.status == status_filter)
    if issue_class:
        stmt = stmt.where(Issue.issue_class == issue_class)
    stmt = stmt.limit(limit).offset(offset)
    return session.exec(stmt).all()


@app.get("/api/issues/count")
def count_issues(session: Session = Depends(get_session)):
    """Total jumlah issue untuk pagination UI."""
    total = len(session.exec(select(Issue)).all())
    return {"total": total}


@app.get("/api/issues/{issue_id}")
def read_single_issue(issue_id: int, session: Session = Depends(get_session)):
    """
    Detail satu issue. PK adalah int (lihat models.Issue.id).
    """
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return issue


def verify_admin_token(
    token: str | None = Query(None),
    x_admin_token: str | None = Header(None),
):
    """
    Dependency auth admin. Terima token dari query ?token=... atau header
    X-Admin-Token. Pakai perbandingan konstan-waktu supaya tidak bocor
    lewat timing attack.
    """
    provided = token or x_admin_token or ""
    # hmac.compare_digest butuh dua str/bytes; pastikan dibandingkan dengan aman
    if not provided or not hmac.compare_digest(str(provided), str(TOKEN)):
        raise HTTPException(status_code=401, detail="Token admin tidak valid")


@app.put("/api/issues/{issue_id}/status")
def update_status(
    issue_id: int,
    status: str,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin_token),
):
    """
    Update status oleh admin (Dinas) & Catat di Timeline.
    Flow: PENDING -> OPEN (Dikerjakan) -> DONE (Selesai)
    """
    # 1. Whitelist status (jangan terima string asal)
    if status not in {"PENDING", "IN_PROGRESS", "DONE", "ERROR"}:
        raise HTTPException(status_code=422, detail=f"Status '{status}' tidak dikenal")

    # 2. Cari Data
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")

    # 3. Tentukan Pesan Aksi untuk Timeline (Biar History-nya Cantik)
    action_message = "Status diperbarui"
    if status == "IN_PROGRESS":
        action_message = "Laporan Diverifikasi & Tim Dikerahkan"
    elif status == "DONE":
        action_message = "Perbaikan Selesai & Laporan Ditutup"
    elif status == "ERROR":
        action_message = "Laporan Ditolak / Invalid"

    # 4. Buat Object Event Baru (Jejak Digital)
    new_event = {
        "status": status,
        "timestamp": wita_now().strftime("%Y-%m-%d %H:%M:%S"),
        "actor": "Admin Dinas",
        "message": action_message
    }

    # 5. Update Timeline (Append ke list JSON yang sudah ada)
    # Kita copy list lama, tambah event baru, lalu simpan balik
    current_timeline = list(issue.timeline) if issue.timeline else []
    current_timeline.append(new_event)
    issue.timeline = current_timeline  # Simpan JSON

    # 6. Update Status Utama
    issue.status = status
    issue.updated_at = wita_now()

    # 7. Simpan ke Database
    session.add(issue)
    session.commit()
    session.refresh(issue)

    print(f"[ADMIN] Status Issue #{issue_id} berubah menjadi {status}")

    return {
        "message": "Status berhasil diupdate",
        "current_status": status,
        "history": new_event
    }


@app.delete("/api/issues/{issue_id}")
def delete_issue(
    issue_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(verify_admin_token),
):
    """
    Hapus laporan oleh admin (untuk laporan spam/palsu/invalid).
    Menghapus baris DB + file annotated di disk. Raw file (kalau masih ada)
    juga dihapus. Tercatat di log untuk audit.
    """
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")

    # Hapus file annotated dari disk
    deleted_files = []
    if issue.image_url and issue.image_url.startswith("/static/"):
        fname = issue.image_url.replace("/static/", "")
        path = os.path.join(UPLOAD_DIR, fname)
        if os.path.exists(path):
            os.remove(path)
            deleted_files.append(path)

    # Hapus raw kalau masih ada (mungkin gagal analyze)
    raw_path = f"uploads_raw/{issue_id}.jpg"
    if os.path.exists(raw_path):
        os.remove(raw_path)
        deleted_files.append(raw_path)

    session.delete(issue)
    session.commit()

    print(f"[ADMIN] Issue #{issue_id} dihapus oleh admin. Files: {deleted_files}")

    return {
        "message": "Laporan dihapus",
        "issue_id": issue_id,
        "files_removed": deleted_files,
    }


@app.get("/api/admin/verify")
def verify_token_endpoint(_: None = Depends(verify_admin_token)):
    """
    Cek apakah token admin valid. Dipakai panel admin untuk verifikasi
    tanpa menyimpan token hardcoded di sisi client.
    """
    return {"valid": True}


@app.get("/api/sumary")
@app.get("/api/summary")
def get_dashboard(session: Session = Depends(get_session)):
    """
    Ringkasan untuk dashboard admin:
    total laporan, jumlah antrean, butuh tindakan, selesai.
    Dua route: /api/sumary (nama lama, tetap didukung) dan /api/summary.
    """
    all_issues = session.exec(select(Issue)).all()
    total = len(all_issues)
    pending = len([i for i in all_issues if i.status == "PENDING"])
    action_needed = len([i for i in all_issues if i.status == "IN_PROGRESS"])
    completed = len([i for i in all_issues if i.status == "DONE"])
    errors = len([i for i in all_issues if i.status == "ERROR"])

    return {
        "total": total,
        "antrean": pending,
        "perlu_tindakan": action_needed,
        "selesai": completed,
        "error": errors,
    }


@app.get("/api/distribution")
def get_issue_distribution(session: Session = Depends(get_session)):
    """
    Distribusi jenis kerusakan (pie chart / donut chart di frontend).
    """
    all_issues = session.exec(select(Issue)).all()
    total = len(all_issues) or 1  # hindari bagi 0

    counts = {
        "jalan_bolong": len(
            [i for i in all_issues if i.issue_class == "jalan_bolong"]
        ),
        "sampah_liar": len(
            [i for i in all_issues if i.issue_class == "sampah_liar"]
        ),
        "genangan_air": len([i for i in all_issues if i.issue_class == "genangan_air"]),
        "kabel_semrawut": len(
            [i for i in all_issues if i.issue_class == "kabel_semrawut"]
        ),
    }

    data = [
        {
            "label": "Jalan Bolong",
            "percent": round((counts["jalan_bolong"] / total) * 100),
            "color": "#d32f2f",
            "count": counts["jalan_bolong"],
        },
        {
            "label": "Sampah Liar",
            "percent": round((counts["sampah_liar"] / total) * 100),
            "color": "#f57c00",
            "count": counts["sampah_liar"],
        },
        {
            "label": "Genangan Air",
                        "percent": round((counts["genangan_air"] / total) * 100),
                        "color": "#1976d2",
                        "count": counts["genangan_air"],
        },
        {
            "label": "Kabel Berantakan",
            "percent": round((counts["kabel_semrawut"] / total) * 100),
            "color": "#455a64",
            "count": counts["kabel_semrawut"],
        },
    ]

    data.sort(key=lambda x: x["percent"], reverse=True)
    return data


@app.get("/api/top-locations")
def get_top_locations(session: Session = Depends(get_session)):
    """
    Hitung 3 lokasi (kabupaten) dengan laporan terbanyak.
    Menggunakan field Issue.kabupaten yang sudah diisi otomatis oleh geocoder.
    """
    # Ambil semua kabupaten yang valid
    statement = select(Issue.kabupaten).where(Issue.kabupaten != None)
    all_kabs = session.exec(statement).all()

    # Bersihkan data (filter string kosong atau default value jika ada)
    clean_kabupaten = [
        k for k in all_kabs 
        if k and k.strip() and k != "Lokasi Tidak Terdeteksi"
    ]

    counter = Counter(clean_kabupaten)
    top_3 = counter.most_common(3)

    results = []
    for nama_kota, jumlah in top_3:
        results.append(
            {
                "kabupaten": nama_kota,
                "total": jumlah,
            }
        )

    return results

@app.get("/api/heatmap")
def get_heatmap_data(
    status: str | None = Query(None, pattern="^(PENDING|IN_PROGRESS|DONE|ERROR)$"),
    classes: str | None = Query(None),   # "aman,genangan_air,jalan_bolong"
    min_score: int = Query(0, ge=0, le=100),
    max_score: int = Query(100, ge=0, le=100),
    limit: int = Query(1000, ge=1, le=5000),
    session: Session = Depends(get_session),
):
    from sqlmodel import select

    stmt = (
        select(Issue)
        .where(Issue.latitude.is_not(None))
        .where(Issue.longitude.is_not(None))
        .where(Issue.final_score.is_not(None))
    )

    if status:
        stmt = stmt.where(Issue.status == status)

    if classes:
        cls_list = [c.strip() for c in classes.split(",") if c.strip()]
        if cls_list:
            stmt = stmt.where(Issue.issue_class.in_(cls_list))

    stmt = (
        stmt.where(Issue.final_score >= min_score)
            .where(Issue.final_score <= max_score)
            .order_by(Issue.created_at.desc())
            .limit(limit)
    )

    issues = session.exec(stmt).all()

    points = []
    for iss in issues:
        if abs(iss.latitude) < 1e-6 and abs(iss.longitude) < 1e-6:
            continue

        base_intensity = (iss.final_score or 0) / 100.0

        if iss.severity_label == "HIGH":
            intensity = min(1.0, base_intensity * 1.2)
        elif iss.severity_label == "MEDIUM":
            intensity = min(1.0, base_intensity * 1.0)
        else:
            intensity = max(0.15, base_intensity * 0.7)

        points.append({
            "lat": iss.latitude,
            "lon": iss.longitude,
            "intensity": round(float(intensity), 3),
            "class": iss.issue_class,
            "severity": iss.severity_label,
            "score": iss.final_score,
            "status": iss.status,
        })

    return {
        "total": len(points),
        "points": points,
    }



# --- RUN DIRECT ---
if __name__ == "__main__":
    print("[SYSTEM] Starting BaliCivic AI Server.")
    # Host 0.0.0.0 agar bisa diakses device lain satu WiFi (untuk demo HP)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
