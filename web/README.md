# BaliCivic AI — Modul Frontend (Web)

Bagian ini merupakan antarmuka web publik dan panel pemantauan berbasis **Next.js 16** (React 19, Tailwind CSS, App Router) untuk sistem **BaliCivic AI**.

## Fitur & Halaman

- **Halaman Utama (`/`)**: Pengenalan platform, panduan alur pelaporan tiga langkah, statistik ringkas, dan ajakan pelaporan fasilitas umum.
- **Formulir Pelaporan (`/lapor`)**: Unggah foto kerusakan, penentuan koordinat geografis otomatis berbasis GPS peramban, serta pratinjau deteksi instan.
- **Dashboard Pemantauan (`/dashboard`)**: Metrik agregasi kerusakan, grafik distribusi kategori masalah, dan daftar isu terkini.
- **Peta Kerusakan Interaktif (`/peta`)**: Pemetaan spasial titik lokasi kerusakan se-Bali dengan visualisasi status penanganan.
- **Arsip Laporan Publik (`/laporan`)**: Daftar riwayat seluruh laporan masyarakat dengan fitur pencarian dan filter status.
- **Detail Laporan (`/detail/[id]`)**: Informasi komprehensif sebuah laporan, visualisasi *bounding box* hasil deteksi model AI, estimasi dimensi fisik, serta rekomendasi teknis PUPR.
- **Panel Administrator (`/admin`)**: Area kerja terproteksi untuk validasi dan pembaruan status laporan oleh dinas terkait.
- **Panduan Penggunaan (`/panduan`)**: Instruksi langkah demi langkah tata cara pengambilan foto dan pelaporan yang baik bagi warga.
- **Pusat Bantuan (`/bantuan`)**: Informasi FAQ dan kontak layanan pengaduan.

## Prasyarat

- Node.js versi 18.18 atau lebih baru (disarankan Node.js 20 LTS)
- npm / yarn / pnpm

## Panduan Memulai

1. Pasang dependensi:
   ```bash
   npm install
   ```

2. Konfigurasi variabel lingkungan (wajib):
   ```bash
   cp .env.example .env.local
   ```
   Variabel yang tersedia:
   - `NEXT_PUBLIC_API_BASE`: URL server backend FastAPI (contoh: `http://127.0.0.1:8000`). Wajib diisi — frontend tidak menyediakan data contoh.

3. Jalankan server pengembang:
   ```bash
   npm run dev
   ```
   Akses antarmuka di `http://localhost:3000`.

4. Pembuatan build produksi:
   ```bash
   npm run build
   npm run start
   ```
