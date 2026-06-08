export interface OcrBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
  page: number;
}

export interface OcrPageResult {
  page: number;
  text: string;
  words: OcrWord[];
  confidence: number;
}

export interface TimetableUploadJobData {
  importJobId: string;
  filePath: string;
  filename: string;
  totalPages?: number;
}

export interface PdfConversionJobData {
  importJobId: string;
  filePath: string;
  filename: string;
}

export interface OcrPageJobData {
  importJobId: string;
  imagePath: string;
  pageNumber: number;
  totalPages: number;
}

export interface OcrAggregatorJobData {
  importJobId: string;
  totalPages: number;
  tempDir: string;
  pdfPath: string;
}

export interface GeminiParsingJobData {
  importJobId: string;
  ocrResults: OcrPageResult[];
  pdfPath: string; // original PDF file path — sent to Gemini as inline image
  retryCount?: number;
  previousErrors?: string[];
}

export interface ValidationJobData {
  importJobId: string;
  geminiOutput: unknown;
  ocrResults: OcrPageResult[];
  pdfPath: string;
  retryCount?: number;
}

/** Database persistence worker data */
export interface DatabaseJobData {
  importJobId: string;
  validatedData: GeminiTimetableOutput;
}

//gemini Output Schema

export interface GeminiCourseOutput {
  code: string;
  type: string;
  name: string;
  credits: number;
  teacher: string;
}

export interface GeminiScheduleOutput {
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  room?: string | null;
}

export interface GeminiTimetableOutput {
  department: string;
  program: string;
  branch: string;
  semester: string;
  courses: GeminiCourseOutput[];
  schedules: GeminiScheduleOutput[];
}

export type PipelineStage =
  | "QUEUED"
  | "PDF_CONVERSION"
  | "OCR_PROCESSING"
  | "OCR_AGGREGATION"
  | "GEMINI_PARSING"
  | "VALIDATION"
  | "DATABASE_PERSIST"
  | "COMPLETED"
  | "FAILED";

export interface PipelineProgress {
  importJobId: string;
  stage: PipelineStage;
  progress: number; // 0-100
  message?: string;
  error?: string;
}

export const QUEUE_NAMES = {
  TIMETABLE_PROCESSING: "timetable-processing",
  TIMETABLE_OCR: "timetable-ocr",
  TIMETABLE_DLQ: "timetable-processing-dlq",
} as const;

export const JOB_NAMES = {
  PROCESS_PDF: "process-pdf",
  PDF_CONVERSION: "pdf-conversion",
  OCR_PAGE: "ocr-page",
  OCR_AGGREGATE: "ocr-aggregate",
  GEMINI_PARSE: "gemini-parse",
  VALIDATE: "validate",
  DB_PERSIST: "db-persist",
} as const;
