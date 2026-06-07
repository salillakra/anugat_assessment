import { Context } from "hono";

export function ok<T>(c: Context, data: T, status = 200) {
  return c.json({ success: true, data }, status as any);
}

export function created<T>(c: Context, data: T) {
  return c.json({ success: true, data }, 201);
}

export function noContent(c: Context) {
  return c.json({ success: true, data: null }, 204 as any);
}

export function badRequest(c: Context, error: string) {
  return c.json({ success: false, error }, 400);
}

export function unauthorized(c: Context, error = "Unauthorized") {
  return c.json({ success: false, error }, 401);
}

export function forbidden(c: Context, error = "Forbidden") {
  return c.json({ success: false, error }, 403);
}

export function notFound(c: Context, error = "Not found") {
  return c.json({ success: false, error }, 404);
}

export function conflict(c: Context, error: string) {
  return c.json({ success: false, error }, 409);
}

export function serverError(c: Context, error = "Internal server error") {
  return c.json({ success: false, error }, 500);
}

export function paginatedOk<T>(
  c: Context,
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return c.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}
