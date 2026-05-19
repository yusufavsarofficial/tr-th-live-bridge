# PHASE 4 Supabase Connection

## Package Finding
- `backend/package.json` does not exist in the root backend folder.
- Root `package.json` is still the active backend package for `server.js`.
- Root `backend/` contains TypeScript foundation files but no package boundary yet.
- Added `@supabase/supabase-js` to root `package.json`.
- Did not run install and did not update lock files.

## Required Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `NODE_ENV`
- Created `backend/.env.example` with placeholders only.
- Did not create `backend/.env`.

## Secret Safety
- `SUPABASE_SERVICE_ROLE_KEY` must stay only on backend/server environments.
- It bypasses normal client permissions and must never ship to Android, web, Electron, or logs.
- Android should later call backend APIs, not Supabase admin APIs directly.

## Created Backend Files
- `backend/src/lib/supabase.ts`: admin client from env only.
- `backend/src/repositories/usersRepository.ts`: user reads and presence update foundation.
- `backend/src/repositories/conversationsRepository.ts`: conversation read foundation plus TODO create flows.
- `backend/src/repositories/messagesRepository.ts`: message read/create/status foundation.
- `backend/src/repositories/callsRepository.ts`: call create/update/participant foundation.

## Phase 5 Remains
- Decide whether to create a dedicated `backend/package.json`.
- Add TypeScript backend entry point and build scripts.
- Add auth/session middleware before repository usage.
- Wire `message:send` to `messagesRepository.createMessage`.
- Wire `message:read`/delivery to `markMessageStatus`.
- Add tests with mocked Supabase or a local test database.
