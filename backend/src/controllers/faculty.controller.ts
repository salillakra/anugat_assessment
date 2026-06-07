import { Context } from "hono";
import { z } from "zod";
import { prisma } from "../config/db";
import { UserRole } from "../../prisma/generated/prisma/client";
import { hashPassword } from "../services/auth.service";
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
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.FACULTY),
  departmentId: z.string().cuid().optional(),
  password: z.string().min(6).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
  departmentId: z.string().cuid().nullable().optional(),
});

export const FacultyController = {
  async list(c: Context) {
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("limit") ?? "20", 10)),
    );
    const search = c.req.query("search") ?? "";
    const departmentId = c.req.query("departmentId");
    const role = c.req.query("role") as UserRole | undefined;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
      ...(departmentId ? { departmentId } : {}),
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          createdAt: true,
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { courses: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async get(c: Context) {
    const { id } = c.req.param();
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
        isDeleted: true,
        department: true,
        courses: {
          include: {
            course: {
              select: { id: true, code: true, name: true, semester: true },
            },
          },
        },
      },
    });
    if (!user || user.isDeleted) return notFound(c);
    return ok(c, user);
  },

  async create(c: Context) {
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (existing && !existing.isDeleted) {
      return conflict(c, "A user with this email already exists");
    }

    const passwordHash = await hashPassword(parsed.data.password ?? "changeme123");

    const user = await prisma.user.upsert({
      where: { email: parsed.data.email.toLowerCase() },
      create: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        role: parsed.data.role,
        departmentId: parsed.data.departmentId ?? null,
        isDeleted: false,
      },
      update: {
        name: parsed.data.name,
        role: parsed.data.role,
        departmentId: parsed.data.departmentId ?? null,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        createdAt: true,
      },
    });

    return created(c, user);
  },

  async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.isDeleted) return notFound(c);

    if (parsed.data.email && parsed.data.email !== user.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (emailConflict && emailConflict.id !== id) {
        return conflict(c, "Email already in use");
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email?.toLowerCase(),
        role: parsed.data.role,
        departmentId: parsed.data.departmentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        updatedAt: true,
      },
    });
    return ok(c, updated);
  },

  async remove(c: Context) {
    const { id } = c.req.param();
    // Prevent self-deletion
    const currentUser = c.get("user");
    if (currentUser.id === id) {
      return badRequest(c, "You cannot delete your own account");
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.isDeleted) return notFound(c);

    await prisma.user.update({ where: { id }, data: { isDeleted: true } });
    return ok(c, { message: "Faculty member deleted" });
  },
};
