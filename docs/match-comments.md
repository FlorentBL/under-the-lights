# Match comments

Signed-in users can comment on the weekly Spotlight match — before kick-off and after the result. Plain text only (emoji work, since comments are stored and rendered as UTF-8 text). No media uploads or GIFs by design.

## Where things live

| Concern | File |
| --- | --- |
| Validation rules and limits | `lib/comments.ts` |
| API (GET/POST/PATCH/DELETE) | `app/api/comments/route.ts` |
| UI component | `app/match-comments.tsx` (rendered by `SpotlightView` in `app/under-the-lights-app.tsx`) |
| Schema | `match_comments` in `db/schema.ts` |
| Migrations | `drizzle/0013_match_comments.sql`, `drizzle/0014_comment_moderation.sql` |
| Styles | `.match-comments` block in `app/globals.css` |
| Translations | `additionalTranslations` in `lib/i18n.tsx` (fr/it/es/de; English keys are the fallback) |
| Unit tests | `tests/comments.test.mjs` |

## Permission model

- **Read**: public, no session required. Latest 100 non-deleted comments per match.
- **Write**: signed-in users only, and only on the currently published Spotlight match (same `publishedMatch` guard as predictions).
- **Edit**: the author only (`PATCH`). Admins cannot edit other people's words.
- **Delete**: admins only (`requireAdmin` from `lib/admin-auth`). Authors cannot delete their own comments; they can edit them.
- **Banned users**: banning (admin panel → users) deletes all active sessions and blocks new ones (`lib/auth.ts` session hook), so banned users cannot comment. There is intentionally no separate comment-only mute.

## Audit trail

Deletes are soft: rows are never removed, so the full history stays queryable in D1.

- `created_at` + `user_id` — who wrote it and when.
- `updated_at` — set on every author edit; the UI shows an "edited" marker when present.
- `deleted_at` + `deleted_by` — set by admin deletion; listings filter on `deleted_at IS NULL`.

Note: `user_id` has `ON DELETE cascade`, so deleting a user account removes their comment rows entirely.

## Abuse protection

All limits are constants in `lib/comments.ts`:

- `MAX_COMMENT_LENGTH` (1000 chars after trim; enforced server-side and via textarea `maxLength`).
- `COMMENT_COOLDOWN_MS` (30 s between posts per account).
- `COMMENT_DAILY_LIMIT` / `COMMENT_DAILY_WINDOW_MS` (20 posts per account per 24 h; soft-deleted rows still count).
- `parseCommentBody` strips control characters and normalizes CRLF; rejects empty/non-string bodies.
- Request bodies go through `readJsonObject` (content-type + size limits from `lib/request-validation.ts`).

Injection safety: every query uses D1 prepared statements with `.bind()` (no string-built SQL), and the body renders as a React text node (auto-escaped — never use `dangerouslySetInnerHTML` here). Comment text must always be treated as untrusted user input.

## Conventions worth knowing before changing this

- `matchId` is `String(fixture_id)` — the same text key `predictions` and `match_results` use.
- `participants.id === user.id`. Author display name prefers `participants.display_name` (the leaderboard name) over `user.name`; avatars reuse the leaderboard logic (`publicAvatarUrl` when a custom avatar exists, else the auth image).
- Migrations `0002`+ are hand-written SQL applied with `wrangler d1 migrations apply` (`npm run db:migrate:local` / `db:migrate:remote`). Do **not** run `drizzle-kit generate` — the drizzle snapshots stopped at `0001` and it would diff against stale state.
- New UI strings: add the English key in the component, then translations for all four languages in `additionalTranslations`.

## Deliberate omissions (decide before adding)

- **GIFs/media**: would require upload storage or a third-party embed (external requests are a data-privacy decision, see `docs/security-audit-2026-07.md`).
- **Comment-only mute**: banning covers moderation today; a mute would need a new table or flag plus admin UI.
- **Pagination**: capped at the latest 100; add paging before raising the cap.
