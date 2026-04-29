import axios from "axios";
import { BACKEND_URL } from "../config/backend";
import { Lang } from "../i18n";

export type User = { username: "Yusuf" | "Neeja"; displayName: string; lang: Lang };
export type Session = { token: string; user: User };

export async function login(username: string, password: string, roomCode: string): Promise<Session> {
  const response = await axios.post(`${BACKEND_URL}/api/auth/login`, { username, password, roomCode });
  return response.data as Session;
}

export async function getStoredSession(): Promise<Session | null> {
  return null;
}

export async function clearSession() {
  return;
}
