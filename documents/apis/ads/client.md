# Ads Client API Documentation

## Overview

Các API phía game client dùng để lấy cấu hình quảng cáo runtime và ghi analytics events. Config merge từ `DEFAULT_ADS_CONFIG` và override trong bảng `ad_config` (nếu admin đã cập nhật).

**Base URL**: `/api/ads`

| Endpoint            | Auth            | Mô tả ngắn                    |
| ------------------- | --------------- | ----------------------------- |
| `GET /config`       | Public          | Remote config (placements, cooldowns) |
| `POST /events`      | Session token   | Ghi analytics / audit events  |

**Rate Limit**: 100 requests / phút / IP (tất cả endpoints)

---

## 1. Get Ads Config

Lấy cấu hình quảng cáo cho game client — enable flags, placement mapping, cooldown.

**Endpoint**: `GET /api/ads/config`

**Authentication**: Không yêu cầu (Public)

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
  "path": "/api/ads/config"
}
```

#### Response Schema

| Field                  | Type    | Description                                              |
| ---------------------- | ------- | -------------------------------------------------------- |
| rewardEnabled          | boolean | Bật/tắt rewarded ads                                     |
| interstitialEnabled    | boolean | Bật/tắt interstitial ads                                 |
| bannerEnabled          | boolean | Bật/tắt banner ads                                       |
| appOpenEnabled         | boolean | Bật/tắt app open ads                                     |
| placements             | object  | Map placement → ad format                                |
| placements.*           | string  | `rewarded` \| `interstitial` \| `banner` \| `app_open`   |
| cooldowns              | object  | Cooldown theo format (đơn vị: giây)                      |
| cooldowns.interstitial | number  | Tối thiểu giây giữa 2 interstitial (mặc định 90)        |
| cooldowns.rewarded     | number  | Tối thiểu giây giữa 2 reward claim (mặc định 30)         |
| cooldowns.app_open     | number  | Cooldown app open (mặc định 0)                           |

**Lưu ý**:

- Client nên **cache** response để dùng offline
- Field `rewards` **không** trả về — chỉ server dùng khi claim
- Config có thể bị admin override qua `PATCH /api/ads/admin/config`

#### Default Placements

| Placement    | Format        |
| ------------ | ------------- |
| GAME_OVER    | interstitial  |
| EXTRA_LIFE   | rewarded      |
| DOUBLE_COIN  | rewarded      |
| HOME         | banner        |
| LEADERBOARD  | banner        |
| SHOP         | banner        |
| APP_START    | app_open      |

#### cURL

```bash
curl http://localhost:3000/api/ads/config
```

---

## 2. Log Ad Event

Ghi sự kiện quảng cáo từ client vào `ad_events` — dùng cho analytics và admin metrics. Best-effort, không block gameplay.

**Endpoint**: `POST /api/ads/events`

**Authentication**: Yêu cầu session token

#### Headers

```
Content-Type: application/json
Authorization: Bearer <sessionToken>
```

#### Request Body

```json
{
  "event": "ads_impression",
  "metadata": {
    "provider": "mock",
    "placement": "GAME_OVER",
    "format": "interstitial"
  }
}
```

| Field    | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| event    | string | Yes      | Tên event (ví dụ `ads_loaded`, `ads_impression`) |
| metadata | object | No       | Dữ liệu bổ sung (provider, placement, format, …) |

`guestId` lấy từ `sessionToken`, không truyền trong body.

#### Response (201 Created)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully",
  "data": { "logged": true },
  "timestamp": "2026-06-26T12:00:00.000Z",
  "path": "/api/ads/events"
}
```

#### Supported Event Types

| Event                        | Mô tả                              |
| ---------------------------- | ---------------------------------- |
| `ads_loaded`                 | Ad load thành công                 |
| `ads_failed`                 | Ad load/show thất bại              |
| `ads_opened` / `ads_closed`  | Ad mở / đóng                       |
| `ads_clicked`                | User click ad                      |
| `ads_impression`             | Impression                         |
| `ads_reward_earned`          | User earned reward từ SDK          |
| `ads_reward_claimed`         | Server claim thành công            |
| `banner_loaded` / `banner_hidden` | Banner load / ẩn              |
| `offline_ads_attempt`        | Cố show ad khi offline             |
| `offline_reward_blocked`     | Reward bị chặn vì offline          |
| `online_restore`             | Mạng trở lại                       |
| `ad_cache_hit` / `ad_cache_miss` | Cache hit/miss offline        |

Server cũng tự log: `reward_session_started`, `reward_verification_failed`.

#### cURL

```bash
curl -X POST http://localhost:3000/api/ads/events \
  -H "Authorization: Bearer <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{"event":"ads_impression","metadata":{"placement":"GAME_OVER","provider":"mock"}}'
```

---

## Business Logic

### Config

1. `AdsService.resolveConfig()` merge `DEFAULT_ADS_CONFIG` + `ad_config` table
2. Filter response qua `AdsConfigResponseDto`
3. `ResponseInterceptor` bọc standard envelope

### Events

1. Resolve guest từ `GuestAuthGuard`
2. Extract `provider`, `placement` từ `metadata` nếu là string
3. Insert vào `ad_events`
4. Admin metrics aggregate từ bảng này (24h rolling window)

---

## Use Cases

- **Boot**: fetch + cache config
- **App resume**: refresh config khi online
- **Impression tracking**: log sau mỗi interstitial/banner show
- **Offline UX**: log `offline_reward_blocked` khi chặn reward

---

## Related Documentation

- [Reward API](./reward.md) — Start / claim rewarded ads
- [Admin API](./admin.md) — Metrics và config management
- [Init Guest](../guest/init-guest.md) — Lấy `sessionToken`

---

## Troubleshooting

### Config không cập nhật trên client

**Cause**: Client cache cũ.

**Solution**: Refresh `GET /api/ads/config` on app resume.

### Events không ảnh hưởng metrics

**Cause**: Event name sai hoặc chưa đủ 24h window.

**Solution**: Dùng event name chuẩn; kiểm tra `GET /api/ads/admin/metrics`.

---

## Notes

- Config endpoint **public** — fetch trước khi có guest
- Events **best-effort** — catch error silently trên client
- Không validate strict event name — server lưu nguyên string
