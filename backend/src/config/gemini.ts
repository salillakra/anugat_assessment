import {
  GoogleGenAI,
  Type,
  type Schema,
  type GenerateContentConfig,
} from "@google/genai";
import { env } from "./env";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

// Model strings sourced from https://ai.google.dev/gemini-api/docs/models
// Only active (non-deprecated) models are listed.
const geminiModels = {
  // ── Gemini 3 ────────────────────────────────────────────────────────────
  /** Stable. Advanced intelligence, complex problem-solving, agentic/vibe coding. */
  gemini_3_1_pro_preview: "gemini-3.1-pro-preview",
  /** Stable. Sustained frontier performance for agentic and coding tasks. */
  gemini_3_5_flash: "gemini-3.5-flash",
  /** Preview. Frontier-class performance at a fraction of the cost. */
  gemini_3_flash_preview: "gemini-3-flash-preview",
  /**
   * Stable. Low-latency, cost-effective multimodal model.
   * Supports: Text, Image, Video, Audio, PDF input.
   * Use for: high-volume lightweight tasks, structured extraction, PDF parsing.
   */
  gemini_3_1_flash_lite: "gemini-3.1-flash-lite",
  /** Stable. High-efficiency image generation (Nano Banana 2). */
  gemini_3_1_flash_image: "gemini-3.1-flash-image",
  /** Stable. State-of-the-art image generation (Nano Banana Pro). */
  gemini_3_pro_image: "gemini-3-pro-image",
  /** Preview. Low-latency Live API model for real-time dialogue. */
  gemini_3_1_flash_live_preview: "gemini-3.1-flash-live-preview",
  /** Preview. Powerful, low-latency speech generation (TTS). */
  gemini_3_1_flash_tts_preview: "gemini-3.1-flash-tts-preview",

  // ── Gemini 2.5 ──────────────────────────────────────────────────────────
  /** Stable. Best price-performance for low-latency, high-volume reasoning tasks. */
  gemini_2_5_flash: "gemini-2.5-flash",
  /** Stable. Native image generation for fast creative workflows (Nano Banana). */
  gemini_2_5_flash_image: "gemini-2.5-flash-image",
  /** Preview. Flagship Live API model — bidirectional voice/video with audio reasoning. */
  gemini_2_5_flash_live_preview:
    "gemini-2.5-flash-native-audio-preview-12-2025",
  /** Preview. Fast, controllable TTS for low-latency applications. */
  gemini_2_5_flash_tts_preview: "gemini-2.5-flash-preview-tts",
  /** Stable. Fastest and most budget-friendly model in the 2.5 family. */
  gemini_2_5_flash_lite: "gemini-2.5-flash-lite",
  /** Stable. Most advanced model for complex tasks — deep reasoning and coding. */
  gemini_2_5_pro: "gemini-2.5-pro",
  /** Preview. High-fidelity speech synthesis for podcasts and audiobooks. */
  gemini_2_5_pro_tts_preview: "gemini-2.5-pro-preview-tts",

  // ── Generative media ────────────────────────────────────────────────────
  /** Preview. State-of-the-art cinematic video generation with synchronized audio. */
  veo_3_1_generate_preview: "veo-3.1-generate-preview",
  /** Preview. High-efficiency, low-cost video generation from the Veo 3.1 family. */
  veo_3_1_lite_generate_preview: "veo-3.1-lite-generate-preview",
  /** Stable. Text-to-image up to 2K resolution. */
  imagen_4: "imagen",

  // ── Music generation ────────────────────────────────────────────────────
  /** Preview. Flagship music generation model for full-length songs. */
  lyria_3_pro_preview: "lyria-3-pro-preview",
  /** Preview. Optimized for short musical clips and loops up to 30 s. */
  lyria_3_clip_preview: "lyria-3-clip-preview",
  /** Experimental. Real-time music generation with granular creative control. */
  lyria_realtime_exp: "lyria-realtime-exp",

  // ── Tool / agent models ─────────────────────────────────────────────────
  /** Preview. Computer-use model — sees screen, performs UI actions. */
  gemini_2_5_computer_use_preview: "gemini-2.5-computer-use-preview-10-2025",
  /** Preview. Agentic multi-step research across hundreds of sources. */
  gemini_deep_research_preview: "deep-research-preview-04-2026",
  /** Preview. Maximum-comprehensiveness deep research model. */
  gemini_deep_research_max_preview: "deep-research-max-preview-04-2026",
  /** Preview. General-purpose managed agent with code execution in a sandbox. */
  antigravity_agent_preview: "antigravity-preview-05-2026",

  // ── Embedding / specialised ─────────────────────────────────────────────
  /** Stable. Multimodal embedding model (text, image, video, audio, PDF). */
  gemini_embedding_2: "gemini-embedding-2",
  /** Stable. High-dimensional text embeddings for semantic search / RAG. */
  gemini_embedding: "gemini-embedding-001",
  /** Preview. Embodied reasoning for robotics agents. */
  gemini_robotics_er_1_6_preview: "gemini-robotics-er-1.6-preview",
} as const;

export const TIMETABLE_SYSTEM_INSTRUCTION = `You are a timetable extraction engine.

You will receive a university timetable as both a PDF document and OCR-extracted word coordinates.

Use the PDF visual layout as the primary reference and the OCR coordinates as a grounding signal to resolve ambiguities.

Reconstruct the full timetable structure:
- department, program, branch, semester, section
- all courses: code, type (THEORY/LAB/TUTORIAL), name, credits, teacher
- weekly schedule: day, startTime (HH:MM), endTime (HH:MM), subject code, room

Rules:
- startTime and endTime must be in 24-hour HH:MM format
- day must be one of: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY
- subject must match a course code from the courses list
- credits must be a number

Return ONLY valid JSON. No markdown. No explanation. No comments.`;

export const timetableResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    department: { type: Type.STRING },
    program: { type: Type.STRING },
    branch: { type: Type.STRING },
    semester: { type: Type.STRING },

    courses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          type: { type: Type.STRING },
          name: { type: Type.STRING },
          credits: { type: Type.NUMBER },
          teacher: { type: Type.STRING },
        },
        required: ["code", "type", "name", "credits", "teacher"],
      },
    },

    schedules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          startTime: { type: Type.STRING },
          endTime: { type: Type.STRING },
          subject: { type: Type.STRING },
          room: {
            anyOf: [{ type: Type.STRING }, { type: Type.NULL }],
          },
        },
        required: ["day", "startTime", "endTime", "subject"],
      },
    },
  },
  required: [
    "department",
    "program",
    "branch",
    "semester",
    "courses",
    "schedules",
  ],
};

export const timetableGeminiConfig: GenerateContentConfig = {
  temperature: 0.1,
  responseMimeType: "application/json",
  responseSchema: timetableResponseSchema,
  systemInstruction: TIMETABLE_SYSTEM_INSTRUCTION,
};

export const geminiConfig = timetableGeminiConfig;

export { ai, geminiModels };
