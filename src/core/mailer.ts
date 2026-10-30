// The Mailer is the only way the application layer sends email.
import nodemailer from "nodemailer";

export type Email = { to: string; subject: string; text: string };

export type Mailer = { send(email: Email): Promise<void> };

/** Sends over SMTP, e.g. smtp://user:pass@host:587. Used in production. */
export function smtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(email) {
      await transport.sendMail({ from, ...email });
    },
  };
}

/** Logs instead of sending. Used in dev when no SMTP_URL is set. */
export function consoleMailer(): Mailer {
  return {
    async send(email) {
      console.info(`[mail] to=${email.to} subject=${email.subject}\n${email.text}`);
    },
  };
}

/** Records messages instead of sending. Used in tests: assert on `.sent`. */
export function recordingMailer() {
  const sent: Email[] = [];
  return {
    sent,
    async send(email: Email) {
      sent.push(email);
    },
  } satisfies Mailer & { sent: Email[] };
}
