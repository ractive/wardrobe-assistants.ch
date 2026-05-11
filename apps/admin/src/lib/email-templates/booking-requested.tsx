import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { PushPayload } from "../push";

// iter-26: notification to admins when a new public booking request lands.
// Push body deliberately compact: "<customer> · <date> · <city>".
export type BookingRequestedParams = {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  venueCity: string;
  venueName: string;
  date: string; // pre-formatted date, e.g. "Saturday, 1 March 2026"
  startTime: string;
  durationHours: number;
  comment?: string;
  /** Lines describing each requested service, pre-formatted. */
  serviceLines: string[];
  /** Admin booking-detail URL. */
  bookingUrl: string;
};

export function pushPayload(p: BookingRequestedParams): PushPayload {
  return {
    title: "New booking request",
    body: `${p.customerName} · ${p.date} · ${p.venueCity}`,
    url: `/bookings/${p.bookingId}`,
  };
}

const brand = "#1a1a1a";

export default function BookingRequested(p: BookingRequestedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        New booking request from {p.customerName} for {p.date}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            New booking request
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            A new booking request just came in through the public form.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>Customer:</strong> {p.customerName}
            <br />
            <strong>Email:</strong> {p.customerEmail}
            <br />
            <strong>Phone:</strong> {p.customerPhone}
            <br />
            <strong>When:</strong> {p.date} at {p.startTime} ({p.durationHours}
            h)
            <br />
            <strong>Where:</strong> {p.venueName}, {p.venueCity}
          </Text>
          {p.serviceLines.length > 0 ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Services requested:</strong>
              <br />
              {p.serviceLines.map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional snapshots
                <span key={`svc-${i}`}>
                  {line}
                  <br />
                </span>
              ))}
            </Text>
          ) : null}
          {p.comment ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Comment:</strong> {p.comment}
            </Text>
          ) : null}
          <Link
            href={p.bookingUrl}
            style={{
              display: "inline-block",
              marginTop: "16px",
              color: brand,
              fontSize: "14px",
            }}
          >
            Open booking in Wardrobe Assistants
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
