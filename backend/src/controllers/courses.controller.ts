import { Context } from "hono";
import { z } from "zod";
import { prisma } from "../config/db";
import { CourseType } from "../../prisma/generated/prisma/client";
import {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  paginatedOk,
} from "../utils/response";

const createSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1).max(200),
  credits: z.number().min(0.5).max(20),
  type: z.nativeEnum(CourseType),
  semester: z.number().int().min(1).max(12),
  branchId: z.string().cuid(),
});

const updateSchema = createSchema.partial();

export const CoursesController = {
  async list(c: Context) {
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("limit") ?? "20", 10)),
    );
    const search = c.req.query("search") ?? "";
    const branchId = c.req.query("branchId");
    const semester = c.req.query("semester");
    const type = c.req.query("type") as CourseType | undefined;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
      ...(branchId ? { branchId } : {}),
      ...(semester ? { semester: parseInt(semester, 10) } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ semester: "asc" }, { code: "asc" }],
        include: {
          branch: {
            include: {
              department: { select: { id: true, name: true, code: true } },
            },
          },
          _count: { select: { faculty: true, slots: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async get(c: Context) {
    const { id } = c.req.param();
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        branch: { include: { department: true } },
        faculty: {
          include: {
            faculty: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!course || course.isDeleted) return notFound(c);
    return ok(c, course);
  },

  async create(c: Context) {
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const branch = await prisma.branch.findUnique({
      where: { id: parsed.data.branchId },
    });
    if (!branch) return badRequest(c, "Branch not found");

    const existing = await prisma.course.findFirst({
      where: {
        branchId: parsed.data.branchId,
        code: parsed.data.code,
        isDeleted: false,
      },
    });
    if (existing) {
      return conflict(
        c,
        `Course '${parsed.data.code}' already exists in this branch`,
      );
    }

    const course = await prisma.course.create({ data: parsed.data });
    return created(c, course);
  },

  async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course || course.isDeleted) return notFound(c);

    const updated = await prisma.course.update({
      where: { id },
      data: parsed.data,
    });
    return ok(c, updated);
  },

  async remove(c: Context) {
    const { id } = c.req.param();
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course || course.isDeleted) return notFound(c);

    await prisma.course.update({ where: { id }, data: { isDeleted: true } });
    return ok(c, { message: "Course deleted" });
  },
};
