---
title: Frontend / UI audit — ChatGPT — 2026-05-09
type: audit
status: source
reviewer: chatgpt
created: 2026-05-09
tags: [audit, frontend, ui, react, shadcn, tailwind, accessibility]
---

# Frontend / UI audit — ChatGPT — 2026-05-09

Verbatim output as provided by user 2026-05-09. Preserved as a source document for the consolidated frontend audit.

---

# Frontend / UI Review Findings for wardrobe-assistants.ch

## IMPORTANT

- This review was primarily static/source-based.
- The application was not executed locally.
- Findings should be validated in a real browser/device environment.

## Executive Summary

Overall, the frontend architecture is clean, modern, and maintainable.

Strong points:
- Good separation between homepage and admin applications
- Mostly appropriate Server Component usage
- Good use of shadcn/ui primitives
- Clean TypeScript structure
- Good usage of Zod + react-hook-form
- Limited client-side JavaScript where possible
- Generally clean Tailwind usage

Main weaknesses:
- Some accessibility gaps
- Homepage navigation uses a CSS checkbox hack
- Some form patterns are inconsistent
- Design tokens are duplicated across apps
- Some unsafe TypeScript patterns exist
- Several UX consistency improvements are possible

## Top Frontend/UI Issues

### [MEDIUM] Homepage Button component mixes button and link semantics

Evidence:

The homepage Button component extends `ComponentProps<"a">` instead of supporting explicit button semantics.

File:

- `apps/homepage/src/components/Button.tsx`

Why it matters:

Buttons and links have different semantics. Accessibility and keyboard expectations differ. Future developers may misuse the component.

Recommended fix:

Rename the component to `LinkButton`, or intentionally support both `<button>` and `<a>` via a polymorphic component pattern.

---

### [MEDIUM] Mobile navigation uses checkbox-hack navigation state

Evidence:

The navigation component uses a hidden checkbox, CSS state toggling, and anchor navigation resets.

File:

- `apps/homepage/src/components/Nav.tsx`

Why it matters:

This can create problems with accessibility, focus management, keyboard navigation, Escape-to-close support, and future maintainability.

Recommended fix:

Replace it with a very small client component that provides explicit open state, `aria-expanded`, Escape key support, focus handling, and route-change closing.

---

### [MEDIUM] Login form bypasses shared shadcn form primitives

Evidence:

The login page manually renders labels, inputs, and errors instead of using the shared shadcn form primitives already used elsewhere.

File:

- `apps/admin/src/app/login/page.tsx`

Why it matters:

This creates inconsistent UX, duplicated form patterns, inconsistent accessibility behavior, and harder long-term maintenance.

Recommended fix:

Refactor the login page to use `Form`, `FormField`, `FormControl`, and `FormMessage`.

---

### [MEDIUM] Unsafe TypeScript cast in EventForm

Evidence:

The EventForm uses an unsafe date fallback cast:

`date: defaults?.date ?? (undefined as unknown as Date)`

File:

- `apps/admin/src/features/events/components/EventForm.tsx`

Why it matters:

This bypasses type safety and hides invalid form states.

Recommended fix:

Use a nullable or optional form model, then enforce the required date through validation at submit time.

---

### [MEDIUM] Form-level errors are not screen-reader friendly

Evidence:

Server errors render visually only, especially in login and set-password flows.

Files:

- `apps/admin/src/app/login/page.tsx`
- `apps/admin/src/app/set-password/page.tsx`

Why it matters:

Screen readers may not announce these errors automatically.

Recommended fix:

Add `role="alert"` or `aria-live="assertive"` to form-level error containers.

---

### [MEDIUM] Users table is minimal and may not scale well

Evidence:

TanStack Table usage is basic, with no visible sorting, advanced accessibility handling, or responsive behavior.

File:

- `apps/admin/src/features/users/components/UsersTable.tsx`

Why it matters:

As data grows, usability, keyboard navigation, responsiveness, and discoverability may degrade.

Recommended fix:

Add sorting, filtering where useful, table captions, responsive handling, and keyboard-tested row actions.

---

### [LOW] CSS variables/design tokens are duplicated across apps

Evidence:

Both homepage and admin define separate root variable systems.

Files:

- `apps/homepage/src/app/globals.css`
- `apps/admin/src/app/globals.css`

Why it matters:

This creates risk of visual drift and duplicated maintenance.

Recommended fix:

