import os
import io
import math
import html
import hmac
import hashlib
import json
import base64
import cv2
import numpy as np
from PIL import Image
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
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()


# --- LLM Narasi (OpenAI-compatible: NineRouter / DeepSeek / OpenRouter / OpenAI / dll) ---
# Mendukung berbagai alias env agar fleksibel (LLM_API_KEY, API_KEY, DEEPSEEK_API_KEY, dll.)
LLM_API_KEY = (
    os.getenv("LLM_API_KEY")
    or os.getenv("API_KEY")
    or os.getenv("DEEPSEEK_API_KEY")
    or os.getenv("OpenRouter_API")
)
LLM_BASE_URL = (
    os.getenv("LLM_ENDPOINT")
    or os.getenv("ENDPOINT")
    or os.getenv("LLM_BASE_URL")
    or "https://api.deepseek.com"
)
LLM_MODEL = (
    os.getenv("LLM_MODEL")
    or os.getenv("NAME_MODEL")
    or os.getenv("MODEL_NAME")
    or "deepseek-chat"
)

if LLM_API_KEY:
    LLM_API_KEY = LLM_API_KEY.strip()
if LLM_BASE_URL:
    LLM_BASE_URL = LLM_BASE_URL.strip().rstrip("/")
if LLM_MODEL:
    LLM_MODEL = LLM_MODEL.strip()

# --- VLM (Vision-Language Model) sebagai HAKIM pipeline ---
# Band keparahan kualitatif -> rentang skor numerik yang TETAP.
# Rentang sengaja disejajarkan dengan score_to_label() supaya band dan label
# tidak pernah bertentangan:
#   RINGAN  -> LOW    (0-44)
#   SEDANG  -> MEDIUM (45-74)
#   BERAT   -> HIGH   (75-87)
#   KRITIS  -> HIGH   (88-100)
BAND_SCORE_RANGE = {
    "RINGAN": (0, 44),
    "SEDANG": (45, 74),
    "BERAT": (75, 87),
    "KRITIS": (88, 100),
}

# Keluarga kelas kerusakan. Dipakai untuk tie-break ketika VLM dan YOLO
# sama-sama menunjuk kerusakan permukaan jalan (mis. lubang berair bisa
# dibaca "jalan_bolong" atau "genangan_air"). Dalam keluarga yang sama,
# kelas YOLO dipakai supaya hasil antar-run konsisten.
_CLASS_FAMILY = {
    "jalan_bolong": "permukaan_jalan",
    "genangan_air": "permukaan_jalan",
    "kabel_semrawut": "utilitas",
    "sampah_liar": "kebersihan",
    "aman": "aman",
}

# --- Reverse Geocoding ---
LOCATIONIQ_API_KEY = os.getenv("LOCATIONIQ_API_KEY")
LOCATIONIQ_URL = "https://us1.locationiq.com/v1/reverse.php"
# Fallback gratis (tanpa API key) kalau LocationIQ tidak dikonfigurasi / gagal.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
GEOCODE_UA = "BaliCivicAI/1.0 (+https://balicivicai.site)"

# Urutan field address yang dicoba untuk "kecamatan" dan "kabupaten/kota".
# LocationIQ & Nominatim beda penamaan: LocationIQ pakai city/county,
# Nominatim pakai town/city_district/suburb dan region/city/county.
_KECAMATAN_KEYS = ("town", "city_district", "suburb", "village", "hamlet", "municipality", "city")
_KABUPATEN_KEYS = ("county", "region", "state_district", "city", "municipality", "town")


def _pick_first(addr: dict, keys) -> Optional[str]:
    for k in keys:
        v = addr.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _parse_address(addr: dict) -> Tuple[Optional[str], Optional[str]]:
    """Ambil (kecamatan, kabupaten) dari objek address LocationIQ/Nominatim."""
    if not isinstance(addr, dict):
        return None, None
    kec = _pick_first(addr, _KECAMATAN_KEYS)
    kab = _pick_first(addr, _KABUPATEN_KEYS)
    # Jangan tampilkan "Kuta, Kuta" — kalau sama, kabupaten kosongkan saja
    # supaya frontend tidak menampilkan duplikat.
    if kec and kab and kec.lower() == kab.lower():
        kab = None
    return kec, kab


def reverse_geocode(lat: Optional[float], lon: Optional[float]) -> Tuple[Optional[str], Optional[str]]:
    """
    Reverse geocoding via LocationIQ (kalau API key ada), lalu fallback
    ke Nominatim (gratis) kalau LocationIQ kosong/gagal.
    Input  : lat, lon
    Output : (kecamatan, kabupaten) -> bisa None, None kalau gagal.
    """
    if lat is None or lon is None:
        return None, None

    # 0,0 itu tengah laut, anggap invalid
    if abs(lat) < 1e-6 and abs(lon) < 1e-6:
        return None, None

    headers = {"User-Agent": GEOCODE_UA}

    # 1) LocationIQ (akurasi lebih baik untuk Indonesia, butuh API key)
    if LOCATIONIQ_API_KEY:
        try:
            params = {
                "key": LOCATIONIQ_API_KEY,
                "lat": lat,
                "lon": lon,
                "format": "json",
                "normalizeaddress": 1,
                "accept-language": "id",
            }
            resp = requests.get(LOCATIONIQ_URL, params=params, headers=headers, timeout=5)
            resp.raise_for_status()
            kec, kab = _parse_address(resp.json().get("address", {}))
            if kec or kab:
                print(f"[GEOCODER] LocationIQ: kec={kec}, kab={kab}")
                return kec, kab
            print("[GEOCODER] LocationIQ tidak memberi kecamatan/kabupaten, coba Nominatim.")
        except Exception as e:
            print(f"[GEOCODER] Reverse geocoding gagal (LocationIQ): {e}")

    # 2) Nominatim (fallback gratis, tanpa key)
    try:
        params = {
            "lat": lat,
            "lon": lon,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 18,
            "accept-language": "id",
        }
        resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=6)
        resp.raise_for_status()
        kec, kab = _parse_address(resp.json().get("address", {}))
        print(f"[GEOCODER] Nominatim: kec={kec}, kab={kab}")
        return kec, kab
    except Exception as e:
        print(f"[GEOCODER] Reverse geocoding gagal (Nominatim): {e}")

    return None, None


# --- GLOBAL YOLO MODELS (Multi-Model Registry) ---
_models_registry = {}


def get_models():
    """
    Load semua model kerusakan infrastruktur yang tersedia di weights/ (lazy load).
    Kategori yang didukung:
      - pothole (pothole.pt / best.pt) -> jalan_bolong
      - garbage (garbage.pt)           -> sampah_liar
      - kabel (kabel.pt)               -> kabel_semrawut
      - puddle (puddle.pt)             -> genangan_air
    Fallback: weights/yolo11s.pt jika tidak ada model spesifik.
    """
    global _models_registry
    if not _models_registry:
        print("[SYSTEM] Loading AI Models ke Memory...")
        weights_dir = "weights"

        model_specs = [
            ("pothole", ["pothole.pt", "best.pt"]),
            ("garbage", ["garbage.pt"]),
            ("kabel", ["kabel.pt"]),
            ("puddle", ["puddle.pt"]),
        ]

        for cat, filenames in model_specs:
            for fname in filenames:
                p = os.path.join(weights_dir, fname)
                if os.path.exists(p):
                    try:
                        _models_registry[cat] = YOLO(p)
                        print(f"[SYSTEM] Model {cat.upper()} Loaded: '{p}'")
                        break
                    except Exception as e:
                        print(f"[WARN] Gagal load model '{p}': {e}")

        # Fallback jika tidak ada model custom sama sekali
        if not _models_registry:
            fb = os.path.join(weights_dir, "yolo11s.pt")
            if os.path.exists(fb):
                print(f"[WARN] Menggunakan model fallback '{fb}'.")
                _models_registry["fallback"] = YOLO(fb)
            else:
                raise FileNotFoundError("Tidak ada model YOLO ditemukan di folder weights/.")

    return _models_registry


def get_model():
    """Backwards compatibility: mengembalikan model utama (pothole / default)."""
    models = get_models()
    return models.get("pothole") or list(models.values())[0]


# --- SCENE GUARD (deteksi "ini bukan foto infrastruktur jalan") ---
# Model spesifik (kabel/pothole) sering false positive pada foto dalam ruangan:
# meja kerja, laptop, keyboard, tas, kursi. Model COCO yolo11s sangat akurat
# mengenali benda indoor tersebut, jadi kita pakai sebagai penjaga konteks.
_coco_model = None
_COCO_WEIGHTS = os.path.join("weights", "yolo11s.pt")

# Kelas COCO yang praktis tidak mungkin muncul besar-besar di foto jalan raya.
# Sengaja TIDAK memuat couch/bed/dining table/kursi: barang bekas seperti itu
# justru sering jadi objek laporan "sampah liar" di pinggir jalan.
_INDOOR_CLASSES = {
    "laptop", "keyboard", "mouse", "tv", "cell phone", "book", "clock",
    "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
    "cup", "fork", "knife", "spoon", "bowl", "wine glass",
    "toilet", "sink", "refrigerator", "microwave", "oven", "toaster", "remote",
    # Makanan / camilan
    "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
    # Olahraga / mainan personal
    "frisbee", "skis", "snowboard", "sports ball", "baseball bat", "baseball glove", "tennis racket",
}

# Hewan yang jika menutupi porsi besar frame berarti foto hewan/peliharaan, bukan jalan.
_ANIMAL_CLASSES = {
    "dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"
}

# Barang yang bisa ada di jalan (tas, koper) hanya dicurigai kalau ukurannya
# sangat besar — artinya kamera menempel ke barang itu, bukan memotret jalan.
# Catatan: "chair" sengaja TIDAK dimasukkan — kursi bekas di pinggir jalan
# justru sering jadi objek laporan sampah liar.
_LARGE_PORTABLE_CLASSES = {"backpack", "handbag", "suitcase"}

