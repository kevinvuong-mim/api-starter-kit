# Hướng dẫn sử dụng Docker cho Database và Redis

Tài liệu này hướng dẫn cách sử dụng Docker để chạy PostgreSQL và Redis cho dự án game-api.

## Tại sao nên dùng Docker?

- ✅ Không cần cài đặt PostgreSQL/Redis trực tiếp trên máy
- ✅ Dễ dàng khởi động và dừng các service
- ✅ Cấu hình nhất quán giữa các môi trường
- ✅ Dễ dàng xóa và tạo lại database
- ✅ Không ảnh hưởng đến các PostgreSQL/Redis instance khác trên máy

## Yêu cầu

- **Docker** đã được cài đặt
- **Docker Compose** (thường đi kèm với Docker Desktop)

### Cài đặt Docker

**macOS:**

```bash
# Sử dụng Homebrew
brew install --cask docker

# Hoặc tải Docker Desktop từ:
# https://www.docker.com/products/docker-desktop
```

**Linux (Ubuntu/Debian):**

```bash
# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cài đặt Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Thêm user vào docker group để chạy không cần sudo
sudo usermod -aG docker $USER
```

**Windows:**

- Tải và cài đặt [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)

## Cấu hình Docker Compose

File `docker-compose.yml` đã được tạo sẵn trong thư mục gốc của dự án với cấu hình:

```yaml
version: '3.8'

services:
  postgres:
    ports:
      - '5432:5432'
    restart: unless-stopped
    image: postgres:16-alpine
    container_name: game-postgres
    environment:
      POSTGRES_DB: game
      POSTGRES_USER: kwong2000
      POSTGRES_PASSWORD: 1234abcd
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      retries: 5
      timeout: 5s
      interval: 10s
      test: ['CMD-SHELL', 'pg_isready -U postgres']

  redis:
    ports:
      - '6379:6379'
    restart: unless-stopped
    image: redis:8.6-alpine
    container_name: game-redis
    volumes:
      - redis_data:/data
    healthcheck:
      retries: 5
      timeout: 5s
      interval: 10s
      test: ['CMD', 'redis-cli', 'ping']

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### Thông tin kết nối

Khi sử dụng Docker, các service sẽ có thông tin kết nối:

**PostgreSQL:**

- **Port**: `5432`
- **Host**: `localhost`
- **Database**: `game`
- **Password**: `1234abcd`
- **Username**: `kwong2000`

**Redis:**

- **Port**: `6379`
- **Host**: `localhost`
- **URL**: `redis://localhost:6379`

**Connection String cho .env:**

```env
DATABASE_URL="postgresql://kwong2000:1234abcd@localhost:5432/game"
REDIS_URL="redis://localhost:6379"
```

## Sử dụng

### 1. Khởi động services

```bash
docker-compose up -d
```

- Flag `-d` để chạy ở chế độ background (detached)
- Lần đầu tiên sẽ mất vài giây để tải PostgreSQL và Redis images

### 2. Kiểm tra trạng thái

```bash
# Xem các container đang chạy
docker-compose ps

# Hoặc
docker ps
```

Bạn sẽ thấy 2 container `game-postgres` và `game-redis` đang chạy.

### 3. Xem logs

```bash
# Xem logs realtime cho tất cả service
docker-compose logs -f

# Xem logs realtime cho PostgreSQL
docker-compose logs -f postgres

# Xem logs realtime cho Redis
docker-compose logs -f redis

# Chỉ xem logs PostgreSQL (không follow)
docker-compose logs postgres
```

### 4. Dừng services

```bash
# Dừng nhưng giữ lại data
docker-compose stop

# Dừng và xóa container (data vẫn được giữ trong volume)
docker-compose down
```

### 5. Khởi động lại

```bash
# Nếu đã stop
docker-compose start

# Hoặc dùng up lại
docker-compose up -d
```

### 6. Kiểm tra Redis

```bash
# Test Redis từ trong container
docker-compose exec redis redis-cli ping

# Kết quả mong đợi
PONG
```

## Các lệnh hữu ích

### Kết nối vào PostgreSQL CLI

```bash
# Từ docker-compose
docker-compose exec postgres psql -U kwong2000 -d game

# Hoặc từ docker
docker exec -it game-postgres psql -U kwong2000 -d game
```

Sau đó bạn có thể chạy SQL commands:

```sql
-- Xem tất cả tables
\dt

-- Xem schema của table
\d users

-- Query
SELECT * FROM users;

-- Thoát
\q
```

### Xóa tất cả data và khởi động lại

```bash
# Dừng và xóa containers + volumes
docker-compose down -v

# Khởi động lại
docker-compose up -d

# Chạy lại migrations
npm run prisma:migrate
```

### Backup database

