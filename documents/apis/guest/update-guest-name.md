# Update Guest Name API Documentation

## Overview

API cập nhật tên hiển thị (display name) cho guest player. Tên này xuất hiện trên bảng xếp hạng khi guest có trong top rankings.

**Base URL**: `/api/guest`

---

## Endpoint

### Update Guest Display Name (Cập nhật tên hiển thị)

Đặt hoặc thay đổi tên hiển thị của guest.

**Endpoint**: `PATCH /api/guest/name`

**Authentication**: Không yêu cầu (Public)

**Rate Limit**: 100 requests / phút / IP

#### Headers

```
Content-Type: application/json
```

#### Request Body

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "PlayerOne"
}
```

#### Request Fields

| Field     | Type   | Required | Validation                          | Description                    |
| --------- | ------ | -------- | ----------------------------------- | ------------------------------ |
| guestId   | string | Yes      | UUID format                         | ID của guest cần cập nhật      |
| name      | string | Yes      | Min: 1, Max: 20 characters, trimmed | Tên hiển thị trên leaderboard  |

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource updated successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerOne"
  },
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

#### Response Schema

| Field          | Type         | Description                              |
| -------------- | ------------ | ---------------------------------------- |
| data.guestId   | string       | UUID của guest                           |
| data.name      | string       | Tên hiển thị vừa cập nhật                |

**Error Responses**

- **400 Bad Request**: Validation error

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "guestId",
      "constraint": "isUuid",
      "message": "guestId must be a UUID",
      "value": "invalid-id"
    },
    {
      "field": "name",
      "constraint": "maxLength",
      "message": "name must be shorter than or equal to 20 characters",
      "value": "ThisNameIsWayTooLongForTheLimit"
    }
  ],
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

- **404 Not Found**: Guest không tồn tại

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Guest player not found",
  "error": "Not Found",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

- **429 Too Many Requests**: Vượt quá rate limit

```json
{
  "success": false,
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

#### cURL Example

```bash
curl -X PATCH http://localhost:3000/api/guest/name \
  -H "Content-Type: application/json" \
  -d '{
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerOne"
  }'
```

---

## Validation Rules

### guestId

- Bắt buộc phải là UUID hợp lệ
- Guest phải tồn tại trong database

### name

- Độ dài: 1–20 ký tự (sau khi trim whitespace)
- Chuỗi rỗng hoặc chỉ khoảng trắng sẽ bị reject
- Không có ràng buộc ký tự đặc biệt (Unicode được chấp nhận)
- Ví dụ hợp lệ: `PlayerOne`, `Người chơi 1`, `Pro_Gamer`
- Ví dụ không hợp lệ:
  - `""` (rỗng)
  - `"   "` (chỉ khoảng trắng, sau trim thành rỗng)
  - Chuỗi dài hơn 20 ký tự

---

## Business Logic

1. **Validate guest**: `GuestService.getGuestOrThrow(guestId)` — throw 404 nếu không tồn tại
2. **Update name**: `GuestRepository.updateName(guestId, name)` cập nhật bảng `guest_players`
3. **Return profile**: Trả về `{ guestId, name }`
4. **Auto-wrap response**: Response được wrap bởi `ResponseInterceptor`

**Important Notes**:

- Endpoint **ghi đè** tên cũ — không append hay merge
- Tên không unique — nhiều guest có thể dùng cùng tên hiển thị
- Thay đổi tên có hiệu lực ngay trên leaderboard (resolve từ database khi query)

---

## Related Endpoints

- [Init Guest](./init-guest.md) — Tạo guest player mới
- [Global Leaderboard](../leaderboard/global-leaderboard.md) — Xem tên trên bảng xếp hạng
- **POST /api/game/sync**: Đồng bộ kết quả game

---

## Troubleshooting

### Problem: Tên không hiển thị trên leaderboard

**Cause**:

- Guest chưa có trong top rankings
- Leaderboard cache chưa refresh (hiếm — tên resolve từ DB mỗi request)

**Solution**:

- Đảm bảo guest đã sync ít nhất một kết quả game
- Kiểm tra guest có trong `top` array hoặc có `myRank`

### Problem: "Guest player not found"

**Cause**: `guestId` không tồn tại hoặc đã bị xóa.

**Solution**:

- Gọi `POST /api/guest/init` để tạo guest mới
- Kiểm tra `guestId` lưu trên client có đúng format UUID

---

## Notes

- **Public endpoint**: Không cần authentication — bất kỳ ai biết `guestId` đều có thể đổi tên
- **Trim whitespace**: Khoảng trắng đầu/cuối tự động bị loại bỏ
- **Response trả về profile**: Khác với một số update endpoint khác, API này trả về data đã cập nhật
- **Leaderboard display**: Nếu guest chưa set tên, leaderboard hiển thị `name: null`
