import os
import shutil
import uvicorn
from uuid import uuid4
from datetime import datetime
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
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

# --- INTERNAL MODULES ---
# Pastikan file database.py, models.py, utils.py ada di folder yang sama!
from database import create_db_and_tables, get_session, engine
from models import Issue
from utils import process_analysis

# 1. LOAD ENVIRONMENT
load_dotenv()

# 2. LIFESPAN MANAGER
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bikin tabel kalau belum ada
    create_db_and_tables()
    print("[SYSTEM] Database SQLite Connected & Tables Ready.")
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # semua origin boleh
    allow_credentials=False,  # WAJIB False kalau pakai "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Static Files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
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
    file_path = f"{UPLOAD_DIR}/{fid}.jpg"

    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal simpan file: {str(e)}")

    new_issue = Issue(
        title="Sedang Menganalisis",
        description="Menunggu antrean pemrosesan AI.",
        latitude=lat,
        longitude=long,
        issue_class="processing",
        severity_label="LOW",
        final_score=0,
        image_url=f"/static/{fid}.jpg",
        status="PENDING",
        breakdown_score={},
        secondary_issues=[],
        meta_data={},
    )

    session.add(new_issue)
    session.commit()
    session.refresh(new_issue)

    background_tasks.add_task(run_analysis_background, new_issue.id, file_path)

    return {
        "message": "Laporan diterima & sedang diproses",
        "id": new_issue.id,
        "status": "PENDING",
        "image_url": new_issue.image_url,
    }



@app.get("/api/issues", response_model=List[Issue])
def read_issues(session: Session = Depends(get_session)):
    """
    Ambil semua issue, urut dari terbaru.
    """
    statement = select(Issue).order_by(Issue.created_at.desc())
    results = session.exec(statement).all()
    return results


@app.get("/api/issues/{issue_id}")
def read_single_issue(issue_id: str, session: Session = Depends(get_session)):
    """
    Detail satu issue.
    """
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return issue


@app.put("/api/issues/{issue_id}/status")
def update_status(issue_id: int, status: str, session: Session = Depends(get_session)):
    """
    Update status oleh admin (Dinas) & Catat di Timeline.
    Flow: PENDING -> OPEN (Dikerjakan) -> DONE (Selesai)
    """
    # 1. Cari Data
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")

    # 2. Tentukan Pesan Aksi untuk Timeline (Biar History-nya Cantik)
    action_message = "Status diperbarui"
    if status == "IN_PROGRESS":
        action_message = "Laporan Diverifikasi & Tim Dikerahkan"
    elif status == "DONE":
        action_message = "Perbaikan Selesai & Laporan Ditutup"
    elif status == "ERROR":
        action_message = "Laporan Ditolak / Invalid"

    # 3. Buat Object Event Baru (Jejak Digital)
    new_event = {
        "status": status,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "actor": "Admin Dinas",
        "message": action_message
    }

    # 4. Update Timeline (Append ke list JSON yang sudah ada)
    # Kita copy list lama, tambah event baru, lalu simpan balik
    current_timeline = list(issue.timeline) if issue.timeline else []
    current_timeline.append(new_event)
    issue.timeline = current_timeline  # Simpan JSON

    # 5. Update Status Utama
    issue.status = status
    issue.updated_at = datetime.now()

    # 6. Simpan ke Database
    session.add(issue)
    session.commit()
    session.refresh(issue)

    print(f"[ADMIN] Status Issue #{issue_id} berubah menjadi {status}")
    
    return {
        "message": "Status berhasil diupdate", 
        "current_status": status,
        "history": new_event
    }


@app.get("/api/sumary")
def get_dashboard(session: Session = Depends(get_session)):
    """
    Ringkasan untuk dashboard admin:
    total laporan, jumlah antrean, butuh tindakan, selesai.
    """
    all_issues = session.exec(select(Issue)).all()
    total = len(all_issues)
    pending = len([i for i in all_issues if i.status == "PENDING"])
    action_needed = len([i for i in all_issues if i.status == "IN_PROGRESS"])
    completed = len([i for i in all_issues if i.status == "DONE"])

    return {
        "total": total,
        "antrean": pending,
        "perlu_tindakan": action_needed,
        "selesai": completed,
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
        "genangan": len([i for i in all_issues if i.issue_class == "genangan"]),
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
            "percent": round((counts["genangan"] / total) * 100),
            "color": "#1976d2",
            "count": counts["genangan"],
        },
        {
            "label": "Kabel Semrawut",
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
    status: str | None = Query(None, regex="^(PENDING|OPEN|DONE)$"),
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
