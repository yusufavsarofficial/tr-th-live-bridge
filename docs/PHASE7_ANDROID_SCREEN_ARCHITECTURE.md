# PHASE 7 Android Screen Architecture

## Current Findings
- Root Android package currently uses `com.pingle` foundation files.
- Root `android/app/build.gradle` is missing.
- Root `android/settings.gradle` is missing.
- Root `MainActivity.kt` is missing.
- No Jetpack Compose dependency is detectable in root Android.
- Existing prototype app remains under `_render_repo/android` per Phase 6.
- Prototype has socket logic, chat UI, message bubbles, and call UI inside one large `MainActivity.kt`.
- Root Android currently has only realtime contract/foundation files before this phase.

## Created Structure
- `data/models/`: UI models for users, conversations, messages, calls.
- `ui/components/`: avatar, conversation row, message bubble, typing indicator state mappers.
- `ui/screens/chatlist/`: chat list screen foundation.
- `ui/screens/chatroom/`: chat room screen foundation.
- `ui/screens/calls/`: call screen foundation.
- `ui/screens/profile/`: profile screen foundation.
- `viewmodel/`: plain Kotlin state holders for chat list, chat room, calls.

## Compose / ViewModel Decision
- Compose is not used because root Android has no Gradle file or Compose dependency.
- AndroidX ViewModel is not used because root Android has no dependency boundary yet.
- Files are plain Kotlin placeholders with TODOs for the real UI toolkit.

## What Was Not Changed
- Did not rewrite or move `_render_repo/android/MainActivity.kt`.
- Did not create or modify Gradle files.
- Did not redesign UI.
- Did not connect backend calls inside UI.
- Did not implement auth, WebRTC, Room, or navigation.
- Did not modify backend.

## Phase 8 Remains
- Create or migrate a real root Android Gradle project.
- Decide Compose vs XML/View toolkit.
- Add real `MainActivity.kt` and app navigation.
- Wire `ChatListViewModel` and `ChatRoomViewModel` to `SocketManager`.
- Replace prototype inline message bubble/chat/call UI gradually.
- Add auth/session before trusting `userId` or `senderId`.
