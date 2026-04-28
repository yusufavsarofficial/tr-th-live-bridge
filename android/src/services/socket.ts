import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "../config/backend";

let socket: Socket | null = null;

export function connectSocket(token: string) {
  socket = io(BACKEND_URL, { transports: ["websocket"], auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
