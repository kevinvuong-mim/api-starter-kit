# Hướng dẫn lấy các biến môi trường

Tài liệu này hướng dẫn các biến môi trường cần thiết cho dự án api-starter-kit.

## 1. Database

### DATABASE_URL

Connection string PostgreSQL.

**Format:**

```env
DATABASE_URL="postgresql://username:password@host:port/database_name"
```

**Ví dụ (local Docker):**

```env
DATABASE_URL="postgresql://game_user:change_me@localhost:5432/game"
```

---

## 2. Redis

### REDIS_URL

```env
REDIS_URL="redis://localhost:6379"
```

---

## 3. Server Configuration

### PORT

```env
PORT=3000
```

### NODE_ENV

```env
NODE_ENV="development"
```

- `development`: logging chi tiết hơn (stack trace trong error response).
- `production`: tối ưu runtime.

---

## Tổng hợp — File .env hoàn chỉnh

```env
# Database
DATABASE_URL="postgresql://game_user:change_me@localhost:5432/game"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
NODE_ENV="development"
```

**Lưu ý quan trọng:**

- File `.env` **không commit** lên Git.
- Dùng `.env.example` làm template.
- Mỗi môi trường (dev/staging/prod) có `.env` riêng.

---

## Troubleshooting

### Database connection failed

```bash
docker-compose ps
docker-compose logs postgres
```

### Redis connection failed

```bash
docker-compose exec redis redis-cli ping
```

### Migration failed

```bash
npx prisma migrate deploy
npx prisma generate
```

### Env không load

```bash
# File .env phải ở root api-starter-kit
ls -la .env
npm run start:dev
```
