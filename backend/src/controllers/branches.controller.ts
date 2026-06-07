import { Context } from "hono";
import { z } from "zod";
import { prisma } from "../config/db";
import { ok, created, badRequest, notFound, conflict, paginatedOk } from "../utils/response";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20).toUpperCase(),
  departmentId: z.string().cuid(),
});

const updateSchema = createSchema.omit({ departmentId: true }).partial();

export const BranchesController = {
  async list(c: Context) {
    const departmentId = c.req.query("departmentId");
    const search = c.req.query("search") ?? "";
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = Math.min(100, parseInt(c.req.query("limit") ?? "50", 10));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(departmentId ? { departmentId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { courses: true, timetables: true } },
        },
      }),
      prisma.branch.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async get(c: Context) {
    const { id } = c.req.param();
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        department: true,
        courses: { where: { isDeleted: false }, orderBy: [{ semester: "asc" }, { code: "asc" }] },
      },
    });
    if (!branch) return notFound(c);
    return ok(c, branch);
  },

  async create(c: Context) {
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");

    const dept = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
    if (!dept || dept.isDeleted) return badRequest(c, "Department not found");

    const existing = await prisma.branch.findUnique({
      where: { departmentId_code: { departmentId: parsed.data.departmentId, code: parsed.data.code } },
    });
    if (existing) return conflict(c, `Branch '${parsed.data.code}' already exists in this department`);

    const branch = await prisma.branch.create({ data: parsed.data });
    return created(c, branch);
  },

  async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");

    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) return notFound(c);

    const updated = await prisma.branch.update({ where: { id }, data: parsed.data });
    return ok(c, updated);
  },

  async remove(c: Context) {
    const { id } = c.req.param();
    const branch = await prisma.branch.findUnique({ where: { id }, include: { _count: { select: { courses: true } } } });
    if (!branch) return notFound(c);
    if (branch._count.courses > 0) return badRequest(c, "Cannot delete branch with existing courses");

    await prisma.branch.delete({ where: { id } });
    return ok(c, { message: "Branch deleted" });
  },
};
