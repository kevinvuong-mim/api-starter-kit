# Global Leaderboard API Documentation

## Overview

API lấy bảng xếp hạng toàn cục (all-time) theo game. Dữ liệu ranking lấy từ Redis sorted set, tên guest resolve từ PostgreSQL. Hỗ trợ xem top N và rank của guest hiện tại (kể cả khi nằm ngoài top).

**Base URL**: `/api/leaderboard`

---

## Endpoint

### Get Global Leaderboard (Bảng xếp hạng toàn cục)

Lấy danh sách top players và (tuỳ chọn) rank của guest cụ thể.

**Endpoint**: `GET /api/leaderboard/global`

**Authentication**: Không yêu cầu (Public)

**Rate Limit**: 100 requests / phút / IP

#### Query Parameters

| Parameter | Type   | Required | Default | Validation              | Description                              |
| --------- | ------ | -------- | ------- | ----------------------- | ---------------------------------------- |
| gameId    | string | Yes      | —       | Game phải tồn tại, active | ID của game                            |
| limit     | number | No       | 100     | Min: 1, Max: 100        | Số lượng entries trả về (top N)          |
| guestId   | string | No       | —       | UUID format             | Guest ID để lấy `myRank`                 |
| page      | number | No       | 1       | Min: 1                  | *(Hiện chưa dùng — luôn trả top từ đầu)* |

**Lưu ý**: `page` có trong DTO nhưng service hiện tại luôn trả top từ rank 1 với `offset = 0`.

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
      },
      {
        "rank": 2,
        "guestId": "660e8400-e29b-41d4-a716-446655440001",
        "name": null,
        "score": 4800
      }
    ],
    "myRank": 123
  },
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/leaderboard/global?gameId=puzzle-quest&guestId=550e8400-e29b-41d4-a716-446655440000"
}
```

#### Response Schema

| Field              | Type         | Description                                           |
| ------------------ | ------------ | ----------------------------------------------------- |
| top                | array        | Danh sách top players                                 |
| top[].rank         | number       | Thứ hạng (1-based)                                    |
| top[].guestId      | string       | UUID của guest                                        |
| top[].name         | string\|null | Tên hiển thị (null nếu guest chưa set name)          |
| top[].score        | number       | Best score (all-time)                                 |
| myRank             | number\|null | Rank của guest (chỉ khi truyền `guestId`)             |

**myRank behavior**:

- Không truyền `guestId` → `myRank: null`
- Guest trong top → `myRank` = rank trong `top` array
- Guest ngoài top → query Redis `ZREVRANK` để lấy rank thực
- Guest chưa có điểm → `myRank: null`

**Error Responses**

- **400 Bad Request**: Validation error hoặc game không active

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "gameId",
      "constraint": "isString",
      "message": "gameId must be a string",
      "value": null
    }
  ],
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/leaderboard/global"
}
```

- **404 Not Found**: Game không tồn tại

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Game \"unknown-game\" not found",
  "error": "Not Found",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/leaderboard/global?gameId=unknown-game"
}
```

- **429 Too Many Requests**: Vượt quá rate limit

#### cURL Examples

**Lấy top 100 (mặc định):**

```bash
curl "http://localhost:3000/api/leaderboard/global?gameId=puzzle-quest"
```

**Lấy top 50 kèm rank của guest:**

```bash
curl "http://localhost:3000/api/leaderboard/global?gameId=puzzle-quest&guestId=550e8400-e29b-41d4-a716-446655440000&limit=50"
```

---

## Business Logic

1. **Validate game**: `GameRegistryService.assertActiveGame(gameId)`
2. **Fetch top from Redis**: `ZREVRANGE` trên key `lb:global:{gameId}`, limit tối đa 100
3. **Resolve names**: Batch query `guest_players` cho các `guestId` trong top
4. **Resolve myRank** (nếu có `guestId`):
   - Tìm trong top array trước
   - Nếu không có → `RedisRankingService.getPlayerRank()`
5. **Return**: `{ top, myRank }`

### Data Sources

| Data        | Source     | Key/Table                    |
| ----------- | ---------- | ---------------------------- |
| Rankings    | Redis      | `lb:global:{gameId}`         |
| Guest names | PostgreSQL | `guest_players`              |
| Best scores | PostgreSQL | `leaderboard` (source of truth) |

### Background Sync

Cron job chạy hàng ngày lúc 03:00 rebuild Redis từ PostgreSQL cho mọi active game. Đảm bảo Redis và DB đồng bộ nếu có drift.

---

## Use Cases

### Use Case 1: Hiển thị leaderboard screen

**Scenario**: User mở màn hình xếp hạng trong game.

**Steps**:

1. Gọi `GET /api/leaderboard/global?gameId=xxx&limit=100`
2. Render `top` array với rank, name, score
3. Hiển thị `name` fallback (ví dụ "Anonymous") khi `name` là null

### Use Case 2: Hiển thị rank cá nhân

**Scenario**: User muốn biết mình đứng thứ mấy dù không trong top 100.

**Steps**:

1. Gọi API kèm `guestId` của user
2. Dùng `myRank` để hiển thị (ví dụ "Your rank: #123")
3. Nếu `myRank` null → user chưa có điểm trên leaderboard

---

## Related Endpoints

- [Sync Game Results](../game/sync-game-results.md) — Upload kết quả để lên bảng xếp hạng
- [Update Guest Name](../guest/update-guest-name.md) — Đặt tên hiển thị trên leaderboard
- [Init Guest](../guest/init-guest.md) — Tạo guest player

---

## Troubleshooting

### Problem: Leaderboard trống

**Cause**:

- Chưa có ai sync kết quả cho game này
- Redis chưa được populate (game mới)

**Solution**:

- Sync ít nhất một kết quả qua `POST /api/game/sync`
- Đợi cron rebuild (03:00) hoặc trigger manual nếu cần

### Problem: `myRank` null dù đã sync

**Cause**:

- `guestId` sai hoặc chưa truyền
- Score chưa đủ để vào leaderboard (unlikely — mọi score đều được lưu)
- Guest chưa sync thành công (tất cả results rejected)

**Solution**:

- Kiểm tra response từ sync (`accepted > 0`)
- Verify `guestId` đúng UUID
- Đảm bảo truyền `guestId` trong query string

### Problem: Rank không khớp sau sync

**Cause**: Redis và PostgreSQL tạm thời out of sync (hiếm).

**Solution**:

- Leaderboard update realtime qua `ZADD` khi sync
- Cron job rebuild hàng ngày để đồng bộ
- Refresh sau vài giây nếu cần

---

## Notes

- **Read-only endpoint**: Chỉ GET, không modify data
- **Max limit**: 100 entries — values > 100 bị cap
- **Per-game leaderboard**: Mỗi `gameId` có Redis key riêng
- **All-time rankings**: Không có weekly/monthly reset
- **Name resolution**: Realtime từ DB — đổi tên có hiệu lực ngay
- **No pagination**: Hiện chỉ hỗ trợ top N từ đầu bảng (không offset/page)
- **Redis key format**: `lb:global:{gameId}`
