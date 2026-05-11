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
import { brand } from "./_tokens";

export type BookingBroadcastParams = {
  /** Dynamic subject supplied by the sender */
  subject: string;
  bookingName: string;
  /** Message body — newlines preserved as separate Text paragraphs */
  body: string;
};

export function pushPayload(p: BookingBroadcastParams): PushPayload {
  // Show the first non-empty body line as the preview so the recipient can
  // see actual content; fall back to the booking reference when body is empty.
  const firstLine = p.body.split(/\r?\n/).find((line) => line.trim() !== "");
  return {
    title: `${p.bookingName}: ${p.subject}`,
    body: firstLine?.slice(0, 120) || `Re: ${p.bookingName}`,
  };
}

export default function BookingBroadcast(p: BookingBroadcastParams) {
  const paragraphs = p.body.split(/\r?\n/).map((line, pos) => ({
    line,
    key: `para-${pos}`,
  }));
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.bookingName}: {p.subject}
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            {p.subject}
          </Heading>
          <Text
            style={{
              color: "#777777",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            Re: {p.bookingName}
          </Text>
          {paragraphs.map(({ line, key }) => (
            <Text
              key={key}
              style={{
                color: "#333333",
                fontSize: "15px",
                margin: line.trim() === "" ? "8px 0" : "0 0 8px 0",
              }}
            >
              {line || " "}
            </Text>
          ))}
        </Container>
      </Body>
    </Html>
  );
}
