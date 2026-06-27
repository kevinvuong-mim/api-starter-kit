# Replay Hash HMAC Scheme

## Overview

Mỗi game có `replaySecret` trong `games.config`. Client dùng secret này (obfuscate trong SDK) để tạo `replayHash` — server verify HMAC trước khi chấp nhận score.

**Mục tiêu:** Ngăn score injection đơn giản (chỉnh request / random hash) cho game casual offline-first.

**Không thay thế:** server-side gameplay simulation.

---

## Game Config

```json
{
  "maxScore": 50000,
  "replaySecret": "your-per-game-secret",
  "playedAtMaxAgeDays": 7,
  "playedAtFutureSkewMs": 300000
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `maxScore` | `100000` | Điểm tối đa hợp lệ |
| `replaySecret` | — | Bắt buộc cho production; nếu thiếu, server chỉ validate format hash |
| `playedAtMaxAgeDays` | `7` | Tuổi tối đa của `playedAt` |
| `playedAtFutureSkewMs` | `300000` (5 phút) | Cho phép clock skew về tương lai |

Seed dev:

- `puzzle-quest` → `maxScore: 50000`, `replaySecret: puzzle-quest-dev-secret`
- `arcade-rush` → `maxScore: 100000`, `replaySecret: arcade-rush-dev-secret`

---

## Client Algorithm

### Inputs

- `gameId` — ID game (path param)
- `score` — integer ≥ 0
- `runSeed` — unique string per play session (lưu trong `metadata.runSeed`)

### Payload

```
payload = "{gameId}|{score}|{runSeed}"
```

Ví dụ: `puzzle-quest|1500|run-abc-123`

### Hash

```
replayHash = HMAC-SHA256(replaySecret, payload).hex()
```

### TypeScript Example

```typescript
import { createHmac } from 'node:crypto';

export function computeReplayHash(
  replaySecret: string,
  gameId: string,
  score: number,
  runSeed: string,
): string {
  const payload = `${gameId}|${score}|${runSeed}`;
  return createHmac('sha256', replaySecret).update(payload).digest('hex');
}
```

### Request Body

```json
{
  "results": [
    {
      "score": 1500,
      "replayHash": "a3f2c1b9...",
      "playedAt": "2026-06-27T10:00:00.000Z",
      "metadata": {
        "runSeed": "run-abc-123",
        "level": 5
      }
    }
  ]
}
```

---

## Server Validation Order

1. `replayHash` format (64-char hex)
2. `playedAt` skew (nếu có)
3. `score ≤ maxScore`
4. HMAC verify (nếu `replaySecret` configured)
5. Duplicate / score mismatch (`game_replay_keys`)

---

## Rejection Reasons

| Reason | Cause |
|--------|-------|
| `MISSING_RUN_SEED` | Thiếu `metadata.runSeed` khi game có `replaySecret` |
| `INVALID_REPLAY_SIGNATURE` | HMAC không khớp |
| `INVALID_REPLAY_HASH_FORMAT` | Không phải 64-char hex |
| `SCORE_EXCEEDS_MAX` | Vượt `maxScore` |
| `PLAYED_AT_IN_FUTURE` | `playedAt` quá xa tương lai |
| `PLAYED_AT_TOO_OLD` | `playedAt` quá cũ |

---

## Offline Queue Notes

- `runSeed` phải **cố định per local play** — regenerate khi retry cùng lượt chơi.
- `replayHash` thay đổi nếu đổi `score` hoặc `runSeed`.
- Client flush queue theo thứ tự; server trả `results[]` per-item để client biết item nào drop / retry.

---

## Security Notes

- `replaySecret` nên obfuscate trong client build (không plaintext trong repo game).
- Rotate secret khi game update major: set secret mới trong DB, ship client mới.
- Dev games có thể tạm bỏ `replaySecret` để test nhanh — **không dùng production**.
