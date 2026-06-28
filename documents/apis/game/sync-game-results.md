# Sync Game Results API Documentation

## Overview

API đồng bộ kết quả game offline lên server theo batch. Hỗ trợ tối đa 50 kết quả mỗi request, idempotent qua `replayHash`, HMAC anti-cheat.

**Base URL**: `/api/games`

**Rate limits:**
- 30 requests / phút / IP
- 30 requests / phút / guest (Redis)

Xem [Replay Hash HMAC](./replay-hash-hmac.md) cho chi tiết client implementation.

---

## Endpoint

**Endpoint**: `POST /api/games/:gameId/results`

**Authentication**: Không yêu cầu. Client gửi `guestId` trong body để định danh guest.

#### Request Body

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
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
| guestId              | string | Yes      | UUID guest đã nhận từ `/guest/init`     |
| results              | array  | Yes      | Min: 1, Max: 50 items                   |
| results[].score      | number | Yes      | Integer, Min: 0 |
| results[].replayHash | string | Yes      | HMAC-SHA256 hex (64 chars)              |
| results[].playedAt   | string | No       | ISO 8601 strict |
| results[].metadata   | object | No       | Flat object; tối đa 10 keys, 2048 bytes; value là string/number/boolean/null |

`metadata.runSeed` là bắt buộc khi game có `config.replaySecret`.

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
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
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/games/puzzle-quest/results"
}
```

#### Per-item `reason` values

| Reason | Description |
|--------|-------------|
| `DUPLICATE_REPLAY` | Hash đã thuộc guest khác |
| `SCORE_MISMATCH` | Retry cùng hash nhưng score khác |
| `INVALID_REPLAY_SIGNATURE` | HMAC không khớp |
| `MISSING_RUN_SEED` | Thiếu `metadata.runSeed` |
| `MISSING_REPLAY_HASH` | `replayHash` rỗng |
| `INVALID_REPLAY_HASH_FORMAT` | Format hash sai |
| `INVALID_PLAYED_AT` | `playedAt` không parse được |

**Request-level Error Responses**

- **400 Bad Request**: DTO validation lỗi (`guestId` sai format, `results` không phải array, batch rỗng/quá 50 items, `score` không phải integer, metadata sai format, ...)
- **404 Not Found**: `gameId` hoặc `guestId` không tồn tại
- **429 Too Many Requests**: Vượt rate limit theo IP hoặc theo guest

---

## Business Logic

1. Resolve guest từ `guestId` (1 DB query).
2. `GuestRateLimitGuard` — per-guest Redis limit.
3. Validate từng result (HMAC, playedAt, duplicate).
4. Tra duplicate theo `game_results(gameId, replayHash)`, rồi insert rows mới vào `game_results`.
5. Upsert `leaderboard` (`GREATEST`).
6. Update Redis với authoritative `bestScore` sau khi đọc lại từ PostgreSQL.
7. Trả `results[]` theo **thứ tự input** + aggregates.

---

## Default Game Config

| Game | replaySecret |
|------|--------------|
| puzzle-quest | puzzle-quest-dev-secret |
| arcade-rush | arcade-rush-dev-secret |

```sql
UPDATE games SET config = '{"replaySecret": "your-secret"}'::jsonb
WHERE id = 'puzzle-quest';
```

---

## Related Endpoints

- [Replay Hash HMAC](./replay-hash-hmac.md)
- [Init Guest](../guest/init-guest.md)
- [Leaderboard](../leaderboard/global-leaderboard.md)
