import { Hono } from "hono";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../../prisma/generated/prisma/client";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/summary", AnalyticsController.summary);
router.get("/room-utilisation", AnalyticsController.roomUtilisation);
router.get("/empty-room-probability", AnalyticsController.emptyRoomProbability);
router.get("/under-running-courses", AnalyticsController.underRunningCourses);
router.get("/avg-empty-hours", AnalyticsController.avgEmptyHours);

export { router as analyticsRouter };
