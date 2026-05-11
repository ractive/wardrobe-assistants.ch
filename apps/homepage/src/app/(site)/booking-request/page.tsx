import type { Metadata } from "next";
import { contactEmail, siteName, siteUrl } from "@/app/site-config";
import { EyebrowBadge } from "@/components/EyebrowBadge";
import { BookingRequestForm, type ServiceEntry } from "./_form";

// iter-26: customer-facing booking-request page. Static-export friendly — the
// services catalog is fetched at build time from the admin app. There is NO
// `revalidate` and NO route-handler escape hatch; the snapshot is stale until
// the next deploy. Accepted trade-off for v1.

const pageTitle = "Request a booking — Wardrobe Assistants";
const pageDescription =
  "Tell us about your production and we'll come back with a tailored offer for wardrobe crew support across Switzerland.";
const canonicalPath = "/booking-request";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: canonicalPath },
  openGraph: {
    type: "article",
    url: canonicalPath,
    siteName,
    title: pageTitle,
    description: pageDescription,
    locale: "en_CH",
  },
  robots: { index: true, follow: true },
};

// Admin app base URL. Defaults to the prod origin; override locally with
// `NEXT_PUBLIC_ADMIN_ORIGIN` if you're running the admin on a non-default port.
const ADMIN_ORIGIN =
  process.env.NEXT_PUBLIC_ADMIN_ORIGIN ??
  "https://admin.wardrobe-assistants.ch";

async function fetchServices(): Promise<ServiceEntry[]> {
  try {
    const res = await fetch(`${ADMIN_ORIGIN}/api/public/services`);
    if (!res.ok) {
      console.error(
        "[booking-request] services fetch failed",
        res.status,
        res.statusText,
      );
      return [];
    }
    const body = (await res.json()) as { services?: ServiceEntry[] };
    return body.services ?? [];
  } catch (err) {
    // Build-time fetch failures (e.g. admin not yet deployed) should not
    // break the static build. The form renders with an empty catalog +
    // email fallback message.
    console.error("[booking-request] services fetch threw", err);
    return [];
  }
}

export default async function BookingRequestPage() {
  const services = await fetchServices();
  const submitUrl = `${ADMIN_ORIGIN}/api/public/booking-requests`;
  return (
    <article className="flex flex-col gap-10 px-6 py-12 md:px-10 lg:px-14 lg:py-20">
      <header className="flex flex-col gap-5">
        <EyebrowBadge label="BOOKING REQUEST" />
        <h1 className="max-w-[840px] font-primary text-[36px] font-bold leading-[1.05] tracking-[-1px] text-[var(--foreground)] md:text-[44px] lg:text-[56px]">
          Tell us about your production.
        </h1>
        <p className="max-w-[680px] font-secondary text-[16px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[17px]">
          Share the date, venue and the services you'd like covered. We'll come
          back with a tailored offer including any call-out fees — usually
          within 24 hours. You can also write to{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="underline underline-offset-4"
          >
            {contactEmail}
          </a>{" "}
          directly.
        </p>
      </header>

      <BookingRequestForm services={services} submitUrl={submitUrl} />

      <p className="font-secondary text-[12px] text-[var(--muted-foreground)]">
        {siteName} —{" "}
        <a href={siteUrl} className="underline underline-offset-4">
          {siteUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>
    </article>
  );
}