# Label bahasa Indonesia untuk pesan penolakan (biar warga paham).
_SCENE_LABELS_ID = {
    "laptop": "laptop",
    "keyboard": "keyboard",
    "mouse": "mouse",
    "tv": "layar/monitor",
    "cell phone": "ponsel",
    "book": "buku",
    "clock": "jam",
    "vase": "vas",
    "scissors": "gunting",
    "teddy bear": "boneka",
    "hair drier": "pengering rambut",
    "toothbrush": "sikat gigi",
    "cup": "gelas",
    "fork": "garpu",
    "knife": "pisau",
    "spoon": "sendok",
    "bowl": "mangkuk",
    "wine glass": "gelas kaca",
    "bottle": "botol",
    "dining table": "meja",
    "couch": "sofa",
    "bed": "kasur",
    "toilet": "toilet",
    "sink": "wastafel",
    "refrigerator": "kulkas",
    "microwave": "microwave",
    "oven": "oven",
    "toaster": "pemanggang roti",
    "remote": "remote",
    "backpack": "tas punggung",
    "handbag": "tas",
    "suitcase": "koper",
    "chair": "kursi",
    "person": "orang / swafoto",
    "dog": "anjing",
    "cat": "kucing",
    "bird": "burung / unggas",
    "horse": "kuda",
    "sheep": "domba",
    "cow": "sapi",
    "elephant": "gajah",
    "bear": "beruang",
    "zebra": "zebra",
    "giraffe": "jerapah",
}


def _scene_label(name: str) -> str:
    return _SCENE_LABELS_ID.get(name, name)


def _get_coco_model():
    """Load model COCO (yolo11s) sekali saja untuk scene guard."""
    global _coco_model
    if _coco_model is None:
        if not os.path.exists(_COCO_WEIGHTS):
            return None
        try:
            _coco_model = YOLO(_COCO_WEIGHTS)
            print(f"[SCENE-GUARD] Model konteks dimuat: '{_COCO_WEIGHTS}'")
        except Exception as e:
            print(f"[SCENE-GUARD] Gagal load '{_COCO_WEIGHTS}': {e}")
            return None
    return _coco_model


def detect_vehicles(abs_path: str, img_w: int, img_h: int) -> list[list[float]]:
    """
    Deteksi bounding box kendaraan & orang (car, truck, bus, motorcycle, person) menggunakan YOLO11s (COCO).
    Dipakai untuk spatial suppression agar komponen kendaraan (spion mobil, wiper, antena,
    kaca belakang) dan pakaian/tali tas pejalan kaki tidak terdeteksi keliru sebagai 'kabel_semrawut'.
    """
    model = _get_coco_model()
    if model is None:
        return []
    try:
        res = model.predict(abs_path, conf=0.25, imgsz=640, verbose=False)[0]
    except Exception as e:
        print(f"[SCENE-GUARD] Gagal deteksi kendaraan/subjek COCO: {e}")
        return []

    suppress_boxes = []
    for box in res.boxes:
        cls_name = model.names[int(box.cls[0])]
        if cls_name in {"car", "truck", "bus", "motorcycle", "person"}:
            suppress_boxes.append([float(v) for v in box.xyxy[0].tolist()])
    return suppress_boxes


def detect_indoor_scene(abs_path: str, img_w: int, img_h: int):
    """
    Cek apakah foto ini jelas-jelas bukan foto infrastruktur jalan raya
    (misal: barang indoor/elektronik, koper close-up, potret wajah/swafoto,
    atau foto hewan/peliharaan close-up).

    Return (is_indoor, evidence) — evidence berupa daftar
    {"class", "conf", "area_ratio"} yang memicu penolakan.
    """
    if not SCENE_GUARD_ENABLED:
        return False, []

    model = _get_coco_model()
    if model is None:
        return False, []

    frame_area = float(img_w * img_h)
    evidence = []
    seen = set()

    # Periksa di dua skala (640 standard + 320 untuk low-res / macro selfie hewan)
    sz_list = [640, 320] if max(img_w, img_h) <= 1280 else [640]
    for sz in sz_list:
        try:
            res = model.predict(abs_path, conf=0.15, imgsz=sz, verbose=False)[0]
        except Exception as e:
            print(f"[SCENE-GUARD] Inferensi gagal: {e}")
            continue

        for box in res.boxes:
            name = str(model.names[int(box.cls[0])]).lower()
            conf = float(box.conf[0])
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            area_ratio = ((x2 - x1) * (y2 - y1)) / frame_area

            # 1. Objek indoor / elektronik / makanan / mainan
            if name in _INDOOR_CLASSES and conf >= SCENE_GUARD_CONF and area_ratio >= SCENE_GUARD_AREA:
                if (name, "indoor") not in seen:
                    seen.add((name, "indoor"))
                    evidence.append({"class": name, "conf": round(conf, 3), "area_ratio": round(area_ratio, 4)})

            # 2. Barang pribadi besar (tas/koper yang menutupi kamera)
            elif name in _LARGE_PORTABLE_CLASSES and conf >= SCENE_GUARD_CONF and area_ratio >= SCENE_GUARD_AREA * 2:
                if (name, "portable") not in seen:
                    seen.add((name, "portable"))
                    evidence.append({"class": name, "conf": round(conf, 3), "area_ratio": round(area_ratio, 4)})

            # 3. Potret orang / swafoto: orang mendominasi frame (area >= 25%, conf >= 0.50)
            elif name == "person" and conf >= 0.50 and area_ratio >= 0.25:
                if ("person", "portrait") not in seen:
                    seen.add(("person", "portrait"))
                    evidence.append({"class": name, "conf": round(conf, 3), "area_ratio": round(area_ratio, 4)})

            # 4. Hewan peliharaan / satwa close-up: area >= 15% atau mendominasi frame
            elif name in _ANIMAL_CLASSES and ((area_ratio >= 0.15 and conf >= 0.30) or (area_ratio >= 0.50 and conf >= 0.15)):
                if (name, "animal") not in seen:
                    seen.add((name, "animal"))
                    evidence.append({"class": name, "conf": round(conf, 3), "area_ratio": round(area_ratio, 4)})

    return bool(evidence), evidence


# --- DETEKSI CONFIG ---

# Nama class kanonik: "genangan_air" (dipakai frontend & dashboard).
# Kalau model dilatih dengan nama "genangan" atau "pothole", alias ini menormalkan otomatis.
CLASS_ALIASES = {
    "genangan": "genangan_air",
    "pothole": "jalan_bolong",
    "potholes": "jalan_bolong",
    "Pothole": "jalan_bolong",
    "Potholes": "jalan_bolong",
    "PotholeDetectionYOLOv8 Project - v1 2024-04-09 1-16pm": "jalan_bolong",
    "PotholeDetectionYOLOv8 Project - v1 2024-04-09 1:16pm": "jalan_bolong",
    "damage": "jalan_bolong",
    "Damage": "jalan_bolong",
    "road_damage": "jalan_bolong",
    "crack": "jalan_bolong",
    "garbage": "sampah_liar",
    "Garbage": "sampah_liar",
    "trash": "sampah_liar",
    "waste": "sampah_liar",
    # Dataset publik "Illegal Dumping Detection" — semua objeknya sampah liar
    "garbage bag": "sampah_liar",
    "cardboard": "sampah_liar",
    "tire": "sampah_liar",
    "shopping cart": "sampah_liar",
    "mattress": "sampah_liar",
    # Dataset publik "utilitas udara" (kabel/pole tak tertata)
    "kabel": "kabel_semrawut",
    "Kabel": "kabel_semrawut",
    "utilitas udara taktertata": "kabel_semrawut",
    "utilitas udara": "kabel_semrawut",
    "Utilitas Udara Taktertata": "kabel_semrawut",
    "Utilitas Udara": "kabel_semrawut",
    # Dataset publik puddle / genangan air
    "puddle": "genangan_air",
    "Puddle": "genangan_air",
    "Dataset Puddle - v1 2025-04-30 12-01am": "genangan_air",
    "Dataset Puddle - v1 2025-04-30 12:01am": "genangan_air",
    "Dataset Puddle - v2 2025-05-05 1-48pm": "genangan_air",
    "Dataset Puddle - v2 2025-05-05 1:48pm": "genangan_air",
}

# Kelas "negatif" dari dataset publik: ada di label tapi artinya BUKAN kerusakan.
# Wajib dibuang sebelum normalisasi keyword, kalau tidak "Not Garbage"
# akan ikut ke-match jadi sampah_liar (karena mengandung kata "garbage").
IGNORED_CLASSES = {
    "not garbage",
    "notgarbage",
    "no garbage",
    "not pothole",
    "normal",
    "background",
    "-",
    "0",
    "12",
}

def _env_float(key: str, default: float) -> float:
    """Baca angka dari .env dengan aman (kalau kosong/ngawur pakai default)."""
    raw = os.getenv(key)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return float(str(raw).strip())
    except ValueError:
        print(f"[WARN] Nilai {key}='{raw}' bukan angka, pakai default {default}.")
        return default


def _env_int(key: str, default: int) -> int:
    return int(_env_float(key, float(default)))


def _env_bool(key: str, default: bool) -> bool:
    """Baca boolean dari .env ('1'/'true'/'ya'/'on' vs '0'/'false'/'tidak'/'off')."""
    raw = os.getenv(key)
    if raw is None or str(raw).strip() == "":
        return default
    val = str(raw).strip().lower()
    if val in {"1", "true", "ya", "yes", "on"}:
        return True
    if val in {"0", "false", "tidak", "no", "off"}:
        return False
    print(f"[WARN] Nilai {key}='{raw}' bukan boolean, pakai default {default}.")
    return default


# --- VLM (Vision-Language Model) sebagai HAKIM pipeline ---
# YOLO tetap jadi sensor (bbox presisi + skor dasar, deterministik & offline).
# VLM dikasih FOTO + output YOLO, lalu memverifikasi apakah YOLO benar, dan
# menentukan band keparahan. Skor final tetap dikonversi backend lewat tabel
# tetap (BAND_SCORE_RANGE) supaya tidak ikut-ikutan "lotre" seperti angka
# mentah dari model generatif.
VLM_ENABLED = _env_bool("VLM_ENABLED", True)

# Batas dimensi sisi terpanjang gambar yang dikirim ke VLM. 1024 px cukup
# untuk konteks makro (jenis kerusakan, kondisi jalan) tanpa membengkakkan token.
VLM_MAX_IMAGE_DIM = _env_int("VLM_MAX_IMAGE_DIM", 1024)
VLM_JPEG_QUALITY = _env_int("VLM_JPEG_QUALITY", 85)


# Batas kewajaran posisi objek di dalam frame (0 = tepi atas / langit, 1 = tepi bawah / jalan dekat kamera).
# Model genangan air (dataset puddle) sering "mendeteksi" langit/awan di
# bagian paling atas foto sebagai genangan. Hanya buang objek yang pusatnya
# benar-benar di zona langit (y_center < 0.18). Jangan gunakan batas terlalu
# tinggi (seperti 0.5/0.65) karena jalan yang difoto memanjang ke depan
# membentang dari bawah (1.0) hingga mendekati horizon (0.2).
MAX_Y_CENTER_FOR_WATER = _env_float("MAX_Y_CENTER_FOR_WATER", 0.18)

