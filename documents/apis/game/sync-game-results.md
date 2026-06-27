# Sync Game Results API Documentation

## Overview

API đồng bộ kết quả game offline lên server theo batch. Hỗ trợ tối đa 50 kết quả mỗi request, idempotent qua `replayHash`, HMAC anti-cheat, validate `maxScore` theo game config.

**Base URL**: `/api/games`

**Rate limits:**
- 30 requests / phút / IP
- 30 requests / phút / guest (Redis)

Xem [Replay Hash HMAC](./replay-hash-hmac.md) cho chi tiết client implementation.

---

## Endpoint

**Endpoint**: `POST /api/games/:gameId/results`

**Authentication**: Bearer session token

#### Request Body

```json
{
  "results": [
    {
      "score": 1500,
      "replayHash": "a3f2c1b9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      "playedAt": "2026-06-27T10:00:00.000Z",
      "metadata": {
        "runSeed": "run-abc-123",
        "level": 5
      }
    }
  ]
}
```

| Field                | Type   | Required | Validation                              |
| -------------------- | ------ | -------- | --------------------------------------- |
| results              | array  | Yes      | Min: 1, Max: 50 items                   |
| results[].score      | number | Yes      | Integer, Min: 0, ≤ `game.config.maxScore` |
| results[].replayHash | string | Yes      | HMAC-SHA256 hex (64 chars)              |
| results[].playedAt   | string | No       | ISO 8601; skew max 5 min future, 7 days past |
| results[].metadata   | object | No       | Phải có `runSeed` khi game có `replaySecret` |

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "replayHash": "a3f2c1b9...",
        "status": "accepted"
      },
      {
        "replayHash": "b4e3d2c1...",
        "status": "rejected",
        "reason": "INVALID_REPLAY_SIGNATURE"
      }
    ],
    "accepted": 1,
    "rejected": 1,
    "bestScore": 1500
  }
}
```

#### Per-item `reason` values

| Reason | Description |
|--------|-------------|
| `DUPLICATE_REPLAY` | Hash đã thuộc guest khác |
| `SCORE_MISMATCH` | Retry cùng hash nhưng score khác |
| `SCORE_EXCEEDS_MAX` | Vượt `maxScore` |
| `INVALID_REPLAY_SIGNATURE` | HMAC không khớp |
| `MISSING_RUN_SEED` | Thiếu `metadata.runSeed` |
| `INVALID_REPLAY_HASH_FORMAT` | Format hash sai |
| `INVALID_PLAYED_AT` | `playedAt` không parse được |
| `PLAYED_AT_IN_FUTURE` | `playedAt` quá xa tương lai |
| `PLAYED_AT_TOO_OLD` | `playedAt` quá cũ |

---

## Business Logic

1. `GuestAuthGuard` resolve guest từ token (1 DB query).
2. `GuestRateLimitGuard` — per-guest Redis limit.
3. Validate từng result (HMAC, maxScore, playedAt, duplicate).
4. Transaction: `INSERT ... ON CONFLICT DO NOTHING RETURNING` trên `game_replay_keys` → insert `game_results` chỉ cho rows mới.
5. Upsert `leaderboard` (`GREATEST`).
6. Update Redis với encoded tie-break score.
7. Trả `results[]` theo **thứ tự input** + aggregates.

---

## Default Game Config

| Game | maxScore | replaySecret |
|------|----------|--------------|
| puzzle-quest | 50000 | puzzle-quest-dev-secret |
| arcade-rush | 100000 | arcade-rush-dev-secret |

```sql
UPDATE games SET config = '{"maxScore": 50000, "replaySecret": "your-secret"}'::jsonb
WHERE id = 'puzzle-quest';
```

---

## Related Endpoints

- [Replay Hash HMAC](./replay-hash-hmac.md)
- [Init Guest](../guest/init-guest.md)
- [Leaderboard](../leaderboard/global-leaderboard.md)
