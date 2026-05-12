import type { ComponentProps } from "react";

type LinkButtonVariant = "primary" | "outline";

type LinkButtonProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  variant?: LinkButtonVariant;
};

// Anchor styled as a button. The homepage has no `<button>` elements today —
// every CTA is a link (mailto, anchor jump, route). The `Button` name is
// reserved for a future actual `<button>`; see kb/admin-architecture/design-system/forms.md.
export function LinkButton({
  variant = "primary",
  className,
  children,
  href,
  ...props
}: LinkButtonProps) {
  const base =
    "inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 py-3 font-primary text-[14px] font-medium text-center transition-opacity hover:opacity-90";

  const variants: Record<LinkButtonVariant, string> = {
    primary: "bg-[var(--primary)] text-[var(--primary-foreground)]",
    outline:
      "border border-[var(--border)] text-[var(--muted-foreground)] shadow-[0_1px_1.75px_rgba(0,0,0,0.05)]",
  };

  // Block window.opener / referrer leak when opening in a new tab.
  const rel =
    props.target === "_blank"
      ? [props.rel, "noopener", "noreferrer"].filter(Boolean).join(" ")
      : props.rel;

  return (
    <a
      href={href}
      className={`${base} ${variants[variant]} ${className ?? ""}`}
      {...props}
      rel={rel}
    >
      {children}
    </a>
  );
}
