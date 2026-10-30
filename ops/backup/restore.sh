#!/bin/sh
# Restore a backup written by backup.sh into the database named by PGDATABASE.
#   sh restore.sh /backups/lms-20261030T020000Z.dump
# Connection comes from the libpq env vars (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
# Objects that already exist are dropped and recreated (--clean --if-exists).
# Stop the app first so nothing writes during the restore. See docs/backups.md.
set -eu
[ $# -eq 1 ] || { echo "usage: restore.sh <backup.dump>" >&2; exit 2; }
pg_restore --clean --if-exists --no-owner --exit-on-error --single-transaction \
  --dbname="$PGDATABASE" "$1"
echo "restored $1 into $PGDATABASE"
