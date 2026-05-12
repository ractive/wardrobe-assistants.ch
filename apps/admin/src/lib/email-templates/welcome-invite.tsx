import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import { CtaButton } from "./_cta";
import { brand } from "./_tokens";

// iter-39 §C.2: invitation flow has its own template, separate from
// password-reset. Better Auth re-uses `requestPasswordReset` to send the
// activation link (token is the same shape), but the user-facing copy
// must say "welcome" / "activate" — not "reset your password" — or new
// hires think someone tried to hijack their account. Branch is decided
// in lib/auth.ts `sendResetPassword` by checking user_profile.status.
export type WelcomeInviteParams = {
  activateUrl: string;
  firstName?: string | null;
};

export default function WelcomeInvite(p: WelcomeInviteParams) {
  const greeting = p.firstName ? `Welcome, ${p.firstName}!` : "Welcome!";
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Wardrobe Assistants — activate your account</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: "560px", margin: "40px auto", padding: "0 16px" }}
        >
          <Heading
            style={{ color: brand, fontSize: "22px", marginBottom: "16px" }}
          >
            {greeting}
          </Heading>
          <Text style={{ color: "#333333", fontSize: "15px" }}>
            You have been invited to the Wardrobe Assistants admin app. Click
            the button below to choose a password and activate your account.
          </Text>
          <CtaButton href={p.activateUrl}>Activate your account</CtaButton>
          <Text
            style={{ color: "#999999", fontSize: "12px", marginTop: "24px" }}
          >
            If you weren&apos;t expecting this invitation, you can safely ignore
            this email — your account stays inactive until the link is used. The
            link expires after a short period.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
