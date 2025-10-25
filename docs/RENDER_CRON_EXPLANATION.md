# 📚 RENDER CRON JOBS - GIẢI THÍCH CHI TIẾT

## 🎯 1. Cron Jobs trên Render vs. Cron truyền thống

### **Cách truyền thống (VPS/Server riêng)**
```bash
# File: /etc/crontab hoặc crontab -e
0 8 * * * node /app/worker.js sendUpcomingTaskReminders
0 9 * * * node /app/worker.js sendOverdueTaskReminders
0 18 * * * node /app/worker.js sendDailySummary
*/5 * * * * node /app/worker.js sendMeetingReminders
```
- ✅ Tất cả chạy trong 1 server
- ✅ Không tốn thêm chi phí
- ❌ Phải tự quản lý cron daemon
- ❌ Khó scale

---

### **Cách của Render (Serverless Cron)**
```
Mỗi cron job = 1 service riêng biệt
├── Web Service: plantracker-backend
├── Cron Job 1: upcoming-task-reminders
├── Cron Job 2: overdue-task-reminders  
├── Cron Job 3: daily-summary
└── Cron Job 4: meeting-reminders
```
- ✅ Auto-scaling, không cần quản lý
- ✅ Logs riêng cho từng job
- ✅ Retry tự động khi fail
- ❌ Mỗi job tính phí riêng (nhưng rất rẻ)
- ❌ Phải setup qua UI/API

---

## 🔧 2. Setup chi tiết trên Render

### **Bước 1: Tạo Web Service (đã có)**
```
Service name: plantracker-backend
Type: Web Service
Port: 3000
Branch: develop
```

### **Bước 2: Tạo Cron Job (phải tạo RIÊNG BIỆT)**

#### **Cron Job #1: upcoming-task-reminders**

**Trên Render Dashboard:**
1. Click **"New +"** → Chọn **"Cron Job"**
2. Điền thông tin:

```yaml
Name: upcoming-task-reminders
Repository: sakanaowo/plantracker-backend
Branch: develop (hoặc master tùy bạn)
Language: Node

Build Command: npm install; npm run build
Command: curl -X POST https://YOUR_APP.onrender.com/api/worker/upcoming-task-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"

Schedule: 0 8 * * *  # Mỗi ngày 8:00 AM
Timezone: Asia/Ho_Chi_Minh

Instance Type: Starter ($0.00016/min)
```

3. **Environment Variables:**
```bash
WORKER_SECRET_TOKEN=abc123xyz789...
```

---

#### **Cron Job #2: overdue-task-reminders**

```yaml
Name: overdue-task-reminders
Command: curl -X POST https://YOUR_APP.onrender.com/api/worker/overdue-task-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
Schedule: 0 9 * * *  # Mỗi ngày 9:00 AM
```

---

#### **Cron Job #3: daily-summary**

```yaml
Name: daily-summary
Command: curl -X POST https://YOUR_APP.onrender.com/api/worker/daily-summary -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
Schedule: 0 18 * * *  # Mỗi ngày 6:00 PM
```

---

#### **Cron Job #4: meeting-reminders** (OPTIONAL - Tạo sau)

```yaml
Name: meeting-reminders
Command: curl -X POST https://YOUR_APP.onrender.com/api/worker/meeting-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
Schedule: */5 * * * *  # Mỗi 5 phút
```

⚠️ **LƯU Ý:** Job này chạy rất thường xuyên (288 lần/ngày), chi phí cao hơn!

---

## 💰 3. Chi phí ước tính

### **Starter Instance ($0.00016/min)**

**Cron Job 1: upcoming-task-reminders**
- Chạy: 1 lần/ngày
- Thời gian: ~30 giây/lần
- Chi phí: $0.00016 × 0.5 = **$0.00008/ngày** = **$0.0024/tháng**

**Cron Job 2: overdue-task-reminders**
- Chi phí: **~$0.0024/tháng**

