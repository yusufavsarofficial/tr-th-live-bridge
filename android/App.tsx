import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChatScreen } from "./src/screens/ChatScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { VideoCallScreen } from "./src/screens/VideoCallScreen";
import { getStoredSession, Session } from "./src/services/auth";
import { theme } from "./src/theme/theme";

type Screen = "login" | "chat" | "call";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [callId, setCallId] = useState<string | null>(null);

  useEffect(() => {
    getStoredSession().then((stored) => {
      if (stored) {
        setSession(stored);
        setScreen("chat");
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {screen === "login" || !session ? <LoginScreen onLogin={(next) => { setSession(next); setScreen("chat"); }} /> : null}
      {screen === "chat" && session ? <ChatScreen session={session} onLogout={() => { setSession(null); setScreen("login"); }} onOpenCall={(nextCallId) => { setCallId(nextCallId); setScreen("call"); }} /> : null}
      {screen === "call" && session ? <VideoCallScreen session={session} callId={callId} onClose={() => { setCallId(null); setScreen("chat"); }} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background }
});
