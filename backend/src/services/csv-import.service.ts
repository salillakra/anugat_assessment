import { prisma } from "../config/db";
import { hashPassword } from "./auth.service";
import {
  CourseType,
  RoomType,
  UserRole,
} from "../../prisma/generated/prisma/client";

interface CsvRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: ValidationError[];
}

function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]!
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    // handle quoted values
    const values: string[] = [];
    let current = "";
    let inQuote = false;
    for (const char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === "," && !inQuote) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export const CsvImportService = {
  parseCSV,

  async previewDepartments(csvText: string) {
    const rows = parseCSV(csvText);
    return rows.slice(0, 10).map((row, i) => ({
      row: i + 1,
      name: row["name"] ?? "",
      code: row["code"] ?? "",
    }));
  },

  async importDepartments(csvText: string): Promise<ImportResult> {
    const rows = parseCSV(csvText);
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = row["name"]?.trim();
      const code = row["code"]?.trim().toUpperCase();

      if (!name) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "name",
          message: "Name is required",
        });
        continue;
      }
      if (!code) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "code",
          message: "Code is required",
        });
        continue;
      }

      try {
        const existing = await prisma.department.findUnique({
          where: { code },
        });
        if (existing && !existing.isDeleted) {
          result.skipped++;
          continue;
        }
        await prisma.department.upsert({
          where: { code },
          create: { name, code },
          update: { name, isDeleted: false },
        });
        result.created++;
      } catch {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "code",
          message: "Failed to create department",
        });
      }
    }
    return result;
  },

  async importRooms(csvText: string): Promise<ImportResult> {
    const rows = parseCSV(csvText);
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const roomNumber =
        row["room_number"]?.trim() ?? row["roomnumber"]?.trim();
      const deptCode =
        row["department_code"]?.trim().toUpperCase() ??
        row["department"]?.trim().toUpperCase();
      const capacityStr = row["capacity"]?.trim();
      const typeStr = (row["type"]?.trim().toUpperCase() ??
        "CLASSROOM") as RoomType;

      if (!roomNumber || !deptCode || !capacityStr) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "general",
          message: "room_number, department_code, capacity are required",
        });
        continue;
      }

      const capacity = parseInt(capacityStr, 10);
      if (isNaN(capacity) || capacity <= 0) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "capacity",
          message: "Capacity must be a positive number",
        });
        continue;
      }

      if (!Object.values(RoomType).includes(typeStr)) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "type",
          message: `Type must be one of: ${Object.values(RoomType).join(", ")}`,
        });
        continue;
      }

      try {
        const dept = await prisma.department.findUnique({
          where: { code: deptCode },
        });
        if (!dept || dept.isDeleted) {
          result.failed++;
          result.errors.push({
            row: i + 2,
            field: "department_code",
            message: `Department '${deptCode}' not found`,
          });
          continue;
        }

        const existing = await prisma.room.findFirst({
          where: { departmentId: dept.id, roomNumber, isDeleted: false },
        });
        if (existing) {
          result.skipped++;
          continue;
        }

        await prisma.room.create({
          data: { roomNumber, capacity, type: typeStr, departmentId: dept.id },
        });
        result.created++;
      } catch {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "general",
          message: "Failed to create room",
        });
      }
    }
    return result;
  },

  async importFaculty(csvText: string): Promise<ImportResult> {
    const rows = parseCSV(csvText);
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = row["name"]?.trim();
      const email = row["email"]?.trim().toLowerCase();
      const roleStr = (row["role"]?.trim().toUpperCase() ??
        "FACULTY") as UserRole;
      const deptCode = row["department_code"]?.trim().toUpperCase();

      if (!name || !email) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "general",
          message: "name and email are required",
        });
        continue;
      }

      if (!Object.values(UserRole).includes(roleStr)) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "role",
          message: `Role must be one of: ${Object.values(UserRole).join(", ")}`,
        });
        continue;
      }

      try {
        let departmentId: string | undefined;
        if (deptCode) {
          const dept = await prisma.department.findUnique({
            where: { code: deptCode },
          });
          if (dept && !dept.isDeleted) departmentId = dept.id;
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && !existing.isDeleted) {
          result.skipped++;
          continue;
        }

        await prisma.user.upsert({
          where: { email },
          create: {
            name,
            email,
            passwordHash: await hashPassword("changeme123"),
            role: roleStr,
            departmentId: departmentId ?? null,
          },
          update: {
            name,
            role: roleStr,
            departmentId: departmentId ?? null,
            isDeleted: false,
          },
        });
        result.created++;
      } catch {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "email",
          message: "Failed to create faculty member",
        });
      }
    }
    return result;
  },

  async importCourses(csvText: string): Promise<ImportResult> {
    const rows = parseCSV(csvText);
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const code = row["code"]?.trim().toUpperCase();
      const name = row["name"]?.trim();
      const creditsStr = row["credits"]?.trim();
      const typeStr = (row["type"]?.trim().toUpperCase() ??
        "THEORY") as CourseType;
      const semStr = row["semester"]?.trim();
      const branchCode = row["branch_code"]?.trim().toUpperCase();
      const deptCode = row["department_code"]?.trim().toUpperCase();

      if (
        !code ||
        !name ||
        !creditsStr ||
        !semStr ||
        !branchCode ||
        !deptCode
      ) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "general",
          message:
            "code, name, credits, semester, branch_code, department_code are required",
        });
        continue;
      }

      const credits = parseFloat(creditsStr);
      const semester = parseInt(semStr, 10);
      if (isNaN(credits) || isNaN(semester)) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "general",
          message: "credits and semester must be numbers",
        });
        continue;
      }

      if (!Object.values(CourseType).includes(typeStr)) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "type",
          message: `Type must be one of: ${Object.values(CourseType).join(", ")}`,
        });
        continue;
      }

      try {
        const dept = await prisma.department.findUnique({
          where: { code: deptCode },
        });
        if (!dept || dept.isDeleted) {
          result.failed++;
          result.errors.push({
            row: i + 2,
            field: "department_code",
            message: `Department '${deptCode}' not found`,
          });
          continue;
        }

        const branch = await prisma.branch.findUnique({
          where: {
            departmentId_code: { departmentId: dept.id, code: branchCode },
          },
        });
        if (!branch) {
          result.failed++;
          result.errors.push({
            row: i + 2,
            field: "branch_code",
            message: `Branch '${branchCode}' not found in department '${deptCode}'`,
          });
          continue;
        }

        const existing = await prisma.course.findFirst({
          where: { branchId: branch.id, code, isDeleted: false },
        });
        if (existing) {
          result.skipped++;
          continue;
        }

        await prisma.course.create({
          data: {
            code,
            name,
            credits,
            type: typeStr,
            semester,
            branchId: branch.id,
          },
        });
        result.created++;
      } catch {
        result.failed++;
        result.errors.push({
          row: i + 2,
          field: "general",
          message: "Failed to create course",
        });
      }
    }
    return result;
  },
};
