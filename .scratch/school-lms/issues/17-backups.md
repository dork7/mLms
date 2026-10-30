# 17: Backups

**What to build:** The database is backed up every day and backups are kept for 30 days, with a restore that has been tested.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-agent

- [ ] A Docker Compose service takes a daily Postgres backup
- [ ] Backups older than 30 days are deleted
- [ ] The restore procedure is written down and has been tested once
