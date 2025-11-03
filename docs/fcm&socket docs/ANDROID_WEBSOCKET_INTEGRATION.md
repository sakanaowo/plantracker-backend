# Android WebSocket Integration Guide

## ✅ Câu trả lời: CÓ - Android Studio hoàn toàn hỗ trợ WebSocket!

Android có nhiều thư viện WebSocket mạnh mẽ, và kết hợp WebSocket + FCM sẽ tạo ra trải nghiệm thông báo tốt nhất.

---

## 📊 So sánh WebSocket vs FCM Push

| Tiêu chí | **WebSocket** | **FCM Push** |
|----------|--------------|--------------|
| **Latency** | ⚡ Real-time (< 100ms) | 🐢 1-10 giây delay |
| **Battery** | 🔋 Tiêu tốn pin hơn | ✅ Tối ưu pin (Google optimization) |
| **App closed** | ❌ Không hoạt động | ✅ Vẫn nhận được |
| **App foreground** | ✅ Tuyệt vời | ⚠️ Có thể bị delay |
| **Network** | 📡 Cần connection liên tục | ✅ Hoạt động khi online |
| **Data limit** | 🚀 Unlimited payload | ⚠️ Max 4KB |
| **Use case** | In-app real-time updates | Background notifications |

---

## 🎯 Kiến trúc Hybrid (Recommended)

```
┌─────────────────────────────────────────────────────────┐
│                    Android App                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐         ┌──────────────┐            │
│  │ WebSocket    │◄───────►│   Socket.IO  │            │ ⚡ Foreground
│  │ Client       │ WSS     │   Gateway    │            │    Real-time
│  │ (OkHttp)     │         │   (NestJS)   │            │    < 100ms
│  └──────────────┘         └──────────────┘            │
│        ▲                                               │
│        │                                               │
│        │ App Lifecycle                                 │
│        │ (onResume/onPause)                           │
│        ▼                                               │
│  ┌──────────────┐         ┌──────────────┐            │
│  │ FCM          │◄───────►│  FCM Service │            │ 🔔 Background
│  │ Receiver     │ HTTPS   │  (Backend)   │            │    Push
│  │ Service      │         │              │            │    1-10s
│  └──────────────┘         └──────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘

Strategy:
- App FOREGROUND → WebSocket (real-time updates)
- App BACKGROUND → FCM Push (system notifications)
```

---

## 📱 Android Implementation

### 1. Dependencies (build.gradle.kts)

```kotlin
dependencies {
    // WebSocket client
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")
    // OR
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
    
    // FCM (already have)
    implementation("com.google.firebase:firebase-messaging:23.4.0")
    
    // Coroutines for async
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    
    // Lifecycle (for app state)
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")
}
```

---

### 2. WebSocket Manager

