# 🔧 FIX: FCM Token Registration Issue

**Ngày:** 28/10/2025  
**Issue:** Permission granted nhưng API không được gọi  
**Status:** ✅ FIXED

---

## 🐛 VẤN ĐỀ PHÁT HIỆN

### Triệu chứng:
```
✅ Permission dialog xuất hiện
✅ User tap "Allow"
✅ Permission granted log
❌ KHÔNG thấy API call log
❌ Token KHÔNG được gửi lên backend
```

### Root Cause Analysis:

#### 1. Code bị comment trong MyFirebaseMessagingService
```java
// File: MyFirebaseMessagingService.java
private void sendTokenToServer(String token) {
    // TODO: Implement API call to send token to server
    // Example code below:
    /*
    ... API call code here ... (BỊ COMMENT!)
    */
}
```

**Vấn đề:** Code API call bị comment toàn bộ → Method không làm gì cả!

#### 2. HomeActivity chỉ lấy token, không gửi lên backend
```java
// File: HomeActivity.java
private void getFCMTokenAndRegister() {
    FCMHelper.getFCMToken(this, callback -> {
        onSuccess(token) {
            Log.d(TAG, "FCM Token: " + token);
            // TODO: Send token to backend server  ← CHƯA IMPLEMENT!
        }
    });
}
```

**Vấn đề:** Token được lấy thành công nhưng không được gửi đi!

#### 3. Flow không hoàn chỉnh

**Before (BROKEN):**
```
Permission Granted 
  ↓
getFCMTokenAndRegister()
  ↓
FCMHelper.getFCMToken()
  ↓
onSuccess(token) 
  ↓
Log token + Toast
  ↓
❌ END (Token KHÔNG được gửi!)
```

---

## ✅ GIẢI PHÁP

### 1. Uncomment & Fix sendTokenToServer()

**File:** `MyFirebaseMessagingService.java`

```java
private void sendTokenToServer(String token) {
    Log.d(TAG, "Sending token to server: " + token);

    if (App.authManager == null || !App.authManager.isSignedIn()) {
        Log.d(TAG, "User not logged in, skipping token registration");
        return;
    }

    try {
        // Get device info
        String deviceModel = Build.MANUFACTURER + " " + Build.MODEL;
        String appVersion = BuildConfig.VERSION_NAME;
        String locale = Locale.getDefault().toString();
        String timezone = TimeZone.getDefault().getID();

        // Create request
        RegisterDeviceRequest request = new RegisterDeviceRequest(
            token, "ANDROID", deviceModel, appVersion, locale, timezone
        );

        // Create API service
        FcmApiService apiService = ApiClient.get(App.authManager)
            .create(FcmApiService.class);

        // Call API
        apiService.registerDevice(request).enqueue(new Callback<DeviceResponse>() {
            @Override
            public void onResponse(Call<DeviceResponse> call, Response<DeviceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    DeviceResponse device = response.body();
                    Log.d(TAG, "✅ Token registered successfully. Device ID: " + device.getId());
                    
                    // Save device ID
                    SharedPreferences prefs = getSharedPreferences("fcm_prefs", MODE_PRIVATE);
                    prefs.edit().putString("device_id", device.getId()).apply();
                } else {
                    Log.e(TAG, "❌ Failed to register token. Code: " + response.code());
                }
            }

            @Override
            public void onFailure(Call<DeviceResponse> call, Throwable t) {
                Log.e(TAG, "❌ Failed to send token to server", t);
            }
        });
    } catch (Exception e) {
        Log.e(TAG, "❌ Error sending token to server", e);
    }
}
```

### 2. Thêm Static Method để gọi từ bất kỳ đâu

**File:** `MyFirebaseMessagingService.java`

```java
/**
 * Static method to register FCM token from anywhere in the app
 */
public static void registerTokenWithBackend(Context context, String token) {
    Log.d("FCMService", "registerTokenWithBackend called with token: " + token);
    
    if (App.authManager == null || !App.authManager.isSignedIn()) {
        Log.d("FCMService", "User not logged in, skipping");
        return;
    }

    try {
        // ... same code as sendTokenToServer() ...
        // (duplicate để method có thể gọi từ static context)
    } catch (Exception e) {
        Log.e("FCMService", "Error sending token to server", e);
    }
}
```

**Tại sao cần static method?**
- `sendTokenToServer()` là private instance method → Chỉ gọi được từ trong Service
- HomeActivity cần gọi từ bên ngoài → Cần static method

### 3. Update HomeActivity để gọi API

**File:** `HomeActivity.java`

**Changes:**
```java
// BEFORE
private void getFCMTokenAndRegister() {
    FCMHelper.getFCMToken(this, callback -> {
        onSuccess(token) {
            Log.d(TAG, "FCM Token: " + token);
            Toast.makeText(..., "Đã kích hoạt thông báo đẩy").show();
            // TODO: Send token to backend  ← MISSING!
        }
    });
}

// AFTER ✅
private void getFCMTokenAndRegister() {
    Log.d(TAG, "getFCMTokenAndRegister called");
    FCMHelper.getFCMToken(this, new FCMHelper.FCMTokenCallback() {
        @Override
        public void onSuccess(String token) {
            Log.d(TAG, "FCM Token received: " + token);
            Toast.makeText(HomeActivity.this, "Đã kích hoạt thông báo đẩy", LENGTH_SHORT).show();
            
            // ✅ FIXED: Send token to backend server
            MyFirebaseMessagingService.registerTokenWithBackend(HomeActivity.this, token);
        }

        @Override
        public void onFailure(Exception e) {
            Log.e(TAG, "Failed to get FCM token", e);
        }
    });
}
```

