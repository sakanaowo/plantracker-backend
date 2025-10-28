# 👥 PHÂN CÔNG CÔNG VIỆC - 2 ANDROID DEVELOPERS

**Project:** WebSocket + FCM Real-time Notifications  
**Total Time:** 4-5 giờ  
**Strategy:** Parallel work, merge at the end

---

## 🎯 CHIẾN LƯỢC

### Nguyên tắc phân chia:
- ✅ **Độc lập:** Mỗi dev làm việc trên các file khác nhau → Không conflict
- ✅ **Parallel:** Cả 2 làm cùng lúc → Không đợi nhau
- ✅ **Integration point:** Merge 1 lần duy nhất ở cuối → Test tổng thể

### Phân chia theo module:
- **DEV 1 (Core Infrastructure):** WebSocket Client + Lifecycle Management
- **DEV 2 (UI & Navigation):** Notification UI + Deep Linking + Badge

---

## 👨‍💻 DEV 1: CORE INFRASTRUCTURE (3.5 giờ)

### 📋 Trách nhiệm:
- WebSocket connection & management
- App lifecycle handling (foreground/background)
- FCM service integration
- Foundation cho notification system

### 🔧 Tasks chi tiết:

#### **PHASE 1.1: Dependencies & Setup (15 phút)**

**Files:** `app/build.gradle.kts`

```kotlin
// Add dependencies
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")
}

// Add BuildConfig
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

**Commands:**
```bash
cd Plantracker
./gradlew clean
./gradlew build
```

**Output:** Dependencies installed, BuildConfig ready

---

#### **PHASE 1.2: WebSocket DTOs (20 phút)**

**Package:** `com.example.tralalero.data.remote.dto.websocket`

**Files to create:**
1. `WebSocketMessage.java`
2. `NotificationPayload.java`
3. `SubscribeRequest.java`

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 1.2

**Output:** 3 DTO classes complete

---

#### **PHASE 1.3: WebSocket Manager (90 phút) ⭐ CORE**

**File:** `com.example.tralalero.service.NotificationWebSocketManager.java`

**Responsibilities:**
- Connect/disconnect WebSocket with JWT auth
- Handle incoming messages
- Auto-reconnect with exponential backoff
- Message parsing & deduplication
- Callbacks for UI

**Key methods:**
```java
public void connect(String token)
public void disconnect()
public void markAsRead(String notificationId)
public void sendPing()
private void handleNotification(NotificationPayload notification)
private void scheduleReconnect()
```

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 1.3 (~300 lines)

**Output:** WebSocket manager fully functional

---

#### **PHASE 1.4: Lifecycle Observer (40 phút)**

**File:** `com.example.tralalero.service.AppLifecycleObserver.java`

**Responsibilities:**
- Observe app foreground/background state
- Connect WebSocket on `onStart()`
- Disconnect WebSocket on `onStop()`
- Toggle FCM notification display

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 2.1

**Output:** Lifecycle management complete

---

#### **PHASE 1.5: Update App Class (20 phút)**

**File:** `com.example.tralalero.App.java`

**Changes:**
- Add `NotificationWebSocketManager wsManager` field
- Initialize in `onCreate()`
- Setup callbacks
- Register `AppLifecycleObserver`
- Add `getWebSocketManager()` getter

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 2.2

**Output:** App class integrated

---

#### **PHASE 1.6: Update FCM Service (30 phút)**

**File:** `com.example.tralalero.service.MyFirebaseMessagingService.java`

**Changes:**
```java
@Override
public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
    // CHECK: App in foreground?
    boolean showFCM = prefs.getBoolean("show_fcm_notifications", true);
    
    if (!showFCM) {
        // Skip - WebSocket handled it
        Log.d(TAG, "App foreground, skipping FCM");
        return;
    }
    
    // Show system notification (existing code)
    showSystemNotification(...);
}
```

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 2.3

**Output:** FCM service updated

---

#### **PHASE 1.7: Test WebSocket Connection (30 phút)**

**Optional Test Activity:** `WebSocketTestActivity.java`

**Manual Testing:**
1. Login → Check Logcat "✅ WebSocket connected"
2. Backend: `POST /notifications/test/send`
3. Verify: Message received in < 100ms
4. Press Home → Check "🔴 App BACKGROUND"
5. Return to app → Check "🟢 App FOREGROUND"

**Output:** Connection tested, logs verified

---

### 📦 DEV 1 DELIVERABLES:

**Files created/modified:**
```
app/build.gradle.kts                                     (Modified)
app/src/main/java/com/example/tralalero/
├── App.java                                             (Modified)
├── service/
│   ├── NotificationWebSocketManager.java                (NEW) ⭐
│   ├── AppLifecycleObserver.java                       (NEW) ⭐
│   └── MyFirebaseMessagingService.java                 (Modified)
└── data/remote/dto/websocket/
    ├── WebSocketMessage.java                           (NEW)
    ├── NotificationPayload.java                        (NEW)
    └── SubscribeRequest.java                           (NEW)
