import supabaseAdmin from "../lib/supabase";

export async function getUserById(userId: string) {
  // TODO: enforce backend auth/session rules before exposing user data.
  return supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle();
}

export async function getUserByUsername(username: string) {
  // TODO: normalize username consistently before querying.
  return supabaseAdmin.from("users").select("*").eq("username", username).maybeSingle();
}

export async function updateUserOnlineStatus(userId: string, isOnline: boolean) {
  // TODO: decide presence debounce and last_seen_at semantics.
  return supabaseAdmin
    .from("users")
    .update({
      is_online: isOnline,
      last_seen_at: isOnline ? null : new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .maybeSingle();
}
