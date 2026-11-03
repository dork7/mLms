// Runs the daily Fee Reminders job once: `npm run fee-reminders`. The `fee-reminders`
// Compose service runs it every day (ops/fee-reminders/run.sh). Running it more than once
// a day is safe: the log of reminders sent allows one per Fee Assignment per day.
import { systemClock } from "../src/core/clock";
import { sendDailyFeeReminders } from "../src/core/fees/fee-reminders";
import { consoleMailer, smtpMailer } from "../src/core/mailer";
import { createDb } from "../src/db/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url);
const mailer = process.env.SMTP_URL
  ? smtpMailer(process.env.SMTP_URL, process.env.MAIL_FROM ?? "School LMS <no-reply@localhost>")
  : consoleMailer();
try {
  const clock = systemClock();
  const result = await sendDailyFeeReminders({ db, clock, mailer });
  console.info(
    `${clock.today()} Fee Reminders: sent ${result.sent}, skipped (no email) ${result.noEmail}, ` +
      `already sent today ${result.alreadySentToday}, failed ${result.failed}`,
  );
  if (result.failed > 0) process.exitCode = 1;
} finally {
  await db.$client.end();
}
