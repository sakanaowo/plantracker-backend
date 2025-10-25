# 📱 FCM SETUP - QUICK SUMMARY

## 🎯 TÓM TẮT NHANH

### **ANDROID CLIENT CẦN:**

#### 1. **Permissions trong AndroidManifest.xml:**
```xml
✅ INTERNET - Bắt buộc
✅ POST_NOTIFICATIONS - Bắt buộc (Android 13+)
✅ WAKE_LOCK - Recommended
⚠️ VIBRATE - Optional
```

#### 2. **Dependencies trong build.gradle:**
```groovy
✅ Firebase BoM
✅ Firebase Messaging
✅ Firebase Analytics (optional)
✅ Retrofit (để gọi API backend)
```

#### 3. **Firebase Configuration:**
```
✅ google-services.json (download từ Firebase Console)
✅ Paste vào thư mục app/
```

#### 4. **Implement FirebaseMessagingService:**
```kotlin
✅ onNewToken() - Gửi token lên backend
✅ onMessageReceived() - Handle notifications
```

#### 5. **Notification Channels (Android 8.0+):**
```kotlin
✅ task_updates
✅ task_comments  
✅ mentions
✅ meeting_reminders
✅ event_invites
✅ system
```

#### 6. **Request Permission (Android 13+):**
```kotlin
✅ POST_NOTIFICATIONS runtime permission
✅ Show rationale nếu user từ chối
```

#### 7. **Get FCM Token và gửi lên Backend:**
```kotlin
FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
    // Call API: POST /api/notifications/register-device
}
```

---

### **BACKEND CẦN:**

#### 1. **Endpoints cần implement:**

```typescript
✅ POST   /api/notifications/register-device
   Body: { fcmToken, platform, deviceName, osVersion }
   Purpose: Đăng ký device khi user login

✅ POST   /api/notifications/update-token
   Body: { deviceId, newFcmToken }
   Purpose: Update token khi Firebase refresh

✅ DELETE /api/notifications/devices/:deviceId
   Purpose: Xóa device khi user logout

✅ GET    /api/notifications/devices
   Purpose: Lấy danh sách devices của user

✅ GET    /api/notifications?page=1&limit=20&unreadOnly=false
   Purpose: Lấy notifications với pagination

✅ PATCH  /api/notifications/mark-read
   Body: { notificationIds: ["uuid1", "uuid2"] }
   Purpose: Đánh dấu notifications đã đọc

✅ PATCH  /api/notifications/mark-all-read
   Body: { beforeDate?: "2025-10-24T..." }
   Purpose: Đánh dấu tất cả notifications đã đọc

✅ DELETE /api/notifications/:id
   Purpose: Xóa notification

✅ GET    /api/notifications/stats
   Purpose: Get thống kê notifications (total, unread, byType)
```

#### 2. **NotificationsService methods:**

```typescript
✅ registerDevice(userId, dto) - Register FCM token
✅ updateFCMToken(userId, dto) - Update token
✅ unregisterDevice(userId, deviceId) - Remove device
✅ getUserDevices(userId) - Get devices
✅ getUserNotifications(userId, options) - Get notifications
✅ markNotificationsAsRead(userId, dto) - Mark read
✅ markAllNotificationsAsRead(userId, beforeDate) - Mark all read
✅ deleteNotification(userId, notificationId) - Delete
✅ getNotificationStats(userId) - Get stats
```

#### 3. **FCM Service updates:**

```typescript
✅ validateToken(fcmToken) - Validate token với Firebase
✅ sendNotification(payload) - Send to single device
✅ sendToMultipleDevices(tokens, ...) - Send to multiple devices
```

#### 4. **DTOs cần tạo:**

```typescript
✅ RegisterDeviceDto
✅ UpdateTokenDto
✅ MarkReadDto
✅ MarkAllReadDto
✅ DeviceResponseDto
```

---

## 🔄 FLOW HOẠT ĐỘNG

### **1. User Login (Android App):**

```
Android App
    ↓
Request POST_NOTIFICATIONS permission (Android 13+)
    ↓
FirebaseMessaging.getInstance().token
    ↓
Call API: POST /api/notifications/register-device
    {
      fcmToken: "eXAMPLE_TOKEN",
      platform: "ANDROID",
      deviceName: "Samsung Galaxy S23",
      osVersion: "Android 14"
    }
    ↓
Backend validates token with Firebase
    ↓
Save to user_devices table
    ↓
Return deviceId to Android
```

