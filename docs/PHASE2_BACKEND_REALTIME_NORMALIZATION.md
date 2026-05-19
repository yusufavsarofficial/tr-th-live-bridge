# PHASE 2 Backend Realtime Normalization

## Current Problems
- Root `server.js` still runs the active CommonJS Socket.IO demo.
- Root `backend/` now has contracts only; new realtime handler is a foundation, not wired yet.
- Current events are single-room and 2-person oriented.
- Current identity is display-name/session-lite, not authenticated user ID.
- Current message state is local/file-backed, not conversation database-backed.
- Current call signaling mixes call lifecycle with WebRTC SDP event names.

## Old Events Found
- `server:hello`: demo bootstrap.
- `join`: legacy room join; replace with `conversation:join`.
- `message`: legacy send/fanout; replace with `message:send` and `message:new`.
- `message:update`: translation/edit-like update; replace with `message:edit` or `translation:result`.
- `typing`: replace with `message:typing`.
- `users`: replace with conversation member/presence events.
- `system`: replace with system `message:new`.
- `offline:events`: replace later with persisted message/call sync.
- `call:offer`: replace SDP payloads with `webrtc:offer`.
- `call:answer`: replace SDP payloads with `webrtc:answer`.
- `call:ice-candidate`: replace with `webrtc:ice-candidate`.
- `call:ringing`, `call:end`: keep names but scope by `conversationId`.

## New Standard Events
- Auth/session: `user:online`, `user:offline`.
- Conversation: `conversation:create`, `conversation:list`, `conversation:join`, `conversation:leave`, `conversation:updated`.
- Messages: `message:send`, `message:new`, `message:delivered`, `message:read`, `message:typing`, `message:delete`, `message:edit`.
- Calls/WebRTC: `call:start`, `call:ringing`, `call:accept`, `call:reject`, `call:end`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`.
- Services: `translation:request`, `translation:result`, `stt:request`, `stt:result`, `tts:request`, `tts:result`.

## Backend Foundation Added
- `backend/src/realtime/socketHandlers.ts` imports `REALTIME_EVENTS`.
- It exports `registerSocketHandlers(io)`.
- It registers placeholders for conversation join/leave, messaging, typing/read receipts, call lifecycle, and WebRTC signaling.
- It uses only in-memory Socket.IO room joins.
- It includes TODOs for auth/session, membership, persistence, and receipts.

## Android Migration Notes
- Android must stop emitting `join-room` and move to `conversation:join`.
- Android must emit `message:send` with `conversationId`.
- Android must listen for `message:new`, not `message:received`.
- Android call UI must separate lifecycle events from `webrtc:*` SDP/ICE signaling.
- Android room-state/call-state names should be removed after the new contract is wired.

## Phase 3 Remains
- Wire the TypeScript backend entry to `registerSocketHandlers`.
- Add authenticated user/session context.
- Add conversation membership checks.
- Add Supabase-backed tables and persistence.
- Add delivery/read receipt storage.
- Add Android client changes after backend contract is stable.
