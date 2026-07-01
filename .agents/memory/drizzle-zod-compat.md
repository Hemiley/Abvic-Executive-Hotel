---
name: Drizzle Zod compatibility
description: drizzle-zod version mismatches with drizzle-orm cause runtime import errors (e.g. missing export like getViewSelectedFields), not build-time errors.
---

When installing `drizzle-zod` alongside `drizzle-orm`, npm can resolve a `drizzle-zod` version that expects exports from a newer/older `drizzle-orm` than what's installed. This surfaces as a `SyntaxError: The requested module 'drizzle-orm' does not provide an export named 'X'` at server startup, not at install time.

**Why:** These two packages evolve in lockstep but are installed independently; there's no peer-dependency enforcement that reliably prevents skew in this environment.

**How to apply:** For simple CRUD apps, skip `drizzle-zod` entirely and hand-write the zod validation schema next to the Drizzle table definition. Only reach for `drizzle-zod` if schema-to-zod generation is a real time-saver, and pin exact compatible versions if so.
