# Init Guest API Documentation

## Overview

API khởi tạo guest player (người chơi ẩn danh) mới. Guest được dùng chung cho tất cả game trong hệ thống, không cần đăng nhập. Client lưu `guestId` (UUID) và `sessionToken` để gửi kèm các request sau.

**Base URL**: `/api/guest`

---

## Endpoint

### Initialize Guest (Khởi tạo guest player)

Tạo một guest player mới trong database và trả về `guestId` cùng `sessionToken`.

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
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionToken": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  },
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/guest/init"
}
```

#### Response Schema

| Field              | Type   | Description                                              |
| ------------------ | ------ | -------------------------------------------------------- |
| data.guestId       | string | UUID của guest player vừa tạo                            |
| data.sessionToken  | string | Session token dùng cho các request cần xác thực guest    |

**Important Notes**:

- `guestId` là UUID v4, được generate tự động bởi database
- `sessionToken` là UUID v4, unique — dùng làm credential xác thực guest
- Guest mới chưa có display name (`name = null`)
- Một guest có thể chơi nhiều game khác nhau với cùng `guestId`
- Client nên lưu **cả** `guestId` và `sessionToken` vào secure storage trên thiết bị
- `sessionToken` không nên expose công khai — chỉ gửi qua header `Authorization: Bearer <token>`

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

1. **Create guest**: `GuestRepository.create()` tạo record mới trong bảng `guest_players` kèm `sessionToken`
2. **Return credentials**: Trả về `{ guestId, sessionToken }`
3. **Auto-wrap response**: Response được wrap trong standard format bởi `ResponseInterceptor`

---

## Use Cases

- Lần đầu mở app game, chưa có guest ID
- User xóa app data và cần tạo guest mới
- Tạo guest mới sau khi user chọn "Play as new player"

---

## Related Endpoints

- **PATCH /api/guest/name**: Đặt tên hiển thị cho guest (yêu cầu `sessionToken`)
- **POST /api/game/sync**: Đồng bộ kết quả game (yêu cầu `sessionToken`)
- **GET /api/leaderboard/global**: Xem bảng xếp hạng (truyền `sessionToken` optional để lấy `myRank`)

---

## Troubleshooting

### Problem: Mất `guestId` / `sessionToken` sau khi cài lại app

**Cause**: Credentials chỉ được lưu trên client, không có cơ chế khôi phục từ server.

**Solution**:

- Gọi lại `POST /api/guest/init` để tạo guest mới
- Lưu `guestId` và `sessionToken` vào persistent storage (Keychain, SharedPreferences, localStorage)

### Problem: Guest cũ không tồn tại khi sync game

**Cause**: Guest đã bị xóa khỏi database hoặc `sessionToken` không hợp lệ.

**Solution**:

- Tạo guest mới qua `POST /api/guest/init`
- Cập nhật credentials trên client

---

## Notes

- **Idempotent**: Mỗi lần gọi tạo một guest **mới** — không reuse guest cũ
- **No login required**: Không cần JWT hay OAuth — chỉ cần `sessionToken` từ init
- **Shared across games**: Cùng một guest dùng cho mọi game trong hệ thống
- **Optional display name**: Tên hiển thị được set riêng qua `PATCH /api/guest/name`
