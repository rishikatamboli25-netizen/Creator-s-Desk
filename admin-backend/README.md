# CD_ADMIN Backend

Separate administrative backend for Creator's Desk.

## Phase 1 scope

- Separate admin MongoDB database
- Admin users with explicit system roles
- Granular permission definitions
- Opaque server-side admin sessions stored as hashed tokens
- HttpOnly admin session cookie
- Super-admin bootstrap command
- System role seeding
- Audit-log foundation
- Admin permission/role introspection endpoints
- API Gateway routing under `/api/admin`

## Local configuration

Copy `.env.example` to `.env` and set `MONGO_URI_ADMIN` plus a strong bootstrap password when creating the first super-admin.

Run the role seed once:

```bash
npm run seed:roles
```

Bootstrap the first super-admin with environment variables rather than putting the password in source control:

```bash
BOOTSTRAP_ADMIN_NAME="Creator's Desk Owner" \
BOOTSTRAP_ADMIN_EMAIL="owner@example.com" \
BOOTSTRAP_ADMIN_PASSWORD="a-strong-password-at-least-12-chars" \
npm run bootstrap:super-admin
```

Start the service:

```bash
npm run dev
```

The service listens on port `5010` by default.

## Initial endpoints

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /system/permissions`
- `GET /system/roles` (requires `admin_users.read`)

Through the API Gateway these are exposed under `/api/admin/*`.

## Security boundary

Consumer customer authentication remains owned by `auth-service`. CD_ADMIN has its own admin identity store and session mechanism. Authorization is enforced in the admin backend and is not delegated to the admin frontend or API Gateway.
