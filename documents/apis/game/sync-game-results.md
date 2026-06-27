# Sync Game Results API Documentation

## Overview

API đồng bộ kết quả game offline lên server theo batch. Hỗ trợ tối đa 50 kết quả mỗi request, xử lý idempotent qua `replayHash`, và tự động cập nhật bảng xếp hạng khi có điểm cao hơn. Endpoint yêu cầu `sessionToken` để xác thực guest.

**Base URL**: `/api/game`

---

## Endpoint

### Sync Game Results (Đồng bộ kết quả game)

Upload batch kết quả chơi game từ client lên server.

**Endpoint**: `POST /api/game/sync`

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
  "gameId": "puzzle-quest",
  "results": [
    {
      "score": 1000,
      "replayHash": "a3f2c1b9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      "metadata": { "level": 5, "powerUps": "shield" }
    }
  ]
}
```

#### Request Fields

| Field                | Type   | Required | Validation                              | Description                          |
| -------------------- | ------ | -------- | --------------------------------------- | ------------------------------------ |
| gameId               | string | Yes      | Game phải tồn tại và `isActive = true`  | ID của game                          |
| results              | array  | Yes      | Min: 1, Max: 50 items                   | Danh sách kết quả cần sync           |
| results[].score      | number | Yes      | Integer, Min: 0                         | Điểm số của lượt chơi                |
| results[].replayHash | string | Yes      | 64-char SHA-256 hex string              | Hash replay để chống gian lận        |
| results[].metadata   | object | No       | Flat JSON, xem [Metadata Rules](#metadata-rules) | Dữ liệu bổ sung theo từng game |

**Lưu ý**: Guest được xác định từ `sessionToken` trong header — **không** truyền `guestId` trong body.

#### Response

**Success (201 Created)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "accepted": 1,
    "rejected": 0,
    "bestScore": 1200
  },
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/game/sync"
}
```

#### Response Schema

| Field           | Type   | Description                                                    |
| --------------- | ------ | -------------------------------------------------------------- |
| accepted        | number | Số kết quả được chấp nhận (bao gồm idempotent resubmit)        |
| rejected        | number | Số kết quả bị từ chối (validation fail, duplicate, v.v.)       |
| bestScore       | number | Điểm cao nhất hiện tại của guest trong game (0 nếu chưa có)    |

**Error Responses**

- **400 Bad Request**: Validation error hoặc game không active

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "results",
      "constraint": "arrayMinSize",
      "message": "results must contain at least 1 elements",
      "value": []
    }
  ],
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/game/sync"
}
```

Game không active:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Game \"puzzle-quest\" is not active",
  "error": "Bad Request",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/game/sync"
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
  "path": "/api/game/sync"
}
```

- **404 Not Found**: Game hoặc guest không tồn tại

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Game \"unknown-game\" not found",
  "error": "Not Found",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/game/sync"
}
```

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Guest player not found",
  "error": "Not Found",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api/game/sync"
}
```

- **429 Too Many Requests**: Vượt quá rate limit

#### cURL Example

```bash
curl -X POST http://localhost:3000/api/game/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 7c9e6679-7425-40de-944b-e07fc1f90ae7" \
  -d '{
    "gameId": "puzzle-quest",
    "results": [{
      "score": 1000,
      "replayHash": "a3f2c1b9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      "metadata": { "level": 1 }
    }]
  }'
```

---

## Metadata Rules

Field `metadata` là optional. Nếu có, phải tuân theo các giới hạn sau:

| Rule                    | Giới hạn                                      |
| ----------------------- | --------------------------------------------- |
| Cấu trúc                | Flat object (không nested, không array)       |
| Số keys tối đa          | 10                                            |
| Độ dài key              | 1–64 ký tự                                    |
| Kiểu value cho phép     | `string`, `number`, `boolean`, `null`         |
| Độ dài string value     | Tối đa 256 ký tự                              |
| Tổng size JSON          | Tối đa 2048 bytes                             |

**Ví dụ hợp lệ**:

```json
{ "level": 5, "powerUps": "shield", "completed": true }
```

**Ví dụ không hợp lệ**:

```json
{ "nested": { "level": 1 } }
```

```json
{ "items": ["shield", "bomb"] }
```

---

## Replay Hash (Client-side)

Mỗi game tự tính SHA-256 hash từ dữ liệu replay. Server **chỉ** validate format và uniqueness — không verify nội dung hash.

```typescript
import { createHash } from 'crypto';

function computeReplayHash(replayData: unknown): string {
  return createHash('sha256').update(JSON.stringify(replayData)).digest('hex');
}
```

### Anti-Cheat Rules