```

**Status checkpoints:**
- [ ] Dependencies installed
- [ ] DTOs created
- [ ] WebSocketManager implemented
- [ ] Lifecycle observer working
- [ ] App class integrated
- [ ] FCM service updated
- [ ] Connection test successful

**Estimated time:** 3.5 giờ

---

## 👩‍💻 DEV 2: UI & NAVIGATION (3.5 giờ)

### 📋 Trách nhiệm:
- In-app notification UI (banners/snackbars)
- Deep link navigation
- Notification badge management
- User interaction handling

### 🔧 Tasks chi tiết:

#### **PHASE 2.1: Read Context (15 phút)**

**Action:** Đọc documents để hiểu flow
- `WEBSOCKET_ANDROID_SUMMARY.md`
- `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Phase 3

**Output:** Understanding notification payload structure

---

#### **PHASE 2.2: Notification UI Manager (60 phút) ⭐ CORE**

**File:** `com.example.tralalero.ui.NotificationUIManager.java`

**Responsibilities:**
- Show in-app Snackbar when notification arrives
- Add action button ("XEM")
- Handle notification icons (emoji based on type)
- Update notification badge count
- Get current activity reference

**Key methods:**
```java
public static void handleInAppNotification(Context, NotificationPayload)
private static String getNotificationIcon(String type)
private static void navigateToDeepLink(Activity, String, NotificationPayload)
private static void updateBadgeCount(Context)
private static Activity getCurrentActivity(Context)
```

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 3.1

**Output:** In-app notification UI complete (~150 lines)

---

#### **PHASE 2.3: Deep Link Navigator (60 phút)**

**File:** `com.example.tralalero.util.DeepLinkNavigator.java`

**Responsibilities:**
- Route notifications to correct screens
- Parse notification data
- Handle different notification types

**Routing logic:**
```
TASK_ASSIGNED → TaskDetailActivity
TASK_UPDATED → TaskDetailActivity
MEETING_REMINDER → EventDetailActivity
EVENT_INVITE → EventDetailActivity
SYSTEM → NotificationCenterActivity
```

**Key methods:**
```java
public static void navigate(Context, NotificationPayload)
private static void navigateToTask(Context, String taskId)
private static void navigateToEvent(Context, String eventId)
private static void navigateToNotificationCenter(Context)
```

**Source code:** Xem `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Bước 3.2

**Output:** Deep linking complete (~100 lines)

---

#### **PHASE 2.4: Notification Badge (45 phút)**

**File:** `com.example.tralalero.feature.home/ui/Home/HomeActivity.java`

**Changes:**
```java
// onCreate()
private void setupNotificationBadge() {
    fetchUnreadNotificationCount();
    
    // Listen to WebSocket
    ((App) getApplication()).getWebSocketManager()
        .setOnNotificationReceivedListener(notification -> {
            runOnUiThread(() -> updateNotificationBadge());
        });
}

private void fetchUnreadNotificationCount() {
    // Call API: GET /notifications/unread
    // Update badge on bottom navigation
}

private void updateNotificationBadge() {
    // Increment badge count
}
```

**API Integration:**
- Create `NotificationApiService.java` interface
- Add `GET /notifications/unread` endpoint
- Update badge count on BottomNavigationView

**Output:** Badge working

---

#### **PHASE 2.5: Activity Tracker (Optional - 30 phút)**

**File:** `com.example.tralalero.util.ActivityTracker.java`

**Purpose:** Track current foreground activity for `NotificationUIManager`

**Implementation:**
```java
public class ActivityTracker implements Application.ActivityLifecycleCallbacks {
    private static Activity currentActivity;
    
    public static Activity getCurrentActivity() {
        return currentActivity;
    }
    
    @Override
    public void onActivityResumed(Activity activity) {
        currentActivity = activity;
    }
    
    @Override
    public void onActivityPaused(Activity activity) {
        if (currentActivity == activity) {
            currentActivity = null;
        }
    }
    
