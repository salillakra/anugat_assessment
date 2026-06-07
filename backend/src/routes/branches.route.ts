import { Hono } from "hono";
import { BranchesController } from "../controllers/branches.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../../prisma/generated/prisma/client";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", BranchesController.list);
router.get("/:id", BranchesController.get);
router.post(
  "/",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  BranchesController.create,
);
router.put(
  "/:id",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  BranchesController.update,
);
router.delete("/:id", requireRole(UserRole.ADMIN), BranchesController.remove);

export { router as branchesRouter };
