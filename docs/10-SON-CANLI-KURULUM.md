# 10 - Son Canli Kurulum

Bu adimlar canli backend deploy ve APK build icin son siradir. Gercek secret, API key ve database bilgileri sadece Render/Railway environment alanina yazilir.

## 1. GitHub repo olustur

GitHub uzerinde yeni ve private repo olustur. `.env`, `node_modules`, build ciktisi ve generated native klasorler repoya eklenmez.

## 2. Projeyi GitHub'a gonder

Proje kokunden git init, commit ve remote islemlerini yap. Commit oncesi `.gitignore` dosyasinin aktif oldugunu kontrol et.

## 3. PostgreSQL olustur

Neon veya Supabase uzerinde PostgreSQL database olustur. Verilen connection string Render/Railway tarafinda `DATABASE_URL` olarak girilir.

Neon/Supabase baglanti adresi su mantiktadir:

```text
DATABASE_URL=<postgres-connection-url>
```

Gercek degeri dokumana veya Android icine yazma.

## 4. Render'da backend deploy et

Render'da yeni Web Service olustur. GitHub reposunu bagla.

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm run start`
- Health Check Path: `/health`

Alternatif olarak repo kokundeki `render.yaml` Blueprint olarak kullanilabilir; yine de secret degerleri Render Environment bolumunde girilmelidir.

## 5. Render Environment degerlerini gir

`docs/07-RENDER-ENV-LISTESI.md` dosyasindaki degerleri Render Environment bolumune gir.

OpenAI API key sadece Render Environment icindeki `OPENAI_API_KEY` alanina yazilir. Android icine yazilmaz.

## 6. /health test et

Deploy bittikten sonra:

```text
https://senin-backend-url.onrender.com/health
```

`ok: true` cevabi gelmelidir.

## 7. Android BACKEND_URL degistir

Proje kokunden:

```bash
node scripts/set-backend-url.js https://senin-backend-url.onrender.com
```

Bu komut `android/src/config/backend.ts` dosyasindaki `BACKEND_URL` degerini gunceller.

## 8. EAS login yap

Android klasorunde veya proje kokunden EAS hesabina gir:

```bash
eas login
```

## 9. APK build al

```bash
cd android
eas build -p android --profile preview
```

## 10. APK indir

EAS build tamamlaninca Expo panelindeki APK linkinden dosyayi indir.

## 11. Telefonda test et

- Yusuf girisi
- Neeja girisi
- Oda kodu
- Mesajlasma
- Turkce/Tayca ceviri
- Sesli mesaj
- Okundu/yaziyor/online durumu
- Goruntulu gorusme

Goruntulu gorusme baglanmazsa TURN server bilgilerini backend environment alanlarina ekle.

## Docker ile Render deploy

Render'da Language alaninda Node gorunmuyorsa Docker sec.

```text
Language: Docker
Root Directory: backend
Dockerfile Path: ./Dockerfile
Instance Type: Free
```

Sonra Environment alanlarina `docs/07-RENDER-ENV-LISTESI.md` dosyasindaki degerleri gir. Gercek gizli bilgileri sadece Render paneline yaz.
