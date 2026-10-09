import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv
from sqlmodel import SQLModel

# Pastikan folder backend ada di sys.path biar `models` & `database` bisa diimport
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

# Import model supaya metadata ter-register ke SQLModel.metadata
from models import Issue  # noqa: F401
from database import DATABASE_URL  # noqa: F401  (sumber URL yang sama dengan app)

# Alembic Config object
config = context.config

# Override sqlalchemy.url dari env (satu sumber kebenaran: DATABASE_URL)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata target untuk autogenerate
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Jalankan migrasi dalam mode 'offline' (tanpa koneksi DB)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # penting untuk SQLite (ALTER TABLE terbatas)
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Jalankan migrasi dalam mode 'online' (dengan koneksi DB)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # penting untuk SQLite (ALTER TABLE terbatas)
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
