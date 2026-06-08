import { Hono } from "hono";
import { ImportsController } from "../controllers/imports.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../../prisma/generated/prisma/client";

const router = new Hono();

router.use("*", authMiddleware);

// PDF Import
router.post(
  "/pdf",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  ImportsController.uploadPDF,
);

// CSV Import for any entity
router.post(
  "/csv/:entity",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  ImportsController.importCSV,
);
router.post(
  "/csv/:entity/preview",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  ImportsController.previewCSV,
);

// Job status
router.get("/jobs", ImportsController.listJobs);
router.get("/jobs/:id", ImportsController.getJob);
router.delete(
  "/jobs/:id",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  ImportsController.deleteJob,
);
router.post(
  "/jobs/:id/retry",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  ImportsController.retryJob,
);
router.post(
  "/jobs/:id/integrate",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  ImportsController.integrateJob,
);

export { router as importsRouter };
