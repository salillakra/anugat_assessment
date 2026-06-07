import { Queue, QueueEvents, FlowProducer } from "bullmq";
import { redisConnection } from "../config/redis";
import { QUEUE_NAMES } from "../types/timetable-processing.types";


export const timetableQueue = new Queue(QUEUE_NAMES.TIMETABLE_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});


export const ocrQueue = new Queue(QUEUE_NAMES.TIMETABLE_OCR, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  },
});

//dead letter queue

export const timetableDLQ = new Queue(QUEUE_NAMES.TIMETABLE_DLQ, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

//Queue Events (for monitoring)

export const timetableQueueEvents = new QueueEvents(
  QUEUE_NAMES.TIMETABLE_PROCESSING,
  { connection: redisConnection },
);

export const ocrQueueEvents = new QueueEvents(QUEUE_NAMES.TIMETABLE_OCR, {
  connection: redisConnection,
});

//Flow Producer (for parent-child job orchestration)

export const timetableFlowProducer = new FlowProducer({
  connection: redisConnection,
});
