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

### CORS_ORIGINS

Danh sách origin được phép gọi API từ trình duyệt, phân tách bằng dấu phẩy. Production nên dùng HTTPS origin cụ thể.

```env
CORS_ORIGINS="https://my-game.example.com,https://admin.example.com"
```

Trong development, nếu không cấu hình thì API cho phép mọi origin để thuận tiện chạy local.

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
CORS_ORIGINS="http://localhost:5173"
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
