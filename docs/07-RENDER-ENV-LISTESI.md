# 07 - Render/Railway Env Listesi

Render veya Railway paneline su environment variable degerleri girilir. Gercek secret degerleri dokumana yazilmaz.

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=PostgreSQL baglanti adresi
JWT_SECRET=Guclu uzun rastgele secret
MESSAGE_ENCRYPTION_KEY=32 karakterlik encryption key
PRIVATE_ROOM_CODE=Ozel oda kodu

USER_A_USERNAME=Yusuf
USER_A_DISPLAY_NAME=Yusuf
USER_A_PASSWORD=Yusuf icin bcrypt hash
USER_A_LANG=tr

USER_B_USERNAME=Neeja
USER_B_DISPLAY_NAME=Neeja
USER_B_PASSWORD=Neeja icin bcrypt hash
USER_B_LANG=th

TRANSLATION_PROVIDER=openai
OPENAI_API_KEY=OpenAI API key
PUBLIC_BASE_URL=Canli backend URL
CORS_ORIGIN=*
TURN_URL=Gerekirse TURN server URL
TURN_USERNAME=Gerekirse TURN kullanici adi
TURN_PASSWORD=Gerekirse TURN sifresi
```

Bu degerler Android icine yazilmaz. Sadece backend deploy panelinde environment olarak tutulur.
