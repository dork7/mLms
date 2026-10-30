#!/bin/sh
# Backup/restore test: takes a backup of a throwaway Postgres with ops/backup/backup.sh,
# checks 30-day retention, restores it with ops/backup/restore.sh into a fresh database
# and checks that a known row survived. Needs Docker. Run: npm run test:backup
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ID=lms-backup-test-$$
NET=$ID-net
WORK=$(mktemp -d)
IMAGE=postgres:17-alpine

cleanup() {
  docker rm -f "$ID-db" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
days_ago() { date -v-"$1"d +%Y%m%d%H%M 2>/dev/null || date -d "$1 days ago" +%Y%m%d%H%M; }

docker network create "$NET" >/dev/null
docker run -d --name "$ID-db" --network "$NET" \
  -e POSTGRES_USER=lms -e POSTGRES_PASSWORD=lms -e POSTGRES_DB=lms "$IMAGE" >/dev/null
until docker exec "$ID-db" psql -U lms -d lms -c 'select 1' >/dev/null 2>&1; do sleep 1; done

psql_in() { docker exec -i "$ID-db" psql -U lms -v ON_ERROR_STOP=1 -tA "$@"; }
psql_in -d lms -c "CREATE TABLE known (id int primary key, name text); INSERT INTO known VALUES (1, 'survives-restore');" >/dev/null

# An expired backup (31 days old) and a recent one (29 days old) already in the directory.
mkdir -p "$WORK/backups"
touch -t "$(days_ago 31)" "$WORK/backups/lms-expired.dump"
touch -t "$(days_ago 29)" "$WORK/backups/lms-recent.dump"

run_tool() {
  docker run --rm --network "$NET" -v "$HERE:/ops:ro" -v "$WORK/backups:/backups" \
    -e PGHOST="$ID-db" -e PGUSER=lms -e PGPASSWORD=lms -e PGDATABASE=lms \
    -e BACKUP_DIR=/backups -e BACKUP_RETENTION_DAYS=30 "$IMAGE" "$@"
}

# 1. Take one backup.
run_tool sh /ops/backup.sh --once
DUMP=$(ls "$WORK/backups" | grep -v -e expired -e recent | head -n1 || true)
[ -n "$DUMP" ] || fail "no backup file written"
echo "backup written: $DUMP"

# 2. Retention.
[ ! -e "$WORK/backups/lms-expired.dump" ] || fail "31-day-old backup was not deleted"
[ -e "$WORK/backups/lms-recent.dump" ] || fail "29-day-old backup was deleted"
echo "retention: 31-day-old deleted, 29-day-old kept"

# 3. Restore into a fresh database and check the known row.
psql_in -d lms -c "CREATE DATABASE restored;" >/dev/null
run_tool env PGDATABASE=restored sh /ops/restore.sh "/backups/$DUMP"
GOT=$(psql_in -d restored -c "SELECT name FROM known WHERE id = 1;")
[ "$GOT" = "survives-restore" ] || fail "known row not restored (got '$GOT')"
echo "restore: known row survived"
echo "PASS"
