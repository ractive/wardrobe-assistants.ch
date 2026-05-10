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

export type ParticipationRequestedParams = {
  actorName: string;
  eventName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026" */
  eventDate: string;
  reviewUrl: string;
};

import type { PushPayload } from "../push";

export function pushPayload(p: ParticipationRequestedParams): PushPayload {
  return {
    title: "Participation request",
    body: `${p.actorName} wants to join ${p.eventName}`,
    url: p.reviewUrl,
  };
}

const brand = "#1a1a1a";

export default function ParticipationRequested(
  p: ParticipationRequestedParams,
) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.actorName} requested to join {p.eventName}
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
            <strong>{p.eventName}</strong> ({p.eventDate}).
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            Review and approve or reject the request in the admin panel.
          </Text>
          <Link
            href={p.reviewUrl}
            style={{
              display: "inline-block",
              marginTop: "16px",
              color: brand,
              fontSize: "14px",
            }}
          >
            Review request
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
