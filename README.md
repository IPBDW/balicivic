# BaliCivic AI

Sistem pelaporan kerusakan infrastruktur berbasis AI untuk pemerintah (Bali).
Warga mengirim foto + lokasi kerusakan, sistem mendeteksi jenis & tingkat
keparahan otomatis, lalu menghasilkan laporan warga + laporan teknis Dinas PUPR.

## Struktur Project

```
balicivic/
├── backend/          # FastAPI + AI pipeline (Python)
│   ├── main.py       # API endpoints (analyze, issues, stats, heatmap)
│   ├── utils.py      # YOLO detection, scoring, LLM report, email, geocoding
│   ├── models.py     # SQLModel: tabel `issue`
│   ├── database.py   # SQLite engine + session
│   ├── debug_model.py    # Script uji model YOLO
│   ├── migrate_timeline.py  # Migrasi 1x: kolom timeline
│   ├── requirements.txt
│   ├── .env          # API keys (jangan commit!)
│   ├── weights/      # Model YOLO (.pt)
│   │   ├── best.pt       # Model custom-trained (produksi)
│   │   └── yolo11s.pt    # Model fallback
│   ├── data/         # Database SQLite
│   │   └── balicivilai.db
│   └── uploads/      # Foto laporan + hasil annotate AI
└── frontend/         # Static HTML/JS (Tailwind + Leaflet)
    ├── index.html        # Landing page
    ├── report.html       # Form laporan warga
    ├── dashboard.html    # Dashboard monitoring
    ├── detail.html       # Detail laporan + analisis AI
    ├── all-reports.html  # Daftar laporan
    ├── heatmap.html      # Peta heatmap
    ├── admin.html        # Panel admin Dinas
    ├── help.html         # Bantuan/FAQ
    ├── config.js         # Tema + API base URL
    ├── app.json
    └── assets/       # Gambar & icon
```

## Cara Jalankan

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # isi API keys
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

Cukup serve folder `frontend/` secara statis (atau buka langsung),
semua file sudah mengarah ke `https://api.balicivicai.site`.

```bash
cd frontend
python -m http.server 8080
```

## API Endpoints

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/analyze` | Upload foto + koordinat (rate limit 5/menit) |
| GET | `/api/issues` | Semua laporan |
| GET | `/api/issues/{id}` | Detail laporan |
| PUT | `/api/issues/{id}/status` | Update status (admin) |
| GET | `/api/sumary` | Statistik dashboard |
| GET | `/api/distribution` | Distribusi jenis kerusakan |
| GET | `/api/top-locations` | Top 3 kabupaten |
| GET | `/api/heatmap` | Data titik peta |

## AI Pipeline

1. **YOLO** (`best.pt`) mendeteksi 4 kelas: `jalan_bolong`, `genangan`,
   `sampah_liar`, `kabel_semrawut`
2. **Scoring engine** menghitung skor 0–100 → severity LOW/MEDIUM/HIGH
3. **Estimasi geometri**: perkiraan lebar fisik (meter) + kategori jarak
4. **LLM** (Gemma via OpenRouter) menghasilkan laporan publik + laporan teknis Dinas
5. **Email alert** otomatis ke Dinas jika skor ≥ 60
6. **Reverse geocoding** (LocationIQ) → kecamatan/kabupaten

## Catatan Keamanan

- File `.env` berisi API keys dan TIDAK boleh di-commit ke git.
- Ganti token admin (`dinas_pupr_2025`) sebelum produksi.
- Ganti Gmail app password di `utils.py` sebelum produksi.
