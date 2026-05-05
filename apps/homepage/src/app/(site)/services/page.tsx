import {
  ClipboardList,
  Crown,
  Droplets,
  Scissors,
  Shirt,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import { contactEmail, siteName, siteUrl } from "@/app/site-config";
import { Button } from "@/components/Button";
import { EyebrowBadge } from "@/components/EyebrowBadge";

const pageTitle = "Wardrobe Assistants in Switzerland — Services";
const pageDescription =
  "Tour wardrobe crew for theatres, concerts and festivals across Switzerland. Quick changes, ironing and steam, repairs, wigs, load-in and laundry — handled by Zürich-based dressers who travel with the show.";
const canonicalPath = "/services";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: canonicalPath,
  },
  openGraph: {
    type: "article",
    url: canonicalPath,
    siteName,
    title: pageTitle,
    description: pageDescription,
    locale: "en_CH",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Wardrobe Assistants — services for backstage wardrobe crews in Switzerland",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/og-image.png"],
  },
};

type Service = {
  id: string;
  icon: typeof Shirt;
  title: string;
  tagline: string;
  body: string[];
  example: { label: string; text: string };
  keywords: string[];
};

const services: Service[] = [
  {
    id: "quick-changes",
    icon: Shirt,
    title: "Quick changes",
    tagline:
      "Rehearsed dressers in every wing, choreographed hand-offs from the half-hour call to the final blackout.",
    body: [
      "Quick changes live or die on the rehearsal hours nobody sees. We block every transition with the stage manager — who walks where, which hanger faces out, which closure goes first — and we run it until the timing is muscle memory. By opening night the wing is silent except for the show.",
      "On the night, dressers stand pre-set with costumes laid magnet-down, mic packs queued, shoes in the order they go on. We use tear-away seams and hidden snap rigs when the script asks for thirty seconds, swap them for invisible closures when it asks for sixty. Performers walk in fully booked, walk out fully changed, and never look down to check.",
      "Most productions need quick-change support during dress rehearsal week, the press run, and the broadcast call. We also cover one-off galas where a host runs five looks in a single evening.",
    ],
    example: {
      label: "Real run",
      text: "A 22-second change between two arias in a Zürich opera production — three dressers in a one-metre wing, performer back on stage with the lights still up.",
    },
    keywords: ["quick change dresser", "wing dresser", "tour dressing crew"],
  },
  {
    id: "ironing-and-steam",
    icon: Droplets,
    title: "Ironing & steam",
    tagline:
      "Crisp linen, soft silks, period weight that hangs the way the designer drew it.",
    body: [
      "Costumes wrinkle harder under stage light than in any rehearsal room. We steam at the half-hour call, touch up during interval, and hit the deep creases with a gravity-feed iron at the ironing table the venue keeps backstage. Anything that finished the previous show in a hamper gets pressed before the next call sheet posts.",
      "We carry industrial steamers, fabric protectors, lint rollers and the right pressing cloths for shantung, velvet and metallic threads — the materials that punish you for using the wrong heat. Period costumes get hung on dress forms and steamed vertically so the structure stays.",
      "This is the work that disappears when it's done well. The audience never notices a smooth lapel — but they see a wrinkled one from row twenty.",
    ],
    example: {
      label: "Real run",
      text: "Forty chorus costumes steamed and hung between a Saturday matinee and the same-day evening show at an open-air festival in Aargau.",
    },
    keywords: ["costume steaming", "stage ironing", "wardrobe pressing"],
  },
  {
    id: "repairs-and-alterations",
    icon: Scissors,
    title: "Repairs & alterations",
    tagline:
      "On-site stitching, zipper rescues and fittings — minutes before curtain when it has to be.",
    body: [
      "Costumes break. Zippers split between scene three and scene four, hems catch on a heel, an actor loses two centimetres on the road and the period jacket no longer closes. We fix it in the dressing room while the call is going out, and we plan the longer repairs into the next dark day.",
      "Our portable kit covers most of what a venue won't have: a hand-cranked machine for heavier fabrics, hand-stitch sets in every weight of thread, replacement zippers in standard tooth sizes, stretch and elastic threads, fusible interfacing for fast hems. For finer alterations we coordinate with the costume designer so the change reads as theirs, not ours.",
      "On press week and during pre-tour fit checks we book a designated repair shift each day — that's when the small problems surface, and we'd rather solve them in daylight than at the half-hour call.",
    ],
    example: {
      label: "Real run",
      text: "A blown back-seam on a corseted gown, hand-stitched in 90 seconds while the soprano stood breathing carefully — back on stage for her entrance with no sign of the rescue.",
    },
    keywords: ["costume repairs", "on-site alterations", "stage seamstress"],
  },
  {
    id: "wigs-and-accessories",
    icon: Crown,
    title: "Wigs & accessories",
    tagline:
      "Pinned, tracked and re-set every night — from the first rehearsal to the final bow.",
    body: [
      "Wigs and accessories live or die on tracking. We label every stand by performer and scene, log each piece in a tracking sheet that travels with the production, and reset the dressing room every night so nothing is hunted for at half-hour. If a hat goes missing during a Zürich run, we know which dresser handled it last and which scene it appeared in.",
      "Wigs are blocked, pinned and fitted at the half-hour call, with touch-ups during interval. We carry pin sets in the right finishes, wig caps in matching tones, and the styling tools that survive a tour bus. Accessories — gloves, jewellery, fans, parasols, glasses — sit in numbered boxes per act so a quick change picks up the right piece without a glance.",
      "For multi-character productions where a single performer changes wigs four or five times, we build a track sheet with the assistant director and run it like cue-to-cue.",
    ],
    example: {
      label: "Real run",
      text: "Fourteen wig changes per night across an opera ensemble, tracked across ten performers and three weeks — zero misses.",
    },
    keywords: ["wig dresser", "stage accessories", "costume tracking"],
  },
  {
    id: "load-in-and-load-out",
    icon: Truck,
    title: "Load-in & load-out",
    tagline:
      "Rails up before doors, packed and rolling out before the venue locks the loading bay.",
    body: [
      "Load-in is where the tour earns back its time. We arrive with the trucks, build rails by act and character, hang every costume in run order, and have the dressing rooms set — mirrors, steaming station, ironing board, repair kit — before the first performer walks in. Stage management can focus on the technical fit-up; we handle wardrobe end to end.",
      "Load-out is the same in reverse, on a tighter clock. We pack into tour cases by show order so the next venue's load-in is faster, label every bag, and hand the manifest to the production manager before we sign off.",
      "For festivals and one-day fits we strip the build down to essentials: a rolling rail per artist, garment bags, padded hangers for the delicate pieces, steam at the dressing room. In and out before the next changeover.",
    ],
    example: {
      label: "Real run",
      text: "A five-truck load-in for a touring rock production at Hallenstadion — costume rails racked and dressing rooms set in under three hours.",
    },
    keywords: ["tour load-in", "wardrobe pack-down", "festival load-out"],
  },
  {
    id: "laundry",
    icon: ClipboardList,
    title: "Laundry",
    tagline:
      "Nightly turnaround so costumes hit the next call sheet fresh, dry and stage-ready.",
    body: [
      "Stage costumes take more sweat and stage makeup than most people realise. We sort by fabric and colour at curtain down, treat stains while they're fresh, and run wash cycles overnight so the rail is repopulated by the next half-hour call. Hand-wash pieces — silks, delicate trims, hand-painted detailing — get treated separately and air-dried on the rack.",
      "On longer runs we cycle costumes so every garment gets a full rest day after a wash. On tour we adapt to whatever the venue has — sometimes industrial machines, sometimes a domestic stack — and bring portable racks when neither exists.",
      "Stain treatment matters more than wash cycles. We carry oxygen-based cleaners, enzyme treatments for organic stains, and the right solvents for stage makeup and theatrical blood — applied in the dressing room before the costume even hits a hamper.",
    ],
    example: {
      label: "Real run",
      text: "Sixty-garment nightly rotation during a six-week Zürich theatre run — every costume on the rail by half-hour, every night.",
    },
    keywords: [
      "theatre laundry",
      "costume stain removal",
      "wardrobe wash cycles",
    ],
  },
];

