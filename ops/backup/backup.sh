#!/bin/sh
# Daily Postgres backup with retention. Runs in the `backup` Compose service.
#   sh backup.sh          take a backup now, then one every BACKUP_INTERVAL_SECONDS (default 1 day)
#   sh backup.sh --once   take one backup and exit
# Connection comes from the libpq env vars (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
# Writes $BACKUP_DIR/<db>-<UTC timestamp>.dump (pg_dump custom format) and deletes
# backups older than BACKUP_RETENTION_DAYS (default 30).
set -eu
BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_INTERVAL_SECONDS=${BACKUP_INTERVAL_SECONDS:-86400}

backup_once() {
  mkdir -p "$BACKUP_DIR"
  name="$PGDATABASE-$(date -u +%Y%m%dT%H%M%SZ).dump"
  # Write to a temp name first so a half-written dump never looks like a backup.
  pg_dump --format=custom --no-owner --file="$BACKUP_DIR/.$name.partial"
  mv "$BACKUP_DIR/.$name.partial" "$BACKUP_DIR/$name"
  echo "$(date -u +%FT%TZ) backup written: $BACKUP_DIR/$name"
  find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f \
    -mmin +"$((BACKUP_RETENTION_DAYS * 24 * 60))" -print -delete \
    | sed 's/^/expired backup deleted: /'
}

if [ "${1:-}" = "--once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "$(date -u +%FT%TZ) backup FAILED" >&2
  sleep "$BACKUP_INTERVAL_SECONDS"
done
