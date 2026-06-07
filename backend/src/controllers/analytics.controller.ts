import { Context } from "hono";
import { AnalyticsService } from "../services/analytics.service";
import { ok, serverError } from "../utils/response";

export const AnalyticsController = {
  async summary(c: Context) {
    const data = await AnalyticsService.getSummary();
    return ok(c, data);
  },

  async roomUtilisation(c: Context) {
    const data = await AnalyticsService.getRoomUtilisation();
    return ok(c, data);
  },

  async emptyRoomProbability(c: Context) {
    const data = await AnalyticsService.getEmptyRoomProbability();
    return ok(c, data);
  },

  async underRunningCourses(c: Context) {
    const data = await AnalyticsService.getUnderRunningCourses();
    return ok(c, data);
  },

  async avgEmptyHours(c: Context) {
    const data = await AnalyticsService.getAvgEmptyHours();
    return ok(c, data);
  },
};
