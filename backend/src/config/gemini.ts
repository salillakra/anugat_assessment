import { GoogleGenAI, Type, type Schema, type GenerateContentConfig } from "@google/genai";
import { env } from "./env";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

//https://ai.google.dev/gemini-api/docs/models
const geminiModels = {
  gemini_3_1_pro_preview: "gemini-3.1-pro-preview",
  gemini_3_5_flash: "gemini-3.5-flash",
  gemini_3_flash_preview: "gemini-3-flash-preview",
  gemini_3_1_flash_lite: "gemini-3.1-flash-lite",
  gemini_3_1_flash_lite_preview: "gemini-3.1-flash-lite-preview",
  gemini_3_1_flash_image_preview: "gemini-3.1-flash-image-preview",
  gemini_3_pro_image_preview: "gemini-3-pro-image-preview",
  gemini_3_1_flash_live_preview: "gemini-3.1-flash-live-preview",
  gemini_3_1_flash_tts_preview: "gemini-3.1-flash-tts-preview",
  gemini_2_5_flash: "gemini-2.5-flash",
  gemini_2_5_flash_image: "gemini-2.5-flash-image",
  gemini_2_5_flash_native_audio_preview:
    "gemini-2.5-flash-native-audio-preview-12-2025",
  gemini_2_5_flash_tts_preview: "gemini-2.5-flash-preview-tts",
  gemini_2_5_flash_lite: "gemini-2.5-flash-lite",
  gemini_2_5_pro: "gemini-2.5-pro",
  gemini_2_5_pro_tts_preview: "gemini-2.5-pro-preview-tts",
  veo_3_1_generate_preview: "veo-3.1-generate-preview",
  veo_3_1_lite_generate_preview: "veo-3.1-lite-generate-preview",
  imagen_4: "imagen",
  lyria_3_pro_preview: "lyria-3-pro-preview",
  lyria_3_clip_preview: "lyria-3-clip-preview",
  lyria_realtime_exp: "lyria-realtime-exp",
  gemini_2_5_computer_use_preview: "gemini-2.5-computer-use-preview-10-2025",
  gemini_deep_research_preview: "deep-research-preview-04-2026",
  gemini_deep_research_max_preview: "deep-research-max-preview-04-2026",
  antigravity_agent_preview: "antigravity-preview-05-2026",
  gemini_embedding_2: "gemini-embedding-2",
  gemini_embedding: "gemini-embedding-001",
  gemini_robotics_er_1_6_preview: "gemini-robotics-er-1.6-preview",
} as const;

export const TIMETABLE_SYSTEM_INSTRUCTION = `You are a timetable extraction engine.

Input contains OCR words and coordinates from scanned university timetable pages.

Reconstruct the timetable structure using word positions.

Detect:
- department
- program
- branch
- semester
- section
- subjects
- labs
- rooms
- faculty
- credits
- weekly schedule

Return only valid JSON.
No markdown.
No explanations.
No comments.`;

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
