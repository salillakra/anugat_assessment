import type { Context } from "hono";
import { prisma } from "../config/db";
import {
  timetableQueue,
  timetableFlowProducer,
} from "../queues/timetable-processing.queue";
import { CsvImportService } from "../services/csv-import.service";
import { TimetableIntegrationService } from "../services/timetable-integration.service";
import {
  ok,
  created,
  badRequest,
  notFound,
  paginatedOk,
} from "../utils/response";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { env } from "../config/env";
import { randomBytes } from "crypto";
import { QUEUE_NAMES, JOB_NAMES } from "../types/timetable-processing.types";
import type { PdfConversionJobData } from "../types/timetable-processing.types";

export const ImportsController = {
  async uploadPDF(c: Context) {
    const user = c.get("user");
    const formData = await c.req.parseBody();
    const file = formData["file"];

    if (!file || typeof file === "string") {
      return badRequest(
        c,
        "No file uploaded. Send a multipart/form-data request with a 'file' field.",
      );
    }

    if (!file.name?.toLowerCase().endsWith(".pdf")) {
      return badRequest(c, "Only PDF files are accepted");
    }

    // Save file to disk
    const uploadDir = env.UPLOAD_DIR;
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

    const fileId = randomBytes(16).toString("hex");
    const filename = `${fileId}_${file.name}`;
    const filePath = join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);

    // Create ImportJob record
    const importJob = await prisma.importJob.create({
      data: {
        type: "PDF",
        status: "QUEUED",
        filename: filename,
        fileSize: buffer.length,
        createdById: user?.id ?? null,
      },
    });

    // Queue the PDF conversion job (first stage of the pipeline)
    await timetableQueue.add(
      JOB_NAMES.PDF_CONVERSION,
      {
        importJobId: importJob.id,
        filePath,
        filename: file.name,
      } satisfies PdfConversionJobData,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    return created(c, { importJobId: importJob.id, status: "QUEUED" });
  },

  async importCSV(c: Context) {
    const entity = c.req.param("entity");
    const validEntities = ["departments", "rooms", "faculty", "courses"];
    if (!entity || !validEntities.includes(entity)) {
      return badRequest(
        c,
        `Entity must be one of: ${validEntities.join(", ")}`,
      );
    }

    const formData = await c.req.parseBody();
    const file = formData["file"];

    if (!file || typeof file === "string") {
      return badRequest(c, "No file uploaded");
    }
    if (!file.name?.toLowerCase().endsWith(".csv")) {
      return badRequest(c, "Only CSV files are accepted");
    }

    const csvText = new TextDecoder().decode(await file.arrayBuffer());

    let result;
    switch (entity) {
      case "departments":
        result = await CsvImportService.importDepartments(csvText);
        break;
      case "rooms":
        result = await CsvImportService.importRooms(csvText);
        break;
      case "faculty":
        result = await CsvImportService.importFaculty(csvText);
        break;
      case "courses":
        result = await CsvImportService.importCourses(csvText);
        break;
      default:
        return badRequest(c, "Unknown entity");
    }

    return ok(c, result);
  },

  async previewCSV(c: Context) {
    const entity = c.req.param("entity");
    if (entity !== "departments") {
      return badRequest(c, "Preview only supported for departments currently");
    }

    const formData = await c.req.parseBody();
    const file = formData["file"];
    if (!file || typeof file === "string")
      return badRequest(c, "No file uploaded");

    const csvText = new TextDecoder().decode(await file.arrayBuffer());
    const preview = await CsvImportService.previewDepartments(csvText);
    return ok(c, preview);
  },

  async listJobs(c: Context) {
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = Math.min(50, parseInt(c.req.query("limit") ?? "20", 10));
    const skip = (page - 1) * limit;
    const status = c.req.query("status") as any;

    const where: any = {
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.importJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.importJob.count({ where }),
    ]);

    return paginatedOk(c, data, total, page, limit);
  },

  async getJob(c: Context) {
    const { id } = c.req.param();
    const job = await prisma.importJob.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        timetables: {
          include: {
            branch: {
              include: { department: { select: { id: true, name: true } } },
            },
          },
        },
        scannedTimetables: {
          include: {
            courses: true,
            schedules: true,
          },
        },
      },
    });
    if (!job) return notFound(c);
    return ok(c, job);
  },

  async deleteJob(c: Context) {
    const { id } = c.req.param();
    const job = await prisma.importJob.findUnique({
      where: { id },
    });
    if (!job) return notFound(c);

    // Run cascade delete transaction
    await prisma.$transaction(async (tx) => {
      // Delete scanned timetables (courses and schedule entries cascade-delete)
      await tx.scannedTimetable.deleteMany({
        where: { importJobId: id },
      });
      // Dissociate imported real timetables
      await tx.timetable.updateMany({
        where: { importJobId: id },
        data: { importJobId: null },
      });
      // Delete the job record
      await tx.importJob.delete({
        where: { id },
      });
    });

    return ok(c, { success: true });
  },

  async integrateJob(c: Context) {
    const id = c.req.param("id");
    if (!id) return notFound(c);
    const job = await prisma.importJob.findUnique({
      where: { id },
      include: { scannedTimetables: { select: { id: true } } },
    });
    if (!job) return notFound(c);

    if (job.scannedTimetables.length === 0) {
      return badRequest(
        c,
        "No scanned timetables found for this import job. The PDF may still be processing.",
      );
    }

    try {
      const results = await TimetableIntegrationService.integrateImportJob(id);
      return ok(c, {
        integratedCount: results.length,
        results,
      });
    } catch (err: any) {
      return badRequest(c, err?.message ?? "Integration failed");
    }
  },

  async retryJob(c: Context) {
    const { id } = c.req.param();
    const job = await prisma.importJob.findUnique({
      where: { id },
    });
    if (!job) return notFound(c);

    if (job.status !== "FAILED") {
      return badRequest(c, "Only failed jobs can be retried");
    }

    const filePath = join(env.UPLOAD_DIR, job.filename);
    if (!existsSync(filePath)) {
      await prisma.importJob.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMsg: "Source PDF file was deleted from disk",
        },
      });
      return badRequest(
        c,
        "Source PDF file was deleted from disk and cannot be retried",
      );
    }

    // Reset status back to QUEUED
    await prisma.importJob.update({
      where: { id },
      data: { status: "QUEUED", errorMsg: null, completedAt: null },
    });

    // Re-queue the PDF conversion job
    await timetableQueue.add(
      JOB_NAMES.PDF_CONVERSION,
      {
        importJobId: job.id,
        filePath,
        filename: job.filename,
      } satisfies PdfConversionJobData,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    return ok(c, { importJobId: job.id, status: "QUEUED" });
  },
};
