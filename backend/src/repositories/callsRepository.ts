import supabaseAdmin from "../lib/supabase";

type CreateCallInput = {
  conversationId: string;
  callerId: string;
  type: "audio" | "video";
  status?: "ringing" | "accepted" | "rejected" | "missed" | "ended";
};

export async function createCall(input: CreateCallInput) {
  // TODO: verify caller membership and create participant rows in service layer.
  return supabaseAdmin
    .from("calls")
    .insert({
      conversation_id: input.conversationId,
      caller_id: input.callerId,
      type: input.type,
      status: input.status || "ringing",
    })
    .select("*")
    .single();
}

export async function updateCallStatus(callId: string, status: string) {
  // TODO: validate call state transitions.
  return supabaseAdmin
    .from("calls")
    .update({ status, ended_at: status === "ended" ? new Date().toISOString() : null })
    .eq("id", callId)
    .select("*")
    .maybeSingle();
}

export async function addCallParticipant(callId: string, userId: string, status: string) {
  // TODO: verify user is a member of the call conversation.
  return supabaseAdmin
    .from("call_participants")
    .upsert({
      call_id: callId,
      user_id: userId,
      status,
      joined_at: status === "accepted" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
}