| Rule                                              | Kết quả    |
| ------------------------------------------------- | ---------- |
| Thiếu replay hash                                 | Rejected   |
| Format không hợp lệ (không phải 64-char SHA-256 hex) | Rejected |
| Replay hash trùng (guest khác, cùng game)         | Rejected   |
| Cùng guest resubmit cùng hash                     | Accepted (idempotent) |
| Điểm thấp hơn best score hiện tại                 | Accepted (lưu result) nhưng không cập nhật leaderboard |

**Lưu ý**: Server không validate score, physics, seed, hay mô phỏng replay.

---

## Business Logic

1. **Authenticate**: `GuestAuthGuard` resolve guest từ `sessionToken`
2. **Validate game**: `GameRegistryService.assertActiveGame(gameId)` — 404 nếu không tồn tại, 400 nếu inactive
3. **Validate guest**: `GuestService.getGuestOrThrow(guestId)` — 404 nếu không tồn tại
4. **Process each result** (tuần tự):
   - Nếu `replayHash` đã tồn tại:
     - Cùng `guestId` → `accepted++` (idempotent, skip insert)
     - Khác `guestId` → `rejected++`
   - Validate replay hash format và duplicate qua `ReplayService`
   - Nếu invalid → `rejected++`
   - Nếu valid → lưu `GameResult`
   - Nếu race condition (unique constraint conflict) → xử lý idempotent, không trả 500
   - Cập nhật leaderboard nếu score cao hơn best hiện tại
5. **Return summary**: `{ accepted, rejected, bestScore }` — `bestScore` lấy từ bảng `leaderboard`

### Leaderboard Update

- PostgreSQL là source of truth — atomic upsert với `GREATEST(bestScore, newScore)`
- Redis cập nhật **sau** khi Postgres ghi thành công (không nằm trong DB transaction)
- Redis dùng Lua script atomic — chỉ nhận score cao hơn (không downgrade)
- Nếu Redis fail sau 3 lần retry → log warning, request vẫn thành công; cron rebuild hàng ngày đồng bộ lại

---

## Use Cases

### Use Case 1: Sync sau khi chơi offline

**Scenario**: User chơi game không có mạng, sau đó kết nối lại.

**Steps**:

1. Client lưu kết quả local với `replayHash`
2. Khi có mạng, gọi `POST /api/game/sync` với batch results và `sessionToken`
3. Kiểm tra `accepted` / `rejected` để xử lý lỗi
4. Dùng `bestScore` để cập nhật UI

### Use Case 2: Retry sync (idempotent)

**Scenario**: Request bị timeout nhưng server đã xử lý.

**Steps**:

1. Client retry với cùng `replayHash`
2. Server nhận diện duplicate của cùng guest → `accepted++`, không tạo record mới
3. An toàn để retry mà không lo duplicate data

---

## Related Endpoints

- [Init Guest](../guest/init-guest.md) — Tạo guest player và lấy `sessionToken`
- [Global Leaderboard](../leaderboard/global-leaderboard.md) — Xem xếp hạng sau khi sync

---

## Troubleshooting

### Problem: Tất cả results bị rejected

**Cause**:

- `replayHash` format sai (không đủ 64 ký tự hex)
- Hash đã được guest khác sử dụng
- Game ID không hợp lệ
- `metadata` vi phạm giới hạn size/shape

**Solution**:

- Kiểm tra hash generation trên client
- Đảm bảo mỗi lượt chơi có replay data unique
- Verify `gameId` tồn tại và active trong database
- Kiểm tra `metadata` là flat object, không nested/array

### Problem: `bestScore` không tăng dù `accepted > 0`

**Cause**: Score mới thấp hơn hoặc bằng best score hiện tại.

**Solution**:

- Đây là behavior đúng — leaderboard chỉ cập nhật khi có điểm cao hơn
- Kiểm tra `bestScore` trong response thay vì score từng result

### Problem: Batch lớn bị reject validation

**Cause**: Vượt quá 50 results mỗi request.

**Solution**:

- Chia batch thành nhiều request (mỗi request ≤ 50 results)
- Sync theo thứ tự thời gian

### Problem: 401 Unauthorized

**Cause**: Thiếu hoặc sai `sessionToken`.

**Solution**:

- Thêm header `Authorization: Bearer <sessionToken>`
- Lấy token mới từ `POST /api/guest/init` nếu mất

---

## Notes

- **Batch limit**: Tối đa 50 results mỗi request
- **Idempotent**: Cùng guest + cùng replayHash = accepted, không duplicate record
- **Per-game scope**: `replayHash` unique theo `gameId`, không global
- **Metadata**: Optional, flat JSON với giới hạn size/shape — xem [Metadata Rules](#metadata-rules)
- **Sequential processing**: Results xử lý tuần tự trong một request
- **Default seeded games**: `puzzle-quest`, `arcade-rush` (seed qua migration)
