import { Resend } from "resend";
import { env } from "./env";

const resend = new Resend(env.resendApiKey);

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
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
