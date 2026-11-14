#!/usr/bin/env bash
# ============================================================
# BaliCivic AI — Matikan Service Lokal
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Mematikan service BaliCivic AI..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "uvicorn main:app" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true

read -r -p "Matikan PostgreSQL lokal juga? (y/N): " ans
if [[ "$ans" =~ ^[yY]$ ]]; then
  "$ROOT/backend/pg.sh" stop
else
  echo "PostgreSQL dibiarkan tetap aktif."
fi

echo "Selesai."
