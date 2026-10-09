# BaliCivic AI

Sistem pelaporan kerusakan infrastruktur berbasis AI untuk pemerintah (Bali).
Warga mengirim foto + lokasi kerusakan, sistem mendeteksi jenis & tingkat
keparahan otomatis, lalu menghasilkan laporan warga + laporan teknis Dinas PUPR.

## Struktur Project

```
balicivic/
├── backend/          # FastAPI + AI pipeline (Python)
│   ├── main.py       # API endpoints (analyze, issues, stats, heatmap, admin)
│   ├── utils.py      # YOLO detection, scoring, LLM report, email, geocoding
│   ├── models.py     # SQLModel: tabel `issue`
│   ├── database.py   # Engine DB (PostgreSQL / SQLite)
│   ├── alembic/      # Migrasi skema database
│   ├── alembic.ini
│   ├── DATABASE.md   # Panduan database & migrasi
│   ├── debug_model.py       # Script uji model YOLO
│   ├── requirements.txt
│   ├── .env.example  # Template env (copy jadi .env)
│   ├── weights/      # Model YOLO (.pt)
│   │   ├── best.pt       # Model custom-trained (produksi)
│   │   └── yolo11s.pt    # Model fallback
│   ├── data/         # Database SQLite (mode dev)
│   └── uploads/      # Foto laporan + hasil annotate AI
└── web/              # Frontend Next.js 16 (React + Tailwind)
    ├── app/          # Halaman: /, /dashboard, /lapor, /laporan, /peta,
    │                 #          /detail/[id], /admin, /bantuan
    ├── components/   # NavbarApp, BottomNav
    ├── lib/api.js    # Satu pintu akses API
    └── public/assets/
```

> **Catatan:** folder `frontend/` (HTML statis versi lama) sudah dihapus.
> Sekarang hanya ada satu frontend: `web/` (Next.js).

## Cara Jalankan

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # lalu isi API keys & ADMIN_TOKEN

# Nyalakan PostgreSQL lokal (portable, tanpa sudo):
./pg.sh start

alembic upgrade head          # siapkan skema database
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Next.js)

```bash
cd web
npm install
npm run dev                   # http://localhost:3000
```

Atur URL API lewat env (opsional, default `http://127.0.0.1:8000`):

```bash
# web/.env.local
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

## API Endpoints

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/analyze` | Upload foto + koordinat (rate limit 5/menit) |
| GET | `/api/issues` | Semua laporan |
| GET | `/api/issues/{id}` | Detail laporan |
| PUT | `/api/issues/{id}/status` | Update status (admin, butuh token) |
| GET | `/api/admin/verify` | Verifikasi token admin |
| GET | `/api/sumary` `/api/summary` | Statistik dashboard |
| GET | `/api/distribution` | Distribusi jenis kerusakan |
| GET | `/api/top-locations` | Top 3 kabupaten |
| GET | `/api/heatmap` | Data titik peta |

## AI Pipeline

1. **YOLO** (`best.pt`) mendeteksi 4 kelas: `jalan_bolong`, `genangan_air`,
   `sampah_liar`, `kabel_semrawut`
2. **Scoring engine** menghitung skor 0–100 → severity LOW/MEDIUM/HIGH
3. **Estimasi geometri**: perkiraan lebar fisik (meter) + kategori jarak
4. **LLM** (DeepSeek via API OpenAI-compatible) menghasilkan laporan publik +
   laporan teknis Dinas
5. **Email alert** otomatis ke Dinas jika skor ≥ 60
6. **Reverse geocoding** (LocationIQ) → kecamatan/kabupaten

## Catatan Keamanan

- File `.env` berisi API keys dan TIDAK boleh di-commit ke git.
- **Token admin** (`ADMIN_TOKEN`) wajib diisi di `.env`. Tidak ada token default
  di source code. Bikin yang acak:
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
- **CORS** dibatasi lewat `CORS_ORIGINS` di `.env`. Isi domain resmi sebelum
  produksi (jangan `*`).
- Ganti Gmail app password di `.env` (`SMTP_APP_PASSWORD`) sebelum produksi.
- Database produksi pakai PostgreSQL (`DATABASE_URL`), bukan SQLite.

## Lisensi & Etika Data

Seluruh citra difokuskan pada infrastruktur publik. Wajah & data pribadi
disamarkan sesuai etika AI dan UU PDP No. 27/2022.
