# Ads Admin API Documentation

## Overview

API quản trị quảng cáo cho dashboard admin — xem metrics monetization và quản lý remote config. Tất cả endpoints yêu cầu header `x-ads-admin-key` khớp với env `ADS_ADMIN_API_KEY`.

**Base URL**: `/api/ads/admin`

| Endpoint          | Method | Mô tả                                    |
| ----------------- | ------ | ---------------------------------------- |
| `/metrics`        | GET    | KPI monetization 24h gần nhất            |
| `/config`         | GET    | Xem config hiện tại                      |
| `/config`         | PATCH  | Cập nhật config (partial)                |

**Rate Limit**: 100 requests / phút / IP

#### Headers (tất cả endpoints)

```
x-ads-admin-key: <ADS_ADMIN_API_KEY>
```

---

## 1. Get Ads Metrics

Lấy metrics monetization trong **24 giờ rolling** từ bảng `ad_events`.

**Endpoint**: `GET /api/ads/admin/metrics`

#### Response (200 OK)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "dau": 150,
    "rewardClaims": 42,
    "bannerImpressions": 320,
    "interstitialImpressions": 180,
    "fillRate": 0.8750,
    "adsPerSession": 3.33,
    "estimatedEcpm": 2.5,
    "arpdau": 0.0083
  },
  "timestamp": "2026-06-26T12:00:00.000Z",
  "path": "/api/ads/admin/metrics"
}
```

#### Response Schema

| Field                   | Type   | Description                                          |
| ----------------------- | ------ | ---------------------------------------------------- |
| dau                     | number | Distinct guests có event trong 24h                   |
| rewardClaims            | number | Số event `ads_reward_claimed`                        |
| bannerImpressions       | number | Số event `banner_loaded`                             |
| interstitialImpressions | number | `ads_impression` − bannerImpressions (min 0)         |
| fillRate                | number | `loaded / (loaded + failed)`                         |
| adsPerSession           | number | `impressions / dau`                                  |
| estimatedEcpm           | number | eCPM ước tính (hiện tại `2.5`)                      |
| arpdau                  | number | `(impressions/1000 × ecpm) / dau`                    |

#### Data Source

| Metric            | Event source                |
| ----------------- | --------------------------- |
| rewardClaims      | `ads_reward_claimed`        |
| bannerImpressions | `banner_loaded`             |
| impressions       | `ads_impression`            |
| fillRate          | `ads_loaded` + `ads_failed` |
| dau               | distinct `guestId`          |

#### cURL

```bash
curl http://localhost:3000/api/ads/admin/metrics \
  -H "x-ads-admin-key: your-secret-key"
```

---

## 2. Get Ads Config

Xem config hiện tại — response giống public `GET /api/ads/config`, khác authentication.

**Endpoint**: `GET /api/ads/admin/config`

#### Response (200 OK)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "rewardEnabled": true,
    "interstitialEnabled": true,
    "bannerEnabled": true,
    "appOpenEnabled": false,
    "placements": {
      "GAME_OVER": "interstitial",
      "EXTRA_LIFE": "rewarded",
      "DOUBLE_COIN": "rewarded",
      "HOME": "banner",
      "LEADERBOARD": "banner",
      "SHOP": "banner",
      "APP_START": "app_open"
    },
    "cooldowns": {
      "interstitial": 90,
      "rewarded": 30,
      "app_open": 0
    }
  },
  "timestamp": "2026-06-26T12:00:00.000Z",
  "path": "/api/ads/admin/config"
}
```

