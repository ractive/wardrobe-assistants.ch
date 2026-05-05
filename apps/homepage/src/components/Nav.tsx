import { Menu } from "@/components/icons";

const links = [
  { label: "Services", href: "/services/" },
  { label: "Contact", href: "/#contact" },
];

// CSS-only mobile menu via the checkbox-hack: the hidden checkbox is the
// `peer`, the `<label>` toggles it, and the mobile menu panel uses
// `peer-checked:flex` to appear. No client JS, no React hydration needed —
// this lets the rest of the homepage render as a fully static page.
export function Nav() {
  return (
    <nav className="relative flex w-full items-center justify-between border-b border-[var(--secondary)] px-6 py-5 lg:px-14">
      <a
        href="/"
        className="font-primary text-[14px] font-bold tracking-[2px] text-[var(--foreground)]"
      >
        WARDROBE ASSISTANTS
      </a>

      {/* Desktop links */}
      <div className="hidden items-center gap-8 md:flex">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="font-secondary text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* Mobile toggle: hidden checkbox + label, used by the menu below */}
      <input
        id="nav-toggle"
        type="checkbox"
        className="peer sr-only"
        aria-label="Toggle navigation menu"
      />
      <label
        htmlFor="nav-toggle"
        className="cursor-pointer text-[var(--foreground)] md:hidden"
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle navigation menu</span>
      </label>

      {/* Mobile menu — sibling of the checkbox, appears when checked */}
      <div className="absolute top-full left-0 z-50 hidden w-full flex-col gap-4 border-b border-[var(--secondary)] bg-[var(--background)] px-6 py-6 peer-checked:flex md:hidden">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="font-secondary text-[16px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
