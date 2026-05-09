import { Resend } from "resend";
import { env } from "./env";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return "[redacted]";
  const local = address.slice(0, at);
  const domain = address.slice(at);
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 1))}${domain}`;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { to, subject, text, html } = input;

  if (env.resendApiKey === undefined && env.nodeEnv === "development") {
    // Dev fallback: print the email so template work doesn't require a real
    // Resend key. Setting RESEND_API_KEY in dev opts back into real sends.
    console.log(
      [
        "--- dev email (RESEND_API_KEY unset) ---",
        `to:      ${maskEmail(to)}`,
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
    ...(html !== undefined ? { html } : {}),
  });
  if (error) {
    // iter-16f / C-SEC-08: don't propagate provider error text — it can
    // include partial recipient strings or upstream details. Log full
    // context server-side; throw a generic message that is safe to surface.
    console.error("[email] Resend send failed", { error });
    throw new Error("Email could not be sent.");
  }
}
