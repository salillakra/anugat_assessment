import { Hono } from "hono";
import { RoomsController } from "../controllers/rooms.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { CsvImportService } from "../services/csv-import.service";
import { UserRole } from "../../prisma/generated/prisma/client";
import { ok } from "../utils/response";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", RoomsController.list);
router.get("/:id", RoomsController.get);
router.post(
  "/",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  RoomsController.create,
);
router.put(
  "/:id",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  RoomsController.update,
);
router.delete("/:id", requireRole(UserRole.ADMIN), RoomsController.remove);

router.post(
  "/import/csv",
  requireRole(UserRole.ADMIN, UserRole.COORDINATOR),
  async (c) => {
    const formData = await c.req.parseBody();
    const file = formData["file"];
    if (!file || typeof file === "string")
      return c.json({ success: false, error: "No file" }, 400);
    const csvText = new TextDecoder().decode(await file.arrayBuffer());
    const result = await CsvImportService.importRooms(csvText);
    return ok(c, result);
  },
);

export { router as roomsRouter };
