# Sevgilim Chat

Sevgilim Chat, sadece Yusuf ve Neeja icin hazirlanan ozel Android mesajlasma, sesli mesaj ve goruntulu gorusme uygulamasidir. Web sitesi yoktur, InfinityFree kullanilmaz.

## Gerekli hesaplar

- Render veya Railway
- PostgreSQL
- OpenAI API key
- Expo/EAS hesabi
- Android telefon veya emulator

## Backend kurulumu

```bash
cd backend
npm install
npm run check
npm run dev
```

Canli ortamda start komutu:

```bash
npm run start
```

## PostgreSQL baglantisi

`DATABASE_URL` sadece backend environment variable olarak girilir. Android icine database bilgisi yazilmaz.

## OpenAI API key nereye yazilir

`OPENAI_API_KEY` sadece backend deploy panelinde veya lokal backend `.env` dosyasinda tutulur. Bu repoda `.env` yoktur; sadece `backend/.env.example` vardir.

## Android backend URL nasil degistirilir

Tek dosya:

```text
android/src/config/backend.ts
```

`BACKEND_URL` canli backend adresiyle degistirilir. Android icinde API key, JWT secret veya database bilgisi yoktur.

## APK nasil alinir

```bash
cd android
npm install
npm run check
npx expo prebuild --platform android
eas build -p android --profile preview
```

Not: Komutta `eas build -p android --profile preview` kullanilir. WebRTC nedeniyle Expo Go yeterli degildir; EAS/custom build gerekir.

## Render/Railway deploy

Backend klasoru Node.js servisi olarak deploy edilir. Environment variable listesi `docs/07-RENDER-ENV-LISTESI.md` icindedir. Deploy sonrasi `GET /health` kontrol edilir.

## TURN server neden gerekebilir

WebRTC bazi mobil aglarda dogrudan baglanamayabilir. Goruntulu gorusme baglanmazsa TURN server bilgileri backend env olarak eklenir.

## Gizli bilgiler neden Android icine konmaz

APK incelenebilir. Bu yuzden `OPENAI_API_KEY`, `DATABASE_URL`, `JWT_SECRET`, `MESSAGE_ENCRYPTION_KEY` ve kullanici sifreleri sadece backend ortaminda tutulur.

## Son calistirma sirasi

1. PostgreSQL olustur.
2. Backend environment variable degerlerini gir.
3. Backend deploy et.
4. `/health` test et.
5. Android `BACKEND_URL` degerini canli URL yap.
6. `npm run check` calistir.
7. `eas build -p android --profile preview` ile APK al.
8. Yusuf ve Neeja ile test et.

## Yardimci scriptler

Backend URL guncellemek icin:

```bash
node scripts/set-backend-url.js https://senin-backend-url.onrender.com
```

Secret onerileri uretmek icin:

```bash
node scripts/generate-secrets.js
```

Bu scriptler `.env` dosyasi olusturmaz ve Android icine gizli bilgi yazmaz.

## Render Docker Deploy

Render New Web Service ekraninda Language olarak sadece Docker gorunuyorsa su ayarlari kullan:

```text
Language: Docker
Root Directory: backend
Dockerfile Path: ./Dockerfile
Instance Type: Free
```

Environment Variables yine Render panelinden girilir. Gercek API key, DATABASE_URL, JWT_SECRET, MESSAGE_ENCRYPTION_KEY ve sifreler Docker image icine yazilmaz.
