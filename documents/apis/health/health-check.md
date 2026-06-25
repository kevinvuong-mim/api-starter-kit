# Health Check API Documentation

## Overview

API kiểm tra trạng thái hoạt động của server. Dùng cho health probe, load balancer, hoặc xác nhận service đã sẵn sàng nhận request.

**Base URL**: `/api`

---

## Endpoint

### Health Check (Kiểm tra server)

Trả về chuỗi xác nhận server đang chạy.

**Endpoint**: `GET /api`

**Authentication**: Không yêu cầu (Public)

**Rate Limit**: 100 requests / phút / IP (global throttler)

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": "Hello World!",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api"
}
```

#### Response Schema

| Field     | Type    | Description                                      |
| --------- | ------- | ------------------------------------------------ |
| success   | boolean | Luôn `true` khi request thành công               |
| statusCode| number  | HTTP status code                                 |
| message   | string  | Thông báo mặc định theo HTTP method              |
| data      | string  | Nội dung health check (`"Hello World!"`)         |
| timestamp | string  | Thời điểm response (ISO 8601)                  |
| path      | string  | Đường dẫn request                                |

**Error Responses**

- **429 Too Many Requests**: Vượt quá rate limit

```json
{
  "success": false,
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests",
  "timestamp": "2026-06-25T12:00:00.000Z",
  "path": "/api"
}
```

#### cURL Example

```bash
curl http://localhost:3000/api
```

---

## Business Logic

1. **Route handler**: `AppController.getHello()` gọi `AppService.getHello()`
2. **Return value**: Chuỗi `"Hello World!"`
3. **Auto-wrap response**: `ResponseInterceptor` bọc kết quả vào standard format

---

## Related Endpoints

- **POST /api/guest/init**: Khởi tạo guest player (trả về `guestId` + `sessionToken`)
- **GET /api/leaderboard/global**: Lấy bảng xếp hạng (pagination, optional `sessionToken` cho `myRank`)

---

## Notes

- **Read-only endpoint**: Chỉ GET, không modify data
- **No authentication**: Có thể gọi mà không cần token
- **Global prefix**: Tất cả routes đều có prefix `/api` (cấu hình trong `main.ts`)
- **Automatic wrapping**: Response được wrap bởi `ResponseInterceptor`
- **CORS**: Server cho phép headers `Content-Type` và `Authorization`
