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
import { brand } from "./_tokens";

// Sent to the customer when an admin manually accepts the booking offline.
// Mirrors the user-facing "your offer was accepted" mail that iter-27 will
// add for the self-service path.
export type OfferAcceptedAdminParams = {
  recipientName: string;
  bookingName: string;
  /** Pre-formatted date string. */
  bookingDate: string;
  bookingVenue: string;
  /** Subtotal of the booked services, pre-formatted ("CHF 1,234.-"). */
  totalFormatted: string;
};

// Customer recipient has no userId → notifyUser is never called for this
// template; the push payload is exported for registry uniformity only.
export function pushPayload(p: OfferAcceptedAdminParams): PushPayload {
  return {
    title: `Booking confirmed: ${p.bookingName}`,
    body: `${p.bookingDate} — ${p.bookingVenue}`,
    url: "/",
  };
}

export default function OfferAcceptedAdmin(p: OfferAcceptedAdminParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Booking confirmed: {p.bookingName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Your booking is confirmed
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            We've confirmed your booking on our side. Here's a summary for your
            records.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>Booking:</strong> {p.bookingName}
            <br />
            <strong>When:</strong> {p.bookingDate}
            <br />
            <strong>Where:</strong> {p.bookingVenue}
            <br />
            <strong>Total:</strong> {p.totalFormatted}
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            We'll be in touch closer to the date with the final details.
          </Text>
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — The Wardrobe Assistants team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