**Cron Job 3: daily-summary**
- Chi phí: **~$0.0024/tháng**

**Cron Job 4: meeting-reminders** (mỗi 5 phút)
- Chạy: 288 lần/ngày
- Thời gian: ~10 giây/lần
- Chi phí: $0.00016 × (10/60) × 288 = **$0.077/ngày** = **$2.30/tháng** ⚠️

**TỔNG CHI PHÍ:**
- 3 jobs cơ bản: **$0.007/tháng** (gần như FREE)
- Thêm meeting-reminders: **+$2.30/tháng**

---

## 📝 4. Có phải tạo HẾT TẤT CẢ jobs không?

### ❌ **KHÔNG BẮT BUỘC!**

Bạn có thể:

### **Option 1: Tạo từng cái một (RECOMMENDED)**
```
Tuần 1: 
  ✅ upcoming-task-reminders
  ✅ overdue-task-reminders

Tuần 2:
  ✅ daily-summary

Tuần 3: 
  ⚠️ meeting-reminders (nếu cần)
```

### **Option 2: Tạo tất cả ngay**
```
✅ upcoming-task-reminders
✅ overdue-task-reminders  
✅ daily-summary
⚠️ meeting-reminders
```

### **Option 3: Tạo những gì cần thiết thôi**
```
✅ upcoming-task-reminders - QUAN TRỌNG
✅ overdue-task-reminders - QUAN TRỌNG
❌ daily-summary - Có thể bỏ nếu không cần
❌ meeting-reminders - Chưa implement EventsService
```

---

## 🔄 5. Flow hoạt động chi tiết

### **Ví dụ: upcoming-task-reminders chạy lúc 8:00 AM**

```
┌─────────────────────────────────────────────────────────┐
│  8:00 AM - Render Cron Scheduler                        │
│  Trigger cron job "upcoming-task-reminders"             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Cron Service chạy command:                             │
│  curl -X POST https://plantracker.onrender.com/api/...  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Web Service (NestJS) nhận request                      │
│  POST /api/worker/upcoming-task-reminders               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  WorkerController                                        │
│  @Post('upcoming-task-reminders')                       │
│  @UseGuards(WorkerAuthGuard)                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  WorkerAuthGuard kiểm tra header:                       │
│  Authorization: Bearer abc123xyz...                     │
│  So sánh với WORKER_SECRET_TOKEN                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  WorkerService.sendUpcomingTaskReminders()              │
│  1. Query database: tasks due in 24h                    │
│  2. Get user's FCM tokens                               │
│  3. Call NotificationsService                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  NotificationsService.sendTaskReminder()                │
│  1. Create notification record in DB                    │
│  2. Call FCMService.sendNotification()                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  FCMService gửi push notification                       │
│  → Firebase Cloud Messaging                             │
│  → User's mobile device                                 │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ 6. Environment Variables cần thiết

### **Web Service Environment Variables:**
```bash
# Database
NEON_DATABASE_URL="postgresql://user:pass@host/db"

# Firebase
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@..."

# Worker Authentication
WORKER_SECRET_TOKEN="abc123xyz789..."  # Dùng để xác thực cron jobs

# App
PORT=3000
NODE_ENV=production
```

### **Cron Jobs Environment Variables:**
```bash
# Mỗi cron job CHỈ CẦN biến này:
WORKER_SECRET_TOKEN="abc123xyz789..."  # PHẢI GIỐNG với Web Service
```

**LƯU Ý:** Token phải giống nhau giữa Web Service và Cron Jobs!

---

## 🧪 7. Test Cron Jobs

### **Test Manual (không đợi schedule)**

Render cho phép test cron job ngay lập tức:

1. Vào **Render Dashboard**
2. Chọn cron job (vd: `upcoming-task-reminders`)
3. Click **"Trigger Run"**
4. Xem logs để check kết quả

### **Test từ local:**

```bash
# Generate token
export WORKER_SECRET_TOKEN="abc123xyz789..."

