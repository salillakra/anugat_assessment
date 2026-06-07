import { type Job } from "bullmq";
import { logger } from "../../utils/logger";
import { prisma } from "../../config/db";
import { SocketManager } from "../../socket/socket";
import type {
  DatabaseJobData,
  GeminiTimetableOutput,
} from "../../types/timetable-processing.types";

export async function handleDatabasePersist(
  job: Job<DatabaseJobData>,
): Promise<{
  timetableId: string;
  coursesCreated: number;
  schedulesCreated: number;
}> {
  const { importJobId, validatedData } = job.data;
  logger.info(`[Database] Persisting timetable data (job: ${job.id})`);

  emitProgress(
    importJobId,
    "DATABASE_PERSIST",
    90,
    "Saving timetable to database...",
  );

  const result = await prisma.$transaction(async (tx) => {
    // Create the ScannedTimetable record
    const timetable = await tx.scannedTimetable.create({
      data: {
        department: validatedData.department,
        program: validatedData.program,
        branch: validatedData.branch,
        semester: validatedData.semester,
        importJobId,
      },
    });

    // Create course records
    if (validatedData.courses.length > 0) {
      await tx.scannedCourse.createMany({
        data: validatedData.courses.map((course) => ({
          timetableId: timetable.id,
          code: course.code,
          type: course.type,
          name: course.name,
          credits: course.credits,
          teacher: course.teacher,
        })),
      });
    }

    // Create schedule entry records
    if (validatedData.schedules.length > 0) {
      await tx.scannedScheduleEntry.createMany({
        data: validatedData.schedules.map((schedule) => ({
          timetableId: timetable.id,
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          subject: schedule.subject,
          room: schedule.room ?? null,
        })),
      });
    }

    // Update ImportJob to COMPLETED
    await tx.importJob.update({
      where: { id: importJobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        summary: buildSummary(validatedData),
      },
    });

    return {
      timetableId: timetable.id,
      coursesCreated: validatedData.courses.length,
      schedulesCreated: validatedData.schedules.length,
    };
  });

  logger.info(
    `[Database] Timetable ${result.timetableId} created: ${result.coursesCreated} courses, ${result.schedulesCreated} schedule entries`,
  );

  emitProgress(
    importJobId,
    "COMPLETED",
    100,
    `Timetable saved: ${result.coursesCreated} courses, ${result.schedulesCreated} schedule entries`,
  );

  // Emit completion event
  SocketManager.emitToRoom(`import:${importJobId}`, "import:completed", {
    importJobId,
    timetableId: result.timetableId,
    summary: buildSummary(validatedData),
  });

  return result;
}

function buildSummary(data: GeminiTimetableOutput) {
  const uniqueRooms = new Set(
    data.schedules
      .map((s) => s.room)
      .filter((r): r is string => typeof r === "string" && r.trim() !== ""),
  );

  const uniqueTeachers = new Set(
    data.courses
      .map((c) => c.teacher)
      .filter((t): t is string => typeof t === "string" && t.trim() !== ""),
  );

  return {
    department: data.department,
    program: data.program,
    branch: data.branch,
    semester: data.semester,
    totalCourses: data.courses.length,
    totalScheduleEntries: data.schedules.length,
    courses: data.courses.map((c) => ({
      code: c.code,
      name: c.name,
      teacher: c.teacher,
    })),
    daysWithClasses: [...new Set(data.schedules.map((s) => s.day))],
    created: {
      timetables: 1,
      slots: data.schedules.length,
      rooms: uniqueRooms.size,
      courses: data.courses.length,
      faculty: uniqueTeachers.size,
    },
  };
}

function emitProgress(
  importJobId: string,
  stage: string,
  progress: number,
  message: string,
) {
  SocketManager.emitToRoom(`import:${importJobId}`, "import:progress", {
    importJobId,
    stage,
    progress,
    message,
  });
}
