# ✅ CHECKLIST TRIỂN KHAI WEBSOCKET - ANDROID

## 📋 OVERVIEW

**Mục tiêu:** Tích hợp WebSocket + FCM hybrid notification system  
**Thời gian:** 4-5 giờ  
**Document:** `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md`

---

## 🔧 PHASE 1: WEBSOCKET CLIENT (90 phút)

### Step 1.1: Dependencies (5 phút)
- [ ] Thêm OkHttp WebSocket: `implementation("com.squareup.okhttp3:okhttp:4.12.0")`
- [ ] Thêm Lifecycle: `lifecycle-runtime-ktx:2.7.0` + `lifecycle-process:2.7.0`
- [ ] Add BuildConfig field: `WS_URL = "ws://10.0.2.2:3000/notifications"`
- [ ] Enable buildConfig: `buildFeatures { buildConfig = true }`
- [ ] Run: `./gradlew clean build`

### Step 1.2: DTOs (15 phút)
- [ ] Create `WebSocketMessage.java` (event, data)
- [ ] Create `NotificationPayload.java` (id, type, title, body, data, createdAt)
- [ ] Create `SubscribeRequest.java` (types array)
- [ ] Package: `com.example.tralalero.data.remote.dto.websocket`

### Step 1.3: WebSocket Manager (45 phút)
- [ ] Create `NotificationWebSocketManager.java`
- [ ] Implement `connect(String token)` with JWT auth
- [ ] Implement `disconnect()`
- [ ] Implement `WebSocketListener` (onOpen, onMessage, onClosed, onFailure)
- [ ] Add auto-reconnect with exponential backoff
- [ ] Add `subscribeToNotifications()` after connection
- [ ] Add `handleNotification()` with deduplication
- [ ] Add `markAsRead(String notificationId)`
- [ ] Add callbacks: `OnNotificationReceivedListener`, `OnConnectionStateChangeListener`

### Step 1.4: BuildConfig (10 phút)
- [ ] Verify WS_URL in `BuildConfig.WS_URL`
- [ ] Test with emulator: `ws://10.0.2.2:3000/notifications`
- [ ] Note: Physical device uses local IP: `ws://192.168.1.x:3000/notifications`

### Step 1.5: Test Connection (15 phút)
- [ ] Create `WebSocketTestActivity.java` (optional)
- [ ] Add buttons: Connect, Disconnect, Ping
- [ ] Test: Login → Connect → Check Logcat "✅ WebSocket connected"
- [ ] Backend test: POST `/notifications/test/send`
- [ ] Verify: Android receives notification < 100ms

**✅ Checkpoint:** WebSocket connects successfully and receives test notifications

---

## 🔄 PHASE 2: LIFECYCLE MANAGEMENT (60 phút)

### Step 2.1: App Lifecycle Observer (30 phút)
- [ ] Create `AppLifecycleObserver.java`
- [ ] Implement `DefaultLifecycleObserver`
- [ ] Override `onStart()`: Connect WebSocket + Disable FCM notifications
- [ ] Override `onStop()`: Disconnect WebSocket + Enable FCM notifications
- [ ] Add `setFCMNotificationsEnabled(boolean)` helper

### Step 2.2: Update App Class (15 phút)
- [ ] Add `NotificationWebSocketManager wsManager` field
- [ ] Initialize in `onCreate()`
- [ ] Setup callbacks: `setOnNotificationReceivedListener()`
- [ ] Register observer: `ProcessLifecycleOwner.get().lifecycle.addObserver()`
- [ ] Add `getWebSocketManager()` getter

### Step 2.3: Update FCM Service (15 phút)
- [ ] In `onMessageReceived()`: Check `app_prefs.show_fcm_notifications`
- [ ] If `false` (foreground): Skip notification, log "WebSocket handled"
- [ ] If `true` (background): Show system notification
- [ ] Keep existing `showSystemNotification()` code

**✅ Checkpoint:** App connects WS on foreground, disconnects on background

---

## 🎨 PHASE 3: IN-APP UI (90 phút)

### Step 3.1: Notification UI Manager (40 phút)
- [ ] Create `NotificationUIManager.java`
- [ ] Implement `handleInAppNotification(Context, NotificationPayload)`
- [ ] Show Snackbar with notification body
- [ ] Add action button: "XEM" → Navigate to deep link
- [ ] Add `getNotificationIcon(String type)` for emojis
- [ ] Add `updateBadgeCount(Context)` placeholder
- [ ] Add `getCurrentActivity(Context)` helper

### Step 3.2: Deep Link Navigator (30 phút)
- [ ] Create `DeepLinkNavigator.java`
- [ ] Implement `navigate(Context, NotificationPayload)`
- [ ] Handle `TASK_ASSIGNED` → `TaskDetailActivity`
- [ ] Handle `MEETING_REMINDER` → `EventDetailActivity`
- [ ] Handle `EVENT_INVITE` → `EventDetailActivity`
- [ ] Handle `SYSTEM` → `NotificationCenterActivity`
- [ ] Add helpers: `navigateToTask()`, `navigateToEvent()`

### Step 3.3: Notification Badge (20 phút)
- [ ] In `HomeActivity`: Add `setupNotificationBadge()`
- [ ] Call API: `GET /notifications/unread` → Get count
- [ ] Update badge on bottom navigation
- [ ] Listen to WebSocket: Increment badge on new notification
- [ ] Mark as read: Decrement badge

