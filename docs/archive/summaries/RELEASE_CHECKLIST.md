# Release Checklist

## Required Environment Variables

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL`

Backend:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `FRONTEND_URL` or `ALLOWED_ORIGINS`
- `SHARE_SESSION_TTL_SECONDS` optional, defaults to `7200`

Local development can also set `APP_ENV=development` to allow localhost CORS defaults.

## Migration Order

1. Apply existing Supabase migrations in numeric order.
2. Apply `046_share_access_sessions.sql`.
3. Confirm `share_links.password_hash`, `share_sessions`, and `share_otps` exist.
4. Confirm the backend is using the Supabase service-role key so it can persist and validate sessions server-side.
5. For OTP share links, create hashed `share_otps` rows before guest verification; OTP now fails closed when no valid code exists.

## Build And Health Checks

1. Run `npm run lint`.
2. Run `npm run verify:models`.
3. Run `npm run build`.
4. Start the backend with production env vars.
5. Confirm `GET /health` returns `{"status":"healthy"}`.

## Smoke Test

1. Create an event.
2. Upload photos and confirm processing creates face embeddings.
3. Create a password share link.
4. Open the guest share link and verify with the password.
5. Take a selfie and confirm matched photos load.
6. Download selected matches as a ZIP.
7. Restart the backend and confirm the same unexpired guest session still works.

## Rollback Plan

1. Keep the previous frontend and backend deploys available in Render.
2. If smoke tests fail, roll back the frontend first, then the backend.
3. Leave migration `046_share_access_sessions.sql` in place; it is additive and compatible with previous code.
4. Rotate `JWT_SECRET` only if session compromise is suspected. Rotating it will invalidate active guest sessions.
