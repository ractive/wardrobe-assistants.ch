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

export type AssignmentConfirmedParams = {
  recipientName: string;
  bookingName: string;
  bookingDate: string;
  bookingVenue: string;
  squadMemberName: string;
  bookingUrl: string;
};

export function pushPayload(p: AssignmentConfirmedParams): PushPayload {
  return {
    title: "Assignment confirmed",
    body: `${p.squadMemberName} confirmed ${p.bookingName}`,
    url: p.bookingUrl,
  };
}

export default function AssignmentConfirmed(p: AssignmentConfirmedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.squadMemberName} confirmed {p.bookingName}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Assignment confirmed
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            <strong>{p.squadMemberName}</strong> confirmed their assignment to{" "}
            <strong>{p.bookingName}</strong>.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.bookingDate}
            <br />
            <strong>Where:</strong> {p.bookingVenue}
          </Text>
          <CtaButton href={p.bookingUrl}>Open booking</CtaButton>
        </Container>
      </Body>
    </Html>
  );
}
