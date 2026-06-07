import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io("http://localhost:3001", {
      autoConnect: true,
      withCredentials: true,
    });
  }
  return socketInstance;
};

export interface ImportProgress {
  importJobId: string;
  status: string;
  progress?: number;
  summary?: any;
  error?: string;
}

export function useImportProgress(jobId: string | null) {
  const [progressData, setProgressData] = useState<ImportProgress | null>(null);

  useEffect(() => {
    if (!jobId) {
      setProgressData(null);
      return;
    }

    const socket = getSocket();

    // Connect socket if not connected
    if (!socket.connected) {
      socket.connect();
    }

    // Subscribe to room
    socket.emit("subscribe:import", jobId);

    const handleProgress = (data: any) => {
      if (data.importJobId === jobId) {
        setProgressData((prev) => ({
          ...prev,
          importJobId: data.importJobId,
          status: data.status || data.stage || prev?.status || "QUEUED",
          progress: data.progress !== undefined ? data.progress : prev?.progress,
          error: data.error || (data.stage === "FAILED" ? data.message : undefined) || prev?.error,
          summary: data.summary || prev?.summary,
        }));
      }
    };

    const handleCompleted = (data: any) => {
      if (data.importJobId === jobId) {
        setProgressData((prev) => ({
          ...prev,
          importJobId: data.importJobId,
          status: "COMPLETED",
          progress: 100,
          summary: data.summary,
        }));
      }
    };

    socket.on("import:progress", handleProgress);
    socket.on("import:completed", handleCompleted);

    return () => {
      socket.off("import:progress", handleProgress);
      socket.off("import:completed", handleCompleted);
      socket.emit("unsubscribe:import", jobId);
    };
  }, [jobId]);

  return progressData;
}

export function useSocketStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return connected;
}
