---
title: Animation
type: architecture
status: current
---

# Animation

Default transition is `transition-colors duration-200`. Reserve longer or fancier transitions for one-off cases; document them in the component's comment.

Always wrap any animation-related class in the `motion-safe:` Tailwind variant so users with `prefers-reduced-motion: reduce` get a still UI.

```tsx
<button
  className="motion-safe:transition-colors motion-safe:duration-200 hover:bg-secondary"
>
```

**Mobile-first answer:** identical.

**Desktop answer:** identical.

**Don't:**
- Animating layout (`width`, `height`, `top/left`) — only colour, opacity, transform.
- Transitions longer than 200ms without a documented reason.
- Animations without `motion-safe:`.

---

See also: [design-system index](README.md) · [a11y baseline](a11y.md)
