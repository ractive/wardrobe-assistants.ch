import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type EventBroadcastParams = {
  /** Dynamic subject supplied by the sender */
  subject: string;
  eventName: string;
  /** Message body — newlines preserved as separate Text paragraphs */
  body: string;
};

const brand = "#1a1a1a";

export default function EventBroadcast(p: EventBroadcastParams) {
  const paragraphs = p.body.split(/\r?\n/).map((line, pos) => ({
    line,
    key: `para-${pos}`,
  }));
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.eventName}: {p.subject}
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
            Re: {p.eventName}
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