```bash
# Export database ra file
docker-compose exec postgres pg_dump -U kwong2000 game > backup.sql

# Hoặc với timestamp
docker-compose exec postgres pg_dump -U kwong2000 game > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore database từ backup

```bash
# Import từ file backup
docker-compose exec -T postgres psql -U kwong2000 game < backup.sql
```

### Kết nối vào Redis CLI

```bash
docker-compose exec redis redis-cli
```

Một số lệnh Redis cơ bản:

```txt
PING
SET health ok
GET health
KEYS *
EXIT
```

### Thay đổi mật khẩu

Nếu muốn thay đổi mật khẩu, sửa trong `docker-compose.yml`:

```yaml
environment:
  POSTGRES_PASSWORD: your-new-password
```

Sau đó:

```bash
docker-compose down -v
docker-compose up -d
```

Và cập nhật `DATABASE_URL` trong `.env`:

## Troubleshooting

### Port 5432 đã được sử dụng

**Lỗi:** `Error starting userland proxy: listen tcp4 0.0.0.0:5432: bind: address already in use`

**Nguyên nhân:** Đã có PostgreSQL khác đang chạy trên port 5432

**Giải pháp 1:** Dừng PostgreSQL local

```bash
# macOS
brew services stop postgresql

# Linux
sudo systemctl stop postgresql

# Hoặc tìm và kill process
lsof -i :5432
kill -9 <PID>
```

**Giải pháp 2:** Đổi port trong docker-compose.yml

```yaml
ports:
  - '5433:5432' # Đổi từ 5432 thành 5433
```

Và cập nhật `DATABASE_URL`:

```env
DATABASE_URL="postgresql://kwong2000:1234abcd@localhost:5433/game"
```

### Port 6379 đã được sử dụng

**Lỗi:** `Error starting userland proxy: listen tcp4 0.0.0.0:6379: bind: address already in use`

**Nguyên nhân:** Đã có Redis local đang chạy trên port 6379

**Giải pháp 1:** Dừng Redis local

```bash
# macOS (Homebrew)
brew services stop redis

# Linux
sudo systemctl stop redis
```

**Giải pháp 2:** Đổi port trong docker-compose.yml

```yaml
ports:
  - '6380:6379'
```

Và cập nhật `REDIS_URL`:

```env
REDIS_URL="redis://localhost:6380"
```

### Container không start

```bash
# Xem logs để debug
docker-compose logs postgres

# Xóa và tạo lại
docker-compose down -v
docker-compose up -d
```

### Permission denied khi chạy docker commands

**Linux only:**

```bash
# Thêm user vào docker group
sudo usermod -aG docker $USER

# Logout và login lại
# Hoặc chạy:
newgrp docker
```

### Container chạy nhưng không kết nối được

```bash
# Kiểm tra healthcheck
docker-compose ps

# Nếu unhealthy, xem logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U kwong2000

# Test Redis
docker-compose exec redis redis-cli ping
```

### Data bị mất sau khi restart

**Nguyên nhân:** Chạy `docker-compose down -v` sẽ xóa volumes

**Giải pháp:**

- Chỉ dùng `docker-compose down` (không có flag `-v`)
- Hoặc dùng `docker-compose stop` thay vì `down`

## Lưu ý quan trọng

### Development vs Production

- ⚠️ Cấu hình này chỉ dành cho **development**
- ⚠️ **KHÔNG** dùng mật khẩu `postgres` cho production
- ⚠️ Production nên dùng managed database (AWS RDS, Google Cloud SQL, etc.)

### Security

- Mật khẩu mặc định `1234abcd` chỉ dùng cho local development
- Không expose port 5432 ra internet
- Không expose port 6379 ra internet
- Không commit `.env` với credentials vào Git

### Performance

- Docker trên macOS có thể chậm hơn native PostgreSQL
- Nếu cần performance tốt hơn, cân nhắc cài PostgreSQL native
- Volume mount được tối ưu cho development, chưa optimize cho production

### Data Persistence

- Data được lưu trong Docker volume `postgres_data`
- Data Redis được lưu trong Docker volume `redis_data`
- Volume tồn tại ngay cả khi container bị xóa
- Chỉ mất data khi chạy `docker-compose down -v` hoặc xóa volume thủ công

## Tóm tắt Commands

```bash
# Khởi động
docker-compose up -d

# Dừng (giữ data)
docker-compose stop

# Dừng và xóa container (giữ data)
docker-compose down

# Xóa tất cả (bao gồm data)
docker-compose down -v

# Xem logs
docker-compose logs -f postgres

# Xem logs Redis
docker-compose logs -f redis

# Kiểm tra status
docker-compose ps

# Kết nối PostgreSQL CLI
docker-compose exec postgres psql -U kwong2000 -d game

# Kết nối Redis CLI
docker-compose exec redis redis-cli

# Test Redis
docker-compose exec redis redis-cli ping

# Backup
docker-compose exec postgres pg_dump -U kwong2000 game > backup.sql

# Restore
docker-compose exec -T postgres psql -U kwong2000 game < backup.sql
```

---

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [pgAdmin Docker Image](https://hub.docker.com/r/dpage/pgadmin4/)
