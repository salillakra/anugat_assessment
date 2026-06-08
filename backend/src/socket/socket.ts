import { Server } from "socket.io";
import { logger } from "../utils/logger";

let ioInstance: Server | null = null;

// Buffer events that arrive before init() is called
type PendingEvent = { room: string; event: string; data: unknown };
const pendingEvents: PendingEvent[] = [];

export const SocketManager = {
  init(io: Server) {
    ioInstance = io;
    logger.info("[SocketManager] Socket.IO initialized");

    // Flush any events that were emitted before init()
    if (pendingEvents.length > 0) {
      logger.info(
        `[SocketManager] Flushing ${pendingEvents.length} buffered event(s)`,
      );
      for (const { room, event, data } of pendingEvents) {
        io.to(room).emit(event, data);
      }
      pendingEvents.length = 0;
    }

    io.on("connection", (socket) => {
      logger.debug(`[SocketManager] Client connected: ${socket.id}`);

      socket.on("subscribe:import", (importJobId: string) => {
        socket.join(`import:${importJobId}`);
        logger.debug(
          `[SocketManager] ${socket.id} subscribed to import:${importJobId}`,
        );
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
      // Buffer the event — init() hasn't been called yet in this execution context
      pendingEvents.push({ room, event, data });
      logger.debug(
        `[SocketManager] Buffered event "${event}" for room "${room}" (not yet initialized)`,
      );
      return;
    }
    ioInstance.to(room).emit(event, data);
  },

  emit(event: string, data: unknown) {
    if (!ioInstance) {
      logger.debug(
        `[SocketManager] Buffered broadcast event "${event}" (not yet initialized)`,
      );
      return;
    }
    ioInstance.emit(event, data);
  },
};
