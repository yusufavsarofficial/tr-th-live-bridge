# PHASE 3 Supabase Schema Plan

## Scope
- Added SQL-only PostgreSQL foundation.
- No Supabase client connection.
- No credentials, auth implementation, app rewrite, or Android UI work.

## Table Purpose
- `users`: app profiles, presence, avatar/about, phone or username identity.
- `conversations`: direct and group chat containers.
- `conversation_members`: membership, role, mute/archive/pin per user.
- `messages`: conversation-scoped message content and soft edit/delete metadata.
- `message_status`: per-user delivery/read/failed receipts.
- `calls`: conversation-scoped audio/video call sessions.
- `call_participants`: per-user call state and join/leave times.
- `media_files`: uploaded message media and avatar file metadata.

## Multi-User Support
- Conversations replace the old single `pingle-room`.
- Members allow direct chats and groups without a 2-user cap.
- Messages are scoped by `conversation_id`, not one global history file.
- Receipts are per user, so delivery/read state works for groups.
- Calls and call participants support multi-user call state later.
- Media files are owned by users and optionally linked to conversations/messages.

## RLS Policies Needed Later
- Users can read limited public profile fields for visible contacts/conversations.
- Users can update only their own profile and presence.
- Conversation rows are readable only by members.
- Conversation creation must insert creator membership atomically.
- Members can read only their own membership rows plus visible peer/member summaries.
- Messages can be read only by conversation members.
- Messages can be inserted only by authenticated conversation members.
- Message edits/deletes are limited to sender or group admin rules.
- Message status rows can be written only for the authenticated user.
- Calls and call participants are visible only to conversation members.
- Media files are readable only by owner or conversation members.
- Service-role backend may bypass RLS for translation/STT/TTS jobs if needed.

## Backend Services Using Tables
- Auth/session: `users`.
- Conversation API: `conversations`, `conversation_members`.
- Realtime messaging: `messages`, `message_status`.
- Presence: `users`, `conversation_members`.
- Calls/WebRTC signaling: `calls`, `call_participants`.
- Media upload service: `media_files`.
- Push notifications later: `users`, `conversation_members`, `messages`, `calls`.
- Translation/STT/TTS later: `messages`, `media_files`, future job tables.

## Phase 4 Remains
- Add Supabase client configuration without committing secrets.
- Draft RLS policies and test with member/non-member access.
- Add backend repository/service layer.
- Wire `message:send` to persist `messages` and emit `message:new`.
- Wire delivery/read events to `message_status`.
- Keep old `server.js` running until the TypeScript backend is ready.
