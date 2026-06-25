# Game Leaderboard API

Offline-first guest leaderboard backend for mobile games (Phaser + Capacitor). Built with NestJS, PostgreSQL, Prisma, and Redis.

## Features

- **Guest initialization** — anonymous players, no login required
- **Offline game sync** — batch upload of game results with idempotent replay handling
- **Global leaderboard** — all-time best scores
- **Weekly leaderboard** — best scores for the active weekly season
- **Anti-cheat** — score, duration, replay hash, seed, and duplicate detection with trust scoring
- **Redis rankings** — sorted sets for fast top-100 and rank lookups
- **Background jobs** — weekly season rotation and daily Redis rebuild

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

# Anti-cheat tuning
GAME_MAX_SCORE=1000000
GAME_MIN_DURATION_SECONDS=5
GAME_MAX_ACTIONS_PER_SECOND=10
GAME_TRUST_PENALTY=20
GAME_SHADOW_THRESHOLD=60
GAME_BLOCKED_THRESHOLD=20
```

## Project Structure

```
src/
├── config/                 # Game configuration
├── modules/
│   ├── guest/              # Guest player initialization
│   ├── game-session/       # Offline result sync
│   ├── leaderboard/        # Global & weekly rankings
│   ├── anti-cheat/         # Cheat detection rules
│   ├── season/             # Weekly seasons + cron jobs
│   ├── redis/              # Redis sorted set service
│   └── prisma/             # Database client
├── common/                 # Filters, interceptors, interfaces
└── main.ts
prisma/
├── schema.prisma
└── migrations/
```

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

Create a new guest player.

**Response `data`:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/guest/init
```

---

### POST /game/sync

Batch sync offline game results. Idempotent by `replayHash`.

**Request:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "results": [
    {
      "score": 1000,
      "duration": 180,
      "seed": 12345,
      "moves": [{ "action": "tap", "x": 1, "y": 2 }],
      "replayHash": "a3f2c1...",
      "clientVersion": "1.0.0",
      "playedAt": "2026-06-20T10:00:00.000Z"
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

```typescript
import { createHash } from 'crypto';

function computeReplayHash(result: {
  seed: number;
  score: number;
  duration: number;
  moves: unknown[];
}): string {
  const payload = `${result.seed}:${result.score}:${result.duration}:${JSON.stringify(result.moves)}`;
  return createHash('sha256').update(payload).digest('hex');
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/game/sync \
  -H "Content-Type: application/json" \
  -d '{
    "guestId": "YOUR_GUEST_ID",
    "results": [{
      "score": 1000,
      "duration": 60,
      "seed": 42,
      "moves": [{"action": "tap", "x": 1, "y": 2}],
      "replayHash": "COMPUTED_HASH"
    }]
  }'
```

---

### GET /leaderboard/global

**Query:** `page` (default 1), `limit` (default 20, max 100), `guestId` (optional, for `myRank`)

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

**Example:**

```bash
curl "http://localhost:3000/leaderboard/global?guestId=YOUR_GUEST_ID&page=1&limit=20"
```

---

### GET /leaderboard/weekly

Same query params and response shape as global, scoped to the active weekly season.

```bash
curl "http://localhost:3000/leaderboard/weekly?guestId=YOUR_GUEST_ID&page=1&limit=20"
```

## Anti-Cheat

| Rule | Action |
|------|--------|
| Score > max or < 0 | Reject |
| Duration below minimum | Reject |
| Actions/second too high | Reject |
| Invalid replay hash | Reject |
| Invalid seed | Reject |
| Duplicate replay (other player) | Reject |

**Trust score:** starts at 100. Each violation: **-20**.

| Trust Score | Status | Effect |
|-------------|--------|--------|
| 60–100 | NORMAL | Full leaderboard access |
| 20–59 | SHADOW | Scores stored, hidden from public boards |
| 0–19 | BLOCKED | Cannot sync |

## Background Jobs

| Schedule | Job |
|----------|-----|
| Monday 00:00 | Close weekly season, snapshot, open new season |
| Daily 03:00 | Rebuild Redis leaderboards from PostgreSQL |

## Redis Keys

| Key | Purpose |
|-----|---------|
| `lb:global` | Global all-time rankings |
| `lb:weekly:{seasonId}` | Weekly season rankings |

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

## Database Models

- **GuestPlayer** — anonymous player with trust score and status
- **GameResult** — synced match with replay hash (unique, idempotent)
- **Season** — weekly competitive periods
- **LeaderboardGlobal** — all-time best score per guest
- **LeaderboardWeekly** — best score per guest per season

## Deployment

```bash
npm run build
npx prisma migrate deploy
npm run start:prod
```

Set `NODE_ENV=production` and configure production `DATABASE_URL` and `REDIS_URL`.
