import React, { useEffect, useMemo, useState } from "react";
import { Audio } from "expo-av";
import axios from "axios";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ChatMessage, MessageBubble } from "../components/MessageBubble";
import { BACKEND_URL } from "../config/backend";
import { SOCKET_EVENTS } from "../config/socketEvents";
import { getStrings } from "../i18n";
import { clearSession, Session } from "../services/auth";
import { startRecording, stopRecording, uploadAudio } from "../services/audio";
import { registerForPushNotifications } from "../services/notifications";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { theme } from "../theme/theme";
import { createCallId } from "../utils/call";

type Props = { session: Session; onLogout: () => void; onOpenCall: (callId: string) => void; onIncomingCall: (callId: string) => void };

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

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
  const messageLabels = useMemo(() => ({ original: labels.original, translation: labels.translation, voiceText: labels.voiceText, play: labels.play, read: labels.read, delete: labels.delete }), [labels]);

  useEffect(() => {
    let active = true;
    const socket = connectSocket(session.token);
    registerForPushNotifications(session.token);
    axios.get(`${BACKEND_URL}/api/messages`, {
      headers: { Authorization: `Bearer ${session.token}` }
    }).then((response) => {
      const nextMessages = (response.data?.messages || []) as ChatMessage[];
      if (!active) return;
      setMessages((current) => mergeMessages(current, nextMessages));
      nextMessages
        .filter((message) => message.sender_username !== session.user.username && !message.read_by.includes(session.user.username))
        .forEach((message) => socket.emit(SOCKET_EVENTS.MESSAGE_READ, { messageId: message.id }));
    }).catch(() => setNotice("MESAJ_GECMISI_YUKLENEMEDI"));
    axios.get(`${BACKEND_URL}/api/calls/pending`, {
      headers: { Authorization: `Bearer ${session.token}` }
    }).then((response) => {
      const pendingCall = response.data?.calls?.[0];
      if (active && pendingCall?.call_id) onIncomingCall(pendingCall.call_id);
    }).catch(() => undefined);

    const onMessageNew = (message: ChatMessage) => {
      setMessages((current) => mergeMessages(current, [message]));
      if (message.sender_username !== session.user.username) socket.emit(SOCKET_EVENTS.MESSAGE_READ, { messageId: message.id });
    };
    const onReadReceipt = ({ messageId, readBy }: { messageId: string; readBy: string }) => {
      setMessages((current) => current.map((item) => item.id === messageId && !item.read_by.includes(readBy) ? { ...item, read_by: [...item.read_by, readBy] } : item));
    };
    const onMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((current) => current.filter((item) => item.id !== messageId));
    };
    const onPresence = ({ online: nextOnline }: { online: string[] }) => setOnline(nextOnline);
    const onTypingStart = ({ username }: { username: string }) => setTypingUser(username);
    const onTypingStop = () => setTypingUser("");
    const onIncoming = ({ callId }: { callId: string }) => onIncomingCall(callId);
    const onConnect = () => setNotice("");
    const onConnectError = () => setNotice("BAGLANTI_KONTROL_EDILIYOR");
    const onError = ({ error, recoverable }: { error: string; recoverable?: boolean }) => {
      if (recoverable) setNotice(error);
    };

    socket.on("connect", onConnect);
    socket.on(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, onReadReceipt);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, onMessageDeleted);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    socket.on(SOCKET_EVENTS.TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.CALL_INCOMING, onIncoming);
    socket.on(SOCKET_EVENTS.ERROR, onError);

    return () => {
      active = false;
      socket.off("connect", onConnect);
      socket.off(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, onReadReceipt);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, onMessageDeleted);
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
    const socket = getSocket();
    if (!socket) {
      setNotice("BAGLANTI_YOK");
      return;
    }
    socket.emit(SOCKET_EVENTS.MESSAGE_SEND, { text: trimmed, messageType: "text" }, (ack: { ok: boolean; error?: string }) => {
      if (!ack.ok) setNotice(ack.error || "MESSAGE_SEND_FAILED");
      else setNotice("");
    });
    socket.emit(SOCKET_EVENTS.TYPING_STOP);
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

  function deleteMessage(messageId: string) {
    getSocket()?.emit(SOCKET_EVENTS.MESSAGE_DELETE, { messageId }, (ack: { ok: boolean; error?: string }) => {
      if (!ack.ok) setNotice(ack.error || "MESSAGE_DELETE_FAILED");
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>♥</Text></View>
          <View>
          <Text style={styles.title}>{partner}</Text>
          <Text style={styles.status}>{partnerOnline ? labels.online : labels.offline}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button label={labels.call} onPress={startCall} />
          <Button label={labels.logout} onPress={async () => { await clearSession(); disconnectSocket(); onLogout(); }} variant="ghost" />
        </View>
      </View>
      <FlatList style={styles.list} data={messages} keyExtractor={(item) => item.id} renderItem={({ item }) => <MessageBubble message={item} mine={item.sender_username === session.user.username} read={item.read_by.includes(partner)} canDelete={session.user.username === "Yusuf"} onDelete={deleteMessage} labels={messageLabels} />} />
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
  header: { padding: theme.spacing.md, borderBottomWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  headerIdentity: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.heart, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.colors.primaryText, fontSize: 23, fontWeight: "900" },
  title: { color: theme.colors.text, fontSize: 19, fontWeight: "800" },
  status: { color: theme.colors.muted, fontSize: 12 },
  headerActions: { flexDirection: "row", gap: theme.spacing.sm },
  list: { flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.background },
  typing: { color: theme.colors.muted, paddingHorizontal: theme.spacing.md },
  notice: { color: theme.colors.muted, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  composer: { padding: theme.spacing.md, gap: theme.spacing.sm, borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  messageInput: { minHeight: 46, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft, color: theme.colors.text, paddingHorizontal: theme.spacing.md }
});
