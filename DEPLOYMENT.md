# Nova — Deployment Guide

## Free Hosting Options

### 1. Backend (Render — Free Tier)

1. Push your repo to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) → New + → Web Service.
3. Connect your GitHub repo.
4. Fill:
   - **Name**: `nova-api`
   - **Runtime**: `Docker`
   - **Branch**: `main`
   - **Plan**: Free
5. Add these env vars in the dashboard:
   ```
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=<generate-a-random-64-char-string>
   DB_PROVIDER=postgresql
   DATABASE_URL=<Render PostgreSQL internal URL>
   FCM_SERVICE_ACCOUNT_PATH=firebase-key.json
   CORS_ORIGIN=https://your-frontend-domain.com
   ```
6. Add a PostgreSQL database:
   - Render Dashboard → New + → PostgreSQL
   - Name: `nova-db`
   - Plan: Free
   - Copy the "Internal Database URL" into `DATABASE_URL` env var.
7. Deploy. After first deploy fails, the PostgreSQL DB will be ready — Redeploy.

### 2. Web Client (Render Static or Vercel — Free)

**Option A: Render serves web (same service)**
The backend auto-serves `public/` at the root URL. No extra step.

**Option B: Firebase Hosting (CDN, recommended)**
1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting` → select `public/` as public directory → Single-page app: No
4. `firebase deploy --only hosting`
5. Free at `https://your-project.web.app`

### 3. FCM Push Notifications (Firebase — Free)

1. Go to [Firebase Console](https://console.firebase.google.com) → Project `pingle-1f33d`
2. Project Settings → Service accounts → Generate new private key
3. Download the JSON file → save as `firebase-key.json` in project root
4. Set env var: `FCM_SERVICE_ACCOUNT_PATH=firebase-key.json`
5. The `google-services.json` is already in the Android project.

---

## Android APK — Manual Build

```bash
cd android
set ANDROID_HOME=C:\Users\Yusuf\AppData\Local\Android\Sdk
set BACKEND_URL=https://tr-th-live-bridge.onrender.com
./gradlew assembleDebug
```

APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Env Reference (.env)

```
PORT=3000
HOST=0.0.0.0
DB_PROVIDER=sqlite
DATABASE_URL=file:./dev.db
JWT_SECRET=dev-jwt-secret-pingle-2026
CORS_ORIGIN=*
FCM_SERVICE_ACCOUNT_PATH=
```

For production, set:
```
DB_PROVIDER=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/nova
JWT_SECRET=<random-64-char>
CORS_ORIGIN=https://your-frontend.com
FCM_SERVICE_ACCOUNT_PATH=firebase-key.json
```

---

## Web Version (PWA)

The web version is served at the backend root URL. Features:
- OTP login (same as mobile)
- Real-time messaging via Socket.IO
- Voice/video calls (WebRTC)
- Turkish/Thai translations
- Dark theme (WhatsApp-style UI)

The PWA is installable on Chrome/Edge. After deployment, users can add it to their home screen.