# Pothole (jalan_bolong) hanya ada di permukaan jalan raya.
# Objek di langit paling atas (y_center < 0.18) dibuang.
# Untuk objek spek kecil (< 0.08% area) di ketinggian tengah/atas dibuang agar
# tidak mendeteksi baut/braket tiang listrik atau atap gedung.
MAX_Y_CENTER_FOR_ROAD = _env_float("MAX_Y_CENTER_FOR_ROAD", 0.18)
MIN_AREA_FOR_POTHOLE = _env_float("MIN_AREA_FOR_POTHOLE", 0.0008)

# Sampah liar tidak melayang di langit paling atas.
MAX_Y_CENTER_FOR_GARBAGE = _env_float("MAX_Y_CENTER_FOR_GARBAGE", 0.20)

# Kabel semrawut adalah utilitas udara (bukan objek di aspal tepat di bawah kaki).
MIN_Y_CENTER_FOR_CABLE = _env_float("MIN_Y_CENTER_FOR_CABLE", 0.90)

# Scene guard: tolak foto yang jelas-jelas bukan infrastruktur jalan
# (meja kerja, laptop, keyboard, tas, kursi) sebelum skoring dijalankan.
SCENE_GUARD_ENABLED = _env_float("SCENE_GUARD_ENABLED", 1) != 0
SCENE_GUARD_CONF = _env_float("SCENE_GUARD_CONF", 0.45)
SCENE_GUARD_AREA = _env_float("SCENE_GUARD_AREA", 0.08)


# Resolusi inferensi.
# Model dilatih di 640/512, tapi foto warga biasanya 1000-4000 px dan lubang
# jalan sering cuma menempati sebagian kecil frame. Inferensi di 640 membuat
# lubang yang jelas terlihat cuma dapat confidence 0.05-0.1 (alias hilang),
# sedangkan di 1024 confidence-nya naik ke 0.4-0.5. Bisa diatur lewat .env.
DETECT_IMGSZ = _env_int("YOLO_IMGSZ", 1024)

# Batas bawah saat predict: semua kandidat di atas ini dikumpulkan dulu,
# baru disaring pakai CONF_THRESHOLDS per kelas di bawah.
DETECT_CONF_FLOOR = _env_float("YOLO_CONF_FLOOR", 0.10)

# Kalau TIDAK ada satu pun deteksi yang lolos CONF_THRESHOLDS, tapi ada
# kandidat lemah di atas batas ini, laporan tidak langsung dicap "aman" —
# ditandai "perlu verifikasi" supaya admin tetap bisa menilai.
LOW_CONF_MIN = _env_float("YOLO_LOW_CONF_MIN", 0.02)

# Threshold per kelas (bisa di-override dari .env kalau perlu tuning).
# Catatan: kabel semrawut berupa utilitas udara dengan kabel tipis; kalibrasi model
# menghasilkan confidence di rentang 0.045-0.25 (threshold 0.045 mencegah noise aspal & spion).
CONF_THRESHOLDS = {
    "jalan_bolong": _env_float("CONF_JALAN_BOLONG", 0.30),
    "genangan_air": _env_float("CONF_GENANGAN_AIR", 0.30),
    "sampah_liar": _env_float("CONF_SAMPAH_LIAR", 0.30),
    "kabel_semrawut": _env_float("CONF_KABEL_SEMRAWUT", 0.045),
}

SEVERITY_CONFIG = {
    "jalan_bolong":   {"base": 40, "max": 95, "size_factor": 2.5},
    "kabel_semrawut": {"base": 30, "max": 80, "size_factor": 1.2},
    "genangan_air":   {"base": 25, "max": 85, "size_factor": 1.2},
    "sampah_liar":    {"base": 20, "max": 75, "size_factor": 1.0},
}

