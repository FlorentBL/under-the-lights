# Under the Lights — Repository Instructions

## Canonical delivery target

- The canonical branch is `main`.
- The only production URL is `https://under-the-lights.flobl.workers.dev/`.
- Production is hosted on Cloudflare Workers through the repository's Wrangler configuration.
- Do not create or use an alternative production host, preview URL, or Sites/Vercel deployment unless the user explicitly requests it.

## Definition of done

For any requested implementation, fix, or release, the work is not complete until all of the following are true:

1. The work is based on the latest `origin/main`. Fetch and inspect divergence before integrating changes.
2. Relevant checks pass, including typecheck, lint, unit tests, build, and the security audit when dependencies or security-sensitive code are involved.
3. Required D1 migrations are applied locally and remotely in their intended order.
4. The finished changes are committed, pushed, and merged into `main`. A feature branch or open pull request is an intermediate state, not the final delivery.
5. The local `main` and `origin/main` resolve to the same commit.
6. Deployment is run from that exact `main` commit with `npm run deploy`.
7. `https://under-the-lights.flobl.workers.dev/` is checked after deployment for a successful response and for the behavior changed by the task.

Never report a change as “live”, “finished”, or “delivered” when it exists only on another branch, in an unmerged pull request, or on another deployment URL.

## Safe integration

- Preserve unrelated user work and inspect the worktree before switching branches.
- If local `main` diverges from `origin/main`, preserve the local history on an archive branch before aligning it; do not silently discard commits.
- Keep merged security protections and database migrations when reconciling branches.
- A temporary working branch and pull request are allowed, but complete the merge into `main` unless the user explicitly requests a draft, local-only work, no deployment, or another stopping point.
- If permissions, checks, conflicts, or an external service prevent merging or deploying, state the blocker clearly instead of claiming completion.

## Production verification

At minimum, confirm:

- local `main` commit equals `origin/main`;
- the Cloudflare deployment command succeeds and returns the production Worker URL;
- the production URL responds successfully;
- the task's user-visible behavior or API output is present in production;
- security headers remain present after security-related changes.
