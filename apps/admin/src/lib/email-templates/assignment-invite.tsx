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
import type { PushPayload } from "../push";

export type AssignmentInviteParams = {
  recipientName: string;
  bookingName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026" */
  bookingDate: string;
  bookingVenue: string;
  bookingNotes?: string;
  confirmUrl: string;
  declineUrl: string;
};

export function pushPayload(p: AssignmentInviteParams): PushPayload {
  return {
    title: "New assignment",
    body: `${p.bookingDate} · ${p.bookingVenue}`,
    url: p.confirmUrl,
  };
}

const brand = "#1a1a1a";

export default function AssignmentInvite(p: AssignmentInviteParams) {
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
            You've been assigned to <strong>{p.bookingName}</strong>. Please
            confirm whether you can take it.
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
          <Container style={{ margin: "24px 0" }}>
            <Button
              href={p.confirmUrl}
              style={{
                backgroundColor: brand,
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: "6px",
                fontSize: "14px",
                marginRight: "8px",
                textDecoration: "none",
              }}
            >
              Confirm
            </Button>
            <Button
              href={p.declineUrl}
              style={{
                backgroundColor: "#ffffff",
                color: brand,
                border: `1px solid ${brand}`,
                padding: "10px 18px",
                borderRadius: "6px",
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              Decline
            </Button>
          </Container>
          <Text style={{ color: "#777777", fontSize: "13px" }}>
            You'll be asked to sign in. Both buttons take you to your booking
            page where you can confirm or decline.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
