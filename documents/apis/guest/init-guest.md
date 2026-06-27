# Init Guest API Documentation

## Overview

API khởi tạo hoặc **re-link** guest player (người chơi ẩn danh). Guest dùng chung cho tất cả game, không cần đăng nhập. Client lưu `guestId`, `sessionToken`, **`installId`**, và **`installSecret`** (persisted trên thiết bị) để khôi phục identity sau reinstall.

**Base URL**: `/api/guest`

---

## Endpoint

### Initialize Guest (Khởi tạo / re-link guest player)

Tạo guest mới hoặc re-link guest cũ qua `installId` + `installSecret`, rồi trả về credentials.

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

**Re-link guest sau reinstall:**

```json
{
  "installId": "550e8400-e29b-41d4-a716-446655440000",
  "installSecret": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

| Field         | Type   | Required | Validation        | Description                                      |
| ------------- | ------ | -------- | ----------------- | ------------------------------------------------ |
| installId     | string | No       | UUID v4 (36 ký tự) | ID cài đặt do client generate và persist locally |
| installSecret | string | Relink   | UUID v4           | Secret server trả về lúc tạo guest; bắt buộc khi re-link |

- Không gửi body hoặc `{}` → tạo guest **mới** (không gắn `installId`, không relink được).
- Gửi `installId` mới → tạo guest + trả `installSecret` **một lần**.
- Gửi `installId` đã tồn tại + `installSecret` đúng → **re-link**, rotate `sessionToken`.
- Gửi `installId` đã tồn tại **không có** `installSecret` → **401 Unauthorized**.

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionToken": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "sessionTokenExpiresAt": "2026-09-25T12:00:00.000Z",
    "relinked": false,
    "installSecret": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/guest/init"
}
```

#### Response Schema

| Field                      | Type    | Description                                                |
| -------------------------- | ------- | ---------------------------------------------------------- |
| data.guestId               | string  | UUID của guest player                                      |
| data.sessionToken          | string  | Token dùng cho `Authorization: Bearer <token>`               |
| data.sessionTokenExpiresAt | string  | Thời điểm hết hạn token (ISO 8601)                         |
| data.relinked              | boolean | `true` nếu re-link; `false` nếu guest mới                   |
| data.installSecret         | string  | Chỉ trả về lúc **tạo mới** với `installId` — lưu Keychain/Keystore |

**Important Notes**:

- `sessionToken` và `installSecret` chỉ trả về **một lần** — server lưu hash, không lưu plaintext.
- Token mặc định có hiệu lực **90 ngày** (`SESSION_TOKEN_TTL_DAYS`).
- `installId` + `installSecret` phải persist riêng session token.

**Error Responses**

- **400 Bad Request**: UUID format sai
- **401 Unauthorized**: Thiếu/sai `installSecret` khi re-link
- **409 Conflict**: `installId` đã tồn tại (race create) — gửi lại với `installSecret` nếu đã có
- **429 Too Many Requests**: Vượt rate limit (10/min/IP)

---

## Business Logic

1. `installId` tồn tại + `installSecret` hợp lệ → `rotateSessionToken()` (`relinked: true`).
2. `installId` tồn tại + thiếu/sai secret → 401.
3. `installId` mới → tạo guest + generate `installSecret` (`relinked: false`).
4. Không `installId` → guest mới không relink được.

---

## Related Endpoints

- [Get Guest Profile](./get-guest-me.md)
- [Replay Hash HMAC](../game/replay-hash-hmac.md)
- [Sync Game Results](../game/sync-game-results.md)
