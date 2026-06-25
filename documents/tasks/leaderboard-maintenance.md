# Scheduled Leaderboard Maintenance Tasks

Tài liệu này mô tả chi tiết các cron job được triển khai trong file `src/modules/leaderboard/leaderboard-maintenance.service.ts` của dự án API Starter Kit. Các tác vụ này giúp đồng bộ dữ liệu bảng xếp hạng từ PostgreSQL (source of truth) sang Redis sorted set, đảm bảo API leaderboard luôn trả về ranking chính xác.

**Module liên quan:** `LeaderboardModule` (đăng ký qua `ScheduleModule.forRoot()` trong `app.module.ts`)

---

## 1. rebuildRedisLeaderboards

**Schedule:** Mỗi ngày lúc 3:00 sáng (`0 3 * * *`)

**Cron expression:** `0 3 * * *` (phút 0, giờ 3, mọi ngày)

**Purpose:**

- Rebuild toàn bộ Redis sorted set leaderboard từ dữ liệu PostgreSQL cho mỗi game đang active.
- Khắc phục drift giữa Redis và database (ví dụ: Redis restart, lỗi ghi tạm thời, hoặc dữ liệu không đồng bộ).
- Đảm bảo `GET /api/leaderboard/global` luôn phản ánh đúng best score all-time đã lưu trong bảng `leaderboard`.

**Operation Logic:**

1. Ghi log bắt đầu: `"Rebuilding Redis leaderboards from database"`.
2. Lấy danh sách game active qua `GameRegistryService.getActiveGames()` (`isActive: true`, sắp xếp theo `id` asc).
3. Với mỗi game:
   - Query bảng `leaderboard` trong PostgreSQL: lọc theo `gameId`, sắp xếp `bestScore` giảm dần, select `guestId` và `bestScore`.
   - Gọi `RedisRankingService.rebuildGlobal(gameId, entries)`:
     - Xóa key Redis hiện tại: `lb:global:{gameId}`.
     - Nếu không có entry → kết thúc (key đã xóa, leaderboard trống).
     - Nếu có entry → `ZADD` toàn bộ `(score, guestId)` vào sorted set.
   - Ghi log: `"Rebuilt Redis leaderboard for game {gameId}"`.
4. Ghi log hoàn tất: `"Redis leaderboard rebuild complete"`.

**Related Tables & Keys:**

| Nguồn / Đích | Tên                          | Mô tả                                      |
| ------------ | ---------------------------- | ------------------------------------------ |
| PostgreSQL   | `leaderboard`                | Best score all-time per guest per game     |
| PostgreSQL   | `games`                      | Chỉ rebuild game có `isActive = true`      |
| Redis        | `lb:global:{gameId}`         | Sorted set ranking (score → guestId)       |

**Related Fields:**

- `leaderboard.gameId`: ID game.
- `leaderboard.guestId`: ID guest player.
- `leaderboard.bestScore`: Điểm cao nhất all-time (dùng làm score trong Redis).
- `games.isActive`: Chỉ game active mới được rebuild.

---

## Realtime vs Scheduled Sync

Hệ thống có **hai cơ chế** cập nhật Redis leaderboard:

| Cơ chế    | Trigger                          | Hành vi                                              |
| --------- | -------------------------------- | ---------------------------------------------------- |
| Realtime  | `POST /api/game/sync`            | `ZADD` khi score mới > best score hiện tại           |
| Scheduled | Cron `rebuildRedisLeaderboards`  | Xóa key và rebuild toàn bộ từ PostgreSQL           |

Realtime sync xử lý hầu hết cập nhật hàng ngày. Cron job đóng vai trò **reconciliation** — đảm bảo Redis khớp với database nếu có sai lệch.

---

## Monitoring & Logs

Mỗi lần chạy, service ghi log qua NestJS `Logger`:

```
[LeaderboardMaintenanceService] Rebuilding Redis leaderboards from database
[LeaderboardMaintenanceService] Rebuilt Redis leaderboard for game puzzle-quest
[LeaderboardMaintenanceService] Rebuilt Redis leaderboard for game arcade-rush
[LeaderboardMaintenanceService] Redis leaderboard rebuild complete
```

Theo dõi log để xác nhận job chạy đúng lịch và rebuild thành công cho từng game.

---

## General Notes

- Cron job sử dụng **Prisma ORM** (PostgreSQL) và **ioredis** (Redis sorted sets).
- Chỉ rebuild leaderboard cho game **active** — game inactive hoặc đã xóa khỏi registry sẽ không được xử lý.
- Rebuild **không ảnh hưởng** đến dữ liệu PostgreSQL — chỉ đọc từ DB và ghi lại Redis.
- Thời gian chạy 03:00 được chọn để tránh giờ cao điểm; có thể điều chỉnh cron expression nếu cần.
- `ScheduleModule.forRoot()` phải được import trong `AppModule` để cron hoạt động.
- Nếu Redis không khả dụng khi cron chạy, job sẽ throw error — cần monitor và alert.
- Guest display names **không** được sync qua cron — tên resolve realtime từ bảng `guest_players` khi gọi API leaderboard.

---

## Related Documentation

- [Global Leaderboard API](../apis/leaderboard/global-leaderboard.md) — API đọc ranking từ Redis
- [Sync Game Results API](../apis/game/sync-game-results.md) — API ghi kết quả và cập nhật leaderboard realtime
