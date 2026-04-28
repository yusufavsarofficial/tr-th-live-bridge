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
- `POST /api/uploads/audio`

## Guvenlik

Helmet, CORS, rate limit, JWT auth ve audio upload sinirlari kullanilir. Sifreler env tarafinda bcrypt hash olarak tutulmalidir.

## Socket eventleri

Eventler `src/sockets/events.js` icindedir. Android `android/src/config/socketEvents.ts` ile birebir eslesmelidir.