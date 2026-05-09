---
title: Codebase audit — ChatGPT — 2026-05-09
type: audit
status: source
reviewer: chatgpt
created: 2026-05-09
tags: [audit, security, owasp, nextjs, review]
---

# Codebase audit — ChatGPT — 2026-05-09

Verbatim output as provided by user 2026-05-09. Preserved as a source document for the consolidated audit.

---

Repository review findings for wardrobe-assistants.ch

IMPORTANT:
- This review was primarily static/source-based.
- Build/test execution could not be fully verified in the current environment.
- Findings below should be validated directly in the local development environment and CI.

==================================================
TOP FINDINGS
==================================================

[HIGH] Supply-chain risk in GitHub Actions workflows
Evidence:
- CI/CD workflows use mutable action references, including:
  - BunnyWay/actions/container-update-image@main
  - other actions pinned only to version tags like @v4 or @v6
- Production deployment should never rely on mutable references.

Why it matters:
- A compromised upstream GitHub Action could compromise deployments or secrets.
- Mutable tags can change unexpectedly and are not reproducible.

Recommended fix:
- Pin every GitHub Action to a full commit SHA.
- Avoid @main entirely.
- Prefer verified publishers and minimal permissions.

Files:
- .github/workflows/deploy.yml

==================================================

[HIGH] CI does not execute full repository verification
Evidence:
- Root package.json defines:
  - npm run verify = lint + typecheck + test
- CI currently runs typecheck/test/build but skips lint.

Why it matters:
- Formatting/lint/security rules enforced by Biome may never block merges.
- Inconsistent local vs CI validation.

Recommended fix:
- Replace CI validation with:
  npm run verify
- Or explicitly add:
  npm run lint

Files:
- package.json
- .github/workflows/deploy.yml

==================================================

[MEDIUM] Missing explicit security headers and CSP
Evidence:
- next.config.ts files do not define:
  - Content-Security-Policy
  - Permissions-Policy
  - Referrer-Policy
  - HSTS
  - frame protection

Why it matters:
- Increased XSS and clickjacking risk.
- Weak browser hardening posture.

Recommended fix:
- Add CSP and hardened security headers either:
  - in Next.js headers()
  - or at CDN/reverse proxy/container ingress level
- Include:
  - strict CSP
  - frame-ancestors 'none'
  - Referrer-Policy
  - Permissions-Policy
  - HSTS

Files:
- apps/admin/next.config.ts
- apps/homepage/next.config.ts

==================================================

[MEDIUM] Internal/provider errors are exposed to users
Evidence:
- Server actions and email handling return provider/internal messages.
- Example:
  "Resend send failed: ${error.message}"

Why it matters:
- Leaks infrastructure/provider details.
- Can expose operational information useful for attackers.

Recommended fix:
- Log detailed errors server-side only.
- Return generic user-facing errors:
  - "Failed to send email"
  - "Unexpected server error"
- Add structured server logging with correlation IDs.

Files:
- apps/admin/src/features/users/server/actions.ts
- apps/admin/src/lib/email.ts

==================================================

[MEDIUM] Query-level authorization is incomplete
Evidence:
- Dashboard layout validates session presence.
- Data query functions themselves do not consistently enforce permissions.
- listUsers/getUserById/listEvents/getEventById query data directly.

Why it matters:
- Future reuse of these queries outside protected routes may bypass authorization.
- Defense-in-depth is missing.

Recommended fix:
- Add assertPermission() checks directly inside all sensitive query functions.
- Treat queries as security boundaries, not only routes/layouts.

Files:
- apps/admin/src/app/(dashboard)/layout.tsx
- apps/admin/src/features/users/server/queries.ts
- related event query modules

==================================================

[MEDIUM] No automated dependency/container/security scanning
Evidence:
- CI lacks:
  - npm audit
  - osv-scanner
  - CodeQL
  - Trivy
  - Dependabot
  - secret scanning

Why it matters:
- Vulnerable dependencies or containers may reach production unnoticed.

Recommended fix:
- Add:
  - Dependabot
  - GitHub CodeQL
  - npm audit --omit=dev
  - OSV scanning
  - Trivy container scanning
  - secret scanning

Files:
- .github/workflows/*
- repository settings

==================================================

[LOW] requireEmailVerification is disabled
Evidence:
- Better Auth config:
  requireEmailVerification: false

Why it matters:
- May be acceptable for invite/reset-password onboarding.
- Needs explicit security justification and tests.

Recommended fix:
- Document the intended onboarding/security flow.
- Ensure invite tokens are short-lived and single-use.
- Add tests for onboarding flows.

Files:
- apps/admin/src/lib/auth.ts

==================================================

[LOW] skipLibCheck reduces dependency type-safety coverage
Evidence:
- tsconfig.base.json:
  skipLibCheck: true

Why it matters:
- Dependency typing issues may be hidden.

Recommended fix:
- Optionally keep for build performance.
- Add periodic full typecheck job with skipLibCheck disabled.

Files:
- tsconfig.base.json

==================================================
POSITIVE FINDINGS
==================================================

Strong practices already present:
- Strict TypeScript configuration
- noUncheckedIndexedAccess enabled
- Centralized Zod environment validation
- Secure cookie defaults
- Permission wrapper around server mutations
- Clear admin/homepage separation
- robots no-index for admin
- Workspace boundaries enforced with Biome
- Good monorepo structure
- Drizzle ORM reduces SQL injection risk
- React Compiler enabled intentionally
- Static export for homepage is appropriate
- Server-side auth/session checks exist

==================================================
OWASP REVIEW SUMMARY
==================================================

Strong areas:
- Input validation
- Mutation authorization
- ORM safety
- Environment validation
- Cookie configuration
- Basic auth/session handling

Weak areas:
- Supply-chain security
- Security headers/CSP
- Automated vulnerability scanning
- Error exposure
- Defense-in-depth authorization
- Monitoring/audit logging
- Rate limiting visibility
- Container security scanning

==================================================
RECOMMENDED NEXT ACTIONS (PRIORITIZED)
==================================================

1. Pin all GitHub Actions to immutable SHAs
2. Add npm run verify to CI
3. Add CSP and hardened security headers
4. Add query-level authorization checks
5. Stop exposing provider/internal error messages
6. Add CodeQL/Dependabot/npm audit/Trivy
7. Add structured audit/security logging
8. Review rate limiting and abuse protection
9. Add security-focused tests for auth and permissions
10. Review Server Actions for CSRF/origin protections

==================================================
ADDITIONAL THINGS TO REVIEW DEEPLY
==================================================

Claude should additionally inspect:

- All Server Actions for:
  - auth
  - authorization
  - CSRF/origin enforcement
  - unsafe redirects
  - serialization leaks

- All route handlers for:
  - permission checks
  - cache safety
  - error leakage

- Middleware:
  - route protection consistency
  - redirect loops
  - auth bypass edge cases

- Database:
  - migration safety
  - unique constraints
  - cascade delete risks
  - tenant isolation assumptions

- Frontend:
  - unnecessary "use client"
  - hydration mismatches
  - accessibility
  - keyboard navigation
  - shadcn component customizations

- Performance:
  - client bundle size
  - image optimization
  - caching correctness
  - Lighthouse regressions

- Infrastructure:
  - Docker hardening
  - Terraform/OpenTofu safety
  - secret handling
  - production environment isolation
