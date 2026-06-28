# Leaderboard API Documentation

## Overview

API lấy bảng xếp hạng all-time theo game. Ranking ưu tiên Redis sorted set, nhưng chỉ tin Redis khi số lượng entry khớp PostgreSQL; nếu Redis trống hoặc drift thì rebuild từ PostgreSQL rồi trả kết quả. Tên guest resolve từ database. Hỗ trợ pagination và `myRank` qua optional `guestId`.

**Base URL**: `/api/leaderboards`

---

## Endpoint

### Get Leaderboard

**Endpoint**: `GET /api/leaderboards`

**Authentication**: Không yêu cầu. Gửi optional `guestId` để lấy `myRank`.

**Rate Limit**: 100 requests / phút / IP

#### Query Parameters

| Parameter | Type   | Required | Default | Validation              | Description              |
| --------- | ------ | -------- | ------- | ----------------------- | ------------------------ |
| gameId    | string | Yes      | —       | Game tồn tại            | ID của game              |
| guestId   | string | No       | —       | UUID                    | Guest cần lấy `myRank`   |
| page      | number | No       | 1       | Min: 1                  | Trang (1-based)          |
| limit     | number | No       | 100     | Min: 1, Max: 100        | Số entries mỗi trang     |

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
| myRank                | number\|null | Rank guest (khi có `guestId`)                  |
| pagination            | object       | `page`, `limit`, `total`, `totalPages`         |

**myRank behavior**:

- Không có `guestId` → `myRank: null`
- Guest trong `top` → rank từ array
- Guest ngoài top → `LeaderboardCacheService.getPlayerRank()` (Redis hoặc PG fallback)
- `guestId` không tồn tại hoặc chưa có điểm → `myRank: null`

#### cURL Examples

```bash
curl "http://localhost:3000/api/leaderboards?gameId=puzzle-quest"

curl "http://localhost:3000/api/leaderboards?gameId=puzzle-quest&page=2&limit=50&guestId=550e8400-e29b-41d4-a716-446655440000"
```

---

## Business Logic

1. `GameRegistryService.assertGameExists(gameId)`.
2. `LeaderboardCacheService.getRankings()`:
   - Redis có data và `ZCARD` khớp count PostgreSQL → đọc `ZREVRANGE`.
   - Redis trống hoặc count lệch PostgreSQL → rebuild Redis từ bảng `leaderboard`, rồi đọc lại từ Redis.
   - PostgreSQL không có entry → trả leaderboard rỗng và xóa Redis key nếu cần.
3. Batch resolve guest names từ `guest_players`.
4. Resolve `myRank` nếu có `guestId`.

### Data Sources

| Data        | Primary Source | Fallback / Notes              |
| ----------- | -------------- | ----------------------------- |
| Rankings    | Redis          | PostgreSQL `leaderboard`      |
| Guest names | PostgreSQL     | Realtime mỗi request          |
| Best scores | PostgreSQL     | Source of truth               |

### Cache Warm

- **On boot**: `LeaderboardCacheService.onModuleInit()` warm tất cả games.
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

**Solution**: Gọi lại API để service rebuild Redis từ PostgreSQL; hoặc đợi app restart / cron 03:00.

### Problem: `myRank` null

**Cause**: Không gửi `guestId`, `guestId` không tồn tại, hoặc guest chưa có điểm.

**Solution**: Gửi `guestId` từ `/guest/init`; kiểm tra sync `accepted > 0`.

---

## Notes

- Read-only endpoint
- Max `limit`: 100
- Redis key: `lb:global:{gameId}`
- Tie score: score cao hơn đứng trước; nếu bằng score thì `guestId` nhỏ hơn đứng trước (được encode vào Redis ZSET score)
