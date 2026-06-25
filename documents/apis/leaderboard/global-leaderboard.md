# Global Leaderboard API Documentation

## Overview

API lấy bảng xếp hạng toàn cục (all-time) theo game. Dữ liệu ranking lấy từ Redis sorted set, tên guest resolve từ PostgreSQL. Hỗ trợ pagination, xem top N và rank của guest hiện tại (kể cả khi nằm ngoài top).

**Base URL**: `/api/leaderboard`

---

## Endpoint

### Get Global Leaderboard (Bảng xếp hạng toàn cục)

Lấy danh sách top players theo trang và (tuỳ chọn) rank của guest đang đăng nhập.

**Endpoint**: `GET /api/leaderboard/global`

**Authentication**: Optional session token (cần để lấy `myRank`)

**Rate Limit**: 100 requests / phút / IP

#### Query Parameters

| Parameter | Type   | Required | Default | Validation              | Description                              |
| --------- | ------ | -------- | ------- | ----------------------- | ---------------------------------------- |
| gameId    | string | Yes      | —       | Game phải tồn tại, active | ID của game                            |
| page      | number | No       | 1       | Min: 1                  | Trang hiện tại (1-based)                 |
| limit     | number | No       | 100     | Min: 1, Max: 100        | Số entries mỗi trang                     |

#### Headers (optional)

```
Authorization: Bearer <sessionToken>
```

Truyền `sessionToken` để server trả về `myRank` của guest tương ứng. Không truyền header → `myRank: null`.

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
    "myRank": 123,
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 250,
      "totalPages": 3
    }
  },
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/leaderboard/global?gameId=puzzle-quest&page=1&limit=100"
}
```

#### Response Schema

| Field                    | Type         | Description                                           |
| ------------------------ | ------------ | ----------------------------------------------------- |
| top                      | array        | Danh sách players trên trang hiện tại                 |
| top[].rank               | number       | Thứ hạng toàn cục (1-based, tính theo offset)         |
| top[].guestId            | string       | UUID của guest                                        |
| top[].name               | string\|null | Tên hiển thị (null nếu guest chưa set name)          |
| top[].score              | number       | Best score (all-time)                                 |
| myRank                   | number\|null | Rank của guest (chỉ khi truyền `sessionToken`)        |
| pagination.page          | number       | Trang hiện tại                                        |
| pagination.limit         | number       | Số entries mỗi trang                                  |
| pagination.total         | number       | Tổng số players trên leaderboard                      |
| pagination.totalPages    | number       | Tổng số trang (`ceil(total / limit)`)               |

**myRank behavior**:

- Không truyền `Authorization` header → `myRank: null`
- Guest trong `top` array → `myRank` = rank trong `top`
- Guest ngoài top → query Redis `ZREVRANK` để lấy rank thực
- Guest chưa có điểm → `myRank: null`
- Token không hợp lệ → bỏ qua silently, `myRank: null` (optional auth)

**Pagination behavior**:

- `offset = (page - 1) * limit`
- `rank` trong `top` array phản ánh thứ hạng toàn cục (ví dụ page 2, limit 50 → rank bắt đầu từ 51)
- `total` lấy từ Redis `ZCARD`
- `totalPages = 0` khi leaderboard trống

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

**Lấy trang 1 (mặc định, top 100):**

```bash
curl "http://localhost:3000/api/leaderboard/global?gameId=puzzle-quest"
```

**Lấy trang 2, 50 entries mỗi trang:**

```bash
curl "http://localhost:3000/api/leaderboard/global?gameId=puzzle-quest&page=2&limit=50"
```

**Lấy top 50 kèm rank của guest (qua session token):**

```bash
curl "http://localhost:3000/api/leaderboard/global?gameId=puzzle-quest&limit=50" \
  -H "Authorization: Bearer 7c9e6679-7425-40de-944b-e07fc1f90ae7"
```

---

## Business Logic

1. **Validate game**: `GameRegistryService.assertActiveGame(gameId)`
2. **Resolve guest** (optional): `OptionalGuestAuthGuard` đọc `sessionToken` từ header
3. **Calculate pagination**: `offset = (page - 1) * limit`
4. **Fetch top from Redis**: `ZREVRANGE` trên key `lb:global:{gameId}` với offset/limit
5. **Fetch total**: `ZCARD` trên cùng key
6. **Resolve names**: Batch query `guest_players` cho các `guestId` trong top
7. **Resolve myRank** (nếu có guest từ token):
   - Tìm trong top array trước
   - Nếu không có → `RedisRankingService.getPlayerRank()`
8. **Return**: `{ top, myRank, pagination }`

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

1. Gọi `GET /api/leaderboard/global?gameId=xxx&page=1&limit=100`
2. Render `top` array với rank, name, score
3. Dùng `pagination` để hiển thị page controls
4. Hiển thị `name` fallback (ví dụ "Anonymous") khi `name` là null

### Use Case 2: Hiển thị rank cá nhân

**Scenario**: User muốn biết mình đứng thứ mấy dù không trong top 100.

**Steps**:

1. Gọi API kèm header `Authorization: Bearer <sessionToken>`
2. Dùng `myRank` để hiển thị (ví dụ "Your rank: #123")
3. Nếu `myRank` null → user chưa có điểm trên leaderboard

### Use Case 3: Phân trang leaderboard lớn

**Scenario**: Leaderboard có hàng trăm players, cần load từng trang.

**Steps**:

1. Gọi page 1: `?gameId=xxx&page=1&limit=50`
2. Dùng `pagination.totalPages` để biết tổng số trang
3. Load trang tiếp theo: `?gameId=xxx&page=2&limit=50`

---

## Related Endpoints

- [Sync Game Results](../game/sync-game-results.md) — Upload kết quả để lên bảng xếp hạng
- [Update Guest Name](../guest/update-guest-name.md) — Đặt tên hiển thị trên leaderboard
- [Init Guest](../guest/init-guest.md) — Tạo guest player và lấy `sessionToken`

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

- Không truyền `Authorization` header
- `sessionToken` sai hoặc guest đã bị xóa
- Guest chưa sync thành công (tất cả results rejected)

**Solution**:

- Thêm header `Authorization: Bearer <sessionToken>`
- Kiểm tra response từ sync (`accepted > 0`)
- Lấy token mới từ `POST /api/guest/init` nếu cần

### Problem: Rank không khớp sau sync

**Cause**: Redis và PostgreSQL tạm thời out of sync (hiếm).

**Solution**:

- Leaderboard update realtime qua Lua script khi sync
- Cron job rebuild hàng ngày để đồng bộ
- Refresh sau vài giây nếu cần

### Problem: Trang trống dù `total > 0`

**Cause**: `page` vượt quá `totalPages`.

**Solution**:

- Kiểm tra `pagination.totalPages` trước khi request
- Clamp `page` về giá trị hợp lệ trên client

---

## Notes

- **Read-only endpoint**: Chỉ GET, không modify data
- **Max limit**: 100 entries mỗi trang — values > 100 bị cap
- **Per-game leaderboard**: Mỗi `gameId` có Redis key riêng
- **All-time rankings**: Không có weekly/monthly reset
- **Name resolution**: Realtime từ DB — đổi tên có hiệu lực ngay
- **Pagination**: Hỗ trợ `page` + `limit` với metadata `total` / `totalPages`
- **Optional auth**: `sessionToken` qua header, không qua query string
- **Redis key format**: `lb:global:{gameId}`
