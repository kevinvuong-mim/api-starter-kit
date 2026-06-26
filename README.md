# Multi-Game API

Scalable, multi-game guest backend for mobile games, with server-verified ads monetization. Built with NestJS, PostgreSQL, Prisma, and Redis.

## Features

- **Multi-game support** — each game has its own leaderboard and Redis keys
- **Guest initialization** — anonymous players shared across games (no login)
- **Guest session tokens** — `sessionToken` issued at init; protected routes use `Authorization: Bearer <token>`
- **Guest display names** — optional display name per guest (shown on leaderboards)
- **Offline game sync** — batch upload (up to 50 results) with idempotent replay handling
- **Global leaderboard** — paginated top rankings + optional `myRank` via session token
- **Replay-only anti-cheat** — SHA-256 replay hash validation and duplicate detection only
- **Redis sorted sets** — fast ranking via `ZADD`, `ZREVRANGE`, `ZREVRANK`
- **Ads monetization** — remote config, rewarded ad sessions (start/claim), client event logging, admin metrics
- **Rate limiting** — 100 requests per minute per IP (NestJS Throttler)
- **Security** — Helmet headers, CORS, response compression
- **Background jobs** — daily Redis leaderboard rebuild; pending ad reward session expiry

## Tech Stack

- NestJS 11
- PostgreSQL 16 + Prisma ORM
- Redis 8 (sorted sets)
- TypeScript (strict)

## Prerequisites

- Node.js >= 20
- Docker (PostgreSQL + Redis)

## Quick Start

```bash
npm install
cp .env.example .env
docker-compose up -d
npm run prisma:migrate
npm run prisma:generate
npm run start:dev
```

API base URL: `http://localhost:3000/api`

Health check: `GET http://localhost:3000/api`

## Environment Variables

```env
DATABASE_URL="postgresql://kwong2000:1234abcd@localhost:5432/game"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV="development"

# Ads monetization
ADS_ADMIN_API_KEY="random-api-key"
ADS_REWARD_SESSION_TTL_SECONDS=300
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `ADS_ADMIN_API_KEY` | Secret key for admin ads endpoints (`x-ads-admin-key` header) |
| `ADS_REWARD_SESSION_TTL_SECONDS` | Reward session expiry in seconds (default `300`) |

See also: [`documents/setup/environment-variables.md`](documents/setup/environment-variables.md)

## Project Structure

```
src/
├── app.controller.ts       # Health / hello endpoint
├── app.module.ts
├── main.ts                 # Bootstrap, global prefix, pipes, filters
├── common/
│   ├── auth/               # Guest session guards (required + optional)
│   ├── filters/            # HTTP exception filter
│   ├── interceptors/       # Standard response envelope
│   ├── interfaces/
│   └── validators/
├── modules/
│   ├── ads/                # Ads config, rewards, events, admin metrics
│   ├── guest/              # Guest init + display name
│   ├── game/               # Game sync + registry + repository
│   ├── replay/             # Replay hash validation (anti-cheat)
│   ├── leaderboard/        # Global rankings + daily maintenance cron
│   ├── redis/              # Redis sorted set service
│   └── prisma/             # Database client
prisma/
├── schema.prisma
└── migrations/
documents/                  # Detailed API & task docs (Vietnamese)
```

## Authentication

Guest players receive a `sessionToken` from `POST /api/guest/init`. Use it on protected routes:

```
Authorization: Bearer <sessionToken>
```

| Auth type | Routes |
|-----------|--------|
| Public | `GET /api`, `POST /api/guest/init`, `GET /api/ads/config` |
| Required (`GuestAuthGuard`) | `PATCH /api/guest/name`, `POST /api/game/sync`, ads reward/events |
| Optional (`OptionalGuestAuthGuard`) | `GET /api/leaderboard/global` (for `myRank`) |
| Admin key (`x-ads-admin-key`) | `GET/PATCH /api/ads/admin/*` |

`guestId` is resolved from the token on the server — do not send it in request bodies for protected routes.

## Adding a New Game

Insert a row into the `games` table — no code changes required:

```sql
INSERT INTO games (id, name, "isActive")
VALUES ('my-new-game', 'My New Game', true);
```

The core sync and leaderboard logic automatically applies to the new `gameId`.

Default seeded games: `puzzle-quest`, `arcade-rush`.

## Anti-Cheat (Replay Hash Only)

The `ReplayService` validates **only** replay hashes:

| Rule | Action |
|------|--------|
| Missing replay hash | Reject |
| Invalid format (not 64-char SHA-256 hex) | Reject |
| Duplicate replay hash (different guest, same game) | Reject |
| Same guest resubmits same hash | Accept (idempotent) |

No score validation, physics checks, seed validation, trust scoring, or server-side replay simulation.

## Background Jobs

| Schedule | Job |
|----------|-----|
| Daily 03:00 | Rebuild Redis leaderboards from PostgreSQL per active game |
| Every 10 minutes | Expire pending ad reward sessions past TTL |

## Redis Keys

| Key | Purpose |
|-----|---------|
| `lb:global:{gameId}` | Global all-time rankings |

## Database Models

- **Game** — registered game with optional config JSON
- **GuestPlayer** — anonymous player with `sessionToken` and optional display name (shared across games)
- **GameResult** — synced match scoped by `gameId`, unique `replayHash` per game
- **Leaderboard** — all-time best score per guest per game
- **AdConfig** — singleton runtime ads config override (`id = "default"`)
- **AdRewardSession** — server-verified rewarded ad sessions (`PENDING` → `CLAIMED` / `EXPIRED`)
- **AdEvent** — client and server ad analytics events

## Testing

```bash
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
npm run test:cov    # Coverage
```

## Scripts

```bash
npm run start:dev         # Development server (watch mode)
npm run start:debug       # Development server with debugger
npm run build             # Production build
npm run start:prod        # Run production build
npm run lint              # ESLint
npm run format            # Prettier
npm run prisma:migrate    # Run migrations (dev)
npm run prisma:generate   # Generate Prisma client
npm run prisma:reset      # Reset database and re-run migrations
```

## Deployment

```bash
npm run build
npx prisma migrate deploy
npm run start:prod
```

Set `NODE_ENV=production` and configure production `DATABASE_URL`, `REDIS_URL`, and `ADS_ADMIN_API_KEY`.
