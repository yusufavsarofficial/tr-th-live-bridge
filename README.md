# Sevgilim Chat

Sevgilim Chat, sadece Yusuf ve Neeja icin hazirlanan ozel Android mesajlasma, otomatik Turkce-Tayca ceviri, sesli mesaj, goruntulu gorusme, guvenlik konumu ve kalici oturum uygulamasidir.

- Android paket adi: `com.sevgilimchat.android`
- Uygulama adi: `Sevgilim Chat`
- Production backend URL: `https://sevgilim-chat.onrender.com`
- Oda kodu: backend environment icinde `PRIVATE_ROOM_CODE` olarak tutulur

Bu projede acik kayit, admin paneli, reklam, demo kullanici veya ucuncu kullanici sistemi yoktur.

## Kurulum

```bash
cd backend
npm install
npm run check
npm run dev
```

```bash
cd android
npm install
npm run check
npx expo prebuild --platform android
```

Windows'ta `node` PATH sorunu olursa `C:\Program Files\nodejs` PATH'in basina alinmalidir.

## Backend

Canli ortamda:

```bash
cd backend
npm run start
```

Health kontrolu:

```bash
curl https://sevgilim-chat.onrender.com/health
```

Gerekli environment variable isimleri:

```text
NODE_ENV
PORT
DATABASE_URL
JWT_SECRET
MESSAGE_ENCRYPTION_KEY
PRIVATE_ROOM_CODE
USER_A_USERNAME
USER_A_DISPLAY_NAME
USER_A_PASSWORD
USER_A_LANG
USER_B_USERNAME
USER_B_DISPLAY_NAME
USER_B_PASSWORD
USER_B_LANG
TRANSLATION_PROVIDER
OPENAI_API_KEY
PUBLIC_BASE_URL
CORS_ORIGIN
TURN_URL
TURN_USERNAME
TURN_PASSWORD
```

Degerler repoya, Android icine veya APK'ye yazilmaz. Sadece backend environment tarafinda tutulur.

## Android APK Build

Expo Go, WebRTC icin yeterli degildir. APK icin EAS/custom build gerekir.

```bash
cd android
npm install
npm run check
npx expo prebuild --platform android
eas build -p android --profile preview
```

Production AAB icin:

```bash
cd android
eas build -p android --profile production
```

APK/AAB, `.env`, log dosyalari, `node_modules`, build ciktisi ve lokal giris bilgileri GitHub'a eklenmez.

## Mesajlasma ve Ceviri

Mesaj gonderilince Android once optimistic UI ile mesaji ekranda gosterir. Backend mesaji hemen kaydeder ve socket ile yayinlar. Ceviri OpenAI ile sadece backend tarafinda calisir; ceviri tamamlaninca ayni mesaj `message:updated` eventi ile guncellenir.

- Yusuf dili: `tr`
- Neeja dili: `th`
- Yusuf mesajinda `originalText` Turkce, `translatedText` Tayca olur.
- Neeja mesajinda `originalText` Tayca, `translatedText` Turkce olur.
- Gonderen kendi orijinal metnini ana satirda gorur.
- Alici kendi anlayacagi ceviriyi ana satirda gorur.
- Ceviri basarisiz olursa mesaj kaybolmaz; `translatedText` sade bir hata metni ile guncellenir.

Mesaj metni backend tarafindan ceviri icin islenir. Bu nedenle ceviri acikken teknik anlamda gercek uctan uca sifreleme saglanamaz. Mesajlar HTTPS uzerinden tasinir ve veritabaninda `MESSAGE_ENCRYPTION_KEY` ile sifreli saklanir.

## Socket ve Durumlar

Socket.IO WebSocket'i oncelikli kullanir, polling sadece geri dusus olarak kalir. Mesaj durumlari:

- `sending`
- `sent`
- `delivered`
- `read`
- `failed`

Baglanti koparsa uygulama yeniden baglanmayi dener ve kullaniciya sade durum mesaji gosterir. Render Free plan uyku gecikmesi varsa ilk istek birkac saniye surebilir.

Android her mesaj icin `clientId` uretir. Backend bu `clientId` degerini saklar; ayni mesaj reconnect veya ack gecikmesi nedeniyle tekrar gelirse ikinci kayit olusturulmaz. Uygulama one geldiginde ve socket tekrar baglandiginda son mesaj gecmisi yeniden cekilir.

