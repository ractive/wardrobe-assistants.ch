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
import type { PushPayload } from "../push";

export type AssignmentDeclinedParams = {
  recipientName: string;
  bookingName: string;
  bookingDate: string;
  bookingVenue: string;
  squadMemberName: string;
  /** Which state the squad member declined from. Affects wording. */
  fromStatus: "assigned" | "confirmed";
  bookingUrl: string;
};

export function pushPayload(p: AssignmentDeclinedParams): PushPayload {
  const wording = p.fromStatus === "confirmed" ? "backed out of" : "declined";
  return {
    title: "Assignment declined",
    body: `${p.squadMemberName} ${wording} ${p.bookingName}`,
    url: p.bookingUrl,
  };
}

const brand = "#1a1a1a";

export default function AssignmentDeclined(p: AssignmentDeclinedParams) {
  const headline =
    p.fromStatus === "confirmed"
      ? "Backed out after confirming"
      : "Declined before confirming";
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.squadMemberName}{" "}
        {p.fromStatus === "confirmed"
          ? `backed out of ${p.bookingName}`
          : `declined ${p.bookingName}`}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Assignment declined
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Hi {p.recipientName},
          </Text>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            <strong>{p.squadMemberName}</strong> {headline.toLowerCase()} on{" "}
            <strong>{p.bookingName}</strong>.
          </Text>
          <Text style={{ color: "#555555", fontSize: "14px" }}>
            <strong>When:</strong> {p.bookingDate}
            <br />
            <strong>Where:</strong> {p.bookingVenue}
          </Text>
          <Link
            href={p.bookingUrl}
            style={{
              display: "inline-block",
              marginTop: "16px",
              color: brand,
              fontSize: "14px",
            }}
          >
            Reassign in admin
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
