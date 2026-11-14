#!/usr/bin/env bash
# ============================================================
# BaliCivic AI — Matikan Service Lokal
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Mematikan service BaliCivic AI..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "uvicorn main:app --host 127.0.0.1 --port 8000" 2>/dev/null || true

read -r -p "Matikan PostgreSQL lokal juga? (y/N): " ans
if [[ "$ans" =~ ^[yY]$ ]]; then
  "$ROOT/backend/pg.sh" stop
else
  echo "PostgreSQL dibiarkan tetap aktif."
fi

echo "Selesai."
