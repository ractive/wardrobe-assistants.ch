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

export type VerifyEmailParams = {
  verifyUrl: string;
};

export default function VerifyEmail(p: VerifyEmailParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your Wardrobe Assistants admin email</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Verify your email
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Click the link below to verify your Wardrobe Assistants admin email
            address.
          </Text>
          <CtaButton href={p.verifyUrl}>Verify email address</CtaButton>
          <Text
            style={{ color: "#999999", fontSize: "12px", marginTop: "24px" }}
          >
            If you did not sign up for a Wardrobe Assistants admin account, you
            can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
