import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { buildOpenApiDocument } from "./lib/openapi";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import mediaRoutes from "./modules/media/media.routes";
import postsRoutes from "./modules/posts/posts.routes";
import commentsRoutes from "./modules/comments/comments.routes";
import feedRoutes from "./modules/feed/feed.routes";
import storiesRoutes from "./modules/stories/stories.routes";
import conversationsRoutes from "./modules/conversations/conversations.routes";
import { startArchiveJob } from "./jobs/archiveExpiredStories";
import { initSocket } from "./socket";

const app = express();

// ── GLOBAL MIDDLEWARE ─────────────────────────────────────────
// Thứ tự middleware QUAN TRỌNG. Express chạy theo thứ tự khai báo.

// 1. Security headers (X-Frame-Options, CSP, ...)
app.use(helmet());

// 2. CORS — allows frontend call API
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// 3. Parse JSON body (giới hạn 10MB phòng request lớn)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 4. Request logging
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
}

// ── ROUTES ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

if (env.NODE_ENV !== "production") {
  const openApiDoc = buildOpenApiDocument();
  app.get("/docs/json", (_req, res) => {
    res.json(openApiDoc);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));
}

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/media", mediaRoutes);
app.use("/posts", postsRoutes);
app.use("/comments", commentsRoutes);
app.use("/feed", feedRoutes);
app.use("/stories", storiesRoutes);
app.use("/conversations", conversationsRoutes);

// ── ERROR HANDLERS ────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── START SERVER ──────────────────────────────────────────────
const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`🚀 Server chạy tại http://${env.HOST}:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  if (env.NODE_ENV !== "production") {
    console.log(`📚 API docs:   http://localhost:${env.PORT}/docs`);
  }
});

// Phase 4.4 — hourly cron flipping isArchived on expired stories (runs immediately too).
const archiveJob = startArchiveJob();

// Phase 5.2 — attach Socket.io to the same HTTP server (realtime messaging: message:new,
// typing, presence, read receipts). app.listen() returns an http.Server, so no separate
// http.createServer() is needed.
const io = initSocket(server, env.CORS_ORIGIN);

// Graceful shutdown — đóng kết nối DB, server khi nhận signal kill
const shutdown = (signal: string) => {
  console.log(`\n${signal} nhận được, đang đóng server...`);
  clearInterval(archiveJob);
  io.close();
  server.close(() => {
    console.log("Server đã đóng.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
