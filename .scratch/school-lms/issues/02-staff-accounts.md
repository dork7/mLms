# 02: Staff accounts

**What to build:** The Admin creates Teacher accounts. Teachers log in with their email or phone and a password, must change their password on first login, and can reset a forgotten password. The Admin can disable a staff login without losing the person's records.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-agent

- [ ] The Admin creates a Teacher with a name and an email or phone. A duplicate email or phone is refused
- [ ] A Teacher logs in with email or phone, and is forced to change the initial password on first login
- [ ] Forgotten-password reset works by email through the Mailer
- [ ] A disabled Teacher can't log in, and their data is kept
- [ ] Sessions time out, and repeated failed logins are rate-limited
- [ ] Only an Admin can create or disable accounts