```kotlin
// NotificationWebSocketManager.kt
import okhttp3.*
import okio.ByteString
import kotlinx.coroutines.*
import com.google.gson.Gson

class NotificationWebSocketManager(
    private val baseUrl: String,
    private val authToken: String
) {
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()
    private val gson = Gson()
    
    private var reconnectJob: Job? = null
    private var isIntentionalDisconnect = false
    
    // Callback cho UI
    var onNotificationReceived: ((Notification) -> Unit)? = null
    var onConnected: (() -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null
    
    fun connect() {
        isIntentionalDisconnect = false
        
        val request = Request.Builder()
            .url("wss://$baseUrl/notifications")
            .addHeader("Authorization", "Bearer $authToken")
            .build()
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("WebSocket", "✅ Connected")
                onConnected?.invoke()
                
                // Authenticate
                val authMessage = mapOf(
                    "type" to "auth",
                    "token" to authToken
                )
                webSocket.send(gson.toJson(authMessage))
                
                // Subscribe to notification types
                val subscribeMessage = mapOf(
                    "event" to "subscribe",
                    "data" to mapOf(
                        "types" to listOf(
                            "TASK_ASSIGNED",
                            "MEETING_REMINDER",
                            "TASK_UPDATED",
                            "EVENT_INVITE"
                        )
                    )
                )
                webSocket.send(gson.toJson(subscribeMessage))
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("WebSocket", "📨 Message: $text")
                
                try {
                    val message = gson.fromJson(text, WebSocketMessage::class.java)
                    
                    when (message.event) {
                        "notification" -> {
                            val notification = gson.fromJson(
                                gson.toJson(message.data),
                                Notification::class.java
                            )
                            
                            // Notify UI
                            onNotificationReceived?.invoke(notification)
                            
                            // Show in-app notification if app is open
                            showInAppNotification(notification)
                            
                            // Mark as delivered
                            markAsDelivered(notification.id)
                        }
                        "connected" -> {
                            Log.d("WebSocket", "✅ Welcome: ${message.data}")
                        }
                        "subscribed" -> {
                            Log.d("WebSocket", "📬 Subscribed to: ${message.data}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("WebSocket", "❌ Parse error: ${e.message}")
                }
            }
            
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocket", "⚠️ Closing: $code - $reason")
            }
            
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocket", "❌ Closed: $code - $reason")
                onDisconnected?.invoke()
                
                // Auto-reconnect if not intentional disconnect
                if (!isIntentionalDisconnect) {
                    scheduleReconnect()
                }
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("WebSocket", "❌ Failure: ${t.message}")
                onDisconnected?.invoke()
                
                // Auto-reconnect with exponential backoff
                if (!isIntentionalDisconnect) {
                    scheduleReconnect()
                }
            }
        })
    }
    
    fun disconnect() {
        isIntentionalDisconnect = true
        reconnectJob?.cancel()
        webSocket?.close(1000, "App going to background")
        webSocket = null
    }
    
    fun markAsRead(notificationId: String) {
        val message = mapOf(
            "event" to "mark_read",
            "data" to mapOf("notificationId" to notificationId)
        )
        webSocket?.send(gson.toJson(message))
    }
    
    private fun markAsDelivered(notificationId: String) {
        // TODO: Call API to mark notification as delivered
    }
    
    private fun showInAppNotification(notification: Notification) {
        // TODO: Show in-app banner/snackbar
    }
    
    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = CoroutineScope(Dispatchers.IO).launch {
            delay(5000) // Wait 5 seconds
            Log.d("WebSocket", "🔄 Reconnecting...")
            connect()
        }
    }
}

// Data classes
data class WebSocketMessage(
    val event: String,
    val data: Any?
)

data class Notification(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val data: Map<String, Any>,
    val createdAt: String
)
```

---

### 3. App Lifecycle Management

```kotlin
// Application class
class PlanTrackerApp : Application(), DefaultLifecycleObserver {
    
    lateinit var wsManager: NotificationWebSocketManager
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize WebSocket manager
        wsManager = NotificationWebSocketManager(
            baseUrl = "your-backend.com",
            authToken = getAuthToken() // From shared preferences
        )
        
        // Observe app lifecycle
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }
    
    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        Log.d("Lifecycle", "🟢 App FOREGROUND")
        
        // Connect WebSocket
        wsManager.connect()
        
        // Optionally: Disable FCM notifications (avoid duplicates)
        disableFCMLocalNotifications()
    }
    
    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        Log.d("Lifecycle", "🔴 App BACKGROUND")
        
        // Disconnect WebSocket to save battery
        wsManager.disconnect()
        
        // Re-enable FCM notifications
        enableFCMLocalNotifications()
    }
    
    private fun disableFCMLocalNotifications() {
        // Set flag in SharedPreferences
        getSharedPreferences("app_prefs", MODE_PRIVATE)
            .edit()
            .putBoolean("show_fcm_notifications", false)
            .apply()
    }
    
    private fun enableFCMLocalNotifications() {
        getSharedPreferences("app_prefs", MODE_PRIVATE)
            .edit()
            .putBoolean("show_fcm_notifications", true)
            .apply()
    }
}
```

---

### 4. FCM Service (Modified)

```kotlin
// MyFirebaseMessagingService.kt
class MyFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d("FCM", "📩 Message received: ${remoteMessage.data}")
        
        // Check if app is in foreground
        val showNotification = getSharedPreferences("app_prefs", MODE_PRIVATE)
            .getBoolean("show_fcm_notifications", true)
        
        if (!showNotification) {
            Log.d("FCM", "⚠️ App is foreground, skipping FCM notification")
            return // WebSocket will handle it
        }
        
        // App is in background, show notification
        val notification = parseNotification(remoteMessage.data)
        showSystemNotification(notification)
    }
    
    private fun showSystemNotification(notification: NotificationData) {
        val notificationManager = getSystemService(NotificationManager::class.java)
        
        // Create notification channel (Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "plantracker_notifications",
                "PlanTracker Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Task and event notifications"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
        
        // Build notification
        val builder = NotificationCompat.Builder(this, "plantracker_notifications")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(notification.title)
            .setContentText(notification.body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(createPendingIntent(notification))
        
        // Show
        notificationManager.notify(notification.id.hashCode(), builder.build())
    }
    
    private fun createPendingIntent(notification: NotificationData): PendingIntent {
        // Deep link to task/event
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_id", notification.id)
            putExtra("deep_link", notification.deepLink)
        }
        
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
```

