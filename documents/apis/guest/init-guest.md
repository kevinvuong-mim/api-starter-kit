# Init Guest API Documentation

## Overview

API khởi tạo guest player (người chơi ẩn danh). Guest dùng chung cho tất cả game, không cần đăng nhập. Client persist `installId`; backend đảm bảo cùng một `installId` luôn trả về cùng một `guestId`.

**Base URL**: `/api/guest`

---

## Endpoint

### Initialize Guest (Khởi tạo / re-link guest player)

Tạo guest mới hoặc trả lại guest đã gắn với `installId`.

**Endpoint**: `POST /api/guest/init`

**Authentication**: Không yêu cầu (Public)

**Rate Limit**: 10 requests / phút / IP

#### Headers

```
Content-Type: application/json
```

#### Request Body

**Tạo guest mới với installId:**

```json
{
  "installId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field     | Type   | Required | Validation      | Description                                      |
| --------- | ------ | -------- | --------------- | ------------------------------------------------ |
| installId | string | No       | UUID (36 ký tự) | ID cài đặt do client generate và persist locally |

- Không gửi body hoặc `{}` → tạo guest **mới** (không gắn `installId`, không relink được).
- Gửi `installId` mới → tạo guest mới (`relinked: false`).
- Gửi `installId` đã tồn tại → trả lại guest cũ (`relinked: true`).

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "relinked": false
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/guest/init"
}
```

#### Response Schema

| Field         | Type    | Description                              |
| ------------- | ------- | ---------------------------------------- |
| data.guestId  | string  | UUID của guest player                    |
| data.relinked | boolean | `true` nếu install đã có guest từ trước |

**Important Notes**:

- API không xác thực secret/token; client dùng `guestId` do API trả về cho các request cần định danh guest.
- Để giữ “một cài đặt app = một guest”, client phải persist và gửi lại cùng `installId`.

**Error Responses**

- **400 Bad Request**: UUID format sai
- **429 Too Many Requests**: Vượt rate limit (10/min/IP)

---

## Business Logic

1. `installId` tồn tại → trả guest tương ứng (`relinked: true`).
2. `installId` mới → tạo guest mới (`relinked: false`).
3. Không `installId` → tạo guest mới không gắn install.

---

## Related Endpoints

- [Get Guest Profile](./get-guest-me.md)
- [Replay Hash HMAC](../game/replay-hash-hmac.md)
- [Sync Game Results](../game/sync-game-results.md)
