#!/usr/bin/env bash
# ============================================================
# BaliCivic AI — PostgreSQL portable helper
# Jalankan PostgreSQL lokal tanpa install system-wide / sudo.
#
# Pemakaian:
#   ./pg.sh start     -> nyalakan server
#   ./pg.sh stop      -> matikan server
#   ./pg.sh status    -> cek status
#   ./pg.sh psql      -> buka shell psql ke database balicivic
#   ./pg.sh reset     -> hapus & bikin ulang cluster (HATI-HATI: data hilang)
# ============================================================
set -euo pipefail

PGHOME="${BALICIVIC_PGHOME:-$HOME/.local/share/balicivic-pg}"
PGROOT="$PGHOME/root/usr/lib/postgresql/18"
PGBIN="$PGROOT/bin"
PGDATA="$PGHOME/data"
PGPORT="${BALICIVIC_PGPORT:-5432}"
PGLOG="$PGHOME/postgres.log"
PGSOCK="$PGHOME/sock"

export LD_LIBRARY_PATH="$PGROOT/lib:$PGHOME/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"

mkdir -p "$PGSOCK"

cmd="${1:-help}"

case "$cmd" in
  start)
    if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
      echo "PostgreSQL sudah jalan (port $PGPORT)."
    else
      "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" -o "-p $PGPORT -k $PGSOCK" start
      echo "PostgreSQL jalan di port $PGPORT."
    fi
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$PGDATA" stop || true
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$PGDATA" status || true
    ;;
  psql)
    shift
    "$PGBIN/psql" -h "$PGSOCK" -p "$PGPORT" -U balicivic -d balicivic "$@"
    ;;
  reset)
    read -r -p "Hapus SEMUA data di $PGDATA? (ketik 'ya' untuk lanjut): " ans
    if [ "$ans" = "ya" ]; then
      "$PGBIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 || true
      rm -rf "$PGDATA"
      "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
      "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" -o "-p $PGPORT -k $PGSOCK" start
      "$PGBIN/psql" -h "$PGSOCK" -p "$PGPORT" -U postgres -c \
        "CREATE USER balicivic WITH PASSWORD 'balicivic_dev';" \
        -c "CREATE DATABASE balicivic OWNER balicivic;"
      echo "Cluster baru siap."
    else
      echo "Dibatalkan."
    fi
    ;;
  *)
    echo "Pemakaian: $0 {start|stop|status|psql|reset}"
    ;;
esac
