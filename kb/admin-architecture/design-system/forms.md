---
title: Forms
type: architecture
status: current
---

# Forms

shadcn `<Form>` + `<FormField>` + `<FormControl>` + `<FormMessage>` is the only allowed shape. `react-hook-form` + `zodResolver` ties the form to the same Zod schema the server action uses (see [`feature-slice-template.md`](../feature-slice-template.md) for the canonical form).

| Concern | Rule |
|---|---|
| Layout | Single column on mobile; `md:grid-cols-2` for two-column on desktop |
| Field width | Always `w-full` on `<Input>`, `<Textarea>`, `<Select>` triggers |
| Submit button | Full-width on mobile (`w-full md:w-auto`) |
| Submit lock | `disabled={form.formState.isSubmitting}` always |
| Field-level errors | `<FormMessage />` (auto-wired via `<FormField>`) |
| Form-level server errors | Live region: `role="alert" aria-live="assertive"` on the wrapper containing the message |
| Touch targets | Inputs and submit ≥ 44px tall (shadcn defaults are 36px → bump to `h-11` on mobile) |
| Server-action result | `result?.error` → `toast.error(message)`; success → `toast.success(message)` |

```tsx
// form-level server error pattern
{serverError ? (
  <div role="alert" aria-live="assertive" className="text-sm text-destructive">
    {serverError}
  </div>
) : null}
```

**Mobile-first answer:** one column, full-width inputs, full-width submit, `space-y-4` between fields.

**Desktop answer:** `md:grid-cols-2 md:gap-x-4` for the form grid; submit floats right (`md:w-auto md:ml-auto`).

**Don't:**
- Raw `<input>`, `<select>`, `<textarea>` — always shadcn primitives.
- Validation logic outside Zod — every constraint lives in `schema.ts` and is reused server-side.
- Submitting on field blur — explicit submit only.

---

See also: [design-system index](README.md) · [a11y baseline](a11y.md) · [dialogs and sheets](dialogs-and-sheets.md) · [feature-slice-template](../feature-slice-template.md)