    // Other lifecycle methods...
}
```

**Register in App.java:**
```java
@Override
public void onCreate() {
    super.onCreate();
    registerActivityLifecycleCallbacks(new ActivityTracker());
}
```

**Output:** Current activity tracking

---

#### **PHASE 2.6: UI Testing (45 phút)**

**Test Scenarios:**

**Test 1: In-app Snackbar**
```
1. Login
2. Keep app open
3. Backend: Send test notification
4. Expected: Snackbar appears at bottom
5. Click "XEM" → Navigate to correct screen
```

**Test 2: Deep Linking**
```
1. Test TASK_ASSIGNED → TaskDetailActivity
2. Test MEETING_REMINDER → EventDetailActivity
3. Verify task/event ID passed correctly
```

**Test 3: Badge Count**
```
1. Receive 3 notifications
2. Badge shows "3"
3. Click notification → Badge decrements
```

**Output:** All UI tests passing

---

#### **PHASE 2.7: Polish & Error Handling (30 phút)**

**Tasks:**
- Add null checks for activity references
- Handle case when activity is null (background)
- Add error logs
- Test edge cases

**Error scenarios:**
- Activity destroyed while showing Snackbar
- Deep link to non-existent entity
- Badge API fails

**Output:** Robust error handling

---

### 📦 DEV 2 DELIVERABLES:

**Files created/modified:**
```
app/src/main/java/com/example/tralalero/
├── ui/
│   └── NotificationUIManager.java                      (NEW) ⭐
├── util/
│   ├── DeepLinkNavigator.java                         (NEW) ⭐
│   └── ActivityTracker.java                           (NEW)
├── data/remote/api/
│   └── NotificationApiService.java                     (NEW)
└── feature/home/ui/Home/
    └── HomeActivity.java                               (Modified)
```

**Status checkpoints:**
- [ ] NotificationUIManager implemented
- [ ] Deep link navigation working
- [ ] Notification badge implemented
- [ ] Activity tracker working
- [ ] UI tests passing
- [ ] Error handling complete

**Estimated time:** 3.5 giờ

---

## 🔄 INTEGRATION PHASE (30 phút - CẢ 2 DEV)

### Timeline: Sau khi cả 2 dev hoàn thành công việc riêng

#### **Step 1: Code Review (10 phút)**
- DEV 1 review code của DEV 2
- DEV 2 review code của DEV 1
- Check conflicts (không nên có vì làm khác file)

#### **Step 2: Connect Components (10 phút)**

**DEV 1 updates `App.java`:**
```java
wsManager.setOnNotificationReceivedListener(notification -> {
    // Call DEV 2's UI Manager
    NotificationUIManager.handleInAppNotification(this, notification);
});
```

**DEV 2 updates `NotificationUIManager.java`:**
```java
private static void navigateToDeepLink(...) {
    DeepLinkNavigator.navigate(activity, notification);
    
    // Call DEV 1's WebSocket manager to mark as read
    ((App) activity.getApplication()).getWebSocketManager()
        .markAsRead(notification.getId());
}
```

#### **Step 3: End-to-End Testing (10 phút)**

**Test Flow:**
```
1. Login
2. App foreground
3. Backend: Send test notification
4. Expected:
   ✅ WebSocket receives (DEV 1)
   ✅ Snackbar shows (DEV 2)
   ✅ Click "XEM" → Navigate (DEV 2)
   ✅ Mark as read sent (DEV 1)
   
5. Press Home (background)
6. Backend: Send test notification
7. Expected:
   ✅ WebSocket disconnects (DEV 1)
   ✅ FCM notification shows (DEV 1)
   ✅ Click → Navigate (DEV 2)
```

---

## 📊 PROGRESS TRACKING

### DEV 1 Progress:
```
[ ] Phase 1.1: Dependencies (15 min)
[ ] Phase 1.2: DTOs (20 min)
[ ] Phase 1.3: WebSocket Manager (90 min) ⭐
[ ] Phase 1.4: Lifecycle Observer (40 min)
[ ] Phase 1.5: App Class (20 min)
[ ] Phase 1.6: FCM Service (30 min)
[ ] Phase 1.7: Test (30 min)
────────────────────────────────────────
Total: 3.5 giờ
```

### DEV 2 Progress:
```
[ ] Phase 2.1: Read Context (15 min)
[ ] Phase 2.2: UI Manager (60 min) ⭐
[ ] Phase 2.3: Deep Link Navigator (60 min)
[ ] Phase 2.4: Badge (45 min)
[ ] Phase 2.5: Activity Tracker (30 min)
[ ] Phase 2.6: UI Testing (45 min)
[ ] Phase 2.7: Polish (30 min)
────────────────────────────────────────
Total: 3.5 giờ
```

### Integration Progress:
```
[ ] Code review (10 min)
[ ] Connect components (10 min)
[ ] E2E testing (10 min)
────────────────────────────────────────
Total: 30 phút
```

**Grand Total: 4 giờ**

---

## 🎯 SUCCESS CRITERIA

### DEV 1 (Core):
- [x] WebSocket connects successfully
- [x] Lifecycle management works (foreground/background)
- [x] Auto-reconnect on network failure
- [x] FCM fallback when offline
- [x] Logcat shows clear logs

### DEV 2 (UI):
- [x] In-app Snackbar appears
- [x] Deep linking navigates correctly
- [x] Notification badge updates
- [x] Activity tracker works
- [x] Error handling robust

### Integration:
- [x] End-to-end flow works
- [x] No duplicate notifications
- [x] Mark as read functional
- [x] Battery usage normal

---

## 🔍 TESTING CHECKLIST

### Individual Testing:

**DEV 1 Tests:**
```bash
# Test 1: Connection
1. Login → Check "✅ WebSocket connected"
2. Backend: Send notification → Check received

