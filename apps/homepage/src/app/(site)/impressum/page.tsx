import type { Metadata } from "next";
import {
  legalLastUpdated,
  operator,
  siteName,
  siteUrl,
} from "@/app/site-config";
import { EyebrowBadge } from "@/components/EyebrowBadge";

const pageTitle = "Impressum";
const pageDescription =
  "Legal operator details for wardrobe-assistants.ch — name, address and contact information as required under Swiss UWG Art. 3(1)(s).";
const canonicalPath = "/impressum";

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
  twitter: {
    card: "summary",
    title: pageTitle,
    description: pageDescription,
  },
};

export default function ImpressumPage() {
  return (
    <article className="flex flex-col gap-12 px-6 py-12 md:px-10 lg:gap-16 lg:px-14 lg:py-20">
      <header className="flex flex-col gap-5">
        <EyebrowBadge label="LEGAL" />
        <h1 className="max-w-[840px] font-primary text-[36px] font-bold leading-[1.05] tracking-[-1px] text-[var(--foreground)] md:text-[48px] lg:text-[60px]">
          Impressum
        </h1>
        <p className="max-w-[720px] font-secondary text-[15px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[16px]">
          Information about the operator of {siteUrl}, published in line with
          Art. 3(1)(s) of the Swiss Federal Act Against Unfair Competition
          (UWG).
        </p>
      </header>

      <section className="flex flex-col gap-6 lg:gap-8">
        <h2 className="font-primary text-[22px] font-bold leading-[1.2] tracking-[-0.5px] text-[var(--foreground)] lg:text-[28px]">
          Operator
        </h2>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr] md:gap-x-10 md:gap-y-5">
          <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
            Legal name
          </dt>
          <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
            {operator.legalName}
          </dd>

          <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
            Address
          </dt>
          <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
            <address className="not-italic">
              {operator.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </dd>

          <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
            Email
          </dt>
          <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
            <a
              href={`mailto:${operator.email}`}
              className="underline decoration-[var(--primary)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--primary-on-dark)]"
            >
              {operator.email}
            </a>
          </dd>

          {operator.phone ? (
            <>
              <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
                Phone
              </dt>
              <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
                <a
                  href={`tel:${operator.phone.replace(/\s+/g, "")}`}
                  className="underline decoration-[var(--primary)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--primary-on-dark)]"
                >
                  {operator.phone}
                </a>
              </dd>
            </>
          ) : null}

          {operator.commercialRegister ? (
            <>
              <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
                Commercial Register
              </dt>
              <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
                {operator.commercialRegister}
              </dd>
            </>
          ) : null}

          {operator.uid ? (
            <>
              <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
                UID
              </dt>
              <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
                {operator.uid}
              </dd>
            </>
          ) : null}

          {operator.vat ? (
            <>
              <dt className="font-primary text-[12px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
                VAT number
              </dt>
              <dd className="font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
                {operator.vat}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className="font-primary text-[22px] font-bold leading-[1.2] tracking-[-0.5px] text-[var(--foreground)] lg:text-[28px]">
          Responsible for content
        </h2>
        <p className="max-w-[720px] font-secondary text-[15px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[16px]">
          {operator.responsibleForContent}, reachable at{" "}
          <a
            href={`mailto:${operator.email}`}
            className="underline decoration-[var(--primary)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--primary-on-dark)]"
          >
            {operator.email}
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className="font-primary text-[22px] font-bold leading-[1.2] tracking-[-0.5px] text-[var(--foreground)] lg:text-[28px]">
          Disclaimer
        </h2>
        <p className="max-w-[760px] font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]">
          Content on this site is provided for general information about our
          services. We take care to keep it accurate and up to date but accept
          no liability for typographical errors, omissions or temporary
          unavailability of the site.
        </p>
        <p className="max-w-[760px] font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]">
          External links from this site are reviewed at the time of placement.
          We do not control the content of linked third-party sites and
          therefore decline responsibility for it. The respective site operators
          remain responsible for their own content.
        </p>
        <p className="max-w-[760px] font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]">
          Photographs, illustrations and texts on this site are protected by
          copyright. Reuse beyond personal viewing requires written permission.
        </p>
      </section>

      <p className="font-secondary text-[13px] text-[var(--muted-foreground)]">
        Last updated: {legalLastUpdated}
      </p>
    </article>
  );
}
