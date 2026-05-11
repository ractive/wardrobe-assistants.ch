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

export type AssignmentWithdrawnParams = {
  recipientName: string;
  bookingName: string;
  bookingDate: string;
  bookingVenue: string;
  squadMemberName: string;
  reason?: string;
  bookingUrl: string;
};

export function pushPayload(p: AssignmentWithdrawnParams): PushPayload {
  return {
    title: "Assignment withdrawn",
    body: `${p.squadMemberName} withdrew from ${p.bookingName}`,
    url: p.bookingUrl,
  };
}

const brand = "#1a1a1a";

export default function AssignmentWithdrawn(p: AssignmentWithdrawnParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.squadMemberName} withdrew from {p.bookingName}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Assignment withdrawn
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            <strong>{p.squadMemberName}</strong> has withdrawn from{" "}
            <strong>{p.bookingName}</strong> after previously confirming. You'll
            need to reassign.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.bookingDate}
            <br />
            <strong>Where:</strong> {p.bookingVenue}
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>Reason:</strong> {p.reason ?? "(no reason given)"}
          </Text>
          <CtaButton href={p.bookingUrl}>Reassign in admin</CtaButton>
        </Container>
      </Body>
    </Html>
  );
}
