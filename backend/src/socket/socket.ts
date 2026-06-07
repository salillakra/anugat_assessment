import { Server } from "socket.io";
import { logger } from "../utils/logger";

let ioInstance: Server | null = null;

export const SocketManager = {
  init(io: Server) {
    ioInstance = io;
    logger.info("[SocketManager] Socket.IO initialized");

    io.on("connection", (socket) => {
      logger.debug(`[SocketManager] Client connected: ${socket.id}`);

      socket.on("subscribe:import", (importJobId: string) => {
        socket.join(`import:${importJobId}`);
        logger.debug(`[SocketManager] ${socket.id} subscribed to import:${importJobId}`);
      });

      socket.on("unsubscribe:import", (importJobId: string) => {
        socket.leave(`import:${importJobId}`);
      });

      socket.on("disconnect", () => {
        logger.debug(`[SocketManager] Client disconnected: ${socket.id}`);
      });
    });
  },

  emitToRoom(room: string, event: string, data: unknown) {
    if (!ioInstance) {
      logger.warn("[SocketManager] Not initialized, dropping event");
      return;
    }
    ioInstance.to(room).emit(event, data);
  },

  emit(event: string, data: unknown) {
    if (!ioInstance) return;
    ioInstance.emit(event, data);
  },
};
