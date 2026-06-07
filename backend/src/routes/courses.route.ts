import { Hono } from "hono";
import { CoursesController } from "../controllers/courses.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { CsvImportService } from "../services/csv-import.service";
import { UserRole } from "../../prisma/generated/prisma/client";
import { ok } from "../utils/response";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", CoursesController.list);
router.get("/:id", CoursesController.get);
router.post(
  "/",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  CoursesController.create,
);
router.put(
  "/:id",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  CoursesController.update,
);
router.delete("/:id", requireRole(UserRole.ADMIN), CoursesController.remove);

router.post("/import/csv", requireRole(UserRole.ADMIN), async (c) => {
  const formData = await c.req.parseBody();
  const file = formData["file"];
  if (!file || typeof file === "string")
    return c.json({ success: false, error: "No file" }, 400);
  const csvText = new TextDecoder().decode(await file.arrayBuffer());
  const result = await CsvImportService.importCourses(csvText);
  return ok(c, result);
});

export { router as coursesRouter };
