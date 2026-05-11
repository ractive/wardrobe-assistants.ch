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

// iter-28: notification to admins when a customer declines an offer on the
// public offer page. Both push and email per the iter-23 dual-channel decision.
export type OfferRejectedParams = {
  bookingId: string;
  customerName: string;
  /** Admin booking-detail URL. */
  bookingUrl: string;
  /** Optional reason the customer provided when declining. */
  reason?: string;
};

export function pushPayload(p: OfferRejectedParams): PushPayload {
  return {
    title: "Offer declined",
    body: `${p.customerName} declined the offer`,
    url: p.bookingUrl,
  };
}

const brand = "#1a1a1a";

export default function OfferRejected(p: OfferRejectedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{p.customerName} declined the offer</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Offer declined
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            {p.customerName} has declined the offer.
          </Text>
          {p.reason ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Reason:</strong> {p.reason}
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
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — Wardrobe Assistants Admin
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
