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

export type EventAssignedParams = {
  recipientName: string;
  eventName: string;
  /** Pre-formatted date string, e.g. "Saturday, 1 March 2026" */
  eventDate: string;
  eventVenue: string;
  eventNotes?: string;
  eventUrl: string;
};

const brand = "#1a1a1a";

export default function EventAssigned(p: EventAssignedParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You've been assigned to {p.eventName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Assigned to {p.eventName}
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            You've been assigned to <strong>{p.eventName}</strong>.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.eventDate}
            <br />
            <strong>Where:</strong> {p.eventVenue}
          </Text>
          {p.eventNotes ? (
            <Text style={{ color: "#555555", fontSize: "14px" }}>
              <strong>Notes:</strong> {p.eventNotes}
            </Text>
          ) : null}
          <Link
            href={p.eventUrl}
            style={{
              display: "inline-block",
              marginTop: "16px",
              color: brand,
              fontSize: "14px",
            }}
          >
            Open event in Wardrobe Assistants
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
