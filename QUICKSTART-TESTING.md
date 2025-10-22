# 🚀 Quick Start - Test Worker Endpoints

## ⚡ Fastest Way to Test (5 phút)

### 1️⃣ **Thêm token vào .env**

Mở file `.env` và thêm dòng này:

```bash
WORKER_SECRET_TOKEN=test_token_12345
```

### 2️⃣ **Start server**

```bash
npm run start:dev
```

### 3️⃣ **Test với curl**

Mở terminal mới và chạy:

```bash
# Test 1: Health Check (Should return 200)
curl -X POST http://localhost:3000/worker/health -H "Authorization: Bearer test_token_12345" -H "Content-Type: application/json"

# Test 2: Without token (Should return 401)
curl -X POST http://localhost:3000/worker/health -H "Content-Type: application/json"
```

### ✅ **Nếu thấy response → SUCCESS!**

```json
// Test 1 response:
{
  "status": "healthy",
  "timestamp": "2025-10-21T...",
  "service": "worker"
}

// Test 2 response:
{
  "statusCode": 401,
  "message": "Invalid worker token",
  "error": "Unauthorized"
}
```

---

## 📱 **Test với REST Client (VS Code)**

1. Install extension: **REST Client**
2. Mở: `test-scripts/test-worker-endpoints.http`
3. Đổi dòng 6:
   ```
   @workerToken = test_token_12345
   ```
4. Click "Send Request" ở mỗi endpoint

---

## 🎯 **Test tất cả endpoints**

```bash
# Copy token vào biến
$TOKEN="test_token_12345"
$URL="http://localhost:3000"

# 1. Health check
curl -X POST $URL/worker/health -H "Authorization: Bearer $TOKEN"

# 2. Upcoming reminders  
curl -X POST $URL/worker/upcoming-reminders -H "Authorization: Bearer $TOKEN"

# 3. Overdue reminders
curl -X POST $URL/worker/overdue-reminders -H "Authorization: Bearer $TOKEN"

# 4. Daily summary
curl -X POST $URL/worker/daily-summary -H "Authorization: Bearer $TOKEN"
```

---

## 🐛 **Lỗi thường gặp**

### Server không start?
```bash
npm run build
npm run start:dev
```

### 401 Unauthorized với token đúng?
```bash
# Check token trong .env có khớp không
cat .env | grep WORKER_SECRET_TOKEN
```

### Module not found?
```bash
npm install
npm run build
```

---

## 📖 **Xem thêm**

- Chi tiết: `test-scripts/README-TESTING.md`
- Implementation: `docs/CRON_WORKER_SCHEMA_MAPPING.md`
- Setup production: `docs/RENDER_CRON_WORKER_FCM_SETUP.md`
