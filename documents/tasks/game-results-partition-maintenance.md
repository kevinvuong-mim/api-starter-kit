# Game Results Partition Maintenance

## Overview

Task bảo trì yearly partition cho bảng `game_results`. Service đảm bảo app luôn có partition cho năm hiện tại và năm kế tiếp. Partition không bị xóa tự động.

**Service:** `GameResultsPartitionService`

**Module:** `GameModule`

**Schedule:** Ngày 1 tháng 1 hàng năm, 04:00 (`0 4 1 1 *`)

---

## Triggers

### On Boot

`GameResultsPartitionService.onModuleInit()` gọi `ensureUpcomingPartitions()`.

Mục tiêu:

- Tạo partition cho năm hiện tại.
- Tạo trước partition cho năm kế tiếp.
- Đảm bảo insert có partition hợp lệ trước khi app nhận request.

### Cron

`maintainPartitions()` chạy ngày 1 tháng 1 lúc 04:00.

Logic:

1. `ensureUpcomingPartitions()` tạo partition năm hiện tại + năm kế tiếp.
2. Không drop partition cũ.

---

## Partition Naming

Partition được đặt theo format:

```text
game_results_YYYY
```

Ví dụ:

- `game_results_2026`
- `game_results_2027`

Mỗi partition chứa rows theo `createdAt` trong khoảng `[yearStart, nextYearStart)`.

---

## Partition Creation Flow

Khi tạo partition mới, service tạo trực tiếp yearly partition dưới `game_results`.

Flow trong transaction:

1. Lấy PostgreSQL advisory lock `902412`.
2. Nếu partition đã tồn tại thì bỏ qua.
3. Tạo partition năm mới.

Advisory lock giúp serialize maintenance giữa nhiều app instances và tránh overlap giữa startup task với cron.

---

## Retention

Không có retention cron cho `game_results`. Các partition yearly được giữ lại cho tới khi operator chủ động archive/drop bằng migration hoặc task thủ công.

---

## Data Safety Notes

- Bảng `game_results` không bị drop partition tự động.
- Replay dedup tra trực tiếp từ `game_results(gameId, replayHash)`, nên phụ thuộc vào việc giữ partition lịch sử.
- Bảng `leaderboard` là source of truth cho best score, không phụ thuộc vào `game_results` cũ.
- Không có default partition. Nếu partition phù hợp với `createdAt` chưa tồn tại, PostgreSQL sẽ reject insert.

---

## Monitoring & Logs

Log khi tạo/đảm bảo partition:

```text
[GameResultsPartitionService] Ensured game_results yearly partition game_results_2026
```

Kiểm tra trực tiếp trong PostgreSQL nếu cần.

```sql
SELECT c.relname AS partition_name
FROM pg_inherits i
JOIN pg_class c ON c.oid = i.inhrelid
JOIN pg_class p ON p.oid = i.inhparent
WHERE p.relname = 'game_results'
ORDER BY c.relname;
```

---

## Related Documentation

- [Scheduled Maintenance Tasks](./leaderboard-maintenance.md)
- [Sync Game Results API](../apis/game/sync-game-results.md)
- [Environment Variables](../setup/environment-variables.md)
