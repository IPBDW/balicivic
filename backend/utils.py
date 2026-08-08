import os
import math
import json
import cv2
import google.generativeai as genai
from ultralytics import YOLO
from sqlmodel import Session
from dotenv import load_dotenv
import requests
from typing import Tuple, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from openai import OpenAI
from models import Issue

# Load Environment Variables
load_dotenv()


# --- GEMINI CONFIG ---
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# --- OpenRouter API ---
OPENROUTER_API_KEY = os.getenv("OpenRouter_API")

# Inisialisasi Client
client = None
if OPENROUTER_API_KEY:
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
    except Exception as e:
        print(f"[UTILS] Gagal init OpenAI Client: {e}")

# Fungsi Fallback (Penyelamat jika AI Error)
def _fallback_llm_result(payload):
    return {
        "size_reasoning": {"reason": "AI Offline/Timeout", "size_category": "Tidak Diketahui"},
        "validation": {
            "math_score": payload.get('score', 0), 
            "severity_label_math": payload.get('severity_label', 'LOW'),
            "consistency_flag": "Perlu Ditinjau"
        },
        "public": {
            "title": "Laporan Infrastruktur", 
            "message": "Laporan telah diterima sistem. Menunggu verifikasi manual dinas terkait.", 
            "severity_label": payload.get('severity_label', 'LOW')
        },
        "dinas": {
            "title": "Laporan Masuk (No-AI)", 
            "summary": "Deteksi objek berhasil, analisis narasi tertunda.", 
            "technical_report": "Koneksi ke LLM gagal saat inferensi.", 
            "priority": payload.get('severity_label', 'LOW')
        }
    }


# --- Reverse Geocoding ---
LOCATIONIQ_API_KEY = os.getenv("LOCATIONIQ_API_KEY")
LOCATIONIQ_URL = "https://us1.locationiq.com/v1/reverse.php"

