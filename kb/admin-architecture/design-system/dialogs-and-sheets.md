---
title: Dialogs and sheets
type: architecture
status: current
---

# Dialogs vs sheets on mobile

Long or form-shaped content gets a **`Sheet`** (bottom-anchored on mobile, side-anchored on desktop). Quick confirms (delete, archive) stay as **`Dialog`** at all sizes.

| Pattern | Use |
|---|---|
| `Dialog` | Confirms (delete, archive), 1–2 line copy + Cancel/Confirm |
| `Sheet` (`side="bottom"` on mobile, `side="right"` on desktop) | Forms, multi-field edits, anything taller than ~60% of viewport |

Destructive `Dialog`s **disable Esc-to-close while pending** (`onEscapeKeyDown={(e) => isPending && e.preventDefault()}`) — intentional, prevents an accidental dismiss while the request is in flight.

**Mobile-first answer:** `Sheet side="bottom"` for forms; takes ≥ 60% of viewport height with safe-area padding.

**Desktop answer:** `Sheet side="right"` for forms; `Dialog` centred for confirms.

**Don't:**
- Forms inside `Dialog` on mobile — they get cut off and behave badly with the soft keyboard.
- Allowing Esc-to-close on a destructive action mid-flight.

---

See also: [design-system index](README.md) · [forms](forms.md) · [a11y baseline](a11y.md)
