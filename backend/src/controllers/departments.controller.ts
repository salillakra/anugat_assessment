import { Context } from "hono";
import { z } from "zod";
import { prisma } from "../config/db";
import {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  paginatedOk,
} from "../utils/response";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20).toUpperCase(),
});

const updateSchema = createSchema.partial();

function parsePagination(c: Context) {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10)));
  const search = c.req.query("search") ?? "";
  return { page, limit, search, skip: (page - 1) * limit };
}

export const DepartmentsController = {
  async list(c: Context) {
    const { page, limit, search, skip } = parsePagination(c);

    const where = {
      isDeleted: false,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { code: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: { select: { branches: true, rooms: true, users: true } },
        },
      }),
      prisma.department.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async get(c: Context) {
    const { id } = c.req.param();
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        branches: { orderBy: { name: "asc" } },
        _count: { select: { rooms: true, users: true } },
      },
    });
    if (!dept || dept.isDeleted) return notFound(c);
    return ok(c, dept);
  },

  async create(c: Context) {
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const existing = await prisma.department.findUnique({
      where: { code: parsed.data.code },
    });
    if (existing && !existing.isDeleted) {
      return conflict(c, `Department with code '${parsed.data.code}' already exists`);
    }

    const dept = await prisma.department.upsert({
      where: { code: parsed.data.code },
      create: { name: parsed.data.name, code: parsed.data.code },
      update: { name: parsed.data.name, isDeleted: false },
    });
    return created(c, dept);
  },

  async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept || dept.isDeleted) return notFound(c);

    if (parsed.data.code && parsed.data.code !== dept.code) {
      const codeConflict = await prisma.department.findUnique({
        where: { code: parsed.data.code },
      });
      if (codeConflict && codeConflict.id !== id) {
        return conflict(c, `Code '${parsed.data.code}' is already in use`);
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: parsed.data,
    });
    return ok(c, updated);
  },

  async remove(c: Context) {
    const { id } = c.req.param();
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept || dept.isDeleted) return notFound(c);

    await prisma.department.update({
      where: { id },
      data: { isDeleted: true },
    });
    return ok(c, { message: "Department deleted" });
  },
};
