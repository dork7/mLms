#!/bin/sh
# Sends the daily Fee Reminders. Runs in the `fee-reminders` Compose service.
#   sh run.sh   run now, then every FEE_REMINDERS_INTERVAL_SECONDS (default 1 day)
# A failed run (the database not migrated yet, SMTP down, an email refused) is tried again
# after FEE_REMINDERS_RETRY_SECONDS (default 5 minutes). Running again the same day is
# safe: the log of reminders sent allows one per Fee Assignment per day.
set -u
FEE_REMINDERS_INTERVAL_SECONDS=${FEE_REMINDERS_INTERVAL_SECONDS:-86400}
FEE_REMINDERS_RETRY_SECONDS=${FEE_REMINDERS_RETRY_SECONDS:-300}

while true; do
  if npm run --silent fee-reminders; then
    sleep "$FEE_REMINDERS_INTERVAL_SECONDS"
  else
    echo "$(date -u +%FT%TZ) Fee Reminders FAILED; retrying in ${FEE_REMINDERS_RETRY_SECONDS}s" >&2
    sleep "$FEE_REMINDERS_RETRY_SECONDS"
  fi
done