### **2. Notification Sent (Backend → Android):**

```
Backend Event (e.g., task assigned)
    ↓
NotificationsService.sendTaskAssigned()
    ↓
Get FCM tokens from user_devices table
    ↓
FCMService.sendNotification()
    ↓
Firebase Cloud Messaging
    ↓
Android FirebaseMessagingService.onMessageReceived()
    ↓
Show notification in system tray
    ↓
User clicks → Open app with intent
```

### **3. Token Refresh (Firebase automatically):**

```
Firebase SDK detects token changed
    ↓
FirebaseMessagingService.onNewToken(token)
    ↓
Call API: POST /api/notifications/update-token
    {
      deviceId: "saved-device-id",
      newFcmToken: "NEW_TOKEN"
    }
    ↓
Backend updates user_devices table
```

### **4. User Logout (Android App):**

```
User clicks Logout
    ↓
Call API: DELETE /api/notifications/devices/{deviceId}
    ↓
Backend marks device as inactive (is_active = false)
    ↓
Clear local storage
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **PHASE 1: Backend Setup (Day 1-2)**

- [ ] **Create DTOs:**
  - [ ] `src/modules/notifications/dto/register-device.dto.ts`
  - [ ] `src/modules/notifications/dto/update-token.dto.ts`
  - [ ] `src/modules/notifications/dto/mark-read.dto.ts`

- [ ] **Update NotificationsService:**
  - [ ] Add `registerDevice()` method
  - [ ] Add `updateFCMToken()` method
  - [ ] Add `unregisterDevice()` method
  - [ ] Add `getUserDevices()` method
  - [ ] Add `getUserNotifications()` method
  - [ ] Add `markNotificationsAsRead()` method
  - [ ] Add `markAllNotificationsAsRead()` method
  - [ ] Add `deleteNotification()` method
  - [ ] Add `getNotificationStats()` method

- [ ] **Update FCMService:**
  - [ ] Add `validateToken()` method

- [ ] **Update NotificationsController:**
  - [ ] Add all 9 endpoints

- [ ] **Test Backend:**
  - [ ] Test với Postman/HTTP client
  - [ ] Verify database records created correctly

---

### **PHASE 2: Android Setup (Day 3-4)**

- [ ] **Firebase Console:**
  - [ ] Create/Select Firebase project
  - [ ] Add Android app
  - [ ] Download `google-services.json`
  - [ ] Place in `app/` folder

- [ ] **build.gradle:**
  - [ ] Add Google Services plugin
  - [ ] Add Firebase dependencies

- [ ] **AndroidManifest.xml:**
  - [ ] Add permissions (INTERNET, POST_NOTIFICATIONS, WAKE_LOCK)
  - [ ] Register FirebaseMessagingService
  - [ ] Add notification metadata

- [ ] **Create NotificationChannels.kt:**
  - [ ] Define 6 channels
  - [ ] Create channels in Application.onCreate()

- [ ] **Create FirebaseMessagingService:**
  - [ ] Implement `onNewToken()`
  - [ ] Implement `onMessageReceived()`
  - [ ] Handle notification types
  - [ ] Create intents for click actions

- [ ] **MainActivity:**
  - [ ] Request POST_NOTIFICATIONS permission (Android 13+)
  - [ ] Get FCM token
  - [ ] Call register-device API
  - [ ] Save deviceId to SharedPreferences

- [ ] **Retrofit API:**
  - [ ] Create ApiService interface
  - [ ] Add all notification endpoints
  - [ ] Create request/response models

- [ ] **Logout Flow:**
  - [ ] Call unregister-device API
  - [ ] Clear local storage

---

### **PHASE 3: Testing (Day 5)**

- [ ] **Backend Testing:**
  - [ ] Test register-device with valid token
  - [ ] Test with invalid token (should fail)
  - [ ] Test get devices
  - [ ] Test update token
  - [ ] Test unregister device
  - [ ] Test get notifications
  - [ ] Test mark as read
  - [ ] Test delete notification

- [ ] **Android Testing:**
  - [ ] Test permission request flow
  - [ ] Test FCM token generation
  - [ ] Test register-device API call
  - [ ] Test receiving notifications (use Postman to trigger backend)
  - [ ] Test notification click → open app
  - [ ] Test token refresh
  - [ ] Test logout → unregister device

- [ ] **End-to-End Testing:**
  - [ ] Create task with assignee → Assignee receives notification
  - [ ] Comment on task → Task participants receive notification
  - [ ] Mention user → Mentioned user receives HIGH priority notification
  - [ ] Move task → Watchers receive notification
  - [ ] Check notification in app (mark as read, delete)

---

## 🚨 COMMON ISSUES & SOLUTIONS

### **Issue 1: Android không nhận được notification**

**Possible Causes:**
- ❌ Permission POST_NOTIFICATIONS chưa được grant
- ❌ FCM token chưa được gửi lên backend
- ❌ Token không valid (đã expired)
- ❌ Notification channel chưa được tạo
- ❌ Firebase project configuration sai

**Debug Steps:**
```kotlin
// 1. Check permission
if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
    == PackageManager.PERMISSION_GRANTED) {
    Log.d("DEBUG", "Permission granted")
}

