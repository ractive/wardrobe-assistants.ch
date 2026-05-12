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

// One template with a `recipient` discriminant — keeps the email visually
// consistent across all three audiences while letting the copy vary.
export type BookingCancelledParams = {
  recipient: "customer" | "squad" | "admin";
  recipientName: string;
  bookingName: string;
  /** Pre-formatted date string. */
  bookingDate: string;
  bookingVenue: string;
  /** Optional free-form reason captured at cancel time. */
  reason?: string;
  /** Admin URL — only meaningful for squad / admin recipients. */
  bookingUrl?: string;
};

// Push is only meaningful for squad members (they're the only ones with a
// userId + push subscription). The notify dispatcher only calls this for
// notifyUser() invocations.
export function pushPayload(p: BookingCancelledParams): PushPayload {
  return {
    title: `Cancelled: ${p.bookingName}`,
    body: `${p.bookingDate} — ${p.bookingVenue}`,
    url: p.bookingUrl ?? "/bookings",
  };
}

function audienceCopy(recipient: BookingCancelledParams["recipient"]) {
  switch (recipient) {
    case "customer":
      return {
        heading: "Your booking has been cancelled",
        body: "We're writing to confirm that the booking below has been cancelled.",
      };
    case "squad":
      return {
        heading: "Booking cancelled",
        body: "A booking you were assigned to has been cancelled. No further action is required.",
      };
    case "admin":
      return {
        heading: "Booking cancelled",
        body: "This booking has been cancelled.",
      };
  }
}

export default function BookingCancelled(p: BookingCancelledParams) {
  const copy = audienceCopy(p.recipient);
  return (
    <Html lang="en">
      <Head />
      <Preview>Cancelled: {p.bookingName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            {copy.heading}
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            {copy.body}
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>Booking:</strong> {p.bookingName}
            <br />
            <strong>When:</strong> {p.bookingDate}
            <br />
            <strong>Where:</strong> {p.bookingVenue}
          </Text>
          {p.reason ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Reason:</strong> {p.reason}
            </Text>
          ) : null}
          {p.bookingUrl && p.recipient !== "customer" ? (
            <CtaButton href={p.bookingUrl}>
              Open booking in Wardrobe Assistants
            </CtaButton>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