Schema chi tiết xem [Client API — Get Config](./client.md#1-get-ads-config).

#### cURL

```bash
curl http://localhost:3000/api/ads/admin/config \
  -H "x-ads-admin-key: your-secret-key"
```

---

## 3. Update Ads Config

Cập nhật config runtime — partial PATCH, merge với config hiện tại, lưu vào `ad_config`.

**Endpoint**: `PATCH /api/ads/admin/config`

#### Headers

```
Content-Type: application/json
x-ads-admin-key: <ADS_ADMIN_API_KEY>
```

#### Request Body

Tất cả fields optional — chỉ gửi field cần đổi.

```json
{
  "rewardEnabled": true,
  "bannerEnabled": false,
  "cooldowns": { "interstitial": 120, "rewarded": 60 },
  "rewards": { "DOUBLE_COIN": { "type": "coins", "amount": 150 } },
  "placements": { "GAME_OVER": "interstitial" },
  "bannerPlacements": ["HOME", "SHOP"]
}
```

| Field               | Type    | Description                                    |
| ------------------- | ------- | ---------------------------------------------- |
| rewardEnabled       | boolean | Bật/tắt rewarded                               |
| interstitialEnabled | boolean | Bật/tắt interstitial                           |
| bannerEnabled       | boolean | Bật/tắt banner                                 |
| appOpenEnabled      | boolean | Bật/tắt app open                               |
| provider            | string  | Lưu config (không ép SDK client)               |
| placements          | object  | Partial merge placement → format               |
| cooldowns           | object  | Partial merge cooldown (giây)                  |
| rewards             | object  | Partial merge reward per placement             |
| bannerPlacements    | array   | Replace toàn bộ danh sách banner placements    |

**Placement values**: `rewarded` | `interstitial` | `banner` | `app_open`

#### Response (200 OK)

Trả về config đầy đủ sau merge (cùng schema GET config).

#### cURL Examples

```bash
# Tắt banner
curl -X PATCH http://localhost:3000/api/ads/admin/config \
  -H "x-ads-admin-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"bannerEnabled": false}'

# Tăng cooldown interstitial
curl -X PATCH http://localhost:3000/api/ads/admin/config \
  -H "x-ads-admin-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"cooldowns": {"interstitial": 120}}'

# Tăng reward DOUBLE_COIN
curl -X PATCH http://localhost:3000/api/ads/admin/config \
  -H "x-ads-admin-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"rewards": {"DOUBLE_COIN": {"type": "coins", "amount": 150}}}'
```

#### Business Logic

1. Verify admin key
2. Load current config (`DEFAULT_ADS_CONFIG` + DB override)
3. Shallow merge partial update
4. Upsert `ad_config` (id = `default`)
5. Return merged public DTO

**Lưu ý**: `rewards` lưu DB và dùng lúc start/claim, nhưng **không** có trong response DTO.

---

## Authentication Errors

Tất cả admin endpoints trả **401** khi:

- Thiếu header `x-ads-admin-key`
- Key không khớp `ADS_ADMIN_API_KEY`
- `ADS_ADMIN_API_KEY` chưa cấu hình trên server

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid admin API key",
  "error": "Unauthorized",
  "timestamp": "2026-06-26T12:00:00.000Z",
  "path": "/api/ads/admin/metrics"
}
```

---

## Use Cases

| Scenario | Action |
| -------- | ------ |
| Dashboard KPI | `GET /metrics` |
| Audit config trước khi sửa | `GET /config` |
| Tắt reward maintenance | `PATCH` `{ "rewardEnabled": false }` |
| Giảm ad fatigue | `PATCH` `{ "cooldowns": { "interstitial": 180 } }` |
| A/B test reward | `PATCH` `{ "rewards": { "DOUBLE_COIN": { "type": "coins", "amount": 200 } } }` |

Sau PATCH, client nhận config mới qua `GET /api/ads/config` (cần refresh cache).

---

## Related Documentation

- [Client API](./client.md) — Public config + events (nguồn metrics)
- [Reward API](./reward.md) — Dùng `rewards` và `placements` từ config
- [Ads Maintenance Cron](../../tasks/ads-maintenance.md)

---

## Troubleshooting

| Problem | Cause | Solution |
| ------- | ----- | -------- |
| 401 Invalid key | Sai key hoặc chưa set env | Kiểm tra `ADS_ADMIN_API_KEY` |
| Client không thấy config mới | Client cache | Refresh `GET /api/ads/config` |
| Reward amount không đổi | Session đã start trước PATCH | Chỉ session mới dùng amount mới |

---

## Notes

- **Admin only** — không expose cho game client
- **24h rolling metrics** — không phải calendar day
- **estimatedEcpm** hard-code `2.5` — placeholder cho integration thật
- **Key rotation** — đổi env + cập nhật dashboard cùng lúc
- **Partial PATCH** — không cần gửi full config
