import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { BACKEND_URL } from "../config/backend";
import { Lang } from "../i18n";

export type User = { username: "Yusuf" | "Neeja"; displayName: string; lang: Lang };
export type Session = { token: string; user: User };

const SESSION_KEY = "sevgilim-chat-session";

export async function login(username: string, password: string, roomCode: string): Promise<Session> {
  const response = await axios.post(`${BACKEND_URL}/api/auth/login`, { username, password, roomCode });
  const session = response.data as Session;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function getStoredSession(): Promise<Session | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function verifySession(session: Session): Promise<Session | null> {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${session.token}` },
      timeout: 12000
    });
    return { token: session.token, user: response.data.user || session.user };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await clearSession();
      return null;
    }
    return session;
  }
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
