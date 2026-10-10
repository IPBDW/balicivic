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