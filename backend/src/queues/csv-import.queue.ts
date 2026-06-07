import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const csvImportQueue = new Queue("csv-import", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
