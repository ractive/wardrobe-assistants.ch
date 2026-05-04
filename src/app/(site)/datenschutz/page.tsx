import type { Metadata } from "next";
import Link from "next/link";
import {
  legalLastUpdated,
  operator,
  siteName,
  siteUrl,
} from "@/app/site-config";
import { EyebrowBadge } from "@/components/EyebrowBadge";

const pageTitle = "Privacy policy";
const pageDescription =
  "How wardrobe-assistants.ch handles personal data — controller, processing purposes, recipients, retention and your rights under the revised Swiss Federal Act on Data Protection (revFADP / nDSG).";
const canonicalPath = "/datenschutz";

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

const sectionHeading =
  "font-primary text-[22px] font-bold leading-[1.2] tracking-[-0.5px] text-[var(--foreground)] lg:text-[28px]";
const subHeading =
  "font-primary text-[16px] font-bold text-[var(--foreground)] lg:text-[18px]";
const paragraph =
  "max-w-[760px] font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]";
const listClass =
  "ml-5 flex max-w-[760px] list-disc flex-col gap-2 font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]";
const linkClass =
  "underline decoration-[var(--primary)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--primary)]";

export default function DatenschutzPage() {
  return (
    <article className="flex flex-col gap-12 px-6 py-12 md:px-10 lg:gap-16 lg:px-14 lg:py-20">
      <header className="flex flex-col gap-5">
        <EyebrowBadge label="LEGAL" />
        <h1 className="max-w-[840px] font-primary text-[36px] font-bold leading-[1.05] tracking-[-1px] text-[var(--foreground)] md:text-[48px] lg:text-[60px]">
          Privacy policy
        </h1>
        <p className="max-w-[760px] font-secondary text-[15px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[16px]">
          This page explains what personal data {siteName} collects when you
          visit {siteUrl} or contact us, why we process it, who else sees it and
          which rights you have. It is written to meet the requirements of the
          revised Federal Act on Data Protection (revFADP / nDSG, in force since
          1 September 2023).
        </p>
      </header>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>1. Controller</h2>
        <p className={paragraph}>
          The controller responsible for processing personal data on this site
          is{" "}
          <span className="text-[var(--foreground)]">{operator.legalName}</span>
          , {operator.addressLines.join(", ")}. Contact:{" "}
          <a href={`mailto:${operator.email}`} className={linkClass}>
            {operator.email}
          </a>
          . Full operator details are listed in the{" "}
          <Link href="/impressum" className={linkClass}>
            Impressum
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>2. What data we process and why</h2>
        <h3 className={subHeading}>Server logs</h3>
        <p className={paragraph}>
          When you visit this site, our hosting provider (Bunny.net) records
          technical request data automatically: IP address, request timestamp,
          requested URL, HTTP status code, referrer, browser user-agent string.
          These logs are used to operate the site, diagnose errors and detect
          abuse. Legal basis: legitimate interest in keeping the service running
          and secure (revFADP Art. 31).
        </p>
        <h3 className={subHeading}>Email enquiries</h3>
        <p className={paragraph}>
          When you write to{" "}
          <a href={`mailto:${operator.email}`} className={linkClass}>
            {operator.email}
          </a>
          , we receive the data you choose to send: at minimum your email
          address and message content, often a name and project details. We use
          this data only to answer the enquiry and, if a booking follows, to
          manage that engagement. Legal basis: contractual measures at your
          request and legitimate interest in responding to enquiries.
        </p>
        <h3 className={subHeading}>No analytics, no tracking, no cookies</h3>
        <p className={paragraph}>
          We do not run analytics, advertising pixels, social plugins or any
          third-party scripts. The site sets no cookies, no localStorage and no
          fingerprinting. If this changes, we will update this policy before the
          new processing starts and — if required by FMG Art. 45c or the GDPR —
          present a consent prompt.
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>3. Categories of personal data</h2>
        <ul className={listClass}>
          <li>Identification data: name (where you provide it).</li>
          <li>
            Contact data: email address, phone number (where you provide it).
          </li>
          <li>
            Technical data: IP address, browser/user-agent, request timestamps,
            referring URL.
          </li>
          <li>
            Project data: anything you choose to share about a production —
            dates, venues, cast size, costume notes.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>4. Recipients and processors</h2>
        <p className={paragraph}>
          We share personal data only with processors needed to operate the
          service, bound by data-processing agreements:
        </p>
        <ul className={listClass}>
          <li>
            <span className="text-[var(--foreground)]">Bunny.net</span>{" "}
            (BunnyWay d.o.o., Slovenia) — hosting, CDN and access logs.
          </li>
          <li>
            <span className="text-[var(--foreground)]">Email provider</span> —
            transport and storage of incoming and outgoing email.
          </li>
        </ul>
        <p className={paragraph}>
          We do not sell personal data. We do not share it with advertising
          networks. Authorities may receive data only when we are legally
          obliged to disclose it.
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>5. Cross-border transfers</h2>
        <p className={paragraph}>
          Bunny.net operates infrastructure across the European Union and
          worldwide edge locations. Personal data may therefore be processed
          outside Switzerland. Transfers to EEA countries rely on the EU&apos;s
          adequate level of protection as recognised under Swiss data protection
          law; transfers to other jurisdictions are covered by standard
          contractual clauses with the processor.
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>6. Retention</h2>
        <ul className={listClass}>
          <li>
            Server logs are retained by the hosting provider for a short period
            (typically up to 30 days) for operational and security reasons, then
            rotated.
          </li>
          <li>
            Email correspondence is kept for as long as needed to handle the
            enquiry or, if a booking follows, for the duration of the engagement
            plus the statutory retention period under Swiss law (commercial
            records: 10 years under Art. 958f CO).
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>7. Your rights</h2>
        <p className={paragraph}>
          You have the following rights regarding the personal data we hold
          about you, exercisable at any time by writing to{" "}
          <a href={`mailto:${operator.email}`} className={linkClass}>
            {operator.email}
          </a>
          :
        </p>
        <ul className={listClass}>
          <li>
            Access — confirmation that we process your data and a copy of it.
          </li>
          <li>Rectification — correction of inaccurate or incomplete data.</li>
          <li>
            Erasure — deletion of data we no longer need to keep (subject to
            legal retention obligations).
          </li>
          <li>Restriction — limiting how we process specific records.</li>
          <li>Data portability — a structured, machine-readable export.</li>
          <li>Objection — to processing based on legitimate interest.</li>
        </ul>
        <p className={paragraph}>
          We may need to verify your identity before acting on a request, to
          prevent disclosure to the wrong party.
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>8. Right to lodge a complaint</h2>
        <p className={paragraph}>
          You can lodge a complaint with the Swiss Federal Data Protection and
          Information Commissioner (FDPIC / EDÖB), Feldeggweg 1, 3003 Bern,{" "}
          <a
            href="https://www.edoeb.admin.ch"
            className={linkClass}
            rel="noreferrer"
            target="_blank"
          >
            edoeb.admin.ch
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-4 lg:gap-5">
        <h2 className={sectionHeading}>9. Changes to this policy</h2>
        <p className={paragraph}>
          We update this page when our processing changes. The current version
          always applies. Material changes are noted at the top of the page on
          first publication.
        </p>
      </section>

      <p className="font-secondary text-[13px] text-[var(--muted-foreground)]">
        Last updated: {legalLastUpdated}
      </p>
    </article>
  );
}
