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
import { CtaButton } from "./_cta";
import { brand } from "./_tokens";

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
          <Text style={{ margin: "24px 0 8px" }}>
            <CtaButton href={p.confirmUrl} variant="primary">
              Confirm
            </CtaButton>
          </Text>
          <Text style={{ margin: "0 0 24px" }}>
            <CtaButton href={p.declineUrl} variant="secondary">
              Decline
            </CtaButton>
          </Text>
          <Text style={{ color: "#777777", fontSize: "13px" }}>
            You'll be asked to sign in. Both buttons take you to your booking
            page where you can confirm or decline.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
