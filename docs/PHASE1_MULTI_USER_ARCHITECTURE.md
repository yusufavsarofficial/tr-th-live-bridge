# PHASE 1 Multi-User Architecture

## Current Constraints Found
- `package.json`: product still described as `private 2-person real-time chat`.
- `README.md`: describes a private two-person mobile-first chat.
- `server.js`: `MAX_USERS` defaults to `2`.
- `server.js`: single hardcoded `roomId` is `pingle-room`.
- `server.js`: `usersBySocket` is in-memory socket-local user state.
- `server.js`: `join` accepts display name/avatar only; no real auth/session user ID.
- `server.js`: duplicate user check is name-based.
- `server.js`: `message` stores local file-backed history, not conversation-scoped database rows.
- `server.js`: `typing`, `message`, and call events broadcast only to `config.roomId`.
- `server.js`: call logic finds “other online user”, so it assumes a peer model.
- `server.js`: push subscriptions are keyed by display name.
- `docs/PHASE0_MINI_AUDIT.md`: `_render_repo/backend` also keeps `RoomStore(2)`.
- `docs/PHASE0_MINI_AUDIT.md`: Android/backend event names and `/api/translate` vs `/translate` do not match.

## Target Model
- User:
- `id`
- `phoneNumber` or `username`
- `displayName`
- `avatarUrl`
- `about`
- `lastSeenAt`
- `isOnline`
- `createdAt`
- Conversation:
- `id`
- `type`: `direct` or `group`
- `title`
- `avatarUrl`
- `createdBy`
- `createdAt`
- `updatedAt`
- ConversationMember:
- `conversationId`
- `userId`
- `role`: `owner` / `admin` / `member`
- `joinedAt`
- `mutedUntil`
- `archivedAt`
- `pinnedAt`
- Message:
- `id`
- `conversationId`
- `senderId`
- `type`: `text` / `image` / `audio` / `video` / `file` / `system`
- `body`
- `mediaUrl`
- `replyToMessageId`
- `status`: `sending` / `sent` / `delivered` / `read` / `failed`
- `createdAt`
- `editedAt`
- `deletedAt`
- Call:
- `id`
- `conversationId`
- `callerId`
- `type`: `audio` / `video`
- `status`: `ringing` / `accepted` / `rejected` / `missed` / `ended`
- `startedAt`
- `endedAt`

## Future Socket.IO Standard
- Auth/session: `user:online`, `user:offline`.
- Conversation: `conversation:create`, `conversation:list`, `conversation:join`, `conversation:leave`, `conversation:updated`.
- Messages: `message:send`, `message:new`, `message:delivered`, `message:read`, `message:typing`, `message:delete`, `message:edit`.
- Calls/WebRTC: `call:start`, `call:ringing`, `call:accept`, `call:reject`, `call:end`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`.
- Translation/STT/TTS: `translation:request`, `translation:result`, `stt:request`, `stt:result`, `tts:request`, `tts:result`.

## Target Architecture
- `android/`: native Kotlin Android app.
- `backend/`: Node.js TypeScript API + Socket.IO.
- Database: Supabase PostgreSQL.
- Realtime: Socket.IO conversation rooms.
- Calls: WebRTC media with backend-owned signaling.
- Translation/STT/TTS: backend-owned services.
