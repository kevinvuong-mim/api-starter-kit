# Scheduled Maintenance Tasks

Tài liệu mô tả các cron job và startup tasks liên quan leaderboard và data retention.

**Modules:** `LeaderboardModule`, `GameModule` (`ScheduleModule.forRoot()` trong `app.module.ts`)

---

## 1. Redis Leaderboard Warm (on boot)

**Trigger:** `LeaderboardCacheService.onModuleInit()`

**Purpose:**

- Warm Redis sorted set từ PostgreSQL khi app khởi động.
- Tránh leaderboard trống sau Redis restart / deploy mới.

**Logic:**

1. Lấy active games qua `GameRegistryService.getActiveGames()`.
2. Đọc bảng `leaderboard` per game.
3. `RedisRankingService.rebuildGlobal(gameId, entries)`.

---

## 2. rebuildRedisLeaderboards (cron)

**Schedule:** Mỗi ngày 03:00 (`0 3 * * *`)

**Service:** `LeaderboardMaintenanceService`

**Purpose:** Reconciliation — đồng bộ Redis với PostgreSQL nếu có drift.

**Logic:** Gọi `LeaderboardCacheService.warmAll()` (cùng logic warm on boot).

**Related:**

| Nguồn      | Bảng/Key               |
| ---------- | ---------------------- |
| PostgreSQL | `leaderboard`, `games` |
| Redis      | `lb:global:{gameId}`   |

---

## 3. Realtime sync (không phải cron)

**Trigger:** `POST /api/games/:gameId/results`

**Logic:** Sau khi ghi Postgres, `RedisRankingService.updateScore()` (Lua script — chỉ tăng score).

---

## 4. Game Results Partition Maintenance

**Schedule:** Ngày 1 hàng tháng, 04:00 (`0 4 1 * *`)

**Service:** `GameResultsPartitionService`

**Purpose:**

- Tạo partition tháng hiện tại + 2 tháng tới cho `game_results`.
- Drop partition cũ hơn `GAME_RESULTS_RETENTION_MONTHS` (default 36).

**On boot:** `GameResultsPartitionService.onModuleInit()` đảm bảo partition sắp tới tồn tại.

**Lưu ý:**

- Dedup replay ở bảng `game_replay_keys` — **không** bị xóa khi drop partition.
- Leaderboard đọc từ bảng `leaderboard` — không phụ thuộc `game_results` cũ.

---

## Cơ chế đọc Leaderboard API

`GET /api/leaderboards` qua `LeaderboardCacheService.getRankings()`:

1. Redis có data → trả từ Redis.
2. Redis trống → fallback PostgreSQL + warm lại Redis.

---

## Monitoring & Logs

```
[LeaderboardCacheService] Warming Redis leaderboards from PostgreSQL
[LeaderboardCacheService] Warmed Redis leaderboard for game puzzle-quest (N entries)
[LeaderboardMaintenanceService] Scheduled Redis leaderboard rebuild complete
[GameResultsPartitionService] Dropped expired partition game_results_2024_01
```

---

## Related Documentation

- [Leaderboard API](../apis/leaderboard/global-leaderboard.md)
- [Sync Game Results API](../apis/game/sync-game-results.md)
- [Environment Variables](../setup/environment-variables.md)
