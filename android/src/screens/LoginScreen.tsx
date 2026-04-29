import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { getStrings } from "../i18n";
import { login, Session } from "../services/auth";
import { theme } from "../theme/theme";

type Props = { onLogin: (session: Session) => void };

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState<"Yusuf" | "Neeja">("Yusuf");
  const [password, setPassword] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const labels = getStrings(username === "Neeja" ? "th" : "tr");

  async function submit() {
    try {
      setError("");
      onLogin(await login(username, password, roomCode));
    } catch {
      setError(labels.loginError);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoHeart}>♥</Text>
      </View>
      <Text style={styles.title}>{labels.appName}</Text>
      <View style={styles.switcher}>
        <Button label="Yusuf" onPress={() => setUsername("Yusuf")} variant={username === "Yusuf" ? "primary" : "ghost"} />
        <Button label="Neeja" onPress={() => setUsername("Neeja")} variant={username === "Neeja" ? "primary" : "ghost"} />
      </View>
      <TextInput style={styles.input} value={username} editable={false} placeholder={labels.username} placeholderTextColor={theme.colors.muted} />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder={labels.password} placeholderTextColor={theme.colors.muted} />
      <TextInput style={styles.input} value={roomCode} onChangeText={setRoomCode} placeholder={labels.roomCode} placeholderTextColor={theme.colors.muted} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={labels.login} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.background },
  logo: { width: 86, height: 86, borderRadius: 43, backgroundColor: theme.colors.heart, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: theme.spacing.sm, borderWidth: 3, borderColor: "#FF8A80" },
  logoHeart: { color: theme.colors.primaryText, fontSize: 44, fontWeight: "900", lineHeight: 50 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: "800", marginBottom: theme.spacing.lg, textAlign: "center" },
  switcher: { flexDirection: "row", gap: theme.spacing.sm },
  input: { minHeight: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text, paddingHorizontal: theme.spacing.md },
  error: { color: theme.colors.danger }
});
