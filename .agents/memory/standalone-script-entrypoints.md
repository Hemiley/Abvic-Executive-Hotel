---
name: Standalone seed/setup scripts need a main-module guard
description: tsx-run scripts that only export a function silently no-op; must invoke the function when run directly
---

A script intended to be run directly (e.g. `npx tsx server/seed.ts`) but written as `export async function seedAdmin() {...}` with no call site produces zero output and does nothing — `tsx` happily runs the file, the function is defined, but it's never invoked.

**Why:** it's easy to write the setup logic as an importable/reusable function (so `server/index.ts` can also call it on boot) and forget that direct CLI execution needs its own trigger.

**How to apply:** add a `const isMainModule = process.argv[1]?.endsWith("seed.ts"); if (isMainModule) { seedAdmin().then(() => process.exit(0)).catch(...) }` block at the bottom so the same file works both as an import and as a standalone CLI entrypoint. Verify by checking for expected console output / DB rows after running, not just a clean exit code.
