# 02-BACKEND-DEPLOY

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
eas build -p android --profile preview
```

## Render/Railway deploy

Backend servisi deploy edilir, environment variable degerleri girilir ve `/health` test edilir.

## TURN server neden gerekebilir

WebRTC bazi aglarda TURN olmadan medya baglantisi kuramayabilir.

## Gizli bilgiler neden Android icine konmaz

APK icindeki sabitler okunabilir. Secret degerleri sadece backend ortaminda kalir.

## Son calistirma sirasi

PostgreSQL olustur, backend env gir, deploy et, `/health` kontrol et, Android URL guncelle, APK build al.

## Render root directory

Render Web Service olustururken Root Directory `backend` olmalidir.

- Build Command: `npm install`
- Start Command: `npm run start`
- Health Check Path: `/health`

Repo kokundeki `render.yaml` Blueprint olarak kullanilabilir. Secret degerleri yine Render Environment alaninda girilmelidir.

## Neon veya Supabase DATABASE_URL

Neon veya Supabase PostgreSQL connection string degeri Render Environment alaninda `DATABASE_URL` olarak girilir.

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
```

Gercek connection string Android icine veya dokumana yazilmaz.

## OpenAI API key

OpenAI API key sadece Render Environment icindeki `OPENAI_API_KEY` alanina yazilir. Android icine yazilmaz.