# Test endpoint
curl -X POST http://localhost:3000/api/worker/upcoming-task-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN"

# Expected response:
{
  "message": "Upcoming task reminders sent successfully",
  "notificationsSent": 5
}
```

---

## 🐛 8. Troubleshooting

### **❌ Cron job fails với 401 Unauthorized**

**Nguyên nhân:** WORKER_SECRET_TOKEN không khớp

**Giải pháp:**
```bash
# 1. Check token trong Web Service
echo $WORKER_SECRET_TOKEN

# 2. Check token trong Cron Job
# Render Dashboard → Cron Job → Environment Variables

# 3. Đảm bảo giống nhau!
```

---

### **❌ Cron job chạy nhưng không gửi notification**

**Check logs:**
```bash
# Render Dashboard → Web Service → Logs
# Tìm request từ cron job:

[2025-01-23 08:00:01] POST /api/worker/upcoming-task-reminders
[2025-01-23 08:00:02] Found 5 upcoming tasks
[2025-01-23 08:00:03] Sending notification to user 123
[2025-01-23 08:00:04] FCM Error: Invalid token
```

**Nguyên nhân thường gặp:**
1. User chưa có FCM token (chưa login app)
2. FCM token expired
3. Firebase credentials sai

---

### **❌ Timezone sai (cron chạy sai giờ)**

**Giải pháp:**
```yaml
# Trong Cron Job settings:
Timezone: Asia/Ho_Chi_Minh

# Hoặc Asia/Bangkok (cùng múi giờ)
```

---

## 📋 9. Checklist Setup Cron Jobs

### **Trước khi setup:**
- [ ] Web Service đã deploy thành công
- [ ] Worker endpoints hoạt động (`/api/worker/*`)
- [ ] Generate WORKER_SECRET_TOKEN: `openssl rand -hex 32`
- [ ] Thêm token vào Web Service environment variables

### **Setup từng Cron Job:**
- [ ] Tạo cron job trên Render Dashboard
- [ ] Chọn repository và branch
- [ ] Điền command với curl (có Authorization header)
- [ ] Điền cron schedule
- [ ] Chọn timezone: Asia/Ho_Chi_Minh
- [ ] Thêm environment variable: WORKER_SECRET_TOKEN
- [ ] Chọn instance type: Starter
- [ ] Save và trigger test run

### **Sau khi setup:**
- [ ] Test manual trigger từ Render Dashboard
- [ ] Check logs của Web Service
- [ ] Verify notifications được gửi (check mobile app)
- [ ] Monitor trong 1-2 ngày đầu

---

## 🎯 10. Kết luận

### **TÓM TẮT:**

1. **Cron jobs KHÔNG chạy trong Web Service** - Phải tạo riêng
2. **Mỗi cron job = 1 service riêng** trên Render
3. **Không bắt buộc tạo tất cả** - Tạo từng cái một
4. **Chi phí rất rẻ** cho các job chạy 1 lần/ngày
5. **meeting-reminders tốn resource** - Cân nhắc có cần không

### **RECOMMENDED APPROACH:**

**Tuần 1:**
```bash
✅ Setup Web Service với worker endpoints
✅ Tạo 2 cron jobs quan trọng:
   - upcoming-task-reminders (8:00 AM)
   - overdue-task-reminders (9:00 AM)
✅ Test và monitor
```

**Tuần 2:**
```bash
✅ Thêm daily-summary (6:00 PM)
⚠️ Cân nhắc meeting-reminders (tốn chi phí)
```

---

## 📞 Next Steps

1. **Deploy Web Service** với worker endpoints
2. **Generate WORKER_SECRET_TOKEN**
3. **Tạo upcoming-task-reminders** cron job đầu tiên
4. **Test manual trigger**
5. **Lặp lại cho các jobs khác**

Bạn có câu hỏi nào về setup không? 🚀
