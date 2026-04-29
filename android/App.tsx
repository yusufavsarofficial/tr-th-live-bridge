import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChatScreen } from "./src/screens/ChatScreen";
import { LocationConsentScreen } from "./src/screens/LocationConsentScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { VideoCallScreen } from "./src/screens/VideoCallScreen";
import { getStoredSession, Session } from "./src/services/auth";
import { getLocationConsent, startLocationSharing } from "./src/services/location";
import { theme } from "./src/theme/theme";

type Screen = "login" | "chat" | "location-consent";
type CallMode = "incoming" | "outgoing";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [callId, setCallId] = useState<string | null>(null);
  const [callMode, setCallMode] = useState<CallMode>("outgoing");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    getStoredSession().then(async (stored) => {
      if (stored) {
        setSession(stored);
        const consent = await getLocationConsent();
        if (consent === "accepted") startLocationSharing(stored).catch(() => undefined);
        setScreen(consent ? "chat" : "location-consent");
      }
    });
  }, []);

  async function enterAfterLogin(next: Session) {
    setSession(next);
    const consent = await getLocationConsent();
    if (consent === "accepted") startLocationSharing(next).catch(() => undefined);
    setScreen(consent ? "chat" : "location-consent");
  }

  function logout() {
    setSession(null);
    setCallId(null);
    setSettingsOpen(false);
    setScreen("login");
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {screen === "login" || !session ? <LoginScreen onLogin={enterAfterLogin} /> : null}
      {screen === "location-consent" && session ? <LocationConsentScreen session={session} onDone={() => setScreen("chat")} /> : null}
      {screen === "chat" && session ? (
        <ChatScreen
          session={session}
          onLogout={logout}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCall={(nextCallId) => { setCallId(nextCallId); setCallMode("outgoing"); }}
          onIncomingCall={(nextCallId) => { setCallId(nextCallId); setCallMode("incoming"); }}
        />
      ) : null}
      {screen === "chat" && session && callId ? (
        <VideoCallScreen session={session} callId={callId} mode={callMode} onClose={() => setCallId(null)} />
      ) : null}
      {screen === "chat" && session && settingsOpen ? (
        <SettingsScreen session={session} onClose={() => setSettingsOpen(false)} onLogout={logout} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background }
});
