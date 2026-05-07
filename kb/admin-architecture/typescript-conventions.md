---
title: TypeScript conventions — strict-plus, tsconfig.base.json
type: architecture
status: current
---

# TypeScript conventions

## Strictness bundle

Beyond `strict: true` (the baseline), the project enables:

| Flag | Why |
|---|---|
| `noUncheckedIndexedAccess: true` | `arr[0]` becomes `T \| undefined`. Catches "I assumed this array had elements." Biggest leverage flag. Worth the friction. |
| `noFallthroughCasesInSwitch: true` | Costless safety on switch statements. |
| `noImplicitReturns: true` | Functions with any `return` must return on every path. |
| `verbatimModuleSyntax: true` | Forces `import type` for type-only imports. Better tree-shaking, clearer intent. Replaces deprecated `importsNotUsedAsValues`. |

## Skipped

| Flag | Why skipped |
|---|---|
| `exactOptionalPropertyTypes` | High false-positive rate fighting Drizzle `$inferInsert` and React component prop conventions where `key: undefined` is ubiquitous. |
| `noImplicitOverride` | We have no classes. |
| `noPropertyAccessFromIndexSignature` | Marginal benefit; minor friction. |
| `noUnusedLocals` / `noUnusedParameters` | Biome catches these with auto-fix. Don't double up. |

## Root `tsconfig.base.json`

A single file at the repo root. Per-package configs extend it; only what differs (lib, jsx, paths, includes, plugins) lives per-package.

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,

    // strict-plus
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "verbatimModuleSyntax": true
  }
}
```

Per-package shape:

```jsonc
// apps/admin/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Migration cost (when iter-14 enables this)

`noUncheckedIndexedAccess` will surface a handful of warnings — mostly array destructuring after queries:

```ts
// before
const [first] = await db.select(...).limit(1)
first.id // ← now an error: first might be undefined

// after
const rows = await db.select(...).limit(1)
const first = rows[0]
if (!first) throw new Error("…")
first.id
// or
const first = rows.at(0)
if (first === undefined) ...
```

`verbatimModuleSyntax` will surface `import { Foo }` that should be `import type { Foo }`. Auto-fixed by Biome's `useImportType` rule.

Estimated cleanup time: 15–30 minutes once enabled.

## Conventions worth following

### `import type` for type-only imports

```ts
// good
import type { UserListItem } from "@/features/users/schema"
import { listUsers } from "@/features/users/server/queries"

// bad
import { UserListItem, listUsers } from "..."  // type-only re-exports break
```

`verbatimModuleSyntax` enforces this.

### Prefer `unknown` over `any` at boundaries

Server-action input is `unknown`, parsed by Zod. Don't use `any` to bypass Zod — defeats the entire validation layer.

### Discriminated unions for action results

```ts
type ActionResult =
  | { error: false; message: string }
  | { error: true; message: string }
```

The discriminator (`error` boolean) lets callers narrow without optional chaining gymnastics.

### `satisfies` over `: Type` when literal inference matters

```ts
// preserves the literal types of keys/values
const ROLE_PERMISSIONS = {
  ADMIN: new Set([...]),
  SQUAD_MEMBER: new Set([...]),
} satisfies Record<Role, ReadonlySet<Permission>>

// vs (loses the literal info)
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {...}
```

### Branded types for IDs

Optional. If we ever need to prevent "passed `eventId` where `userId` was expected," brand them:

```ts
export type UserId = string & { readonly __brand: "UserId" }
export type EventId = string & { readonly __brand: "EventId" }
```

Adopt only when a real bug from cross-typed IDs surfaces. Premature today.

## Things to avoid

- `as` casts that bypass type narrowing (use `as unknown as Foo` if you really must, and add a comment).
- `// @ts-expect-error` without a comment explaining why. Better: actually fix the type.
- TypeScript enums (use `as const` arrays).
- Default exports (named exports compose better with refactor tooling).