const venues = [
  {
    title: "Theatres",
    copy: "Schauspielhaus and Opernhaus runs in Zürich, mid-scale houses in Basel, Bern, Lucerne and Geneva, and touring productions that move between them.",
  },
  {
    title: "Concerts",
    copy: "Hallenstadion arena nights, mid-size halls across the country, and broadcast calls where wardrobe has to be camera-tight from the first cue.",
  },
  {
    title: "Festivals",
    copy: "Open-air weekends in Frauenfeld, Gampel, Locarno and across the Alps — fast turnover between artists, multiple changing rooms, weather to plan around.",
  },
  {
    title: "Tours",
    copy: "Multi-city DACH tours where we travel with the production, build the rail at every venue, and hand back a packed truck on time.",
  },
];

const faqs = [
  {
    question: "How far in advance should we book the wardrobe crew?",
    answer:
      "Two to four weeks works for a single venue. Six to eight weeks is healthier for a multi-city tour or anything during festival season — June through August in Switzerland, and the run-up to year-end show weeks. Earlier is always better; we hold dates as soon as the production calendar firms up.",
  },
  {
    question: "Do you travel with the production?",
    answer:
      "Yes. We tour with productions across Switzerland and into the neighbouring DACH region — Germany, Austria, Liechtenstein. Per diem and travel are part of the quote. For longer international tours we coordinate with local crews at each venue.",
  },
  {
    question: "Can you handle period costumes and corsetry?",
    answer:
      "Yes. Corsets, bustles, hand-stitched period detailing, period wigs and headpieces are part of the standard kit. We work directly with the costume designer to keep period silhouettes intact through quick changes and repairs.",
  },
  {
    question: "What's the team size for a typical production?",
    answer:
      "Two to six dressers per show, depending on cast size, number of quick changes, and how many changing rooms are running in parallel. Festivals and large arena tours sometimes scale to eight or more for the load-in and load-out shifts.",
  },
  {
    question: "Do you bring your own equipment?",
    answer:
      "We carry portable steaming, ironing, sewing and repair kits to every venue. Industrial laundry depends on what the venue offers — we bring portable racks and stain treatment when there's nothing on-site, and we'll flag it in the quote so the production knows what to expect.",
  },
  {
    question: "What languages does the crew work in?",
    answer:
      "German, French, Italian and English. Most calls happen in a mix; we switch easily between them mid-show and adjust to whichever language the stage manager and performers prefer.",
  },
  {
    question: "Are you available for one-off events and galas?",
    answer:
      "Yes. Single-performance galas, fashion shows, awards nights and broadcast specials are all welcome. We run them with the same prep and tracking as a multi-night run, just compressed into a shorter call.",
  },
  {
    question: "Can you handle last-minute calls when a dresser drops out?",
    answer:
      "When the schedule allows, yes. We keep contact details for vetted freelance dressers in the Zürich and Basel area for emergency cover. The earlier the heads-up, the better the chance we can hold the slot.",
  },
  {
    question: "Do you provide costume designers or stylists?",
    answer:
      "No — we don't design or commission costumes. We work to the designer's plot and protect the look they built. For productions without a designer attached we can recommend collaborators we've worked with before.",
  },
  {
    question: "How do you bill — day rates or fixed fee?",
    answer:
      "Day rate per dresser plus travel and per diem on tour. We send a written quote within 24 hours of a brief and itemise overtime, late-night load-out and any hire equipment up front so there are no surprises after the run.",
  },
];

