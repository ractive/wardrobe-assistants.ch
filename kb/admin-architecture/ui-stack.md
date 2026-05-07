---
title: UI stack — shadcn/ui, forms, tables, conventions
type: architecture
status: current
---

# UI stack — shadcn/ui, forms, tables, conventions

## Stack at a glance

| Layer | Library | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Already set up |
| Styling | Tailwind CSS v4 | CSS-first config (no `tailwind.config.ts`); shadcn-shaped variables in `globals.css` already aligned to brand tokens |
| Primitives | **shadcn/ui** | Components copied into `components/ui/` via the CLI; we own them |
| Underlying primitives | Radix (`@radix-ui/*`) | shadcn deps |
| Variants/styling helpers | `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn deps |
| Icons | `lucide-react` | shadcn default |
| Forms | `react-hook-form` + `@hookform/resolvers` (zod resolver) | shadcn's recommended form pattern |
| Validation | `zod` | Same schemas used server-side for `action.parse(unsafe)` |
| Tables | `@tanstack/react-table` | Headless; shadcn has a copy-paste data-table recipe built on it |
| Toasts | `sonner` | shadcn-recommended toast |
| Date helpers | `date-fns` | Add when first needed |
| Date picker | `react-day-picker` | Comes via `npx shadcn add calendar` |

## Brand tokens (already wired)

`apps/admin/src/app/globals.css` defines shadcn-shaped CSS variables tinted to the wardrobe-assistants brand:

```css
:root {
  --background: #1a1816;       /* dark theme by default */
  --foreground: #edeae4;
  --card: #26231f;
  --primary: #b5564f;          /* Bordeaux brand */
  --secondary: #2e2b28;
  --muted: #1f1d1b;
  --muted-foreground: #b8b3ac;
  --destructive: #e53e3e;
  --border: #3a3734;
  --input: #3a3734;
  --ring: #b5564f;
  --radius-m: 16px;
}
```

shadcn components read these CSS variables — they auto-skin to the brand without modification.

## shadcn install workflow

One-time:
```bash
npx shadcn@latest init
# components.json points to: components/ui, lib/utils, "@/" alias, RSC mode, CSS vars
```

Per component, on demand:
```bash
npx shadcn@latest add button input label form dialog table dropdown-menu select textarea checkbox switch sonner
```

Components land in `apps/admin/src/components/ui/`. `lib/utils.ts` gets the `cn()` helper. shadcn auto-detects Tailwind v4 and uses v4-compatible templates.

### What `components.json` should say

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

## Forms — the canonical pattern

```tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { inviteUserInput, type InviteUserInput } from "@/features/users/schema"
import { inviteUser } from "@/features/users/server/actions"

export function InviteUserForm() {
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserInput),
    defaultValues: { email: "", firstName: "", lastName: "", role: "SQUAD_MEMBER" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await inviteUser(data)
    if (result?.error) toast.error(result.message)
    else if (result) toast.success(result.message)
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="SQUAD_MEMBER">Squad member</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={form.formState.isSubmitting}>Invite</Button>
      </form>
    </Form>
  )
}
```

**Convention:**
- One Zod schema (`schema.ts`) drives both the form (via `zodResolver`) and the server action (via `action.parse(unsafe)`).
- `result?.error` branches → `toast.error(message)`; success → `toast.success(message)`.
- `form.formState.isSubmitting` disables the submit button.
- Redirect-on-success is done by the server action calling `redirect()`; client doesn't navigate.

## Tables — TanStack Table + shadcn

For lists of users/events/services. shadcn's data-table recipe (https://ui.shadcn.com/docs/components/data-table) wraps `useReactTable` from `@tanstack/react-table`. Headless = we control rendering.

Common pattern:

```tsx
const columns: ColumnDef<UserListItem>[] = [
  { accessorKey: "displayName", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: "actions", cell: ({ row }) => <UserActionsMenu user={row.original} /> },
]

const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel() })

return <DataTable table={table} />  // shadcn wrapper around <Table>
```

Sorting, filtering, pagination, column visibility — all opt-in via `@tanstack/react-table` features.

## Layout / shell

The `app/(dashboard)/layout.tsx` already exists (iter-7b). For iter-14+, add a sidebar:

- `components/DashboardSidebar.tsx` — links to Users / Events / Services, gated by `<HasPermission>` per link.
- Sidebar layout uses shadcn's `Sheet` for mobile + a static aside for desktop.
- Active link via `usePathname()` + `cn()` conditional class.

## What's NOT in the stack

| Skipped | Reason |
|---|---|
| **Tremor** | Admin-dashboard lib but overlaps shadcn. We don't need its KPI/chart specialty. |
| **Mantine / Park UI / Chakra** | Different design systems; would clash with our brand tokens. |
| **`recharts`** | No charts in current spec. Add when needed. |
| **`@tanstack/react-query`** | Server actions + RSC handle our patterns. No client-side state machines. |
| **Storybook** | Overkill for a 1-developer admin app. |
| **`framer-motion` / `react-spring`** | `tw-animate-css` covers the few animations we'd want. |

## Conventions

- **Imports** — use the `@/` alias (`@/components/ui/button`). No relative `../../..` paths in feature code (relative within a feature folder is fine).
- **Component file naming** — PascalCase (`InviteUserForm.tsx`). shadcn's primitives ship lowercase (`button.tsx`); leave them as the CLI ships them.
- **Class merging** — always `cn(...)` from `lib/utils`. Never raw template strings with class concatenation.
- **Async server components** — fine. Pages are `async function Page()` that await queries directly.
- **Use `"use client"` only when needed** — forms, hooks, interactive widgets. Most of the admin UI is RSC.
