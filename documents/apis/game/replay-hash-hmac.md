# Replay Hash HMAC Scheme

## Overview

Mỗi game có `replaySecret` trong `games.config`. Client dùng secret này (obfuscate trong SDK) để tạo `replayHash` — server verify HMAC trước khi chấp nhận score.

**Mục tiêu:** idempotency, duplicate detection, và ngăn score injection đơn giản (chỉnh request / random hash) cho game casual offline-first.

**Không thay thế:** server-side gameplay simulation, device attestation, hoặc anti-cheat hoàn chỉnh. Vì secret nằm trong client build, attacker có thể extract và ký score hợp lệ.

---

## Game Config

```json
{
  "replaySecret": "your-per-game-secret",
  "anomalyMode": "log"
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `replaySecret` | — | Bắt buộc cho production; nếu thiếu, server chỉ validate format hash |
| `anomalyMode` | `log` | `log` chỉ ghi nhận anomaly; `reject` từ chối `minDurationMs` / `maxScorePerMinute` |

Seed dev:

- `puzzle-quest` → `replaySecret: puzzle-quest-dev-secret`
- `arcade-rush` → `replaySecret: arcade-rush-dev-secret`

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
2. `playedAt` parse (nếu có)
3. HMAC verify (nếu `replaySecret` configured)
4. Anomaly policy nếu `anomalyMode = "reject"`
5. Duplicate / score mismatch (`game_results`)

---

## Rejection Reasons

| Reason | Cause |
|--------|-------|
| `MISSING_RUN_SEED` | Thiếu `metadata.runSeed` khi game có `replaySecret` |
| `INVALID_REPLAY_SIGNATURE` | HMAC không khớp |
| `MISSING_REPLAY_HASH` | `replayHash` rỗng |
| `INVALID_REPLAY_HASH_FORMAT` | Không phải 64-char hex |
| `SCORE_MISMATCH` | Cùng guest retry cùng hash nhưng score khác |
| `DUPLICATE_REPLAY` | Hash đã thuộc guest khác |
| `INVALID_PLAYED_AT` | `playedAt` không parse được |
| `MIN_DURATION` | Duration thấp hơn `minDurationMs` khi `anomalyMode = "reject"` |
| `SCORE_RATE` | Score/minute vượt `maxScorePerMinute` khi `anomalyMode = "reject"` |

---

## Offline Queue Notes

- `runSeed` phải **cố định per local play** — regenerate khi retry cùng lượt chơi.
- `replayHash` thay đổi nếu đổi `score` hoặc `runSeed`.
- Client flush queue theo thứ tự; server trả `results[]` per-item để client biết item nào drop / retry.
- Dedup hiện tra trực tiếp từ `game_results(gameId, replayHash)`, vì các partition yearly không bị xóa tự động.

---

## Security Notes

- `replaySecret` nên obfuscate trong client build (không plaintext trong repo game), nhưng obfuscation không làm secret trở thành an toàn tuyệt đối.
- Rotate secret khi game update major: set secret mới trong DB, ship client mới.
- Dev games có thể tạm bỏ `replaySecret` để test nhanh — **không dùng production**.
- Nếu leaderboard có giá trị cạnh tranh, bật thêm server-side risk policy hoặc anti-cheat thật; HMAC client-side không đủ.
