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

// iter-27: notification to admins when a customer accepts an offer on the
// public offer page. Both push and email per the iter-23 dual-channel decision.
export type OfferAcceptedParams = {
  bookingId: string;
  customerName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026". */
  date: string;
  /** Admin booking-detail URL. */
  bookingUrl: string;
  /** Grand total, pre-formatted ("CHF 1,234.-"). */
  totalFormatted: string;
};

export function pushPayload(p: OfferAcceptedParams): PushPayload {
  return {
    title: "Offer accepted",
    body: `${p.customerName} accepted the offer — ${p.date}`,
    url: p.bookingUrl,
  };
}

export default function OfferAccepted(p: OfferAcceptedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.customerName} accepted the offer for {p.date}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Offer accepted
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            {p.customerName} has accepted the offer.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.date}
            <br />
            <strong>Total:</strong> {p.totalFormatted}
          </Text>
          <CtaButton href={p.bookingUrl}>
            Open booking in Wardrobe Assistants
          </CtaButton>
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — Wardrobe Assistants Admin
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
