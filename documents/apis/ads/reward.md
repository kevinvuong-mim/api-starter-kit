# Ads Reward API Documentation

## Overview

API server-verified reward flow cho rewarded ads. Client **không** được tự cộng thưởng — phải đi qua 2 bước: tạo session → show ad → claim.

**Base URL**: `/api/ads`

```
POST /ads/reward/start  →  show rewarded ad  →  POST /ads/reward/claim
```

| Endpoint               | Auth          | Mô tả                              |
| ---------------------- | ------------- | ---------------------------------- |
| `POST /reward/start`   | Session token | Tạo phiên thưởng `PENDING`         |
| `POST /reward/claim`   | Session token | Verify SDK payload và cấp thưởng   |

**Rate Limit**: 100 requests / phút / IP

**Session TTL**: `ADS_REWARD_SESSION_TTL_SECONDS` (mặc định `300` giây)

---

## 1. Start Reward Session

Bắt đầu phiên thưởng trước khi show ad. Tạo record trong `ad_reward_sessions`.

**Endpoint**: `POST /api/ads/reward/start`

**Authentication**: Yêu cầu session token

#### Headers

```
Content-Type: application/json
Authorization: Bearer <sessionToken>
```

#### Request Body

```json
{ "placement": "DOUBLE_COIN" }
```

| Field     | Type   | Required | Validation   | Description                |
| --------- | ------ | -------- | ------------ | -------------------------- |
| placement | string | Yes      | Max 64 chars | Placement reward           |

#### Response (201 Created)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "rewardSessionId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-06-26T12:05:00.000Z"
  },
  "timestamp": "2026-06-26T12:00:00.000Z",
  "path": "/api/ads/reward/start"
}
```

| Field           | Type   | Description                         |
| --------------- | ------ | ----------------------------------- |
| rewardSessionId | string | UUID — dùng cho claim               |
| expiresAt       | string | ISO 8601 — hết hạn session          |

#### Errors

| Status | Message                          | Nguyên nhân                          |
| ------ | -------------------------------- | ------------------------------------ |
| 400    | Placement X is not rewarded      | Placement sai format hoặc chưa config reward |
| 401    | Unauthorized                     | Thiếu/sai `sessionToken`             |
| 403    | Rewarded ads are disabled        | `rewardEnabled: false`               |
| 409    | Reward cooldown active           | Vừa claim cùng placement trong cooldown |

#### cURL

```bash
curl -X POST http://localhost:3000/api/ads/reward/start \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{"placement":"DOUBLE_COIN"}'
```

#### Business Logic

1. Check `rewardEnabled`
2. Validate `placements[placement] === 'rewarded'`
3. Validate `rewards[placement]` tồn tại
4. Cooldown check — không có `CLAIMED` gần đây cùng guest + placement
5. Create session `PENDING` với `rewardType`, `rewardAmount`, `expiresAt`
6. Log `reward_session_started`

---

## 2. Claim Reward

Xác minh và cấp thưởng sau khi user xem xong ad. **Bước duy nhất được phép grant reward.**

**Endpoint**: `POST /api/ads/reward/claim`

**Authentication**: Yêu cầu session token

#### Headers

```
Content-Type: application/json
Authorization: Bearer <sessionToken>
```

#### Request Body

```json
{
  "rewardSessionId": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "mock",
  "providerPayload": {
    "shown": true,
    "rewarded": true,
    "transactionId": "mock-reward-1719392400000"
  }
}
```

| Field           | Type   | Required | Validation   | Description                    |
| --------------- | ------ | -------- | ------------ | ------------------------------ |
| rewardSessionId | string | Yes      | Max 64 chars | ID từ start                    |
| provider        | string | Yes      | Max 32 chars | `mock`, `admob`, …             |
| providerPayload | object | No       | JSON         | Dữ liệu verify từ SDK callback |

#### Provider Verification

| Provider | Điều kiện pass                                              |
| -------- | ------------------------------------------------------------- |
| `mock`   | `shown === true` AND `rewarded === true`                      |
| `admob`  | `rewarded === true` AND `transactionId` string ≥ 8 ký tự      |

#### Response (201 Created)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": {
    "success": true,
    "placement": "DOUBLE_COIN",
    "reward": { "type": "coins", "amount": 100 }
  },
  "timestamp": "2026-06-26T12:02:00.000Z",
  "path": "/api/ads/reward/claim"
}
```

