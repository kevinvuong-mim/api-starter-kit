# Update Guest Name API Documentation

## Overview

API cập nhật tên hiển thị (display name) cho guest player. Tên này xuất hiện trên bảng xếp hạng khi guest có trong top rankings. Endpoint yêu cầu `sessionToken` để xác thực quyền sở hữu guest.

**Base URL**: `/api/guest`

---

## Endpoint

### Update Guest Display Name (Cập nhật tên hiển thị)

Đặt hoặc thay đổi tên hiển thị của guest đang đăng nhập.

**Endpoint**: `PATCH /api/guest/name`

**Authentication**: Yêu cầu session token

**Rate Limit**: 100 requests / phút / IP

#### Headers

```
Content-Type: application/json
Authorization: Bearer <sessionToken>
```

#### Request Body

```json
{
  "name": "PlayerOne"
}
```

#### Request Fields

| Field | Type   | Required | Validation                          | Description                    |
| ----- | ------ | -------- | ----------------------------------- | ------------------------------ |
| name  | string | Yes      | Min: 1, Max: 20 characters, trimmed | Tên hiển thị trên leaderboard  |

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

- **401 Unauthorized**: Thiếu hoặc sai session token

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Session token required",
  "error": "Unauthorized",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid session token",
  "error": "Unauthorized",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

- **404 Not Found**: Guest không tồn tại (token hợp lệ nhưng guest đã bị xóa)

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
  -H "Authorization: Bearer 7c9e6679-7425-40de-944b-e07fc1f90ae7" \
  -d '{
    "name": "PlayerOne"
  }'
```

---

## Validation Rules

### Authentication

- Header `Authorization: Bearer <sessionToken>` là bắt buộc
- `sessionToken` lấy từ response của `POST /api/guest/init`
- Guest được xác định từ token — **không** truyền `guestId` trong body

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

1. **Authenticate**: `GuestAuthGuard` đọc `Authorization` header, resolve guest từ `sessionToken`
2. **Validate guest**: `GuestService.getGuestOrThrow(guestId)` — throw 404 nếu không tồn tại
3. **Update name**: `GuestRepository.updateName(guestId, name)` cập nhật bảng `guest_players`
4. **Return profile**: Trả về `{ guestId, name }`
5. **Auto-wrap response**: Response được wrap bởi `ResponseInterceptor`

**Important Notes**:

- Endpoint **ghi đè** tên cũ — không append hay merge
- Tên không unique — nhiều guest có thể dùng cùng tên hiển thị
- Thay đổi tên có hiệu lực ngay trên leaderboard (resolve từ database khi query)
- Chỉ guest sở hữu `sessionToken` mới có thể đổi tên

---

## Related Endpoints

- [Init Guest](./init-guest.md) — Tạo guest player mới và lấy `sessionToken`
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

### Problem: "Invalid session token" hoặc "Session token required"

**Cause**: Thiếu header `Authorization`, token sai, hoặc guest đã bị xóa.

**Solution**:

- Kiểm tra header format: `Authorization: Bearer <sessionToken>`
- Gọi `POST /api/guest/init` để tạo guest mới nếu mất token
- Đảm bảo token được lưu trong secure storage

---

## Notes

- **Authenticated endpoint**: Yêu cầu `sessionToken` — không thể đổi tên guest khác chỉ bằng `guestId`
- **Trim whitespace**: Khoảng trắng đầu/cuối tự động bị loại bỏ
- **Response trả về profile**: API trả về data đã cập nhật
- **Leaderboard display**: Nếu guest chưa set tên, leaderboard hiển thị `name: null`
