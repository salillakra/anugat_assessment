import { Hono } from "hono";
import { TimetablesController } from "../controllers/timetables.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = new Hono();

router.use("*", authMiddleware);

router.get("/", TimetablesController.list);
router.get("/:id/grid", TimetablesController.getGrid);
router.get("/:id", TimetablesController.get);

export { router as timetablesRouter };
