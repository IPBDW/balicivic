# Database & Migrasi — BaliCivic AI

Project ini memakai **SQLModel** sebagai ORM dan **Alembic** untuk migrasi skema.

## Ringkas

| Lingkungan | Database | Keterangan |
|---|---|---|
| Pengembangan | SQLite | Otomatis dipakai kalau `DATABASE_URL` kosong |
| Produksi (pemerintahan) | PostgreSQL | Set `DATABASE_URL` di `.env` |

Sumber kebenaran koneksi hanya satu: variabel `DATABASE_URL` di `.env`.
Baik app (`database.py`) maupun Alembic (`alembic/env.py`) membacanya dari sana.

## PostgreSQL Lokal Tanpa Install (portable)

Kalau belum/tidak mau install PostgreSQL system-wide (butuh sudo), ada
helper `pg.sh` yang menjalankan PostgreSQL **portable** (tanpa root):

```bash
cd backend

./pg.sh start     # nyalakan server (port 5432)
./pg.sh status    # cek status
./pg.sh stop      # matikan server
./pg.sh psql      # buka shell psql ke database balicivic
./pg.sh reset     # hapus & bikin ulang cluster (data hilang!)
```

- Binary & data disimpan di `~/.local/share/balicivic-pg/` (di luar repo).
- User default: `balicivic` / password `balicivic_dev` (ubah untuk produksi).
- `DATABASE_URL` yang cocok:

  ```
  DATABASE_URL=postgresql+psycopg://balicivic:balicivic_dev@localhost:5432/balicivic
  ```

> Jalankan `./pg.sh start` setiap kali mau pakai (server tidak auto-start).

## Setup PostgreSQL (system-wide, untuk produksi)

1. Install PostgreSQL, lalu buat user + database:

   ```sql
   CREATE USER balicivic WITH PASSWORD 'ganti_password_kuat';
   CREATE DATABASE balicivic OWNER balicivic;
   ```

2. Set di `.env`:

   ```
   DATABASE_URL=postgresql+psycopg://balicivic:ganti_password_kuat@localhost:5432/balicivic
   ```

3. Install dependensi & jalankan migrasi:

   ```bash
   pip install -r requirements.txt
   alembic upgrade head
   ```

## Perintah Alembic yang sering dipakai

```bash
# Terapkan semua migrasi
alembic upgrade head

# Lihat status migrasi saat ini
alembic current

# Lihat riwayat migrasi
alembic history

# Bikin migrasi baru setelah ubah models.py
alembic revision --autogenerate -m "tambah kolom xyz"

# Mundur satu langkah
alembic downgrade -1
```

> **Catatan:** selalu review file migrasi hasil `--autogenerate` sebelum
> `upgrade`. Alembic kadang belum mendeteksi rename kolom dengan benar.

## Pengembangan lokal dengan SQLite

Tidak perlu set apa pun. Kalau `DATABASE_URL` kosong, sistem otomatis
memakai `sqlite:///data/balicivilai.db`. Jalankan migrasi seperti biasa:

```bash
alembic upgrade head
```

## Migrasi data lama (SQLite -> PostgreSQL)

Kalau sudah punya data di SQLite dan mau pindah ke PostgreSQL:

1. Pastikan skema PostgreSQL sudah dibuat: `alembic upgrade head`.
2. Pindahkan data (contoh cepat pakai pandas/SQLAlchemy):

   ```python
   import pandas as pd
   from sqlalchemy import create_engine

   src = create_engine("sqlite:///data/balicivilai.db")
   dst = create_engine("postgresql+psycopg://balicivic:pass@localhost:5432/balicivic")
   df = pd.read_sql_table("issue", src)
   df.to_sql("issue", dst, if_exists="append", index=False)
   ```

3. Verifikasi jumlah baris di kedua sisi sebelum menghapus SQLite.

> Skrip `migrate_timeline.py` (cara lama) sudah tidak dipakai lagi — gunakan Alembic.
