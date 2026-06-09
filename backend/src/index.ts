import { Hono } from "hono";
import { cors } from "hono/cors";
import { Server as SocketIOServer } from "socket.io";
import { Server as BunEngine } from "@socket.io/bun-engine";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { correlationIdMiddleware } from "./utils/correlation";
import { errorHandler } from "./middleware/error.middleware";
import { SocketManager } from "./socket/socket";
import { startTimetableProcessingWorkers } from "./workers/timetable";

// Routes
import { authRouter } from "./routes/auth.route";
import { healthRouter } from "./routes/health.route";
import { analyticsRouter } from "./routes/analytics.route";
import { departmentsRouter } from "./routes/departments.route";
import { roomsRouter } from "./routes/rooms.route";
import { coursesRouter } from "./routes/courses.route";
import { facultyRouter } from "./routes/faculty.route";
import { branchesRouter } from "./routes/branches.route";
import { timetablesRouter } from "./routes/timetables.route";
import { importsRouter } from "./routes/imports.route";

const app = new Hono();

// socket.io setup
const engine = new BunEngine({
  cors: {
    origin: env.FRONTEND_URL.split(",").map((url) => url.trim()),
    credentials: true,
  },
});
const io = new SocketIOServer({
  cors: {
    origin: env.FRONTEND_URL.split(",").map((url) => url.trim()),
    credentials: true,
  },
});
io.bind(engine);
SocketManager.init(io);

// background workers
logger.info("Starting BullMQ timetable processing workers...");
startTimetableProcessingWorkers();

// global middleware
app.use("*", correlationIdMiddleware);
app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL.split(",").map((url) => url.trim()),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Correlation-ID",
      "X-Requested-With",
    ],
    credentials: true,
    maxAge: 86400,
  }),
);

// routes
app.get("/", (c) =>
  c.json({
    success: true,
    message: "Samayak Admin Panel API",
    version: "1.0.0",
    env: env.NODE_ENV,
  }),
);

app.route("/api/health", healthRouter);
app.route("/api/auth", authRouter);
app.route("/api/analytics", analyticsRouter);
app.route("/api/departments", departmentsRouter);
app.route("/api/rooms", roomsRouter);
app.route("/api/courses", coursesRouter);
app.route("/api/faculty", facultyRouter);
app.route("/api/branches", branchesRouter);
app.route("/api/timetables", timetablesRouter);
app.route("/api/imports", importsRouter);

// global error handler
app.onError(errorHandler);

// spinning the server
logger.info(`Samayak API starting on port ${env.PORT}...`);

const { websocket } = engine.handler();

export default {
  port: env.PORT,
  idleTimeout: 30,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/socket.io/")) {
      return engine.handleRequest(req, server);
    }
    return app.fetch(req, server);
  },
  websocket,
};
