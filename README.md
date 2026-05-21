# Pingle

Private 2-person real-time chat with automatic Turkish-Thai translation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express 5, Socket.IO 4 |
| Frontend | Vanilla JS PWA (WhatsApp-style UI) |
| Desktop | Electron |
| Mobile | Kotlin + Jetpack Compose |
| Translation | OpenAI GPT-4.1-mini → Google Translate → MyMemory |

---

## How to Run

### Backend + Web UI

```bash
npm install
npm start
```

Open http://localhost:3000

### Development (auto-restart)

```bash
npm run dev
```

### Desktop (Electron)

```bash
npm run desktop
```

---

## Android Build

### Prerequisites

- Android Studio (or Android SDK + JDK 17)
- Set `ANDROID_HOME` environment variable to your SDK path

### Debug APK

```bash
npm run pack:apk
# or manually:
cd android
./gradlew.bat assembleDebug
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK

```bash
npm run pack:apk:release
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

> Release APK requires a signed keystore. See [Android signing docs](https://developer.android.com/studio/publish/app-signing).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `HOST` | 0.0.0.0 | Bind address |
| `MAX_USERS` | 2 | Max room capacity |
| `MAX_MESSAGE_LENGTH` | 500 | Max chars per message |
| `MAX_ATTACHMENT_BYTES` | 900000 | Max file size (bytes) |
| `MAX_HISTORY` | 120 | Max stored messages |
| `DATA_FILE` | ./data/chat-history.json | Message persistence file |
| `NOTIFICATION_FILE` | ./data/notification-state.json | Push subscription file |
| `OPENAI_API_KEY` | — | OpenAI API key for translations |
| `OPENAI_TRANSLATE_MODEL` | gpt-4.1-mini | OpenAI model |
| `TRANSLATION_PROVIDER` | openai-first | `openai-first` or `legacy` |
| `ROOM_CODE` | — | Optional room access code |
| `ROOM_PIN` | — | Optional room PIN |

Copy `.env.example` to `.env` and fill in your values.

---

## Android Backend URL Configuration

The Android app uses `BuildConfig.BACKEND_URL`:

- **Debug:** `http://10.0.2.2:3000` (Android emulator → host machine)
- **Release:** `https://tr-th-live-bridge.onrender.com`

Configured in `android/app/build.gradle` → `buildTypes`.

---

## Tests

```bash
npm run smoke       # End-to-end smoke test
npm run test:rtc    # RTC signaling test
```

---

## Project Structure

```
Pingle/
├── server.js              # Backend (Express + Socket.IO)
├── public/                # Web frontend (PWA)
├── android/               # Native Android app (Kotlin)
├── desktop/               # Electron desktop wrapper
├── scripts/               # Test & build scripts
├── data/                  # Runtime persistence files
├── .env                   # Environment variables (local only)
└── .env.example           # Environment variable template
```

---

## License

ISC — AYFSOFT & Yusuf Avsar
