# Init Guest API Documentation

## Overview

API khởi tạo guest player (người chơi ẩn danh) mới. Guest được dùng chung cho tất cả game trong hệ thống, không cần đăng nhập. Client lưu `guestId` (UUID) để gửi kèm các request sau.

**Base URL**: `/api/guest`

---

## Endpoint

### Initialize Guest (Khởi tạo guest player)

Tạo một guest player mới trong database và trả về `guestId`.

**Endpoint**: `POST /api/guest/init`

**Authentication**: Không yêu cầu (Public)

**Rate Limit**: 100 requests / phút / IP

#### Headers

```
Content-Type: application/json
```

#### Request Body

Không có request body.

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/init"
}
```

#### Response Schema

| Field          | Type   | Description                                    |
| -------------- | ------ | ---------------------------------------------- |
| data.guestId   | string | UUID của guest player vừa tạo                  |

**Important Notes**:

- `guestId` là UUID v4, được generate tự động bởi database
- Guest mới chưa có display name (`name = null`)
- Một guest có thể chơi nhiều game khác nhau với cùng `guestId`
- Client nên lưu `guestId` vào local storage / secure storage trên thiết bị

**Error Responses**

- **429 Too Many Requests**: Vượt quá rate limit

```json
{
  "success": false,
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/init"
}
```

- **500 Internal Server Error**: Lỗi database hoặc server

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/init"
}
```

#### cURL Example

```bash
curl -X POST http://localhost:3000/api/guest/init
```

---

## Business Logic

1. **Create guest**: `GuestRepository.create()` tạo record mới trong bảng `guest_players`
2. **Return ID**: Trả về `{ guestId: guest.id }`
3. **Auto-wrap response**: Response được wrap trong standard format bởi `ResponseInterceptor`

---

## Use Cases

- Lần đầu mở app game, chưa có guest ID
- User xóa app data và cần tạo guest mới
- Tạo guest mới sau khi user chọn "Play as new player"

---

## Related Endpoints

- **PATCH /api/guest/name**: Đặt tên hiển thị cho guest
- **POST /api/game/sync**: Đồng bộ kết quả game
- **GET /api/leaderboard/global**: Xem bảng xếp hạng (có thể truyền `guestId` để lấy `myRank`)

---

## Troubleshooting

### Problem: Mất `guestId` sau khi cài lại app

**Cause**: Guest ID chỉ được lưu trên client, không có cơ chế khôi phục từ server.

**Solution**:

- Gọi lại `POST /api/guest/init` để tạo guest mới
- Lưu `guestId` vào persistent storage (Keychain, SharedPreferences, localStorage)

### Problem: Guest cũ không tồn tại khi sync game

**Cause**: Guest đã bị xóa khỏi database hoặc `guestId` không hợp lệ.

**Solution**:

- Tạo guest mới qua `POST /api/guest/init`
- Cập nhật `guestId` trên client

---

## Notes

- **Idempotent**: Mỗi lần gọi tạo một guest **mới** — không reuse guest cũ
- **No authentication**: Không cần JWT hay session
- **Shared across games**: Cùng một `guestId` dùng cho mọi game trong hệ thống
- **Optional display name**: Tên hiển thị được set riêng qua `PATCH /api/guest/name`
