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

export type PasswordResetParams = {
  resetUrl: string;
};

const brand = "#1a1a1a";

export default function PasswordReset(p: PasswordResetParams) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your Wardrobe Assistants admin password</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            Reset your password
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            Click the link below to reset your Wardrobe Assistants admin
            password. The link expires after a short period.
          </Text>
          <CtaButton href={p.resetUrl}>Reset password</CtaButton>
          <Text
            style={{ color: "#999999", fontSize: "12px", marginTop: "24px" }}
          >
            If you did not request a password reset, you can safely ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
