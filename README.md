# BaliCivic AI

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![YOLOv11](https://img.shields.io/badge/YOLO-v11-orange.svg)](https://docs.ultralytics.com/)

**BaliCivic AI** adalah platform pelaporan dan pemantauan kerusakan infrastruktur publik berbasis kecerdasan buatan (*artificial intelligence*) yang dirancang untuk wilayah Provinsi Bali. Melalui platform ini, masyarakat dapat melaporkan kerusakan fasilitas umum secara terukur dan transparan, sementara instansi terkait (seperti Dinas Pekerjaan Umum dan Penataan Ruang) menerima analisis teknis otomatis untuk memprioritaskan penanganan di lapangan.

---

## Daftar Isi
- [Latar Belakang](#latar-belakang)
- [Fitur Utama](#fitur-utama)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Struktur Direktori](#struktur-direktori)
- [Prasyarat Sistem](#prasyarat-sistem)
- [Panduan Instalasi & Menjalankan](#panduan-instalasi--menjalankan)
  - [1. Backend (FastAPI)](#1-backend-fastapi)
  - [2. Frontend (Next.js)](#2-frontend-nextjs)
- [Konfigurasi Lingkungan (.env)](#konfigurasi-lingkungan-env)
- [Dokumentasi API Endpoints](#dokumentasi-api-endpoints)
- [Alur Kerja Pipeline AI](#alur-kerja-pipeline-ai)
- [Keamanan & Etika Data](#keamanan--etika-data)
- [Lisensi & Hak Cipta](#lisensi--hak-cipta)

---

## Latar Belakang

Penanganan kerusakan infrastruktur publik di daerah kerap menghadapi kendala pada proses pelaporan manual yang belum terstandarisasi, penilaian tingkat keparahan yang bersifat subjektif, serta keterbatasan kecepatan distribusi informasi kepada unit teknis lapangan.

BaliCivic AI mengotomatisasi rantai pelaporan tersebut: citra kerusakan diidentifikasi secara objektif menggunakan visi komputer (*computer vision*), diestimasi dimensi fisiknya, dihitung skor keparahannya, dan secara otomatis dirangkum menjadi dokumen laporan teknis kesiapan tindak lanjut bagi dinas terkait.

---

## Fitur Utama

- **Deteksi Objek Otomatis (YOLOv11)**: Mengenali empat kategori kerusakan infrastruktur utama secara simultan: jalan berlubang (*potholes*), genangan air, pembuangan sampah liar, dan kabel utilitas semrawut.
- **Estimasi Dimensi & Tingkat Keparahan**: Memperkirakan dimensi lebar fisik (meter), kategori jarak objek, serta menghitung skor keparahan terpadu (skala 0–100) berkategori *Rendah (LOW)*, *Sedang (MEDIUM)*, atau *Tinggi (HIGH)*.
- **Penyusunan Laporan Otomatis via LLM**: Merumuskan ringkasan deskriptif bagi pelapor publik serta rancangan dokumen teknis resmi untuk Dinas PUPR secara otomatis memanfaatkan model bahasa (*OpenAI-compatible* / DeepSeek).
- **Geocoding & Geofencing Terintegrasi**: Memetakan titik koordinat GPS ke tingkat kelurahan/kecamatan/kabupaten se-Bali secara otomatis serta memastikan setiap laporan berada dalam batas administratif wilayah Provinsi Bali.
- **Visualisasi Spasial & Heatmap Interaktif**: Menampilkan persebaran laporan kerusakan secara *real-time* berbasis peta interaktif dengan visualisasi klaster dan densitas titik kerawanan.
- **Sistem Notifikasi Darurat**: Pengiriman surel otomatis kepada dinas teknis terkait apabila skor keparahan kerusakan tergolong kritis (skor $\ge 60$).
- **Panel Manajemen Laporan**: Antarmuka terverifikasi bagi administrator untuk memantau, memvalidasi, memperbarui status penanganan, atau memproses tindak lanjut laporan.

---

## Arsitektur Sistem

- **Backend**: Python 3, FastAPI, SQLModel, PostgreSQL (didukung SQLite untuk kebutuhan pengujian lokal), Alembic (migrasi skema database).
- **Vision & AI Pipeline**: Ultralytics YOLOv11 (PyTorch), OpenCV, Pillow.
- **Frontend**: Next.js 16 (React 19, App Router, Turbopack), Tailwind CSS, Leaflet.
- **Integrasi Eksternal**: LocationIQ API (Reverse Geocoding), LLM API (OpenAI-compatible / DeepSeek), SMTP Gateway.

---

## Struktur Direktori

```
balicivic/
├── backend/                  # Layanan API dan pipeline pemrosesan AI
│   ├── alembic/              # Skrip migrasi skema database
│   ├── alembic.ini           # Berkas konfigurasi Alembic
│   ├── database.py           # Inisialisasi koneksi engine database
│   ├── main.py               # Definisi router API FastAPI
│   ├── models.py             # Definisi skema tabel data (SQLModel)
│   ├── pg.sh                 # Skrip pembantu PostgreSQL lokal (portable)
│   ├── requirements.txt      # Daftar dependensi pustaka Python
│   ├── test_smoke.py         # Skrip pengujian otomatis (pytest)
│   ├── utils.py              # Logika YOLO, scoring, LLM, geocoding & email
│   ├── weights/              # Berkas bobot model AI (best.pt / yolo11s.pt)
│   ├── data/                 # Penyimpanan SQLite lokal (mode pengembangan)
│   └── uploads/              # Penyimpanan gambar laporan & visualisasi deteksi
└── web/                      # Antarmuka web Next.js 16
    ├── app/                  # Rute aplikasi (Dashboard, Lapor, Peta, Detail, Admin, Panduan)
    ├── components/           # Komponen UI bersama (Navbar, BottomNav)
    ├── lib/                  # Helper fungsi API, format waktu, dan kalkulasi keparahan
    └── public/               # Aset statis aplikasi
```

---

## Prasyarat Sistem

Sebelum memulai instalasi, pastikan sistem Anda telah memenuhi prasyarat berikut:
- **Python** versi 3.10 atau yang lebih baru
- **Node.js** versi 18.18+ (disarankan versi LTS) dan paket manajer **npm**
- **Git**
- Akses jaringan untuk pengunduhan paket dependensi dan integrasi layanan eksternal (LocationIQ dan API LLM)

---

## Panduan Instalasi & Menjalankan

### 1. Backend (FastAPI)

1. Buka terminal dan masuk ke direktori backend:
   ```bash
   cd backend
   ```

2. Buat dan aktifkan virtual environment Python:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Untuk Linux / macOS
   # .venv\Scripts\activate   # Untuk Windows PowerShell
   ```

3. Pasang seluruh dependensi:
   ```bash
   pip install -r requirements.txt
   ```

4. Siapkan konfigurasi variabel lingkungan:
   ```bash
   cp .env.example .env
   ```
   *(Buka berkas `.env` dan lengkapi kunci API serta token yang diperlukan)*

5. Siapkan basis data dan jalankan migrasi skema:
   ```bash
   # Opsi A: Menggunakan PostgreSQL lokal portable (Linux)
   ./pg.sh start
   alembic upgrade head

   # Opsi B: Menggunakan SQLite (DATABASE_URL=sqlite:///data/balicivic.db di .env)
   alembic upgrade head
   ```

6. Jalankan server pengembang FastAPI:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Layanan API akan aktif pada `http://127.0.0.1:8000`. Dokumentasi interaktif Swagger UI dapat diakses langsung melalui `http://127.0.0.1:8000/docs`.

### 2. Frontend (Next.js)

1. Buka terminal baru dan arahkan ke direktori frontend:
   ```bash
   cd web
   ```

2. Pasang seluruh dependensi Node.js:
   ```bash
   npm install
   ```

3. *(Opsional)* Sesuaikan titik akhir API backend jika berjalan di alamat berbeda:
   ```bash
   cp .env.example .env.local
   # Pastikan NEXT_PUBLIC_API_BASE mengarah ke URL FastAPI (default: http://127.0.0.1:8000)
   ```

4. Jalankan server pengembang Next.js:
   ```bash
   npm run dev
   ```
   Aplikasi web dapat diakses melalui peramban di `http://localhost:3000`.

---

## Konfigurasi Lingkungan (.env)

Berikut adalah variabel lingkungan utama yang dikonfigurasikan pada `backend/.env`:

| Variabel | Deskripsi | Contoh Nilai |
|---|---|---|
| `ADMIN_TOKEN` | Token otentikasi administrator (*Wajib diisi secara aman*) | `rahasia_admin_token_acak` |
| `DATABASE_URL` | URL koneksi basis data (PostgreSQL atau SQLite) | `postgresql://user:pass@localhost:5432/balicivic` |
| `LOCATIONIQ_API_KEY` | Kunci API LocationIQ untuk layanan reverse geocoding | `pk.xxxxxxxxxxxxxxxxxxxx` |
| `LLM_API_KEY` / `API_KEY` | Kunci otentikasi layanan model bahasa (OpenAI / DeepSeek) | `sk-xxxxxxxxxxxxxxxxxxxx` |
| `LLM_BASE_URL` / `ENDPOINT` | URL titik akhir (*endpoint*) API LLM | `https://api.deepseek.com/v1` |
| `LLM_MODEL` / `NAME_MODEL` | Identifikasi model LLM yang digunakan | `deepseek-chat` |
| `CORS_ORIGINS` | Asal domain frontend yang diizinkan (pisahkan dengan koma) | `http://localhost:3000` |
| `SMTP_EMAIL` | Alamat surel pengirim notifikasi peringatan | `notifikasi@instansi.go.id` |
| `SMTP_APP_PASSWORD` | Kata sandi aplikasi surel pengirim | `xxxx xxxx xxxx xxxx` |
| `DISPATCH_EMAIL_PU` | Alamat surel tujuan dinas teknis penerima laporan | `pupr@baliprov.go.id` |

---

## Dokumentasi API Endpoints

| Metode | Titik Akhir (*Endpoint*) | Deskripsi Fungsi | Otorisasi |
|---|---|---|---|
| `GET` | `/health` | Pemeriksaan status kesiapan layanan (*health check*) | Publik |
| `POST` | `/api/analyze` | Menerima unggahan citra kerusakan dan koordinat lokasi (rate limit 5 req/menit) | Publik |
| `GET` | `/api/issues` | Menampilkan daftar laporan dengan dukungan filter status, kategori, dan paginasi | Publik |
| `GET` | `/api/issues/count` | Mengambil total kuantitas laporan berdasarkan kriteria filter | Publik |
| `GET` | `/api/issues/{id}` | Mengambil informasi detail lengkap sebuah laporan spesifik | Publik |
| `PUT` | `/api/issues/{id}/status` | Memperbarui status penanganan laporan (`menunggu`, `diproses`, `selesai`, `dibatalkan`) | Bearer Token Admin |
| `DELETE` | `/api/issues/{id}` | Menghapus arsip laporan yang berstatus dibatalkan | Bearer Token Admin |
| `GET` | `/api/admin/verify` | Memvalidasi keabsahan token otentikasi administrator | Bearer Token Admin |
| `GET` | `/api/summary` | Menyajikan ringkasan metrik statistik laporan | Publik |
| `GET` | `/api/distribution` | Menyajikan data distribusi laporan menurut kategori kerusakan | Publik |
| `GET` | `/api/top-locations` | Menyajikan daftar peringkat wilayah/kabupaten dengan laporan terbanyak | Publik |
| `GET` | `/api/heatmap` | Menyajikan koordinat spasial untuk visualisasi titik peta | Publik |

---

## Alur Kerja Pipeline AI

```
[Unggah Foto & Koordinat GPS]
              │
              ▼
[Validasi Batas Wilayah & Sanitasi] ──(Di Luar Bali)──> [Ditolak / 400 Bad Request]
              │
              ▼
[Inferensi YOLOv11 (best.pt)] ───────> [Bounding Box, Kelas & Skor Keyakinan]
              │
              ▼
[Estimasi Dimensi & Geometri] ───────> [Lebar Fisik Objek (m) & Kategori Jarak]
              │
              ▼
[Kalkulasi Skor Keparahan] ──────────> [Skor Terpadu 0–100 & Kategori Severity]
              │
              ▼
[Reverse Geocoding LocationIQ] ──────> [Data Administratif: Banjar, Desa, Kecamatan, Kabupaten]
              │
              ▼
[Sintesis Laporan via LLM] ──────────> [Laporan Publik & Ringkasan Teknis Dinas PUPR]
              │
              ├──(Skor >= 60)────────> [Notifikasi Surel Otomatis ke Dinas Terkait]
              ▼
[Penyimpanan Basis Data & Visualisasi Peta]
```

---

## Keamanan & Etika Data

1. **Privasi Citra Publik**: Pemrosesan visual ditujukan khusus pada fasilitas dan infrastruktur umum. Metadata pelacak pribadi (seperti EXIF GPS pada berkas mentah) dibersihkan dari berkas yang dipublikasikan.
2. **Kredensial dan Token**: Hindari mempublikasikan berkas `.env`, kredensial database, atau token admin ke dalam sistem kontrol versi (*version control*). Gunakan nilai rahasia acak berkeamanan tinggi untuk konfigurasi `ADMIN_TOKEN`.
3. **Validasi Geografis (*Geofencing*)**: Setiap laporan divalidasi berdasarkan batas geografis Provinsi Bali untuk menjaga relevansi operasional penanganan dan mencegah data anomali.

---

## Lisensi & Hak Cipta

Proyek ini didistribusikan di bawah ketentuan lisensi **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Hak Cipta &copy; 2025 **I Putu Rio Ferdinand Satya Utama** & **I Putu Bagus Dharma Wijaya**.

### Pokok Ketentuan Lisensi:
- **Hak Penggunaan**: Setiap pihak diperkenankan menelaah, memodifikasi, dan mendistribusikan ulang kode sumber ini untuk keperluan pendidikan, penelitian, maupun operasional publik.
- **Kewajiban Resiprok (*Copyleft*)**: Apabila Anda memodifikasi atau memanfaatkan perangkat lunak ini dalam bentuk layanan jaringan/web (SaaS), Anda **wajib** merilis seluruh kode sumber modifikasi tersebut di bawah lisensi yang setara (AGPL-3.0).
- **Atribusi Hak Cipta**: Wajib menyertakan pemberitahuan hak cipta asli dan salinan lisensi pada setiap distribusi turunan.
- **Transparansi**: Kode sumber turunan tidak diperkenankan ditutup menjadi perangkat lunak berpemilik (*proprietary/closed-source*).

Naskah lengkap lisensi resmi dapat ditelaah pada berkas [LICENSE](./LICENSE) atau melalui [GNU Operating System](https://www.gnu.org/licenses/agpl-3.0).
