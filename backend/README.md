# Backend

## Komutlar

```bash
npm install
npm run check
npm run dev
npm run start
```

## Deploy

Render/Railway servisinde root olarak `backend` klasoru secilir. Start komutu:

```bash
npm run start
```

## Environment

Gercek degerler deploy panelinde environment variable olarak girilir. `.env` repoya eklenmez.

Zorunlu alanlar: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `MESSAGE_ENCRYPTION_KEY`, `PRIVATE_ROOM_CODE`, `USER_A_*`, `USER_B_*`, `OPENAI_API_KEY`.

## Endpointler

- `GET /health`
- `POST /api/auth/login`
- `GET /api/messages`
- `GET /api/location/latest`
- `POST /api/location`
- `POST /api/uploads/audio`

## Guvenlik

Helmet, CORS, rate limit, JWT auth ve audio upload sinirlari kullanilir. Sifreler env tarafinda bcrypt hash olarak tutulmalidir.

Mesajlar backend tarafinda sifreli saklanir. Ceviri OpenAI ile backend uzerinden yapildigi icin mesaj metni ceviri amaciyla backend tarafinda islenir; bu model gercek uctan uca sifreleme degildir.

Konum paylasimi yalnizca acik riza sonrasi calisir. Konum koordinatlari loglanmaz ve `location_shares` kayitlari 24 saatlik TTL ile sinirlanir.

## Socket eventleri

Eventler `src/sockets/events.js` icindedir. Android `android/src/config/socketEvents.ts` ile birebir eslesmelidir.

## Docker Deploy

Render Docker ayarlari:

```text
Language: Docker
Root Directory: backend
Dockerfile Path: ./Dockerfile
Instance Type: Free
```

`backend/Dockerfile` Node.js LTS image kullanir, `/app` dizininde calisir, `npm ci --omit=dev` ile production bagimliliklarini kurar ve `npm run start` ile server baslatir.

`.env` dosyasi image icine kopyalanmaz. Tum secret degerler Render Environment panelinden girilir.
