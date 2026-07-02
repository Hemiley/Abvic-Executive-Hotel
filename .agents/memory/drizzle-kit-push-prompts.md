---
name: drizzle-kit push interactive prompts
description: How to avoid drizzle-kit push getting stuck on rename-detection prompts when replacing a schema wholesale
---

When a schema is replaced wholesale (e.g. swapping an entire domain model), `drizzle-kit push` tries to be helpful by detecting whether a new table might actually be a rename of an existing unrelated table. It presents an interactive "Is X created or renamed from Y?" prompt.

This prompt cannot reliably be answered via piped stdin (`yes ''`, `printf '\n'`, etc.) in this environment — the process either hangs or exits abnormally.

**Why:** drizzle-kit's interactive CLI prompt library doesn't play well with non-TTY piped input here, so scripting around it is unreliable.

**How to apply:** Before running `drizzle-kit push` after a full schema replacement, manually `DROP TABLE ...CASCADE` any old/unrelated tables (including things like a leftover `session` table from `connect-pg-simple`, which will be auto-recreated at runtime) so there's nothing left for drizzle-kit to consider renaming. Then the push runs non-interactively and applies cleanly.
