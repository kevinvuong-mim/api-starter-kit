# Multi-Game API

Scalable, multi-game guest backend for mobile games. Built with NestJS, PostgreSQL, Prisma, and Redis.

## What This API Does

| Area | Responsibility |
|------|----------------|
| **Guest** | Create anonymous players and issue `sessionToken` for protected routes |
| **Game sync** | Accept offline match results in batches and persist them per `gameId` |
| **Leaderboard** | Serve paginated global rankings from Redis, with optional `myRank` |
| **Anti-cheat** | Validate replay hashes (SHA-256) and reject duplicate replays from other guests |

Ads, IAP, and in-game economy are handled on the client (`game-starter-kit`) — this API does not manage monetization.

## Features

- **Multi-game support** — each game has its own leaderboard and Redis key
- **Guest initialization** — anonymous players shared across games (no login)
- **Guest session tokens** — `sessionToken` issued at init; protected routes use `Authorization: Bearer <token>`
- **Guest display names** — optional display name per guest (shown on leaderboards)
- **Offline game sync** — batch upload (1–50 results) with idempotent replay handling
- **Global leaderboard** — paginated top rankings + optional `myRank` via session token
- **Replay-only anti-cheat** — SHA-256 replay hash validation and duplicate detection only
- **Redis sorted sets** — fast ranking via `ZADD`, `ZREVRANGE`, `ZREVRANK`
- **Rate limiting** — 100 requests per minute per IP (NestJS Throttler)
- **Security** — Helmet headers, CORS, response compression
- **Background jobs** — daily Redis leaderboard rebuild from PostgreSQL

## API Endpoints

Base URL: `http://localhost:3000/api`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Public | Health check (`Hello World!`) |
| `POST` | `/guest/init` | Public | Create guest, return `guestId` + `sessionToken` |
| `PATCH` | `/guest/name` | Bearer token | Update guest display name |
| `POST` | `/game/sync` | Bearer token | Upload batch of game results |
| `GET` | `/leaderboard/global` | Optional Bearer | Global leaderboard (`?gameId=&page=&limit=`) |

Detailed request/response examples: [`documents/apis/`](documents/apis/)

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

Health check:

```bash
curl http://localhost:3000/api
```

## Environment Variables

```env
DATABASE_URL="postgresql://kwong2000:1234abcd@localhost:5432/game"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV="development"
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` or `production` |

See also: [`documents/setup/environment-variables.md`](documents/setup/environment-variables.md)

## Project Structure

```
src/
├── app.controller.ts       # Health / hello endpoint
├── app.module.ts
├── main.ts                 # Bootstrap, global prefix, pipes, filters
├── common/
│   ├── decorators/         # @CurrentGuest()
│   ├── filters/            # HTTP exception filter
│   ├── guards/             # GuestAuthGuard, OptionalGuestAuthGuard
│   ├── interceptors/       # Standard response envelope
│   ├── interfaces/
│   ├── utils/              # Bearer token extraction
│   └── validators/         # Custom DTO validators
├── modules/
│   ├── guest/              # Guest init + display name
│   ├── game/               # Game sync, registry, repository
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
| Public | `GET /api`, `POST /api/guest/init` |
| Required (`GuestAuthGuard`) | `PATCH /api/guest/name`, `POST /api/game/sync` |
| Optional (`OptionalGuestAuthGuard`) | `GET /api/leaderboard/global` (for `myRank`) |

`guestId` is resolved from the token on the server — do not send it in request bodies for protected routes.

## Response Format

All success responses are wrapped by `ResponseInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": { },
  "path": "/api/guest/init",
  "timestamp": "2026-06-27T01:00:00.000Z"
}
```

Errors are formatted by `HttpExceptionFilter` with `success: false` and a structured `message`.

## Adding a New Game

Insert a row into the `games` table — no code changes required:

```sql
INSERT INTO games (id, name, "isActive")
VALUES ('my-new-game', 'My New Game', true);
```

The sync and leaderboard logic automatically applies to the new `gameId`. The client must send this `gameId` in sync and leaderboard requests.

Default seeded games: `puzzle-quest`, `arcade-rush`.

## Game Sync

`POST /api/game/sync` accepts:

```json
{
  "gameId": "puzzle-quest",
  "results": [
    {
      "score": 1200,
      "replayHash": "<64-char SHA-256 hex>",
      "metadata": { "level": 3 }
    }
  ]
}
```

Constraints:

- `results`: 1–50 items per request
- `score`: non-negative integer
- `replayHash`: required, 64-character SHA-256 hex string
- `metadata`: optional JSON object (string/number/boolean/null values)

Response:

```json
{
  "accepted": 1,
  "rejected": 0,
  "bestScore": 1200
}
```

On accept, the API persists `GameResult`, upserts `Leaderboard` (keeps highest score), and updates Redis in real time.

## Anti-Cheat (Replay Hash Only)

The `ReplayService` validates **only** replay hashes:

| Rule | Action |
|------|--------|
| Missing replay hash | Reject |
| Invalid format (not 64-char SHA-256 hex) | Reject |
| Duplicate replay hash (different guest, same game) | Reject |
| Same guest resubmits same hash | Accept (idempotent) |

No score validation, physics checks, seed validation, trust scoring, or server-side replay simulation.

## Leaderboard

`GET /api/leaderboard/global?gameId=puzzle-quest&page=1&limit=100`

- `page`: minimum 1 (default `1`)
- `limit`: 1–100 (default `100`)
- Returns `top` (ranked entries with guest names), `pagination`, and `myRank` when a valid Bearer token is provided

## Background Jobs

| Schedule | Job |
|----------|-----|
| Daily 03:00 | Rebuild Redis leaderboards from PostgreSQL per active game |

See: [`documents/tasks/leaderboard-maintenance.md`](documents/tasks/leaderboard-maintenance.md)

## Redis Keys

| Key | Purpose |
|-----|---------|
| `lb:global:{gameId}` | Global all-time rankings |

## Database Models

| Model | Purpose |
|-------|---------|
| **Game** | Registered game with optional config JSON and `isActive` flag |
| **GuestPlayer** | Anonymous player with `sessionToken` and optional display name (shared across games) |
| **GameResult** | Synced match scoped by `gameId`; unique `replayHash` per game |
| **Leaderboard** | All-time best score per guest per game |

## API Documentation

| Topic | Document |
|-------|----------|
| Health check | [`documents/apis/health/health-check.md`](documents/apis/health/health-check.md) |
| Init guest | [`documents/apis/guest/init-guest.md`](documents/apis/guest/init-guest.md) |
| Update guest name | [`documents/apis/guest/update-guest-name.md`](documents/apis/guest/update-guest-name.md) |
| Sync game results | [`documents/apis/game/sync-game-results.md`](documents/apis/game/sync-game-results.md) |
| Global leaderboard | [`documents/apis/leaderboard/global-leaderboard.md`](documents/apis/leaderboard/global-leaderboard.md) |
| Leaderboard cron | [`documents/tasks/leaderboard-maintenance.md`](documents/tasks/leaderboard-maintenance.md) |
| Docker setup | [`documents/setup/docker.md`](documents/setup/docker.md) |

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

Set `NODE_ENV=production` and configure production `DATABASE_URL` and `REDIS_URL`.
