# 21: Fee Reminders and the no-email report

**What to build:** Fee Reminders are emailed automatically to the Student's one email address, and the Admin can also send them on demand. Students with no email are listed in a report.

**Blocked by:** 18 (Fees and Payment Records)

**Status:** ready-for-agent

- [ ] A daily job sends a reminder a set number of days before the due date (default 7) and then at a set interval while Overdue (default every 7 days). Both timings are configurable school-wide
- [ ] A log of reminders sent prevents duplicate sends
- [ ] "Send reminders now" for a Fee uses the same path
- [ ] Students without an email are skipped
- [ ] The no-email report lists every Student with no email, with a column for whether they have an outstanding Fee
