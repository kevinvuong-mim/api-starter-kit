# Get Guest Profile API Documentation

## Overview

Trả về profile của guest theo `guestId`.

**Endpoint**: `GET /api/guest/me`

**Authentication**: Không yêu cầu. Client gửi `guestId` để định danh guest.

**Rate Limit**: 100 requests / phút / IP

#### Query Parameters

| Parameter | Type   | Required | Validation | Description |
| --------- | ------ | -------- | ---------- | ----------- |
| guestId   | string | Yes      | UUID       | Guest cần lấy profile |

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "guestId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerOne"
  },
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/guest/me"
}
```

| Field        | Type           | Description  |
| ------------ | -------------- | ------------ |
| data.guestId | string         | UUID guest   |
| data.name    | string \| null | Display name |

**Note:** `installId` không được expose qua API (security).

**Error Responses**

- **400 Bad Request**: Thiếu hoặc sai format `guestId`
- **404 Not Found**: Guest không tồn tại
- **429 Too Many Requests**: Vượt rate limit global

---

## Related Endpoints

- [Init Guest](./init-guest.md)
- [Update Guest Name](./update-guest-name.md)
