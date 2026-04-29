import React, { useEffect, useMemo, useRef, useState } from "react";
import { Audio } from "expo-av";
import axios from "axios";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Button } from "../components/Button";
import { ChatMessage, MessageBubble } from "../components/MessageBubble";
import { BACKEND_URL } from "../config/backend";
import { SOCKET_EVENTS } from "../config/socketEvents";
import { getStrings } from "../i18n";
import { Session } from "../services/auth";
import { startRecording, stopRecording, uploadAudio } from "../services/audio";
import { registerForPushNotifications } from "../services/notifications";
import { connectSocket, getSocket } from "../services/socket";
import { theme } from "../theme/theme";
import { createCallId } from "../utils/call";

type Props = {
  session: Session;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenCall: (callId: string) => void;
  onIncomingCall: (callId: string) => void;
};

type Ack = { ok: boolean; error?: string; message?: ChatMessage };

function normalizeMessage(message: Partial<ChatMessage> & Record<string, unknown>): ChatMessage {
  return {
    id: String(message.id || message.client_id || message.clientId || `local-${Date.now()}`),
    client_id: typeof message.client_id === "string" ? message.client_id : typeof message.clientId === "string" ? message.clientId : undefined,
    sender_username: String(message.sender_username || message.sender || ""),
    receiver_username: typeof message.receiver_username === "string" ? message.receiver_username : undefined,
    sender_lang: typeof message.sender_lang === "string" ? message.sender_lang : typeof message.senderLang === "string" ? message.senderLang : undefined,
    target_lang: typeof message.target_lang === "string" ? message.target_lang : typeof message.targetLang === "string" ? message.targetLang : undefined,
    original_text: String(message.original_text || message.originalText || ""),
    translated_text: String(message.translated_text || message.translatedText || ""),
    audio_url: typeof message.audio_url === "string" ? message.audio_url : typeof message.audioUrl === "string" ? message.audioUrl : null,
    message_type: message.message_type === "audio" || message.type === "audio" ? "audio" : "text",
    status: message.status === "sending" || message.status === "sent" || message.status === "delivered" || message.status === "read" || message.status === "failed" ? message.status : "sent",
    read_by: Array.isArray(message.read_by) ? message.read_by.map(String) : [],
    created_at: typeof message.created_at === "string" ? message.created_at : typeof message.createdAt === "string" ? message.createdAt : new Date().toISOString(),
    updated_at: typeof message.updated_at === "string" ? message.updated_at : typeof message.updatedAt === "string" ? message.updatedAt : undefined
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  const byClientId = new Map<string, string>();

  [...current, ...incoming].forEach((message) => {
    const existingKey = message.client_id ? byClientId.get(message.client_id) : undefined;
    let key = existingKey || message.id;
    if (existingKey && existingKey !== message.id && !message.id.startsWith("local-")) {
      byId.delete(existingKey);
      key = message.id;
    }
    const previous = byId.get(key);
    const merged = { ...(previous || {}), ...message };
    byId.set(key, { ...merged, id: key });
    if (message.client_id) byClientId.set(message.client_id, key);
  });

  return Array.from(byId.values()).sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

export function ChatScreen({ session, onLogout, onOpenSettings, onOpenCall, onIncomingCall }: Props) {
  const labels = getStrings(session.user.lang);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const atBottomRef = useRef(true);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDoneRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState<string[]>([]);
  const [typingUser, setTypingUser] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [notice, setNotice] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const partner = session.user.username === "Yusuf" ? "Neeja" : "Yusuf";
  const partnerOnline = online.includes(partner);
  const messageLabels = useMemo(() => ({
    original: labels.original,
    translation: labels.translation,
    voiceText: labels.voiceText,
    play: labels.play,
    read: labels.read,
    sent: labels.sent,
    delivered: labels.delivered,
    sending: labels.sending,
    failed: labels.failed,
    translating: labels.translating,
    delete: labels.delete
  }), [labels]);

  function friendlyNotice(code: string) {
    if (code === "BAGLANTI_YOK") return labels.noConnection;
    if (code === "BAGLANTI_KONTROL_EDILIYOR") return labels.reconnecting;
    if (code === "SUNUCU_UYANIYOR") return labels.wakingServer;
    if (code === "AUDIO_FILE_TOO_LARGE") return "Sesli mesaj çok büyük.";
    if (code === "AUDIO_TRANSLATION_FAILED") return "Ses çevirisi alınamadı.";
    if (code === "MICROPHONE_PERMISSION_REQUIRED") return "Mikrofon izni gerekli.";
    if (code === "INVALID_TOKEN") return "Oturum süresi doldu, tekrar giriş yap.";
    return "Geçici bir sorun oluştu, tekrar deneyin.";
  }

  function scrollToEnd(animated = true) {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
    atBottomRef.current = true;
    setShowNewMessage(false);
  }

  function markIncomingAsSeen(socket: ReturnType<typeof getSocket>, message: ChatMessage) {
    if (message.sender_username === session.user.username) return;
    socket?.emit(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: message.id });
    socket?.emit(SOCKET_EVENTS.MESSAGE_READ, { messageId: message.id });
  }

  useEffect(() => {
    let active = true;
    let loadingHistory = false;
    const socket = connectSocket(session.token);
    registerForPushNotifications(session.token);

    async function loadHistory(silent = false) {
      if (loadingHistory) return;
      loadingHistory = true;
      try {
        const response = await axios.get(`${BACKEND_URL}/api/messages`, {
          headers: { Authorization: `Bearer ${session.token}` },
          timeout: 15000
        });
        if (!active) return;
        const nextMessages = ((response.data?.messages || []) as Array<Partial<ChatMessage> & Record<string, unknown>>).map(normalizeMessage);
        setMessages((current) => mergeMessages(current, nextMessages));
        nextMessages.forEach((message) => markIncomingAsSeen(socket, message));
        if (!silent || atBottomRef.current) scrollToEnd(false);
      } catch (error) {
        if (!active) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setNotice(friendlyNotice("INVALID_TOKEN"));
          setTimeout(onLogout, 1200);
          return;
        }
        if (!silent) setNotice("Mesaj geçmişi yüklenemedi.");
      } finally {
        loadingHistory = false;
      }
    }

    loadHistory();

    axios.get(`${BACKEND_URL}/api/calls/pending`, {
      headers: { Authorization: `Bearer ${session.token}` },
      timeout: 12000
    }).then((response) => {
      const pendingCall = response.data?.calls?.[0];
      if (active && pendingCall?.call_id) onIncomingCall(pendingCall.call_id);
    }).catch(() => undefined);

    const onMessageNew = (raw: ChatMessage) => {
      const message = normalizeMessage(raw);
      setMessages((current) => mergeMessages(current, [message]));
      markIncomingAsSeen(socket, message);
      if (message.sender_username === session.user.username || atBottomRef.current) scrollToEnd();
      else setShowNewMessage(true);
    };
    const onMessageUpdated = (raw: ChatMessage) => {
      const message = normalizeMessage(raw);
      setMessages((current) => mergeMessages(current, [message]));
    };
    const onDeliveryReceipt = ({ messageId }: { messageId: string }) => {
      setMessages((current) => current.map((item) => item.id === messageId && item.status !== "read" ? { ...item, status: "delivered" } : item));
    };
    const onReadReceipt = ({ messageId, readBy }: { messageId: string; readBy: string }) => {
      setMessages((current) => current.map((item) => item.id === messageId && !item.read_by.includes(readBy) ? { ...item, status: "read", read_by: [...item.read_by, readBy] } : item));
    };
    const onMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((current) => current.filter((item) => item.id !== messageId));
    };
    const onPresence = ({ online: nextOnline }: { online: string[] }) => setOnline(nextOnline);
    const onTypingStart = ({ username }: { username: string }) => {
      if (username !== session.user.username) setTypingUser(username);
    };
    const onTypingStop = () => setTypingUser("");
    const onIncoming = ({ callId }: { callId: string }) => onIncomingCall(callId);
    const onConnect = () => {
      setNotice("");
      loadHistory(true);
    };
    const onDisconnect = () => setNotice(friendlyNotice("BAGLANTI_KONTROL_EDILIYOR"));
    const onReconnectAttempt = (attempt: number) => setNotice(attempt > 1 ? friendlyNotice("SUNUCU_UYANIYOR") : friendlyNotice("BAGLANTI_KONTROL_EDILIYOR"));
    const onConnectError = () => setNotice(friendlyNotice("SUNUCU_UYANIYOR"));
    const onError = ({ error, recoverable }: { error: string; recoverable?: boolean }) => {
      if (recoverable) setNotice(friendlyNotice(error));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(SOCKET_EVENTS.MESSAGE_UPDATED, onMessageUpdated);
    socket.on(SOCKET_EVENTS.MESSAGE_DELIVERY_RECEIPT, onDeliveryReceipt);
    socket.on(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, onReadReceipt);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, onMessageDeleted);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    socket.on(SOCKET_EVENTS.TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.CALL_INCOMING, onIncoming);
    socket.on(SOCKET_EVENTS.ERROR, onError);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (!socket.connected) socket.connect();
        loadHistory(true);
      }
    });

    return () => {
      active = false;
      appStateSubscription.remove();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(SOCKET_EVENTS.MESSAGE_UPDATED, onMessageUpdated);
      socket.off(SOCKET_EVENTS.MESSAGE_DELIVERY_RECEIPT, onDeliveryReceipt);
      socket.off(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, onReadReceipt);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, onMessageDeleted);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
      socket.off(SOCKET_EVENTS.TYPING_START, onTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
      socket.off(SOCKET_EVENTS.CALL_INCOMING, onIncoming);
      socket.off(SOCKET_EVENTS.ERROR, onError);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [onIncomingCall, session.token, session.user.username]);

  function onListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 96;
    atBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessage(false);
  }

  function handleTyping(value: string) {
    setText(value);
    const socket = getSocket();
    socket?.emit(value ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket?.emit(SOCKET_EVENTS.TYPING_STOP), 2500);
  }

  function sendOptimistic(payload: { text: string; messageType: "text" | "audio"; audioUrl?: string | null; translatedText?: string }) {
    const socket = getSocket();
    if (!socket?.connected) {
      setNotice(friendlyNotice("BAGLANTI_YOK"));
      return;
    }

    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = normalizeMessage({
      id: clientId,
      client_id: clientId,
      sender_username: session.user.username,
      receiver_username: partner,
      sender_lang: session.user.lang,
      target_lang: session.user.lang === "tr" ? "th" : "tr",
      original_text: payload.text,
      translated_text: payload.translatedText || "",
      audio_url: payload.audioUrl || null,
      message_type: payload.messageType,
      status: "sending",
      read_by: [],
      created_at: new Date().toISOString()
    });
    setMessages((current) => mergeMessages(current, [optimistic]));
    scrollToEnd();

    socket.emit(SOCKET_EVENTS.MESSAGE_SEND, {
      clientId,
      text: payload.text,
      translatedText: payload.translatedText,
      audioUrl: payload.audioUrl,
      messageType: payload.messageType
    }, (ack: Ack) => {
      if (!ack.ok || !ack.message) {
        setMessages((current) => current.map((item) => item.id === clientId ? { ...item, status: "failed" } : item));
        setNotice(friendlyNotice(ack.error || "MESSAGE_SEND_FAILED"));
        return;
      }
      const ackMessage = ack.message;
      setNotice("");
      setMessages((current) => mergeMessages(current.filter((item) => item.id !== clientId), [{ ...normalizeMessage(ackMessage), client_id: clientId }]));
      scrollToEnd();
    });
  }

  function sendText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    getSocket()?.emit(SOCKET_EVENTS.TYPING_STOP);
    sendOptimistic({ text: trimmed, messageType: "text" });
  }

  async function toggleRecording() {
    try {
      if (recording) {
        const uri = await stopRecording(recording);
        setRecording(null);
        if (uri) {
          const uploaded = await uploadAudio(uri, session.token);
          sendOptimistic({
            audioUrl: uploaded.audioUrl,
            text: uploaded.originalText || "",
            translatedText: uploaded.translatedText || "",
            messageType: "audio"
          });
          if (uploaded.warning) setNotice(friendlyNotice(uploaded.warning));
        }
        return;
      }
      setRecording(await startRecording());
    } catch (error) {
      setRecording(null);
      setNotice(friendlyNotice(error instanceof Error ? error.message : "AUDIO_FAILED"));
    }
  }

  function startCall() {
    const socket = getSocket();
    if (!socket?.connected) {
      setNotice(friendlyNotice("BAGLANTI_YOK"));
      return;
    }
    const callId = createCallId();
    socket.emit(SOCKET_EVENTS.CALL_START, { callId });
    onOpenCall(callId);
  }

  function deleteMessage(messageId: string) {
    getSocket()?.emit(SOCKET_EVENTS.MESSAGE_DELETE, { messageId }, (ack: { ok: boolean; error?: string }) => {
      if (!ack.ok) setNotice(friendlyNotice(ack.error || "MESSAGE_DELETE_FAILED"));
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
          <Button label={labels.call} onPress={startCall} variant="icon" />
          <Button label="Ayar" onPress={onOpenSettings} variant="icon" />
        </View>
      </View>

      <View style={styles.chatArea}>
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
              read={item.read_by.includes(partner) || item.status === "read"}
              canDelete={session.user.username === "Yusuf" && !item.id.startsWith("local-")}
              onDelete={deleteMessage}
              labels={messageLabels}
            />
          )}
          keyboardShouldPersistTaps="handled"
          onScroll={onListScroll}
          scrollEventThrottle={80}
          initialNumToRender={28}
          maxToRenderPerBatch={24}
          windowSize={12}
          removeClippedSubviews
          onContentSizeChange={() => {
            if (!initialScrollDoneRef.current || atBottomRef.current) {
              initialScrollDoneRef.current = true;
              scrollToEnd(false);
            }
          }}
        />
        {showNewMessage ? (
          <Pressable style={styles.newMessageButton} onPress={() => scrollToEnd()}>
            <Text style={styles.newMessageText}>{labels.newMessage}</Text>
          </Pressable>
        ) : null}
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.composerWrap}>
        <View style={styles.composer}>
          <Text style={styles.emoji}>+</Text>
          <TextInput
            style={styles.messageInput}
            value={text}
            onChangeText={handleTyping}
            placeholder={labels.messagePlaceholder}
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={4000}
          />
          <Button label={recording ? labels.stop : labels.record} onPress={toggleRecording} variant="icon" />
        </View>
        <Button label={text.trim() ? labels.send : labels.call} onPress={text.trim() ? sendText : startCall} style={styles.sendButton} />
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  chatArea: { flex: 1, backgroundColor: theme.colors.chatBackground, overflow: "hidden" },
  list: { flex: 1 },
  listContent: { paddingTop: 10, paddingBottom: 12 },
  newMessageButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: theme.colors.primary
  },
  newMessageText: { color: theme.colors.primaryText, fontSize: 12, fontWeight: "800" },
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
  sendButton: { width: 64, height: 46, minHeight: 46, paddingHorizontal: 0 }
});
