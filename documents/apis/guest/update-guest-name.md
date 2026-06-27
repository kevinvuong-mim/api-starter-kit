# Update Guest Name API Documentation

## Overview

API cập nhật tên hiển thị (display name) cho guest player. Tên xuất hiện trên leaderboard. Endpoint yêu cầu `sessionToken` hợp lệ và chưa hết hạn.

**Base URL**: `/api/guest`

---

## Endpoint

### Update Guest Display Name

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

| Field | Type   | Required | Validation                          | Description                   |
| ----- | ------ | -------- | ----------------------------------- | ----------------------------- |
| name  | string | Yes      | Min: 1, Max: 20 characters, trimmed | Tên hiển thị trên leaderboard |

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource updated successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerOne",
    "sessionTokenExpiresAt": "2026-09-25T12:00:00.000Z"
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

**Error Responses**

- **400 Bad Request**: Validation error
- **401 Unauthorized**: Thiếu, sai, hoặc **hết hạn** session token
- **429 Too Many Requests**: Vượt rate limit global

#### cURL Example

```bash
curl -X PATCH http://localhost:3000/api/guest/name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 7c9e6679-7425-40de-944b-e07fc1f90ae7" \
  -d '{"name": "PlayerOne"}'
```

---

## Business Logic

1. `GuestAuthGuard` resolve guest từ token.
2. `GuestRepository.updateName()` ghi đè tên trong `guest_players`.
3. Trả về profile gồm `guestId`, `name`, `sessionTokenExpiresAt`.

---

## Related Endpoints

- [Init Guest](./init-guest.md)
- [Get Guest Profile](./get-guest-me.md)
- [Leaderboard](../leaderboard/global-leaderboard.md)

---

## Notes

- Ghi đè tên cũ — không append.
- Tên không unique.
- Leaderboard resolve tên realtime từ DB mỗi request.
