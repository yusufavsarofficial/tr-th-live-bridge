# PHASE 6 Android Realtime Alignment

## Android Socket Files Found
- Root `android/` did not exist before this phase.
- Current Android prototype is under `_render_repo/android/`.
- Prototype package: `com.yusuf.trthbridge`.
- Prototype socket code: `_render_repo/android/app/src/main/java/com/yusuf/trthbridge/MainActivity.kt`.
- Prototype Socket.IO dependency: `_render_repo/android/app/build.gradle`.
- Created target root Android contract files under `android/app/src/main/java/com/pingle/realtime/`.

## Old Event Names Found
- `join-room`
- `message:send`
- `room-state`
- `message:received`
- `call:incoming`
- `call:state`
- `call:ended`
- `call:start`
- `call:end`

## Mismatches
- Prototype emits `join-room`; backend Phase 5 expects `conversation:join`.
- Prototype listens for `room-state`; backend emits `conversation:updated`.
- Prototype listens for `message:received`; backend emits `message:new`.
- Prototype sends `message:send`, but payload is not yet the Phase 5 shape.
- Prototype call events are UI/demo-level and not aligned to `webrtc:*`.
- Root target Android project still needs a real Gradle/app boundary.

## New Event Names Used
- `conversation:join`
- `conversation:leave`
- `message:send`
- `message:new`
- `message:typing`
- `message:read`
- `call:start`
- `call:accept`
- `call:reject`
- `call:end`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`

## Files Added
- `RealtimeEvents.kt`: Kotlin constants matching backend `REALTIME_EVENTS`.
- `RealtimePayloads.kt`: simple payload data classes.
- `SocketManager.kt`: minimal Socket.IO wrapper for message flow only.

## Temporary Limitations
- No Android auth yet.
- `userId` and `senderId` are temporary payload values.
- No Room/local database.
- No WebRTC media implementation.
- No UI wiring yet.
- No root Android Gradle project was created in this phase.

## `message:send` Payload
- `conversationId`: required string.
- `senderId`: temporary required string until auth exists.
- `type`: defaults to `text`.
- `body`: optional text.
- `mediaUrl`: optional media URL.
- `replyToMessageId`: optional message ID.
- `tempId`: optional optimistic client message ID.

## Phase 7 Remains
- Decide whether to migrate `_render_repo/android` into root `android/`.
- Wire `SocketManager` into the real Android app after root Android structure is settled.
- Replace `join-room` with `conversation:join`.
- Replace `message:received` listener with `message:new`.
- Add temporary local test user/conversation only for dev builds.
- Add proper auth/session before production.
- Align call lifecycle separately before WebRTC work.
