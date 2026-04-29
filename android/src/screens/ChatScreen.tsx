import React, { useEffect, useMemo, useRef, useState } from "react";
import { Audio } from "expo-av";
import axios from "axios";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
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
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState<string[]>([]);
  const [typingUser, setTypingUser] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [notice, setNotice] = useState("");
  const partner = session.user.username === "Yusuf" ? "Neeja" : "Yusuf";
  const partnerOnline = online.includes(partner);
  const messageLabels = useMemo(() => ({
    original: labels.original,
    translation: labels.translation,
    voiceText: labels.voiceText,
    play: labels.play,
    read: labels.read,
    delete: labels.delete
  }), [labels]);

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

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{partner.slice(0, 1)}</Text></View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{partner}</Text>
            <Text style={styles.status} numberOfLines={1}>
              {typingUser ? labels.typing : partnerOnline ? labels.online : labels.offline}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button label="☎" onPress={startCall} variant="icon" />
          <Button label="⋮" onPress={async () => { await clearSession(); disconnectSocket(); onLogout(); }} variant="icon" />
        </View>
      </View>

      <View style={styles.chatArea}>
        <View style={styles.wallpaperMark} />
        <View style={[styles.wallpaperMark, styles.wallpaperMarkSmall]} />
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              mine={item.sender_username === session.user.username}
              read={item.read_by.includes(partner)}
              canDelete={session.user.username === "Yusuf"}
              onDelete={deleteMessage}
              labels={messageLabels}
            />
          )}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.composerWrap}>
        <View style={styles.composer}>
          <Text style={styles.emoji}>☺</Text>
          <TextInput
            style={styles.messageInput}
            value={text}
            onChangeText={(value) => {
              setText(value);
              getSocket()?.emit(value ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP);
            }}
            placeholder={labels.messagePlaceholder}
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={4000}
          />
          <Button label={recording ? "■" : "🎙"} onPress={toggleRecording} variant="icon" />
        </View>
        <Button label={text.trim() ? "➤" : "☎"} onPress={text.trim() ? sendText : startCall} style={styles.sendButton} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: theme.colors.header,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6
  },
  headerIdentity: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1, minWidth: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.colors.primaryText, fontSize: 19, fontWeight: "900" },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: "800" },
  status: { color: theme.colors.muted, fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  chatArea: { flex: 1, backgroundColor: theme.colors.chatBackground, overflow: "hidden" },
  wallpaperMark: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.025)",
    right: -80,
    top: 80
  },
  wallpaperMarkSmall: { width: 160, height: 160, borderRadius: 80, left: -60, right: undefined, top: 280 },
  list: { flex: 1 },
  listContent: { paddingTop: 10, paddingBottom: 12 },
  notice: {
    color: theme.colors.text,
    backgroundColor: theme.colors.notice,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12
  },
  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: Platform.OS === "android" ? 7 : 10,
    backgroundColor: theme.colors.chatBackground
  },
  composer: {
    flex: 1,
    minHeight: 46,
    maxHeight: 116,
    borderRadius: 23,
    backgroundColor: theme.colors.composer,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 12,
    paddingRight: 2,
    paddingVertical: 3
  },
  emoji: { color: theme.colors.muted, fontSize: 22, paddingBottom: 8, marginRight: 6 },
  messageInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 104,
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 21,
    paddingTop: 9,
    paddingBottom: 8
  },
  sendButton: { width: 46, height: 46, minHeight: 46, paddingHorizontal: 0 }
});
