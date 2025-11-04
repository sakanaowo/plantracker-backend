# 📱 TÓM TẮT: WEBSOCKET + FCM INTEGRATION - ANDROID CLIENT

## 🎯 MỤC TIÊU

Tích hợp WebSocket real-time notifications vào Android app để:
- ⚡ **App FOREGROUND:** Nhận thông báo qua WebSocket (< 100ms, real-time)
- 🔔 **App BACKGROUND:** Nhận thông báo qua FCM (1-10s, system notification)

---

## 📊 SO SÁNH

| Scenario | Channel | Latency | Battery | Display |
|----------|---------|---------|---------|---------|
| **App mở** | WebSocket | < 100ms | Chấp nhận được | In-app banner/snackbar |
| **App đóng** | FCM Push | 1-10s | Tối ưu | System notification tray |

---

## 🏗️ KIẾN TRÚC

```
┌─────────────────────────────────────┐
│         ANDROID APP                 │
├─────────────────────────────────────┤
│                                     │
│  App FOREGROUND:                    │
│  ┌────────────┐    WebSocket (WSS) │
│  │ OkHttp WS  │◄─────────────────┐ │
│  │ Client     │   Real-time      │ │
│  └────────────┘   < 100ms         │ │
│                                    │ │
│  App BACKGROUND:                   │ │
│  ┌────────────┐    FCM (HTTPS)    │ │
│  │ FCM        │◄─────────────────┤ │
│  │ Receiver   │   Push 1-10s     │ │
│  └────────────┘                   │ │
│                                    │ │
└────────────────────────────────────┘ │
                                       │
                    ┌──────────────────┘
                    │
            ┌───────▼────────┐
            │ BACKEND        │
            │ NestJS         │
            ├────────────────┤
            │ WebSocket      │
            │ Gateway        │
            │                │
            │ FCM Service    │
            │                │
            │ Notifications  │
            │ Service        │
            └────────────────┘
```

---

## 📦 COMPONENTS CẦN IMPLEMENT

### 1. **NotificationWebSocketManager.java**
- OkHttp WebSocket client
- JWT authentication
- Auto-reconnect (exponential backoff)
- Message parsing & handling
- Deduplication

### 2. **AppLifecycleObserver.java**
- Observe app foreground/background
- Connect WebSocket on foreground
- Disconnect WebSocket on background
- Toggle FCM notification display

### 3. **NotificationUIManager.java**
- In-app notification banners (Snackbar)
- Notification badge count
- Deep link navigation

### 4. **DeepLinkNavigator.java**
- Route notifications to correct screens
- Task → TaskDetailActivity
- Event → EventDetailActivity
- System → NotificationCenterActivity

### 5. **Update MyFirebaseMessagingService.java**
- Check app state (foreground/background)
- Skip notification if foreground (WebSocket handled)
- Show system notification if background

---

## 🔄 FLOW LOGIC

### Scenario 1: App đang mở (Foreground)

```
User opens app
  ↓
AppLifecycleObserver.onStart()
  ↓
Connect WebSocket with JWT token
  ↓
Backend: isUserOnline(userId) = true
  ↓
Backend sends notification via WebSocket
  ↓
Android receives in < 100ms
  ↓
NotificationWebSocketManager handles
  ↓
NotificationUIManager shows in-app banner
  ↓
User clicks "Xem" → Navigate to task/event
  ↓
Mark as read via WebSocket
```

**Kết quả:**
- ✅ Snackbar hiện tại bottom screen
- ✅ No system notification (tránh duplicate)
- ✅ Real-time update (< 100ms)

---

### Scenario 2: App đã đóng (Background)

```
User press Home button
  ↓
AppLifecycleObserver.onStop()
  ↓
Disconnect WebSocket
  ↓
Enable FCM local notifications
  ↓
Backend: isUserOnline(userId) = false
  ↓
Backend sends notification via FCM
  ↓
Android receives FCM push (1-10s)
  ↓
MyFirebaseMessagingService.onMessageReceived()
  ↓
Check: app_prefs.show_fcm_notifications = true
  ↓
Show system notification in tray
  ↓
User clicks notification → Open app with deep link
```

**Kết quả:**
- ✅ System notification in notification tray
- ✅ Click opens app with correct screen
- ✅ Battery efficient (WebSocket disconnected)

