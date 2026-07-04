import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { pool } from "./db";
import { ensureSchema } from "./ensure-schema";
import { seedAdmin } from "./seed";

const app = express();
app.use(express.json({ limit: "5mb" }));

const PgSession = connectPgSimple(session);

const isProd = process.env.NODE_ENV === "production";

// ── Startup environment check ──────────────────────────────────────────────
const missingVars: string[] = [];
if (!process.env.DATABASE_URL) missingVars.push("DATABASE_URL");
if (isProd && !process.env.SESSION_SECRET) missingVars.push("SESSION_SECRET");

if (missingVars.length > 0) {
  console.error("==========================================================");
  console.error(" FATAL: Required environment variable(s) not set:");
  missingVars.forEach((v) => console.error(`   • ${v}`));
  console.error("");
  console.error(" Add these in your hosting provider's Variables/Secrets tab.");
  console.error(" SESSION_SECRET: any long random string (32+ chars).");
  console.error(" DATABASE_URL:   PostgreSQL connection string.");
  console.error("==========================================================");
  process.exit(1);
}

// Always trust the Replit proxy (it terminates TLS for all environments)
app.set("trust proxy", 1);

// Detect whether we are running inside the Replit hosted environment
// (both dev preview and deployed production run behind Replit's HTTPS proxy)
const behindReplitProxy = !!process.env.REPLIT_DEV_DOMAIN || !!process.env.REPLIT_DEPLOYMENT_ID;

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Mark secure whenever we're behind the Replit HTTPS proxy or in production
      secure: isProd || behindReplitProxy,
      // SameSite=none is required for cookies to be sent in the Replit proxied
      // iframe preview; fall back to lax for plain localhost development
      sameSite: behindReplitProxy ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ── Async error safety ────────────────────────────────────────────────────────
// Express 4 does not auto-forward thrown errors from async route handlers.
// In Node ≥ 15 an unhandled rejection crashes the process; in the Replit proxy
// that manifests as "Application failed to respond".
// Patch the router methods so every handler is wrapped with .catch(next).
(["get", "post", "put", "patch", "delete"] as const).forEach((method) => {
  const original = (app as any)[method].bind(app);
  (app as any)[method] = (...args: any[]) => {
    const patched = args.map((h) =>
      typeof h === "function"
        ? (req: any, res: any, next: any) => {
            try {
              const result = h(req, res, next);
              if (result && typeof result.catch === "function") result.catch(next);
            } catch (err) {
              next(err);
            }
          }
        : h
    );
    return original(...patched);
  };
});

// Belt-and-suspenders: log any rejection that still slips through without
// crashing the process (Node ≥ 15 turns these into fatal exits by default).
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (non-fatal):", reason);
});

registerRoutes(app);

// Global error handler — catches unhandled async errors forwarded via next(err)
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({ message: err.message ?? "Internal server error" });
});

const port = Number(process.env.PORT) || 5000;

async function main() {
  // Ensure all tables exist before anything else runs.
  // This is idempotent — safe to run on every boot, no drizzle-kit needed.
  try {
    await ensureSchema();
  } catch (err: any) {
    console.error("Schema setup failed:", err?.message ?? err);
    process.exit(1);
  }

  // Seed initial data — wrapped so a seed failure is logged but doesn't
  // prevent the HTTP server from starting (avoids a crash loop).
  try {
    await seedAdmin();
  } catch (err: any) {
    console.error("Seed error (non-fatal):", err?.message ?? err);
  }

  if (process.env.NODE_ENV === "development") {
    const http = await import("http");
    const httpServer = http.createServer(app);

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        allowedHosts: true as any,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);

    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } else {
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.resolve(__dirname, "public");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
