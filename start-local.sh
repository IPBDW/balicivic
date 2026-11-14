#!/usr/bin/env bash
# ============================================================
# BaliCivic AI — Jalankan Fullstack Lokal (DB + Backend + Frontend)
#
# Pemakaian:
#   ./start-local.sh         -> jalankan production-optimized lokal di background
#   ./start-local.sh --dev   -> jalankan frontend mode DEV (hot-reload di foreground)
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Memulai BaliCivic AI (Lokal) ==="

# 1. PostgreSQL
echo "[1/3] Menyalakan PostgreSQL lokal..."
"$ROOT/backend/pg.sh" start

# 2. Backend FastAPI
echo "[2/3] Memeriksa Backend FastAPI (:8000)..."
if ! curl -s -m 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  cd "$ROOT/backend"
  source .venv/bin/activate
  setsid nohup python -m uvicorn main:app --host 127.0.0.1 --port 8000 \
    > "$ROOT/backend/uvicorn.log" 2>&1 < /dev/null &
  for _ in $(seq 1 30); do
    curl -s -m 2 http://127.0.0.1:8000/health >/dev/null 2>&1 && break
    sleep 1
  done
  echo "Backend siap di http://localhost:8000"
else
  echo "Backend sudah aktif di http://localhost:8000"
fi

# 3. Frontend Next.js
echo "[3/3] Memeriksa Frontend Next.js (:3000)..."
cd "$ROOT/web"
MODE="${1:-}"

if [ "$MODE" = "--dev" ]; then
  echo "Menjalankan frontend mode DEV (tekan Ctrl+C untuk berhenti)..."
  npm run dev
else
  if ! curl -s -m 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    if [ ! -d .next/BUILD_ID ]; then
      echo "Building frontend Next.js..."
      npm run build
    fi
    setsid nohup npm run start -- -H 127.0.0.1 -p 3000 \
      > "$ROOT/web/next.log" 2>&1 < /dev/null &
    for _ in $(seq 1 30); do
      curl -s -m 2 http://127.0.0.1:3000/ >/dev/null 2>&1 && break
      sleep 1
    done
    echo "Frontend siap di http://localhost:3000"
  else
    echo "Frontend sudah aktif di http://localhost:3000"
  fi

  echo
  echo "=========================================="
  echo " BaliCivic AI aktif di lokal!"
  echo " - Web App       : http://localhost:3000"
  echo " - Dashboard     : http://localhost:3000/dashboard"
  echo " - Peta Sebaran  : http://localhost:3000/peta"
  echo " - Form Lapor    : http://localhost:3000/lapor"
  echo " - API Docs      : http://localhost:8000/docs"
  echo "=========================================="
  echo "Untuk mematikan: ./stop-local.sh"
fi
