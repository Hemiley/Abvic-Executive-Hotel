import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { pool } from "./db";
import { seedAdmin } from "./seed";

const app = express();
app.use(express.json({ limit: "5mb" }));

const PgSession = connectPgSimple(session);

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
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

registerRoutes(app);

const port = 5000;

async function main() {
  await seedAdmin();

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

main();
