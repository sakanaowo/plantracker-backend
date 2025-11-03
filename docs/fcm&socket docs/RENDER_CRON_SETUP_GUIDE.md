# ⏰ HƯỚNG DẪN CẤU HÌNH RENDER CRON JOBS

**Mục đích:** Setup scheduled jobs để tự động gửi notifications  
**Platform:** Render.com  
**Service Type:** Cron Jobs  
**Last Updated:** October 23, 2025

---

## 📋 MỤC LỤC

1. [Tổng Quan](#tổng-quan)
2. [Yêu Cầu Trước Khi Setup](#yêu-cầu-trước-khi-setup)
3. [Setup Environment Variables](#setup-environment-variables)
4. [Tạo Cron Jobs](#tạo-cron-jobs)
5. [Testing & Monitoring](#testing--monitoring)
6. [Troubleshooting](#troubleshooting)

---

## 📊 TỔNG QUAN

### Cron Jobs Cần Tạo

| Job Name | Schedule | Purpose | Endpoint |
|----------|----------|---------|----------|
| **upcoming-task-reminders** | Daily 8AM | Nhắc tasks sắp đến hạn | `/worker/upcoming-reminders` |
| **overdue-task-reminders** | Daily 9AM | Nhắc tasks quá hạn | `/worker/overdue-reminders` |
| **daily-summary** | Daily 6PM | Tổng kết ngày | `/worker/daily-summary` |
| **meeting-reminders** | Every 5 min | Nhắc meetings sắp diễn ra | `/worker/meeting-reminders` |

### Cron Schedule Syntax

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

**Ví dụ:**
```bash
0 8 * * *     # Every day at 8:00 AM
0 9 * * *     # Every day at 9:00 AM
0 18 * * *    # Every day at 6:00 PM
*/5 * * * *   # Every 5 minutes
*/15 * * * *  # Every 15 minutes
0 */2 * * *   # Every 2 hours
0 9-17 * * *  # Every hour from 9 AM to 5 PM
0 8 * * 1-5   # 8 AM on weekdays only
```

---

## ✅ YÊU CẦU TRƯỚC KHI SETUP

### 1. Backend API đã deploy

- ✅ Web service đang chạy trên Render
- ✅ URL: `https://your-app.onrender.com`
- ✅ Health check endpoint hoạt động: `GET /api/worker/health`

### 2. Worker Endpoints đã implement

Verify các endpoints này tồn tại:

```bash
# Test locally first
curl -X POST http://localhost:3000/api/worker/upcoming-reminders \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"

curl -X POST http://localhost:3000/api/worker/overdue-reminders \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"

curl -X POST http://localhost:3000/api/worker/daily-summary \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"

curl -X POST http://localhost:3000/api/worker/meeting-reminders \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

### 3. WORKER_SECRET_TOKEN đã tạo

Generate strong token:

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Using online tool
# https://www.random.org/strings/
```

**Example output:**
```
a7f3e8d9c2b1f4e6a8d3c5b9e1f7a4d2c8b6e3f1a9d5c7b2e4f6a1d8c3b9e5f7a2
```

**⚠️ Lưu ý:**
- Dài tối thiểu 32 ký tự
- Chứa chữ và số
- Không share public
- Same token cho cả web service và cron jobs

---

## 🔧 SETUP ENVIRONMENT VARIABLES

### Bước 1: Vào Render Dashboard

1. Login: https://dashboard.render.com
2. Click vào **Web Service** của bạn (plantracker-backend)

### Bước 2: Add Environment Variables

Navigate: **Environment** tab → **Add Environment Variable**

**Required Variables:**

```bash
# 1. Worker Authentication
WORKER_SECRET_TOKEN=a7f3e8d9c2b1f4e6a8d3c5b9e1f7a4d2c8b6e3f1a9d5c7b2e4f6a1d8c3b9e5f7a2

# 2. Firebase (already exist, verify)
FIREBASE_PROJECT_ID=plantracker-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@plantracker.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# 3. Database (already exist)
NEON_DATABASE_URL=postgresql://user:password@host:5432/database

# 4. Server
PORT=3000
NODE_ENV=production
```

### Bước 3: Save & Deploy

- Click **Save Changes**
- Render sẽ tự động redeploy service
- Đợi deploy complete (check Logs tab)

---

## 🔨 TẠO CRON JOBS

### JOB 1: Upcoming Task Reminders

**Mục đích:** Gửi notification cho tasks sắp đến hạn trong 24h

#### Bước 1: Create New Cron Job

1. Từ Dashboard → Click **New** → **Cron Job**
2. Hoặc: Service menu → **Cron Jobs** → **New Cron Job**

#### Bước 2: Basic Configuration

```
Name: upcoming-task-reminders
Environment: [Select existing environment or create new]
Region: [Same as your web service - e.g., Oregon (US West)]
```

#### Bước 3: Schedule Configuration

```
Schedule: 0 8 * * *
Timezone: [Your timezone - e.g., Asia/Ho_Chi_Minh]
```

**Giải thích:**
- `0 8 * * *` = Every day at 8:00 AM
- Timezone: Convert to user timezone (Vietnam = UTC+7)

#### Bước 4: Command

**⚠️ QUAN TRỌNG:** Thay `your-app.onrender.com` bằng URL thực tế của bạn

```bash
curl -X POST https://your-app.onrender.com/api/worker/upcoming-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Giải thích:**
- `-X POST`: HTTP method
- `-H "Authorization: Bearer $WORKER_SECRET_TOKEN"`: Authentication
- `-H "Content-Type: application/json"`: Request header
- `-w "\nHTTP Status: %{http_code}\n"`: Show response status code

#### Bước 5: Environment Variables

Add environment variable:

```
Key: WORKER_SECRET_TOKEN
Value: [Same value as web service]
```

**⚠️ Lưu ý:** Giá trị phải GIỐNG NHAU giữa web service và cron job

#### Bước 6: Create Job

- Click **Create Cron Job**
- Đợi job được tạo
- Verify trong Jobs list

---

### JOB 2: Overdue Task Reminders

**Mục đích:** Gửi notification cho tasks đã quá hạn

**Configuration:**

```
Name: overdue-task-reminders
Environment: [Same as Job 1]
Region: [Same as Job 1]
Schedule: 0 9 * * *
Timezone: Asia/Ho_Chi_Minh

Command:
curl -X POST https://your-app.onrender.com/api/worker/overdue-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

Environment Variables:
WORKER_SECRET_TOKEN=[Same value]
```

---

### JOB 3: Daily Summary

**Mục đích:** Gửi tổng kết ngày cho users

**Configuration:**

```
Name: daily-summary
Environment: [Same as above]
Region: [Same as above]
Schedule: 0 18 * * *
Timezone: Asia/Ho_Chi_Minh

Command:
curl -X POST https://your-app.onrender.com/api/worker/daily-summary \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

Environment Variables:
WORKER_SECRET_TOKEN=[Same value]
```

---

### JOB 4: Meeting Reminders (Optional - Phase 3)

**Mục đích:** Gửi notification 15 phút trước meeting

**⚠️ Lưu ý:** Chỉ tạo job này sau khi implement endpoint `/worker/meeting-reminders`

**Configuration:**

```
Name: meeting-reminders
Environment: [Same as above]
Region: [Same as above]
Schedule: */5 * * * *
Timezone: Asia/Ho_Chi_Minh

Command:
curl -X POST https://your-app.onrender.com/api/worker/meeting-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

Environment Variables:
WORKER_SECRET_TOKEN=[Same value]
```

**⚠️ Warning:** Job chạy mỗi 5 phút = 288 lần/ngày = có thể ảnh hưởng Render free tier quota

---

## 🧪 TESTING & MONITORING

### 1. Manual Trigger

**Bước 1:** Vào Cron Job detail page

Dashboard → Cron Jobs → [Select job]

**Bước 2:** Click "Trigger Run"

Wait for execution to complete

**Bước 3:** Check Logs

```
2024-10-23 08:00:01 Starting job run...
2024-10-23 08:00:02 Executing command: curl -X POST...
2024-10-23 08:00:05 HTTP Status: 200
2024-10-23 08:00:05 {"job":"upcoming-reminders","sent":5,"failed":0}
2024-10-23 08:00:05 Job completed successfully
```

**Expected Output:**
```json
{
  "job": "upcoming-reminders",
  "timestamp": "2024-10-23T08:00:05.123Z",
  "success": true,
  "sent": 5,
  "failed": 0
}
```

### 2. Verify Web Service Logs

**Bước 1:** Go to Web Service → Logs tab

**Bước 2:** Search for worker logs

```bash
# Filter logs
grep "worker" 

# Example logs
[WorkerService] Starting upcoming task reminders job...
[WorkerService] Found 5 upcoming tasks
[WorkerService] Sent reminder for task abc-123 to user xyz-456
[WorkerService] Job completed: 5 sent, 0 failed
```

### 3. Check Database

**Option 1: Using Prisma Studio**

```bash
# Local
npx prisma studio

# Navigate to notifications table
# Filter by: created_at >= today
```

**Option 2: Direct SQL**

```sql
-- Recent notifications
SELECT 
  type,
  title,
  body,
  status,
  created_at,
  user_id
FROM notifications
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC
LIMIT 20;

-- Count by type
SELECT 
  type,
  COUNT(*) as total
FROM notifications
WHERE created_at >= CURRENT_DATE
GROUP BY type;
```

### 4. Check Firebase Console

1. Go to: https://console.firebase.google.com
2. Select project: plantracker
3. Navigate: **Cloud Messaging** → **Analytics**
4. Check:
   - Sent notifications count
   - Delivery rate
   - Open rate

### 5. Test on Android App

**Bước 1:** Install app on test device

**Bước 2:** Login với user có tasks sắp đến hạn

**Bước 3:** Trigger cron job manually

**Bước 4:** Verify notification received

**Expected:**
- Notification appears in status bar
- Sound/vibration (if enabled)
- Click notification → Opens task detail

---

## 📊 MONITORING

### 1. Render Dashboard

**Metrics to monitor:**

- **Success Rate**: Should be ~100%
- **Execution Time**: Should be < 30s
- **Last Run**: Check if job runs on schedule

**Alert Setup:**

1. Go to: Cron Job → **Alerts**
2. Enable: "Notify on failure"
3. Add email/Slack webhook

### 2. Custom Logging

Add logging to worker endpoints:

```typescript
// src/modules/worker/worker.controller.ts

@Post('upcoming-reminders')
async sendUpcomingReminders(@Headers('authorization') authHeader: string) {
  this.logger.log('=== CRON JOB TRIGGERED: upcoming-reminders ===');
  this.logger.log(`Timestamp: ${new Date().toISOString()}`);
  
  const result = await this.workerService.sendUpcomingTaskReminders();
  
  this.logger.log('=== CRON JOB COMPLETED ===');
  this.logger.log(`Result: ${JSON.stringify(result)}`);
  
  return {
    job: 'upcoming-reminders',
    timestamp: new Date().toISOString(),
    ...result,
  };
}
```

### 3. Error Tracking

**Setup Sentry (Optional):**

```bash
npm install @sentry/node
```

```typescript
// main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## 🐛 TROUBLESHOOTING

### Issue 1: Job fails với "401 Unauthorized"

**Lỗi:**
```
HTTP Status: 401
{"statusCode":401,"message":"Unauthorized"}
```

**Nguyên nhân:**
- WORKER_SECRET_TOKEN không đúng
- Token không match giữa cron job và web service
- Header Authorization sai format

**Giải pháp:**

1. Verify token trong web service:
   ```bash
   # Check environment variable
   echo $WORKER_SECRET_TOKEN
   ```

2. Verify token trong cron job:
   - Dashboard → Cron Job → Environment
   - Check `WORKER_SECRET_TOKEN` value

3. Ensure format đúng:
   ```bash
   # CORRECT
   Authorization: Bearer abc123...
   
   # WRONG
   Authorization: abc123...  # Missing "Bearer "
   ```

---

### Issue 2: Job timeout

**Lỗi:**
```
Error: Request timeout after 30s
```

**Nguyên nhân:**
- Backend service sleep (cold start)
- Query quá lâu
- Network issues

**Giải pháp:**

1. **Add retry logic:**

```bash
curl -X POST https://your-app.onrender.com/api/worker/upcoming-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN" \
  --max-time 60 \
  --retry 3 \
  --retry-delay 5
```

2. **Keep backend warm:**

Create additional cron job:

```
Name: keep-alive
Schedule: */10 * * * *  # Every 10 minutes
Command: curl https://your-app.onrender.com/api/worker/health
```

3. **Optimize query:**

```typescript
// Use select to limit fields
const tasks = await this.prisma.tasks.findMany({
  where: { ... },
  select: {
    id: true,
    title: true,
    due_at: true,
    // Only select needed fields
  },
});
```

---

### Issue 3: Job runs but no notifications sent

**Debug steps:**

1. **Check worker endpoint response:**

```bash
curl -X POST https://your-app.onrender.com/api/worker/upcoming-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN" \
  -v  # Verbose mode
```

Expected response:
```json
{
  "job": "upcoming-reminders",
  "success": true,
  "sent": 5,
  "failed": 0
}
```

2. **Check if tasks exist:**

```sql
SELECT COUNT(*) 
FROM tasks 
WHERE due_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
  AND status != 'DONE'
  AND deleted_at IS NULL;
```

3. **Check if users have FCM tokens:**

```sql
SELECT 
  u.id,
  u.name,
  COUNT(ud.id) as device_count
FROM users u
LEFT JOIN user_devices ud ON u.id = ud.user_id AND ud.is_active = true
GROUP BY u.id, u.name;
```

4. **Check notification logs:**

```sql
SELECT * FROM notifications
WHERE type = 'TIME_REMINDER'
  AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

---

### Issue 4: Wrong timezone

**Lỗi:**
- Job runs at wrong time
- Notifications sent at 3AM instead of 8AM

**Nguyên nhân:**
- Timezone setting sai
- Confusion UTC vs local time

**Giải pháp:**

1. **Verify timezone in cron job:**
   - Dashboard → Cron Job → Edit
   - Check Timezone field
   - Set to: `Asia/Ho_Chi_Minh` (Vietnam)

2. **Verify schedule:**
   ```
   0 8 * * *  # 8:00 AM in selected timezone
   ```

3. **Test conversion:**
   ```
   Vietnam (UTC+7): 8:00 AM = 1:00 AM UTC
   Schedule: 0 8 * * * with timezone Asia/Ho_Chi_Minh ✅
   
   NOT: 0 1 * * * with timezone UTC ❌
   ```

---

### Issue 5: FCM notifications not delivered

**Debug FCM:**

1. **Check FCM token validity:**

```typescript
// Test endpoint
@Post('test-fcm')
async testFcm(@Body() { token }: { token: string }) {
  const isValid = await this.fcmService.validateToken(token);
  return { valid: isValid };
}
```

2. **Check Firebase Console:**
   - Cloud Messaging → Reports
   - Check delivery rate
   - Check error messages

3. **Verify Firebase credentials:**

```bash
# Check environment variables
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
echo $FIREBASE_PRIVATE_KEY | head -c 50  # First 50 chars
```

4. **Test manual send:**

Firebase Console → Cloud Messaging → Send test message

---

## 📝 CHECKLIST SETUP

**Trước khi deploy:**

- [ ] Backend API deployed & running
- [ ] Worker endpoints tested locally
- [ ] WORKER_SECRET_TOKEN generated (32+ chars)
- [ ] Environment variables added to web service
- [ ] Web service redeployed successfully

**Tạo cron jobs:**

- [ ] Job 1: upcoming-task-reminders created
- [ ] Job 2: overdue-task-reminders created
- [ ] Job 3: daily-summary created
- [ ] Job 4: meeting-reminders created (optional)
- [ ] All jobs have correct schedule
- [ ] All jobs have correct timezone
- [ ] All jobs have WORKER_SECRET_TOKEN

**Testing:**

- [ ] Manual trigger mỗi job
- [ ] Check logs for successful execution
- [ ] Verify response status 200
- [ ] Check database for notification records
- [ ] Test receive notification on Android app
- [ ] Verify Firebase Console metrics

**Monitoring:**

- [ ] Enable failure alerts
- [ ] Setup email/Slack notifications
- [ ] Monitor job execution times
- [ ] Track success/failure rates

---

## 🎯 PRODUCTION CHECKLIST

**Security:**

- [ ] WORKER_SECRET_TOKEN là random & strong
- [ ] Token không bị expose trong logs
- [ ] Endpoint có authentication check
- [ ] Rate limiting enabled (if needed)

**Performance:**

- [ ] Query optimized với indexes
- [ ] Only select needed fields
- [ ] Batch operations when possible
- [ ] Timeout configured properly

**Reliability:**

- [ ] Retry logic implemented
- [ ] Error handling complete
- [ ] Logging sufficient for debugging
- [ ] Alerts configured

**Documentation:**

- [ ] Schedule documented
- [ ] Expected behavior documented
- [ ] Troubleshooting guide available
- [ ] Contact person assigned

---

## 📞 SUPPORT

**Render Documentation:**
- Cron Jobs: https://render.com/docs/cronjobs
- Environment Variables: https://render.com/docs/environment-variables

**Firebase Documentation:**
- FCM Server: https://firebase.google.com/docs/cloud-messaging/server

**Project Documentation:**
- Implementation Plan: `docs/NOTIFICATION_IMPLEMENTATION_PLAN.md`
- Progress Report: `docs/NOTIFICATION_PROGRESS_REPORT.md`
- FCM Setup: `docs/FCM_BACKEND_SETUP.md`

---

**Document Version:** 1.0  
**Last Updated:** October 23, 2025  
**Maintainer:** Development Team
