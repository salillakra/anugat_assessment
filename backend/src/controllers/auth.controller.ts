import { Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { z } from "zod";
import { env } from "../config/env";
import { AuthService } from "../services/auth.service";
import { ok, badRequest, unauthorized } from "../utils/response";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const AuthController = {
  async login(c: Context) {
    const body = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const result = await AuthService.login(parsed.data.email, parsed.data.password);
    if (!result.success) {
      return unauthorized(c, result.error);
    }

    // Set secure session cookie
    setCookie(c, "samayak_session", result.token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return ok(c, { user: result.user });
  },

  async logout(c: Context) {
    const token = getCookie(c, "samayak_session");
    if (token) await AuthService.logout(token);
    deleteCookie(c, "samayak_session", { path: "/" });
    return ok(c, { message: "Logged out successfully" });
  },

  async me(c: Context) {
    const user = c.get("user");
    return ok(c, { user });
  },
};
