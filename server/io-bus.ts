import type { Server as IOServer } from "socket.io";

type Globals = { __dndIo?: IOServer };

export function setIo(io: IOServer): void {
  (globalThis as Globals).__dndIo = io;
}

export function getIo(): IOServer | null {
  return (globalThis as Globals).__dndIo ?? null;
}
