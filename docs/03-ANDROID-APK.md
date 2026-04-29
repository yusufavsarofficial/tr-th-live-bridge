# 03-ANDROID-APK

## Gerekli hesaplar

Render/Railway, PostgreSQL, OpenAI ve Expo/EAS hesaplari gerekir.

## Backend kurulumu

Backend klasorunde:

```bash
npm install
npm run check
npm run dev
```

Canli ortamda `npm run start` kullanilir.

## PostgreSQL baglantisi

`DATABASE_URL` sadece backend environment variable olarak girilir.

## OpenAI API key nereye yazilir

`OPENAI_API_KEY` sadece backend environment olarak girilir. Android icine yazilmaz.

## Android backend URL nasil degistirilir

`android/src/config/backend.ts` dosyasindaki `BACKEND_URL` canli backend URL ile degistirilir.

## APK nasil alinir

Android klasorunde:

```bash
npm install
npm run check
npx expo prebuild --platform android
eas build -p android --profile preview
```

Production AAB icin:

```bash
eas build -p android --profile production
```

APK build oncesi `android/src/config/backend.ts` icinde production URL `https://sevgilim-chat.onrender.com` kalmalidir. APK icinde yerel gelistirme adresi, lokal IP, secret, `.env`, APK/AAB veya build ciktisi repoya eklenmemelidir.

Gerekli Android izinleri sade tutulur: internet, kamera, mikrofon, konum ve konum arka plan servisi.

## Render/Railway deploy

Backend servisi deploy edilir, environment variable degerleri girilir ve `/health` test edilir.

## TURN server neden gerekebilir

WebRTC bazi aglarda TURN olmadan medya baglantisi kuramayabilir.

## Gizli bilgiler neden Android icine konmaz

APK icindeki sabitler okunabilir. Secret degerleri sadece backend ortaminda kalir.

## Son calistirma sirasi

PostgreSQL olustur, backend env gir, deploy et, `/health` kontrol et, Android URL guncelle, APK build al.