---

### 5. UI Integration Example

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    
    private lateinit var wsManager: NotificationWebSocketManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Get WebSocket manager from Application
        wsManager = (application as PlanTrackerApp).wsManager
        
        // Set up callbacks
        wsManager.onNotificationReceived = { notification ->
            runOnUiThread {
                showInAppBanner(notification)
                updateNotificationBadge()
            }
        }
        
        wsManager.onConnected = {
            runOnUiThread {
                Log.d("UI", "✅ WebSocket connected")
                // Show connected indicator
            }
        }
        
        wsManager.onDisconnected = {
            runOnUiThread {
                Log.d("UI", "❌ WebSocket disconnected")
                // Show offline indicator
            }
        }
    }
    
    private fun showInAppBanner(notification: Notification) {
        // Show Material3 Snackbar with action
        Snackbar.make(
            findViewById(android.R.id.content),
            notification.body,
            Snackbar.LENGTH_LONG
        ).setAction("View") {
            // Navigate to task/event
            navigateToDeepLink(notification.data["deeplink"] as? String)
            
            // Mark as read
            wsManager.markAsRead(notification.id)
        }.show()
    }
}
```

---

## 🔄 Message Flow Examples

### 1. User assigns task to you

**Backend** (tasks.service.ts):
```typescript
async assignTask(taskId: string, assigneeId: string) {
  // Update database
  await this.prisma.task.update({
    where: { id: taskId },
    data: { assignee_id: assigneeId }
  });
  
  // Check if user is online
  if (this.notificationsGateway.isUserOnline(assigneeId)) {
    // Send via WebSocket (real-time)
    this.notificationsGateway.emitToUser(assigneeId, 'notification', {
      id: uuid(),
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      body: `You were assigned to "${task.title}"`,
      data: { task_id: taskId },
      createdAt: new Date().toISOString()
    });
  } else {
    // Send via FCM (push)
    await this.fcmService.sendToUser(assigneeId, {
      title: 'New task assigned',
      body: `You were assigned to "${task.title}"`,
      data: { task_id: taskId }
    });
  }
}
```

**Android** receives via WebSocket:
```
📨 {"event":"notification","data":{"type":"TASK_ASSIGNED",...}}
→ Show in-app banner
→ Update notification badge
→ No system notification (app is open)
```

---

### 2. Meeting reminder (15 minutes before)

**Backend** (cron job):
```typescript
@Cron('* * * * *') // Every minute
async checkMeetingReminders() {
  const upcoming = await this.prisma.event.findMany({
    where: {
      start_at: {
        gte: new Date(Date.now() + 14 * 60 * 1000),
        lte: new Date(Date.now() + 15 * 60 * 1000)
      }
    },
    include: { participants: true }
  });
  
  for (const event of upcoming) {
    for (const participant of event.participants) {
      // Always send both (FCM for reliability)
      await this.fcmService.sendToUser(participant.user_id, {
        title: 'Meeting in 15 minutes',
        body: event.title,
        data: {
          event_id: event.id,
          meet_link: event.meet_link
        }
      });
      
      // Also via WebSocket if online
      if (this.notificationsGateway.isUserOnline(participant.user_id)) {
        this.notificationsGateway.emitToUser(participant.user_id, 'notification', {
          type: 'MEETING_REMINDER',
          priority: 'HIGH',
          ...
        });
      }
    }
  }
}
```

**Android**:
- If foreground: WebSocket → In-app banner with "Join" button
- If background: FCM → System notification with action buttons

---

## 🛡️ Security Best Practices

### 1. JWT Authentication for WebSocket

```kotlin
// Send JWT in connection handshake
val request = Request.Builder()
    .url("wss://backend.com/notifications")
    .addHeader("Authorization", "Bearer $jwtToken")
    .build()
```

Backend validates:
```typescript
const token = client.handshake.auth.token;
const payload = await this.jwtService.verifyAsync(token);
const userId = payload.sub;
```

### 2. SSL/TLS (WSS Protocol)

- Always use `wss://` (WebSocket Secure)
- Never `ws://` in production

### 3. Message Validation

```kotlin
// Validate message structure before processing
try {
    val message = gson.fromJson(text, WebSocketMessage::class.java)
    if (message.event.isBlank() || message.data == null) {
        throw IllegalArgumentException("Invalid message")
    }
    // Process...
} catch (e: Exception) {
    Log.e("WebSocket", "Invalid message: $text")
}
```

