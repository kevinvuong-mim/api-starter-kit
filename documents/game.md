# Client-Side Integration Guide
## Offline-First Mobile Game (Phaser + Capacitor)

**Audience:** Frontend / game client developers  
**Backend:** NestJS Game Leaderboard API  
**Stack:** Phaser 3 + Capacitor (TypeScript)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guest System](#2-guest-system)
3. [Game Session Flow](#3-game-session-flow)
4. [Game Result Data Structure](#4-game-result-data-structure)
5. [replayHash Explanation](#5-replayhash-explanation-client-view)
6. [Sync System](#6-sync-system)
7. [Leaderboard APIs](#7-leaderboard-apis)
8. [Multi-Game Support](#8-multi-game-support)
9. [Error Handling](#9-error-handling)
10. [Best Practices](#10-best-practices)
11. [Example Code (TypeScript)](#11-example-code-typescript)
12. [Security Notes](#12-security-notes-client-understanding-only)

---

## 1. Overview

### System Architecture (Simple)

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE CLIENT                           │
│  Phaser Game  →  Local Storage  →  Offline Queue  →  Sync    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (when online)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND API                             │
│  Guest  │  Game Sync  │  Leaderboard (Global + Weekly)     │
└─────────────────────────────────────────────────────────────┘
```

The client is the source of gameplay. The server is the source of truth for **rankings** and **synced results**.

| Concept | Client responsibility | Server responsibility |
|---|---|---|
| Gameplay | Run fully offline | — |
| Player identity | Store `guestId` locally | Create guest on init |
| Match results | Save locally, sync later | Accept/reject on sync |
| Leaderboard | Display rankings | Compute ranks |
| Anti-cheat | Generate `replayHash` from replay data | Validate hash format + uniqueness |

There is **no authentication**. Every player is an anonymous **guest** identified by a UUID (`guestId`).

### Offline-First Flow

1. App launches → load or create `guestId`
2. Player starts a game → play entirely offline
3. Game ends → compute `replayHash`, save result locally
4. When network is available → batch-upload unsynced results
5. Fetch leaderboard when needed (requires network)

The game must remain fully playable without network access. Network is only required for sync and leaderboard display.

### Why `replayHash` Exists (Client Perspective)

`replayHash` is a fingerprint of the match replay data (seed, moves, duration, etc.). It:

- Uniquely identifies a completed match
- Makes score tampering detectable (changing score without matching replay data produces a different hash)
- Enables **idempotent sync** — resubmitting the same match does not create duplicates

The client generates it. The server validates format and ensures the same hash is not reused by a different player.

---

## 2. Guest System

### Purpose

A `guestId` is the player's persistent anonymous identity. It is **shared across all games** in the app — one guest, many `gameId`s.

### API: `POST /guest/init`

Creates a new guest player.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/guest/init` |
| **Body** | None |
| **Status** | `201 Created` |

**Response** (wrapped — see [Response Format](#response-format)):

```json
{
  "success": true,
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "statusCode": 201,
  "message": "Resource created successfully",
  "path": "/guest/init",
  "timestamp": "2026-06-25T12:00:00.000Z"
}
```

### How to Initialize Guest (Client Flow)

```
App Launch
    │
    ├─ guestId exists in local storage?
    │       YES → reuse it
    │       NO  → POST /guest/init → save guestId
    │
    └─ Continue to game
```

### Local Storage

Use Capacitor Preferences (recommended) or `localStorage` as fallback.

| Key | Value | Notes |
|---|---|---|
| `guestId` | UUID string | Persist across app restarts |
| `pendingResults` | JSON array | Unsynced game results (see §6) |

**Capacitor Preferences example key:** `game_guest_id`

### When to Reuse `guestId`

| Scenario | Action |
|---|---|
| Normal app restart | Reuse stored `guestId` |
| Player clears app data / reinstalls | Call `POST /guest/init` again (new identity) |
| Sync returns `404 Guest player not found` | Re-init guest, keep local history for manual recovery if needed |
| Multiple games in one app | Same `guestId` for all games |

**Do not** call `/guest/init` on every app launch. Only call it once per device install (or after data wipe).

---

## 3. Game Session Flow

This is the core lifecycle every game must implement.

### Step-by-Step

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: START GAME                                               │
│  • Load guestId from storage                                     │
│  • Generate match seed (deterministic RNG)                       │
│  • Initialize replay recorder (empty moves array)                │
│  • Start duration timer                                          │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: PLAY OFFLINE                                             │
│  • All gameplay runs locally — no API calls                      │
│  • Record every input/action into replay buffer                  │
│  • Update score in real time                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: END GAME                                                 │
│  • Stop timer → final duration (seconds, integer)                │
│  • Freeze replay buffer — no more modifications                  │
│  • Compute replayHash from replay data                           │
│  • Build GameResult object                                       │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: SAVE LOCALLY (always, even if online)                    │
│  • Append result to pendingResults queue                         │
│  • Mark as synced: false                                         │
│  • Optionally save to match history for local UI                 │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: SYNC WHEN ONLINE (background)                            │
│  • Detect network availability                                   │
│  • Batch upload pending results via POST /game/sync              │
│  • Mark successfully synced records                              │
│  • Refresh leaderboard if on leaderboard screen                  │
└──────────────────────────────────────────────────────────────────┘
```

### Detailed Lifecycle

| Phase | Network required? | What happens |
|---|---|---|
| Start | No | Seed generated, replay recording begins |
| Play | No | Inputs recorded, score calculated locally |
| End | No | `replayHash` computed, result saved to local queue |
| Sync | Yes | Batch upload to server |
| Leaderboard | Yes | Fetch rankings for display |

### Important Rules at Game End

- Compute `replayHash` **once**, immediately after the match ends
- Treat replay data as **immutable** after game end
- Always save locally **before** attempting sync
- Never block the "Game Over" UI waiting for network

---

## 4. Game Result Data Structure

### Per-Match Result (inside `results` array)

```typescript
interface GameResult {
  score: number;        // required — final score (integer, >= 0)
  duration: number;     // required — match length in seconds (integer, >= 0)
  replayHash: string;   // required — 64-char SHA-256 hex string
  metadata?: object;    // optional — game-specific extra data
}
```

### Sync Request (top-level)

```typescript
interface SyncGameResultsRequest {
  gameId: string;       // required — which game this batch belongs to
  guestId: string;      // required — UUID from guest init
  results: GameResult[]; // required — 1 to 50 items per request
}
```

### Field Reference

| Field | Required | Type | Constraints | Notes |
|---|---|---|---|---|
| `gameId` | Yes | `string` | Must be registered & active on server | Set per game module |
| `guestId` | Yes | `string` | Valid UUID v4 | From local storage |
| `score` | Yes | `integer` | `>= 0` | Final score at game end |
| `duration` | Yes | `integer` | `>= 0` | Seconds, rounded down |
| `replayHash` | Yes | `string` | Exactly 64 lowercase hex chars | SHA-256 of replay data |
| `metadata` | No | `object` | Any JSON object | Level, power-ups, difficulty, etc. |

### What Must NOT Be Modified After Game Ends

Once the match ends, these are **frozen**:

| Data | Why |
|---|---|
| Replay buffer (seed, moves, inputs) | Changing it invalidates `replayHash` |
| `replayHash` | Must match the original replay data |
| `score` | Must be consistent with what produced the replay |
| `duration` | Must reflect actual match time |

`metadata` is sent to the server but is **not** part of `replayHash` by default. Only include non-critical display/analytics data in `metadata`. Do not put score-affecting data only in `metadata` — the server ranks by `score`.

---

## 5. replayHash Explanation (Client View)

### What Is It?

A **SHA-256 hash** (64-character hexadecimal string) computed from your game's replay payload. It acts as a unique match fingerprint.

### When Is It Generated?

**Immediately when the game ends**, after:

1. Replay recording is stopped
2. Final `score` and `duration` are known
3. Replay payload object is assembled

### What Data Is Used?

This is **game-specific**, but must be **deterministic** — the same match always produces the same hash.

Recommended replay payload structure:

```typescript
interface ReplayPayload {
  seed: number | string;       // match RNG seed
  moves: ReplayMove[];         // ordered player inputs/actions
  duration: number;            // match duration in seconds
  // Add game-specific fields as needed
}
```

### How to Compute

```typescript
async function computeReplayHash(replayData: unknown): Promise<string> {
  const canonical = JSON.stringify(replayData);
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

> Use `crypto.subtle` in Capacitor/WebView. Avoid Node.js `crypto` in the browser bundle.

### Example

**Input replay data:**

```json
{
  "seed": 42,
  "moves": [
    { "t": 0, "action": "tap", "x": 120, "y": 340 },
    { "t": 1500, "action": "tap", "x": 200, "y": 180 }
  ],
  "duration": 62
}
```

**Output `replayHash`:**

```
8f14e45fceea167a5a36dedd4bea2543ec946a085f4184afeb12dd0e6b8c4a3
```

(Your actual hash depends on exact JSON serialization — keep field order consistent.)

### Why It Must Not Be Changed Manually

- The server rejects invalid format (not 64-char hex)
- The server rejects duplicate hashes from **other** players
- Resubmitting the **same** hash by the **same** guest is accepted (idempotent)
- Faking a hash without valid replay data provides no gameplay advantage and will fail uniqueness checks if copied

**Rule:** Generate `replayHash` from real replay data. Never hardcode or edit it after generation.

---

## 6. Sync System

### API: `POST /game/sync`

Batch upload offline game results.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/game/sync` |
| **Status** | `201 Created` |
| **Batch size** | 1–50 results per request |

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

| Field | Meaning |
|---|---|
| `accepted` | Number of results accepted (including idempotent re-submissions) |
| `rejected` | Number of results rejected (invalid hash, duplicate by another player, etc.) |
| `bestScore` | Player's current global best score for this `gameId` |

### Batch Upload

- Group unsynced results into batches of up to **50**
- All results in one request must share the same `gameId` and `guestId`
- If you have results for multiple games, send separate requests per `gameId`

### Offline Queue Mechanism

Store pending results locally:

```typescript
interface PendingGameResult extends GameResult {
  localId: string;      // client-generated UUID for tracking
  gameId: string;
  guestId: string;
  synced: boolean;
  createdAt: string;      // ISO timestamp
  syncAttempts: number;
}
```

**Queue operations:**

```
SAVE  → push to pendingResults on game end
FLUSH → on network available, POST batch of unsynced items
MARK  → set synced: true for accepted items
RETRY → increment syncAttempts on failure, backoff
```

### Client Responsibilities

| Responsibility | Detail |
|---|---|
| Store unsynced games | Always persist before sync attempt |
| Retry on network restore | Listen to Capacitor `Network` plugin or `online` event |
| Idempotent sync | Same `replayHash` + same `guestId` → safe to resend; server counts as `accepted` |
| Avoid infinite resend | Mark as synced after successful response; cap retry attempts for permanently rejected items |
| Don't spam | Batch sync on interval (e.g. every 30s when online) or on app foreground |

### Idempotency Rules

| Situation | Server behavior | Client action |
|---|---|---|
| First submission | Accepted | Mark `synced: true` |
| Same guest, same `replayHash` again | Accepted (idempotent) | Mark `synced: true` |
| Different guest, same `replayHash` | Rejected | Do not retry; log locally |
| Invalid `replayHash` format | Rejected | Do not retry; fix client bug |

---

## 7. Leaderboard APIs

### Response Format

All leaderboard endpoints return:

```typescript
interface LeaderboardResponse {
  top: Array<{
    guestId: string;
    score: number;
    rank: number;       // 1-based
  }>;
  myRank: number | null; // player's rank if guestId provided; null if unranked
}
```

### `GET /leaderboard/global`

All-time best scores for a game.

| Query param | Required | Default | Max |
|---|---|---|---|
| `gameId` | Yes | — | — |
| `limit` | No | `100` | `100` |
| `guestId` | No | — | — |
| `page` | No | `1` | — |

```
GET /leaderboard/global?gameId=puzzle-quest&guestId={guestId}&limit=100
```

**Status:** `200 OK`

### `GET /leaderboard/weekly`

Current weekly season rankings. Same query params and response shape as global.

```
GET /leaderboard/weekly?gameId=puzzle-quest&guestId={guestId}&limit=100
```

Weekly seasons reset on a server schedule (typically Monday 00:00). The client does not manage seasons — just fetch and display.

### What the Client Receives

- **`top`** — up to 100 entries, sorted by score descending
- **`myRank`** — the requesting player's rank even if they are outside the top 100 (only when `guestId` is passed)

**Display tips:**

- Show `top` list in the main leaderboard UI
- If `myRank` is not in `top`, show a separate "Your Rank: #123" row
- Mask `guestId` for display (e.g. show last 4 chars: `...440000`)

---

## 8. Multi-Game Support

### Role of `gameId`

`gameId` identifies which game a result or leaderboard belongs to. Examples: `puzzle-quest`, `block-blitz`, `word-rush`.

Each `gameId` must be registered on the server before sync/leaderboard calls work.

### Switching Between Games

```
App Shell
  ├── gameId: "puzzle-quest"  →  own leaderboard, own pending queue filter
  ├── gameId: "block-blitz"   →  own leaderboard, own pending queue filter
  └── guestId: shared across all games
```

**Client pattern:**

- Define `gameId` as a constant per Phaser game scene/module
- Filter `pendingResults` by `gameId` when syncing
- Pass `gameId` on every sync and leaderboard request

### Why Leaderboards Are Separated by `gameId`

Scores are not comparable across different games (different mechanics, scoring systems). Global and weekly leaderboards are scoped per `gameId` so each game has its own competitive ranking.

---

## 9. Error Handling

### Response Format

**Success:**

```json
{
  "success": true,
  "data": { },
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "path": "/leaderboard/global?gameId=puzzle-quest",
  "timestamp": "2026-06-25T12:00:00.000Z"
}
```

**Error:**

```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Validation failed",
  "statusCode": 400,
  "path": "/game/sync",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "errors": [
    {
      "field": "results",
      "message": "results must contain no more than 50 elements",
      "constraint": "arrayMaxSize",
      "value": []
    }
  ]
}
```

Always read `response.data` on success and check `success === false` on errors.

### Common Error Scenarios

| Scenario | HTTP Status | Client action |
|---|---|---|
| Network failure / timeout | — | Keep in queue, retry with backoff |
| Validation error (400) | 400 | Fix payload, do not retry same data |
| Guest not found (404) | 404 | Re-init guest via `/guest/init` |
| Game not found (404) | 404 | Check `gameId` config, do not retry |
| Game inactive (400) | 400 | Disable sync for that game, show maintenance message |
| Sync partial rejection | 201 | `accepted` + `rejected` both returned; mark accepted items synced |
| Invalid `replayHash` | 201 (`rejected` count++) | Do not retry; investigate client replay logic |

### Retry Strategy

```typescript
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000]; // 5s, 30s, 2m, 10m
const MAX_SYNC_ATTEMPTS = 10;
```

| Error type | Retry? |
|---|---|
| Network timeout | Yes — exponential backoff |
| 5xx server error | Yes — exponential backoff |
| 400 validation | No — fix client code |
| 404 guest not found | Re-init guest, then retry sync |
| Sync `rejected` (duplicate hash by other player) | No — discard or flag locally |
| Sync `accepted` (idempotent duplicate) | Yes — mark synced, stop retrying |

---

## 10. Best Practices

### Gameplay & Data Integrity

- **Do not modify replay data after game ends** — treat the replay buffer as write-once
- **Always store local history** — even after successful sync, keep a local log for debugging and offline "my matches" UI
- **Generate `replayHash` from deterministic replay data** — stable JSON key order, consistent number formatting

### Sync Performance

- **Batch sync** — upload up to 50 results per request instead of one request per match
- **Avoid duplicate sync calls** — use a `syncInProgress` lock flag
- **Debounce sync triggers** — don't sync on every single game end if the player is on a streak; flush every N seconds or on app background

### Storage

- Persist `guestId` immediately after init
- Persist pending results **before** showing game-over screen
- Use atomic read-modify-write when updating the pending queue

### UX

- Never block gameplay on network
- Show sync status subtly (icon: synced / pending / offline)
- Show leaderboard cache when offline with a "last updated" timestamp

### Capacitor Integration

- Use `@capacitor/network` to listen for connectivity changes
- Trigger sync on `networkStatusChange` → connected
- Trigger sync on `appStateChange` → foreground

---

## 11. Example Code (TypeScript)

### Configuration

```typescript
const API_BASE_URL = 'https://api.yourgame.com'; // or http://localhost:3000 for dev
const GAME_ID = 'puzzle-quest';
const STORAGE_KEYS = {
  guestId: 'game_guest_id',
  pendingResults: 'game_pending_results',
} as const;
```

### API Client Helper

```typescript
interface ApiSuccess<T> {
  success: true;
  data: T;
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
}

interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  path: string;
  timestamp: string;
  errors?: Array<{ field: string; message: string; constraint: string; value: unknown }>;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw Object.assign(new Error(body.message ?? 'API error'), {
      statusCode: body.statusCode ?? response.status,
      body,
    });
  }

  return (body as ApiSuccess<T>).data;
}
```

### Guest Init

```typescript
import { Preferences } from '@capacitor/preferences';

async function getOrCreateGuestId(): Promise<string> {
  const stored = await Preferences.get({ key: STORAGE_KEYS.guestId });

  if (stored.value) {
    return stored.value;
  }

  const data = await apiRequest<{ guestId: string }>('/guest/init', {
    method: 'POST',
  });

  await Preferences.set({ key: STORAGE_KEYS.guestId, value: data.guestId });
  return data.guestId;
}
```

### Replay Hash

```typescript
interface ReplayPayload {
  seed: number;
  moves: Array<{ t: number; action: string; x: number; y: number }>;
  duration: number;
}

async function computeReplayHash(replayData: ReplayPayload): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(replayData));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Saving Game Result Locally

```typescript
interface PendingGameResult {
  localId: string;
  gameId: string;
  guestId: string;
  score: number;
  duration: number;
  replayHash: string;
  metadata?: Record<string, unknown>;
  synced: boolean;
  syncAttempts: number;
  createdAt: string;
}

async function saveGameResultLocally(params: {
  gameId: string;
  guestId: string;
  score: number;
  duration: number;
  replay: ReplayPayload;
  metadata?: Record<string, unknown>;
}): Promise<PendingGameResult> {
  const replayHash = await computeReplayHash(params.replay);

  const result: PendingGameResult = {
    localId: crypto.randomUUID(),
    gameId: params.gameId,
    guestId: params.guestId,
    score: params.score,
    duration: params.duration,
    replayHash,
    metadata: params.metadata,
    synced: false,
    syncAttempts: 0,
    createdAt: new Date().toISOString(),
  };

  const stored = await Preferences.get({ key: STORAGE_KEYS.pendingResults });
  const queue: PendingGameResult[] = stored.value ? JSON.parse(stored.value) : [];
  queue.push(result);

  await Preferences.set({
    key: STORAGE_KEYS.pendingResults,
    value: JSON.stringify(queue),
  });

  return result;
}
```

### Syncing Batch Results

```typescript
interface SyncResponse {
  accepted: number;
  rejected: number;
  bestScore: number;
}

let syncInProgress = false;

async function syncPendingResults(gameId: string, guestId: string): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const stored = await Preferences.get({ key: STORAGE_KEYS.pendingResults });
    const queue: PendingGameResult[] = stored.value ? JSON.parse(stored.value) : [];

    const pending = queue.filter((r) => !r.synced && r.gameId === gameId);
    if (pending.length === 0) return;

    // Process in batches of 50
    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50);

      const data = await apiRequest<SyncResponse>('/game/sync', {
        method: 'POST',
        body: JSON.stringify({
          gameId,
          guestId,
          results: batch.map(({ score, duration, replayHash, metadata }) => ({
            score,
            duration,
            replayHash,
            metadata,
          })),
        }),
      });

      // Mark batch items as synced if server accepted them
      // Idempotent re-submissions also count as accepted
      if (data.accepted > 0) {
        const batchHashes = new Set(batch.map((r) => r.replayHash));
        for (const item of queue) {
          if (batchHashes.has(item.replayHash) && item.gameId === gameId) {
            item.synced = true;
          }
        }
      }

      if (data.rejected > 0) {
        console.warn(`Sync: ${data.rejected} result(s) rejected for gameId=${gameId}`);
      }
    }

    await Preferences.set({
      key: STORAGE_KEYS.pendingResults,
      value: JSON.stringify(queue),
    });
  } catch (error) {
    const stored = await Preferences.get({ key: STORAGE_KEYS.pendingResults });
    const queue: PendingGameResult[] = stored.value ? JSON.parse(stored.value) : [];

    for (const item of queue) {
      if (!item.synced && item.gameId === gameId) {
        item.syncAttempts += 1;
      }
    }

    await Preferences.set({
      key: STORAGE_KEYS.pendingResults,
      value: JSON.stringify(queue),
    });

    throw error;
  } finally {
    syncInProgress = false;
  }
}
```

### Fetching Leaderboard

```typescript
interface LeaderboardEntry {
  guestId: string;
  score: number;
  rank: number;
}

interface LeaderboardData {
  top: LeaderboardEntry[];
  myRank: number | null;
}

async function fetchGlobalLeaderboard(
  gameId: string,
  guestId?: string,
): Promise<LeaderboardData> {
  const params = new URLSearchParams({ gameId, limit: '100' });
  if (guestId) params.set('guestId', guestId);

  return apiRequest<LeaderboardData>(`/leaderboard/global?${params}`);
}

async function fetchWeeklyLeaderboard(
  gameId: string,
  guestId?: string,
): Promise<LeaderboardData> {
  const params = new URLSearchParams({ gameId, limit: '100' });
  if (guestId) params.set('guestId', guestId);

  return apiRequest<LeaderboardData>(`/leaderboard/weekly?${params}`);
}
```

### Wiring It Together (Phaser Game Over)

```typescript
async function onGameOver(
  scene: Phaser.Scene,
  finalScore: number,
  replay: ReplayPayload,
): Promise<void> {
  const guestId = await getOrCreateGuestId();

  await saveGameResultLocally({
    gameId: GAME_ID,
    guestId,
    score: finalScore,
    duration: replay.duration,
    replay,
    metadata: { level: scene.registry.get('currentLevel') },
  });

  // Non-blocking background sync
  syncPendingResults(GAME_ID, guestId).catch(() => {
    // Offline or failed — result is safe in local queue
  });

  scene.scene.start('GameOverScene', { score: finalScore });
}
```

---

## 12. Security Notes (Client Understanding Only)

### What `replayHash` Protects Against

- **Duplicate submission** — the same match cannot be credited to multiple players
- **Casual tampering** — changing score or replay data after the fact produces a mismatch with the submitted hash
- **Replay flooding** — each unique match has a unique fingerprint

### What the Client Must Understand

| Principle | Detail |
|---|---|
| Server is source of truth | Leaderboard ranks come from synced, accepted results only |
| Do not fake scores | Inflated scores may sync, but `replayHash` uniqueness prevents replaying others' matches |
| Do not reuse others' hashes | Server rejects duplicate hashes from different guests |
| Hash is not encryption | It proves identity of match data, not secrecy |
| Client generates, server validates | Format (64-char hex) and uniqueness are checked server-side |

### What NOT to Do

- Do not hardcode `replayHash` values
- Do not edit `score` after computing the hash
- Do not skip replay recording to "optimize" — you need real data for a valid hash
- Do not assume local high scores are on the leaderboard until sync succeeds

---

## Quick Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/guest/init` | `POST` | Create guest identity |
| `/game/sync` | `POST` | Batch upload match results |
| `/leaderboard/global` | `GET` | All-time rankings |
| `/leaderboard/weekly` | `GET` | Weekly season rankings |

| Local storage key | Content |
|---|---|
| `game_guest_id` | `guestId` UUID |
| `game_pending_results` | Array of unsynced `PendingGameResult` |

| Constraint | Value |
|---|---|
| Max results per sync | 50 |
| Max leaderboard entries | 100 |
| `replayHash` format | 64-char lowercase hex (SHA-256) |
| `score` / `duration` | Non-negative integers |
