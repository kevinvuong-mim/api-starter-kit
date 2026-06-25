# Multi-Game Leaderboard API

Scalable, multi-game guest leaderboard backend for mobile games. Built with NestJS, PostgreSQL, Prisma, and Redis.

## Features

- **Multi-game support** — each game has its own leaderboard and Redis keys
- **Guest initialization** — anonymous players shared across games (no login)
- **Guest display names** — optional display name per guest (shown on leaderboards)
- **Offline game sync** — batch upload (up to 50 results) with idempotent replay handling
- **Global leaderboard** — top 100 + user rank when outside top
- **Replay-only anti-cheat** — SHA-256 replay hash validation and duplicate detection only
- **Redis sorted sets** — fast ranking via `ZADD`, `ZREVRANGE`, `ZREVRANK`
- **Rate limiting** — 100 requests per minute per IP (NestJS Throttler)
- **Security** — Helmet headers, CORS, response compression
- **Daily Redis rebuild** — cron job syncs PostgreSQL leaderboard data to Redis

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
CORS_ORIGIN="http://localhost:5173,capacitor://localhost,https://localhost"
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `CORS_ORIGIN` | Comma-separated allowed origins (`*` if unset) |

## Project Structure

```
src/
├── app.controller.ts       # Health / hello endpoint
├── app.module.ts
├── main.ts                 # Bootstrap, global prefix, pipes, filters
├── common/                 # Filters, interceptors, interfaces
├── modules/
│   ├── guest/              # Guest init + display name
│   ├── game/               # Game sync + registry + repository
│   ├── replay/             # Replay hash validation (anti-cheat)
│   ├── leaderboard/        # Global rankings + daily maintenance cron
│   ├── redis/              # Redis sorted set service
│   └── prisma/             # Database client
prisma/
├── schema.prisma
└── migrations/
```

## Adding a New Game

Insert a row into the `games` table — no code changes required:

```sql
INSERT INTO games (id, name, "isActive")
VALUES ('my-new-game', 'My New Game', true);
```

The core sync and leaderboard logic automatically applies to the new `gameId`.

Default seeded games: `puzzle-quest`, `arcade-rush`.

## API Reference

All routes are prefixed with `/api`. Success responses are wrapped:

```json
{
  "success": true,
  "data": { ... },
  "statusCode": 201,
  "message": "Resource created successfully",
  "path": "/api/guest/init",
  "timestamp": "2026-06-25T12:00:00.000Z"
}
```

### GET /api

Health / hello endpoint.

**Response `data`:** `"Hello World!"`

```bash
curl http://localhost:3000/api
```

---

### POST /api/guest/init

Create a new guest player (shared across all games).

**Response `data`:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

```bash
curl -X POST http://localhost:3000/api/guest/init
```

---

### PATCH /api/guest/name

Set or update a guest's display name (1–20 characters). Name appears on leaderboard entries.

**Request:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "PlayerOne"
}
```

**Response `data`:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "PlayerOne"
}
```

```bash
curl -X PATCH http://localhost:3000/api/guest/name \
  -H "Content-Type: application/json" \
  -d '{
    "guestId": "YOUR_GUEST_ID",
    "name": "PlayerOne"
  }'
```

---

### POST /api/game/sync

Batch sync offline game results. Idempotent by `replayHash` per game. Max 50 results per request.

**Request:**

```json
{
  "gameId": "puzzle-quest",
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "results": [
    {
      "score": 1000,
      "duration": 180,
      "replayHash": "a3f2c1b9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      "metadata": { "level": 5, "powerUps": ["shield"] }
    }
  ]
}
```

**Response `data`:**

```json
{
  "accepted": 1,
  "rejected": 0,
  "bestScore": 1200
}
```

**Replay hash (client-side):**

Each game computes its own SHA-256 hash from game-specific replay data. The server only validates format and uniqueness — it does not recompute or verify the hash contents.

```typescript
import { createHash } from 'crypto';

function computeReplayHash(replayData: unknown): string {
  return createHash('sha256').update(JSON.stringify(replayData)).digest('hex');
}
```

```bash
curl -X POST http://localhost:3000/api/game/sync \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "puzzle-quest",
    "guestId": "YOUR_GUEST_ID",
    "results": [{
      "score": 1000,
      "duration": 60,
      "replayHash": "YOUR_64_CHAR_SHA256_HEX",
      "metadata": { "level": 1 }
    }]
  }'
```

---

### GET /api/leaderboard/global?gameId=xxx

**Query:** `gameId` (required), `limit` (default 100, max 100), `guestId` (optional, for `myRank`)

**Response `data`:**

```json
{
  "top": [
    { "guestId": "...", "name": "PlayerOne", "score": 5000, "rank": 1 },
    { "guestId": "...", "name": null, "score": 4800, "rank": 2 }
  ],
  "myRank": 123
}
```

```bash
curl "http://localhost:3000/api/leaderboard/global?gameId=puzzle-quest&guestId=YOUR_GUEST_ID&limit=100"
```

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

## Redis Keys

| Key | Purpose |
|-----|---------|
| `lb:global:{gameId}` | Global all-time rankings |

## Database Models

- **Game** — registered game with optional config JSON
- **GuestPlayer** — anonymous player with optional display name (shared across games)
- **GameResult** — synced match scoped by `gameId`, unique `replayHash` per game
- **Leaderboard** — all-time best score per guest per game

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

Set `NODE_ENV=production` and configure production `DATABASE_URL`, `REDIS_URL`, and `CORS_ORIGIN`.
