import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { CtaButton } from "./_cta";
import { brand } from "./_tokens";

export type ParticipationRequestedParams = {
  actorName: string;
  bookingName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026" */
  bookingDate: string;
  reviewUrl: string;
};

import type { PushPayload } from "../push";

export function pushPayload(p: ParticipationRequestedParams): PushPayload {
  return {
    title: "Participation request",
    body: `${p.actorName} wants to join ${p.bookingName}`,
    url: p.reviewUrl,
  };
}

export default function ParticipationRequested(
  p: ParticipationRequestedParams,
) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.actorName} requested to join {p.bookingName}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Participation request
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            <strong>{p.actorName}</strong> has requested to participate in{" "}
            <strong>{p.bookingName}</strong> ({p.bookingDate}).
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            Review and approve or reject the request in the admin panel.
          </Text>
          <CtaButton href={p.reviewUrl}>Review request</CtaButton>
        </Container>
      </Body>
    </Html>
  );
}
