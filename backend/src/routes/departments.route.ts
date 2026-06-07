import { Hono } from "hono";
import { DepartmentsController } from "../controllers/departments.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { CsvImportService } from "../services/csv-import.service";
import { UserRole } from "../../prisma/generated/prisma/client";
import { ok } from "../utils/response";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", DepartmentsController.list);
router.get("/:id", DepartmentsController.get);

router.post("/", requireRole(UserRole.ADMIN), DepartmentsController.create);
router.put("/:id", requireRole(UserRole.ADMIN), DepartmentsController.update);
router.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  DepartmentsController.remove,
);

// CSV import
router.post("/import/csv", requireRole(UserRole.ADMIN), async (c) => {
  const formData = await c.req.parseBody();
  const file = formData["file"];
  if (!file || typeof file === "string") {
    return c.json({ success: false, error: "No file uploaded" }, 400);
  }
  const csvText = new TextDecoder().decode(await file.arrayBuffer());
  const result = await CsvImportService.importDepartments(csvText);
  return ok(c, result);
});

export { router as departmentsRouter };
