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
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 20000
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
