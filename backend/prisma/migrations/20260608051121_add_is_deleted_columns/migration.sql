/*
  Warnings:

  - You are about to drop the column `day` on the `TimetableSlot` table. All the data in the column will be lost.
  - Added the required column `dayOfWeek` to the `TimetableSlot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImportStatus" ADD VALUE 'OCR_PROCESSING';
ALTER TYPE "ImportStatus" ADD VALUE 'GEMINI_PARSING';

-- AlterEnum
ALTER TYPE "RoomType" ADD VALUE 'SEMINAR';

-- DropIndex
DROP INDEX "TimetableSlot_day_period_idx";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Timetable" ADD COLUMN     "importJobId" TEXT;

-- AlterTable
ALTER TABLE "TimetableSlot" DROP COLUMN "day",
ADD COLUMN     "dayOfWeek" "DayOfWeek" NOT NULL;

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER,
    "summary" JSONB,
    "errorMsg" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannedTimetable" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "importJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScannedTimetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannedCourse" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "teacher" TEXT NOT NULL,

    CONSTRAINT "ScannedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannedScheduleEntry" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "room" TEXT,

    CONSTRAINT "ScannedScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_type_idx" ON "ImportJob"("type");

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- CreateIndex
CREATE INDEX "ScannedTimetable_department_idx" ON "ScannedTimetable"("department");

-- CreateIndex
CREATE INDEX "ScannedTimetable_importJobId_idx" ON "ScannedTimetable"("importJobId");

-- CreateIndex
CREATE INDEX "ScannedCourse_timetableId_idx" ON "ScannedCourse"("timetableId");

-- CreateIndex
CREATE INDEX "ScannedScheduleEntry_timetableId_idx" ON "ScannedScheduleEntry"("timetableId");

-- CreateIndex
CREATE INDEX "ScannedScheduleEntry_day_idx" ON "ScannedScheduleEntry"("day");

-- CreateIndex
CREATE INDEX "Branch_departmentId_idx" ON "Branch"("departmentId");

-- CreateIndex
CREATE INDEX "Course_branchId_idx" ON "Course"("branchId");

-- CreateIndex
CREATE INDEX "Course_semester_idx" ON "Course"("semester");

-- CreateIndex
CREATE INDEX "Course_type_idx" ON "Course"("type");

-- CreateIndex
CREATE INDEX "CourseFaculty_courseId_idx" ON "CourseFaculty"("courseId");

-- CreateIndex
CREATE INDEX "CourseFaculty_facultyId_idx" ON "CourseFaculty"("facultyId");

-- CreateIndex
CREATE INDEX "Department_code_idx" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_isDeleted_idx" ON "Department"("isDeleted");

-- CreateIndex
CREATE INDEX "Room_departmentId_idx" ON "Room"("departmentId");

-- CreateIndex
CREATE INDEX "Room_type_idx" ON "Room"("type");

-- CreateIndex
CREATE INDEX "Timetable_branchId_idx" ON "Timetable"("branchId");

-- CreateIndex
CREATE INDEX "Timetable_semester_idx" ON "Timetable"("semester");

-- CreateIndex
CREATE INDEX "TimetableSlot_timetableId_idx" ON "TimetableSlot"("timetableId");

-- CreateIndex
CREATE INDEX "TimetableSlot_dayOfWeek_period_idx" ON "TimetableSlot"("dayOfWeek", "period");

-- CreateIndex
CREATE INDEX "TimetableSlot_facultyId_idx" ON "TimetableSlot"("facultyId");

-- CreateIndex
CREATE INDEX "TimetableSlot_courseId_idx" ON "TimetableSlot"("courseId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannedTimetable" ADD CONSTRAINT "ScannedTimetable_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannedCourse" ADD CONSTRAINT "ScannedCourse_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "ScannedTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannedScheduleEntry" ADD CONSTRAINT "ScannedScheduleEntry_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "ScannedTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