def reverse_geocode(lat: Optional[float], lon: Optional[float]) -> Tuple[Optional[str], Optional[str]]:
    """
    Reverse geocoding via LocationIQ.
    Input  : lat, lon
    Output : (kecamatan, kabupaten) -> bisa None, None kalau gagal.
    """
    if lat is None or lon is None:
        return None, None

    # 0,0 itu tengah laut, anggap invalid
    if abs(lat) < 1e-6 and abs(lon) < 1e-6:
        return None, None

    if not LOCATIONIQ_API_KEY:
        print("[GEOCODER] LOCATIONIQ_API_KEY tidak ditemukan di .env")
        return None, None

    try:
        params = {
            "key": LOCATIONIQ_API_KEY,
            "lat": lat,
            "lon": lon,
            "format": "json",
            "normalizeaddress": 1,
        }
        headers = {
            "User-Agent": "BalicivilAI/1.0 (+https://balicivilai.site)"
        }

        resp = requests.get(LOCATIONIQ_URL, params=params, headers=headers, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        addr = data.get("address", {})

        # Cari "kecamatan"
        kec = addr.get("city")
        # Cari "kabupaten / kota"
        kab = addr.get("county")

        if kec:
            kec = kec.strip()
        if kab:
            kab = kab.strip()

        print(f"[GEOCODER] Hasil reverse geocode: kec={kec}, kab={kab}")
        return kec, kab

    except Exception as e:
        print(f"[GEOCODER] Reverse geocoding gagal (LocationIQ): {e}")
        return None, None


# --- GLOBAL YOLO MODEL (Lazy Singleton) ---
_model_instance = None


def get_model():
    """
    Load model YOLO sekali saja (lazy load).
    """
    global _model_instance
    if _model_instance is None:
        print("[SYSTEM] Loading AI Model ke Memory...")
        try:
            if os.path.exists(os.path.join("weights", "best.pt")):
                _model_instance = YOLO(os.path.join("weights", "best.pt"))
                print("[SYSTEM] Model Custom 'weights/best.pt' Loaded.")
            else:
                print("[WARN] 'weights/best.pt' tidak ada. Menggunakan 'weights/yolo11s.pt'.")
                _model_instance = YOLO(os.path.join("weights", "yolo11s.pt"))
        except Exception as e:
            print(f"[FATAL] Gagal load model: {e}")
            raise e
    return _model_instance


# --- DETEKSI CONFIG ---

CONF_THRESHOLDS = {
    "jalan_bolong": 0.65,
    "genangan": 0.35,
    "sampah_liar": 0.30,
    "kabel_semrawut": 0.20,
}

SEVERITY_CONFIG = {
    "jalan_bolong":   {"base": 40, "max": 95, "size_factor": 1.5},
    "kabel_semrawut": {"base": 30, "max": 80, "size_factor": 1.2},
    "genangan":       {"base": 20, "max": 70, "size_factor": 1.0},
    "sampah_liar":    {"base": 15, "max": 60, "size_factor": 0.8},
}

CLASS_LABEL_PUBLIC = {
    "jalan_bolong": "jalan berlubang",
    "genangan": "genangan air",
    "sampah_liar": "tumpukan sampah liar",
    "kabel_semrawut": "kabel semrawut",
}

# Asumsi kamera warga
CAMERA_CFG = {
    "assumed_distance_m": 4.0,
    "min_distance_m": 3.0,
    "max_distance_m": 5.0,
    "vertical_fov_deg": 60.0,
    "horizontal_fov_deg": 60.0,
    "road_width_m": (4.0, 6.0),
}


# ============================================================
# 1. HELPERS GEOMETRI & SKOR
# ============================================================

def score_to_label(score: int) -> str:
    """
    Mapping skor 0–100 ke label keparahan.
    """
    if score >= 75:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


def distance_bucket_from_y(y_center: float):
    """
    Kategori jarak dari posisi vertikal (0 = atas, 1 = bawah).
    """
    if y_center < 0.35:
        return "Jauh", CAMERA_CFG["max_distance_m"]
    if y_center < 0.65:
        return "Sedang", (CAMERA_CFG["min_distance_m"] + CAMERA_CFG["max_distance_m"]) / 2
    return "Dekat", CAMERA_CFG["min_distance_m"]


def estimate_physical_width_m(box, img_w: int, img_h: int) -> float:
    """
    Estimasi kasar lebar objek (meter) dari lebar bbox dan FOV horizontal.
    Ini APPROX, bukan laser meter. Cukup buat prior untuk LLM.
    """
    x1, y1, x2, y2 = box
    box_w_px = max(1.0, x2 - x1)
    frac_w = box_w_px / float(img_w)

    fov_deg = CAMERA_CFG["horizontal_fov_deg"]
    dist_nominal = CAMERA_CFG["assumed_distance_m"]

    fov_rad = math.radians(fov_deg)
    scene_width_m = 2 * dist_nominal * math.tan(fov_rad / 2.0)
    est_width = scene_width_m * frac_w
    return float(est_width)


def build_geometry_for_box(box, img_w: int, img_h: int, score_item: int):
    """
    Hitung geometri + estimasi ukuran untuk satu bbox (biasanya yang dominan).
    """
    x1, y1, x2, y2 = box
    box_w = max(1.0, x2 - x1)
    box_h = max(1.0, y2 - y1)

    area_ratio = (box_w * box_h) / float(img_w * img_h)
    y_center = ((y1 + y2) / 2.0) / float(img_h)

    distance_category, distance_m = distance_bucket_from_y(y_center)
    width_m = estimate_physical_width_m(box, img_w, img_h)

    # Range ±20%
    low = max(0.01, width_m * 0.8)
    high = width_m * 1.2

    geom = {
        "position_y": float(y_center),
        "ratio": float(area_ratio),
        "ratio_percent": float(area_ratio * 100.0),
        "distance_category": distance_category,
        "distance_m": float(distance_m),
        "estimated_width_m": float(width_m),
        "estimated_width_range_m": [float(low), float(high)],
        "item_score": int(score_item),
    }
    return geom


def calculate_spatial_score(detections, img_w: int, img_h: int):
    """
    Core math engine:
    - Hitung skor per objek pakai SEVERITY_CONFIG + area + perspektif.
    - Aplikasikan Damped Accumulation untuk skor final foto.
    - Pilih objek dominan + geometri lengkapnya.
    - Kembalikan:
        final_score, primary_issue, breakdown_per_class, geometry_dom, objects_meta
    """
    individual = []

    for det in detections:
        box = det["box"]  # [x1,y1,x2,y2]
        cls = det["class"]

        x1, y1, x2, y2 = box
        box_w = max(1.0, x2 - x1)
        box_h = max(1.0, y2 - y1)

        area_ratio = (box_w * box_h) / float(img_w * img_h)

        y_center = ((y1 + y2) / 2.0) / float(img_h)
        distance_multiplier = 1.0 + (0.8 * (1.0 - y_center))

        cfg = SEVERITY_CONFIG.get(cls, {"base": 10, "max": 50, "size_factor": 1.0})

        raw_score = cfg["base"] + (area_ratio * distance_multiplier * 100.0 * cfg["size_factor"])
        item_score = min(cfg["max"], int(raw_score))

        individual.append(
            {
                "class": cls,
                "score": item_score,
                "box": box,
                "area_ratio": float(area_ratio),
                "y_center": float(y_center),
                "distance_multiplier": float(distance_multiplier),
            }
        )

    if not individual:
        # Tidak ada deteksi
        return 0, "unknown", {}, None, []

    # Sort by score desc
    individual.sort(key=lambda x: x["score"], reverse=True)

    dominant = individual[0]
    max_score = dominant["score"]
    primary_issue = dominant["class"]

    residual_score = 0
    breakdown = {primary_issue: max_score}

    for item in individual[1:]:
        residual_score += item["score"]
        cname = item["class"]
        breakdown[cname] = breakdown.get(cname, 0) + item["score"]

    # Damped accumulation
    # Bisa kamu tweak kalau nanti terlalu sensitif
    final_score = max_score + 0.3 * min(residual_score, max_score)
    final_score = min(100, int(final_score))

    geometry_dom = build_geometry_for_box(
        dominant["box"], img_w, img_h, score_item=max_score
    )

    return final_score, primary_issue, breakdown, geometry_dom, individual


# ============================================================
# 2. GEMINI: SIZE REASONING + PUBLIC + DINAS (1 CALL)
# ============================================================

def _build_location_text(issue: Issue) -> str:
    # 1. Kalau kecamatan & kabupaten sudah ada
    if issue.kecamatan and issue.kabupaten:
        return f"{issue.kecamatan}, {issue.kabupaten}"
    if issue.kecamatan:
        return issue.kecamatan
    if issue.kabupaten:
        return issue.kabupaten

    # 2. Kalau cuma ada koordinat
    if issue.latitude is not None and issue.longitude is not None:
        if abs(issue.latitude) < 1e-6 and abs(issue.longitude) < 1e-6:
            return "lokasi yang belum terdeteksi koordinatnya"
        return f"Koordinat sekitar ({issue.latitude:.5f}, {issue.longitude:.5f})"

    # 3. Benar-benar tidak ada info
    return "Lokasi tidak diketahui"


def _fallback_llm_result(payload: dict):
    """
    Kalau GEMINI_API_KEY kosong / error, pakai fallback ini.
    Minimal tetap punya teks untuk publik dan dinas.
    """
    primary = payload.get("primary_issue_class", "unknown")
    pretty = CLASS_LABEL_PUBLIC.get(primary, primary.replace("_", " "))
    score = payload.get("score", 0)
    severity_label = payload.get("severity_label", score_to_label(score))
    loc = payload.get("location", "lokasi yang dilaporkan")

    geom = payload.get("geometry", {}) or {}
    width = geom.get("estimated_width_m")
    dist = geom.get("distance_m")

    dim_str = ""
    if width:
        dim_str += f" dengan perkiraan lebar sekitar {width:.2f} meter"
    if dist:
        dim_str += f" pada jarak pengambilan sekitar {dist:.1f} meter"

    public_msg = (
        f"Sistem mendeteksi masalah berupa {pretty}{dim_str} di {loc}. "
        f"Tingkat bahaya dikategorikan {severity_label.lower()}."
    )

    dinas_tech = (
        f"Kerusakan berupa {pretty}{dim_str} dengan skor sistem {score}/100 "
        f"dan prioritas {severity_label}."
    )

    return {
        "size_reasoning": {
            "adjusted_width_m": geom.get("estimated_width_m"),
            "adjusted_width_range_m": geom.get("estimated_width_range_m"),
            "size_category": None,
            "reason": "Menggunakan estimasi geometri langsung tanpa penalaran tambahan karena layanan Gemini tidak tersedia.",
        },
        "public": {
            "title": f"{pretty.title()} Teridentifikasi",
            "message": public_msg,
            "severity_label": severity_label,
        },
        "dinas": {
            "title": f"{pretty.title()} - {severity_label}",
            "summary": f"{pretty.title()} dengan prioritas {severity_label} di {loc}.",
            "technical_report": dinas_tech,
            "recommended_action": "Mohon dilakukan verifikasi lapangan dan penanganan sesuai prosedur standar.",
            "priority": severity_label,
            "estimated_width_m": geom.get("estimated_width_m"),
            "estimated_width_range_m": geom.get("estimated_width_range_m"),
            "distance_m": geom.get("distance_m"),
        },
    }


import json
from openai import OpenAI

# Pastikan Anda sudah mendefinisikan ini di atas file atau config
# OPENROUTER_API_KEY = "sk-or-v1-....." 

def ask_gemini_combined(payload: dict):
    """
    Satu fungsi untuk:
    - penalaran ukuran (size_reasoning)
    - validasi konsistensi (validation)
    - output publik (public)
    - output dinas (dinas)
    Semua dikerjakan oleh LLM via OpenRouter se-detail mungkin.
    """
    
    # 1. Cek API Key OpenRouter
    if not OPENROUTER_API_KEY:
        print("[LLM] API key OpenRouter tidak ditemukan. Pakai fallback.")
        return _fallback_llm_result(payload)

    # 2. Setup Client OpenAI (untuk OpenRouter)
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
    except Exception as e:
        print(f"[LLM INIT ERROR] {e}")
        return _fallback_llm_result(payload)

    # 3. Siapkan Prompt (SAMA PERSIS SEPERTI ASLINYA)
    payload_json = json.dumps(payload, ensure_ascii=False, indent=2)
    prompt = f"""
PERAN:
Anda adalah insinyur sipil dan analis infrastruktur jalan yang membantu sistem pelaporan otomatis.
Data analitik (skor, ukuran, dan geometri) sudah dihitung oleh sistem vision & matematika.
Tugas Anda adalah:
1) Memeriksa kewajaran estimasi ukuran kerusakan.
2) Memeriksa konsistensi antara skor, ukuran, dan label keparahan.
3) Menyusun narasi laporan untuk publik dan untuk dinas dengan bahasa yang jelas dan teknis.

=== DATA ANALITIK SISTEM (JANGAN DIUBAH) ===
{payload_json}

PENJELASAN DATA:
- "severity_label" adalah label keparahan hasil sistem (LOW, MEDIUM, HIGH).
- "score" adalah skor 0–100 yang dihitung algoritma math.
- "geometry" berisi:
  - "ratio_percent": persentase area gambar yang tertutup kerusakan.
  - "distance_category": Jauh / Sedang / Dekat dari kamera.
  - "distance_m": jarak kira-kira kamera ke objek (meter).
  - "estimated_width_m": estimasi lebar kerusakan (meter) dari perhitungan geometri.
  - "estimated_width_range_m": rentang lebar matematis.
- "breakdown" berisi skor per kelas kerusakan.
- "location" adalah deskripsi lokasi (alamat administratif atau koordinat).

TUGAS ANDA:

[1] SIZE_REASONING (PENALARAN UKURAN)
- Periksa apakah "geometry.estimated_width_m" dan "geometry.estimated_width_range_m" wajar terhadap:
  - "geometry.ratio_percent",
  - "geometry.distance_category",
  - "road_width_m" (lebar jalan 4–6 meter).
- Jika wajar, gunakan nilai tersebut sebagai dasar.
- Jika perlu koreksi, koreksi secara wajar dengan batas:
  - faktor koreksi hanya boleh antara 0.5x sampai 1.8x dari nilai matematis.
- Tentukan kategori ukuran:
  - <0.3 m  => "Kecil"
  - 0.3–0.8 => "Sedang"
  - 0.8–1.5 => "Besar"
  - >1.5    => "Sangat Besar"
- Berikan 1 kalimat alasan singkat yang menjelaskan logika Anda.

[2] VALIDATION (PEMERIKSAAN & VERIFIKASI)
- Nilai math "score" dan "severity_label" TIDAK boleh diubah, tetapi Anda boleh memberi opini:
  - apakah label tersebut "Konsisten", "Sedikit Tidak Konsisten", atau "Perlu Ditinjau".
- Pertimbangkan:
  - ukuran kerusakan yang Anda perkirakan,
  - posisi dan konteks (jarak, area yang tertutup),
  - jenis kerusakan (misalnya jalan berlubang lebih kritis daripada sampah kecil).
- Lengkapi:
  - "severity_label_math": langsung dari data sistem.
  - "severity_label_opinion": opini Anda (boleh sama atau beda, tapi jangan ekstrem).
  - "consistency_flag": "Konsisten" / "Sedikit Tidak Konsisten" / "Perlu Ditinjau".
  - "consistency_notes": 1–2 kalimat singkat.
  - "uncertainty_level": "Rendah" / "Sedang" / "Tinggi".
  - "uncertainty_reason": 1 kalimat singkat yang menjelaskan sumber ketidakpastian.

[3] OUTPUT UNTUK PUBLIK (PUBLIC)
- Buat pesan yang dapat dibaca warga umum, sedikit teknis tapi tetap mudah dipahami.
- "title": 3–8 kata, jelas, tidak provokatif.
- "message": 2–4 kalimat yang menjelaskan:
  - jenis kerusakan,
  - gambaran ukuran (meter),
  - dampak umum terhadap pengguna jalan,
  - tingkat bahaya.
- Gunakan istilah seperti "bahaya rendah/sedang/tinggi" yang bersumber dari "severity_label".
- Sebutkan lokasi secara singkat jika memungkinkan (tanpa koordinat panjang).

[4] OUTPUT UNTUK DINAS (DINAS)
- Buat laporan teknis singkat yang bisa digunakan dinas pekerjaan umum sebagai bahan tindak lanjut.
- "title": judul laporan teknis singkat.
- "summary": 1 kalimat ringkas untuk tampilan daftar laporan.
- "technical_report": 2–4 kalimat, gaya birokratis-teknis, mencakup:
  - jenis kerusakan,
  - estimasi lebar (meter + rentang),
  - jarak pengambilan foto,
  - keterkaitan dengan skor sistem dan label keparahan.
- "risk_notes": 1–3 kalimat yang menjelaskan risiko operasional (contoh: potensi kecelakaan, gangguan arus lalu lintas).
- "recommended_action": 1–3 kalimat rekomendasi tindakan teknis (misalnya patching aspal, pembersihan, drainase, penataan kabel).
- "followup_suggestion": 1 kalimat saran tindak lanjut (misalnya verifikasi lapangan, inspeksi tambahan).
- "priority": HARUS sama dengan "severity_label" dari data sistem.
- "estimated_width_m" dan "estimated_width_range_m" HARUS konsisten dengan hasil "size_reasoning".
- "distance_m" boleh diambil dari data atau nilai yang paling logis berdasarkan konteks.

FORMAT OUTPUT WAJIB (JSON SAJA, SATU OBJEK):
{{
  "size_reasoning": {{
    "adjusted_width_m": <angka atau null>,
    "adjusted_width_range_m": [<angka_min>, <angka_max>] atau null,
    "size_category": "Kecil" | "Sedang" | "Besar" | "Sangat Besar" | null,
    "reason": "<1 kalimat penjelasan singkat>"
  }},
  "validation": {{
    "math_score": <angka>,
    "severity_label_math": "LOW" | "MEDIUM" | "HIGH",
    "severity_label_opinion": "LOW" | "MEDIUM" | "HIGH",
    "consistency_flag": "Konsisten" | "Sedikit Tidak Konsisten" | "Perlu Ditinjau",
    "consistency_notes": "<1-2 kalimat>",
    "uncertainty_level": "Rendah" | "Sedang" | "Tinggi",
    "uncertainty_reason": "<1 kalimat>"
  }},
  "public": {{
    "title": "<string>",
    "message": "<string>",
    "severity_label": "LOW" | "MEDIUM" | "HIGH"
  }},
  "dinas": {{
    "title": "<string>",
    "summary": "<string>",
    "technical_report": "<string>",
    "risk_notes": "<string>",
    "recommended_action": "<string>",
    "followup_suggestion": "<string>",
    "priority": "LOW" | "MEDIUM" | "HIGH",
    "estimated_width_m": <angka atau null>,
    "estimated_width_range_m": [<angka_min>, <angka_max>] atau null,
    "distance_m": <angka atau null>
  }}
}}

ATURAN KETAT:
- "priority" dan "public.severity_label" WAJIB sama dengan "severity_label" dari data sistem.
- "validation.math_score" HARUS sama dengan "score" dari data sistem.
- Jangan menghapus atau mengubah nilai di data analitik.
- Jangan menambah teks di luar JSON.
- Jangan membungkus jawaban dalam blok markdown atau ```json.
- Kembalikan HANYA JSON valid.
"""

    try:
        # 4. Request ke OpenRouter
        # Saya gunakan model 'google/gemini-2.0-flash-exp:free' karena paling pintar untuk JSON complex & Gratis
        # Kalau mau ganti Gemma, ubah jadi 'google/gemma-2-9b-it:free'
        completion = client.chat.completions.create(
            model="google/gemma-3-27b-it:free",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2, # Rendah agar konsisten
        )
        
        # 5. Ambil Text Result
        raw_text = completion.choices[0].message.content.strip() or ""
        print("[LLM RAW]", raw_text[:200].replace("\n", " "))

        # 6. Logic Parsing JSON (Dipertahankan dari kode asli karena sudah bagus)
        
        # 1) Coba parse langsung
        try:
            return json.loads(raw_text)
        except Exception:
            pass

        # 2) Kalau dia maksa pakai ```json ... ```
        if "```" in raw_text:
            parts = raw_text.split("```")
            for part in parts:
                p = part.strip()
                # Kadang ada 'json' di awal
                if p.lower().startswith("json"):
                    p = p[4:].strip()
                
                if p.startswith("{") and p.endswith("}"):
                    try:
                        return json.loads(p)
                    except Exception:
                        continue

        # 3) Ambil substring { ... } paling luar
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = raw_text[start : end + 1]
            try:
                return json.loads(candidate)
            except Exception:
                pass

        print("[LLM PARSE ERROR] Gagal parse JSON, pakai fallback.")
        return _fallback_llm_result(payload)

    except Exception as e:
        print(f"[LLM ERROR] {e}")
        return _fallback_llm_result(payload)
# ============================================================
# 3. EMAIL SENDER
# ============================================================
# EMAIL SENDERs
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "balicivicai1@gmail.com"
SENDER_PASS = "fbze bvnn ihrk vljh"
TARGET_EMAIL = "mifebyte@gmail.com"
TOKEN = "dinas_pupr_2025" 




def send_email_alert(issue_data: Issue):
    try:
        # Filter Cerdas: Hanya kirim jika skor > 60 (Medium ke atas)
        if issue_data.final_score < 60:
            print(f"[EMAIL] Skor {issue_data.final_score} (Low/Medium-Low). Email dilewati.")
            return

        print(f"[EMAIL] Mempersiapkan pengiriman peringatan untuk ID {issue_data.id}...")
        dashboard_url = f"https://balicivicai.site/admin.html?token={TOKEN}&id={issue_data.id}"

        # Setup Pesan Multipart
        msg = MIMEMultipart('related')
        msg['From'] = f"BaliCivic AI <{SENDER_EMAIL}>"
        msg['To'] = TARGET_EMAIL
        msg['Subject'] = f"🚨 PERINGATAN: {issue_data.title} ({issue_data.severity_label})"

        # Template HTML Email dengan gambar inline
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #d32f2f; color: white; padding: 15px; text-align: center;">
                <h2 style="margin:0;">SISTEM DETEKSI DINI</h2>
                <small>BaliCivic AI - Smart Infrastructure Monitor</small>
            </div>
            
            <div style="padding: 20px;">
                <p>Yth. Admin Dinas Pekerjaan Umum,</p>
                <p>Sistem AI telah mendeteksi kerusakan infrastruktur dengan prioritas <strong>{issue_data.severity_label}</strong> yang memerlukan atensi.</p>
                
                <!-- GAMBAR HASIL DETEKSI -->
                <div style="text-align: center; margin: 20px 0;">
                    <img src="cid:detection_image" style="max-width: 100%; border-radius: 8px; border: 2px solid #d32f2f;" alt="Hasil Deteksi AI">
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">Hasil Analisis AI - Objek Terdeteksi</p>
                </div>
                
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px; border-left: 4px solid #d32f2f; background: #fff5f5;">
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Masalah</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">{issue_data.issue_class.replace('_', ' ').title()}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Lokasi</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">{issue_data.kecamatan or 'Lokasi GPS'}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Skor Bahaya</strong></td><td style="padding:8px; border-bottom:1px solid #eee;"><strong style="color:red">{issue_data.final_score}/100</strong></td></tr>
                    <tr><td style="padding:8px;"><strong>Analisis AI</strong></td><td style="padding:8px; font-style: italic;">"{issue_data.description}"</td></tr>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{dashboard_url}" style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        TINDAK LANJUTI SEKARANG
                    </a>
                </div>
                
                <p style="font-size: 12px; color: #666; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
                    Laporan ini digenerate otomatis oleh Server AI pada {issue_data.created_at}.<br>
                    ID Laporan: #{issue_data.id}
                </p>
            </div>
        </div>
        """

        msg.attach(MIMEText(html_body, 'html'))

        # Attach gambar hasil deteksi
        if issue_data.image_url:
            # image_url format: /static/abc123_detected.jpg
            image_filename = issue_data.image_url.replace("/static/", "")
            image_path = os.path.join("uploads", image_filename)
            
            if os.path.exists(image_path):
                with open(image_path, 'rb') as img_file:
                    img_data = img_file.read()
                    img_mime = MIMEImage(img_data, _subtype='jpeg')
                    img_mime.add_header('Content-ID', '<detection_image>')
                    img_mime.add_header('Content-Disposition', 'inline', filename=image_filename)
                    msg.attach(img_mime)
                    print(f"[EMAIL] Gambar {image_filename} dilampirkan.")
            else:
                print(f"[EMAIL] Gambar tidak ditemukan: {image_path}")

        # Kirim via SMTP Gmail
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASS)
        server.send_message(msg)
        server.quit()
        
        print(f"[EMAIL] SUKSES! Notifikasi terkirim ke {TARGET_EMAIL}")

    except Exception as e:
        print(f"[EMAIL ERROR] Gagal mengirim: {e}")
# ============================================================
# 4. CORE PROCESSOR (dipanggil dari background task)
# ============================================================

def process_analysis(issue_id: str, image_path: str, session: Session):
    print(f"\n[ENGINE] === MEMULAI ANALISIS ID: {issue_id} ===")

    try:
        model = get_model()

        abs_path = os.path.abspath(image_path)
        print(f"[ENGINE] Reading image: {abs_path}")

        results = model.predict(abs_path, conf=0.15, save=False, verbose=False)
        r = results[0]

        # Simpan gambar dengan bbox
        annotated_img = r.plot()
        filename = os.path.basename(image_path)
        detected_filename = filename.replace(".jpg", "_detected.jpg")
        detected_path = os.path.join("uploads", detected_filename)
        cv2.imwrite(detected_path, annotated_img)
        print(f"[ENGINE] Gambar hasil deteksi disimpan ke: {detected_path}")

        valid_detections = []
        max_conf = 0.0
        primary_class_conf = "aman"

        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])

            if conf >= CONF_THRESHOLDS.get(cls_name, 0.25):
                valid_detections.append(
                    {
                        "class": cls_name,
                        "box": box.xyxy[0].tolist(),
                        "conf": conf,
                    }
                )
                if conf > max_conf:
                    max_conf = conf
                    primary_class_conf = cls_name

        print(f"[ENGINE] Deteksi Valid: {len(valid_detections)} objek.")

        # Ambil issue dari DB
        issue = session.get(Issue, issue_id)
        if not issue:
            print("[ERROR] Issue ID tidak ditemukan di DB.")
            return

        # Auto-lokasi: hanya kalau belum ada kecamatan/kabupaten tapi koordinat ada
        if (not issue.kecamatan or not issue.kabupaten) and issue.latitude is not None and issue.longitude is not None:
            kec, kab = reverse_geocode(issue.latitude, issue.longitude)
            if kec or kab:
                issue.kecamatan = kec or issue.kecamatan
                issue.kabupaten = kab or issue.kabupaten
                session.add(issue)
                session.commit()
                session.refresh(issue)

        # Kalau tidak ada deteksi sama sekali
        if not valid_detections:
            print("[ENGINE] Tidak ada kerusakan terdeteksi.")
            issue.issue_class = "aman"
            issue.severity_label = "LOW"
            issue.final_score = 0
            issue.breakdown_score = {}
            issue.secondary_issues = []
            issue.meta_data = {"note": "Tidak ada objek valid terdeteksi oleh model."}
            issue.title = "Tidak Ditemukan Kerusakan"
            issue.description = "Sistem tidak menemukan kerusakan signifikan pada foto yang dikirim."
            issue.image_url = f"/static/{detected_filename}"
            issue.status = "PENDING"
            session.add(issue)
            session.commit()
            session.refresh(issue)
            print("[ENGINE] Selesai tanpa temuan.")
            return

        # Hitung skor spasial + geometri
        img_h, img_w = r.orig_shape[0], r.orig_shape[1]
        final_score, primary_issue, breakdown, geometry_dom, objects_meta = calculate_spatial_score(
            valid_detections, img_w, img_h
        )

        severity_label = score_to_label(final_score)

        # Build payload untuk LLM
        loc_text = _build_location_text(issue)
        payload = {
            "severity_label": severity_label,
            "score": final_score,
            "primary_issue_class": primary_issue,
            "location": loc_text,
            "geometry": geometry_dom,
            "breakdown": breakdown,
            "objects": objects_meta,
            "road_width_m": CAMERA_CFG["road_width_m"],
            "timestamp": issue.created_at.isoformat() if issue.created_at else None,
        }

        print("[ENGINE] Mengontak Gemini (combined reasoning + public + dinas).")
        llm_result = ask_gemini_combined(payload)

        size_reasoning = llm_result.get("size_reasoning", {}) or {}
        public_out = llm_result.get("public", {}) or {}
        dinas_out = llm_result.get("dinas", {}) or {}

        # Sinkronkan width dari size_reasoning kembali ke geometry jika ada
        adj_w = size_reasoning.get("adjusted_width_m")
        adj_range = size_reasoning.get("adjusted_width_range_m")
        if geometry_dom is not None:
            if adj_w is not None:
                geometry_dom["estimated_width_m"] = adj_w
            if adj_range:
                geometry_dom["estimated_width_range_m"] = adj_range

        # Update Issue
        issue.issue_class = primary_issue
        issue.severity_label = severity_label
        issue.final_score = final_score
        issue.breakdown_score = breakdown
        issue.secondary_issues = [
            o for o in objects_meta if o.get("class") != primary_issue
        ]

        # Meta data teknis full
        issue.meta_data = {
            "geometry": geometry_dom,
            "objects": objects_meta,
            "llm_payload": payload,
            "llm_result": llm_result,
        }

        # Title & description
        issue.title = dinas_out.get(
            "title",
            f"Laporan: {CLASS_LABEL_PUBLIC.get(primary_issue, primary_issue.replace('_', ' ')).title()}",
        )

        # description: prioritas ke technical_report, fallback ke message publik
        issue.description = (
            dinas_out.get("technical_report")
            or public_out.get("message")
            or "Sistem berhasil menganalisis laporan, namun deskripsi tidak tersedia."
        )

        # Simpan image annotated
        issue.image_url = f"/static/{detected_filename}"

        # Status tetap PENDING untuk diverifikasi admin
        issue.status = "PENDING"

        session.add(issue)
        session.commit()
        session.refresh(issue)
        print(
            f"[ENGINE] SUKSES! Issue: {issue.id}, "
            f"Class: {primary_issue}, Score: {final_score}, Severity: {severity_label}"
        )

        send_email_alert(issue)

    except Exception as e:
        print(f"[CRITICAL ERROR] Engine Failed: {e}")
        try:
            issue = session.get(Issue, issue_id)
            if issue:
                issue.status = "ERROR"
                # kalau belum ada meta_data, buat dict baru
                if not isinstance(issue.meta_data, dict):
                    issue.meta_data = {}
                issue.meta_data["error"] = str(e)
                session.add(issue)
                session.commit()
        except Exception:
            pass
