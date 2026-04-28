# Android

## Komutlar

```bash
npm install
npm run check
npx expo prebuild --platform android
npx expo run:android
eas build -p android --profile preview
```

## Backend URL

Canli backend adresi sadece su dosyada degistirilir:

```text
src/config/backend.ts
```

## Gizli bilgiler

Android icinde OpenAI API key, DATABASE_URL, JWT secret, encryption key veya kullanici sifresi bulunmaz.

## WebRTC

`react-native-webrtc` Expo Go ile calismaz. APK icin EAS build veya custom development build gerekir.

## APK

`eas.json` icinde `preview` profili APK uretir.