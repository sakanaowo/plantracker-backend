# 🧪 Testing Worker/Cron Job Implementation

Hướng dẫn test toàn bộ Worker Service, Notifications Service, và FCM integration.

---

## 📋 **Chuẩn Bị**

### 1. **Thêm Environment Variables vào `.env`**

```bash
# Copy từ .env.example
cp .env.example .env

# Hoặc thêm thủ công vào .env:
WORKER_SECRET_TOKEN=test_token_for_local_development_12345

# Firebase (nếu muốn test FCM thật)
FIREBASE_PROJECT_ID=plantracker-e8da1
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@plantracker-e8da1.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 2. **Start Development Server**

```bash
npm run start:dev
```

Server sẽ chạy tại `http://localhost:3000`

---

## 🎯 **Cấp độ Test**

### **Level 1: Test Endpoints (Không cần Firebase)**

Test authentication và routing của worker endpoints.

#### **Option A: Dùng REST Client (VS Code Extension)**

1. Install extension: **REST Client**
2. Mở file: `test-scripts/test-worker-endpoints.http`
3. Update token: `@workerToken = your_token_from_env_file`
4. Click "Send Request" trên mỗi endpoint

#### **Option B: Dùng PowerShell Script**

```bash
# Chỉnh sửa token trong file test-worker.ps1
$workerToken = "test_token_for_local_development_12345"

# Chạy script
./test-scripts/test-worker.ps1
```

#### **Option C: Dùng curl**

```bash
# 1. Health Check
curl -X POST http://localhost:3000/worker/health \
  -H "Authorization: Bearer test_token_for_local_development_12345" \
  -H "Content-Type: application/json"

# Expected: { "status": "healthy", "timestamp": "...", "service": "worker" }

# 2. Test Unauthorized (No Token)
curl -X POST http://localhost:3000/worker/health \
  -H "Content-Type: application/json"

# Expected: 401 Unauthorized

# 3. Upcoming Reminders
curl -X POST http://localhost:3000/worker/upcoming-reminders \
  -H "Authorization: Bearer test_token_for_local_development_12345" \
  -H "Content-Type: application/json"

# Expected: { "job": "upcoming-reminders", "timestamp": "...", "success": true, ... }
```

---

### **Level 2: Test Database Queries (Mock Test)**

Test các query Prisma mà không gửi FCM thực tế.

```bash
# Chạy mock test
npx ts-node test-scripts/test-worker-queries.ts
```

**Test này sẽ kiểm tra:**
- ✅ Query upcoming tasks (due trong 24h)
- ✅ Query overdue tasks
- ✅ Query users có active tasks
- ✅ Check FCM token availability

**Output mẫu:**
```
╔════════════════════════════════════════╗
║   Worker Service Mock Test Suite      ║
║   Testing Database Queries Only       ║
╚════════════════════════════════════════╝

========================================
TEST 1: Query Upcoming Tasks (Due within 24h)
========================================

✅ Found 5 upcoming tasks

Sample tasks:

1. Task: Complete API documentation
   Due: 2025-10-21T15:00:00.000Z
   Project: Backend Development
   Assignee: John Doe
   Has FCM Token: ✅

...
```

---

### **Level 3: Test với Firebase/FCM Thật**

Cần Firebase Service Account Key.

#### **Bước 1: Setup Firebase**

1. Vào [Firebase Console](https://console.firebase.google.com)
2. Chọn project **plantracker-e8da1**
3. **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download JSON file

#### **Bước 2: Cấu hình trong .env**

```bash
FIREBASE_PROJECT_ID=plantracker-e8da1
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@plantracker-e8da1.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----"
```

**LƯU Ý:** `FIREBASE_PRIVATE_KEY` phải có `\n` cho line breaks!

#### **Bước 3: Có FCM Token trong Database**

User cần register device với FCM token:

```sql
-- Check if user has FCM token
SELECT u.name, ud.fcm_token, ud.is_active 
FROM users u
LEFT JOIN user_devices ud ON u.id = ud.user_id
WHERE ud.is_active = true;

-- Nếu không có, thêm test token (chỉ để test)
INSERT INTO user_devices (user_id, fcm_token, platform, is_active)
VALUES (
  'user-uuid-here', 
  'test_fcm_token_from_android_device',
  'ANDROID',
  true
);
```

#### **Bước 4: Test FCM**

```bash
# Gửi upcoming reminders
curl -X POST http://localhost:3000/worker/upcoming-reminders \
  -H "Authorization: Bearer test_token_for_local_development_12345" \
  -H "Content-Type: application/json"

# Check logs
# Nếu thành công: "Successfully sent notification: ..."
# Nếu lỗi: "Failed to send notification: ..."
```

---

## 📊 **Expected Results**

### **1. Health Check**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T10:00:00.000Z",
  "service": "worker"
}
```

### **2. Upcoming Reminders**
```json
{
  "job": "upcoming-reminders",
  "timestamp": "2025-10-21T10:00:00.000Z",
  "success": true,
  "sent": 5,
  "failed": 0
}
```

### **3. Unauthorized (401)**
```json
{
  "statusCode": 401,
  "message": "Invalid worker token",
  "error": "Unauthorized"
}
```

---

## 🐛 **Troubleshooting**

### **Error: "Module not found: NotificationsService"**
```bash
npm run build
# Nếu vẫn lỗi, restart server
```

### **Error: "WORKER_SECRET_TOKEN not configured"**
```bash
# Thêm vào .env
echo "WORKER_SECRET_TOKEN=test_token_12345" >> .env
# Restart server
```

### **Error: "Failed to initialize Firebase Admin SDK"**
```bash
# Check Firebase credentials trong .env
# Đảm bảo FIREBASE_PRIVATE_KEY có \n
```

### **No tasks found in test**
```sql
-- Tạo test task
INSERT INTO tasks (project_id, board_id, title, assignee_id, due_at, status)
VALUES (
  'project-uuid',
  'board-uuid', 
  'Test Task',
  'user-uuid',
  NOW() + INTERVAL '12 hours',
  'TO_DO'
);
```

---

## ✅ **Testing Checklist**

- [ ] Server chạy thành công (`npm run start:dev`)
- [ ] WORKER_SECRET_TOKEN đã thêm vào .env
- [ ] Health check endpoint trả về 200
- [ ] Unauthorized request trả về 401
- [ ] Wrong token trả về 401
- [ ] Mock test queries chạy không lỗi
- [ ] Database có tasks để test
- [ ] (Optional) Firebase configured
- [ ] (Optional) FCM tokens trong database
- [ ] (Optional) Notifications được gửi thành công

---

## 📝 **Next Steps**

Sau khi test local thành công:

1. **Deploy lên Render**
2. **Thêm Environment Variables trên Render Dashboard**
3. **Tạo Cron Jobs trên Render**
4. **Test production endpoints**

Chi tiết: Xem `docs/RENDER_CRON_WORKER_FCM_SETUP.md`
