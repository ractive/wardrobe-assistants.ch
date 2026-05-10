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

export type BookingAssignedParams = {
  recipientName: string;
  bookingName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026" */
  bookingDate: string;
  bookingVenue: string;
  bookingNotes?: string;
  bookingUrl: string;
};

import type { PushPayload } from "../push";

export function pushPayload(p: BookingAssignedParams): PushPayload {
  return {
    title: `Assigned to ${p.bookingName}`,
    body: `${p.bookingDate} — ${p.bookingVenue}`,
    url: p.bookingUrl,
  };
}

const brand = "#1a1a1a";

export default function BookingAssigned(p: BookingAssignedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You've been assigned to {p.bookingName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Assigned to {p.bookingName}
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            You've been assigned to <strong>{p.bookingName}</strong>.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.bookingDate}
            <br />
            <strong>Where:</strong> {p.bookingVenue}
          </Text>
          {p.bookingNotes ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Notes:</strong> {p.bookingNotes}
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
