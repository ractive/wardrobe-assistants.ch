import { Body, Container, Head, Html, Preview, Text } from "react-email";

export type UserDirectMessageParams = {
  /** Dynamic subject supplied by the sender — included in the registry so subject: (p) => p.subject works */
  subject: string;
  /** Message body — newlines preserved as separate Text paragraphs */
  body: string;
};

import type { PushPayload } from "../push";

export function pushPayload(p: UserDirectMessageParams): PushPayload {
  // First non-whitespace line of the body, truncated; fall back to subject
  // when the body is empty or whitespace-only (`??` would let an empty
  // first line through as the notification body).
  const firstLine = p.body.split(/\r?\n/).find((line) => line.trim() !== "");
  return {
    title: p.subject,
    body: firstLine?.slice(0, 120) || p.subject,
  };
}

export default function UserDirectMessage(p: UserDirectMessageParams) {
  // Tag each line with a position-based key so React has a stable identifier.
  const paragraphs = p.body.split(/\r?\n/).map((line, pos) => ({
    line,
    key: `para-${pos}`,
  }));
  return (
    <Html lang="en">
      <Head />
      <Preview>{p.subject}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
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
