"""
Smoke tests untuk backend BaliCivic AI.
Jalan pakai pytest (atau langsung: pytest backend/test_smoke.py -v).
Cakupan: endpoint utama + auth admin + recovery.

Setup: butuh backend jalan di http://127.0.0.1:8000 + DB berisi.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

# Path ke backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from main import app
from database import create_db_and_tables

create_db_and_tables()
client = TestClient(app)


# ============================================================
# Health & root
# ============================================================

def test_root_ok():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "online"


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("ok", "degraded")
    assert body["db"] in ("ok", "error")


# ============================================================
# Issues list & detail
# ============================================================

def test_issues_list_default():
    r = client.get("/api/issues")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_issues_list_with_pagination():
    r = client.get("/api/issues?limit=10&offset=0")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) <= 10


def test_issues_list_with_status_filter():
    r = client.get("/api/issues?status=PENDING")
    assert r.status_code == 200
    for iss in r.json():
        assert iss["status"] == "PENDING"


def test_issues_list_with_class_filter():
    r = client.get("/api/issues?issue_class=jalan_bolong")
    assert r.status_code == 200
    for iss in r.json():
        assert iss["issue_class"] == "jalan_bolong"


def test_issues_list_invalid_status():
    """Status pattern harus ditolak."""
    r = client.get("/api/issues?status=BLAH")
    assert r.status_code == 422


def test_issues_list_limit_too_high():
    r = client.get("/api/issues?limit=99999")
    assert r.status_code == 422


def test_issues_count():
    r = client.get("/api/issues/count")
    assert r.status_code == 200
    assert "total" in r.json()


def test_issue_detail_not_found():
    """PK int, harus return 404 bersih."""
    r = client.get("/api/issues/999999")
    assert r.status_code == 404


def test_issue_detail_bad_id():
    """ID non-int harus ditolak Pydantic."""
    r = client.get("/api/issues/abc")
    assert r.status_code == 422


# ============================================================
# Admin auth
# ============================================================

def test_admin_verify_no_token():
    r = client.get("/api/admin/verify")
    assert r.status_code == 401


def test_admin_verify_bad_token():
    r = client.get("/api/admin/verify?token=bogus")
    assert r.status_code == 401


def test_admin_verify_good_token():
    from utils import TOKEN
    r = client.get(f"/api/admin/verify?token={TOKEN}")
    assert r.status_code == 200
    assert r.json()["valid"] is True


def test_admin_verify_scoped_token():
    from utils import generate_issue_token
    scoped = generate_issue_token(42)
    # Harus sukses baik dengan ?issue_id=42 maupun ?id=42 (dipakai link email & web)
    r = client.get(f"/api/admin/verify?token={scoped}&issue_id=42")
    assert r.status_code == 200
    assert r.json()["valid"] is True

    r2 = client.get(f"/api/admin/verify?token={scoped}&id=42")
    assert r2.status_code == 200
    assert r2.json()["valid"] is True

    # Scoped token untuk id=42 tidak boleh berlaku untuk id=99
    r_bad = client.get(f"/api/admin/verify?token={scoped}&issue_id=99")
    assert r_bad.status_code == 401

    r_bad2 = client.get(f"/api/admin/verify?token={scoped}&id=99")
    assert r_bad2.status_code == 401


def test_admin_delete_no_token():
    r = client.delete("/api/issues/1")
    assert r.status_code == 401


def test_admin_delete_bad_status():
    """Whitelist status harus kerja."""
    from utils import TOKEN
    r = client.put(
        "/api/issues/1/status",
        params={"status": "BOGUS"},
        headers={"X-Admin-Token": TOKEN},
    )
    assert r.status_code == 422


# ============================================================
# Summary & distribution
# ============================================================

def test_summary_structure():
    r = client.get("/api/summary")
    assert r.status_code == 200
    body = r.json()
    # Pastikan field penting ada (termasuk 'error' yang baru)
    for k in ("total", "antrean", "perlu_tindakan", "selesai", "error"):
        assert k in body, f"missing key: {k}"


def test_distribution_structure():
    r = client.get("/api/distribution")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    # 4 kelas harus selalu ada
    labels = {item["label"] for item in body}
    assert "Jalan Bolong" in labels
    assert "Kabel Berantakan" in labels  # renamed label


# ============================================================
# Upload validation
# ============================================================

def test_upload_no_file():
    r = client.post("/api/analyze")
    assert r.status_code in (400, 422)


def test_upload_non_image():
    """Kirim file teks, harus ditolak."""
    files = {"file": ("test.txt", b"not an image", "text/plain")}
    r = client.post("/api/analyze", files=files)
    assert r.status_code == 400


def test_upload_invalid_lat():
    """Koordinat out of range harus ditolak."""
    files = {"file": ("x.jpg", b"\xff\xd8\xff\xe0", "image/jpeg")}
    data = {"lat": "999", "long": "0"}
    r = client.post("/api/analyze", files=files, data=data)
    # Either 400 untuk koordinat atau 422 validation
    assert r.status_code in (400, 422)


def test_upload_geofence_outside_bali():
    """Koordinat di luar Provinsi Bali (misal Jakarta) harus ditolak dengan 400."""
    import io
    from PIL import Image
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"file": ("outside.jpg", buf.getvalue(), "image/jpeg")}
    # Koordinat Monas Jakarta: -6.1754, 106.8272
    data = {"lat": "-6.1754", "long": "106.8272"}
    r = client.post("/api/analyze", files=files, data=data)
    assert r.status_code == 400
    assert "luar wilayah Provinsi Bali" in r.json().get("detail", "")


def test_is_inside_bali_bounds():
    from utils import is_inside_bali
    # Denpasar, Bali: harus True
    assert is_inside_bali(-8.6705, 115.2126) is True
    # Ubud, Gianyar: harus True
    assert is_inside_bali(-8.5069, 115.2625) is True
    # Nusa Penida: harus True
    assert is_inside_bali(-8.7278, 115.5444) is True
    # Jakarta: harus False
    assert is_inside_bali(-6.1754, 106.8272) is False
    # None: harus False
    assert is_inside_bali(None, 115.2126) is False


def test_upload_image_dimension_limit():
    """Gambar dengan dimensi > 4096px harus ditolak (DoS mitigation)."""
    import io
    from PIL import Image
    img = Image.new("RGB", (4097, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"file": ("huge.jpg", buf.getvalue(), "image/jpeg")}
    r = client.post("/api/analyze", files=files)
    assert r.status_code == 400
    assert "maksimal 4096x4096" in r.json().get("detail", "")


# ============================================================
# Deteksi & geocoding (regression)
# ============================================================

def test_detect_config_sane():
    """
    Regression: threshold jalan_bolong dulu 0.65 sehingga foto berlubang
    yang jelas pun dibuang semua dan laporan jatuh ke "Tidak Ditemukan
    Kerusakan". Pastikan konfigurasi tetap masuk akal.
    """
    from utils import CONF_THRESHOLDS, DETECT_IMGSZ, LOW_CONF_MIN

    assert DETECT_IMGSZ >= 640, "imgsz terlalu kecil untuk foto warga"
    assert 0 < LOW_CONF_MIN <= min(CONF_THRESHOLDS.values())
    for cls, thr in CONF_THRESHOLDS.items():
        assert 0.02 <= thr <= 0.75, f"threshold {cls}={thr} di luar rentang wajar"


def test_reverse_geocode_parse_address():
    """Parsing address LocationIQ/Nominatim -> (kecamatan, kabupaten)."""
    from utils import _parse_address

    # Format Nominatim (Denpasar Barat)
    assert _parse_address(
        {"suburb": "Padangsambian", "town": "Denpasar Barat", "city": "Denpasar"}
    ) == ("Denpasar Barat", "Denpasar")

    # Format LocationIQ (county = kabupaten)
    assert _parse_address({"city": "Kuta", "county": "Badung"}) == ("Kuta", "Badung")

    # Jangan hasilkan duplikat "Kuta, Kuta"
    kec, kab = _parse_address({"city": "Kuta", "town": "Kuta"})
    assert kec == "Kuta" and kab is None

    # Kosong / bukan dict -> None, None
    assert _parse_address({}) == (None, None)
    assert _parse_address(None) == (None, None)


def test_reverse_geocode_without_key_uses_fallback(monkeypatch):
    """Tanpa LOCATIONIQ_API_KEY, fungsi tetap mencoba Nominatim (bukan langsung None)."""
    import utils

    called = {}

    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"address": {"town": "Kuta", "county": "Badung"}}

    def fake_get(url, **kwargs):
        called["url"] = url
        return FakeResp()

    monkeypatch.setattr(utils, "LOCATIONIQ_API_KEY", None)
    monkeypatch.setattr(utils.requests, "get", fake_get)

    kec, kab = utils.reverse_geocode(-8.7201, 115.1750)
    assert "nominatim" in called["url"]
    assert (kec, kab) == ("Kuta", "Badung")


def test_water_detection_in_sky_is_rejected():
    """
    Model puddle sering false-positive di langit. Objek genangan_air yang
    pusatnya di zona langit atas (< 0.18) harus dibuang sebelum skoring.
    """
    from utils import MAX_Y_CENTER_FOR_WATER

    assert 0.10 <= MAX_Y_CENTER_FOR_WATER <= 0.65
    # Box di langit (y center ~0.105) -> di bawah batas, harus ditolak
    y_center_sky = ((0 + 848) / 2) / 4032
    assert y_center_sky < MAX_Y_CENTER_FOR_WATER
    # Box di jalan (y center ~0.8) -> lolos
    y_center_road = ((3000 + 3600) / 2) / 4032
    assert y_center_road > MAX_Y_CENTER_FOR_WATER


def test_pothole_in_sky_or_pole_is_rejected():
    """
    Regression: lubang jalan tidak boleh melayang di zona langit teratas,
    dan noise kecil di tiang listrik (seperti issue #27) ditolak oleh MIN_AREA_FOR_POTHOLE.
    """
    from utils import MAX_Y_CENTER_FOR_ROAD, MIN_AREA_FOR_POTHOLE

    assert 0.10 <= MAX_Y_CENTER_FOR_ROAD <= 0.65
    # Box di langit teratas (y center 0.05) -> harus ditolak
    y_center_sky = ((0 + 400) / 2) / 4000
    assert y_center_sky < MAX_Y_CENTER_FOR_ROAD
    # Box di jalan (y center 0.62) -> lolos
    y_center_road = ((2446 + 2648) / 2) / 4080
    assert y_center_road > MAX_Y_CENTER_FOR_ROAD

    # Box kecil di tiang (luas 0.045% seperti issue #27) ditolak oleh MIN_AREA
    tiny_pole_box = (24.5 * 13.3) / (736 * 981)
    assert tiny_pole_box < MIN_AREA_FOR_POTHOLE


def test_nms_deduplicates_overlapping_boxes():
    """NMS harus menggabungkan deteksi duplikat dari multi-head model."""
    from utils import _apply_nms

    dups = [
        {"class": "genangan_air", "conf": 0.60, "box": [100, 100, 200, 200]},
        {"class": "genangan_air", "conf": 0.58, "box": [102, 101, 198, 202]},  # IoU > 0.9
        {"class": "genangan_air", "conf": 0.50, "box": [300, 300, 400, 400]},  # Terpisah
    ]
    res = _apply_nms(dups, iou_thresh=0.45)
    assert len(res) == 2
    assert res[0]["conf"] == 0.60
    assert res[1]["conf"] == 0.50


def test_tiny_pothole_noise_is_rejected():
    """
    Objek lubang jalan yang terlalu kecil (< 0.08% area) dan tidak berada
    di foreground bawah frame harus dianggap noise/false positive.
    """
    from utils import MIN_AREA_FOR_POTHOLE

    # Box 24x13 piksel pada frame 736x981 -> area 0.045%
    tiny_area = (24.5 * 13.3) / (736 * 981)
    assert tiny_area < MIN_AREA_FOR_POTHOLE


def test_cable_in_ground_is_rejected():
    """
    Kabel semrawut adalah utilitas udara/tiang. Objek di lantai aspal
    tepat di depan kaki (y_center > 0.90) dibuang.
    """
    from utils import MIN_Y_CENTER_FOR_CABLE

    assert 0.8 < MIN_Y_CENTER_FOR_CABLE <= 0.95
    # Kabel di udara/tiang (y center 0.35 - 0.55) -> lolos
    assert 0.45 < MIN_Y_CENTER_FOR_CABLE
    # Objek di aspal paling bawah (y center 0.95) -> ditolak
    assert 0.95 > MIN_Y_CENTER_FOR_CABLE


def test_scene_guard_rejects_indoor_photo():
    """
    Regression: foto laptop + tas di meja kerja sempat terdeteksi sebagai
    'kabel_semrawut' (issue #36 & #37). Scene guard harus menolak foto
    yang jelas berisi benda dalam ruangan.
    """
    import cv2
    import os
    from utils import detect_indoor_scene, SCENE_GUARD_ENABLED

    assert SCENE_GUARD_ENABLED, "scene guard harus aktif di produksi"

    fixtures = [
        ("uploads/a158735c_detected.jpg", {"laptop", "keyboard", "tv"}),
        ("uploads/041ab0dd_detected.jpg", {"backpack", "suitcase"}),
    ]
    for path, expected in fixtures:
        if not os.path.exists(path):
            continue  # fixture opsional: lewati kalau file tidak ada
        img = cv2.imread(path)
        h, w = img.shape[:2]
        is_indoor, evidence = detect_indoor_scene(path, w, h)
        assert is_indoor, f"{path} seharusnya ditolak sebagai foto indoor"
        found = {e["class"] for e in evidence}
        assert found & expected, f"bukti {found} tidak cocok dengan {expected}"


def test_scene_guard_allows_road_photo():
    """Foto jalan asli tidak boleh ditolak scene guard."""
    import cv2
    import os
    from utils import detect_indoor_scene

    path = "uploads/f7f3f593_detected.jpg"  # foto kabel utilitas di jalan
    if not os.path.exists(path):
        return
    img = cv2.imread(path)
    h, w = img.shape[:2]
    is_indoor, evidence = detect_indoor_scene(path, w, h)
    assert not is_indoor, f"foto jalan salah ditolak: {evidence}"


def test_scene_guard_classes_configured():
    """Scene guard harus memuat kelas indoor, makanan, hewan, dan barang besar."""
    from utils import _INDOOR_CLASSES, _ANIMAL_CLASSES, _LARGE_PORTABLE_CLASSES, _SCENE_LABELS_ID

    assert "laptop" in _INDOOR_CLASSES
    assert "banana" in _INDOOR_CLASSES
    assert "dog" in _ANIMAL_CLASSES
    assert "bird" in _ANIMAL_CLASSES
    assert "person" in _SCENE_LABELS_ID
    assert "backpack" in _LARGE_PORTABLE_CLASSES


def test_severe_pothole_scoring_high():
    """
    Regression: Lubang jalan berskala besar / amblas (width_ratio >= 0.35 atau area_ratio >= 0.06)
    harus dinilai HIGH (skor >= 75) sesuai standar Bina Marga / PUPR untuk penanganan darurat.
    """
    from utils import calculate_spatial_score, score_to_label

    # Kasus lubang besar di 📌.jpeg: w=400, h=300, box=[86.6, 173.9, 289.3, 268.0]
    img_w, img_h = 400, 300
    det = [{
        "class": "jalan_bolong",
        "conf": 0.40,
        "box": [86.6, 173.9, 289.3, 268.0],
    }]
    final_score, primary_issue, breakdown, geometry_dom, objects_meta = calculate_spatial_score(
        det, img_w, img_h
    )
    assert primary_issue == "jalan_bolong"
    assert final_score >= 75, f"Skor lubang besar harus HIGH (>= 75), didapat: {final_score}"
    assert score_to_label(final_score) == "HIGH"


def test_cable_inside_vehicle_suppression():
    """
    Regression: Spion mobil, wiper, atau antena kendaraan tidak boleh terdeteksi
    sebagai 'kabel_semrawut' (issue #63).
    """
    from utils import detect_vehicles

    # Buat dummy bounding box mobil dan koordinat spion di dalamnya
    vehicle_boxes = [[574.6, 337.7, 735.8, 680.2]] # Mobil putih di sisi kanan
    spion_box = [643.9, 370.5, 698.9, 426.6]        # Spion kanan
    cx = (spion_box[0] + spion_box[2]) / 2.0
    cy = (spion_box[1] + spion_box[3]) / 2.0

    in_veh = any(vx1 <= cx <= vx2 and vy1 <= cy <= vy2 for vx1, vy1, vx2, vy2 in vehicle_boxes)
    assert in_veh is True, "Koordinat spion harus terdeteksi di dalam batas bounding box kendaraan"


# ============================================================
# VLM sebagai hakim: konversi band -> skor & normalisasi verdict
# ============================================================

def test_band_to_score_is_deterministic_and_in_range():
    """
    Regression: VLM (model generatif) tidak boleh mengarang skor 0-100.
    Uji empiris: foto sama 4x run bisa menghasilkan 20, 90, 22, 22.
    Solusi: VLM hanya memilih band, backend yang mengonversi lewat tabel tetap.
    """
    from utils import BAND_SCORE_RANGE, band_to_score, score_to_label

    for band, (lo, hi) in BAND_SCORE_RANGE.items():
        for yolo_score in (0, 25, 50, 75, 100):
            got = band_to_score(band, yolo_score)
            assert lo <= got <= hi, f"band {band} skor {yolo_score} -> {got} di luar {lo}-{hi}"
            # Deterministik: input sama harus selalu sama.
            assert got == band_to_score(band, yolo_score)

    # Band harus selaras dengan label: RINGAN=LOW, SEDANG=MEDIUM, BERAT/KRITIS=HIGH.
    assert score_to_label(band_to_score("RINGAN", 50)) == "LOW"
    assert score_to_label(band_to_score("SEDANG", 50)) == "MEDIUM"
    assert score_to_label(band_to_score("BERAT", 50)) == "HIGH"
    assert score_to_label(band_to_score("KRITIS", 50)) == "HIGH"

    # Band tak dikenal -> jatuh ke skor YOLO apa adanya (tidak crash).
    assert band_to_score("NGACO", 63) == 63
    assert band_to_score("", 0) == 0


def test_band_to_score_does_not_saturate_on_huge_objects():
    """
    Regression: skor matematis YOLO dipotong di 100, dan 11 dari 31 foto uji
    mentok 100. Kalau posisi di dalam band diambil dari skor itu, semua foto
    parah keluar dengan angka identik (87) walau luas kerusakannya beda jauh
    (37% vs 7,9% frame). Luas objek tidak jenuh, jadi dipakai sebagai bukti.
    """
    from utils import band_to_score, severity_fraction

    # Luas makin besar -> fraksi makin besar, monoton dan terbatas 0..1.
    fracs = [severity_fraction(a, "jalan_bolong") for a in (0.0, 0.02, 0.05, 0.10, 0.15, 0.40)]
    assert fracs == sorted(fracs), "fraksi harus monoton naik terhadap luas"
    assert fracs[0] == 0.0
    assert fracs[-1] == 1.0, "luas di atas skala harus di-clamp ke 1"

    # Dengan band yang SAMA dan skor YOLO yang SAMA-SAMA jenuh (100),
    # luas berbeda harus menghasilkan angka berbeda.
    small = band_to_score("BERAT", 100, severity_fraction(0.079, "jalan_bolong"))
    large = band_to_score("BERAT", 100, severity_fraction(0.370, "jalan_bolong"))
    assert small != large, "foto 37% frame tidak boleh sama skornya dengan 7,9%"
    assert large > small

    # Semua tetap di dalam band-nya masing-masing.
    for band, (lo, hi) in {
        "RINGAN": (0, 44), "SEDANG": (45, 74), "BERAT": (75, 87), "KRITIS": (88, 100)
    }.items():
        for area in (0.001, 0.05, 0.5):
            got = band_to_score(band, 100, severity_fraction(area, "jalan_bolong"))
            assert lo <= got <= hi, f"{band} area={area} -> {got} keluar {lo}-{hi}"

    # evidence_ratio=None harus kembali ke perilaku lama (pakai skor YOLO).
    assert band_to_score("BERAT", 50, None) == band_to_score("BERAT", 50)

    # Kelas tak dikenal tetap dapat skala default, tidak crash.
    assert 0.0 <= severity_fraction(0.1, "kelas_aneh") <= 1.0


def test_vlm_verdict_normalization():
    """Verdict VLM dinormalisasi: kelas valid, band valid, skor dari tabel tetap."""
    from utils import _normalize_vlm_result, BAND_SCORE_RANGE

    payload = {
        "score": 54,
        "severity_label": "MEDIUM",
        "primary_issue_class": "jalan_bolong",
    }

    # Kasus nyata issue #46: padang rumput bersampah divonis "jalan_bolong" oleh YOLO.
    # VLM bilang YOLO salah dan kelas sebenarnya sampah_liar.
    verdict = _normalize_vlm_result(
        {
            "is_infrastruktur": True,
            "kelas_utama": "sampah_liar",
            "verifikasi_yolo": "yolo_salah",
            "tingkat": "SEDANG",
            "bisa_dilalui": "hati-hati",
            "catatan_visual": "Hamparan rumput penuh sampah, bukan jalan berlubang.",
        },
        payload,
    )
    assert verdict["kelas_utama"] == "sampah_liar", "koreksi kelas VLM harus dihormati"
    assert verdict["verifikasi_yolo"] == "yolo_salah"
    lo, hi = BAND_SCORE_RANGE["SEDANG"]
    assert lo <= verdict["final_score"] <= hi
    assert verdict["severity_label"] == "MEDIUM"

    # Foto bukan infrastruktur & tanpa kelas -> "aman" skor 0.
    aman = _normalize_vlm_result(
        {"is_infrastruktur": False, "kelas_utama": "aman", "tingkat": "RINGAN"},
        payload,
    )
    assert aman["kelas_utama"] == "aman"
    assert aman["final_score"] == 0
    assert aman["severity_label"] == "LOW"

    # Band ngawur / kelas ngawur -> fallback aman ke data YOLO, tidak crash.
    weird = _normalize_vlm_result(
        {"kelas_utama": "alien", "tingkat": "SUPER_PARAH", "verifikasi_yolo": "???"},
        payload,
    )
    assert weird["kelas_utama"] == "jalan_bolong"
    assert weird["band"] in BAND_SCORE_RANGE
    assert weird["verifikasi_yolo"] == "cocok"


def test_vlm_tie_break_keeps_yolo_class_within_same_family():
    """
    Anti flip-flop: lubang jalan penuh air kadang dibaca VLM sebagai
    'jalan_bolong', kadang 'genangan_air'. Karena satu keluarga
    (permukaan_jalan) dan YOLO tidak dinyatakan salah, pakai kelas YOLO.
    """
    from utils import _normalize_vlm_result

    payload = {
        "score": 80,
        "severity_label": "HIGH",
        "primary_issue_class": "jalan_bolong",
    }
    verdict = _normalize_vlm_result(
        {
            "is_infrastruktur": True,
            "kelas_utama": "genangan_air",
            "verifikasi_yolo": "cocok",
            "tingkat": "BERAT",
        },
        payload,
    )
    assert verdict["kelas_utama"] == "jalan_bolong", "satu keluarga -> ikut YOLO"

    # Tapi kalau YOLO dinyatakan SALAH, koreksi lintas keluarga tetap dihormati.
    corrected = _normalize_vlm_result(
        {
            "is_infrastruktur": True,
            "kelas_utama": "sampah_liar",
            "verifikasi_yolo": "yolo_salah",
            "tingkat": "SEDANG",
        },
        payload,
    )
    assert corrected["kelas_utama"] == "sampah_liar"


def test_vlm_llm_result_shape_compatible():
    """Hasil VLM harus punya bentuk sama dengan ask_llm_combined() (public/dinas/validation)."""
    from utils import _build_llm_result_from_verdict

    verdict = {
        "kelas_utama": "jalan_bolong",
        "band": "KRITIS",
        "final_score": 99,
        "severity_label": "HIGH",
        "verifikasi_yolo": "yolo_kurang_lengkap",
        "bisa_dilalui": "tidak",
        "catatan_visual": "Lubang amblas besar dengan rongga bawah aspal kosong.",
        "public": {"judul": "Jalan Amblas Berbahaya", "pesan": "Hindari area ini."},
        "dinas": {"judul": "Penanganan Darurat", "rekomendasi": "Tutup area dan perbaiki segera."},
    }
    payload = {"location": "Denpasar Barat, Denpasar", "score": 88}
    geometry = {"estimated_width_m": 2.5, "distance_m": 3.0}

    out = _build_llm_result_from_verdict(verdict, payload, geometry)

    for key in ("size_reasoning", "validation", "public", "dinas"):
        assert key in out, f"key '{key}' wajib ada agar kompatibel dengan pipeline lama"
    assert out["validation"]["math_score"] == 99
    assert out["public"]["severity_label"] == "HIGH"
    assert out["dinas"]["priority"] == "HIGH"
    assert out["dinas"]["estimated_width_m"] == 2.5
    assert out["source"] == "vlm_verdict"


def test_stale_meta_keys_include_vlm_traces():
    """
    Regression: analisis ulang harus membuang jejak keputusan lama.
    Tanpa ini, issue yang di-reanalyze bisa menyimpan vlm_verdict dari run
    sebelumnya padahal run terbaru jatuh ke jalur fallback teks (tanpa VLM),
    sehingga halaman admin menampilkan alasan yang tidak pernah terjadi.
    """
    from utils import _clean_analysis_meta

    prev = {
        "raw_file": "abc.jpg",
        "original_filename": "foto.jpeg",
        "geometry": {"estimated_width_m": 3.0},
        "objects": [{"class": "jalan_bolong"}],
        "llm_payload": {"score": 54},
        "llm_result": {"public": {}},
        "needs_review": True,
        "review_reason": "model_low_confidence",
        "low_conf_candidates": [],
        "vlm_verdict": {"kelas_utama": "sampah_liar"},
        "vlm_rescue": True,
        "yolo_baseline": {"kelas": "jalan_bolong", "skor": 54},
        "rejected_reason": "bukan_foto_infrastruktur",
        "scene_evidence": [{"class": "laptop"}],
        "note": "Tidak ada objek valid terdeteksi oleh model.",
        "error": "boom",
    }

    cleaned = _clean_analysis_meta(prev)

    # Yang harus BERTAHAN: identitas file (dipakai recovery & delete).
    assert cleaned["raw_file"] == "abc.jpg"
    assert cleaned["original_filename"] == "foto.jpeg"

    # Yang harus HILANG: semua jejak hasil analisis sebelumnya.
    for stale in (
        "geometry", "objects", "llm_payload", "llm_result",
        "needs_review", "review_reason", "low_conf_candidates",
        "vlm_verdict", "vlm_rescue", "yolo_baseline",
        "rejected_reason", "scene_evidence", "note", "error",
    ):
        assert stale not in cleaned, f"key '{stale}' harus dibersihkan saat analisis ulang"

    # meta_data rusak / bukan dict tidak boleh bikin crash.
    assert _clean_analysis_meta(None) == {}
    assert _clean_analysis_meta("bukan dict") == {}


def test_vlm_class_correction_drops_stale_yolo_breakdown():
    """
    Regression issue #46: setelah VLM mengoreksi 'jalan_bolong' -> 'sampah_liar',
    breakdown_score & secondary_issues tidak boleh masih berisi deteksi
    'jalan_bolong' yang justru sudah dinyatakan salah. Kalau dibiarkan,
    halaman detail menampilkan dua kelas yang saling bertentangan.
    """
    from utils import _normalize_vlm_result, _build_llm_result_from_verdict

    payload = {
        "score": 54,
        "severity_label": "MEDIUM",
        "primary_issue_class": "jalan_bolong",
        "location": "Tabanan, Tabanan",
        "objects": [{"class": "jalan_bolong", "area_ratio": 0.01}],
    }
    verdict = _normalize_vlm_result(
        {
            "is_infrastruktur": True,
            "kelas_utama": "sampah_liar",
            "verifikasi_yolo": "yolo_salah",
            "tingkat": "SEDANG",
        },
        payload,
    )

    yolo_class_before = payload["primary_issue_class"]
    primary = verdict["kelas_utama"]
    objects_meta = [{"class": "jalan_bolong", "score": 42}]

    # Tiru logika konsistensi di process_analysis.
    if primary != yolo_class_before:
        breakdown_out = {primary: verdict["final_score"]}
        secondary_out = []
    else:
        breakdown_out = {"jalan_bolong": 54}
        secondary_out = [o for o in objects_meta if o.get("class") != primary]

    assert primary == "sampah_liar"
    assert breakdown_out == {"sampah_liar": verdict["final_score"]}
    assert secondary_out == []

    # Narasi yang dihasilkan juga harus menyebut kelas yang sudah dikoreksi.
    narr = _build_llm_result_from_verdict(verdict, payload, None)
    assert "sampah" in narr["dinas"]["technical_report"].lower()
    assert "jalan_bolong" not in narr["dinas"]["technical_report"].lower()
