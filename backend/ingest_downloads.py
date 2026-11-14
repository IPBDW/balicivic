#!/usr/bin/env python3
"""
Ingest and analyze 31 downloaded test images from ~/Downloads into BaliCivic AI.
Simulates distributed citizen reports across all 9 regencies in Bali with
realistic randomized coordinates.
"""

import os
import shutil
import random
from uuid import uuid4
from sqlmodel import Session, select

from database import engine
from models import Issue
from utils import (
    process_analysis,
    is_inside_bali,
)

UPLOAD_RAW_DIR = "uploads_raw"

# 9 Regencies/Cities of Bali with realistic anchor coordinates
BALI_REGENCY_ANCHORS = [
    {"kabupaten": "Kota Denpasar", "kecamatan": "Denpasar Barat", "lat": -8.6550, "lon": 115.2050},
    {"kabupaten": "Kota Denpasar", "kecamatan": "Denpasar Selatan", "lat": -8.6920, "lon": 115.2280},
    {"kabupaten": "Badung", "kecamatan": "Kuta", "lat": -8.7210, "lon": 115.1730},
    {"kabupaten": "Badung", "kecamatan": "Kuta Utara", "lat": -8.6480, "lon": 115.1380},
    {"kabupaten": "Badung", "kecamatan": "Mengwi", "lat": -8.5430, "lon": 115.1720},
    {"kabupaten": "Gianyar", "kecamatan": "Ubud", "lat": -8.5069, "lon": 115.2625},
    {"kabupaten": "Gianyar", "kecamatan": "Sukawati", "lat": -8.5950, "lon": 115.2810},
    {"kabupaten": "Gianyar", "kecamatan": "Gianyar", "lat": -8.5410, "lon": 115.3280},
    {"kabupaten": "Tabanan", "kecamatan": "Tabanan", "lat": -8.5390, "lon": 115.1250},
    {"kabupaten": "Tabanan", "kecamatan": "Kediri", "lat": -8.5720, "lon": 115.1380},
    {"kabupaten": "Tabanan", "kecamatan": "Baturiti", "lat": -8.3240, "lon": 115.1850},
    {"kabupaten": "Buleleng", "kecamatan": "Buleleng", "lat": -8.1120, "lon": 115.0880},
    {"kabupaten": "Buleleng", "kecamatan": "Seririt", "lat": -8.1960, "lon": 114.9310},
    {"kabupaten": "Buleleng", "kecamatan": "Sukasada", "lat": -8.1580, "lon": 115.1120},
    {"kabupaten": "Karangasem", "kecamatan": "Karangasem", "lat": -8.4480, "lon": 115.6120},
    {"kabupaten": "Karangasem", "kecamatan": "Manggis", "lat": -8.4980, "lon": 115.5210},
    {"kabupaten": "Karangasem", "kecamatan": "Rendang", "lat": -8.4230, "lon": 115.4290},
    {"kabupaten": "Klungkung", "kecamatan": "Klungkung", "lat": -8.5370, "lon": 115.4040},
    {"kabupaten": "Klungkung", "kecamatan": "Dawan", "lat": -8.5420, "lon": 115.4480},
    {"kabupaten": "Klungkung", "kecamatan": "Nusa Penida", "lat": -8.7280, "lon": 115.5460},
    {"kabupaten": "Bangli", "kecamatan": "Bangli", "lat": -8.4540, "lon": 115.3550},
    {"kabupaten": "Bangli", "kecamatan": "Kintamani", "lat": -8.2450, "lon": 115.3320},
    {"kabupaten": "Jembrana", "kecamatan": "Negara", "lat": -8.3580, "lon": 114.6280},
    {"kabupaten": "Jembrana", "kecamatan": "Mendoyo", "lat": -8.3610, "lon": 114.7350},
    {"kabupaten": "Jembrana", "kecamatan": "Melaya", "lat": -8.2560, "lon": 114.5020},
]


