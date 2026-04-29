import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChatScreen } from "./src/screens/ChatScreen";
import { LocationConsentScreen } from "./src/screens/LocationConsentScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { VideoCallScreen } from "./src/screens/VideoCallScreen";
import { clearSession, getStoredSession, Session, verifySession } from "./src/services/auth";
import { getLocationConsent, startLocationSharing, stopLocationSharing } from "./src/services/location";
import { disconnectSocket } from "./src/services/socket";
import { theme } from "./src/theme/theme";

type Screen = "login" | "chat" | "location-consent";
type CallMode = "incoming" | "outgoing";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [callId, setCallId] = useState<string | null>(null);
  const [callMode, setCallMode] = useState<CallMode>("outgoing");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    getStoredSession().then(async (stored) => {
      if (!active) return;
      if (stored) {
        const verified = await verifySession(stored);
        if (!active) return;
        if (!verified) {
          setScreen("login");
          return;
        }
        setSession(verified);
        const consent = await getLocationConsent();
        if (consent === "accepted") startLocationSharing(verified).catch(() => undefined);
        setScreen(consent ? "chat" : "location-consent");
      }
    }).catch(() => {
      setScreen("login");
    }).finally(() => {
      if (active) setBooting(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function enterAfterLogin(next: Session) {
    setSession(next);
    const consent = await getLocationConsent();
    if (consent === "accepted") startLocationSharing(next).catch(() => undefined);
    setScreen(consent ? "chat" : "location-consent");
  }

  async function logout() {
    await stopLocationSharing().catch(() => undefined);
    await clearSession().catch(() => undefined);
    disconnectSocket();
    setSession(null);
    setCallId(null);
    setSettingsOpen(false);
    setScreen("login");
  }

  const openOutgoingCall = useCallback((nextCallId: string) => {
    setCallId(nextCallId);
    setCallMode("outgoing");
  }, []);

  const openIncomingCall = useCallback((nextCallId: string) => {
    setCallId(nextCallId);
    setCallMode("incoming");
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {booting ? (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Sevgilim Chat</Text>
        </View>
      ) : null}
      {!booting && (screen === "login" || !session) ? <LoginScreen onLogin={enterAfterLogin} /> : null}
      {!booting && screen === "location-consent" && session ? <LocationConsentScreen session={session} onDone={() => setScreen("chat")} /> : null}
      {!booting && screen === "chat" && session ? (
        <ChatScreen
          session={session}
          onLogout={logout}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCall={openOutgoingCall}
          onIncomingCall={openIncomingCall}
        />
      ) : null}
      {!booting && screen === "chat" && session && callId ? (
        <VideoCallScreen session={session} callId={callId} mode={callMode} onClose={() => setCallId(null)} />
      ) : null}
      {!booting && screen === "chat" && session && settingsOpen ? (
        <SettingsScreen session={session} onClose={() => setSettingsOpen(false)} onLogout={logout} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  loadingText: { color: theme.colors.text, fontSize: 24, fontWeight: "900" }
});
