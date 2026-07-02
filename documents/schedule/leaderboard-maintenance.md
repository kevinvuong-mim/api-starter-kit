# Scheduled Maintenance Tasks

Tài liệu mô tả các cron job và startup tasks liên quan leaderboard và partition maintenance.

**Modules:** `LeaderboardModule`, `GameModule` (`ScheduleModule.forRoot()` trong `app.module.ts`)

---

## 1. Redis Leaderboard Warm (on boot)

**Trigger:** `LeaderboardCacheService.onModuleInit()`

**Purpose:**

- Warm Redis sorted set từ PostgreSQL khi app khởi động.
- Tránh leaderboard trống sau Redis restart / deploy mới.

**Logic:**

1. Lấy games qua `GameRegistryService.getGames()`.
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

**Schedule:** Ngày 1 tháng 1 hằng năm, 04:00 (`0 4 1 1 *`)

**Service:** `GameResultsPartitionService`

**Detailed doc:** [Game Results Partition Maintenance](./game-results-partition-maintenance.md)

**Purpose:**

- Tạo partition năm hiện tại + năm kế tiếp cho `game_results`.
- Không drop partition cũ.

**On boot:** `GameResultsPartitionService.onModuleInit()` đảm bảo partition sắp tới tồn tại.

**Lưu ý:**

- Dedup replay tra trực tiếp từ `game_results(gameId, replayHash)`.
- Leaderboard đọc từ bảng `leaderboard` — không phụ thuộc `game_results` cũ.

---

## Cơ chế đọc Leaderboard API

`GET /api/leaderboards` qua `LeaderboardCacheService.getRankings()`:

1. Đọc `ZCARD` từ Redis và count từ PostgreSQL.
2. Redis có data và count khớp PostgreSQL → trả từ Redis.
3. Redis trống hoặc count lệch PostgreSQL → rebuild Redis từ PostgreSQL, rồi trả từ Redis.
4. PostgreSQL không có entry → trả rỗng; nếu Redis còn data cũ thì clear key.

---

## Monitoring & Logs

```
[LeaderboardCacheService] Warming Redis leaderboards from PostgreSQL
[LeaderboardCacheService] Warmed Redis leaderboard for game puzzle-quest (N entries)
[LeaderboardMaintenanceService] Scheduled Redis leaderboard rebuild complete
[GameResultsPartitionService] Ensured game_results yearly partition game_results_2026
```

---

## Related Documentation

- [Game Results Partition Maintenance](./game-results-partition-maintenance.md)
- [Leaderboard API](../apis/leaderboard/global-leaderboard.md)
- [Sync Game Results API](../apis/game/sync-game-results.md)
- [Environment Variables](../setup/environment-variables.md)
