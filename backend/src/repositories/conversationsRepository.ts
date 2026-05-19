import supabaseAdmin from "../lib/supabase";
import { requireString } from "../utils/validation";

export async function getConversationsForUser(userId: string) {
  // TODO: shape response with members and last message in service layer.
  const { data, error } = await supabaseAdmin
    .from("conversation_members")
    .select("conversation_id, role, muted_until, archived_at, pinned_at, conversations(*)")
    .eq("user_id", requireString(userId, "user_id"));

  if (error) throw new Error(`get_conversations_failed: ${error.message}`);
  return data;
}

export async function createDirectConversation(userAId: string, userBId: string) {
  // TODO: implement atomically with membership insert and duplicate-direct detection.
  void userAId;
  void userBId;
  throw new Error("Not implemented yet");
}

export async function createGroupConversation(createdBy: string, title: string, memberIds: string[]) {
  // TODO: implement atomically with owner/admin/member rows.
  void createdBy;
  void title;
  void memberIds;
  throw new Error("Not implemented yet");
}
