# 📱 FCM ANDROID CLIENT - COMPLETE SETUP GUIDE

## 🎯 MỤC TIÊU
Hướng dẫn chi tiết setup Firebase Cloud Messaging trên Android app để nhận push notifications.

---

## 📋 PHẦN 1: FIREBASE CONSOLE SETUP

### Step 1.1: Add Android App to Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn (hoặc tạo mới)
3. Click **"Add app"** → Chọn **Android**
4. Điền thông tin:
   ```
   Android package name: com.yourcompany.plantracker
   App nickname: PlanTracker Android
   Debug signing certificate SHA-1: (optional, nhưng nên thêm)
   ```

### Step 1.2: Download google-services.json

1. Sau khi add app, download file `google-services.json`
2. Copy file này vào thư mục `app/` của Android project:
   ```
   YourAndroidProject/
   ├── app/
   │   ├── google-services.json  ← Paste vào đây
   │   ├── build.gradle
   │   └── src/
   ```

### Step 1.3: Enable Cloud Messaging API

1. Trong Firebase Console, vào **Project Settings**
2. Tab **Cloud Messaging**
3. Đảm bảo **Cloud Messaging API** đã được enable
4. Lưu lại **Server Key** (dùng cho backend - nhưng hiện tại bạn dùng Service Account nên không cần)

---

## 📋 PHẦN 2: ANDROID PROJECT CONFIGURATION

### Step 2.1: Project-level build.gradle

```groovy
// File: build.gradle (Project level)

buildscript {
    dependencies {
        // Google Services plugin (để đọc google-services.json)
        classpath 'com.google.gms:google-services:4.4.0'
    }
}

plugins {
    // ...existing plugins
}
```

### Step 2.2: App-level build.gradle

```groovy
// File: app/build.gradle

plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'com.google.gms.google-services' // ← Thêm plugin này
}

android {
    // ... existing config
    
    defaultConfig {
        applicationId "com.yourcompany.plantracker"
        minSdk 24
        targetSdk 34
        // ...
    }
}

dependencies {
    // Firebase BoM (Bill of Materials) - quản lý versions
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    
    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging-ktx'
    
    // Firebase Analytics (optional nhưng recommended)
    implementation 'com.google.firebase:firebase-analytics-ktx'
    
    // Coroutines (để handle async)
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    
    // Retrofit (để gọi API backend)
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    
    // Existing dependencies...
}
```

**Sync Gradle** sau khi thêm!

---

## 📋 PHẦN 3: ANDROID MANIFEST PERMISSIONS

### Step 3.1: AndroidManifest.xml

```xml
<!-- File: app/src/main/AndroidManifest.xml -->

<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.yourcompany.plantracker">

    <!-- ✅ PERMISSIONS CẦN THIẾT -->
    
    <!-- Internet permission (bắt buộc) -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- POST_NOTIFICATIONS (Android 13+, bắt buộc) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- Wake lock (để notification hiển thị khi màn hình tắt) -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <!-- Vibrate (optional, cho vibration) -->
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:name=".PlanTrackerApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.PlanTracker">

        <!-- Main Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- ✅ FIREBASE MESSAGING SERVICE -->
        <service
            android:name=".fcm.PlanTrackerFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- ✅ DEFAULT NOTIFICATION CHANNEL (optional) -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/notification_color" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="@string/default_notification_channel_id" />

    </application>

</manifest>
```

---

## 📋 PHẦN 4: NOTIFICATION CHANNELS (Android 8.0+)

### Step 4.1: Create Notification Channels

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/fcm/NotificationChannels.kt

package com.yourcompany.plantracker.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

object NotificationChannels {
    
    // Channel IDs (phải MATCH với backend)
    const val TASK_UPDATES = "task_updates"
    const val TASK_COMMENTS = "task_comments"
    const val MENTIONS = "mentions"
    const val MEETING_REMINDERS = "meeting_reminders"
    const val EVENT_INVITES = "event_invites"
    const val SYSTEM = "system"
    