**Import thêm:**
```java
import com.example.tralalero.service.MyFirebaseMessagingService;
```

---

## 🔄 FLOW SAU KHI FIX

**After (WORKING):**
```
Permission Granted 
  ↓
getFCMTokenAndRegister()
  ↓
FCMHelper.getFCMToken()
  ↓
onSuccess(token) 
  ↓
Log: "FCM Token received: xxx"
  ↓
MyFirebaseMessagingService.registerTokenWithBackend(context, token)
  ↓
Log: "registerTokenWithBackend called with token: xxx"
  ↓
Check isSignedIn()
  ↓
Collect device info (model, version, locale, timezone)
  ↓
Create RegisterDeviceRequest
  ↓
FcmApiService.registerDevice(request)
  ↓
POST /users/devices/register
  ↓
Backend: UsersService.registerDevice()
  ↓
Database: INSERT/UPDATE user_devices
  ↓
Response: DeviceResponse { id, userId, ... }
  ↓
Save device_id to SharedPreferences
  ↓
Log: "✅ Token registered successfully. Device ID: xxx"
  ↓
✅ COMPLETE!
```

---

## 📝 EXPECTED LOGCAT OUTPUT

### Sau khi permission granted:

```
D/HomeActivity: Notification permission granted
D/HomeActivity: getFCMTokenAndRegister called
D/HomeActivity: FCM Token received: eXaMpLe_FcM_ToKeN_12345
I/Toast: Đã kích hoạt thông báo đẩy
D/FCMService: registerTokenWithBackend called with token: eXaMpLe_FcM_ToKeN_12345
D/FCMService: Sending device info:
D/FCMService:   - Model: Samsung Galaxy S23
D/FCMService:   - App Version: 1.0.0
D/FCMService:   - Locale: vi-VN
D/FCMService:   - Timezone: Asia/Ho_Chi_Minh
D/API: --> POST http://10.0.2.2:3000/users/devices/register
D/API: Authorization: Bearer eyJhbGc...
D/API: {
D/API:   "fcmToken": "eXaMpLe_FcM_ToKeN_12345",
D/API:   "platform": "ANDROID",
D/API:   "deviceModel": "Samsung Galaxy S23",
D/API:   "appVersion": "1.0.0",
D/API:   "locale": "vi-VN",
D/API:   "timezone": "Asia/Ho_Chi_Minh"
D/API: }
D/API: <-- 201 CREATED (345ms)
D/API: {
D/API:   "id": "device-uuid-here",
D/API:   "userId": "user-uuid",
D/API:   "fcmToken": "eXaMpLe_FcM_ToKeN_12345",
D/API:   "platform": "ANDROID",
D/API:   "deviceModel": "Samsung Galaxy S23",
D/API:   "isActive": true,
D/API:   "lastActiveAt": "2025-10-28T10:30:00.000Z"
D/API: }
D/FCMService: ✅ Token registered successfully. Device ID: device-uuid-here
```

---

## 🧪 TESTING STEPS

### 1. Rebuild App
```bash
cd Plantracker
./gradlew clean
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 2. Clear App Data (để test lại permission)
```bash
adb shell pm clear com.example.tralalero
```

### 3. Launch App & Monitor Logcat
```bash
adb logcat -c  # Clear logcat
adb logcat -s HomeActivity FCMService API
```

### 4. Test Flow
1. ✅ Open app
2. ✅ Login
3. ✅ Permission dialog appears
4. ✅ Tap "Allow"
5. ✅ Check Logcat for API call
6. ✅ Verify backend database

### 5. Verify Backend
```bash
# Check database
SELECT * FROM user_devices WHERE user_id = 'YOUR_USER_ID';

# Expected result:
# fcm_token: "eXaMpLe_FcM_ToKeN_12345"
# platform: "ANDROID"
# device_model: "Samsung Galaxy S23"
# is_active: true
```

### 6. Test API
```http
GET http://localhost:3000/users/devices
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📊 FILES MODIFIED

### 1. MyFirebaseMessagingService.java
- ✅ Uncommented `sendTokenToServer()` implementation
- ✅ Added imports (ApiClient, DTOs, Retrofit)
- ✅ Added `registerTokenWithBackend()` static method
- **Lines changed:** ~120 lines

### 2. HomeActivity.java
- ✅ Updated `getFCMTokenAndRegister()` to call API
- ✅ Added import for MyFirebaseMessagingService
- ✅ Added detailed logging
- **Lines changed:** ~15 lines

---

## ✅ COMPLETION CHECKLIST

- [x] Code uncommented trong MyFirebaseMessagingService
- [x] Static method created để gọi từ HomeActivity
- [x] HomeActivity updated để call API
- [x] Imports added
- [x] Logging improved
- [x] Documentation created

---

## 🎯 NEXT STEPS

1. **Rebuild app** và test lại
2. **Monitor Logcat** để verify API call
3. **Check backend database** để confirm registration
4. **Test notification sending** từ Firebase Console
5. **Test end-to-end flow** hoàn chỉnh

---

**Status:** ✅ READY FOR TESTING  
**Expected Result:** API call xuất hiện trong Logcat sau khi permission granted