---

## ⏱️ TIMELINE

| Giai đoạn | Thời gian | Tasks |
|-----------|-----------|-------|
| **1. WebSocket Client** | 90 phút | Dependencies, DTOs, Manager, Test |
| **2. Lifecycle** | 60 phút | Observer, App class, FCM update |
| **3. In-App UI** | 90 phút | UI Manager, Deep linking, Badge |
| **4. Testing** | 60 phút | Test cases, Optimization |
| **TỔNG** | **4-5 giờ** | |

---

## 📝 DEPENDENCIES CẦN THÊM

```kotlin
// app/build.gradle.kts
dependencies {
    // WebSocket client
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")
    
    // Already have:
    // - Firebase Messaging (FCM)
    // - Retrofit (API client)
    // - Gson (JSON parsing)
}

// BuildConfig
buildTypes {
    debug {
        buildConfigField("String", "WS_URL", 
            "\"ws://10.0.2.2:3000/notifications\"")
    }
    release {
        buildConfigField("String", "WS_URL", 
            "\"wss://your-backend.com/notifications\"")
    }
}

buildFeatures {
    buildConfig = true
}
```

---

## 🧪 TEST CASES

### ✅ Test 1: WebSocket Connection
```
1. Login
2. Check Logcat: "✅ WebSocket connected"
3. Backend send test notification
4. Android receives in <100ms
5. Snackbar appears
```

### ✅ Test 2: FCM Fallback
```
1. Login
2. Press Home (background)
3. Backend send test notification
4. System notification appears
5. Click → Opens app
```

### ✅ Test 3: Reconnection
```
1. Connect WebSocket
2. Turn off Wi-Fi
3. Turn on Wi-Fi
4. Auto-reconnect successful
```

### ✅ Test 4: No Duplicates
```
1. App foreground
2. Backend sends notification
3. Only WebSocket notification shown
4. No duplicate FCM notification
```

---

## 🔐 SECURITY

- ✅ JWT authentication for WebSocket
- ✅ WSS (WebSocket Secure) in production
- ✅ Token validation on every connection
- ✅ User isolation (only receive own notifications)

---

## 🚀 EXPECTED RESULTS

### Foreground Logcat:
```
D/AppLifecycleObserver: 🟢 App FOREGROUND
D/WebSocketManager: ✅ WebSocket connected
D/WebSocketManager: 📬 Subscribed to: [TASK_ASSIGNED, ...]
D/WebSocketManager: 🔔 Notification: Task Mới
I/NotificationUIManager: Showing banner
```

### Background Logcat:
```
D/AppLifecycleObserver: 🔴 App BACKGROUND
D/WebSocketManager: Disconnecting WebSocket
D/FCMService: 📩 FCM message received
D/FCMService: ✅ Showing system notification
```

### UI Result:
- **Foreground:** Snackbar at bottom with "XEM" button
- **Background:** System notification with app icon

---

## 📚 DOCUMENTS

**Plan chi tiết:** `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` (4-5 giờ)

**Backend documentation:**
- `WEBSOCKET_IMPLEMENTATION_COMPLETE.md` - Backend setup
- `PUSH_NOTIFICATION_USE_CASES.md` - 19 use cases
- `ANDROID_WEBSOCKET_INTEGRATION.md` - Integration guide

**Testing:**
- Backend test client: `test-scripts/websocket-test-client.html`
- REST API tests: `test-scripts/test-websocket.http`

---

## 🎯 NEXT STEPS

1. ✅ Review plan: `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md`
2. ⏳ Implement WebSocket client (90 phút)
3. ⏳ Add lifecycle management (60 phút)
4. ⏳ Build in-app UI (90 phút)
5. ⏳ Test end-to-end (60 phút)

**Estimated Total:** 4-5 giờ (1 buổi chiều + sáng hôm sau)

---

## 💡 KEY BENEFITS

- ⚡ **Real-time:** < 100ms latency cho app foreground
- 🔋 **Battery:** Auto-disconnect khi background
- 🔔 **Reliable:** FCM fallback khi offline
- 🎯 **No duplicates:** Smart deduplication logic
- 📱 **UX:** In-app banners + deep linking

**Status:** ✅ Ready to implement!
