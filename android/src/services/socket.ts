import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "../config/backend";

let socket: Socket | null = null;
let currentToken = "";

export function connectSocket(token: string) {
  if (socket && currentToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket?.disconnect();
  currentToken = token;
  socket = io(BACKEND_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 6000,
    timeout: 12000
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = "";
}
