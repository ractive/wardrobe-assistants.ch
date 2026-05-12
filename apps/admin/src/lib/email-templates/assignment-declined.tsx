import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import type { PushPayload } from "../push";
import { CtaButton } from "./_cta";
import { brand } from "./_tokens";

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
          <CtaButton href={p.bookingUrl}>Reassign in admin</CtaButton>
        </Container>
      </Body>
    </Html>
  );
}
