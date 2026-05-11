import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

// iter-26: customer-side autoreply confirming a booking request was received.
// Email only — customers don't have user accounts, so no push payload.
export type BookingRequestReceivedParams = {
  customerName: string;
  bookingId: string;
  /** Short, pre-formatted human-readable summary lines. */
  summary: string[];
};

const brand = "#1a1a1a";

export default function BookingRequestReceived(
  p: BookingRequestReceivedParams,
) {
  return (
    <Html lang="en">
      <Head />
      <Preview>We received your booking request</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            We received your booking request
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.customerName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Thanks for reaching out to the Wardrobe Assistants. We've received
            your request and someone from the team will get back to you with a
            tailored offer shortly.
          </Text>
          {p.summary.length > 0 ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Your request:</strong>
              <br />
              {p.summary.map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: positional summary lines
                <span key={`sum-${i}`}>
                  {line}
                  <br />
                </span>
              ))}
            </Text>
          ) : null}
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            If you need to add anything, simply reply to this email.
          </Text>
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — The Wardrobe Assistants team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
