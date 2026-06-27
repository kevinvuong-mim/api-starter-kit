# Get Guest Profile API Documentation

## Overview

Trả về profile của guest hiện tại từ session token.

**Endpoint**: `GET /api/guest/me`

**Authentication**: Bearer session token (required)

**Rate Limit**: 100 requests / phút / IP

#### Response

```json
{
  "success": true,
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerOne",
    "sessionTokenExpiresAt": "2026-09-25T12:00:00.000Z"
  }
}
```

| Field                      | Type           | Description                    |
| -------------------------- | -------------- | ------------------------------ |
| data.guestId               | string         | UUID guest                     |
| data.name                  | string \| null | Display name                   |
| data.sessionTokenExpiresAt | string         | Token expiry (ISO 8601)        |

**Note:** `installId` không được expose qua API (security).

---

## Related Endpoints

- [Init Guest](./init-guest.md)
- [Update Guest Name](./update-guest-name.md)
