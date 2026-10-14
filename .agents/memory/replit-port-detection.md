---
name: Replit port detection
description: A workflow-specific port detection failure observed while the application itself could serve requests.
---

When the `Start application` workflow times out despite logging that it is listening on port 5000, do not assume the application code is broken. A manually started `npm run dev` process bound successfully and returned HTTP 200 from `/api/health`, while repeated workflow starts still failed to register port 5000.

**Why:** Repeated retries only killed a healthy server after the workflow timeout; the app's port and health endpoint were correct.

**How to apply:** Check listeners and `curl http://127.0.0.1:5000/api/health` during diagnosis. If the server is healthy but workflow detection fails again, stop retrying and report the Replit forwarding issue.
