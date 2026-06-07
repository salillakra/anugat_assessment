import { z } from "zod";

// validates the JSON returned by Gemini before database insertion.
export const GeminiCourseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  type: z.string().min(1, "Course type is required"),
  name: z.string().min(1, "Course name is required"),
  credits: z.number().min(0, "Credits must be non-negative"),
  teacher: z.string().min(1, "Teacher name is required"),
});

export const GeminiScheduleSchema = z.object({
  day: z.string().min(1, "Day is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  subject: z.string().min(1, "Subject is required"),
  room: z.string().optional().nullable(),
});

export const GeminiTimetableSchema = z.object({
  department: z.string().min(1, "Department is required"),
  program: z.string().min(1, "Program is required"),
  branch: z.string().min(1, "Branch is required"),
  semester: z.string().min(1, "Semester is required"),
  courses: z
    .array(GeminiCourseSchema)
    .min(1, "At least one course is required"),
  schedules: z
    .array(GeminiScheduleSchema)
    .min(1, "At least one schedule entry is required"),
});

export type GeminiTimetableInput = z.infer<typeof GeminiTimetableSchema>;

export function validateGeminiOutput(data: unknown): {
  success: boolean;
  data?: GeminiTimetableInput;
  errors?: string[];
} {
  const result = GeminiTimetableSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${path}: ${issue.message}`;
  });

  return { success: false, errors };
}
