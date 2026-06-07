import { Context } from "hono";
import { prisma } from "../config/db";
import { ok, notFound, paginatedOk } from "../utils/response";

export const TimetablesController = {
  async list(c: Context) {
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = Math.min(100, parseInt(c.req.query("limit") ?? "20", 10));
    const branchId = c.req.query("branchId");
    const semester = c.req.query("semester");
    const skip = (page - 1) * limit;

    const where: any = {
      ...(branchId ? { branchId } : {}),
      ...(semester ? { semester: parseInt(semester, 10) } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.timetable.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ semester: "asc" }, { section: "asc" }],
        include: {
          branch: {
            include: { department: { select: { id: true, name: true, code: true } } },
          },
          _count: { select: { slots: true } },
        },
      }),
      prisma.timetable.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async get(c: Context) {
    const { id } = c.req.param();
    const timetable = await prisma.timetable.findUnique({
      where: { id },
      include: {
        branch: { include: { department: true } },
        slots: {
          orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
          include: {
            course: { select: { id: true, code: true, name: true, type: true } },
            room: { select: { id: true, roomNumber: true, type: true } },
            faculty: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!timetable) return notFound(c);
    return ok(c, timetable);
  },

  async getGrid(c: Context) {
    const { id } = c.req.param();
    const timetable = await prisma.timetable.findUnique({
      where: { id },
      include: {
        branch: { include: { department: true } },
        slots: {
          orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
          include: {
            course: { select: { id: true, code: true, name: true, type: true } },
            room: { select: { id: true, roomNumber: true } },
            faculty: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!timetable) return notFound(c);

    // Build grid: { [day]: { [period]: slot } }
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const grid: Record<string, Record<number, any>> = {};
    for (const day of days) grid[day] = {};
    for (const slot of timetable.slots) {
      if (!grid[slot.dayOfWeek]) grid[slot.dayOfWeek] = {};
      grid[slot.dayOfWeek]![slot.period] = slot;
    }

    return ok(c, { timetable: { ...timetable, slots: undefined }, grid });
  },
};
