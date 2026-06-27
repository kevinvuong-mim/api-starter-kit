# Leaderboard API Documentation

## Overview

API lấy bảng xếp hạng all-time theo game. Ranking đọc từ Redis sorted set; nếu Redis trống thì **fallback PostgreSQL** và tự warm lại cache. Tên guest resolve từ database. Hỗ trợ pagination và `myRank` qua optional Bearer token.

**Base URL**: `/api/leaderboards`

---

## Endpoint

### Get Leaderboard

**Endpoint**: `GET /api/leaderboards`

**Authentication**: Optional session token (cần để lấy `myRank`)

**Rate Limit**: 100 requests / phút / IP

#### Query Parameters

| Parameter | Type   | Required | Default | Validation              | Description              |
| --------- | ------ | -------- | ------- | ----------------------- | ------------------------ |
| gameId    | string | Yes      | —       | Game tồn tại, active    | ID của game              |
| page      | number | No       | 1       | Min: 1                  | Trang (1-based)          |
| limit     | number | No       | 100     | Min: 1, Max: 100        | Số entries mỗi trang     |

#### Headers (optional)

```
Authorization: Bearer <sessionToken>
```

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "top": [
      {
        "rank": 1,
        "guestId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "PlayerOne",
        "score": 5000
      }
    ],
    "myRank": 123,
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 250,
      "totalPages": 3
    }
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/leaderboards?gameId=puzzle-quest&page=1&limit=100"
}
```

#### Response Schema

| Field                 | Type         | Description                                    |
| --------------------- | ------------ | ---------------------------------------------- |
| top[].rank            | number       | Thứ hạng toàn cục (1-based)                    |
| top[].guestId         | string       | UUID guest                                     |
| top[].name            | string\|null | Tên hiển thị                                   |
| top[].score           | number       | Best score all-time                            |
| myRank                | number\|null | Rank guest (khi có valid Bearer token)         |
| pagination            | object       | `page`, `limit`, `total`, `totalPages`         |

**myRank behavior**:

- Không có `Authorization` → `myRank: null`
- Guest trong `top` → rank từ array
- Guest ngoài top → `LeaderboardCacheService.getPlayerRank()` (Redis hoặc PG fallback)
- Token invalid/expired → bỏ qua silently (`OptionalGuestAuthGuard`)

#### cURL Examples

```bash
curl "http://localhost:3000/api/leaderboards?gameId=puzzle-quest"

curl "http://localhost:3000/api/leaderboards?gameId=puzzle-quest&page=2&limit=50" \
  -H "Authorization: Bearer 7c9e6679-7425-40de-944b-e07fc1f90ae7"
```

---

## Business Logic

1. `GameRegistryService.assertActiveGame(gameId)`.
2. `LeaderboardCacheService.getRankings()`:
   - Redis có data → đọc `ZREVRANGE` + `ZCARD`.
   - Redis trống → đọc bảng `leaderboard` (PostgreSQL), warm lại Redis.
3. Batch resolve guest names từ `guest_players`.
4. Resolve `myRank` nếu có guest từ token.

### Data Sources

| Data        | Primary Source | Fallback / Notes              |
| ----------- | -------------- | ----------------------------- |
| Rankings    | Redis          | PostgreSQL `leaderboard`      |
| Guest names | PostgreSQL     | Realtime mỗi request          |
| Best scores | PostgreSQL     | Source of truth               |

### Cache Warm

- **On boot**: `LeaderboardCacheService.onModuleInit()` warm tất cả active games.
- **Daily cron** (03:00): `LeaderboardMaintenanceService` gọi lại `warmAll()`.

---

## Related Endpoints

- [Sync Game Results](../game/sync-game-results.md)
- [Update Guest Name](../guest/update-guest-name.md)
- [Init Guest](../guest/init-guest.md)

---

## Troubleshooting

### Problem: Leaderboard trống dù đã sync

**Cause**: Redis restart trước khi có warm; chưa ai sync.

**Solution**: Gọi lại API (tự fallback PG + warm); hoặc đợi app restart / cron 03:00.

### Problem: `myRank` null

**Cause**: Không gửi token, token hết hạn, hoặc guest chưa có điểm.

**Solution**: Gửi valid Bearer token; kiểm tra sync `accepted > 0`.

---

## Notes

- Read-only endpoint
- Max `limit`: 100
- Redis key: `lb:global:{gameId}`
- Tie score: Redis sort lexicographic theo `guestId`
