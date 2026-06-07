import { prisma } from "../config/db";

export interface RoomUtilisation {
  overall: number;
  byRoom: Array<{
    roomId: string;
    roomNumber: string;
    departmentName: string;
    occupiedSlots: number;
    totalSlots: number;
    utilisationPct: number;
  }>;
  byDepartment: Array<{
    departmentId: string;
    departmentName: string;
    occupiedSlots: number;
    totalSlots: number;
    utilisationPct: number;
  }>;
}

export interface EmptyRoomProbability {
  byPeriod: Array<{
    dayOfWeek: string;
    period: number;
    occupiedRooms: number;
    totalRooms: number;
    emptyProbability: number;
  }>;
}

export interface UnderRunningCourse {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  requiredHours: number;
  scheduledHours: number;
  gap: number;
  branchName: string;
  departmentName: string;
  semester: number;
}

export interface AvgEmptyHoursResult {
  averageEmptyHoursPerDay: number;
  byRoom: Array<{
    roomId: string;
    roomNumber: string;
    scheduledHours: number;
    emptyHoursPerDay: number;
  }>;
}

export const AnalyticsService = {
  /**
   * Room Utilisation: occupied slots / total available slots
   * Total available = unique (room, day, period) combinations that COULD be scheduled
   * We define "could be scheduled" as the set of all periods in the timetable system
   * (5 days × 8 periods = 40 slots per room)
   */
  async getRoomUtilisation(): Promise<RoomUtilisation> {
    const PERIODS_PER_DAY = 8;
    const WORKING_DAYS = 6; // Monday–Saturday
    const TOTAL_SLOTS_PER_ROOM = PERIODS_PER_DAY * WORKING_DAYS;

    const rooms = await prisma.room.findMany({
      where: { isDeleted: false },
      include: {
        department: { select: { id: true, name: true } },
        slots: { select: { id: true, dayOfWeek: true, period: true } },
      },
    });

    const byRoom = rooms.map((room) => {
      const occupiedSlots = room.slots.length;
      const utilisationPct =
        TOTAL_SLOTS_PER_ROOM > 0
          ? Math.round((occupiedSlots / TOTAL_SLOTS_PER_ROOM) * 100 * 10) / 10
          : 0;
      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        departmentName: room.department.name,
        departmentId: room.department.id,
        occupiedSlots,
        totalSlots: TOTAL_SLOTS_PER_ROOM,
        utilisationPct,
      };
    });

    // Aggregate by department
    const deptMap = new Map<
      string,
      { name: string; occupied: number; total: number }
    >();
    for (const r of byRoom) {
      const existing = deptMap.get(r.departmentId) ?? {
        name: r.departmentName,
        occupied: 0,
        total: 0,
      };
      existing.occupied += r.occupiedSlots;
      existing.total += r.totalSlots;
      deptMap.set(r.departmentId, existing);
    }

    const byDepartment = Array.from(deptMap.entries()).map(([deptId, d]) => ({
      departmentId: deptId,
      departmentName: d.name,
      occupiedSlots: d.occupied,
      totalSlots: d.total,
      utilisationPct:
        d.total > 0 ? Math.round((d.occupied / d.total) * 100 * 10) / 10 : 0,
    }));

    const totalOccupied = byRoom.reduce((s, r) => s + r.occupiedSlots, 0);
    const totalAvailable = rooms.length * TOTAL_SLOTS_PER_ROOM;
    const overall =
      totalAvailable > 0
        ? Math.round((totalOccupied / totalAvailable) * 100 * 10) / 10
        : 0;

    return { overall, byRoom, byDepartment };
  },

  /**
   * P(empty | slot) = (totalRooms - occupiedRooms) / totalRooms
   * for every (dayOfWeek, period) combination
   */
  async getEmptyRoomProbability(): Promise<EmptyRoomProbability> {
    const totalRooms = await prisma.room.count({ where: { isDeleted: false } });

    if (totalRooms === 0) {
      return { byPeriod: [] };
    }

    // Count distinct rooms occupied per (day, period)
    const slots = await prisma.timetableSlot.groupBy({
      by: ["dayOfWeek", "period"],
      _count: { roomId: true },
      where: { roomId: { not: null } },
    });

    const byPeriod = slots.map((s) => {
      const occupiedRooms = s._count.roomId;
      const emptyRooms = Math.max(0, totalRooms - occupiedRooms);
      return {
        dayOfWeek: s.dayOfWeek,
        period: s.period,
        occupiedRooms,
        totalRooms,
        emptyProbability: Math.round((emptyRooms / totalRooms) * 100 * 10) / 10,
      };
    });

    // Sort by day then period
    const dayOrder = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    byPeriod.sort((a, b) => {
      const dayDiff =
        dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
      return dayDiff !== 0 ? dayDiff : a.period - b.period;
    });

    return { byPeriod };
  },

  /**
   * Under-running courses: scheduled contact hours < required hours
   * Required hours = credits × some_factor (we use credits directly as weekly hours)
   * Scheduled hours = count of TimetableSlots × average slot duration (1 hour default)
   */
  async getUnderRunningCourses(): Promise<UnderRunningCourse[]> {
    const courses = await prisma.course.findMany({
      where: { isDeleted: false },
      include: {
        branch: {
          include: { department: { select: { id: true, name: true } } },
        },
        slots: { select: { id: true, startTime: true, endTime: true } },
      },
    });

    const underRunning: UnderRunningCourse[] = [];

    for (const course of courses) {
      // Calculate scheduled hours from slot durations
      let scheduledMinutes = 0;
      for (const slot of course.slots) {
        try {
          const [sh, sm] = slot.startTime.split(":").map(Number);
          const [eh, em] = slot.endTime.split(":").map(Number);
          scheduledMinutes += eh! * 60 + em! - (sh! * 60 + sm!);
        } catch {
          scheduledMinutes += 60; // default 1 hour
        }
      }
      const scheduledHours = scheduledMinutes / 60;
      // Required hours per week = credits (standard academic convention)
      const requiredHours = course.credits;

      if (scheduledHours < requiredHours) {
        underRunning.push({
          courseId: course.id,
          courseCode: course.code,
          courseName: course.name,
          credits: course.credits,
          requiredHours,
          scheduledHours: Math.round(scheduledHours * 10) / 10,
          gap: Math.round((requiredHours - scheduledHours) * 10) / 10,
          branchName: course.branch.name,
          departmentName: course.branch.department.name,
          semester: course.semester,
        });
      }
    }

    // Sort by gap descending
    return underRunning.sort((a, b) => b.gap - a.gap);
  },

  /**
   * Average empty room hours per day
   * = (total available room-hours - total scheduled room-hours) / working days
   */
  async getAvgEmptyHours(): Promise<AvgEmptyHoursResult> {
    const WORKING_DAYS = 6;
    const SLOT_DURATION_HOURS = 1;
    const PERIODS_PER_DAY = 8;

    const rooms = await prisma.room.findMany({
      where: { isDeleted: false },
      include: {
        slots: { select: { id: true } },
      },
    });

    let totalScheduled = 0;
    let totalAvailable = 0;

    const byRoom = rooms.map((room) => {
      const scheduledHours = room.slots.length * SLOT_DURATION_HOURS;
      const availableHours =
        PERIODS_PER_DAY * WORKING_DAYS * SLOT_DURATION_HOURS;
      const emptyHoursPerDay =
        Math.max(0, availableHours - scheduledHours) / WORKING_DAYS;

      totalScheduled += scheduledHours;
      totalAvailable += availableHours;

      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        scheduledHours,
        emptyHoursPerDay: Math.round(emptyHoursPerDay * 10) / 10,
      };
    });

    const totalEmpty = totalAvailable - totalScheduled;
    const averageEmptyHoursPerDay =
      rooms.length > 0
        ? Math.round((totalEmpty / WORKING_DAYS / rooms.length) * 10) / 10
        : 0;

    return { averageEmptyHoursPerDay, byRoom };
  },

  async getSummary() {
    const [
      departments,
      rooms,
      courses,
      faculty,
      timetables,
      slots,
      importJobs,
    ] = await Promise.all([
      prisma.department.count({ where: { isDeleted: false } }),
      prisma.room.count({ where: { isDeleted: false } }),
      prisma.course.count({ where: { isDeleted: false } }),
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.timetable.count(),
      prisma.timetableSlot.count(),
      prisma.importJob.count({ where: { status: "COMPLETED" } }),
    ]);

    return {
      counts: { departments, rooms, courses, faculty, timetables, slots },
      completedImports: importJobs,
    };
  },
};