// 2. Check FCM token
FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
    Log.d("DEBUG", "FCM Token: $token")
}

// 3. Check channels
val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
notificationManager.notificationChannels.forEach { channel ->
    Log.d("DEBUG", "Channel: ${channel.id}")
}
```

---

### **Issue 2: Backend validation fails "Invalid FCM token"**

**Possible Causes:**
- ❌ Token format sai
- ❌ Token từ wrong Firebase project
- ❌ Firebase Admin SDK credentials sai

**Solution:**
```typescript
// Check Firebase Admin initialization
const admin = require('firebase-admin');
console.log('Firebase App Name:', admin.app().name);

// Test token manually
try {
  await admin.messaging().send({
    token: 'YOUR_TEST_TOKEN',
    data: { test: 'validation' }
  }, true); // dry-run
  console.log('Token valid');
} catch (error) {
  console.error('Token invalid:', error.code);
}
```

---

### **Issue 3: Notification không hiển thị khi app đang foreground**

**Solution:**
```kotlin
// Trong FirebaseMessagingService.onMessageReceived()
// Luôn show notification manually, ngay cả khi app foreground

override fun onMessageReceived(message: RemoteMessage) {
    // Always show notification
    showNotification(
        title = message.notification?.title ?: "PlanTracker",
        body = message.notification?.body ?: "",
        // ...
    )
}
```

---

### **Issue 4: Token không được gửi lên backend sau khi login**

**Solution:**
```kotlin
// Trong login success callback
lifecycleScope.launch {
    // Wait for Firebase token
    val token = FirebaseMessaging.getInstance().token.await()
    
    // Then call register-device API
    registerDeviceWithBackend(token)
}
```

---

## 📚 DOCUMENTATION REFERENCES

- **Android Client Setup:** `docs/FCM_ANDROID_CLIENT_SETUP.md` (900+ lines)
- **Backend Endpoints:** `docs/FCM_BACKEND_ENDPOINTS.md` (1200+ lines)
- **Backend Setup:** `docs/FCM_BACKEND_SETUP.md` (existing)
- **Notification Implementation Plan:** `docs/NOTIFICATION_IMPLEMENTATION_PLAN.md`
- **Render Cron Setup:** `docs/RENDER_CRON_SETUP_GUIDE.md`

---

## 🎯 PRIORITY ACTIONS

### **Week 1 (CRITICAL):**
1. ✅ Implement backend endpoints (Day 1-2)
2. ✅ Setup Android Firebase SDK (Day 3)
3. ✅ Implement FirebaseMessagingService (Day 4)
4. ✅ Test end-to-end (Day 5)

### **Week 2:**
5. ✅ Implement TASK_ASSIGNED notification (real-time)
6. ✅ Implement TASK_COMMENTED notification
7. ✅ Test with real users

---

## 💡 TIPS

1. **Always validate FCM token** trước khi save vào database
2. **Handle token refresh** - Firebase có thể refresh token bất cứ lúc nào
3. **Mark device as inactive** instead of deleting khi logout (để có history)
4. **Cleanup inactive devices** định kỳ (devices không active > 30 ngày)
5. **Use notification channels** để user có thể customize notification settings
6. **Test trên real device** - Emulator có thể không nhận FCM messages

---

**Ready to implement?** Start with Backend endpoints first, then Android! 🚀