    /**
     * Tạo tất cả notification channels
     * Gọi trong Application.onCreate()
     */
    fun createAllChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) 
                as NotificationManager
            
            // 1. Task Updates (High Importance)
            val taskUpdatesChannel = NotificationChannel(
                TASK_UPDATES,
                "Task Updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for task assignments and status changes"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            
            // 2. Task Comments (Default Importance)
            val taskCommentsChannel = NotificationChannel(
                TASK_COMMENTS,
                "Task Comments",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for new comments on tasks"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            
            // 3. Mentions (High Importance + Custom Sound)
            val mentionsChannel = NotificationChannel(
                MENTIONS,
                "Mentions",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications when you are mentioned"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
                
                // Custom sound
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build()
                setSound(soundUri, audioAttributes)
            }
            
            // 4. Meeting Reminders (High Importance)
            val meetingRemindersChannel = NotificationChannel(
                MEETING_REMINDERS,
                "Meeting Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminders for upcoming meetings"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            
            // 5. Event Invites (High Importance)
            val eventInvitesChannel = NotificationChannel(
                EVENT_INVITES,
                "Event Invites",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Invitations to events and meetings"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            
            // 6. System (Low Importance)
            val systemChannel = NotificationChannel(
                SYSTEM,
                "System Notifications",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "System messages and daily summaries"
                enableLights(false)
                enableVibration(false)
                setShowBadge(false)
            }
            
            // Register all channels
            notificationManager.createNotificationChannels(listOf(
                taskUpdatesChannel,
                taskCommentsChannel,
                mentionsChannel,
                meetingRemindersChannel,
                eventInvitesChannel,
                systemChannel
            ))
        }
    }
}
```

### Step 4.2: Initialize Channels in Application

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/PlanTrackerApplication.kt

package com.yourcompany.plantracker

import android.app.Application
import com.yourcompany.plantracker.fcm.NotificationChannels

class PlanTrackerApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // ✅ Tạo notification channels
        NotificationChannels.createAllChannels(this)
        
        // Initialize other SDKs...
    }
}
```

---

## 📋 PHẦN 5: FIREBASE MESSAGING SERVICE

### Step 5.1: Implement FirebaseMessagingService

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/fcm/PlanTrackerFirebaseMessagingService.kt

package com.yourcompany.plantracker.fcm

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.yourcompany.plantracker.MainActivity
import com.yourcompany.plantracker.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PlanTrackerFirebaseMessagingService : FirebaseMessagingService() {
    
    companion object {
        private const val TAG = "FCMService"
    }
    
    /**
     * Called when a new FCM token is generated
     * GỬI TOKEN NÀY LÊN BACKEND!
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: $token")
        
        // ✅ GỬI TOKEN LÊN BACKEND
        sendTokenToServer(token)
    }
    
    /**
     * Called when a message is received
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        
        Log.d(TAG, "Message received from: ${message.from}")
        
        // Notification payload
        message.notification?.let { notification ->
            Log.d(TAG, "Notification Title: ${notification.title}")
            Log.d(TAG, "Notification Body: ${notification.body}")
        }
        
        // Data payload
        message.data.let { data ->
            Log.d(TAG, "Data payload: $data")
            
            // ✅ HANDLE NOTIFICATION DỰA TRÊN TYPE
            handleNotification(data, message.notification)
        }
    }
    
    /**
     * Gửi FCM token lên backend
     */
    private fun sendTokenToServer(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Lấy userId từ SharedPreferences/DataStore
                val userId = getUserId() ?: return@launch
                
                // Gọi API backend
                val api = RetrofitClient.apiService
                val response = api.registerDevice(
                    userId = userId,
                    fcmToken = token,
                    platform = "ANDROID",
                    deviceName = android.os.Build.MODEL,
                    osVersion = android.os.Build.VERSION.RELEASE
                )
                
                if (response.isSuccessful) {
                    Log.d(TAG, "FCM token sent to server successfully")
                } else {
                    Log.e(TAG, "Failed to send FCM token: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending FCM token to server", e)
            }
        }
    }
    
    /**
     * Handle notification based on type
     */
    private fun handleNotification(
        data: Map<String, String>,
        notification: RemoteMessage.Notification?
    ) {
        val type = data["type"] ?: "unknown"
        val title = notification?.title ?: "PlanTracker"
        val body = notification?.body ?: ""
        
        // Xác định channel dựa trên type
        val channelId = when (type) {
            "task_assigned", "task_moved" -> NotificationChannels.TASK_UPDATES
            "task_commented" -> NotificationChannels.TASK_COMMENTS
            "task_mention" -> NotificationChannels.MENTIONS
            "meeting_reminder" -> NotificationChannels.MEETING_REMINDERS
            "event_invite" -> NotificationChannels.EVENT_INVITES
            else -> NotificationChannels.SYSTEM
        }
        
        // Xác định click action
        val intent = createIntentForType(type, data)
        
        // Show notification
        showNotification(
            title = title,
            body = body,
            channelId = channelId,
            intent = intent,
            notificationId = generateNotificationId(type, data)
        )
    }
    
    /**
     * Tạo intent dựa trên notification type
     */
    private fun createIntentForType(
        type: String,
        data: Map<String, String>
    ): Intent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        
        when (data["clickAction"]) {
            "OPEN_TASK_DETAIL" -> {
                intent.putExtra("screen", "task_detail")
                intent.putExtra("taskId", data["taskId"])
            }
            "OPEN_TASK_COMMENTS" -> {
                intent.putExtra("screen", "task_comments")
                intent.putExtra("taskId", data["taskId"])
                intent.putExtra("commentId", data["commentId"])
            }
            "OPEN_EVENT_DETAIL" -> {
                intent.putExtra("screen", "event_detail")
                intent.putExtra("eventId", data["eventId"])
            }
        }
        
        return intent
    }
    
    /**
     * Generate unique notification ID
     */
    private fun generateNotificationId(type: String, data: Map<String, String>): Int {
        // Use taskId/eventId để tạo unique ID
        val id = data["taskId"] ?: data["eventId"] ?: System.currentTimeMillis().toString()
        return id.hashCode()
    }
    
    /**
     * Show notification
     */
    private fun showNotification(
        title: String,
        body: String,
        channelId: String,
        intent: Intent,
        notificationId: Int
    ) {
        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) 
            as NotificationManager
        
        notificationManager.notify(notificationId, notificationBuilder.build())
    }
    
    /**
     * Get userId from local storage
     */
    private fun getUserId(): String? {
        val sharedPrefs = getSharedPreferences("plantracker_prefs", Context.MODE_PRIVATE)
        return sharedPrefs.getString("user_id", null)
    }
}
```

---

## 📋 PHẦN 6: REQUEST NOTIFICATION PERMISSION (Android 13+)

### Step 6.1: Request Permission in Activity

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/MainActivity.kt

package com.yourcompany.plantracker

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {
    
    companion object {
        private const val TAG = "MainActivity"
    }
    
    // ✅ Permission launcher
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d(TAG, "Notification permission granted")
            retrieveAndSendFCMToken()
        } else {
            Log.w(TAG, "Notification permission denied")
            // Show explanation to user
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // ✅ Request notification permission (Android 13+)
        requestNotificationPermission()
    }
    
    /**
     * Request POST_NOTIFICATIONS permission for Android 13+
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    // Permission already granted
                    Log.d(TAG, "Notification permission already granted")
                    retrieveAndSendFCMToken()
                }
                
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    // Show explanation dialog
                    showPermissionRationale()
                }
                
                else -> {
                    // Request permission
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            // Android < 13, no runtime permission needed
            retrieveAndSendFCMToken()
        }
    }
    
    /**
     * Show explanation why we need notification permission
     */
    private fun showPermissionRationale() {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Cần quyền thông báo")
            .setMessage("Ứng dụng cần quyền thông báo để gửi updates về tasks, comments, và meetings của bạn.")
            .setPositiveButton("Cho phép") { _, _ ->
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            .setNegativeButton("Không") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
    
    /**
     * Retrieve FCM token và gửi lên backend
     */
    private fun retrieveAndSendFCMToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w(TAG, "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }
            
            // Get FCM token
            val token = task.result
            Log.d(TAG, "FCM Token: $token")
            
            // ✅ GỬI TOKEN LÊN BACKEND
            sendTokenToBackend(token)
        }
    }
    
    /**
     * Gửi FCM token lên backend
     */
    private fun sendTokenToBackend(token: String) {
        // Implement API call
        // (Code ở phần Retrofit API client bên dưới)
    }
}
```

