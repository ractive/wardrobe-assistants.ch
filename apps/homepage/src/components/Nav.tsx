import Link from "next/link";
import { Menu } from "@/components/icons";

const links = [
  { label: "Services", href: "/services/" },
  { label: "Request booking", href: "/booking-request/" },
  { label: "Contact", href: "/#contact" },
];

// CSS-only mobile menu via the checkbox-hack: the hidden checkbox is the
// `peer`, the `<label>` toggles it, and the mobile menu panel uses
// `peer-checked:flex` to appear. No useState, so the Nav itself stays a
// server component (no `"use client"` boundary).
//
// Mobile menu items deliberately use plain `<a>` instead of `<Link>` — a
// full-page navigation auto-closes the menu by resetting the checkbox.
// `<Link>` does soft navigation, which would leave the checkbox checked
// and the menu open after every tap, and there's no JS-free way to reset
// it. Brand + desktop links use `<Link>` since those don't have a menu to
// close.
export function Nav() {
  return (
    <nav className="relative flex w-full items-center justify-between border-b border-[var(--secondary)] px-6 py-5 lg:px-14">
      <Link
        href="/"
        className="font-primary text-[14px] font-bold tracking-[2px] text-[var(--foreground)]"
      >
        WARDROBE ASSISTANTS
      </Link>

      {/* Desktop links */}
      <div className="hidden items-center gap-8 md:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-secondary text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Mobile toggle: hidden checkbox + label, used by the menu below.
          The label carries the visible focus ring via peer-focus-visible:
          (the checkbox itself is `sr-only` so its native ring isn't visible). */}
      <input
        id="nav-toggle"
        type="checkbox"
        className="peer sr-only"
        aria-label="Toggle navigation menu"
        aria-controls="nav-menu"
      />
      <label
        htmlFor="nav-toggle"
        className="cursor-pointer rounded-sm text-[var(--foreground)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 md:hidden"
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle navigation menu</span>
      </label>

      {/* Mobile menu — sibling of the checkbox, appears when checked.
          Plain <a> on purpose: full-page nav resets the checkbox and the
          menu auto-closes. See top-of-file comment. */}
      <div
        id="nav-menu"
        className="absolute top-full left-0 z-50 hidden w-full flex-col gap-4 border-b border-[var(--secondary)] bg-[var(--background)] px-6 py-6 peer-checked:flex md:hidden"
      >
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
