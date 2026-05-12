import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import { CtaButton } from "./_cta";
import { brand } from "./_tokens";

// iter-27: sent to the customer when an admin sends them an offer.
// Email-only — customer has no user account and no push subscription.
export type OfferSentParams = {
  customerName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026". */
  date: string;
  startTime?: string;
  venue: string;
  city?: string;
  offerVersion: number;
  /** Public offer page URL. */
  offerUrl: string;
  /** Grand total, pre-formatted ("CHF 1,234.-"). */
  totalFormatted: string;
};

export default function OfferSent(p: OfferSentParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your wardrobe offer is ready to review</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Your offer is ready
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.customerName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            We've put together an offer for your upcoming event. Please review
            it and confirm when you're ready.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.date}
            {p.startTime ? ` at ${p.startTime}` : ""}
            <br />
            <strong>Where:</strong> {p.venue}
            {p.city ? `, ${p.city}` : ""}
            <br />
            <strong>Total:</strong> {p.totalFormatted}
            {p.offerVersion > 1 ? (
              <>
                <br />
                <strong>Offer version:</strong> {p.offerVersion}
              </>
            ) : null}
          </Text>
          <CtaButton href={p.offerUrl} variant="primary">
            Review your offer
          </CtaButton>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            If you have any questions before accepting, you can reply to this
            email or use the "I have questions" link on the offer page.
          </Text>
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — The Wardrobe Assistants team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
