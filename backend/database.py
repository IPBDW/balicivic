# database.py

import os
from sqlmodel import SQLModel, create_engine, Session

# import semua model supaya metadata-nya ter-register
from models import Issue  # tambahin model lain kalau ada

# Konfigurasi SQLite
DB_FILE = os.getenv("DB_FILE", os.path.join("data", "balicivilai.db"))
DATABASE_URL = f"sqlite:///{DB_FILE}"

# Engine global
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def create_db_and_tables():
    """
    Dipanggil sekali di startup untuk bikin tabel kalau belum ada.
    """
    SQLModel.metadata.create_all(engine)

def get_session():
    """
    Dependency FastAPI: yield Session ke endpoint.
    """
    with Session(engine) as session:
        yield session
