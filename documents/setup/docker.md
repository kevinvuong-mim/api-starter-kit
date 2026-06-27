# Hướng dẫn sử dụng Docker cho Database và Redis

Tài liệu hướng dẫn chạy PostgreSQL và Redis bằng Docker cho dự án api-starter-kit.

## Yêu cầu

- Docker + Docker Compose

## Cấu hình Docker Compose

File `docker-compose.yml` ở thư mục gốc:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: game-postgres
    environment:
      POSTGRES_DB: game
      POSTGRES_USER: game_user
      POSTGRES_PASSWORD: change_me
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U game_user -d game']

  redis:
    image: redis:8.6-alpine
    container_name: game-redis
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
```

### Thông tin kết nối (development)

| Service    | Host      | Port | Credentials                          |
| ---------- | --------- | ---- | ------------------------------------ |
| PostgreSQL | localhost | 5432 | `game_user` / `change_me`, DB `game` |
| Redis      | localhost | 6379 | Không password (local dev)           |

**`.env` tương ứng:**

```env
DATABASE_URL="postgresql://game_user:change_me@localhost:5432/game"
REDIS_URL="redis://localhost:6379"
```

> Đổi `change_me` trước khi deploy. Không dùng credential mặc định trên production.

---

## Sử dụng

### Khởi động

```bash
docker-compose up -d
```

### Kiểm tra

```bash
docker-compose ps
docker-compose exec redis redis-cli ping
docker-compose exec postgres pg_isready -U game_user -d game
```

### Dừng

```bash
docker-compose stop      # giữ data
docker-compose down      # xóa container, giữ volume
docker-compose down -v   # xóa cả data
```

### Migrate database

```bash
npm run prisma:migrate
npm run prisma:generate
```

---

## PostgreSQL CLI

```bash
docker-compose exec postgres psql -U game_user -d game
```

```sql
\dt
SELECT * FROM games;
\q
```

---

## Redis CLI

```bash
docker-compose exec redis redis-cli
KEYS lb:global:*
ZREVRANGE lb:global:puzzle-quest 0 9 WITHSCORES
```

---

## Backup / Restore

```bash
docker-compose exec postgres pg_dump -U game_user game > backup.sql
docker-compose exec -T postgres psql -U game_user game < backup.sql
```

---

## Troubleshooting

### Port đã được sử dụng

Đổi port mapping trong `docker-compose.yml` (ví dụ `5433:5432`) và cập nhật `DATABASE_URL`.

### Healthcheck unhealthy

```bash
docker-compose logs postgres
docker-compose exec postgres pg_isready -U game_user -d game
```

---

## Security

- Credential `change_me` chỉ cho **local development**.
- Không expose port 5432/6379 ra internet.
- Production: managed DB (RDS, Cloud SQL, …) + Redis có auth/TLS.
