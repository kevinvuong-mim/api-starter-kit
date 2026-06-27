# Game Results Partition Maintenance

## Overview

Task bảo trì monthly partition cho bảng `game_results`. Service đảm bảo app luôn có partition cho tháng hiện tại và 2 tháng tiếp theo, đồng thời xóa partition cũ theo retention window.

**Service:** `GameResultsPartitionService`

**Module:** `GameModule`

**Schedule:** Ngày 1 hàng tháng, 04:00 (`0 4 1 * *`)

---

## Triggers

### On Boot

`GameResultsPartitionService.onModuleInit()` gọi `ensureUpcomingPartitions()`.

Mục tiêu:

- Tạo partition cho tháng hiện tại.
- Tạo trước partition cho 2 tháng tiếp theo.
- Giảm nguy cơ insert rơi vào `game_results_default` sau deploy hoặc khi bước sang tháng mới.

### Cron

`maintainPartitions()` chạy ngày 1 hàng tháng lúc 04:00.

Logic:

1. `ensureUpcomingPartitions()` tạo partition tháng hiện tại + 2 tháng tới.
2. `dropExpiredPartitions()` xóa partition cũ hơn `GAME_RESULTS_RETENTION_MONTHS`.

---

## Partition Naming

Partition được đặt theo format:

```text
game_results_YYYY_MM
```

Ví dụ:

- `game_results_2026_06`
- `game_results_2026_07`
- `game_results_2026_08`

Mỗi partition chứa rows theo `createdAt` trong khoảng `[monthStart, nextMonthStart)`.

---

## Default Partition Flow

Khi tạo partition mới, service xử lý cả trường hợp `game_results_default` đã có rows thuộc tháng đó.

Flow trong transaction:

1. Lấy PostgreSQL advisory lock `902412`.
2. Nếu partition đã tồn tại thì bỏ qua.
3. Detach `game_results_default`.
4. Tạo partition tháng mới.
5. Move rows matching range từ `game_results_default` về parent `game_results`.
6. Xóa rows đã move khỏi `game_results_default`.
7. Attach lại `game_results_default` làm default partition.

Advisory lock giúp serialize maintenance giữa nhiều app instances và tránh overlap giữa startup task với cron.

---

## Retention

Retention đọc từ `APP_CONFIG.gameResultsRetentionMonths`.

Biến môi trường:

```env
GAME_RESULTS_RETENTION_MONTHS=36
```

Mặc định: `36` tháng.

`dropExpiredPartitions()` scan child tables của `game_results`, chỉ xử lý table có tên match `game_results_YYYY_MM`, bỏ qua `game_results_default`, và drop partition có tháng nhỏ hơn cutoff.

---

## Data Safety Notes

- Chỉ bảng `game_results` bị retention theo tháng.
- Bảng `game_replay_keys` không bị xóa khi drop partition, nên replay dedup vẫn giữ hiệu lực.
- Bảng `leaderboard` là source of truth cho best score, không phụ thuộc vào `game_results` cũ.
- Nếu partition chưa kịp tạo, rows vẫn có thể vào `game_results_default`; lần maintenance sau sẽ move rows về partition đúng.

---

## Monitoring & Logs

Log khi drop partition cũ:

```text
[GameResultsPartitionService] Dropped expired partition game_results_2024_01
```

Không có log riêng khi tạo partition thành công; kiểm tra trực tiếp trong PostgreSQL nếu cần.

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
