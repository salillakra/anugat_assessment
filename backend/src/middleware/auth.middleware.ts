import { Context, type Next } from "hono";
import { getCookie } from "hono/cookie";
import { AuthService } from "../services/auth.service";
import { UserRole } from "../../prisma/generated/prisma/client";
import { unauthorized, forbidden } from "../utils/response";

declare module "hono" {
  interface ContextVariableMap {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      departmentId: string | null;
    };
    correlationId: string;
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  // Check session cookie first, then Authorization header
  const sessionToken =
    getCookie(c, "samayak_session") ??
    c.req.header("Authorization")?.replace("Bearer ", "");

  if (!sessionToken) {
    return unauthorized(c, "Authentication required");
  }

  const user = await AuthService.getUserFromToken(sessionToken);
  if (!user) {
    return unauthorized(c, "Invalid or expired session");
  }

  c.set("user", user);
  await next();
};

export const requireRole = (...roles: UserRole[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user) return unauthorized(c, "Authentication required");
    if (!roles.includes(user.role)) {
      return forbidden(c, "You do not have permission to perform this action");
    }
    await next();
  };
};

// ADMIN-only shorthand
export const requireAdmin = requireRole(UserRole.ADMIN);
