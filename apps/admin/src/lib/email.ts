import { render } from "@react-email/render";
import * as React from "react";
import { Resend } from "resend";
import { type ParamsFor, type TemplateKey, templates } from "./email-templates";
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

/** Strip CR/LF from a string to prevent email header injection. */
function stripCrLf(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

// The List-Unsubscribe header satisfies Gmail/Yahoo bulk-sender requirements.
// We include it on all sends (templated + single) for simplicity — the header
// is harmless on transactional mail and removes the need for per-template
// decisions.
const LIST_UNSUBSCRIBE_HEADER =
  "<mailto:info@wardrobe-assistants.ch?subject=unsubscribe>";

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { to, text, html } = input;
  // Defense-in-depth: strip CR/LF from caller-supplied subject so single-shot
  // callers get the same header-injection guard that sendTemplated applies.
  const subject = stripCrLf(input.subject);

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
    headers: {
      "List-Unsubscribe": LIST_UNSUBSCRIBE_HEADER,
    },
  });
  if (error) {
    // iter-16f / C-SEC-08: don't propagate provider error text — it can
    // include partial recipient strings or upstream details. Log only
    // non-PII fields server-side; throw a generic message that is safe
    // to surface. We deliberately omit `error.message` because Resend's
    // error text occasionally echoes the recipient address back.
    console.error("[email] Resend send failed", {
      name: error.name,
      to: maskEmail(to),
    });
    throw new Error("Email could not be sent.");
  }
}

/**
 * Renders a named template with the given params and sends the email.
 * Type-safe: the compiler enforces that `params` matches the template's
 * declared param type.
 */
export async function sendTemplated<K extends TemplateKey>(
  key: K,
  to: string,
  params: ParamsFor<K>,
): Promise<void> {
  const entry = templates[key];
  const element = React.createElement(
    entry.component as (p: ParamsFor<K>) => React.ReactElement,
    params,
  );
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  const subject = (entry.subject as (p: ParamsFor<K>) => string)(params);
  await sendEmail({ to, subject: stripCrLf(subject), text, html });
}

/**
 * Renders a named template once per recipient and sends via Resend's batch
 * API (up to 100 per HTTP call). Chunks larger lists sequentially.
 *
 * Returns aggregate `{ sent, failed }`. Per-chunk errors count all recipients
 * in that chunk as failed; the error is logged but does not throw.
 *
 * In dev (no RESEND_API_KEY), prints a summary to the console instead of
 * hitting Resend.
 */
export async function sendTemplatedBatch<K extends TemplateKey>(
  key: K,
  recipients: ReadonlyArray<{ to: string; params: ParamsFor<K> }>,
): Promise<{ sent: number; failed: number }> {
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const entry = templates[key];

  // Dev fallback: console-log a summary, don't hit Resend.
  if (env.resendApiKey === undefined && env.nodeEnv === "development") {
    console.log(
      [
        "--- dev batch email (RESEND_API_KEY unset) ---",
        `template: ${key}`,
        `recipients: ${recipients.map((r) => maskEmail(r.to)).join(", ")}`,
        "--- end dev batch email ---",
      ].join("\n"),
    );
    return { sent: recipients.length, failed: 0 };
  }

  if (env.resendApiKey === undefined) {
    throw new Error("RESEND_API_KEY is required to send email");
  }

  const resend = new Resend(env.resendApiKey);

  // Render each recipient's email (params may differ per recipient).
  const rendered = await Promise.all(
    recipients.map(async (r) => {
      const element = React.createElement(
        entry.component as (p: ParamsFor<K>) => React.ReactElement,
        r.params,
      );
      const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
      ]);
      const subject = (entry.subject as (p: ParamsFor<K>) => string)(r.params);
      return { to: r.to, subject: stripCrLf(subject), html, text };
    }),
  );

  // Chunk into batches of 100 (Resend API limit) and send sequentially.
  const CHUNK_SIZE = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rendered.length; i += CHUNK_SIZE) {
    const chunk = rendered.slice(i, i + CHUNK_SIZE);
    const payload = chunk.map((r) => ({
      from: env.emailFrom,
      to: r.to,
      subject: r.subject,
      html: r.html,
      text: r.text,
      headers: {
        "List-Unsubscribe": LIST_UNSUBSCRIBE_HEADER,
      },
    }));

    try {
      const { error } = await resend.batch.send(payload);
      if (error) {
        console.error("[email] Resend batch send failed", {
          name: error.name,
          chunkStart: i,
          chunkSize: chunk.length,
        });
        failed += chunk.length;
      } else {
        sent += chunk.length;
      }
    } catch (err) {
      console.error("[email] Resend batch send threw", {
        chunkStart: i,
        chunkSize: chunk.length,
        err,
      });
      failed += chunk.length;
    }
  }

  return { sent, failed };
}
