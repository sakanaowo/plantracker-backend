# 🚀 PLAN TRIỂN KHAI WEBSOCKET + FCM CHO ANDROID CLIENT

**Mục tiêu:** Tích hợp WebSocket real-time notifications vào Android app, kết hợp với FCM để tạo trải nghiệm thông báo tối ưu.

**Thời gian:** 4-5 giờ (1 buổi chiều + sáng hôm sau)

---

## 📊 HIỆN TRẠNG

### ✅ Backend đã có:
- ✅ WebSocket Gateway (`/notifications` namespace)
- ✅ JWT authentication cho WebSocket
- ✅ User room management (`user_{userId}`)
- ✅ Online/offline detection
- ✅ Hybrid delivery: WebSocket (online) + FCM (offline)
- ✅ 19 notification use cases đã phân tích
- ✅ FCM Service hoạt động

### ✅ Android đã có:
- ✅ FCM token registration
- ✅ MyFirebaseMessagingService
- ✅ API client (Retrofit)
- ✅ JWT token management

### ❌ Android chưa có:
- ❌ WebSocket client
- ❌ Lifecycle-aware connection management
- ❌ Notification deduplication (WebSocket vs FCM)
- ❌ In-app notification UI
- ❌ Deep linking support
- ❌ WebSocket reconnection logic

---

## 🏗️ KIẾN TRÚC

```
┌────────────────────────────────────────────────────────────┐
│                    ANDROID APP                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────┐            │
│  │  NotificationWebSocketManager            │            │
│  │  - OkHttp WebSocket Client               │            │
│  │  - JWT Auth                              │            │
│  │  - Auto-reconnect                        │            │
│  │  - Message parsing                       │            │
│  └──────────────────────────────────────────┘            │
│           ▲                           │                   │
│           │                           ▼                   │
│  ┌────────┴─────────┐     ┌──────────────────┐          │
│  │  AppLifecycle    │     │  NotificationUI  │          │
│  │  Observer        │     │  Manager         │          │
│  │  - onForeground  │     │  - In-app banner │          │
│  │  - onBackground  │     │  - Badge count   │          │
│  └──────────────────┘     │  - Deduplication │          │
│                           └──────────────────┘          │
│                                                            │
│  ┌──────────────────────────────────────────┐            │
│  │  MyFirebaseMessagingService              │            │
│  │  - Check app state                       │            │
│  │  - Skip if foreground (WS handles)       │            │
│  │  - Show system notification if background│            │
│  └──────────────────────────────────────────┘            │
│                                                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   BACKEND (NestJS)    │
              ├───────────────────────┤
              │ WebSocket Gateway     │
              │ FCM Service           │
              │ NotificationsService  │
              └───────────────────────┘
```

### Flow Logic:

**App FOREGROUND (đang mở):**
```
User online → Backend check isUserOnline()
           → Send via WebSocket
           → Android receives in <100ms
           → Show in-app banner/snackbar
           → Update notification badge
           → NO system notification (tránh duplicate)
```

**App BACKGROUND (đã đóng/minimize):**
```
User offline → Backend check isUserOnline() = false
            → Send via FCM
            → Android receives FCM push (1-10s)
            → MyFirebaseMessagingService handles
            → Show system notification tray
            → User clicks → Open app with deep link
```

---

## ⏱️ TIMELINE CHI TIẾT (4-5 giờ)

### **GIAI ĐOẠN 1: WebSocket Client Setup (90 phút)**

#### Bước 1.1: Thêm dependencies (5 phút)

**File:** `Plantracker/app/build.gradle.kts`

```kotlin
dependencies {
    // WebSocket client
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // JSON parsing (đã có Gson rồi)
    // implementation("com.google.code.gson:gson:2.10.1")
    
    // Lifecycle aware components
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")
    
    // Existing dependencies...
    implementation("com.google.firebase:firebase-messaging:23.4.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
}
```

**Commands:**
```bash
cd Plantracker
./gradlew clean
./gradlew build
```

---

#### Bước 1.2: Tạo WebSocket DTOs (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/dto/websocket/WebSocketMessage.java`

```java
package com.example.tralalero.data.remote.dto.websocket;

import com.google.gson.annotations.SerializedName;

public class WebSocketMessage {
    @SerializedName("event")
    private String event;
    
    @SerializedName("data")
    private Object data;
    
    public WebSocketMessage() {}
    
    public WebSocketMessage(String event, Object data) {
        this.event = event;
        this.data = data;
    }
    
    // Getters & Setters
    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }
    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }
}
```

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/dto/websocket/NotificationPayload.java`

```java
package com.example.tralalero.data.remote.dto.websocket;

