import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import type { PushPayload } from "../push";
import { CtaButton } from "./_cta";
import { brand } from "./_tokens";

// iter-26: notification to admins when a new public booking request lands.
// Push body deliberately compact: "<customer> · <date> · <city>".
export type BookingRequestedParams = {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  venue: string;
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
    body: `${p.customerName} · ${p.date} · ${p.city}`,
    url: `/bookings/${p.bookingId}`,
  };
}

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
            <strong>Where:</strong> {p.venue}, {p.city}
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
          <CtaButton href={p.bookingUrl}>
            Open booking in Wardrobe Assistants
          </CtaButton>
        </Container>
      </Body>
    </Html>
  );
}
