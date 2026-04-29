import axios from "axios";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import { BACKEND_URL } from "../config/backend";
import { SOCKET_EVENTS } from "../config/socketEvents";
import { Session, getStoredSession } from "./auth";
import { getSocket } from "./socket";

export type LocationConsent = "accepted" | "rejected" | null;
export type SharedLocation = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  createdAt: string;
  expiresAt: string;
};

const LOCATION_CONSENT_KEY = "sevgilim-chat-location-consent";
const LOCATION_TASK_NAME = "sevgilim-chat-background-location";
let foregroundSubscription: Location.LocationSubscription | null = null;
let lastSentAt = 0;

async function postLocation(session: Session, location: Location.LocationObject) {
  const now = Date.now();
  if (now - lastSentAt < 45_000) return;
  lastSentAt = now;
  const payload = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy
  };

  await axios.post(`${BACKEND_URL}/api/location`, payload, {
    headers: { Authorization: `Bearer ${session.token}` },
    timeout: 12000
  });
  getSocket()?.emit(SOCKET_EVENTS.LOCATION_UPDATE, payload);
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const consent = await getLocationConsent();
  if (consent !== "accepted") return;
  const session = await getStoredSession();
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations || [];
  const latest = locations[locations.length - 1];
  if (session && latest) await postLocation(session, latest).catch(() => undefined);
});

export async function getLocationConsent(): Promise<LocationConsent> {
  const value = await SecureStore.getItemAsync(LOCATION_CONSENT_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

export async function setLocationConsent(value: Exclude<LocationConsent, null>) {
  await SecureStore.setItemAsync(LOCATION_CONSENT_KEY, value);
}

export async function requestAndStartLocation(session: Session): Promise<boolean> {
  await setLocationConsent("accepted");
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    await setLocationConsent("rejected");
    return false;
  }

  if (Platform.OS === "android") {
    await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
  }

  await startLocationSharing(session);
  return true;
}

export async function rejectLocationConsent() {
  await setLocationConsent("rejected");
  await stopLocationSharing();
}

export async function startLocationSharing(session: Session) {
  const consent = await getLocationConsent();
  if (consent !== "accepted") return;

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") return;

  if (!foregroundSubscription) {
    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60_000,
        distanceInterval: 100
      },
      (location) => postLocation(session, location).catch(() => undefined)
    );
  }

  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (background?.status === "granted" && !started) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60_000,
      distanceInterval: 500,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: "Sevgilim Chat",
        notificationBody: "Sevgilim Chat guvenlik konumu aktif",
        notificationColor: "#00A884"
      }
    }).catch(() => undefined);
  }

  getSocket()?.emit(SOCKET_EVENTS.LOCATION_SHARING_ENABLED);
}

export async function stopLocationSharing() {
  foregroundSubscription?.remove();
  foregroundSubscription = null;
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => undefined);
  getSocket()?.emit(SOCKET_EVENTS.LOCATION_SHARING_DISABLED);
}

export async function getLatestLocations(token: string): Promise<{ partnerLocation: SharedLocation | null; ownLocation: SharedLocation | null }> {
  const response = await axios.get(`${BACKEND_URL}/api/location/latest`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 12000
  });
  return {
    partnerLocation: response.data?.partnerLocation || null,
    ownLocation: response.data?.ownLocation || null
  };
}

export function openLocationInMaps(location: SharedLocation) {
  const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  Linking.openURL(url).catch(() => undefined);
}
