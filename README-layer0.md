# DeployPilot — Layer 0: Ephemeral Preview Access Layer

Layer 0 does not call Vercel, Render, or GitHub. Preview creation and teardown are Layer 2.

Layer 0 is the self-contained access and gating layer of DeployPilot. It securely tracks, gates, and expires preview links pointing to existing `frontendUrl` and `backendUrl` deployments without communicating with external cloud providers.

---

## 1. Required Environment Variables

Configure these variables in `.env` (see `.env.example`):

```bash
DATABASE_URL="file:./dev.db"
PREVIEW_JWT_SECRET=change-me
CRON_SECRET=change-me
```

- `DATABASE_URL`: SQLite connection URI.
- `PREVIEW_JWT_SECRET`: Secret key used for signing and verifying preview JWT tokens and access cookies. Must be at least 32 characters in production.
- `CRON_SECRET`: Shared secret required in the `x-cron-secret` header for invoking `/api/preview/expire`.

---

## 2. Database Migration

Run the following command to initialize the local SQLite database and generate the Prisma client:

```bash
pnpm prisma migrate dev --name init
```

This applies the schema from `prisma/schema.prisma` and creates `dev.db` (or `prisma/dev.db`).

---

## 3. How to Hit `/api/preview/create` with curl

Create a new preview link with 2 hours TTL:

```bash
curl -X POST http://localhost:3000/api/preview/create \
  -H "Content-Type: application/json" \
  -d '{
    "frontendUrl": "https://example.com",
    "backendUrl": "https://example.com",
    "expiresInHours": 2,
    "createdBy": "demo"
  }'
```

To create a password-protected preview link:

```bash
curl -X POST http://localhost:3000/api/preview/create \
  -H "Content-Type: application/json" \
  -d '{
    "frontendUrl": "https://example.com",
    "backendUrl": "https://example.com",
    "expiresInHours": 2,
    "password": "super-secret-password",
    "createdBy": "demo"
  }'
```

Response format:

```json
{
  "id": "cuid...",
  "token": "eyJhbGciOi...",
  "expiresAt": "2026-10-30T13:30:00.000Z",
  "passwordSet": false,
  "frontendUrl": "https://example.com",
  "backendUrl": "https://example.com"
}
```

---

## 4. How to Trigger `/api/preview/expire`

Trigger the cron job to find expired active previews and mark them as expired:

```bash
curl -X POST http://localhost:3000/api/preview/expire \
  -H "x-cron-secret: change-me"
```

Response format:

```json
{
  "expired": 1
}
```

---

## 5. Security Model (6 Bullets)

- **DB state is authoritative**: Even if a JWT has not reached its cryptographic expiry timestamp, any link marked `expired` or `destroyed` in the database returns HTTP 410 Gone immediately.
- **JWT only identifies**: The JWT acts purely as an unforgeable reference bearer containing the link ID and claims; it confers zero authority without database verification.
- **Raw token never logged**: Raw tokens, plaintext passwords, hashes, and secrets are excluded from logs, error reports, and client-facing API responses.
- **Cookie scoped to gate path**: The `preview_access` cookie is issued with `HttpOnly; Secure; SameSite=Lax` and strictly scoped via `Path=/api/preview/[token]` to prevent credential bleeding.
- **Password checked before cookie**: Password-protected links mandate a constant-time bcrypt verification step before granting the signed `preview_access` session cookie.
- **Expire is best-effort and the gate is the real lock**: The cron expiration route emits cleanup events on a schedule, but the gate route itself continuously enforces expiration checks on every single inbound request.
