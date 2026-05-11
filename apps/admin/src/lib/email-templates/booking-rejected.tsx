import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { PushPayload } from "../push";

export type BookingRejectedParams = {
  recipientName: string;
  bookingName: string;
  /** Pre-formatted date string. */
  bookingDate: string;
  /** Optional free-form reason supplied by the admin. */
  reason?: string;
};

// Reserved for parity with other templates — customer-side recipients have no
// user account, so this push payload is currently unreachable in production.
// Kept exported so the notify registry surface stays uniform.
export function pushPayload(p: BookingRejectedParams): PushPayload {
  return {
    title: `Booking declined: ${p.bookingName}`,
    body: p.bookingDate,
    url: "/",
  };
}

const brand = "#1a1a1a";

export default function BookingRejected(p: BookingRejectedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>About your booking request: {p.bookingName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            About your booking request
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Thank you for your interest in booking the Wardrobe Assistants for{" "}
            <strong>{p.bookingName}</strong> on {p.bookingDate}.
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Unfortunately we won't be able to take this booking on.
          </Text>
          {p.reason ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Note from the team:</strong> {p.reason}
            </Text>
          ) : null}
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Thanks again for thinking of us — we hope the event goes well.
          </Text>
          <Text style={{ color: "#888888", fontSize: "13px" }}>
            — The Wardrobe Assistants team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
