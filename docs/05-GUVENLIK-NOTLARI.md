# 05-GUVENLIK-NOTLARI

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

## Konum ve acik riza

Guvenlik konumu acik riza olmadan baslamaz. Kullanici kabul ederse Android izinleri istenir ve konum sadece Yusuf ile Neeja arasinda paylasilir. Kullanici reddederse konum alinmaz ve backend'e gonderilmez.

Konum koordinatlari loglarda acik yazilmaz. Backend `location_shares` kayitlarini uzun sureli takip icin kullanmaz; kayitlar 24 saatlik TTL ile sinirlanir. Kullanici ayarlardan konum paylasimini kapatabilir.

Android arka plan kurallari, pil optimizasyonu veya uygulamanin zorla kapatilmasi konum ve socket baglantisini durdurabilir.

## Ceviri ve sifreleme gercegi

Mesajlar HTTPS uzerinden tasinir ve veritabaninda backend `MESSAGE_ENCRYPTION_KEY` ile sifreli saklanir. Ancak otomatik ceviri backend uzerinden OpenAI ile yapildigi icin mesaj metni ceviri amaciyla backend tarafinda islenir. Bu model gercek uctan uca sifreleme ile ayni degildir.

## Son calistirma sirasi

PostgreSQL olustur, backend env gir, deploy et, `/health` kontrol et, Android URL guncelle, APK build al.
