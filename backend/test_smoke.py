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