Move shared tokens into a shared package, centralized design-token file, or documented theme system.

---

### [LOW] Homepage components are highly bespoke

Evidence:

Homepage uses custom components such as Button, Nav, Footer, and ServiceCard instead of shared primitives.

Why it matters:

This is acceptable for a small static site, but it becomes harder to scale consistently later.

Recommended fix:

As the homepage grows, extract layout primitives, shared sections, and reusable spacing patterns.

---

### [LOW] shadcn/ui customization drift risk

Evidence:

The admin app contains customized shadcn primitives.

Files:

- `apps/admin/src/components/ui/*`

Why it matters:

Over time, accessibility guarantees and update compatibility may drift.

Recommended fix:

Keep customizations minimal, document intentional deviations, and periodically compare against upstream shadcn components.

---

### [LOW] Sidebar lacks active route state

Evidence:

Sidebar links appear static and do not expose active route state.

File:

- `apps/admin/src/components/DashboardSidebar.tsx`

Why it matters:

Users lack clear navigation context.

Recommended fix:

Add active-state styling and `aria-current="page"` via pathname detection, a small client wrapper, or route-aware server rendering.

## React Architecture Review

### Positive findings

- Many admin components remain server-rendered.
- `HasPermission` is implemented as an async server component, which avoids shipping unnecessary permission UI logic to the client.
- Homepage and admin are clearly separated.
- Most modern forms use Zod and react-hook-form cleanly.

### Areas to improve

- Form architecture is inconsistent across the admin app.
- Avoid unnecessary future `"use client"` usage.
- Keep data fetching and permission decisions server-side where possible.
- Avoid overusing client state for UI that can remain server-rendered.

## shadcn/ui Review

### Positive findings

The admin app includes a broad and appropriate shadcn component set:

- dialog
- dropdown-menu
- popover
- select
- form
- table
- tabs
- toast
- command

The component set is modern and appropriate.

### Areas to improve

- Use shadcn form primitives consistently across all forms.
- Review customized shadcn components periodically against upstream.
- Extract repeated visual variants into reusable variants or primitives.
- Ensure customizations do not break Radix accessibility behavior.

## Tailwind / CSS Review

### Positive findings

- Tailwind usage is mostly readable and restrained.
- CSS variable usage is modern.
- Theming uses semantic variables rather than only hardcoded colors.

### Areas to improve

- Centralize shared design tokens.
- Reduce app-specific token drift between homepage and admin.
- Consider reusable layout primitives for common spacing patterns.
- Watch for repeated utility combinations that should become variants or components.

## Accessibility Review

### Positive findings

- shadcn/Radix gives a strong baseline for many interactive components.
- Most UI appears to use reasonable semantic HTML.

### Accessibility gaps

- Mobile navigation should use explicit accessibility state.
- Form-level server errors should use live regions.
- Sidebar active route should expose `aria-current="page"`.
- Dialogs, dropdowns, tables, and mobile nav should receive keyboard interaction tests.

## Performance Review

### Positive findings

- Server Component usage likely reduces client JavaScript.
- Homepage static export is appropriate for a marketing site.
- The current UI does not appear excessively client-heavy.

### Areas to improve

- Avoid future client bundle bloat from unnecessary `"use client"` components.
- Monitor table scalability as data grows.
- Lazy-load heavier interactive UI if it becomes significant.
- Keep icons and client dependencies under review.

## Design System Review

### Positive findings

- Visual consistency is already decent.
- Spacing, typography, color, and radius usage appear mostly coherent.

### Areas to improve

- Centralize tokens shared by homepage and admin.
- Add shared layout primitives.
- Document common UI patterns.
- Ensure buttons, forms, cards, tables, and navigation use consistent variants.

## Testing Review

Frontend tests should include:

- keyboard navigation
- dialog focus traps
- form accessibility
- screen-reader announcements
- mobile nav behavior
- route-aware sidebar behavior
- table interactions
- loading and error states

## Prioritized Frontend Actions

1. Replace checkbox mobile nav with an accessible client component.
2. Add `aria-live` or `role="alert"` support for form errors.
3. Refactor login to shared shadcn form primitives.
4. Fix the unsafe EventForm type cast.
5. Centralize design tokens and shared theme variables.
6. Add active route states to sidebar/navigation.
7. Add accessibility-focused frontend tests.
8. Extract repeated layout and spacing primitives.
9. Review table scalability patterns.
10. Periodically sync shadcn customizations with upstream.