CLASS_LABEL_PUBLIC = {
    "jalan_bolong": "jalan berlubang",
    "genangan_air": "genangan air",
    "sampah_liar": "tumpukan sampah liar",
    "kabel_semrawut": "kabel berantakan",
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
# 1. HELPERS GEOMETRI, LOKASI & SKOR
# ============================================================

# Bounding Box batas resmi Provinsi Bali (termasuk Nusa Penida, Nusa Ceningan, Lembongan & Menjangan)
BALI_LAT_MIN = -9.0
BALI_LAT_MAX = -8.0
BALI_LON_MIN = 114.4
BALI_LON_MAX = 115.8


def is_inside_bali(lat: Optional[float], lon: Optional[float]) -> bool:
    """
    Cek apakah koordinat berada di dalam batas geografis Provinsi Bali.
    Mengembalikan True jika koordinat valid di Bali, False jika di luar Bali atau None.
    """
    if lat is None or lon is None:
        return False
    return (BALI_LAT_MIN <= lat <= BALI_LAT_MAX) and (BALI_LON_MIN <= lon <= BALI_LON_MAX)


def extract_exif_gps(image_bytes: bytes) -> tuple[Optional[float], Optional[float]]:
    """
    Ekstrak koordinat GPS (latitude, longitude) dari metadata EXIF foto asli (jika ada).
    Mengembalikan (lat, lon) dalam derajat desimal, atau (None, None).
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif()
        if not exif:
            return None, None

        # 0x8825 adalah tag GPSInfo di EXIF
        gps_ifd = exif.get_ifd(0x8825)
        if not gps_ifd:
            return None, None

        def _to_decimal(coords, ref):
            deg, minute, sec = coords
            d = float(deg) + float(minute) / 60.0 + float(sec) / 3600.0
            if ref in ["S", "W"]:
                d = -d
            return d

        lat_raw = gps_ifd.get(2)  # GPSLatitude
        lat_ref = gps_ifd.get(1)  # GPSLatitudeRef ('N' or 'S')
        lon_raw = gps_ifd.get(4)  # GPSLongitude
        lon_ref = gps_ifd.get(3)  # GPSLongitudeRef ('E' or 'W')

        if lat_raw and lat_ref and lon_raw and lon_ref:
            lat = _to_decimal(lat_raw, lat_ref)
            lon = _to_decimal(lon_raw, lon_ref)
            return lat, lon
    except Exception:
        pass
    return None, None


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
        width_ratio = box_w / float(img_w)

        y_center = ((y1 + y2) / 2.0) / float(img_h)
        distance_multiplier = 1.0 + (0.8 * (1.0 - y_center))

        cfg = SEVERITY_CONFIG.get(cls, {"base": 10, "max": 50, "size_factor": 1.0})

        raw_score = cfg["base"] + (area_ratio * distance_multiplier * 100.0 * cfg["size_factor"])

        # Pothole masif / amblas (Bina Marga / PUPR: lubang selebar > 35% FOV jalur atau
        # luas > 6% frame adalah kerusakan struktural kritis berisiko kecelakaan fatal)
        if cls == "jalan_bolong" and (area_ratio >= 0.06 or width_ratio >= 0.35):
            raw_score = max(raw_score, 78.0 + (area_ratio * 100.0))

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
# 2. LLM NARASI: SIZE REASONING + VALIDATION + PUBLIC + DINAS (1 CALL)
# Backend pakai OpenAI-compatible client (lihat LLM_BASE_URL/LLM_MODEL
# di .env). Default: DeepSeek. Bisa diganti ke OpenRouter / Gemini / GLM / dll.
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
    Kalau LLM_API_KEY kosong / call error / JSON gagal di-parse,
    pakai fallback ini. Minimal tetap punya teks untuk publik dan dinas
    sehingga pipeline tidak terputus walau LLM offline.
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
            "reason": "Menggunakan estimasi geometri langsung tanpa penalaran tambahan karena layanan LLM tidak tersedia.",
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


def _encode_image_for_vlm(image_path: str) -> Optional[str]:
    """
    Encode gambar ke data-URL base64 (JPEG, sisi terpanjang <= VLM_MAX_IMAGE_DIM).
    Return None kalau file tidak bisa dibaca.
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            return None
        h, w = img.shape[:2]
        longest = max(h, w)
        if longest > VLM_MAX_IMAGE_DIM:
            scale = VLM_MAX_IMAGE_DIM / float(longest)
            img = cv2.resize(
                img, (max(1, int(w * scale)), max(1, int(h * scale))),
                interpolation=cv2.INTER_AREA,
            )
        ok, buf = cv2.imencode(
            ".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), VLM_JPEG_QUALITY]
        )
        if not ok:
            return None
        return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
    except Exception as e:
        print(f"[VLM] Gagal encode gambar: {e}")
        return None


# Skala luas per kelas: area_ratio yang dianggap "sangat besar" untuk kelas
# tersebut. Dipakai menghitung posisi skor DI DALAM band secara deterministik.
# Angka berbeda per kelas karena objeknya beda sifat: kabel membentang lebar
# (area besar itu normal), sedangkan lubang 15% frame sudah sangat besar.
_AREA_SCALE = {
    "jalan_bolong": 0.15,
    "genangan_air": 0.25,
    "sampah_liar": 0.15,
    "kabel_semrawut": 0.30,
}


def severity_fraction(area_ratio: float, cls: str = "") -> float:
    """
    Ubah luas objek dominan menjadi angka 0-1 TANPA titik jenuh.

    Kenapa perlu: skor matematis YOLO dipotong di 100, dan pada 11 dari 31
    foto nilainya mentok 100. Kalau posisi di dalam band diambil dari skor itu,
    semua foto parah keluar dengan angka identik (87) sehingga laporan yang
    jelas berbeda keparahannya terlihat sama. Luas objek tidak jenuh, jadi
    bisa dipakai membedakan.
    """
    scale = _AREA_SCALE.get(cls, 0.20)
    if scale <= 0:
        return 0.0
    return max(0.0, min(1.0, float(area_ratio or 0.0) / scale))


def band_to_score(band: str, yolo_score: int = 0, evidence_ratio: float = None) -> int:
    """
    Konversi band keparahan kualitatif (pilihan VLM) menjadi skor numerik TETAP.

    Ini kunci anti-"lotre": model generatif hanya boleh memilih band, bukan
    mengarang angka 0-100 (uji empiris: foto sama bisa jadi 20 lalu 90).
    Band menentukan RENTANG, lalu posisi di dalam rentang ditentukan
    deterministik dari bukti terukur: luas objek dominan kalau tersedia
    (tidak jenuh), kalau tidak dari skor matematis YOLO.
    """
    key = str(band or "").strip().upper()
    if key not in BAND_SCORE_RANGE:
        return int(max(0, min(100, yolo_score or 0)))
    lo, hi = BAND_SCORE_RANGE[key]
    if evidence_ratio is None:
        ratio = max(0.0, min(1.0, float(yolo_score or 0) / 100.0))
    else:
        ratio = max(0.0, min(1.0, float(evidence_ratio)))
    return int(round(lo + ratio * (hi - lo)))


def _normalize_vlm_result(raw: dict, payload: dict) -> dict:
    """
    Rapikan jawaban VLM menjadi bentuk yang dipakai pipeline.

    Yang dinormalisasi:
    - kelas_utama  -> harus salah satu CLASS_LABEL_PUBLIC atau "aman"
    - band         -> RINGAN/SEDANG/BERAT/KRITIS
    - skor final   -> hasil band_to_score (BUKAN angka karangan VLM)
    - verifikasi_yolo -> cocok / yolo_salah / yolo_kurang_lengkap
    """
    yolo_score = int(payload.get("score", 0) or 0)
    yolo_class = payload.get("primary_issue_class", "unknown")

    # --- kelas ---
    raw_cls = str(raw.get("kelas_utama", "") or "").strip().lower().replace(" ", "_")
    cls = raw_cls if (raw_cls in CLASS_LABEL_PUBLIC or raw_cls == "aman") else yolo_class

    # "aman" hanya kalau VLM menyatakan foto BUKAN infrastruktur DAN tidak
    # menyebut kelas kerusakan apa pun. Kalau dia tetap menyebut kelas
    # (misal sampah_liar di padang rumput), hormati kelas itu — itu justru
    # koreksi paling berharga dibanding YOLO.
    is_infra = raw.get("is_infrastruktur")
    if is_infra is False and raw_cls not in CLASS_LABEL_PUBLIC:
        cls = "aman"

    # --- band keparahan ---
    band = str(raw.get("tingkat", "") or "").strip().upper()
    if band not in BAND_SCORE_RANGE:
        # Turunkan dari skor YOLO kalau VLM tidak memberi band yang dikenal.
        band = {
            "LOW": "RINGAN",
            "MEDIUM": "SEDANG",
            "HIGH": "BERAT",
        }.get(str(payload.get("severity_label", "")).upper(), "SEDANG")

    # --- verifikasi YOLO ---
    verif = str(raw.get("verifikasi_yolo", "") or "").strip().lower()
    if verif not in {"cocok", "yolo_salah", "yolo_kurang_lengkap"}:
        verif = "cocok"

    # --- tie-break kelas (anti flip-flop) ---
    # VLM bisa berganti-ganti antara dua kelas yang sama-sama benar secara
    # visual (contoh: lubang jalan yang penuh air -> kadang "jalan_bolong",
    # kadang "genangan_air"). Kalau keduanya masih satu keluarga kerusakan
    # permukaan jalan dan YOLO tidak dinyatakan salah, pakai kelas YOLO yang
    # deterministik supaya hasil antar-run konsisten. Koreksi kelas tetap
    # dihormati kalau VLM bilang "yolo_salah" atau kelasnya beda keluarga.
    if verif != "yolo_salah" and cls != yolo_class:
        if _CLASS_FAMILY.get(cls) == _CLASS_FAMILY.get(yolo_class):
            print(
                f"[VLM] Tie-break: '{cls}' vs '{yolo_class}' satu keluarga "
                f"({_CLASS_FAMILY.get(cls)}), pakai kelas YOLO yang deterministik."
            )
            cls = yolo_class

    if cls == "aman":
        final_score = 0
        band = "RINGAN"
    else:
        # Bukti terukur untuk posisi di dalam band: luas objek dominan dari
        # kelas yang akhirnya dipilih. Kalau kelas final hasil koreksi VLM
        # tidak punya bbox (mis. sampah_liar pada foto yang YOLO baca sebagai
        # jalan_bolong), pakai objek terluas yang tersedia sebagai perkiraan.
        objects = payload.get("objects", []) or []
        areas_for_cls = [
            float(o.get("area_ratio", 0.0) or 0.0)
            for o in objects if o.get("class") == cls
        ]
        if areas_for_cls:
            evidence = max(areas_for_cls)
        elif objects:
            evidence = max(float(o.get("area_ratio", 0.0) or 0.0) for o in objects)
        else:
            evidence = None
        final_score = band_to_score(
            band, yolo_score, None if evidence is None else severity_fraction(evidence, cls)
        )

    return {
        "kelas_utama": cls,
        "is_infrastruktur": bool(is_infra) if is_infra is not None else cls != "aman",
        "verifikasi_yolo": verif,
        "band": band,
        "final_score": final_score,
        "severity_label": score_to_label(final_score),
        "bisa_dilalui": str(raw.get("bisa_dilalui", "") or "").strip().lower() or None,
        "catatan_visual": str(raw.get("catatan_visual", "") or "").strip() or None,
    }


def ask_vlm_verdict(payload: dict, image_path: str):
    """
    VLM sebagai HAKIM: kirim FOTO + ringkasan output YOLO, minta verifikasi.

    Bedanya dengan ask_llm_combined lama: fungsi itu cuma mengirim JSON angka
    (LLM buta gambar), jadi tidak mungkin tahu kalau YOLO salah. Di sini model
    benar-benar melihat fotonya, sehingga bisa menangkap kasus seperti padang
    rumput bersampah yang divonis "jalan_bolong" oleh YOLO.

    Return dict ternormalisasi, atau None kalau VLM tidak tersedia/gagal
    (pemanggil harus fallback ke jalur YOLO-only).
    """
    if not VLM_ENABLED:
        print("[VLM] Dinonaktifkan lewat VLM_ENABLED=false.")
        return None
    if not LLM_API_KEY:
        print("[VLM] API key tidak ada, lewati verifikasi VLM.")
        return None

    data_url = _encode_image_for_vlm(image_path)
    if not data_url:
        print("[VLM] Gambar tidak bisa di-encode, lewati verifikasi VLM.")
        return None

    # Ringkasan YOLO sengaja RINGKAS: VLM tidak perlu seluruh bbox, cukup
    # apa yang dideteksi, berapa banyak, dan seberapa besar areanya.
    objects = payload.get("objects", []) or []
    per_class = {}
    for o in objects:
        c = o.get("class", "unknown")
        entry = per_class.setdefault(c, {"kelas": c, "jumlah": 0, "luas_persen": 0.0})
        entry["jumlah"] += 1
        entry["luas_persen"] += float(o.get("area_ratio", 0.0)) * 100.0
    yolo_summary = {
        "deteksi": [
            {**v, "luas_persen": round(v["luas_persen"], 2)}
            for v in per_class.values()
        ],
        "skor_matematis": payload.get("score", 0),
        "label_matematis": payload.get("severity_label", "LOW"),
        "lokasi": payload.get("location", "tidak diketahui"),
    }

    prompt = f"""PERAN:
Anda insinyur sipil senior yang memverifikasi hasil deteksi otomatis (YOLO)
pada foto laporan warga. Anda MELIHAT fotonya langsung.

HASIL DETEKSI YOLO (bisa saja salah):
{json.dumps(yolo_summary, ensure_ascii=False, indent=2)}

TUGAS:
1) Lihat foto. Tentukan apakah ini benar foto masalah infrastruktur / fasilitas
   publik (jalan, trotoar, drainase, utilitas, sampah di ruang publik).
   Sampah berserakan di taman/padang juga dihitung YA, bukan ditolak.
   Foto hewan peliharaan, potret orang, barang dalam ruangan dihitung TIDAK.
2) Verifikasi hasil YOLO:
   - "cocok"              = YOLO benar, kelas & temuannya wajar
   - "yolo_salah"         = YOLO salah kelas / salah objek (misal padang rumput
                            divonis jalan berlubang, spion mobil divonis kabel)
   - "yolo_kurang_lengkap"= YOLO benar tapi banyak kerusakan terlewat
3) Tentukan kelas utama yang BENAR menurut foto Anda.
4) Tentukan tingkat keparahan sebagai BAND kualitatif (JANGAN memberi angka).
5) Tulis narasi publik (bahasa awam) dan rekomendasi dinas (teknis).

PANDUAN BAND:
- RINGAN  : kerusakan kecil, tidak mengganggu, bisa diabaikan sementara
- SEDANG  : mengganggu kenyamanan/keselamatan, perlu perbaikan terjadwal
- BERAT   : membahayakan pengendara, perlu perbaikan segera
- KRITIS  : kerusakan struktural/amblas, berisiko kecelakaan fatal, darurat

ATURAN KETAT:
- JANGAN memberi skor angka 0-100. Hanya pilih band.
- Kalau foto bukan infrastruktur jalan: is_infrastruktur=false, kelas_utama="aman".
- Balas HANYA JSON valid, tanpa markdown.

FORMAT:
{{
  "is_infrastruktur": true/false,
  "kelas_utama": "jalan_bolong" | "kabel_semrawut" | "genangan_air" | "sampah_liar" | "aman",
  "verifikasi_yolo": "cocok" | "yolo_salah" | "yolo_kurang_lengkap",
  "tingkat": "RINGAN" | "SEDANG" | "BERAT" | "KRITIS",
  "bisa_dilalui": "ya" | "hati-hati" | "tidak",
  "catatan_visual": "<1 kalimat: apa yang benar-benar terlihat di foto>",
  "public": {{"judul": "<3-8 kata>", "pesan": "<2-3 kalimat bahasa awam>"}},
  "dinas": {{"judul": "<judul teknis>", "rekomendasi": "<1-2 kalimat tindakan teknis>"}}
}}"""

    try:
        client = OpenAI(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            timeout=90.0,
            max_retries=2,
        )
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        print(f"[VLM ERROR] {type(e).__name__}: {e}")
        return None

    raw_text = (completion.choices[0].message.content or "").strip()
    usage = getattr(completion, "usage", None)
    tok = getattr(usage, "total_tokens", "?") if usage else "?"
    print(f"[VLM] Verdict diterima ({tok} token): {raw_text[:160]}")

    parsed = None
    try:
        parsed = json.loads(raw_text)
    except Exception:
        start, end = raw_text.find("{"), raw_text.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(raw_text[start:end + 1])
            except Exception:
                parsed = None

    if not isinstance(parsed, dict):
        print("[VLM PARSE ERROR] Gagal parse JSON verdict.")
        return None

    verdict = _normalize_vlm_result(parsed, payload)
    verdict["public"] = parsed.get("public") if isinstance(parsed.get("public"), dict) else {}
    verdict["dinas"] = parsed.get("dinas") if isinstance(parsed.get("dinas"), dict) else {}
    verdict["raw"] = parsed
    return verdict


def _build_llm_result_from_verdict(verdict: dict, payload: dict, geometry: dict) -> dict:
    """
    Ubah verdict VLM menjadi bentuk yang sama dengan ask_llm_combined(),
    supaya sisa pipeline (title, description, email, meta_data) tidak perlu
    diubah dan tetap kompatibel dengan data lama.

    Catatan: validation.math_score sengaja diisi skor FINAL (hasil band),
    karena itulah yang benar-benar disimpan & ditampilkan sistem.
    """
    band = verdict.get("band", "SEDANG")
    final_score = verdict.get("final_score", 0)
    severity_label = verdict.get("severity_label", "LOW")
    primary = verdict.get("kelas_utama", "unknown")
    pretty = CLASS_LABEL_PUBLIC.get(primary, str(primary).replace("_", " "))
    loc = payload.get("location", "lokasi yang dilaporkan")
    geom = geometry or {}

    public_in = verdict.get("public") or {}
    dinas_in = verdict.get("dinas") or {}
    catatan = verdict.get("catatan_visual") or ""

    # VLM menyimpulkan tidak ada kerusakan: jangan paksakan narasi "kerusakan
    # aman dengan prioritas LOW" yang membingungkan pembaca.
    if primary == "aman":
        _why = catatan or "Foto tidak menunjukkan kerusakan infrastruktur."
        return {
            "source": "vlm_verdict",
            "size_reasoning": {
                "adjusted_width_m": None,
                "adjusted_width_range_m": None,
                "size_category": None,
                "reason": "Tidak ada kerusakan yang perlu diukur.",
            },
            "validation": {
                "math_score": 0,
                "severity_label_math": "LOW",
                "severity_label_opinion": "LOW",
                "consistency_flag": "Konsisten",
                "consistency_notes": _why,
                "uncertainty_level": "Rendah",
                "uncertainty_reason": "Verifikasi visual langsung pada foto.",
                "yolo_verification": verdict.get("verifikasi_yolo"),
                "bisa_dilalui": verdict.get("bisa_dilalui"),
            },
            "public": {
                "title": "Tidak Ditemukan Kerusakan",
                "message": (
                    "Terima kasih atas laporannya. Setelah diperiksa, foto yang "
                    "dikirim tidak menunjukkan kerusakan infrastruktur yang perlu "
                    "ditangani."
                ),
                "severity_label": "LOW",
            },
            "dinas": {
                "title": "Tidak Ditemukan Kerusakan",
                "summary": "Tidak ada kerusakan infrastruktur yang teridentifikasi.",
                "technical_report": _why,
                "risk_notes": "Tidak ada risiko yang teridentifikasi dari foto ini.",
                "recommended_action": "Tidak ada tindakan yang diperlukan.",
                "followup_suggestion": "Tidak perlu tindak lanjut.",
                "priority": "LOW",
                "estimated_width_m": None,
                "estimated_width_range_m": None,
                "distance_m": None,
            },
        }

    public_title = public_in.get("judul") or f"{pretty.title()} Teridentifikasi"
    public_msg = public_in.get("pesan") or (
        f"Sistem mendeteksi {pretty} di {loc}. "
        f"Tingkat bahaya dikategorikan {severity_label.lower()}."
    )

    dinas_title = dinas_in.get("judul") or f"{pretty.title()} - {severity_label}"
    dinas_reco = dinas_in.get("rekomendasi") or (
        "Mohon verifikasi lapangan dan penanganan sesuai prosedur standar."
    )

    band_note = {
        "RINGAN": "kerusakan ringan, dapat ditangani dalam pemeliharaan rutin",
        "SEDANG": "kerusakan sedang, perlu perbaikan terjadwal",
        "BERAT": "kerusakan berat, membahayakan pengendara dan perlu segera ditangani",
        "KRITIS": "kerusakan kritis/struktural, berisiko kecelakaan fatal dan bersifat darurat",
    }.get(band, "keparahan sesuai hasil verifikasi visual")

    return {
        "source": "vlm_verdict",
        "size_reasoning": {
            "adjusted_width_m": geom.get("estimated_width_m"),
            "adjusted_width_range_m": geom.get("estimated_width_range_m"),
            "size_category": None,
            "reason": "Ukuran mengikuti estimasi geometri YOLO; VLM memverifikasi konteks visual.",
        },
        "validation": {
            "math_score": final_score,
            "severity_label_math": severity_label,
            "severity_label_opinion": severity_label,
            "consistency_flag": "Konsisten",
            "consistency_notes": f"Band {band}: {band_note}.",
            "uncertainty_level": "Rendah",
            "uncertainty_reason": "Keputusan diambil setelah verifikasi visual langsung pada foto.",
            "yolo_verification": verdict.get("verifikasi_yolo"),
            "bisa_dilalui": verdict.get("bisa_dilalui"),
        },
        "public": {
            "title": public_title,
            "message": public_msg,
            "severity_label": severity_label,
        },
        "dinas": {
            "title": dinas_title,
            "summary": f"{pretty.title()} dengan prioritas {severity_label} di {loc}.",
            "technical_report": (
                f"Hasil verifikasi visual: {catatan} " if catatan else ""
            ) + (
                f"Klasifikasi {pretty} dengan tingkat {band} (skor {final_score}/100, "
                f"prioritas {severity_label}). Verifikasi YOLO: "
                f"{verdict.get('verifikasi_yolo', 'cocok')}."
            ),
            "risk_notes": band_note.capitalize() + ".",
            "recommended_action": dinas_reco,
            "followup_suggestion": "Lakukan inspeksi lapangan untuk konfirmasi dan penjadwalan perbaikan.",
            "priority": severity_label,
            "estimated_width_m": geom.get("estimated_width_m"),
            "estimated_width_range_m": geom.get("estimated_width_range_m"),
            "distance_m": geom.get("distance_m"),
        },
    }


def ask_llm_combined(payload: dict):
    """
    Satu fungsi untuk:
    - penalaran ukuran (size_reasoning)
    - validasi konsistensi (validation)
    - output publik (public)
    - output dinas (dinas)
    Semua dikerjakan oleh LLM (DeepSeek default) se-detail mungkin.
    """
    
    # 1. Cek API Key
    if not LLM_API_KEY:
        print("[LLM] LLM_API_KEY / API_KEY tidak ditemukan di .env. Pakai fallback.")
        return _fallback_llm_result(payload)

    # 2. Setup Client (OpenAI-compatible: DeepSeek / OpenRouter / ninerouter / dll)
    # Timeout 90s (router via proxy bisa lambat di jam sibuk),
    # max_retries 2 biar API call sementara yang timeout bisa recovery sendiri.
    try:
        client = OpenAI(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            timeout=90.0,
            max_retries=2,
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
        # 4. Request ke LLM (default: deepseek-chat via api.deepseek.com)
        # Ganti model/base_url lewat .env (LLM_MODEL, LLM_BASE_URL)
        completion = client.chat.completions.create(
            model=LLM_MODEL,
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
# EMAIL SENDER — semua credential dari .env (JANGAN hardcode di source)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL", "")
SENDER_PASS = os.getenv("SMTP_APP_PASSWORD", "")
TARGET_EMAIL = os.getenv("ALERT_TARGET_EMAIL", "")

# Token admin — WAJIB dari .env. Tidak ada fallback hardcoded lagi supaya
# tidak ada token default yang bisa ditebak siapa pun.
# Kalau kosong, sistem bikin token acak sekali pakai (per proses) dan
# memperingatkan; link admin di email tidak akan valid sampai ADMIN_TOKEN diisi.
TOKEN = os.getenv("ADMIN_TOKEN")
if not TOKEN:
    import secrets

    TOKEN = secrets.token_urlsafe(32)
    print(
        "[SECURITY][WARN] ADMIN_TOKEN belum diisi di .env. "
        "Sistem memakai token acak sementara (berubah tiap restart). "
        "Isi ADMIN_TOKEN di .env sebelum produksi."
    )




def generate_issue_token(issue_id: int | str) -> str:
    """
    Buat token tanda tangan HMAC terikat ke satu issue ID.
    Mencegah master ADMIN_TOKEN bocor via query parameter di email link.
    """
    key = str(TOKEN).encode("utf-8")
    msg = f"issue_access:{issue_id}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()[:32]


def send_email_alert(issue_data: Issue):
    try:
        if not SENDER_EMAIL or not SENDER_PASS:
            print("[EMAIL] SMTP belum dikonfigurasi di .env. Email dilewati.")
            return

        # Jangan kirim email jika foto dinilai aman / tanpa temuan kerusakan
        # (kecuali jika model ragu dan menandai perlu verifikasi manual).
        is_safe = issue_data.issue_class == "aman"
        needs_review = bool(
            isinstance(issue_data.meta_data, dict)
            and issue_data.meta_data.get("needs_review")
        )

        min_score = int(os.getenv("MIN_EMAIL_SCORE", "0"))
        if is_safe and not needs_review:
            print(f"[EMAIL] Kondisi aman (score: {issue_data.final_score}). Email dilewati.")
            return

        if (issue_data.final_score or 0) < min_score and not needs_review:
            print(f"[EMAIL] Skor {issue_data.final_score} di bawah MIN_EMAIL_SCORE ({min_score}). Email dilewati.")
            return

        print(f"[EMAIL] Mempersiapkan pengiriman peringatan untuk ID {issue_data.id}...")
        # Base URL frontend admin — bisa diatur via env (FRONTEND_BASE_URL).
        frontend_base = os.getenv("FRONTEND_BASE_URL", "https://balicivicai.site").rstrip("/")
        scoped_token = generate_issue_token(issue_data.id)
        dashboard_url = f"{frontend_base}/admin?token={scoped_token}&id={issue_data.id}"

        # Subject dinamis sesuai urgensi tindak lanjut
        if needs_review:
            subject = f"⚠️ PERLU VERIFIKASI: {issue_data.title or 'Laporan Kerusakan'} (ID #{issue_data.id})"
        elif (issue_data.final_score or 0) >= 70:
            subject = f"🚨 URGENT: {issue_data.title} ({issue_data.severity_label}) - #{issue_data.id}"
        else:
            subject = f"📋 LAPORAN TINDAK LANJUT: {issue_data.title} ({issue_data.severity_label}) - #{issue_data.id}"

        # Setup Pesan Multipart
        msg = MIMEMultipart('related')
        msg['From'] = f"BaliCivic AI <{SENDER_EMAIL}>"
        msg['To'] = TARGET_EMAIL
        msg['Subject'] = subject

        # Template HTML Email dengan gambar inline
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #b91c1c; color: white; padding: 15px; text-align: center;">
                <h2 style="margin:0;">SISTEM DETEKSI DINI</h2>
                <small>BaliCivic AI - Smart Infrastructure Monitor</small>
            </div>
            
            <div style="padding: 20px;">
                <p>Yth. Admin Dinas Pekerjaan Umum,</p>
                <p>Sistem AI telah mendeteksi kerusakan infrastruktur dengan prioritas <strong>{issue_data.severity_label}</strong> yang memerlukan atensi.</p>
                
                <!-- GAMBAR HASIL DETEKSI -->
                <div style="text-align: center; margin: 20px 0;">
                    <img src="cid:detection_image" style="max-width: 100%; border-radius: 8px; border: 2px solid #b91c1c;" alt="Hasil Deteksi AI">
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">Hasil Analisis AI - Objek Terdeteksi</p>
                </div>
                
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px; border-left: 4px solid #b91c1c; background: #fff5f5;">
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Masalah</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">{html.escape(issue_data.issue_class.replace('_', ' ').title())}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Lokasi</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">{html.escape(issue_data.kecamatan or 'Lokasi GPS')}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Skor Bahaya</strong></td><td style="padding:8px; border-bottom:1px solid #eee;"><strong style="color:#b91c1c">{html.escape(str(issue_data.final_score))}/100</strong></td></tr>
                    <tr><td style="padding:8px;"><strong>Analisis AI</strong></td><td style="padding:8px; font-style: italic;">"{html.escape(issue_data.description or '')}"</td></tr>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{dashboard_url}" style="background-color: #b91c1c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
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

def _apply_nms(detections, iou_thresh: float = 0.45):
    """
    Non-Maximum Suppression per kelas untuk menyatukan deteksi duplikat
    dari multi-model (misal model puddle v1 dan v2 sama-sama mendeteksi
    kubangan air yang sama dengan koordinat hampir identik).
    """
    if not detections:
        return []
    by_class = {}
    for d in detections:
        by_class.setdefault(d["class"], []).append(d)

    kept = []
    for cls, dets in by_class.items():
        dets.sort(key=lambda x: x["conf"], reverse=True)
        cls_kept = []
        for d in dets:
            box_a = d["box"]
            overlap = False
            for k in cls_kept:
                box_b = k["box"]
                xA = max(box_a[0], box_b[0])
                yA = max(box_a[1], box_b[1])
                xB = min(box_a[2], box_b[2])
                yB = min(box_a[3], box_b[3])
                inter = max(0.0, xB - xA) * max(0.0, yB - yA)
                areaA = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
                areaB = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
                union = areaA + areaB - inter
                iou = inter / union if union > 0 else 0
                if iou >= iou_thresh:
                    overlap = True
                    break
            if not overlap:
                cls_kept.append(d)
        kept.extend(cls_kept)

    kept.sort(key=lambda x: x["conf"], reverse=True)
    return kept


# Key meta_data yang hanya valid untuk analisis kerusakan. Kalau hasil akhirnya
# "tidak ada temuan" (misal foto bukan infrastruktur jalan), key ini WAJIB
# dibuang supaya narasi lama (mis. "kabel semrawut") tidak ikut tampil lagi
# di halaman detail.
_STALE_ANALYSIS_KEYS = (
    "geometry",
    "objects",
    "llm_payload",
    "llm_result",
    "needs_review",
    "review_reason",
    "low_conf_candidates",
    # Jejak keputusan VLM / penolakan scene guard. Wajib ikut dibersihkan,
    # kalau tidak: issue yang di analisis ulang bisa menyimpan verdict lama
    # padahal hasil barunya jalur fallback (YOLO teks) tanpa VLM.
    "vlm_verdict",
    "vlm_rescue",
    "yolo_baseline",
    "rejected_reason",
    "scene_evidence",
    "note",
    "error",
)


def _clean_analysis_meta(prev_meta: dict) -> dict:
    """Salin meta lama tanpa jejak hasil analisis kerusakan sebelumnya."""
    if not isinstance(prev_meta, dict):
        return {}
    return {k: v for k, v in prev_meta.items() if k not in _STALE_ANALYSIS_KEYS}


def process_analysis(issue_id: str, image_path: str, session: Session):
    print(f"\n[ENGINE] === MEMULAI ANALISIS ID: {issue_id} ===")

    try:
        models_dict = get_models()

        abs_path = os.path.abspath(image_path)
        print(f"[ENGINE] Reading image: {abs_path}")

        orig_img = cv2.imread(abs_path)
        if orig_img is None:
            raise FileNotFoundError(f"Gagal membaca gambar dari: {abs_path}")
        img_h, img_w = orig_img.shape[:2]

        valid_detections = []
        weak_detections = []   # kandidat di bawah threshold kelas (perlu verifikasi)
        max_conf = 0.0
        primary_class_conf = "aman"

        # Palet warna per kelas kerusakan untuk visualisasi bounding box (BGR)
        CLASS_COLORS = {
            "jalan_bolong": (0, 69, 255),       # Orange-Red
            "sampah_liar": (34, 139, 34),       # Forest Green
            "kabel_semrawut": (211, 0, 148),    # Purple / Magenta
            "genangan_air": (255, 140, 0),      # Blue
        }

        # --- SCENE GUARD ---
        # Foto meja kerja / laptop / tas / kursi sering memicu false positive
        # "kabel_semrawut" pada model kabel. Kalau konteksnya jelas bukan
        # infrastruktur jalan, hentikan analisis lebih awal: jangan skor,
        # jangan kirim email alert.
        is_indoor, scene_evidence = detect_indoor_scene(abs_path, img_w, img_h)
        if is_indoor:
            _scene_note = ", ".join(
                f"{e['class']} ({e['conf']:.2f})" for e in scene_evidence
            )
            print(f"[SCENE-GUARD] Foto bukan infrastruktur jalan -> tolak. Bukti: {_scene_note}")

            # Simpan gambar tanpa anotasi (tidak ada yang perlu dilingkari).
            filename = os.path.basename(image_path)
            detected_filename = filename.replace(".jpg", "_detected.jpg")
            cv2.imwrite(os.path.join("uploads", detected_filename), orig_img)

            issue = session.get(Issue, issue_id)
            if not issue:
                print("[ERROR] Issue ID tidak ditemukan di DB.")
                return
            _prev_meta = _clean_analysis_meta(issue.meta_data)

            _found_id = []
            for e in scene_evidence:
                lbl = _scene_label(e["class"])
                if lbl not in _found_id:
                    _found_id.append(lbl)

            issue.issue_class = "aman"
            issue.severity_label = "LOW"
            issue.final_score = 0
            issue.breakdown_score = {}
            issue.secondary_issues = []
            issue.meta_data = {
                **_prev_meta,
                "rejected_reason": "bukan_foto_infrastruktur",
                "scene_evidence": scene_evidence,
                "detect_imgsz": DETECT_IMGSZ,
            }
            issue.title = "Tidak Ditemukan Kerusakan"
            issue.description = (
                "Foto yang dikirim tidak menampilkan jalan atau infrastruktur publik. "
                "Sistem mendeteksi objek dalam ruangan ("
                + ", ".join(_found_id)
                + "), sehingga tidak ada kerusakan yang bisa dinilai. "
                "Silakan unggah foto jalan, trotoar, atau utilitas umum dari lokasi kejadian."
            )
            issue.image_url = f"/static/{detected_filename}"
            issue.status = "PENDING"
            session.add(issue)
            session.commit()
            session.refresh(issue)

            try:
                norm_path = os.path.normpath(image_path)
                if ("uploads_raw" in norm_path or norm_path.startswith("uploads_raw")) and os.path.exists(image_path):
                    os.remove(image_path)
            except Exception as ce:
                print(f"[STRIP-EXIF] Gagal hapus raw: {ce}")

            print("[ENGINE] Selesai: foto ditolak oleh scene guard (bukan infrastruktur jalan).")
            return

        # Deteksi kendaraan untuk spatial suppression false positive kabel pada komponen mobil/truk
        vehicle_boxes = detect_vehicles(abs_path, img_w, img_h)
        if vehicle_boxes:
            print(f"[ENGINE] Terdeteksi {len(vehicle_boxes)} kendaraan di dalam scene jalan.")

        # Jalankan inferensi ke seluruh model spesifik yang terpasang.
        # Resolusi: multi-scale adaptif (640, 1024, 1280) agar mencakup lubang jalan
        # berskala makro/mikro tanpa kehilangan detail akibat interpolasi.
        for model_cat, mdl in models_dict.items():
            if model_cat == "kabel":
                scales = [1024, 1280]
                m_floor = min(DETECT_CONF_FLOOR, CONF_THRESHOLDS.get("kabel_semrawut", 0.045))
            elif model_cat == "pothole":
                scales = [320, 640, 1024] if max(img_w, img_h) < 550 else [640, 1024, 1280]
                m_floor = DETECT_CONF_FLOOR
            elif model_cat == "puddle":
                scales = [640, 1024]
                m_floor = DETECT_CONF_FLOOR
            else:
                scales = [DETECT_IMGSZ, 320] if max(img_w, img_h) < 550 else [DETECT_IMGSZ]
                m_floor = DETECT_CONF_FLOOR

            for cur_sz in scales:
                try:
                    results = mdl.predict(
                        abs_path,
                        conf=m_floor,
                        imgsz=cur_sz,
                        save=False,
                        verbose=False,
                    )
                    r = results[0]
                except Exception as e:
                    print(f"[ENGINE WARN] Model {model_cat} gagal inferensi (imgsz={cur_sz}): {e}")
                    continue

                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    raw_name = mdl.names[cls_id]

                    # Buang kelas negatif ("Not Garbage", "-", dll) SEBELUM normalisasi
                    # keyword. Kalau tidak, "Not Garbage" ikut ke-match jadi sampah_liar.
                    if str(raw_name).strip().lower() in IGNORED_CLASSES:
                        continue

                    cls_name = CLASS_ALIASES.get(raw_name, raw_name)

                    # Normalisasi otomatis jika dataset memakai variasi kata kunci
                    if cls_name not in CLASS_LABEL_PUBLIC:
                        ln = str(raw_name).lower()
                        if "pothole" in ln or "lubang" in ln or "bolong" in ln or "damage" in ln or "crack" in ln:
                            cls_name = "jalan_bolong"
                        elif "garbage" in ln or "trash" in ln or "waste" in ln or "sampah" in ln:
                            cls_name = "sampah_liar"
                        elif "cardboard" in ln or "tire" in ln or "mattress" in ln or "cart" in ln or "dumping" in ln:
                            cls_name = "sampah_liar"
                        elif "water" in ln or "flood" in ln or "genangan" in ln or "puddle" in ln:
                            cls_name = "genangan_air"
                        elif "cable" in ln or "kabel" in ln or "utilitas" in ln or "taktertata" in ln:
                            cls_name = "kabel_semrawut"

                    conf = float(box.conf[0])

                    # Hanya kelas yang dikenal sistem (jangan terima class COCO
                    # seperti person/car dari model fallback yolo11s)
                    if cls_name not in CLASS_LABEL_PUBLIC:
                        continue

                    # Filter kewajaran posisi & ukuran objek dalam frame:
                    _x1, _y1, _x2, _y2 = [float(v) for v in box.xyxy[0].tolist()]
                    y_center = ((_y1 + _y2) / 2.0) / float(img_h)
                    area_ratio = ((_x2 - _x1) * (_y2 - _y1)) / float(img_w * img_h)

                    # 1) Jalan bolong (pothole): kerusakan permukaan aspal/jalan.
                    #    Harus berada di bidang permukaan jalan (tengah-bawah/bawah frame).
                    #    Objek di bagian atas (y_center < MAX_Y_CENTER_FOR_ROAD) adalah langit,
                    #    tiang, kabel utilitas, atau latar belakang gedung.
                    #    Objek sangat kecil (< 0.08% area) di ketinggian tengah juga dibuang sebagai noise.
                    if cls_name == "jalan_bolong":
                        if y_center < MAX_Y_CENTER_FOR_ROAD:
                            print(
                                f"[ENGINE] Buang jalan_bolong di y={y_center:.2f} "
                                f"(terlalu atas / bukan permukaan jalan, batas={MAX_Y_CENTER_FOR_ROAD})."
                            )
                            continue
                        if area_ratio < MIN_AREA_FOR_POTHOLE and y_center < 0.65:
                            print(
                                f"[ENGINE] Buang jalan_bolong kecil (area={area_ratio*100:.3f}%) di y={y_center:.2f} "
                                "(noise/bukan lubang jalan signifikan)."
                            )
                            continue

                    # 2) Genangan air: tidak mungkin ada di langit/awan/atap.
                    elif cls_name == "genangan_air":
                        if y_center < MAX_Y_CENTER_FOR_WATER:
                            print(
                                f"[ENGINE] Buang genangan_air di y={y_center:.2f} "
                                f"(terlalu atas, kemungkinan langit/awan, batas={MAX_Y_CENTER_FOR_WATER})."
                            )
                            continue

                        # Saring false positive genangan air pada langit biru cerah (terutama foto tiang utilitas menatap ke atas)
                        crop_x1 = max(0, int(_x1))
                        crop_y1 = max(0, int(_y1))
                        crop_x2 = min(img_w, int(_x2))
                        crop_y2 = min(img_h, int(_y2))
                        if crop_x2 > crop_x1 and crop_y2 > crop_y1:
                            crop_bgr = orig_img[crop_y1:crop_y2, crop_x1:crop_x2]
                            crop_hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
                            h_c, s_c, v_c = crop_hsv[:, :, 0], crop_hsv[:, :, 1], crop_hsv[:, :, 2]
                            blue_sky_ratio = float(
                                np.mean((h_c >= 95) & (h_c <= 125) & (v_c >= 170) & (s_c >= 70))
                            )
                            if blue_sky_ratio > 0.40:
                                print(
                                    f"[ENGINE] Buang genangan_air di langit biru cerah ({blue_sky_ratio*100:.1f}% piksel langit)."
                                )
                                continue

                    # 3) Sampah liar: tidak melayang di langit/atap.
                    elif cls_name == "sampah_liar":
                        if y_center < MAX_Y_CENTER_FOR_GARBAGE:
                            print(
                                f"[ENGINE] Buang sampah_liar di y={y_center:.2f} "
                                f"(terlalu atas / di langit, batas={MAX_Y_CENTER_FOR_GARBAGE})."
                            )
                            continue

                    # 4) Kabel semrawut: utilitas udara / tiang / gantung.
                    #    Bukan objek yang tertanam di dasar aspal jalan langsung di bawah kaki,
                    #    dan bukan komponen kendaraan (spion mobil, wiper, antena, atap).
                    elif cls_name == "kabel_semrawut":
                        if y_center > MIN_Y_CENTER_FOR_CABLE:
                            print(
                                f"[ENGINE] Buang kabel_semrawut di y={y_center:.2f} "
                                f"(terlalu bawah / di permukaan aspal, batas={MIN_Y_CENTER_FOR_CABLE})."
                            )
                            continue

                        # Spatial suppression: buang kabel yang berada di dalam bounding box kendaraan
                        # (misal: spion mobil, wiper, antena, jendela, atap mobil)
                        cx = (_x1 + _x2) / 2.0
                        cy = (_y1 + _y2) / 2.0
                        in_vehicle = any(
                            vx1 <= cx <= vx2 and vy1 <= cy <= vy2
                            for vx1, vy1, vx2, vy2 in vehicle_boxes
                        )
                        if in_vehicle:
                            print(
                                f"[ENGINE] Buang kabel_semrawut di koordinat kendaraan ({cx:.1f}, {cy:.1f}), "
                                "komponen kendaraan (spion/wiper/atap) bukan utilitas udara."
                            )
                            continue

                        # Kabel di bagian bawah jalan (y_center > 0.60) dengan conf rendah adalah tekstur aspal/retakan
                        # Hanya berlaku jika di scene terdapat kendaraan (bukan foto langit tiang utilitas tegak)
                        if vehicle_boxes and y_center > 0.60 and conf < 0.10:
                            print(
                                f"[ENGINE] Buang kabel_semrawut lemah di aspal y={y_center:.2f} (conf={conf:.2f})."
                            )
                            continue

                    det = {
                        "class": cls_name,
                        "box": box.xyxy[0].tolist(),
                        "conf": conf,
                    }

                    cls_threshold = CONF_THRESHOLDS.get(cls_name, 0.25)
                    weak_threshold = min(LOW_CONF_MIN, cls_threshold * 0.7)

                    if conf >= cls_threshold:
                        valid_detections.append(det)
                        if conf > max_conf:
                            max_conf = conf
                            primary_class_conf = cls_name
                    elif conf >= weak_threshold:
                        # Jangan dibuang total: dipakai kalau tidak ada deteksi kuat
                        # sama sekali, supaya laporan jadi "perlu verifikasi"
                        # bukan langsung dicap "aman / tidak ditemukan kerusakan".
                        weak_detections.append(det)

        # Satukan deteksi duplikat intra-kelas dari model multi-head (misal puddle v1 & v2)
        valid_detections = _apply_nms(valid_detections)
        weak_detections = _apply_nms(weak_detections)

        # Buang kabel yang koordinatnya berada di dalam lubang jalan atau genangan air (retakan aspal / pinggiran lubang)
        pothole_boxes = [d["box"] for d in valid_detections if d["class"] in {"jalan_bolong", "genangan_air"}]
        if pothole_boxes:
            cables_to_keep = []
            for d in valid_detections:
                if d["class"] == "kabel_semrawut":
                    bx = d["box"]
                    cx = (bx[0] + bx[2]) / 2.0
                    cy = (bx[1] + bx[3]) / 2.0
                    if any(px1 <= cx <= px2 and py1 <= cy <= py2 for px1, py1, px2, py2 in pothole_boxes):
                        print(f"[ENGINE] Buang kabel_semrawut di dalam lubang/genangan jalan ({cx:.1f}, {cy:.1f}).")
                        continue
                cables_to_keep.append(d)
            valid_detections = cables_to_keep

        # Saring deteksi kabel terisolasi tunggal yang sangat kecil di scene kendaraan/jalan ramai
        # (seperti plang/rambu bundar pinggir jalan atau ornamen tiang)
        if vehicle_boxes or pothole_boxes:
            cables_in_scene = [d for d in valid_detections if d["class"] == "kabel_semrawut"]
            if len(cables_in_scene) == 1:
                c_det = cables_in_scene[0]
                bx = c_det["box"]
                c_area = ((bx[2] - bx[0]) * (bx[3] - bx[1])) / float(img_w * img_h)
                if c_area < 0.01:
                    print(
                        f"[ENGINE] Buang kabel_semrawut terisolasi kecil (area={c_area*100:.3f}%) di area jalan."
                    )
                    valid_detections = [d for d in valid_detections if d["class"] != "kabel_semrawut"]

        if valid_detections:
            max_conf = max(d["conf"] for d in valid_detections)
            primary_class_conf = valid_detections[0]["class"]

        print(
            f"[ENGINE] Deteksi kuat setelah NMS: {len(valid_detections)} objek | "
            f"kandidat lemah: {len(weak_detections)} objek "
            f"(imgsz={DETECT_IMGSZ})."
        )

        # Gambar anotasi semua bounding box ke gambar asli
        annotated_img = orig_img.copy()
        for det in valid_detections:
            cname = det["class"]
            box_coords = [int(v) for v in det["box"]]
            x1, y1, x2, y2 = box_coords
            color = CLASS_COLORS.get(cname, (0, 255, 255))
            label_text = f"{cname} {det['conf']:.2f}"

            # Kotak deteksi
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), color, 2)
            # Tag label teks dengan background
            (tw, th), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            y_label = max(y1, th + 4)
            cv2.rectangle(annotated_img, (x1, y_label - th - 4), (x1 + tw + 4, y_label + baseline), color, -1)
            cv2.putText(annotated_img, label_text, (x1 + 2, y_label - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        filename = os.path.basename(image_path)
        detected_filename = filename.replace(".jpg", "_detected.jpg")
        detected_path = os.path.join("uploads", detected_filename)
        cv2.imwrite(detected_path, annotated_img)
        print(f"[ENGINE] Gambar hasil deteksi multi-model disimpan ke: {detected_path}")

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

        # Kalau tidak ada deteksi kuat sama sekali
        if not valid_detections:
            _prev_meta = _clean_analysis_meta(issue.meta_data)

            # --- VLM RESCUE ---
            # YOLO nol deteksi BUKAN berarti foto aman. Kasus nyata: foto
            # "tes jalan nya bos .jpeg" gagal total di satu resolusi padahal
            # jalannya penuh lubang besar. Jadi justru di titik ini VLM
            # paling berguna: dikirimi foto tanpa "bias" dari YOLO.
            if VLM_ENABLED and not weak_detections:
                print("[ENGINE] YOLO nol deteksi -> minta pendapat VLM (rescue).")
                rescue_payload = {
                    "severity_label": "LOW",
                    "score": 0,
                    "primary_issue_class": "aman",
                    "location": _build_location_text(issue),
                    "geometry": None,
                    "breakdown": {},
                    "objects": [],
                    "road_width_m": CAMERA_CFG["road_width_m"],
                    "timestamp": issue.created_at.isoformat() if issue.created_at else None,
                }
                rescue = ask_vlm_verdict(rescue_payload, abs_path)
                if rescue and rescue["kelas_utama"] != "aman":
                    # Skor rescue: YOLO tidak punya angka sama sekali (0), jadi
                    # interpolasi band akan menghasilkan batas bawah. Untuk band
                    # RINGAN batas bawahnya 0 — itu akan salah dibaca sebagai
                    # "tidak ada kerusakan". Pakai titik tengah band sebagai
                    # estimasi deterministik saat YOLO benar-benar buta.
                    rescue_score = rescue["final_score"]
                    if rescue_score <= 0:
                        _lo, _hi = BAND_SCORE_RANGE.get(rescue["band"], (45, 74))
                        rescue_score = int(round((_lo + _hi) / 2))
                    print(
                        f"[VLM] RESCUE: YOLO buta, VLM melihat '{rescue['kelas_utama']}' "
                        f"band={rescue['band']} skor={rescue_score}."
                    )
                    issue.issue_class = rescue["kelas_utama"]
                    issue.severity_label = score_to_label(rescue_score)
                    issue.final_score = rescue_score
                    issue.breakdown_score = {rescue["kelas_utama"]: rescue_score}
                    issue.secondary_issues = []
                    issue.meta_data = {
                        **_prev_meta,
                        "geometry": None,
                        "objects": [],
                        "detect_imgsz": DETECT_IMGSZ,
                        "vlm_rescue": True,
                        "vlm_verdict": {
                            "kelas_utama": rescue["kelas_utama"],
                            "band": rescue["band"],
                            "final_score": rescue_score,
                            "severity_label": score_to_label(rescue_score),
                            "verifikasi_yolo": rescue["verifikasi_yolo"],
                            "bisa_dilalui": rescue["bisa_dilalui"],
                            "catatan_visual": rescue["catatan_visual"],
                        },
                        "yolo_baseline": {"kelas": "aman", "skor": 0},
                    }
                    _rescue_for_narr = {**rescue, "final_score": rescue_score,
                                        "severity_label": score_to_label(rescue_score)}
                    rescue_llm = _build_llm_result_from_verdict(
                        _rescue_for_narr, rescue_payload, None
                    )
                    issue.meta_data["llm_result"] = rescue_llm
                    issue.title = rescue_llm["dinas"].get("title") or "Laporan Kerusakan"
                    issue.description = (
                        rescue_llm["dinas"].get("technical_report")
                        or rescue_llm["public"].get("message")
                        or "Terdeteksi kerusakan melalui verifikasi visual."
                    )
                    issue.image_url = f"/static/{detected_filename}"
                    issue.status = "PENDING"
                    session.add(issue)
                    session.commit()
                    session.refresh(issue)
                    print("[ENGINE] Selesai lewat VLM rescue (YOLO tidak melihat apa pun).")
                    try:
                        norm_path = os.path.normpath(image_path)
                        if ("uploads_raw" in norm_path or norm_path.startswith("uploads_raw")) and os.path.exists(image_path):
                            os.remove(image_path)
                    except Exception:
                        pass
                    send_email_alert(issue)
                    return

            # Ada kandidat lemah? Jangan langsung bilang "aman" — tandai
            # perlu verifikasi supaya admin tetap bisa menilai fotonya.
            if weak_detections:
                weak_detections.sort(key=lambda d: d["conf"], reverse=True)
                weak_primary = weak_detections[0]
                weak_label = CLASS_LABEL_PUBLIC.get(
                    weak_primary["class"], weak_primary["class"].replace("_", " ")
                )
                print(
                    f"[ENGINE] Tidak ada deteksi kuat, tapi ada {len(weak_detections)} "
                    f"kandidat lemah (conf tertinggi {weak_primary['conf']:.2f}) -> perlu verifikasi."
                )
                issue.issue_class = weak_primary["class"]
                issue.severity_label = "LOW"
                issue.final_score = 0
                issue.breakdown_score = {}
                issue.secondary_issues = [
                    {"class": d["class"], "conf": round(d["conf"], 3)}
                    for d in weak_detections[1:]
                ]
                issue.meta_data = {
                    **_prev_meta,
                    "needs_review": True,
                    "review_reason": "model_low_confidence",
                    "low_conf_candidates": [
                        {"class": d["class"], "conf": round(d["conf"], 3)}
                        for d in weak_detections
                    ],
                    "detect_imgsz": DETECT_IMGSZ,
                }
                issue.title = f"Perlu Verifikasi: {weak_label.title()}"
                issue.description = (
                    f"Model mendeteksi kemungkinan {weak_label}, tetapi keyakinannya "
                    f"({weak_primary['conf'] * 100:.0f}%) masih di bawah ambang yang "
                    "dipakai sistem untuk menghitung skor keparahan. Laporan diteruskan "
                    "ke admin untuk dicek manual pada foto aslinya."
                )
                issue.image_url = f"/static/{detected_filename}"
                issue.status = "PENDING"
                session.add(issue)
                session.commit()
                session.refresh(issue)
                print("[ENGINE] Selesai dengan tanda perlu verifikasi.")
                return

            print("[ENGINE] Tidak ada kerusakan terdeteksi.")
            issue.issue_class = "aman"
            issue.severity_label = "LOW"
            issue.final_score = 0
            issue.breakdown_score = {}
            issue.secondary_issues = []
            # Pertahankan raw_file (dipakai recovery & delete) — jangan timpa total
            issue.meta_data = {
                **_prev_meta,
                "note": "Tidak ada objek valid terdeteksi oleh model.",
                "detect_imgsz": DETECT_IMGSZ,
            }
            issue.title = "Tidak Ditemukan Kerusakan"
            issue.description = "Sistem tidak menemukan kerusakan signifikan pada foto yang dikirim."
            issue.image_url = f"/static/{detected_filename}"
            issue.status = "PENDING"
            session.add(issue)
            session.commit()
            session.refresh(issue)
            print("[ENGINE] Selesai tanpa temuan.")
            return

        # Hitung skor spasial + geometri (BASELINE dari YOLO)
        final_score, primary_issue, breakdown, geometry_dom, objects_meta = calculate_spatial_score(
            valid_detections, img_w, img_h
        )

        severity_label = score_to_label(final_score)

        # Build payload untuk VLM/LLM
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

        # --- VLM SEBAGAI HAKIM ---
        # Kirim FOTO + ringkasan YOLO. VLM bisa menangkap kasus yang mustahil
        # diketahui oleh jalur teks lama (mis. padang rumput divonis jalan
        # berlubang), lalu menentukan band keparahan. Skor final tetap
        # dikonversi backend lewat BAND_SCORE_RANGE (deterministik).
        yolo_score_before = final_score
        yolo_class_before = primary_issue
        vlm_verdict = None
        if VLM_ENABLED:
            print("[ENGINE] Mengontak VLM untuk verifikasi visual (foto + hasil YOLO).")
            vlm_verdict = ask_vlm_verdict(payload, abs_path)

        if vlm_verdict:
            primary_issue = vlm_verdict["kelas_utama"]
            final_score = vlm_verdict["final_score"]
            severity_label = vlm_verdict["severity_label"]
            print(
                f"[VLM] Keputusan: {primary_issue} | band={vlm_verdict['band']} | "
                f"skor={final_score} ({severity_label}) | verifikasi YOLO={vlm_verdict['verifikasi_yolo']}"
            )
            if primary_issue != yolo_class_before:
                print(
                    f"[VLM] KOREKSI KELAS: YOLO bilang '{yolo_class_before}' "
                    f"(skor {yolo_score_before}) -> VLM bilang '{primary_issue}'."
                )
            llm_result = _build_llm_result_from_verdict(vlm_verdict, payload, geometry_dom)
        else:
            # Fallback: jalur lama (LLM teks). Tetap dipakai kalau VLM mati,
            # API error, atau VLM_ENABLED=false.
            print("[ENGINE] VLM tidak tersedia -> fallback LLM narasi (size reasoning + validation + public + dinas).")
            llm_result = ask_llm_combined(payload)

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

        # Kalau VLM mengoreksi kelas, breakdown & secondary_issues dari YOLO
        # jadi menyesatkan (bisa berisi kelas yang justru dinyatakan salah,
        # mis. "jalan_bolong" pada foto padang rumput). Bersihkan supaya yang
        # tersisa hanya konsisten dengan kelas final.
        if primary_issue != yolo_class_before:
            issue.breakdown_score = {primary_issue: final_score}
            issue.secondary_issues = []
        else:
            issue.breakdown_score = breakdown
            issue.secondary_issues = [
                o for o in objects_meta if o.get("class") != primary_issue
            ]

        # Kalau VLM menyimpulkan fotonya aman (bukan kerusakan), geometri dan
        # objek YOLO tidak lagi mewakili apa pun yang nyata — jangan simpan
        # supaya halaman detail tidak menampilkan angka lubang yang fiktif.
        if primary_issue == "aman":
            geometry_dom = None
            objects_meta = []
            breakdown = {}
            issue.breakdown_score = {}
            issue.secondary_issues = []

        # Meta data teknis full (pertahankan raw_file agar recovery/delete tetap jalan)
        # Bersihkan dulu key analisis lama supaya tidak ada sisa needs_review /
        # narasi dari percobaan sebelumnya.
        _prev_meta = _clean_analysis_meta(issue.meta_data)
        issue.meta_data = {
            **_prev_meta,
            "geometry": geometry_dom,
            "objects": objects_meta,
            "llm_payload": payload,
            "llm_result": llm_result,
        }
        if vlm_verdict:
            # Simpan jejak keputusan supaya admin bisa audit kenapa skor berubah.
            issue.meta_data["vlm_verdict"] = {
                "kelas_utama": vlm_verdict["kelas_utama"],
                "band": vlm_verdict["band"],
                "final_score": vlm_verdict["final_score"],
                "severity_label": vlm_verdict["severity_label"],
                "verifikasi_yolo": vlm_verdict["verifikasi_yolo"],
                "bisa_dilalui": vlm_verdict["bisa_dilalui"],
                "catatan_visual": vlm_verdict["catatan_visual"],
            }
            issue.meta_data["yolo_baseline"] = {
                "kelas": yolo_class_before,
                "skor": yolo_score_before,
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

        # Simpan image annotated (cv2.imwrite tidak menulis EXIF,
        # jadi GPS/identitas lain otomatis hilang dari file publik).
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

        # Cleanup: hapus raw file (EXIF/GPS) setelah analisis sukses.
        # Kalau error, raw tetap disimpan untuk debug/admin.
        try:
            norm_path = os.path.normpath(image_path)
            if ("uploads_raw" in norm_path or norm_path.startswith("uploads_raw")) and os.path.exists(image_path):
                os.remove(image_path)
                print(f"[STRIP-EXIF] Raw file dihapus: {image_path}")
        except Exception as ce:
            print(f"[STRIP-EXIF] Gagal hapus raw: {ce}")

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
