import { prisma } from "../config/db";
import { DayOfWeek } from "../../prisma/generated/prisma/client";

const PERIOD_TIMES: Record<number, [string, string]> = {
  1: ["08:00", "08:50"],
  2: ["09:00", "09:50"],
  3: ["10:00", "10:50"],
  4: ["11:00", "11:50"],
  5: ["12:00", "12:50"],
  6: ["13:30", "14:20"],
  7: ["14:30", "15:20"],
  8: ["15:30", "16:20"],
  9: ["16:30", "17:20"],
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function timeToPeriod(startTime: string): number | null {
  const mins = toMinutes(startTime);
  for (const [period, [start]] of Object.entries(PERIOD_TIMES)) {
    if (Math.abs(toMinutes(start) - mins) <= 10) return Number(period);
  }
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

function parseDay(day: string): DayOfWeek | null {
  const d = day.toUpperCase().trim();
  const map: Record<string, DayOfWeek> = {
    MON: DayOfWeek.MONDAY,
    MONDAY: DayOfWeek.MONDAY,
    TUE: DayOfWeek.TUESDAY,
    TUESDAY: DayOfWeek.TUESDAY,
    WED: DayOfWeek.WEDNESDAY,
    WEDNESDAY: DayOfWeek.WEDNESDAY,
    THU: DayOfWeek.THURSDAY,
    THURSDAY: DayOfWeek.THURSDAY,
    FRI: DayOfWeek.FRIDAY,
    FRIDAY: DayOfWeek.FRIDAY,
    SAT: DayOfWeek.SATURDAY,
    SATURDAY: DayOfWeek.SATURDAY,
  };
  return map[d] ?? null;
}

export interface IntegrationResult {
  timetableId: string;
  slotsCreated: number;
  slotsSkipped: number;
  warnings: string[];
}

export const TimetableIntegrationService = {
  async integrateScannedTimetable(
    scannedTimetableId: string,
  ): Promise<IntegrationResult | null> {
    const scanned = await prisma.scannedTimetable.findUnique({
      where: { id: scannedTimetableId },
      include: { courses: true, schedules: true },
    });

    if (!scanned) return null;

    const warnings: string[] = [];

    const normBranch = norm(scanned.branch);
    const normProg = norm(scanned.program);

    const branches = await prisma.branch.findMany({
      include: { department: { select: { name: true, code: true } } },
    });

    let resolvedBranch = branches.find(
      (b) =>
        norm(b.code) === normBranch ||
        norm(b.name) === normBranch ||
        norm(b.code) === normProg ||
        norm(b.name) === normProg,
    );

    if (!resolvedBranch) {
      resolvedBranch = branches.find(
        (b) =>
          norm(b.code).includes(normBranch) ||
          normBranch.includes(norm(b.code)) ||
          norm(b.name).includes(normBranch) ||
          normBranch.includes(norm(b.name)),
      );
    }

    if (!resolvedBranch) {
      warnings.push(
        `Could not resolve branch "${scanned.branch}" / "${scanned.program}". Using first available branch as fallback.`,
      );
      resolvedBranch = branches[0];
    }

    if (!resolvedBranch) {
      throw new Error(
        "No branches exist in the database. Please seed branch data first.",
      );
    }

    const semMatch = scanned.semester.match(/\d+/);
    const semester = semMatch ? parseInt(semMatch[0], 10) : 1;

    const timetableName = [
      resolvedBranch.name,
      `Sem ${semester}`,
      scanned.program,
    ]
      .filter(Boolean)
      .join(" - ");

    const timetable = await prisma.timetable.create({
      data: {
        name: timetableName,
        semester,
        section: "A",
        branchId: resolvedBranch.id,
      },
    });

    const branchCourses = await prisma.course.findMany({
      where: { branchId: resolvedBranch.id, isDeleted: false },
    });

    const courseCodeMap = new Map<string, string>(); // normCode → courseId
    for (const c of branchCourses) {
      courseCodeMap.set(norm(c.code), c.id);
    }

    const scannedCodeToId = new Map<string, string | null>(); // scannedCode → courseId | null
    for (const sc of scanned.courses) {
      const id = courseCodeMap.get(norm(sc.code)) ?? null;
      scannedCodeToId.set(sc.code, id);
      if (!id) {
        warnings.push(
          `Course code "${sc.code}" not found in branch "${resolvedBranch.name}". Slot will have no course link.`,
        );
      }
    }

    const rooms = await prisma.room.findMany({ where: { isDeleted: false } });
    const roomNumberMap = new Map<string, string>(); // normRoomNumber → roomId
    for (const r of rooms) {
      roomNumberMap.set(norm(r.roomNumber), r.id);
    }

    const faculty = await prisma.user.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
    });
    const facultyNameMap = new Map<string, string>(); // normName → userId
    for (const f of faculty) {
      facultyNameMap.set(norm(f.name), f.id);
      const parts = f.name.trim().split(/\s+/);
      if (parts.length > 1) {
        facultyNameMap.set(norm(parts[parts.length - 1]!), f.id);
      }
    }

    const teacherMap = new Map<string, string | null>(); // scannedCode → facultyId | null
    for (const sc of scanned.courses) {
      if (!sc.teacher) continue;
      const clean = sc.teacher.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.)\s*/i, "");
      const id =
        facultyNameMap.get(norm(sc.teacher)) ??
        facultyNameMap.get(norm(clean)) ??
        null;
      teacherMap.set(sc.code, id);
      if (!id && sc.teacher.trim()) {
        warnings.push(
          `Faculty "${sc.teacher}" not found. Slot will have no faculty link.`,
        );
      }
    }

    let slotsCreated = 0;
    let slotsSkipped = 0;

    for (const schedule of scanned.schedules) {
      const day = parseDay(schedule.day);
      if (!day) {
        warnings.push(`Unrecognised day "${schedule.day}" — slot skipped.`);
        slotsSkipped++;
        continue;
      }

      const period = timeToPeriod(schedule.startTime);
      if (!period) {
        warnings.push(
          `Could not map startTime "${schedule.startTime}" to a period — slot skipped.`,
        );
        slotsSkipped++;
        continue;
      }

      const subjectNorm = norm(schedule.subject);
      let courseId: string | null = null;
      let facultyId: string | null = null;

      const matchedScannedCourse = scanned.courses.find(
        (sc) =>
          norm(sc.code) === subjectNorm ||
          norm(sc.name) === subjectNorm ||
          subjectNorm.includes(norm(sc.code)) ||
          norm(sc.code).includes(subjectNorm),
      );

      if (matchedScannedCourse) {
        courseId = scannedCodeToId.get(matchedScannedCourse.code) ?? null;
        facultyId = teacherMap.get(matchedScannedCourse.code) ?? null;
      }

      if (!courseId) {
        courseId = courseCodeMap.get(subjectNorm) ?? null;
      }

      const roomId = schedule.room
        ? (roomNumberMap.get(norm(schedule.room)) ?? null)
        : null;

      const [startTime, endTime] = PERIOD_TIMES[period]!;

      await prisma.timetableSlot.create({
        data: {
          timetableId: timetable.id,
          courseId: courseId ?? undefined,
          roomId: roomId ?? undefined,
          facultyId: facultyId ?? undefined,
          dayOfWeek: day,
          period,
          startTime,
          endTime,
        },
      });

      slotsCreated++;
    }

    return {
      timetableId: timetable.id,
      slotsCreated,
      slotsSkipped,
      warnings,
    };
  },

  async integrateImportJob(importJobId: string): Promise<IntegrationResult[]> {
    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
      include: { scannedTimetables: { select: { id: true } } },
    });

    if (!job) throw new Error(`ImportJob ${importJobId} not found`);
    if (job.scannedTimetables.length === 0) {
      throw new Error("No scanned timetables found for this import job.");
    }

    const results: IntegrationResult[] = [];

    for (const st of job.scannedTimetables) {
      const result =
        await TimetableIntegrationService.integrateScannedTimetable(st.id);
      if (result) {
        results.push(result);

        // Link the created Timetable back to the ImportJob
        await prisma.timetable.update({
          where: { id: result.timetableId },
          data: { importJobId },
        });
      }
    }

    return results;
  },
};
