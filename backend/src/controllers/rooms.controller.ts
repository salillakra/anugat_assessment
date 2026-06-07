import { Context } from "hono";
import { z } from "zod";
import { prisma } from "../config/db";
import { RoomType } from "../../prisma/generated/prisma/client";
import {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  paginatedOk,
} from "../utils/response";

const createSchema = z.object({
  roomNumber: z.string().min(1).max(50),
  departmentId: z.string().cuid(),
  capacity: z.number().int().min(1).max(2000),
  type: z.nativeEnum(RoomType),
});

const updateSchema = createSchema.partial();

export const RoomsController = {
  async list(c: Context) {
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("limit") ?? "20", 10)),
    );
    const search = c.req.query("search") ?? "";
    const departmentId = c.req.query("departmentId");
    const type = c.req.query("type") as RoomType | undefined;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
      ...(departmentId ? { departmentId } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? { roomNumber: { contains: search, mode: "insensitive" } }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: { roomNumber: "asc" },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.room.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async get(c: Context) {
    const { id } = c.req.param();
    const room = await prisma.room.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!room || room.isDeleted) return notFound(c);
    return ok(c, room);
  },

  async create(c: Context) {
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const dept = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
    });
    if (!dept || dept.isDeleted) return badRequest(c, "Department not found");

    const existing = await prisma.room.findFirst({
      where: {
        departmentId: parsed.data.departmentId,
        roomNumber: parsed.data.roomNumber,
        isDeleted: false,
      },
    });
    if (existing) {
      return conflict(
        c,
        `Room '${parsed.data.roomNumber}' already exists in this department`,
      );
    }

    const room = await prisma.room.create({ data: parsed.data });
    return created(c, room);
  },

  async update(c: Context) {
    const { id } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room || room.isDeleted) return notFound(c);

    const updated = await prisma.room.update({
      where: { id },
      data: parsed.data,
    });
    return ok(c, updated);
  },

  async remove(c: Context) {
    const { id } = c.req.param();
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room || room.isDeleted) return notFound(c);

    await prisma.room.update({ where: { id }, data: { isDeleted: true } });
    return ok(c, { message: "Room deleted" });
  },
};
