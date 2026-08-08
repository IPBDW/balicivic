# AGENTS.md — Panduan untuk AI Agent

File ini dibaca oleh AI coding agents (Command Code, Claude Code, Cursor, dll.)
sebelum mulai bekerja di project ini. Ikuti semua aturan di bawah ini.

## Tentang Project

**BaliCivic AI** — sistem pelaporan kerusakan infrastruktur berbasis AI untuk
pemerintah Bali. Warga upload foto kerusakan (jalan bolong, genangan, sampah
liar, kabel semrawut), AI mendeteksi & memberi skor keparahan, lalu menghasilkan
laporan warga + laporan teknis Dinas PUPR.

## Struktur Folder

```
balicivic/
├── backend/          # FastAPI + AI pipeline (Python)
│   ├── main.py       # API endpoints
│   ├── utils.py      # YOLO, scoring, LLM, email, geocoding
│   ├── models.py     # SQLModel: tabel `issue`
│   ├── database.py   # SQLite
│   ├── debug_model.py
│   ├── migrate_timeline.py
│   ├── .env          # API keys — JANGAN DIMODIFIKASI/DICOMMIT
│   ├── weights/      # Model YOLO: best.pt (produksi), yolo11s.pt (fallback)
│   ├── data/         # Database SQLite: balicivilai.db
│   └── uploads/      # Foto laporan + hasil annotate
└── frontend/         # Static HTML/JS (Tailwind + Leaflet)
    ├── index.html, report.html, dashboard.html, detail.html
    ├── all-reports.html, heatmap.html, admin.html, help.html
    ├── config.js, app.json
    └── assets/       # Gambar & icon
```

## Cara Menjalankan

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (statis, panggil API via config.js)
cd frontend
python -m http.server 8080
```

## Konvensi Project

- **Bahasa**: UI, komentar kode, dan pesan (print/log) dalam Bahasa Indonesia.
- **Struktur**: backend tetap di `backend/`, frontend di `frontend/`.
- **Jangan sentuh**: file `.env` (berisi API keys), model weights (`*.pt`),
  database (`balicivilai.db`), dan isi `backend/uploads/` — ini data runtime.
- **Deduplikasi**: project ini dulu berantakan karena file duplikat. Jangan
  pernah bikin salinan folder/file yang tidak perlu.
- **Perubahan struktur**: kalau merubah path file, pastikan import di
  `main.py`/`utils.py` dan URL di frontend masih nyambung.

## ATURAN UTAMA: Belajar Gaya Coding User (WAJIB)

Setiap **setelah selesai** mengerjakan tugas, agent WAJIB melakukan ini:

1. **Refleksikan** sesi kerja: perhatikan koreksi, preferensi, atau gaya yang
   user tunjukkan — misalnya:
   - Bahasa yang dipakai (Indonesia informal dengan nada santai)
   - Gaya penulisan kode (naming, struktur, komentar)
   - Hal yang user suka/tidak suka (misal: tidak suka duplikasi, suka
     struktur rapi, suka verifikasi hasil)
2. **Catat** pelajaran itu sebagai preferensi yang bisa dipakai lagi:
   - Jika bekerja di **Command Code**: gunakan tool `taste` untuk menyimpan
     preferensi (JANGAN edit file taste manual).
   - Tool AI lain: catat di file catatan project atau konteks sesi.
3. **Terapkan** preferensi tersebut di tugas berikutnya — jangan menunggu
   dikoreksi dua kali untuk hal yang sama.
4. Jika user memberi koreksi, **anggap itu pelajaran**, bukan kritik — langsung
   sesuaikan dan ingat untuk tugas selanjutnya.

Tujuan: setiap sesi kerja, agent harus makin paham gaya dan keinginan user,
sehingga hasil kerja makin sesuai tanpa perlu banyak dikoreksi.
