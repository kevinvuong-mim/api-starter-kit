# Update Guest Name API Documentation

## Overview

API cập nhật tên hiển thị (display name) cho guest player. Tên xuất hiện trên leaderboard. Endpoint không xác thực token; client gửi `guestId` để định danh guest.

**Base URL**: `/api/guest`

---

## Endpoint

### Update Guest Display Name

**Endpoint**: `PATCH /api/guest/name`

**Authentication**: Không yêu cầu

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

| Field   | Type   | Required | Validation                          | Description                   |
| ------- | ------ | -------- | ----------------------------------- | ----------------------------- |
| guestId | string | Yes      | UUID                                | Guest cần cập nhật            |
| name    | string | Yes      | Min: 1, Max: 20 characters, trimmed | Tên hiển thị trên leaderboard |

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
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/guest/name"
}
```

**Error Responses**

- **400 Bad Request**: Validation error
- **404 Not Found**: Guest không tồn tại
- **429 Too Many Requests**: Vượt rate limit global

#### cURL Example

```bash
curl -X PATCH http://localhost:3000/api/guest/name \
  -H "Content-Type: application/json" \
  -d '{"guestId": "550e8400-e29b-41d4-a716-446655440000", "name": "PlayerOne"}'
```

---

## Business Logic

1. Resolve guest từ `guestId`.
2. `GuestRepository.updateName()` ghi đè tên trong `guest_players`.
3. Trả về profile gồm `guestId`, `name`.

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
