# PHASE 5 Backend Message Flow

## Backend Entry Finding
- Active runtime entry is still root `server.js`.
- No `backend/package.json`, `backend/src/index.ts`, or `backend/src/server.ts` exists.
- `backend/src/realtime/socketHandlers.ts` is updated but not wired into runtime yet.
- Did not create a second server.

## Implemented Event Flow
- `conversation:join`
- Payload: `{ conversationId, userId }`.
- Joins Socket.IO room `conversation:<conversationId>`.
- Acks `{ ok: true, conversationId }`.
- Emits `conversation:updated` to other room sockets.
- `conversation:leave`
- Payload: `{ conversationId }`.
- Leaves Socket.IO room `conversation:<conversationId>`.
- `message:send`
- Payload: `{ conversationId, senderId, type, body, mediaUrl, replyToMessageId, tempId }`.
- Validates `conversationId`, `senderId`, and message `type`.
- Calls `messagesRepository.createMessage`.
- Emits `message:new` to `conversation:<conversationId>`.
- Echoes `tempId` for optimistic Android matching.
- Emits temporary `message:error` and ack error on failure.
- `message:typing`
- Payload: `{ conversationId, userId, isTyping }`.
- Broadcasts to room except sender.
- `message:read`
- Payload: `{ conversationId, messageId, userId }`.
- Calls `messagesRepository.markMessageStatus(..., "read")`.
- Broadcasts `message:read` to the room.

## Temporary Auth Limitation
- `userId` and `senderId` are still trusted from payload.
- TODO comments mark where authenticated socket session validation must replace payload trust.
- Conversation membership is not enforced yet.

## Repository Functions Added
- `getMessagesForConversation`: reads `messages` by `conversation_id`.
- `createMessage`: inserts into `messages`.
- `markMessageStatus`: upserts into `message_status`.
- `getConversationsForUser`: reads joined conversations through `conversation_members`.
- Functions now return data or throw clear errors.

## Android Payload Contract
- `message:send` should send:
- `conversationId`: required string.
- `senderId`: temporary required string until auth exists.
- `type`: `text`, `image`, `audio`, `video`, `file`, or `system`.
- `body`: optional text.
- `mediaUrl`: optional URL.
- `replyToMessageId`: optional message ID.
- `tempId`: optional optimistic client ID.
- Android should listen for `message:new` and match `tempId`.
- Android should handle temporary `message:error` until standard failure status is designed.

## Phase 6 Remains
- Create or choose a real TypeScript backend entry/package boundary.
- Wire `registerSocketHandlers(io)` into the TypeScript runtime.
- Add auth/session middleware and stop trusting payload `userId`.
- Enforce conversation membership before join/read/send.
- Add delivery status flow for `sent` and `delivered`.
- Add tests with mocked Supabase or a local test database.
- Keep old `server.js` until the TypeScript backend can replace it safely.