---

## 📋 PHẦN 7: RETROFIT API CLIENT (Gọi Backend)

### Step 7.1: API Service Interface

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/api/ApiService.kt

package com.yourcompany.plantracker.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    
    /**
     * Register device with FCM token
     */
    @POST("api/notifications/register-device")
    suspend fun registerDevice(
        @Body request: RegisterDeviceRequest
    ): Response<RegisterDeviceResponse>
    
    /**
     * Update FCM token
     */
    @POST("api/notifications/update-token")
    suspend fun updateFCMToken(
        @Body request: UpdateTokenRequest
    ): Response<Unit>
    
    /**
     * Unregister device (when user logs out)
     */
    @DELETE("api/notifications/devices/{deviceId}")
    suspend fun unregisterDevice(
        @Path("deviceId") deviceId: String
    ): Response<Unit>
}

// Request/Response models
data class RegisterDeviceRequest(
    val userId: String,
    val fcmToken: String,
    val platform: String, // "ANDROID" or "IOS"
    val deviceName: String,
    val osVersion: String
)

data class RegisterDeviceResponse(
    val deviceId: String,
    val userId: String,
    val fcmToken: String,
    val isActive: Boolean
)

data class UpdateTokenRequest(
    val deviceId: String,
    val fcmToken: String
)
```

### Step 7.2: Retrofit Client

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/api/RetrofitClient.kt

package com.yourcompany.plantracker.api

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    
    private const val BASE_URL = "https://your-api.onrender.com/"
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor { chain ->
            // Add auth token to all requests
            val token = getAuthToken()
            val request = chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
            chain.proceed(request)
        }
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val apiService: ApiService = retrofit.create(ApiService::class.java)
    
    private fun getAuthToken(): String? {
        // Get Firebase ID token from local storage
        return null // Implement this
    }
}
```

