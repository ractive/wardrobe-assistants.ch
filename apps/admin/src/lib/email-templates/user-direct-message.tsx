import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type UserDirectMessageParams = {
  /** Dynamic subject supplied by the sender — included in the registry so subject: (p) => p.subject works */
  subject: string;
  /** Message body — newlines preserved as separate Text paragraphs */
  body: string;
};

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
