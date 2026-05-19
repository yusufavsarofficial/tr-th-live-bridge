# PHASE 1 Migration Plan

## Remove Later
- Root `server.js` 2-user default and `Room is full. Only 2 users can join.` behavior.
- Single `pingle-room` broadcast model.
- Display-name-only identity and duplicate-name auth substitute.
- File-backed global chat history as the primary message store.
- “Other online user” call targeting.
- Push subscription lookup by display name.
- WebView APK builder path after native Android is the only supported APK path.

## Rename Later
- `join` -> `conversation:join` plus real session identity.
- `message` -> `message:send`.
- inbound `message` fanout -> `message:new`.
- `typing` -> `message:typing`.
- `users` -> conversation/member presence events.
- `message:update` -> `message:edit` or `translation:result`.
- `call:offer` -> `webrtc:offer`.
- `call:answer` -> `webrtc:answer`.
- `call:ice-candidate` -> `webrtc:ice-candidate`.
- Android `room-state`, `message:received`, `call:incoming`, `call:state`, `call:ended` should be aligned to the new contract.

## Android Refactor Later
- Replace demo/WebView flow with root `android/` native Kotlin app.
- Add session/auth bootstrap screen.
- Add conversation list screen.
- Add direct/group conversation screen.
- Add members/group settings screen.
- Add native media picker/upload states.
- Add call screen backed by real native WebRTC.
- Add translation/STT/TTS request states without local fake completion.

## Database Tables Later
- `users`
- `conversations`
- `conversation_members`
- `messages`
- `message_receipts`
- `calls`
- `media_objects`
- `push_subscriptions`
- `translation_jobs`
- `stt_jobs`
- `tts_jobs`

## Phase 2
- Move/standardize backend into root `backend/`.
- Add TypeScript server skeleton that imports the contract constants/interfaces.
- Define REST endpoints for users, conversations, messages, media, and service jobs.
- Add Supabase schema migration draft only after contract review.
- Keep old app running until Android/backend contract is ready for migration.
