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

Gorusme ekraninda self-preview, kucultme, kamera/mikrofon ac-kapat, kamera cevirme ve kalite modu kontrolleri vardir. Bazi mobil aglarda TURN sunucusu gerekir.

## Konum

Guvenlik konumu acik riza olmadan baslamaz. Kabul edilirse Android konum izinleri istenir; kullanici ayarlardan konum paylasimini kapatabilir. Arka plan konumu Android pil ve arka plan kurallarina baglidir.

## APK

`eas.json` icinde `preview` profili APK uretir.