# Test 2: Lifecycle
3. Press Home → Check "🔴 App BACKGROUND"
4. Open app → Check "🟢 App FOREGROUND"

# Test 3: Reconnection
5. Turn off Wi-Fi → Check "❌ Failure"
6. Turn on Wi-Fi → Check "🔄 Reconnecting"
```

**DEV 2 Tests:**
```bash
# Test 1: UI Display
1. Trigger notification → Snackbar appears
2. Check emoji icon correct for type

# Test 2: Navigation
3. Click "XEM" → Opens TaskDetailActivity
4. Verify task ID passed correctly

# Test 3: Badge
5. Receive 3 notifications → Badge shows "3"
6. Click one → Badge shows "2"
```

### Joint Testing:
```bash
# Test 1: Foreground Flow
Login → Notification arrives → Snackbar → Click → Navigate → Mark read

# Test 2: Background Flow
Login → Home → Notification → System notification → Click → Navigate

# Test 3: No Duplicates
Foreground → Notification → Only Snackbar (no system notification)
```

---

## 📞 COMMUNICATION POINTS

### Daily Sync (5 phút):
- Morning: Share today's tasks
- Noon: Quick progress check
- End: Confirm completion status

### Blocking Issues:
**DEV 1 → DEV 2:**
- "WebSocketManager interface ready" (after Phase 1.3)
- "Lifecycle observer functional" (after Phase 1.4)

**DEV 2 → DEV 1:**
- "NotificationUIManager ready" (after Phase 2.2)
- "Deep linking tested" (after Phase 2.3)

### Integration Point:
- Both complete → Schedule integration session
- Review code together
- Connect components
- Test end-to-end

---

## 🚨 RISK MANAGEMENT

### Potential Issues:

**DEV 1 Risks:**
- WebSocket connection fails → Check backend running, WS_URL correct
- Auto-reconnect not working → Verify exponential backoff logic
- FCM still shows when foreground → Check SharedPreferences flag

**DEV 2 Risks:**
- Snackbar not showing → Check Activity reference not null
- Deep link opens wrong screen → Verify notification type parsing
- Badge not updating → Check API endpoint returns correct count

**Integration Risks:**
- Callback not triggered → Verify listener registration in App.java
- Mark as read fails → Check WebSocket still connected
- Duplicate notifications → Verify `show_fcm_notifications` toggle

---

## 📚 RESOURCES

### For DEV 1:
- `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Phases 1-2
- `WEBSOCKET_ANDROID_SUMMARY.md` - Architecture
- Backend test client: `test-scripts/websocket-test-client.html`

### For DEV 2:
- `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md` - Phase 3
- `PUSH_NOTIFICATION_USE_CASES.md` - Notification types
- `WEBSOCKET_ANDROID_SUMMARY.md` - Expected UI

### For Both:
- `WEBSOCKET_FULL_STACK_SUMMARY.md` - Overall context
- `WEBSOCKET_ANDROID_CHECKLIST.md` - Detailed checklist
- Backend docs: `WEBSOCKET_IMPLEMENTATION_COMPLETE.md`

---

## ✅ DEFINITION OF DONE

### DEV 1 Done:
- [ ] All files created/modified
- [ ] WebSocket connects and receives messages
- [ ] Lifecycle management working
- [ ] FCM service updated
- [ ] Tests passing
- [ ] Code committed to branch `feature/websocket-core`

### DEV 2 Done:
- [ ] All files created/modified
- [ ] In-app notifications showing
- [ ] Deep linking working
- [ ] Badge updating
- [ ] Tests passing
- [ ] Code committed to branch `feature/websocket-ui`

### Integration Done:
- [ ] Branches merged to `fcm`
- [ ] All conflicts resolved
- [ ] End-to-end tests passing
- [ ] No console errors
- [ ] Battery usage verified
- [ ] Ready for QA

---

## 🎉 COMPLETION

Khi tất cả checkboxes được check:
- ✅ DEV 1 complete (Core infrastructure)
- ✅ DEV 2 complete (UI & Navigation)
- ✅ Integration complete (E2E working)

**→ FEATURE READY FOR DEPLOYMENT!** 🚀

---

**Estimated Total Time:**
- DEV 1: 3.5 giờ
- DEV 2: 3.5 giờ
- Integration: 0.5 giờ
- **Total: 4 giờ** (parallel work)

**Strategy:** Làm song song → Không đợi nhau → Merge 1 lần → Test tổng thể ✅
