import { Button } from "@react-email/components";

// Brand colour matches the per-template `brand` constant used across the
// templates. Centralised here so a future palette change is a single edit.
const brand = "#1a1a1a";

type Variant = "primary" | "secondary";

const baseStyle = {
  display: "inline-block",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  marginTop: "24px",
  marginBottom: "8px",
} as const;

const variantStyle = {
  primary: {
    backgroundColor: brand,
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: "#ffffff",
    color: brand,
    border: `1px solid ${brand}`,
  },
} as const satisfies Record<Variant, Record<string, string>>;

/**
 * Email CTA button. Use whenever a link defines an action a recipient is
 * expected to take (open a booking, accept an offer, reset password, etc.).
 * Renders as a styled `@react-email/components` Button so most major email
 * clients render it as a recognisable button rather than a bare link.
 *
 * Use `variant="secondary"` for the lesser of two paired actions
 * (e.g. Decline next to Confirm).
 */
export function CtaButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <Button href={href} style={{ ...baseStyle, ...variantStyle[variant] }}>
      {children}
    </Button>
  );
}
