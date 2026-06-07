import { Hono } from "hono";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = new Hono();

router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/me", authMiddleware, AuthController.me);

export { router as authRouter };
