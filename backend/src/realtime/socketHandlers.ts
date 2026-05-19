import type { Server, Socket } from "socket.io";
import { REALTIME_EVENTS } from "../contracts/realtimeEvents";
import { createMessage, markMessageStatus } from "../repositories/messagesRepository";
import { isValidMessageType, optionalString, requireString } from "../utils/validation";

type Ack = (response: { ok: boolean; error?: string; [key: string]: unknown }) => void;
type RealtimePayload = {
  conversationId?: string;
  userId?: string;
  [key: string]: unknown;
};

type MessageSendPayload = RealtimePayload & {
  senderId?: string;
  type?: string;
  body?: string;
  mediaUrl?: string;
  replyToMessageId?: string;
  tempId?: string;
};
type MessageType = "text" | "image" | "audio" | "video" | "file" | "system";

const socketConversationIds = new Map<string, Set<string>>();

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    socket.on(REALTIME_EVENTS.CONVERSATION_JOIN, (payload: RealtimePayload, ack?: Ack) => {
      try {
        // TODO: validate auth/session userId and conversation membership from database.
        const conversationId = requireConversationId(payload);
        const userId = optionalString(payload?.userId);
        const room = conversationRoom(conversationId);

        trackConversation(socket, conversationId);
        socket.join(room);
        socket.to(room).emit(REALTIME_EVENTS.CONVERSATION_UPDATED, {
          conversationId,
          userId,
          action: "joined",
        });
        ack?.({ ok: true, conversationId });
      } catch (error) {
        acknowledgeError(ack, error);
      }
    });

    socket.on(REALTIME_EVENTS.CONVERSATION_LEAVE, (payload: RealtimePayload, ack?: Ack) => {
      try {
        const conversationId = requireConversationId(payload);
        const room = conversationRoom(conversationId);

        untrackConversation(socket, conversationId);
        socket.leave(room);
        ack?.({ ok: true, conversationId });
      } catch (error) {
        acknowledgeError(ack, error);
      }
    });

    socket.on(REALTIME_EVENTS.MESSAGE_SEND, async (payload: MessageSendPayload, ack?: Ack) => {
      const tempId = optionalString(payload?.tempId);

      try {
        // TODO: replace senderId payload trust with authenticated socket session.
        const conversationId = requireConversationId(payload);
        const senderId = requireString(payload?.senderId, "sender_id");
        const type = requireMessageType(payload?.type);
        const message = await createMessage({
          conversationId,
          senderId,
          type,
          body: optionalString(payload?.body),
          mediaUrl: optionalString(payload?.mediaUrl),
          replyToMessageId: optionalString(payload?.replyToMessageId),
        });

        const eventPayload = { message, tempId, conversationId };
        io.to(conversationRoom(conversationId)).emit(REALTIME_EVENTS.MESSAGE_NEW, eventPayload);
        ack?.({ ok: true, message, tempId });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        socket.emit("message:error", {
          conversationId: optionalString(payload?.conversationId),
          tempId,
          error: errorMessage,
        });
        ack?.({ ok: false, error: errorMessage, tempId });
      }
    });

    socket.on(REALTIME_EVENTS.MESSAGE_TYPING, (payload: RealtimePayload) => {
      try {
        const conversationId = requireConversationId(payload);
        const userId = optionalString(payload?.userId);
        socket.to(conversationRoom(conversationId)).emit(REALTIME_EVENTS.MESSAGE_TYPING, {
          conversationId,
          userId,
          isTyping: Boolean(payload?.isTyping),
        });
      } catch {
        // Ignore malformed typing pings.
      }
    });

    socket.on(REALTIME_EVENTS.MESSAGE_READ, async (payload: RealtimePayload, ack?: Ack) => {
      try {
        // TODO: replace userId payload trust with authenticated socket session.
        const conversationId = requireConversationId(payload);
        const messageId = requireString(payload?.messageId, "message_id");
        const userId = requireString(payload?.userId, "user_id");
        const status = await markMessageStatus(messageId, userId, "read");

        io.to(conversationRoom(conversationId)).emit(REALTIME_EVENTS.MESSAGE_READ, {
          conversationId,
          messageId,
          userId,
          status,
        });
        ack?.({ ok: true, status });
      } catch (error) {
        acknowledgeError(ack, error);
      }
    });

    socket.on(REALTIME_EVENTS.CALL_START, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.CALL_RINGING, ack);
    });

    socket.on(REALTIME_EVENTS.CALL_ACCEPT, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.CALL_ACCEPT, ack);
    });

    socket.on(REALTIME_EVENTS.CALL_REJECT, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.CALL_REJECT, ack);
    });

    socket.on(REALTIME_EVENTS.CALL_END, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.CALL_END, ack);
    });

    socket.on(REALTIME_EVENTS.WEBRTC_OFFER, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.WEBRTC_OFFER, ack);
    });

    socket.on(REALTIME_EVENTS.WEBRTC_ANSWER, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.WEBRTC_ANSWER, ack);
    });

    socket.on(REALTIME_EVENTS.WEBRTC_ICE_CANDIDATE, (payload: RealtimePayload, ack?: Ack) => {
      relayPlaceholder(socket, payload, REALTIME_EVENTS.WEBRTC_ICE_CANDIDATE, ack);
    });

    socket.on("disconnect", () => {
      socketConversationIds.delete(socket.id);
    });
  });
}

function relayToConversation(socket: Socket, payload: RealtimePayload, eventName: string) {
  const conversationId = requireConversationId(payload);

  socket.to(conversationRoom(conversationId)).emit(eventName, {
    ...payload,
    conversationId,
    fromSocketId: socket.id,
  });
}

function relayPlaceholder(socket: Socket, payload: RealtimePayload, eventName: string, ack?: Ack) {
  // TODO: replace with call/WebRTC services after message flow is stable.
  try {
    relayToConversation(socket, payload, eventName);
    ack?.({ ok: true });
  } catch (error) {
    acknowledgeError(ack, error);
  }
}

function trackConversation(socket: Socket, conversationId: string) {
  const conversationIds = socketConversationIds.get(socket.id) || new Set<string>();
  conversationIds.add(conversationId);
  socketConversationIds.set(socket.id, conversationIds);
}

function untrackConversation(socket: Socket, conversationId: string) {
  const conversationIds = socketConversationIds.get(socket.id);
  if (!conversationIds) return;

  conversationIds.delete(conversationId);
  if (conversationIds.size === 0) {
    socketConversationIds.delete(socket.id);
  }
}

function requireConversationId(payload: RealtimePayload) {
  return requireString(payload?.conversationId, "conversation_id");
}

function conversationRoom(conversationId: string) {
  return `conversation:${conversationId}`;
}

function requireMessageType(value: unknown): MessageType {
  if (!isValidMessageType(value)) {
    throw new Error("invalid_message_type");
  }

  return String(value) as MessageType;
}

function acknowledgeError(ack: Ack | undefined, error: unknown) {
  ack?.({ ok: false, error: getErrorMessage(error) });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "socket_error";
}