**✅ Checkpoint:** In-app notifications show with deep linking working

---

## 🧪 PHASE 4: TESTING (60 phút)

### Step 4.1: Test Scenarios (30 phút)

**Test 1: App Foreground → WebSocket**
- [ ] Login → Keep app open
- [ ] Backend: POST `/notifications/test/send`
- [ ] Expected: Snackbar appears, no system notification
- [ ] Logcat: "✅ WebSocket connected", "🔔 Notification received"

**Test 2: App Background → FCM**
- [ ] Login → Press Home
- [ ] Backend: POST `/notifications/test/send`
- [ ] Expected: System notification appears
- [ ] Click: Opens app with deep link
- [ ] Logcat: "🔴 App BACKGROUND", "📩 FCM message received"

**Test 3: Reconnection**
- [ ] Connect WebSocket
- [ ] Turn off Wi-Fi → Check "❌ WebSocket failure"
- [ ] Turn on Wi-Fi → Check "🔄 Attempting reconnect", "✅ WebSocket connected"

**Test 4: Deduplication**
- [ ] App foreground
- [ ] Backend sends notification
- [ ] Expected: Only ONE notification shown (via WebSocket)
- [ ] No duplicate from FCM

### Step 4.2: Performance (20 phút)
- [ ] Verify ping interval: 30 seconds (not too frequent)
- [ ] Check reconnect delay: Exponential backoff (1s, 2s, 4s, ... max 30s)
- [ ] Monitor battery: Settings → Battery → App usage
- [ ] Verify disconnect on background (no WebSocket drain)

### Step 4.3: Error Handling (10 phút)
- [ ] Test: Invalid JWT token → Connection rejected
- [ ] Test: Network timeout → Auto-reconnect
- [ ] Test: Backend offline → Exponential backoff
- [ ] Check logs: Specific error messages (UnknownHostException, SSLException, etc.)

**✅ Checkpoint:** All tests pass, no crashes, battery usage normal

---

## 📊 SUCCESS CRITERIA

### Foreground Behavior:
- ✅ WebSocket connects within 2 seconds of app open
- ✅ Notifications arrive in < 100ms
- ✅ In-app Snackbar shows with action button
- ✅ Deep linking navigates to correct screen
- ✅ No system notifications (avoid duplicates)

### Background Behavior:
- ✅ WebSocket disconnects immediately on app background
- ✅ FCM notifications appear in system tray
- ✅ Click opens app with deep link
- ✅ Battery usage normal (no WebSocket drain)

### Reliability:
- ✅ Auto-reconnect works on network recovery
- ✅ No duplicate notifications
- ✅ Handles token expiry gracefully
- ✅ Works on both emulator and physical device

---

## 🔍 VERIFICATION CHECKLIST

### Code Quality:
- [ ] No hardcoded URLs (use BuildConfig)
- [ ] Proper error handling (try-catch)
- [ ] Memory leaks checked (disconnect on destroy)
- [ ] Thread safety (UI updates on main thread)
- [ ] Logcat messages clear and descriptive

### Integration:
- [ ] WebSocket uses same JWT as API calls
- [ ] FCM token registration still works
- [ ] Deep links open correct activities
- [ ] Notification badge updates correctly
- [ ] Mark as read API called

### Documentation:
- [ ] Code comments added
- [ ] README updated with WebSocket info
- [ ] Test cases documented
- [ ] Known issues noted

---

## 🚨 TROUBLESHOOTING

### WebSocket không connect:
- [ ] Check: Backend running (`npm run dev`)
- [ ] Check: WS_URL correct (`BuildConfig.WS_URL`)
- [ ] Check: JWT token valid (print to Logcat)
- [ ] Check: Backend logs show connection attempt

### Duplicate notifications:
- [ ] Verify: `show_fcm_notifications` toggle working
- [ ] Check: `shownNotificationIds` Set tracking
- [ ] Verify: Backend only sends to one channel (WS OR FCM, not both)

### Battery drain:
- [ ] Verify: Disconnect called on `onStop()`
- [ ] Check: Ping interval 30s (not shorter)
- [ ] Monitor: Battery stats in Settings

### Reconnection fails:
- [ ] Check: `intentionalDisconnect` flag reset
- [ ] Verify: Exponential backoff delays (1s, 2s, 4s...)
- [ ] Check: Max delay 30s

---

## 📚 REFERENCES

**Full Implementation:**
- `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Detailed plan (4-5h)

**Backend Docs:**
- `WEBSOCKET_IMPLEMENTATION_COMPLETE.md` - Backend setup
- `PUSH_NOTIFICATION_USE_CASES.md` - 19 use cases
- `ANDROID_WEBSOCKET_INTEGRATION.md` - Integration guide

**Testing:**
- `test-scripts/websocket-test-client.html` - Browser test client
- `test-scripts/test-websocket.http` - REST API tests

---

## ✅ COMPLETION

Khi tất cả checkbox được check:
- [ ] WebSocket client working (Phase 1)
- [ ] Lifecycle management working (Phase 2)
- [ ] In-app UI working (Phase 3)
- [ ] All tests passing (Phase 4)

**→ DEPLOYMENT READY!** 🚀

---

**Total Time:** 4-5 giờ  
**Complexity:** Medium  
**Impact:** High (Real-time notifications < 100ms)
