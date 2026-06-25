# Multi-Game Leaderboard API

Scalable, multi-game guest leaderboard backend for mobile games. Built with NestJS, PostgreSQL, Prisma, and Redis.

## Features

- **Multi-game support** — each game has its own leaderboards, seasons, and Redis keys
- **Guest initialization** — anonymous players shared across games (no login)
- **Offline game sync** — batch upload with idempotent replay handling
- **Global & weekly leaderboards** — top 100 + user rank when outside top
- **Replay-only anti-cheat** — SHA-256 replay hash validation and duplicate detection only
- **Redis sorted sets** — fast ranking via `ZADD`, `ZREVRANGE`, `ZREVRANK`
- **Per-game cron jobs** — independent weekly season rotation and daily Redis rebuild

## Tech Stack

- NestJS 11
- PostgreSQL 16 + Prisma ORM
- Redis 8 (sorted sets)
- TypeScript (strict)
- Swagger at `/api/docs`

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

API: `http://localhost:3000`  
Swagger: `http://localhost:3000/api/docs`

## Environment Variables

```env
DATABASE_URL="postgresql://kwong2000:1234abcd@localhost:5432/game"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV="development"
GAME_LEADERBOARD_TOP_LIMIT=100
```

## Project Structure

```
src/
├── config/                 # App configuration
├── modules/
│   ├── guest/              # Guest player initialization
│   ├── game/               # Game sync + registry
│   ├── replay/             # Replay hash validation (anti-cheat)
│   ├── leaderboard/        # Global & weekly rankings
│   ├── season/             # Per-game weekly seasons + cron jobs
│   ├── redis/              # Redis sorted set service
│   └── prisma/             # Database client
├── common/                 # Filters, interceptors, interfaces
└── main.ts
prisma/
├── schema.prisma
└── migrations/
```

## Adding a New Game

Insert a row into the `games` table — no code changes required:

```sql
INSERT INTO games (id, name, "isActive", config)
VALUES ('my-new-game', 'My New Game', true, '{"leaderboardTopLimit": 100}');
```

The core sync, leaderboard, and season logic automatically applies to the new `gameId`.

## API Reference

All success responses are wrapped:

```json
{
  "success": true,
  "data": { ... },
  "statusCode": 201,
  "message": "Resource created successfully",
  "path": "/guest/init",
  "timestamp": "2026-06-25T12:00:00.000Z"
}
```

### POST /guest/init

Create a new guest player (shared across all games).

**Response `data`:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

```bash
curl -X POST http://localhost:3000/guest/init
```

---

### POST /game/sync

Batch sync offline game results. Idempotent by `replayHash` per game.

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
curl -X POST http://localhost:3000/game/sync \
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

### GET /leaderboard/global?gameId=xxx

**Query:** `gameId` (required), `limit` (default 100, max 100), `guestId` (optional, for `myRank`)

**Response `data`:**

```json
{
  "top": [
    { "guestId": "...", "score": 5000, "rank": 1 },
    { "guestId": "...", "score": 4800, "rank": 2 }
  ],
  "myRank": 123
}
```

```bash
curl "http://localhost:3000/leaderboard/global?gameId=puzzle-quest&guestId=YOUR_GUEST_ID&limit=100"
```

---

### GET /leaderboard/weekly?gameId=xxx

Same query params and response shape as global, scoped to the active weekly season for the given game.

```bash
curl "http://localhost:3000/leaderboard/weekly?gameId=puzzle-quest&guestId=YOUR_GUEST_ID&limit=100"
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
| Monday 00:00 | Close weekly season per game, snapshot, open new season |
| Daily 03:00 | Rebuild Redis leaderboards from PostgreSQL per game |

## Redis Keys

| Key | Purpose |
|-----|---------|
| `lb:global:{gameId}` | Global all-time rankings |
| `lb:weekly:{gameId}:{seasonId}` | Weekly season rankings |

## Database Models

- **Game** — registered game with optional config JSON
- **GuestPlayer** — anonymous player (shared across games)
- **GameResult** — synced match scoped by `gameId`, unique `replayHash` per game
- **Season** — weekly competitive period per game
- **LeaderboardGlobal** — all-time best score per guest per game
- **LeaderboardWeekly** — best score per guest per game per season

## Testing

```bash
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
npm run test:cov    # Coverage
```

## Scripts

```bash
npm run start:dev         # Development server
npm run build             # Production build
npm run start:prod        # Run production build
npm run prisma:migrate    # Run migrations
npm run prisma:generate   # Generate Prisma client
```

## Deployment

```bash
npm run build
npx prisma migrate deploy
npm run start:prod
```

Set `NODE_ENV=production` and configure production `DATABASE_URL` and `REDIS_URL`.
