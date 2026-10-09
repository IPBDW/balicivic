# database.py

import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

# import semua model supaya metadata-nya ter-register
from models import Issue  # tambahin model lain kalau ada

load_dotenv()

# ============================================================
# KONFIGURASI DATABASE
# ============================================================
# Produksi (pemerintahan): PostgreSQL
#   DATABASE_URL=postgresql+psycopg://user:pass@host:5432/balicivic
# Pengembangan lokal: SQLite (fallback kalau DATABASE_URL kosong)
#   sqlite:///data/balicivilai.db
DEFAULT_SQLITE = "sqlite:///" + os.path.join("data", "balicivilai.db")
DATABASE_URL = os.getenv("DATABASE_URL") or DEFAULT_SQLITE

# Pastikan folder data ada kalau pakai SQLite
if DATABASE_URL.startswith("sqlite"):
    os.makedirs("data", exist_ok=True)
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

# Engine global
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


def create_db_and_tables():
    """
    Dipanggil sekali di startup untuk bikin tabel kalau belum ada.
    Untuk perubahan skema di produksi, gunakan Alembic (lihat alembic/).
    """
    SQLModel.metadata.create_all(engine)


def get_session():
    """
    Dependency FastAPI: yield Session ke endpoint.
    """
    with Session(engine) as session:
        yield session