import com.google.gson.annotations.SerializedName;
import java.util.Map;

/**
 * Notification payload received from WebSocket
 * Matches backend NotificationPayload interface
 */
public class NotificationPayload {
    @SerializedName("id")
    private String id;
    
    @SerializedName("type")
    private String type; // TASK_ASSIGNED, MEETING_REMINDER, etc.
    
    @SerializedName("title")
    private String title;
    
    @SerializedName("body")
    private String body;
    
    @SerializedName("data")
    private Map<String, Object> data; // taskId, projectName, deeplink, etc.
    
    @SerializedName("createdAt")
    private String createdAt;
    
    // Getters & Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
    
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
```

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/dto/websocket/SubscribeRequest.java`

```java
package com.example.tralalero.data.remote.dto.websocket;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class SubscribeRequest {
    @SerializedName("types")
    private List<String> types;
    
    public SubscribeRequest(List<String> types) {
        this.types = types;
    }
    
    public List<String> getTypes() { return types; }
    public void setTypes(List<String> types) { this.types = types; }
}
```

---

#### Bước 1.3: Tạo WebSocket Manager (45 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/service/NotificationWebSocketManager.java`

```java
package com.example.tralalero.service;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.example.tralalero.BuildConfig;
import com.example.tralalero.data.remote.dto.websocket.NotificationPayload;
import com.example.tralalero.data.remote.dto.websocket.SubscribeRequest;
import com.example.tralalero.data.remote.dto.websocket.WebSocketMessage;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * Manages WebSocket connection for real-time notifications
 * 
 * Responsibilities:
 * - Connect to backend WebSocket server with JWT auth
 * - Subscribe to notification types
 * - Handle incoming notifications
 * - Auto-reconnect on failure
 * - Lifecycle aware (connect on foreground, disconnect on background)
 */
public class NotificationWebSocketManager {
    private static final String TAG = "WebSocketManager";
    
    // WebSocket connection URL
    private static final String WS_URL = BuildConfig.WS_URL; // e.g., "ws://10.0.2.2:3000/notifications"
    
    // Reconnection settings
    private static final int MAX_RECONNECT_DELAY_MS = 30_000; // Max 30 seconds
    private static final int INITIAL_RECONNECT_DELAY_MS = 1_000; // Start with 1 second
    
    private final Context context;
    private final Gson gson;
    private OkHttpClient client;
    private WebSocket webSocket;
    
    private String authToken;
    private boolean intentionalDisconnect = false;
    private int reconnectAttempts = 0;
    private final Set<String> shownNotificationIds = new HashSet<>();
    
    // Callbacks
    private OnNotificationReceivedListener onNotificationReceivedListener;
    private OnConnectionStateChangeListener onConnectionStateChangeListener;
    
    public interface OnNotificationReceivedListener {
        void onNotificationReceived(NotificationPayload notification);
    }
    
    public interface OnConnectionStateChangeListener {
        void onConnected();
        void onDisconnected();
    }
    
    public NotificationWebSocketManager(Context context) {
        this.context = context.getApplicationContext();
        this.gson = new Gson();
        initializeOkHttpClient();
    }
    
    private void initializeOkHttpClient() {
        this.client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MINUTES) // No timeout for WebSocket
            .writeTimeout(10, TimeUnit.SECONDS)
            .pingInterval(30, TimeUnit.SECONDS) // Send ping every 30s to keep connection alive
            .build();
    }
    
    /**
     * Connect to WebSocket server
     * @param token JWT auth token
     */
    public void connect(String token) {
        if (webSocket != null) {
            Log.w(TAG, "WebSocket already connected");
            return;
        }
        
        this.authToken = token;
        this.intentionalDisconnect = false;
        
        Log.d(TAG, "Connecting to WebSocket: " + WS_URL);
        
        Request request = new Request.Builder()
            .url(WS_URL)
            .addHeader("Authorization", "Bearer " + token)
            .build();
        
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket webSocket, @NonNull Response response) {
                Log.d(TAG, "✅ WebSocket connected");
                reconnectAttempts = 0; // Reset reconnect counter
                
                if (onConnectionStateChangeListener != null) {
                    onConnectionStateChangeListener.onConnected();
                }
                
                // Subscribe to notification types after connection
                subscribeToNotifications();
            }
            
            @Override
            public void onMessage(@NonNull WebSocket webSocket, @NonNull String text) {
                Log.d(TAG, "📨 Message received: " + text);
                handleMessage(text);
            }
            
            @Override
            public void onMessage(@NonNull WebSocket webSocket, @NonNull ByteString bytes) {
                Log.d(TAG, "📨 Binary message received (ignored)");
            }
            
            @Override
            public void onClosing(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
                Log.d(TAG, "⚠️ WebSocket closing: " + code + " - " + reason);
            }
            
            @Override
            public void onClosed(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
                Log.d(TAG, "❌ WebSocket closed: " + code + " - " + reason);
                NotificationWebSocketManager.this.webSocket = null;
                
                if (onConnectionStateChangeListener != null) {
                    onConnectionStateChangeListener.onDisconnected();
                }
                
                // Auto-reconnect if not intentional disconnect
                if (!intentionalDisconnect) {
                    scheduleReconnect();
                }
            }
            
            @Override
            public void onFailure(@NonNull WebSocket webSocket, @NonNull Throwable t, Response response) {
                Log.e(TAG, "❌ WebSocket failure: " + t.getMessage(), t);
                NotificationWebSocketManager.this.webSocket = null;
                
                if (onConnectionStateChangeListener != null) {
                    onConnectionStateChangeListener.onDisconnected();
                }
                
                // Auto-reconnect with exponential backoff
                if (!intentionalDisconnect) {
                    scheduleReconnect();
                }
            }
        });
    }
    
    /**
     * Disconnect from WebSocket server
     */
    public void disconnect() {
        Log.d(TAG, "Disconnecting WebSocket (intentional)");
        intentionalDisconnect = true;
        
        if (webSocket != null) {
            webSocket.close(1000, "App going to background");
            webSocket = null;
        }
    }
    
    /**
     * Subscribe to notification types after connection
     */
    private void subscribeToNotifications() {
        List<String> types = Arrays.asList(
            "TASK_ASSIGNED",
            "MEETING_REMINDER",
            "TASK_UPDATED",
            "EVENT_INVITE",
            "EVENT_UPDATED",
            "TIME_REMINDER",
            "TASK_MOVED",
            "SYSTEM"
        );
        
        SubscribeRequest request = new SubscribeRequest(types);
        WebSocketMessage message = new WebSocketMessage("subscribe", request);
        
        String json = gson.toJson(message);
        boolean sent = webSocket.send(json);
        
        if (sent) {
            Log.d(TAG, "📬 Subscribed to notification types: " + types);
        } else {
            Log.e(TAG, "❌ Failed to send subscribe message");
        }
    }
    
    /**
     * Handle incoming WebSocket message
     */
    private void handleMessage(String text) {
        try {
            JsonObject jsonObject = gson.fromJson(text, JsonObject.class);
            String event = jsonObject.has("event") ? jsonObject.get("event").getAsString() : "";
            
            switch (event) {
                case "connected":
                    Log.d(TAG, "✅ Welcome message: " + text);
                    break;
                    
                case "notification":
                    // Parse notification payload
                    JsonObject data = jsonObject.getAsJsonObject("data");
                    NotificationPayload notification = gson.fromJson(data, NotificationPayload.class);
                    handleNotification(notification);
                    break;
                    
                case "subscribed":
                    Log.d(TAG, "✅ Subscription confirmed: " + text);
                    break;
                    
                case "pong":
                    Log.d(TAG, "🏓 Pong received");
                    break;
                    
                default:
                    Log.w(TAG, "⚠️ Unknown event: " + event);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error parsing message: " + text, e);
        }
    }
    
    /**
     * Handle incoming notification
     * Checks for duplicates before notifying listener
     */
    private void handleNotification(NotificationPayload notification) {
        // Check for duplicate (in case FCM also sent this)
        if (shownNotificationIds.contains(notification.getId())) {
            Log.d(TAG, "⚠️ Duplicate notification (already shown): " + notification.getId());
            return;
        }
        
        // Mark as shown
        shownNotificationIds.add(notification.getId());
        
        // Clean up old IDs (keep last 100)
        if (shownNotificationIds.size() > 100) {
            shownNotificationIds.clear();
        }
        
        Log.d(TAG, "🔔 Notification received: " + notification.getTitle());
        
        // Notify listener
        if (onNotificationReceivedListener != null) {
            onNotificationReceivedListener.onNotificationReceived(notification);
        }
        
        // Mark as delivered (optional - call backend API)
        markAsDelivered(notification.getId());
    }
    
    /**
     * Send mark_read event to server
     */
    public void markAsRead(String notificationId) {
        if (webSocket == null) {
            Log.w(TAG, "Cannot mark as read: WebSocket not connected");
            return;
        }
        
        JsonObject data = new JsonObject();
        data.addProperty("notificationId", notificationId);
        
        WebSocketMessage message = new WebSocketMessage("mark_read", data);
        String json = gson.toJson(message);
        
        boolean sent = webSocket.send(json);
        if (sent) {
            Log.d(TAG, "✓ Marked as read: " + notificationId);
        } else {
            Log.e(TAG, "❌ Failed to mark as read");
        }
    }
    
    /**
     * Send ping to server (health check)
     */
    public void sendPing() {
        if (webSocket == null) {
            Log.w(TAG, "Cannot send ping: WebSocket not connected");
            return;
        }
        
        WebSocketMessage message = new WebSocketMessage("ping", new JsonObject());
        String json = gson.toJson(message);
        
        boolean sent = webSocket.send(json);
        if (sent) {
            Log.d(TAG, "🏓 Ping sent");
        }
    }
    
    /**
     * Mark notification as delivered (call backend API)
     */
    private void markAsDelivered(String notificationId) {
        // TODO: Call API endpoint to mark notification as DELIVERED
        // PATCH /notifications/{id}/delivered
        Log.d(TAG, "📨 Marking as delivered: " + notificationId);
    }
    
    /**
     * Schedule reconnection with exponential backoff
     */
    private void scheduleReconnect() {
        reconnectAttempts++;
        
        // Calculate delay with exponential backoff
        long delayMs = Math.min(
            INITIAL_RECONNECT_DELAY_MS * (long) Math.pow(2, reconnectAttempts - 1),
            MAX_RECONNECT_DELAY_MS
        );
        
        Log.d(TAG, "🔄 Scheduling reconnect #" + reconnectAttempts + " in " + delayMs + "ms");
        
        // Reconnect after delay (using Handler)
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            if (!intentionalDisconnect && authToken != null) {
                Log.d(TAG, "🔄 Attempting reconnect...");
                connect(authToken);
            }
        }, delayMs);
    }
    
    // Setters for callbacks
    public void setOnNotificationReceivedListener(OnNotificationReceivedListener listener) {
        this.onNotificationReceivedListener = listener;
    }
    
    public void setOnConnectionStateChangeListener(OnConnectionStateChangeListener listener) {
        this.onConnectionStateChangeListener = listener;
    }
    
    public boolean isConnected() {
        return webSocket != null;
    }
}
```

---

#### Bước 1.4: Thêm WS_URL vào BuildConfig (10 phút)

**File:** `Plantracker/app/build.gradle.kts`

```kotlin
android {
    // ...
    
    buildTypes {
        debug {
            buildConfigField("String", "WS_URL", "\"ws://10.0.2.2:3000/notifications\"")
            // 10.0.2.2 = localhost for Android Emulator
            // For physical device: Use your local IP (e.g., "ws://192.168.1.100:3000/notifications")
        }
        
        release {
            buildConfigField("String", "WS_URL", "\"wss://your-backend.com/notifications\"")
            // Production: Always use WSS (WebSocket Secure)
        }
    }
    
    buildFeatures {
        buildConfig = true // Enable BuildConfig
    }
}
```

---

#### Bước 1.5: Test WebSocket connection (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/feature/test/WebSocketTestActivity.java` (optional)

```java
package com.example.tralalero.feature.test;

import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.example.tralalero.R;
import com.example.tralalero.App;
import com.example.tralalero.service.NotificationWebSocketManager;

public class WebSocketTestActivity extends AppCompatActivity {
    private NotificationWebSocketManager wsManager;
    private TextView statusText;
    private Button connectBtn, disconnectBtn, pingBtn;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_websocket_test);
        
        statusText = findViewById(R.id.statusText);
        connectBtn = findViewById(R.id.connectBtn);
        disconnectBtn = findViewById(R.id.disconnectBtn);
        pingBtn = findViewById(R.id.pingBtn);
        
        wsManager = new NotificationWebSocketManager(this);
        
        wsManager.setOnConnectionStateChangeListener(new NotificationWebSocketManager.OnConnectionStateChangeListener() {
            @Override
            public void onConnected() {
                runOnUiThread(() -> statusText.setText("✅ Connected"));
            }
            
            @Override
            public void onDisconnected() {
                runOnUiThread(() -> statusText.setText("❌ Disconnected"));
            }
        });
        
        wsManager.setOnNotificationReceivedListener(notification -> {
            runOnUiThread(() -> {
                String msg = "🔔 " + notification.getTitle() + ": " + notification.getBody();
                statusText.setText(msg);
            });
        });
        
        connectBtn.setOnClickListener(v -> {
            String token = App.authManager.getToken(); // Get JWT token
            wsManager.connect(token);
        });
        
        disconnectBtn.setOnClickListener(v -> wsManager.disconnect());
        pingBtn.setOnClickListener(v -> wsManager.sendPing());
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        wsManager.disconnect();
    }
}
```

**Test:**
1. Login to app → Get JWT token
2. Click "Connect" → Check Logcat for "✅ WebSocket connected"
3. From backend, send test notification (POST `/notifications/test/send`)
4. Android should receive notification in <100ms

---

### **GIAI ĐOẠN 2: Lifecycle Management (60 phút)**

#### Bước 2.1: Tạo App Lifecycle Observer (30 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/service/AppLifecycleObserver.java`

```java
package com.example.tralalero.service;

import android.util.Log;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.annotation.NonNull;

import com.example.tralalero.App;

/**
 * Observes app lifecycle to manage WebSocket connections
 * 
 * FOREGROUND: Connect WebSocket for real-time notifications
 * BACKGROUND: Disconnect WebSocket to save battery (use FCM instead)
 */
public class AppLifecycleObserver implements DefaultLifecycleObserver {
    private static final String TAG = "AppLifecycleObserver";
    
    private final NotificationWebSocketManager wsManager;
    private final App app;
    
    public AppLifecycleObserver(App app, NotificationWebSocketManager wsManager) {
        this.app = app;
        this.wsManager = wsManager;
    }
    
    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        Log.d(TAG, "🟢 App FOREGROUND");
        
        // Get JWT token
        String token = app.authManager != null ? app.authManager.getToken() : null;
        
        if (token != null && !token.isEmpty()) {
            // Connect WebSocket for real-time notifications
            wsManager.connect(token);
            
            // Disable FCM local notifications (WebSocket handles it)
            setFCMNotificationsEnabled(false);
        } else {
            Log.w(TAG, "No auth token, skipping WebSocket connection");
        }
    }
    
    @Override
    public void onStop(@NonNull LifecycleOwner owner) {
        Log.d(TAG, "🔴 App BACKGROUND");
        
        // Disconnect WebSocket to save battery
        wsManager.disconnect();
        
        // Re-enable FCM local notifications
        setFCMNotificationsEnabled(true);
    }
    
    /**
     * Enable/disable FCM local notification display
     * When enabled (background): FCM shows system notifications
     * When disabled (foreground): FCM silent, WebSocket handles it
     */
    private void setFCMNotificationsEnabled(boolean enabled) {
        app.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            .edit()
            .putBoolean("show_fcm_notifications", enabled)
            .apply();
        
        Log.d(TAG, "FCM notifications " + (enabled ? "ENABLED" : "DISABLED"));
    }
}
```

---

#### Bước 2.2: Update App class (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/App.java`

```java
package com.example.tralalero;

import android.app.Application;
import androidx.lifecycle.ProcessLifecycleOwner;

import com.example.tralalero.auth.AuthManager;
import com.example.tralalero.service.AppLifecycleObserver;
import com.example.tralalero.service.NotificationWebSocketManager;

public class App extends Application {
    public static AuthManager authManager;
    
    // WebSocket manager (singleton)
    private NotificationWebSocketManager wsManager;
    
    @Override
    public void onCreate() {
        super.onCreate();
        
        // Initialize AuthManager
        authManager = new AuthManager(this);
        
        // Initialize WebSocket manager
        wsManager = new NotificationWebSocketManager(this);
        
        // Setup callbacks
        wsManager.setOnNotificationReceivedListener(notification -> {
            // Handle notification globally (update badge, show banner, etc.)
            NotificationUIManager.handleInAppNotification(this, notification);
        });
        
        wsManager.setOnConnectionStateChangeListener(new NotificationWebSocketManager.OnConnectionStateChangeListener() {
            @Override
            public void onConnected() {
                // Update UI (show connected indicator)
            }
            
            @Override
            public void onDisconnected() {
                // Update UI (show offline indicator)
            }
        });
        
        // Observe app lifecycle
        AppLifecycleObserver lifecycleObserver = new AppLifecycleObserver(this, wsManager);
        ProcessLifecycleOwner.get().getLifecycle().addObserver(lifecycleObserver);
    }
    
    public NotificationWebSocketManager getWebSocketManager() {
        return wsManager;
    }
}
```

---

#### Bước 2.3: Update MyFirebaseMessagingService (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/service/MyFirebaseMessagingService.java`

```java
// ADD này vào đầu onMessageReceived()
@Override
public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
    Log.d(TAG, "📩 FCM message received: " + remoteMessage.getData());
    
    // ✅ CHECK: Is app in foreground?
    SharedPreferences prefs = getSharedPreferences("app_prefs", MODE_PRIVATE);
    boolean showFCMNotifications = prefs.getBoolean("show_fcm_notifications", true);
    
    if (!showFCMNotifications) {
        // App is FOREGROUND → WebSocket already handled it
        Log.d(TAG, "⚠️ App in foreground, skipping FCM notification (WebSocket handled)");
        return;
    }
    
    // App is BACKGROUND → Show system notification
    Log.d(TAG, "✅ App in background, showing FCM notification");
    
    // Parse notification data
    String title = remoteMessage.getData().get("title");
    String body = remoteMessage.getData().get("body");
    String type = remoteMessage.getData().get("type");
    String notificationId = remoteMessage.getData().get("notificationId");
    
    // Show system notification
    showSystemNotification(title, body, type, remoteMessage.getData());
}

private void showSystemNotification(String title, String body, String type, Map<String, String> data) {
    // Existing notification code...
    // Make sure to include deep link intent
}
```

---

### **GIAI ĐOẠN 3: In-App Notification UI (90 phút)**

#### Bước 3.1: Tạo NotificationUIManager (40 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/ui/NotificationUIManager.java`

```java
package com.example.tralalero.ui;

import android.app.Activity;
import android.content.Context;
import android.view.View;
import android.widget.Toast;

import com.example.tralalero.data.remote.dto.websocket.NotificationPayload;
import com.google.android.material.snackbar.Snackbar;

/**
 * Manages in-app notification display (banners, snackbars, badges)
 */
public class NotificationUIManager {
    private static final String TAG = "NotificationUIManager";
    
    /**
     * Show in-app notification banner
     * Called when WebSocket receives notification while app is open
     */
    public static void handleInAppNotification(Context context, NotificationPayload notification) {
        // Get current activity
        Activity activity = getCurrentActivity(context);
        if (activity == null) {
            // No active activity, skip
            return;
        }
        
        // Show Snackbar with action
        View rootView = activity.findViewById(android.R.id.content);
        if (rootView == null) return;
        
        Snackbar snackbar = Snackbar.make(
            rootView,
            getNotificationIcon(notification.getType()) + " " + notification.getBody(),
            Snackbar.LENGTH_LONG
        );
        
        // Add "View" action
        snackbar.setAction("XEM", v -> {
            // Navigate to deep link
            String deeplink = (String) notification.getData().get("deeplink");
            if (deeplink != null) {
                navigateToDeepLink(activity, deeplink, notification);
            }
        });
        
        snackbar.show();
        
        // Update notification badge count
        updateBadgeCount(context);
    }
    
    /**
     * Get emoji icon for notification type
     */
    private static String getNotificationIcon(String type) {
        switch (type) {
            case "TASK_ASSIGNED": return "📋";
            case "MEETING_REMINDER": return "📅";
            case "TASK_UPDATED": return "✏️";
            case "EVENT_INVITE": return "🎉";
            case "TIME_REMINDER": return "⏰";
            case "TASK_MOVED": return "↔️";
            case "SYSTEM": return "ℹ️";
            default: return "🔔";
        }
    }
    
    /**
     * Navigate to deep link
     */
    private static void navigateToDeepLink(Activity activity, String deeplink, NotificationPayload notification) {
        // TODO: Implement deep link navigation
        // Example: /tasks/{taskId} → Open TaskDetailActivity
        //          /events/{eventId} → Open EventDetailActivity
        
        Toast.makeText(activity, "Navigate to: " + deeplink, Toast.LENGTH_SHORT).show();
        
        // Mark as read
        // wsManager.markAsRead(notification.getId());
    }
    
    /**
     * Update notification badge count
     */
    private static void updateBadgeCount(Context context) {
        // TODO: Call API to get unread count
        // GET /notifications/unread
        // Update badge on bottom navigation
    }
    
    /**
     * Get current foreground activity
     */
    private static Activity getCurrentActivity(Context context) {
        // TODO: Implement activity tracker
        // Store current activity in App class
        return null;
    }
}
```

---

#### Bước 3.2: Implement Deep Linking (30 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/util/DeepLinkNavigator.java`

```java
package com.example.tralalero.util;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.example.tralalero.data.remote.dto.websocket.NotificationPayload;
import com.example.tralalero.feature.task.ui.TaskDetailActivity;
// import other activities...

import java.util.Map;

/**
 * Handles deep link navigation from notifications
 */
public class DeepLinkNavigator {
    private static final String TAG = "DeepLinkNavigator";
    
    /**
     * Navigate to screen based on notification payload
     */
    public static void navigate(Context context, NotificationPayload notification) {
        String type = notification.getType();
        Map<String, Object> data = notification.getData();
        
        switch (type) {
            case "TASK_ASSIGNED":
            case "TASK_UPDATED":
            case "TASK_MOVED":
                navigateToTask(context, (String) data.get("taskId"));
                break;
                
            case "MEETING_REMINDER":
            case "EVENT_INVITE":
            case "EVENT_UPDATED":
                navigateToEvent(context, (String) data.get("eventId"));
                break;
                
            case "TIME_REMINDER":
                // Check if task or event
                if (data.containsKey("taskId")) {
                    navigateToTask(context, (String) data.get("taskId"));
                } else if (data.containsKey("eventId")) {
                    navigateToEvent(context, (String) data.get("eventId"));
                }
                break;
                
            case "SYSTEM":
                // Navigate to notification center
                navigateToNotificationCenter(context);
                break;
                
            default:
                Log.w(TAG, "Unknown notification type: " + type);
        }
    }
    
    private static void navigateToTask(Context context, String taskId) {
        Intent intent = new Intent(context, TaskDetailActivity.class);
        intent.putExtra("task_id", taskId);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
    
    private static void navigateToEvent(Context context, String eventId) {
        // TODO: Create EventDetailActivity
        Log.d(TAG, "Navigate to event: " + eventId);
    }
    
    private static void navigateToNotificationCenter(Context context) {
        // TODO: Create NotificationCenterActivity
        Log.d(TAG, "Navigate to notification center");
    }
}
```

**Update NotificationUIManager:**
```java
private static void navigateToDeepLink(Activity activity, String deeplink, NotificationPayload notification) {
    DeepLinkNavigator.navigate(activity, notification);
    
    // Mark as read
    ((App) activity.getApplication()).getWebSocketManager().markAsRead(notification.getId());
}
```

---

#### Bước 3.3: Notification Badge (20 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/feature/home/ui/Home/HomeActivity.java`

```java
// ADD vào onCreate()
private void setupNotificationBadge() {
    // Get unread count from API
    fetchUnreadNotificationCount();
    
    // Setup WebSocket listener
    ((App) getApplication()).getWebSocketManager().setOnNotificationReceivedListener(notification -> {
        runOnUiThread(() -> {
            // Increment badge
            updateNotificationBadge();
        });
    });
}

private void fetchUnreadNotificationCount() {
    // TODO: Call API GET /notifications/unread
    // Update badge count on bottom navigation
}

private void updateNotificationBadge() {
    // TODO: Increment badge count
    // OR fetch from API for accurate count
}
```

---

### **GIAI ĐOẠN 4: Testing & Optimization (60 phút)**

#### Bước 4.1: Test Scenarios (30 phút)

**Test Case 1: App Foreground → WebSocket**
```
1. Login to app
2. Keep app open (foreground)
3. From backend: Send test notification
4. Expected:
   - Logcat: "✅ WebSocket connected"
   - Logcat: "🔔 Notification received: ..."
   - UI: Snackbar appears with notification
   - No system notification in tray
```

**Test Case 2: App Background → FCM**
```
1. Login to app
2. Press Home button (app goes background)
3. From backend: Send test notification
4. Expected:
   - Logcat: "🔴 App BACKGROUND"
   - Logcat: "📩 FCM message received"
   - System notification appears in tray
   - Click notification → Opens app with deep link
```

**Test Case 3: Reconnection**
```
1. Connect WebSocket
2. Turn off Wi-Fi
3. Turn on Wi-Fi
4. Expected:
   - Logcat: "❌ WebSocket failure"
   - Logcat: "🔄 Scheduling reconnect #1"
   - Logcat: "🔄 Attempting reconnect..."
   - Logcat: "✅ WebSocket connected"
```

**Test Case 4: Deduplication**
```
1. App foreground (WebSocket connected)
2. Backend sends notification (both WebSocket + FCM)
3. Expected:
   - Only ONE notification shown (via WebSocket)
   - FCM silently skipped (already shown)
```

---

#### Bước 4.2: Performance Optimization (20 phút)

**Battery Optimization:**
```java
// In NotificationWebSocketManager.java
// ALREADY IMPLEMENTED:
- Auto-disconnect on background (saves battery)
- Ping interval: 30s (not too frequent)
- Exponential backoff for reconnection (prevents network spam)
```

**Network Optimization:**
```java
// In NotificationWebSocketManager.java
private void initializeOkHttpClient() {
    this.client = new OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES) // No timeout for WebSocket
        .writeTimeout(10, TimeUnit.SECONDS)
        .pingInterval(30, TimeUnit.SECONDS) // ← Key for keep-alive
        .retryOnConnectionFailure(true) // ← Auto-retry
        .build();
}
```

**Memory Optimization:**
```java
// Clean up old notification IDs
if (shownNotificationIds.size() > 100) {
    shownNotificationIds.clear();
}
```

---

#### Bước 4.3: Error Handling (10 phút)

**Add error handling:**
```java
// In NotificationWebSocketManager.java
@Override
public void onFailure(@NonNull WebSocket webSocket, @NonNull Throwable t, Response response) {
    Log.e(TAG, "❌ WebSocket failure: " + t.getMessage(), t);
    
    // Handle specific errors
    if (t instanceof java.net.UnknownHostException) {
        Log.e(TAG, "Network error: Cannot resolve host");
    } else if (t instanceof java.net.SocketTimeoutException) {
        Log.e(TAG, "Network error: Connection timeout");
    } else if (t instanceof javax.net.ssl.SSLException) {
        Log.e(TAG, "SSL error: " + t.getMessage());
    }
    
    // ... existing code
}
```

---

## 📋 CHECKLIST HOÀN THÀNH

### Giai đoạn 1: WebSocket Client
- [ ] Dependencies added (OkHttp, Lifecycle)
- [ ] DTOs created (WebSocketMessage, NotificationPayload)
- [ ] NotificationWebSocketManager implemented
- [ ] BuildConfig WS_URL configured
- [ ] Test connection successful

### Giai đoạn 2: Lifecycle Management
- [ ] AppLifecycleObserver created
- [ ] App class updated
- [ ] MyFirebaseMessagingService updated
- [ ] Foreground/Background logic working

### Giai đoạn 3: In-App UI
- [ ] NotificationUIManager created
- [ ] In-app banners showing
- [ ] Deep linking working
- [ ] Notification badge implemented

### Giai đoạn 4: Testing
- [ ] Foreground test passed (WebSocket)
- [ ] Background test passed (FCM)
- [ ] Reconnection test passed
- [ ] Deduplication test passed
- [ ] Battery optimization verified

---

## 🚀 EXPECTED RESULTS

### App Foreground:
```
Logcat:
D/AppLifecycleObserver: 🟢 App FOREGROUND
D/WebSocketManager: Connecting to WebSocket: ws://10.0.2.2:3000/notifications
D/WebSocketManager: ✅ WebSocket connected
D/WebSocketManager: 📬 Subscribed to notification types: [TASK_ASSIGNED, ...]
D/WebSocketManager: 🔔 Notification received: Task Mới
I/NotificationUIManager: Showing in-app banner: Admin assigned task

UI:
- Snackbar appears at bottom: "📋 Admin đã giao task cho bạn"
- Action button: "XEM"
- Click → Navigate to TaskDetailActivity
```

### App Background:
```
Logcat:
D/AppLifecycleObserver: 🔴 App BACKGROUND
D/WebSocketManager: Disconnecting WebSocket (intentional)
D/FCMService: 📩 FCM message received: {type=task_assigned, taskId=...}
D/FCMService: ✅ App in background, showing FCM notification

System Notification Tray:
- Title: "📋 Task Mới"
- Body: "Admin đã giao task cho bạn trong project PlanTracker"
- Click → Opens app → Navigate to task detail
```

---

## 🔧 TROUBLESHOOTING

### Issue 1: WebSocket không connect
**Solution:**
- Check backend running: `npm run dev`
- Check WS_URL correct (emulator: `ws://10.0.2.2:3000/notifications`)
- Verify JWT token valid: `Log.d("Token", authToken);`
- Check backend logs: `✅ User {userId} connected via WebSocket`

### Issue 2: Nhận duplicate notifications
**Solution:**
- Verify `show_fcm_notifications` flag đang toggle đúng
- Check `shownNotificationIds` Set đang track đúng
- Backend KHÔNG gửi cả WebSocket + FCM cùng lúc nữa (đã fix)

### Issue 3: Battery drain
**Solution:**
- Verify disconnect on background: `onStop()` called
- Check ping interval không quá ngắn (30s là OK)
- Monitor battery usage: Settings → Battery → App usage

---

## 📚 TÀI LIỆU LIÊN QUAN

- `WEBSOCKET_IMPLEMENTATION_COMPLETE.md` - Backend implementation
- `PUSH_NOTIFICATION_USE_CASES.md` - 19 use cases
- `FCM_TOKEN_REGISTRATION_FIX.md` - FCM setup
- Backend test: `test-scripts/websocket-test-client.html`

---

**Tổng thời gian:** 4-5 giờ  
**Kết quả:** Real-time notifications với latency <100ms + FCM fallback  
**Status:** Ready to implement! 🚀