def generate_bali_coordinate(index: int):
    """Pick an anchor and add slight jitter (+/- 0.005) while staying safely in Bali."""
    anchor = BALI_REGENCY_ANCHORS[index % len(BALI_REGENCY_ANCHORS)]
    # Random jitter ~ 300 - 800m
    lat_jitter = random.uniform(-0.006, 0.006)
    lon_jitter = random.uniform(-0.006, 0.006)
    lat = round(anchor["lat"] + lat_jitter, 6)
    lon = round(anchor["lon"] + lon_jitter, 6)
    assert is_inside_bali(lat, lon), f"Generated ({lat}, {lon}) is outside Bali!"
    return lat, lon, anchor["kabupaten"], anchor["kecamatan"]


def main():
    downloads_dir = os.path.expanduser("~/Downloads")
    files = sorted([
        f for f in os.listdir(downloads_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ])

    print(f"=== Menemukan {len(files)} file di {downloads_dir} ===")
    os.makedirs(UPLOAD_RAW_DIR, exist_ok=True)

    results = []

    for idx, fname in enumerate(files, 1):
        src_path = os.path.join(downloads_dir, fname)
        lat, lon, kab, kec = generate_bali_coordinate(idx)

        fid = uuid4().hex[:8]
        raw_copy_path = os.path.join(UPLOAD_RAW_DIR, f"{fid}.jpg")
        shutil.copy2(src_path, raw_copy_path)

        print(f"\n[{idx:2d}/{len(files)}] Memproses: {fname[:45]}")
        print(f"     Lokasi: ({lat}, {lon}) -> {kec}, {kab}")

        with Session(engine) as session:
            new_issue = Issue(
                title="Sedang Menganalisis",
                description="Menunggu antrean pemrosesan AI.",
                latitude=lat,
                longitude=lon,
                issue_class="processing",
                severity_label="LOW",
                final_score=0,
                image_url=None,
                status="PENDING",
                breakdown_score={},
                secondary_issues=[],
                meta_data={
                    "raw_file": f"{fid}.jpg",
                    "original_filename": fname,
                    "simulated_kabupaten": kab,
                    "simulated_kecamatan": kec,
                },
            )
            session.add(new_issue)
            session.commit()
            session.refresh(new_issue)
            issue_id = new_issue.id

        # Jalankan process_analysis (membuka session sendiri)
        with Session(engine) as session:
            process_analysis(issue_id, raw_copy_path, session)

        # Cek hasil akhir dari database
        with Session(engine) as session:
            issue = session.get(Issue, issue_id)
            if issue:
                meta = issue.meta_data or {}
                rejected_reason = meta.get("rejected_reason")
                scene_evidence = meta.get("scene_evidence")
                needs_review = meta.get("needs_review")

                res_info = {
                    "id": issue.id,
                    "filename": fname,
                    "location": f"{kec}, {kab}",
                    "lat": lat,
                    "lon": lon,
                    "issue_class": issue.issue_class,
                    "final_score": issue.final_score,
                    "severity_label": issue.severity_label,
                    "title": issue.title,
                    "rejected_reason": rejected_reason,
                    "scene_evidence": scene_evidence,
                    "needs_review": needs_review,
                }
                results.append(res_info)
                print(f"     -> HASIL: {issue.issue_class} | Skor: {issue.final_score} ({issue.severity_label})")
                print(f"        Judul: {issue.title}")
                if rejected_reason:
                    print(f"        Ditolak: {rejected_reason} ({scene_evidence})")
                elif needs_review:
                    print(f"        Perlu Verifikasi: True")

    print("\n" + "=" * 70)
    print("=== SUMMARY HASIL INGEST & AUDIT 31 GAMBAR ===")
    print("=" * 70)

    class_counts = {}
    for r in results:
        cls = r["issue_class"]
        class_counts[cls] = class_counts.get(cls, 0) + 1

    for cls, cnt in class_counts.items():
        print(f"  - {cls:18s}: {cnt} laporan")

    print("\nDetail per gambar:")
    for r in results:
        status_tag = f"[{r['issue_class']}:{r['final_score']}]"
        note = ""
        if r["rejected_reason"]:
            note = f" (Scene Guard: {r['rejected_reason']})"
        elif r["needs_review"]:
            note = " (Perlu Verifikasi)"
        print(f"#{r['id']:3d} | {status_tag:18s} | {r['filename'][:35]:35s} | {r['location']}{note}")


if __name__ == "__main__":
    main()
