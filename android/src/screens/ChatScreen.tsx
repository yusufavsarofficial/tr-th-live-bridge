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

type Props = { session: Session; onLogout: () => void; onOpenCall: (callId: string) => void; onIncomingCall: (callId: string) => void };

export function ChatScreen({ session, onLogout, onOpenCall, onIncomingCall }: Props) {
  const labels = getStrings(session.user.lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState<string[]>([]);
  const [typingUser, setTypingUser] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [notice, setNotice] = useState("");
  const partner = session.user.username === "Yusuf" ? "Neeja" : "Yusuf";
  const partnerOnline = online.includes(partner);
  const messageLabels = useMemo(() => ({ original: labels.original, translation: labels.translation, voiceText: labels.voiceText, play: labels.play, read: labels.read }), [labels]);

  useEffect(() => {
    const socket = connectSocket(session.token);
    const onMessageNew = (message: ChatMessage) => {
      setMessages((current) => [...current, message]);
      if (message.sender_username !== session.user.username) socket.emit(SOCKET_EVENTS.MESSAGE_READ, { messageId: message.id });
    };
    const onReadReceipt = ({ messageId, readBy }: { messageId: string; readBy: string }) => {
      setMessages((current) => current.map((item) => item.id === messageId && !item.read_by.includes(readBy) ? { ...item, read_by: [...item.read_by, readBy] } : item));
    };
    const onPresence = ({ online: nextOnline }: { online: string[] }) => setOnline(nextOnline);
    const onTypingStart = ({ username }: { username: string }) => setTypingUser(username);
    const onTypingStop = () => setTypingUser("");
    const onIncoming = ({ callId }: { callId: string }) => onIncomingCall(callId);
    const onError = ({ error, recoverable }: { error: string; recoverable?: boolean }) => {
      if (recoverable) setNotice(error);
    };

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, onReadReceipt);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    socket.on(SOCKET_EVENTS.TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.CALL_INCOMING, onIncoming);
    socket.on(SOCKET_EVENTS.ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, onReadReceipt);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
      socket.off(SOCKET_EVENTS.TYPING_START, onTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
      socket.off(SOCKET_EVENTS.CALL_INCOMING, onIncoming);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };
  }, [onIncomingCall, session.token, session.user.username]);

  function sendText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    getSocket()?.emit(SOCKET_EVENTS.MESSAGE_SEND, { text: trimmed, messageType: "text" }, (ack: { ok: boolean; error?: string }) => {
      if (!ack.ok) setNotice(ack.error || "MESSAGE_SEND_FAILED");
    });
    getSocket()?.emit(SOCKET_EVENTS.TYPING_STOP);
    setText("");
  }

  async function toggleRecording() {
    if (recording) {
      const uri = await stopRecording(recording);
      setRecording(null);
      if (uri) {
        const uploaded = await uploadAudio(uri, session.token);
        getSocket()?.emit(SOCKET_EVENTS.MESSAGE_SEND, {
          audioUrl: uploaded.audioUrl,
          text: uploaded.originalText,
          translatedText: uploaded.translatedText,
          messageType: "audio"
        });
        if (uploaded.warning) setNotice(uploaded.warning);
      }
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
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
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
  notice: { color: theme.colors.muted, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  composer: { padding: theme.spacing.md, gap: theme.spacing.sm, borderTopWidth: 1, borderColor: theme.colors.border },
  messageInput: { minHeight: 46, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text, paddingHorizontal: theme.spacing.md }
});
