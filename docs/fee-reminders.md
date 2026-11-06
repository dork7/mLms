# Fee Reminders

The `fee-reminders` service in `compose.yaml` runs `ops/fee-reminders/run.sh`, which runs `npm run fee-reminders` (`scripts/send-fee-reminders.ts`) when it starts and then once a day. The script calls `sendDailyFeeReminders` in `src/core/fees/fee-reminders.ts`, where the rules live and are tested.

- **What it sends:** an upcoming reminder once, from the lead time before the due date up to the due date, and an Overdue reminder on the first Overdue day and then every interval while it stays Overdue. Paid and Waived Fee Assignments get nothing. Students with no email are skipped and listed on the Admin's report at `/admin/fees/no-email`.
- **Timings:** set by the Admin on `/admin/fees` (default 7 days before, then every 7 days).
- **No duplicates:** every reminder is logged in `fee_reminder`, at most one per Fee Assignment per school day. Running the job again, restarting the service or a missed day never sends twice; a missed day is caught up with one reminder. The Admin's "Send reminders now" (on each Fee's page) is logged the same way.
- **Mail:** `SMTP_URL` and `MAIL_FROM`, as for the app. Without `SMTP_URL` the emails are only logged.
- **Settings:** `FEE_REMINDERS_INTERVAL_SECONDS` (default 86400). A failed run (database not migrated yet, SMTP down, an email refused) is retried after `FEE_REMINDERS_RETRY_SECONDS` (default 300). Refused emails aren't logged, so the retry sends them.
- **Logs:** `docker compose logs fee-reminders` shows one line per run with how many were sent, skipped for no email, already sent today and failed.

## Run it now

```sh
docker compose run --rm --entrypoint "npm run fee-reminders" fee-reminders
```