export default function ServicesPage() {
  const serviceJsonLd = services.map((service) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${siteUrl}${canonicalPath}#${service.id}`,
    name: service.title,
    description: service.tagline,
    serviceType: service.title,
    provider: {
      "@type": "ProfessionalService",
      name: siteName,
      url: siteUrl,
      email: contactEmail,
    },
    areaServed: {
      "@type": "Country",
      name: "Switzerland",
    },
    audience: {
      "@type": "Audience",
      audienceType: "Theatres, concerts, festivals and touring productions",
    },
  }));

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Services",
        item: `${siteUrl}${canonicalPath}`,
      },
    ],
  };

  return (
    <article className="flex flex-col">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be inlined as text
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            ...serviceJsonLd,
            faqJsonLd,
            breadcrumbJsonLd,
          ]).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero */}
      <section className="flex flex-col gap-6 px-6 pt-12 pb-12 md:px-10 lg:gap-7 lg:px-14 lg:pt-[72px] lg:pb-16">
        <EyebrowBadge label="SERVICES" />
        <h1 className="max-w-[840px] font-primary text-[32px] font-bold leading-[1.05] tracking-[-1px] text-[var(--foreground)] md:text-[40px] lg:text-[52px]">
          Wardrobe assistants in Switzerland — tour, theatre &amp; festival
          crews.
        </h1>
        <p className="max-w-[680px] font-secondary text-[16px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[17px]">
          We are the{" "}
          <strong className="text-[var(--foreground)]">
            Steam &amp; Stitch Squad
          </strong>{" "}
          — a Zürich-based wardrobe crew dressing theatre runs, concert tours
          and festival weekends across Switzerland and the wider DACH region.
          Six core services keep a production looking sharp from the half-hour
          call to the load-out: quick changes, ironing and steam, on-site
          repairs, wigs and accessories, load-in and load-out, and nightly
          laundry. We travel with the show or staff venues directly, working in
          German, French, Italian or English depending on the call. Below is a
          closer look at how each service runs in practice — the prep, the kit,
          and the moments where it actually matters.
        </p>
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
          <Button href={`mailto:${contactEmail}`}>Request a quote</Button>
          <Button variant="outline" href="/#services">
            Back to overview
          </Button>
        </div>
      </section>

      {/* Services list */}
      <section className="flex flex-col gap-12 px-6 py-12 md:px-10 lg:gap-16 lg:px-14 lg:py-20">
        {services.map((service, index) => {
          const Icon = service.icon;
          return (
            <section
              key={service.id}
              id={service.id}
              className="flex flex-col gap-5 lg:gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--secondary)]">
                  <Icon
                    className="h-[22px] w-[22px] text-[#B8B3AC]"
                    aria-hidden="true"
                  />
                </div>
                <span className="font-primary text-[12px] font-medium tracking-[1.5px] text-[var(--muted-foreground)]">
                  0{index + 1}
                </span>
              </div>
              <h2 className="max-w-[820px] font-primary text-[26px] font-bold leading-[1.15] tracking-[-0.5px] text-[var(--foreground)] md:text-[32px] lg:text-[38px]">
                {service.title}
              </h2>
              <p className="max-w-[760px] font-secondary text-[17px] leading-[1.55] text-[var(--foreground)] lg:text-[18px]">
                {service.tagline}
              </p>
              {service.body.map((paragraph, paragraphIndex) => (
                <p
                  key={`${service.id}-p${paragraphIndex}`}
                  className="max-w-[720px] font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]"
                >
                  {paragraph}
                </p>
              ))}
              <div className="mt-2 max-w-[720px] rounded-[16px] border border-[var(--border)] bg-[var(--accent)]/70 p-5 lg:p-6">
                <span className="font-primary text-[11px] font-medium uppercase tracking-[1.5px] text-[var(--primary-on-dark)]">
                  {service.example.label}
                </span>
                <p className="mt-2 font-secondary text-[15px] leading-[1.6] text-[var(--foreground)]">
                  {service.example.text}
                </p>
              </div>
            </section>
          );
        })}
      </section>

      {/* Where we work */}
      <section
        id="where-we-work"
        className="flex flex-col gap-8 px-6 py-12 md:px-10 lg:gap-10 lg:px-14 lg:py-20"
      >
        <div className="flex flex-col gap-5">
          <EyebrowBadge label="WHERE WE WORK" />
          <h2 className="max-w-[840px] font-primary text-[28px] font-bold leading-[1.1] tracking-[-1px] text-[var(--foreground)] md:text-[36px] lg:text-[44px]">
            Theatres, concerts and festivals across Switzerland.
          </h2>
          <p className="max-w-[720px] font-secondary text-[15px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[16px]">
            We are based in Zürich and work the length of the country —
            Schauspielhaus and Opernhaus runs at home, festival weekends in
            Aargau and Valais, broadcast calls at Hallenstadion, touring
            productions through Basel, Bern, Lucerne and Geneva. We also travel
            with productions into Germany, Austria and Liechtenstein when the
            route asks for it.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {venues.map((venue) => (
            <div
              key={venue.title}
              className="flex flex-col gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--accent)]/70 p-6"
            >
              <dt className="font-primary text-[18px] font-bold text-[var(--foreground)]">
                {venue.title}
              </dt>
              <dd className="font-secondary text-[14px] leading-[1.6] text-[var(--muted-foreground)]">
                {venue.copy}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="flex flex-col gap-8 px-6 py-12 md:px-10 lg:gap-10 lg:px-14 lg:py-20"
      >
        <div className="flex flex-col gap-5">
          <EyebrowBadge label="FAQ" />
          <h2 className="max-w-[840px] font-primary text-[28px] font-bold leading-[1.1] tracking-[-1px] text-[var(--foreground)] md:text-[36px] lg:text-[44px]">
            Booking, kit and the questions productions actually ask.
          </h2>
        </div>
        <dl className="flex flex-col gap-6">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="flex flex-col gap-2 border-b border-[var(--border)] pb-6 last:border-b-0 last:pb-0"
            >
              <dt className="font-primary text-[17px] font-bold leading-[1.3] text-[var(--foreground)] lg:text-[19px]">
                {faq.question}
              </dt>
              <dd className="max-w-[760px] font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)] lg:text-[16px]">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center justify-center px-6 py-16 md:px-10 lg:px-[120px] lg:py-24">
        <div className="flex flex-col items-center gap-6 lg:gap-7">
          <EyebrowBadge label="READY WHEN YOU ARE" size="md" />
          <h2 className="max-w-[900px] text-center font-primary text-[32px] font-medium leading-[1.1] text-[var(--foreground)] md:text-[42px] lg:text-[56px]">
            Ready to lock in the squad?
          </h2>
          <p className="max-w-[680px] text-center font-secondary text-[16px] leading-[1.55] text-[var(--muted-foreground)] lg:text-[17px]">
            Send us the dates, cast size and venues. We&apos;ll come back within
            24 hours with a quote, a proposed team size and any kit notes for
            the run.
          </p>
          <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center">
            <Button href={`mailto:${contactEmail}`}>Request a quote</Button>
            <Button variant="outline" href="/#contact">
              Back to homepage
            </Button>
          </div>
        </div>
      </section>
    </article>
  );
}