---

## 📊 Performance Considerations

### 1. Battery Optimization

**Problem**: WebSocket keeps connection alive → drains battery

**Solutions**:
- ✅ Disconnect when app goes to background
- ✅ Use FCM for background notifications
- ✅ Implement heartbeat/ping-pong (every 30s instead of constant)
- ✅ Batch multiple notifications into one WebSocket message

### 2. Network Efficiency

```kotlin
// Implement exponential backoff for reconnection
private var reconnectAttempts = 0

private fun scheduleReconnect() {
    val delayMs = min(
        1000L * (2.0.pow(reconnectAttempts)).toLong(),
        60_000L // Max 60 seconds
    )
    
    reconnectJob = CoroutineScope(Dispatchers.IO).launch {
        delay(delayMs)
        reconnectAttempts++
        connect()
    }
}

// Reset on successful connection
override fun onOpen(webSocket: WebSocket, response: Response) {
    reconnectAttempts = 0
    // ...
}
```

### 3. Message Deduplication

```kotlin
// Track shown notifications to avoid duplicates
private val shownNotifications = mutableSetOf<String>()

fun handleNotification(notification: Notification) {
    if (shownNotifications.contains(notification.id)) {
        Log.d("Notification", "⚠️ Already shown: ${notification.id}")
        return
    }
    
    shownNotifications.add(notification.id)
    showInAppNotification(notification)
    
    // Clean up old IDs (keep last 100)
    if (shownNotifications.size > 100) {
        shownNotifications.clear()
    }
}
```

---

## 🧪 Testing

### 1. Test WebSocket Connection

```kotlin
// In your test activity
val wsManager = NotificationWebSocketManager(
    baseUrl = "localhost:3000",
    authToken = "your-test-jwt"
)

wsManager.onConnected = {
    Log.d("Test", "✅ Connected successfully")
}

wsManager.onNotificationReceived = { notification ->
    Log.d("Test", "📨 Received: ${notification.title}")
}

wsManager.connect()
```

### 2. Backend Test Endpoint

```typescript
// notifications.controller.ts
@Post('test/send')
async testSendNotification(@Body() dto: { userId: string }) {
  this.notificationsGateway.emitToUser(dto.userId, 'notification', {
    id: uuid(),
    type: 'SYSTEM',
    title: 'Test Notification',
    body: 'WebSocket is working!',
    data: {},
    createdAt: new Date().toISOString()
  });
  
  return { success: true };
}
```

---

## 📚 Alternative Libraries

### 1. **Socket.IO Client** (If backend uses Socket.IO)

```kotlin
dependencies {
    implementation("io.socket:socket.io-client:2.1.0")
}

val socket = IO.socket("https://backend.com")

socket.on("notification") { args ->
    val data = args[0] as JSONObject
    val notification = parseNotification(data)
    handleNotification(notification)
}

socket.connect()
```

### 2. **Scarlet** (Reactive WebSocket)

```kotlin
dependencies {
    implementation("com.tinder.scarlet:scarlet:0.1.12")
    implementation("com.tinder.scarlet:websocket-okhttp:0.1.12")
}

interface NotificationService {
    @Receive
    fun observeNotifications(): Flow<Notification>
    
    @Send
    fun sendMessage(message: String)
}
```

### 3. **Ktor Client WebSocket**

```kotlin
dependencies {
    implementation("io.ktor:ktor-client-websockets:2.3.7")
}

val client = HttpClient {
    install(WebSockets)
}

client.webSocket("wss://backend.com/notifications") {
    for (frame in incoming) {
        when (frame) {
            is Frame.Text -> {
                val text = frame.readText()
                handleMessage(text)
            }
        }
    }
}
```

---

## ✅ Summary

### Android CÓ THỂ dùng WebSocket:
- ✅ OkHttp WebSocket (Recommended - stable, mature)
- ✅ Socket.IO Client (Nếu backend dùng Socket.IO)
- ✅ Scarlet (Reactive approach)
- ✅ Ktor Client (Kotlin-first)

### Kiến trúc đề xuất:
```
App FOREGROUND  → WebSocket (real-time, < 100ms)
App BACKGROUND  → FCM Push (system notifications)
```

### Benefits:
- ⚡ Real-time updates khi app đang mở
- 🔋 Tiết kiệm pin khi app background (dùng FCM)
- 🔔 Không miss notifications (fallback to FCM)
- 📱 Best UX (no duplicate notifications)

Bạn muốn tôi implement đầy đủ backend WebSocket Gateway không? 🚀
