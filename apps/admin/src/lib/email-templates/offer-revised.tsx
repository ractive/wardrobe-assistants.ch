import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

// iter-28: sent to the customer when an admin sends a revised offer.
// Email-only — customer has no user account and no push subscription.
export type OfferRevisedParams = {
  customerName: string;
  offerVersion: number;
  /** Public offer page URL. */
  offerUrl: string;
  /** Grand total, pre-formatted ("CHF 1,234.-"). */
  totalFormatted: string;
  /** True when the prior offer had already been accepted by the customer. */
  wasAccepted?: boolean;
};

const brand = "#1a1a1a";

export default function OfferRevised(p: OfferRevisedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your wardrobe offer has been updated</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Your offer has been updated
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.customerName},
          </Text>
          {p.wasAccepted ? (
            <Text
              style={{
                color: "#333333",
                fontSize: "15px",
                backgroundColor: "#fff3cd",
                padding: "12px 16px",
                borderRadius: "6px",
                borderLeft: "4px solid #f0a500",
              }}
            >
              This offer was updated since you accepted. Please review the
              revised details and re-confirm your acceptance.
            </Text>
          ) : (
            <Text style={{ color: "#333333", fontSize: "15px" }}>
              We've updated your offer (version {p.offerVersion}). Please review
              the revised details and confirm when you're ready.
            </Text>
          )}
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>Total:</strong> {p.totalFormatted}
            <br />
            <strong>Offer version:</strong> {p.offerVersion}
          </Text>
          <Button
            href={p.offerUrl}
            style={{
              display: "inline-block",
              marginTop: "24px",
              marginBottom: "24px",
              padding: "12px 24px",
              backgroundColor: brand,
              color: "#ffffff",
              borderRadius: "6px",
              fontSize: "15px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Review updated offer
          </Button>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            If you have any questions, you can reply to this email or use the "I
            have questions" link on the offer page.
          </Text>
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — The Wardrobe Assistants team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
