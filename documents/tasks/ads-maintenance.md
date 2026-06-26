# Scheduled Ads Maintenance Tasks

Tài liệu này mô tả chi tiết cron job được triển khai trong file `src/modules/ads/ads-maintenance.service.ts` của dự án API Starter Kit. Tác vụ này dọn dẹp các reward session quá hạn, đảm bảo trạng thái trong database phản ánh đúng thực tế và hỗ trợ chống abuse (replay / claim muộn).

**Module liên quan:** `AdsModule` (đăng ký qua `ScheduleModule.forRoot()` trong `app.module.ts`)

---

## 1. expirePendingSessions

**Schedule:** Mỗi 10 phút (`*/10 * * * *`)

**Cron expression:** `CronExpression.EVERY_10_MINUTES` → `*/10 * * * *`

**Purpose:**

- Đánh dấu `EXPIRED` cho các reward session vẫn ở trạng thái `PENDING` nhưng đã quá `expiresAt`.
- Dọn dẹp session "treo" khi client bắt đầu reward flow (`POST /ads/reward/start`) nhưng không hoàn thành claim (`POST /ads/reward/claim`).
- Giữ bảng `ad_reward_sessions` nhất quán cho audit, metrics và admin review.

**Operation Logic:**

1. Gọi `AdsRepository.expirePendingSessions()`.
2. Query PostgreSQL với điều kiện:
   - `status = PENDING`
   - `expiresAt < now()`
3. `updateMany` → set `status = EXPIRED` cho tất cả bản ghi khớp.
4. Nếu `count > 0` → ghi log: `"Expired {count} pending ad reward sessions"`.
5. Nếu `count = 0` → không ghi log (tránh spam log mỗi 10 phút).

**Related Tables & Fields:**

| Bảng / Field              | Mô tả                                              |
| ------------------------- | -------------------------------------------------- |
| `ad_reward_sessions`      | Bảng lưu phiên thưởng server-side                  |
| `status`                  | `PENDING` → `EXPIRED` khi cron chạy               |
| `expiresAt`               | Thời điểm hết hạn, set lúc `POST /ads/reward/start` |
| `guestId`                 | Guest sở hữu session                               |
| `placement`               | Placement reward (ví dụ `DOUBLE_COIN`)             |

**TTL session:**

Thời gian sống session được cấu hình qua env `ADS_REWARD_SESSION_TTL_SECONDS` (mặc định `300` giây = 5 phút) khi tạo session trong `AdsService.startReward()`.

---

## Realtime vs Scheduled Expiry

Hệ thống có **hai lớp** kiểm tra hết hạn:

| Cơ chế    | Trigger                              | Hành vi                                              |
| --------- | ------------------------------------ | ---------------------------------------------------- |
| Realtime  | `POST /ads/reward/claim`             | Từ chối claim nếu `expiresAt < now()`, trả 400       |
| Realtime  | `claimRewardSession()` (transaction) | Đánh `EXPIRED` ngay trong transaction nếu quá hạn   |
| Scheduled | Cron `expirePendingSessions`         | Batch update mọi `PENDING` quá hạn → `EXPIRED`      |

Realtime check bảo vệ claim tức thì. Cron job đóng vai trò **reconciliation** — dọn session treo mà client không bao giờ claim (thoát app, mất mạng, crash).

---

## Monitoring & Logs

Mỗi lần cron expire session, service ghi log qua NestJS `Logger`:

```
[AdsMaintenanceService] Expired 3 pending ad reward sessions
```

Không có log khi không có session nào cần expire.

Theo dõi log để:

- Phát hiện tỷ lệ session bị expire cao (có thể UX reward flow kém, ad fail, hoặc mạng không ổn).
- Xác nhận cron chạy đúng lịch (log xuất hiện định kỳ khi có session treo).

---

## General Notes

- Cron job chỉ **cập nhật PostgreSQL** — không gọi AdMob hay client.
- Không xóa bản ghi — chỉ đổi `status` từ `PENDING` sang `EXPIRED` để giữ audit trail.
- Session đã `CLAIMED` hoặc `FAILED` **không** bị cron chạm tới.
- `ScheduleModule.forRoot()` phải được import trong `AppModule` để cron hoạt động.
- Nếu database không khả dụng khi cron chạy, job sẽ throw error — cần monitor và alert.
- Tần suất 10 phút là đủ cho cleanup; có thể điều chỉnh `CronExpression` nếu cần expire nhanh hơn.

---

## Related Documentation

- [Ads Client API](../apis/ads/client.md) — Remote config
- [Ads Reward API](../apis/ads/reward.md) — Reward flow
- [Ads Admin API](../apis/ads/admin.md) — Metrics và config management
- [Prisma migration](../../prisma/migrations/20260626120000_add_ads_module/migration.sql) — Schema `ad_reward_sessions`