## Kalici Oturum

Basarili giriste token ve kullanici bilgisi `expo-secure-store` icinde saklanir. Uygulama acilirken `/api/auth/verify` ile token kontrol edilir; token gecersizse guvenli cikis yapilir ve kullanici yeniden girise yonlendirilir. Oda kodu yalnizca giris sirasinda sorulur.

## Goruntulu Gorusme

WebRTC eventleri backend ve Android tarafinda ayni tutulur:

```text
call:start
call:incoming
call:accept
call:reject
call:end
webrtc:offer
webrtc:answer
webrtc:ice-candidate
```

Gorusmede kucuk self-preview, kamera ac/kapat, mikrofon ac/kapat, kamera cevirme, gorusmeyi kucultme, gorusmeyi bitirme ve kalite modu kontrolleri vardir.

Kalite modlari:

- Dusuk veri: 480x360, 15 fps, dusuk bitrate
- Dengeli: 640x480, 20 fps, orta bitrate
- Daha iyi goruntu: 720 genislik, 24 fps, kontrollu yuksek bitrate

Bazi Turkiye-Tayland mobil aglarinda STUN yeterli olmayabilir. Bu durumda backend environment tarafina TURN bilgileri eklenmelidir: `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`.

`Yumusak goruntu` modu ilk surumde hafif self-preview yumusatma hissi verir. Gercek native beauty filter icin ek native kamera/filter modulu gerekir.

## Sesli Mesaj

Sesli mesaj upload endpoint'i JWT ile korunur. Backend ses dosyasi boyutunu 5 MB ile sinirlar ve sadece ses MIME/uzantilarini kabul eder. Buyuk dosyada kullaniciya sade hata gosterilir.

Sesli mesaj yuklenince backend kullanicinin diline gore transkripsiyon ve Turkce-Tayca ceviri dener. OpenAI veya transkripsiyon hatasi olursa ses dosyasi yine gonderilir; metin/ceviri alani sade hata durumuyla gosterilir.

## Guvenlik Konumu ve Acik Riza

Konum ozelligi acik riza olmadan calismaz. Ilk giristen sonra kullaniciya Guvenlik Konumu Onayi gosterilir.

- Kabul edilirse Android konum izni istenir.
- Uygulama acikken yaklasik 60 saniyelik dengeli konum guncellemesi yapilir.
- Arka planda Android izin verirse yaklasik 5-10 dakikalik araliklarla calisir.
- Kullanici ayarlardan konum paylasimini kapatabilir.
- Konum koordinatlari loglarda acik yazilmaz.
- Veritabani uzun sureli takip icin tutulmaz; konum kayitlari 24 saatlik TTL ile sinirlanir.

Android arka plan kurallari, pil optimizasyonu veya uygulamanin zorla kapatilmasi konumu ve socket baglantisini durdurabilir.

## Bildirimler

Mevcut ilk surum Expo push token altyapisina hazirdir. Hassas mesaj ve konum bilgileri bildirim metninde acik yazilmaz. Firebase Cloud Messaging daha ileri ve daha guclu bildirim senaryolari icin sonraki gelistirme olarak ayrilmistir.

## Gizlilik ve Guvenlik

- Android icinde OpenAI API key, database bilgisi, JWT secret, mesaj sifreleme anahtari veya kullanici sifresi tutulmaz.
- Backend loglarinda secret, mesaj icerigi ve konum koordinati yazilmamalidir.
- `backend/.env`, `LOCAL-GIRIS-BILGILERI.txt`, `node_modules`, loglar, APK/AAB ve build ciktisi GitHub'a gitmez.
- Kullanici sistemi sadece Yusuf ve Neeja ile sinirlidir.
- Upload, mesaj, konum ve socket islemleri JWT korumasi ile calisir.

## Bilinen Sinirlamalar

- Render Free plan uyursa ilk baglanti gecikebilir.
- Mobil ag/NAT kosullarina gore TURN sunucusu gerekebilir.
- Uygulama zorla kapatilirsa Android arka plan konumu ve socket baglantisi durdurabilir.
- Gercek native beauty filter ayrica native modul gerektirir.

## Sonraki Gelistirmeler

- Firebase push notification
- TURN sunucusu
- Native beauty filter
- Daha gelismis medya sikistirma
