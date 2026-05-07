// Forward-looking Resend wrapper. Nothing imports this yet — the existing
// `email.ts` is still the active sender. A future iteration will switch
// callers from `email.ts` to this module once transactional senders land.

import { Resend } from "resend";
import { env } from "./env";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { to, subject, text, html } = input;

  if (env.resendApiKey === undefined && env.nodeEnv === "development") {
    // Dev fallback: print the email to the console so template work doesn't
    // require a real Resend key. Setting RESEND_API_KEY in dev opts back
    // into real sends.
    console.log(
      [
        "--- dev email (RESEND_API_KEY unset) ---",
        `to:      ${to}`,
        `subject: ${subject}`,
        "",
        text,
        "--- end dev email ---",
      ].join("\n"),
    );
    return;
  }

  // The env tripwire requires RESEND_API_KEY in production, so a non-undefined
  // value is guaranteed by the time we get here outside the dev fallback.
  if (env.resendApiKey === undefined) {
    throw new Error("RESEND_API_KEY is required to send email");
  }

  const resend = new Resend(env.resendApiKey);
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject,
    text,
    html: html ?? text,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
