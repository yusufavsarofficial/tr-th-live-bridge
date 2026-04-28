import React, { useEffect, useMemo, useState } from "react";
import { Audio } from "expo-av";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ChatMessage, MessageBubble } from "../components/MessageBubble";
import { SOCKET_EVENTS } from "../config/socketEvents";
import { getStrings } from "../i18n";
import { clearSession, Session } from "../services/auth";
import { startRecording, stopRecording, uploadAudio } from "../services/audio";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { theme } from "../theme/theme";
import { createCallId } from "../utils/call";

type Props = { session: Session; onLogout: () => void; onOpenCall: (callId: string) => void };

export function ChatScreen({ session, onLogout, onOpenCall }: Props) {
  const labels = getStrings(session.user.lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState<string[]>([]);
  const [typingUser, setTypingUser] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const partner = session.user.username === "Yusuf" ? "Neeja" : "Yusuf";
  const partnerOnline = online.includes(partner);
  const messageLabels = useMemo(() => ({ original: labels.original, translation: labels.translation, play: labels.play, read: labels.read }), [labels]);

  useEffect(() => {
    const socket = connectSocket(session.token);
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, (message: ChatMessage) => {
      setMessages((current) => [...current, message]);
      if (message.sender_username !== session.user.username) socket.emit(SOCKET_EVENTS.MESSAGE_READ, { messageId: message.id });
    });
    socket.on(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, ({ messageId, readBy }: { messageId: string; readBy: string }) => {
      setMessages((current) => current.map((item) => item.id === messageId && !item.read_by.includes(readBy) ? { ...item, read_by: [...item.read_by, readBy] } : item));
    });
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, ({ online: nextOnline }: { online: string[] }) => setOnline(nextOnline));
    socket.on(SOCKET_EVENTS.TYPING_START, ({ username }: { username: string }) => setTypingUser(username));
    socket.on(SOCKET_EVENTS.TYPING_STOP, () => setTypingUser(""));
    socket.on(SOCKET_EVENTS.CALL_INCOMING, ({ callId }: { callId: string }) => onOpenCall(callId));
    return () => disconnectSocket();
  }, [onOpenCall, session.token, session.user.username]);

  function sendText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    getSocket()?.emit(SOCKET_EVENTS.MESSAGE_SEND, { text: trimmed, messageType: "text" });
    getSocket()?.emit(SOCKET_EVENTS.TYPING_STOP);
    setText("");
  }

  async function toggleRecording() {
    if (recording) {
      const uri = await stopRecording(recording);
      setRecording(null);
      if (uri) getSocket()?.emit(SOCKET_EVENTS.MESSAGE_SEND, { audioUrl: await uploadAudio(uri, session.token), messageType: "audio" });
      return;
    }
    setRecording(await startRecording());
  }

  function startCall() {
    const callId = createCallId();
    getSocket()?.emit(SOCKET_EVENTS.CALL_START, { callId });
    onOpenCall(callId);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{partner}</Text>
          <Text style={styles.status}>{partnerOnline ? labels.online : labels.offline}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button label={labels.call} onPress={startCall} />
          <Button label={labels.logout} onPress={async () => { await clearSession(); disconnectSocket(); onLogout(); }} variant="ghost" />
        </View>
      </View>
      <FlatList style={styles.list} data={messages} keyExtractor={(item) => item.id} renderItem={({ item }) => <MessageBubble message={item} mine={item.sender_username === session.user.username} read={item.read_by.includes(partner)} labels={messageLabels} />} />
      {typingUser ? <Text style={styles.typing}>{labels.typing}</Text> : null}
      <View style={styles.composer}>
        <TextInput style={styles.messageInput} value={text} onChangeText={(value) => { setText(value); getSocket()?.emit(value ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP); }} placeholder={labels.messagePlaceholder} placeholderTextColor={theme.colors.muted} />
        <Button label={recording ? labels.stop : labels.record} onPress={toggleRecording} variant="ghost" />
        <Button label={labels.send} onPress={sendText} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.md, borderBottomWidth: 1, borderColor: theme.colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: "800" },
  status: { color: theme.colors.muted },
  headerActions: { flexDirection: "row", gap: theme.spacing.sm },
  list: { flex: 1, padding: theme.spacing.md },
  typing: { color: theme.colors.muted, paddingHorizontal: theme.spacing.md },
  composer: { padding: theme.spacing.md, gap: theme.spacing.sm, borderTopWidth: 1, borderColor: theme.colors.border },
  messageInput: { minHeight: 46, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text, paddingHorizontal: theme.spacing.md }
});
