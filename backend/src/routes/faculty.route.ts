import { Hono } from "hono";
import { FacultyController } from "../controllers/faculty.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { CsvImportService } from "../services/csv-import.service";
import { UserRole } from "../../prisma/generated/prisma/client";
import { ok } from "../utils/response";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", FacultyController.list);
router.get("/:id", FacultyController.get);
router.post(
  "/",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  FacultyController.create,
);
router.put(
  "/:id",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  FacultyController.update,
);
router.delete("/:id", requireRole(UserRole.ADMIN), FacultyController.remove);

router.post(
  "/import/csv",
  requireRole(UserRole.ADMIN, UserRole.HOD),
  async (c) => {
    const formData = await c.req.parseBody();
    const file = formData["file"];
    if (!file || typeof file === "string")
      return c.json({ success: false, error: "No file" }, 400);
    const csvText = new TextDecoder().decode(await file.arrayBuffer());
    const result = await CsvImportService.importFaculty(csvText);
    return ok(c, result);
  },
);

export { router as facultyRouter };