---

## 📋 PHẦN 8: TESTING

### Step 8.1: Test FCM Token Generation

```kotlin
// Trong MainActivity.onCreate()

FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (task.isSuccessful) {
        val token = task.result
        Log.d("FCM_TOKEN", "Token: $token")
        // Copy token này để test trên backend
    }
}
```

### Step 8.2: Test Notification Channels

```kotlin
// Kiểm tra notification channels đã được tạo chưa

val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    val channels = notificationManager.notificationChannels
    channels.forEach { channel ->
        Log.d("CHANNELS", "Channel: ${channel.id} - ${channel.name}")
    }
}
```

---

## 🎯 SUMMARY: PERMISSIONS CẦN THIẾT

| Permission | Required? | Mục đích |
|-----------|-----------|----------|
| `INTERNET` | ✅ Bắt buộc | Nhận FCM messages |
| `POST_NOTIFICATIONS` | ✅ Bắt buộc (Android 13+) | Hiển thị notifications |
| `WAKE_LOCK` | ✅ Recommended | Notification hiển thị khi màn hình tắt |
| `VIBRATE` | ⚠️ Optional | Rung khi có notification |
| `ACCESS_NOTIFICATION_POLICY` | ❌ Không cần | Chỉ dùng cho Do Not Disturb |

---

## 📚 NEXT STEPS

1. ✅ Setup Firebase project và download `google-services.json`
2. ✅ Add dependencies vào `build.gradle`
3. ✅ Add permissions vào `AndroidManifest.xml`
4. ✅ Tạo notification channels
5. ✅ Implement `FirebaseMessagingService`
6. ✅ Request notification permission (Android 13+)
7. ✅ Get FCM token và gửi lên backend
8. ✅ Test nhận notifications

---

**Phần tiếp theo:** Backend Endpoints để nhận FCM tokens
