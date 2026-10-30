# Database backups

The `backup` service in `compose.yaml` runs `ops/backup/backup.sh`. It takes a `pg_dump` (custom format) of the `lms` database when it starts and then once a day. Each run deletes backups older than 30 days.

- **Where:** the `backups` named volume by default. To write to a host directory instead (for example one that is synced off the VPS), set `BACKUP_HOST_DIR=/srv/lms-backups` (an absolute path) before `docker compose up`.
- **Files:** `lms-<UTC timestamp>.dump`, for example `lms-20261030T020000Z.dump`.
- **Settings:** `BACKUP_RETENTION_DAYS` (default 30) and `BACKUP_INTERVAL_SECONDS` (default 86400).
- **Logs:** `docker compose logs backup` shows each backup and each expired backup that was deleted. A failed run logs `backup FAILED`, and the service tries again at the next interval.

## Take a backup now

```sh
docker compose run --rm --entrypoint "sh /ops/backup.sh --once" backup
docker compose run --rm --entrypoint "ls -l /backups" backup   # list backups
```

## Restore

The restore replaces the contents of the `lms` database with the backup.

```sh
docker compose stop app                       # nothing writes during the restore
docker compose run --rm --entrypoint "sh /ops/restore.sh /backups/lms-20261030T020000Z.dump" backup
docker compose start app
```

`restore.sh` runs `pg_restore --clean --if-exists --single-transaction`, so a failed restore leaves the database as it was. To restore into a different database (to inspect a backup without touching live data), create the database first and pass `-e PGDATABASE=<name>` to `docker compose run`.

To copy a backup off the named volume: `docker compose cp backup:/backups/<file> .` works only while the service is running. The alternative is `docker run --rm -v <project>_backups:/b -v "$PWD":/out alpine cp /b/<file> /out/`.

## Tested

- `npm run test:backup` (needs Docker) takes a backup of a throwaway Postgres, checks that a 31-day-old backup is deleted and a 29-day-old one is kept, restores into a fresh database and checks that a known row survived.
- On 2026-10-30 a restore was done against the full Compose stack. The steps were: start the stack, take a backup, delete the seeded Admin, restore with the steps above, confirm the Admin was back.
