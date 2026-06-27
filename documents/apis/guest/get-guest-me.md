# Get Guest Profile API Documentation

## Overview

Trả về profile của guest hiện tại từ `sessionToken`.

**Endpoint**: `GET /api/guest/me`

**Authentication**: Yêu cầu `Authorization: Bearer <sessionToken>`

**Rate Limit**: 100 requests / phút / IP

#### Headers

```
Authorization: Bearer <sessionToken>
```

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerOne",
    "sessionTokenExpiresAt": "2026-09-25T12:00:00.000Z"
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/guest/me"
}
```

| Field                      | Type           | Description                    |
| -------------------------- | -------------- | ------------------------------ |
| data.guestId               | string         | UUID guest                     |
| data.name                  | string \| null | Display name                   |
| data.sessionTokenExpiresAt | string         | Token expiry (ISO 8601)        |

**Note:** `installId` không được expose qua API (security).

**Error Responses**

- **401 Unauthorized**: Thiếu, sai, hoặc hết hạn session token
- **429 Too Many Requests**: Vượt rate limit global

---

## Related Endpoints

- [Init Guest](./init-guest.md)
- [Update Guest Name](./update-guest-name.md)