**Default rewards**:

| Placement   | type       | amount |
| ----------- | ---------- | ------ |
| DOUBLE_COIN | coins      | 100    |
| EXTRA_LIFE  | extra_life | 1      |

#### Errors

| Status | Message                              | Nguyên nhân                    |
| ------ | ------------------------------------ | ------------------------------ |
| 400    | Provider reward verification failed  | Payload SDK không hợp lệ       |
| 400    | Reward session expired               | Quá `expiresAt`                |
| 401    | Unauthorized                         | Thiếu/sai token                |
| 403    | Reward session does not belong to guest | Session của guest khác      |
| 404    | Reward session not found             | `rewardSessionId` không tồn tại |
| 409    | Reward already claimed               | Duplicate claim                |

#### cURL

```bash
curl -X POST http://localhost:3000/api/ads/reward/claim \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "rewardSessionId": "550e8400-e29b-41d4-a716-446655440000",
    "provider": "mock",
    "providerPayload": { "shown": true, "rewarded": true }
  }'
```

#### Business Logic

1. Load session, verify ownership
2. Reject nếu `CLAIMED` hoặc quá `expiresAt`
3. `verifyProviderReward(provider, payload)`
4. Idempotency key: SHA-256(`rewardSessionId + provider + transactionId`)
5. Atomic update `status → CLAIMED`
6. Log `ads_reward_claimed`
7. Return reward từ session (không từ client payload)

### Anti-Abuse

| Cơ chế          | Mô tả                                    |
| --------------- | ---------------------------------------- |
| Session expiry  | TTL env + realtime check + cron cleanup  |
| Idempotency     | Chống claim trùng / replay               |
| Ownership       | Guest khác không claim được                |
| Provider verify | Không trust client                         |
| Audit log       | Mọi claim/fail → `ad_events`             |

---

## Full Flow Example

```bash
# 1. Init guest (nếu chưa có)
curl -X POST http://localhost:3000/api/guest/init

# 2. Start reward
curl -X POST http://localhost:3000/api/ads/reward/start \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{"placement":"DOUBLE_COIN"}'

# 3. Client shows rewarded ad...

# 4. Claim reward
curl -X POST http://localhost:3000/api/ads/reward/claim \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "rewardSessionId": "<id-from-step-2>",
    "provider": "mock",
    "providerPayload": { "shown": true, "rewarded": true }
  }'
```

---

## Use Cases

- **Double coins**: `placement: "DOUBLE_COIN"` sau game over
- **Extra life**: `placement: "EXTRA_LIFE"` khi user muốn tiếp tục

Client apply `reward` vào game state **chỉ sau** claim thành công.

---

## Related Documentation

- [Client API](./client.md) — Config và event logging
- [Admin API](./admin.md) — Đổi rewards / cooldown
- [Ads Maintenance Cron](../../tasks/ads-maintenance.md) — Expire session treo
- [Init Guest](../guest/init-guest.md) — Lấy `sessionToken`

---

## Troubleshooting

| Problem | Cause | Solution |
| ------- | ----- | -------- |
| 409 cooldown | Claim gần đây cùng placement | Đợi hết `cooldowns.rewarded` |
| 403 disabled | Admin tắt reward | Refresh config, ẩn nút reward |
| Session expired | Quá TTL | Start flow mới |
| Verification failed | User skip ad / fake payload | Không cấp thưởng, retry từ start |
| Already claimed | Double tap / retry | Idempotent trên client |

---

## Notes

- **Trust server only** — amount từ DB session, không từ client
- **Offline** — client không nên cho claim khi offline
- **One claim per session** — duplicate luôn bị từ chối
