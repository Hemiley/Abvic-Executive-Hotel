---
name: tsx dev server has no watch mode
description: Server-side code edits don't hot-reload in this project; symptom is new/changed API routes returning the Vite HTML fallback instead of JSON.
---

The "Start application" workflow runs `NODE_ENV=development tsx server/index.ts` — no `--watch` flag. Vite's dev middleware handles client-side HMR, but the Express server process itself does not restart on file changes.

**Why:** After editing `server/routes.ts` (or any server file) and testing immediately via curl, a newly added route can appear to not exist — the request falls through to Vite's catch-all and returns the client's `index.html` (200, `Content-Type: text/html`) instead of a 404 or the expected JSON. This looks like a routing bug but is actually just stale server code still running.

**How to apply:** After any server-side (non-client) file edit, restart the "Start application" workflow before testing new/changed backend behavior via curl or API calls. Client-only edits (React components, CSS) don't need a restart — Vite HMR picks those up live.
