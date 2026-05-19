import supabaseAdmin from "../lib/supabase";
import { isValidMessageType, requireString } from "../utils/validation";

type CreateMessageInput = {
  conversationId: string;
  senderId: string;
  type: "text" | "image" | "audio" | "video" | "file" | "system";
  body?: string;
  mediaUrl?: string;
  replyToMessageId?: string;
};

export async function getMessagesForConversation(conversationId: string, limit = 50) {
  // TODO: verify requester membership before returning messages.
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", requireString(conversationId, "conversation_id"))
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`get_messages_failed: ${error.message}`);
  return data;
}

export async function createMessage(input: CreateMessageInput) {
  // TODO: validate membership, media ownership, and system-message permissions.
  if (!isValidMessageType(input.type)) {
    throw new Error("invalid_message_type");
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: requireString(input.conversationId, "conversation_id"),
      sender_id: requireString(input.senderId, "sender_id"),
      type: input.type,
      body: input.body,
      media_url: input.mediaUrl,
      reply_to_message_id: input.replyToMessageId,
    })
    .select("*")
    .single();

  if (error) throw new Error(`create_message_failed: ${error.message}`);
  return data;
}

export async function markMessageStatus(messageId: string, userId: string, status: string) {
  // TODO: restrict status transitions and ensure user belongs to the conversation.
  if (!["sent", "delivered", "read", "failed"].includes(status)) {
    throw new Error("invalid_message_status");
  }

  const { data, error } = await supabaseAdmin
    .from("message_status")
    .upsert({
      message_id: requireString(messageId, "message_id"),
      user_id: requireString(userId, "user_id"),
      status,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(`mark_message_status_failed: ${error.message}`);
  return data;
}
