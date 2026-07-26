# Security audit — 2026-07-26

## Scope and threat model

The audit covered tracked application code and Git history, Cloudflare Worker and D1
configuration, every custom API route, Better Auth integration, the npm manifest and
lockfile, and GitHub Actions. The review focused on unauthorized account or data access,
secret exposure, untrusted request handling, dependency-chain compromise, and protected
route enforcement.

## Executive summary

One critical privilege-escalation path and four high-priority hardening gaps were fixed.
No committed production secret or Supabase client was found. The application uses a
server-only Cloudflare D1 binding rather than a browser-accessible Supabase REST endpoint,
so PostgreSQL row-level security is not applicable. User-owned prediction and profile
queries bind the authenticated Better Auth user ID, while intentionally public leaderboard
and completed-result data remain public.

## Findings and remediation

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | An email in `ADMIN_EMAILS` received administrator privileges even when Better Auth marked it unverified. If transactional email was absent, an attacker could register an allowlisted address and become an administrator. | All configured and delegated administrator access now requires `emailVerified`. Unverified users cannot be promoted. |
| High | `/admin` relied on client rendering while only its APIs enforced authorization. | A Next.js 16 `proxy.ts` performs a full server-side session and role lookup, and the server component repeats the check as the authorization boundary. API guards remain in place. |
| High | Mutation routes coerced untrusted JSON values and several routes accepted malformed or unbounded bodies. | Shared streamed JSON parsing now enforces `application/json`, UTF-8, object shape, and byte limits. Prediction, profile, radar, publication, and role-update inputs use strict server-side types, ranges, formats, and referential checks. |
| High | Direct build dependencies included versions covered by current npm advisories. GitHub Actions used movable major tags. | Better Auth, Next.js, Cloudflare tooling, Vite, Wrangler, PostCSS, Sharp, and related lockfile entries were updated. CI actions are pinned to commit SHAs and CI rejects high-severity required-production advisories. |
| Medium | Responses lacked a consistent baseline of browser security headers, and authenticated API responses were not explicitly non-cacheable at the Worker boundary. | The Worker now adds anti-framing, MIME sniffing, referrer, permissions, HSTS, and restrictive CSP directives. Private API surfaces receive `Cache-Control: private, no-store`. |
| Low | Authentication email failures embedded up to 300 bytes of the provider response in thrown errors. | Provider response bodies are no longer propagated. |

## Five-pillar result

### Exposed keys

- No production-looking API key, private key, token, or password was found in the tracked
  tree or matching Git history.
- Only `.dev.vars.example` is tracked. `.dev.vars`, `.env`, logs, build output, and local
  Cloudflare state are ignored.
- Runtime credentials are consumed only from `cloudflare:workers` environment bindings.
- Operators must store `BETTER_AUTH_SECRET`, OAuth credentials, and Resend credentials as
  Worker secrets or in the ignored local `.dev.vars`.

### Database isolation / RLS

- Supabase is not used. D1 has no public client endpoint or PostgreSQL RLS facility.
- The D1 binding is imported only by server routes, server components, auth helpers, and the
  Worker.
- Prediction reads and writes use `session.user.id`; profile reads, updates, and deletion do
  the same.
- Public player pages filter out pending and unscored predictions by design.

### Server-side validation

- Every custom mutation that accepts a body now rejects wrong media types, oversized bodies,
  invalid UTF-8, malformed JSON, arrays/primitives, type coercion, invalid dates, and invalid
  identifiers before database work.
- Existing authorization, kickoff locking, squad membership, team membership, avatar magic
  byte, Soccerverse identity, and prediction-consistency checks remain server-side.
- Better Auth continues to validate its own mounted authentication routes.

### Package legitimacy and supply chain

- Every direct dependency resolved from the official npm registry and none is marked
  deprecated.
- `npm audit signatures` verified registry signatures for 522 installed packages and
  provenance attestations for 136 packages.
- `npm audit --omit=dev --omit=optional` reports zero vulnerabilities.
- The remaining full-tree audit findings are development-only dependency paths in ESLint and
  Drizzle Kit. npm's proposed fixes require breaking major-version changes or a Drizzle Kit
  downgrade; these were not applied because they do not ship in the Worker and would create
  greater compatibility risk.

### Authentication middleware

- `/admin/:path*` is protected by full session validation and database-backed role lookup in
  `proxy.ts`.
- The `/admin` server component repeats the same authorization check.
- Every `/api/admin/*` route retains its own `requireAdmin` check, so neither proxy nor page
  protection is treated as the sole security boundary.

## Validation

- TypeScript typecheck
- ESLint
- 57 Node unit and security-regression tests
- vinext production build on Vite 8.1
- required-production npm audit: zero vulnerabilities
- npm registry signature and provenance verification
- secret-pattern scan of the working tree and Git history

## Residual risks and operational follow-up

1. Configure Resend before relying on password accounts for administrators; unverified
   accounts are now safely denied.
2. Rotate any credential separately if there is evidence it was exposed outside Git. This
   repository audit found no committed credential to rotate.
3. Revisit the development-only ESLint and Drizzle Kit advisories when their upstream
   dependency trees publish non-breaking fixes.
4. D1 authorization depends on keeping the binding server-only. Do not introduce a generic
   SQL or data-proxy route without per-operation authorization.
