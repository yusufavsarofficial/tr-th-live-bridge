import axios from "axios";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { BACKEND_URL } from "../config/backend";

const EAS_PROJECT_ID = "43674389-3436-4e56-86b7-3f01df5a60b9";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function registerForPushNotifications(authToken: string) {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Sevgilim Chat",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E53935"
      });
    }

    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return;

    const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    await axios.post(`${BACKEND_URL}/api/push-token`, { token: token.data }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  } catch {
    // Push is best-effort. Chat history still loads messages when the app opens.
  }
}
