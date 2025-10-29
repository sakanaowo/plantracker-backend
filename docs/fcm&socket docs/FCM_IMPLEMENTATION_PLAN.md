# 📱 PLAN TRIỂN KHAI FCM PUSH NOTIFICATIONS - 1 BUỔI CHIỀU (3H)

## 🎯 MỤC TIÊU
Hoàn thiện tích hợp Push Notifications giữa Android Frontend và Backend để có thể nhận thông báo cơ bản nhất.

## 📊 PHÂN TÍCH HIỆN TRẠNG

### ✅ ĐÃ CÓ
- ✅ FCM Infrastructure (Firebase Messaging SDK)
- ✅ `MyFirebaseMessagingService` đã implement
- ✅ `FCMHelper` class quản lý token
- ✅ AndroidManifest config đầy đủ
- ✅ Backend có Firebase Admin SDK
- ✅ **Database đã có table `user_devices`** ← QUAN TRỌNG!
- ✅ **Prisma schema đã có model `user_devices`** ← ĐÃ SYNC!

### ❌ CHƯA CÓ
- ❌ Backend endpoints cho device registration
- ❌ Android API service để gọi backend
- ❌ Logic gửi FCM token sau login
- ❌ Request notification permission (Android 13+)

---

## ⏱️ TIMELINE (3 GIỜ - Rút ngắn 1h)

### **GIAI ĐOẠN 1: Backend Setup (23 phút)**

#### ✅ Bước 1.1: DTOs đã tạo (HOÀN THÀNH)
- ✅ `register-device.dto.ts`
- ✅ `update-token.dto.ts`
- ✅ `device-response.dto.ts`

#### ✅ Bước 1.2: Database Schema (HOÀN THÀNH - BỎ QUA)

**Table `user_devices` ĐÃ TỒN TẠI trong database:**

```prisma
model user_devices {
  id             String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id        String    @db.Uuid
  fcm_token      String    @unique
  platform       platform  @default(ANDROID)
  device_model   String?   // ← Khác với plan ban đầu (device_name)
  app_version    String?
  locale         String?
  timezone       String?
  is_active      Boolean   @default(true)
  last_active_at DateTime? @db.Timestamptz(6)
  users          users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

**⚠️ LƯU Ý:** Schema thực tế dùng `device_model` thay vì `device_name`, và không có `os_version`.

#### 📝 Bước 1.3: Update DTOs để match schema thực tế (5 phút)

**File:** `plantracker-backend/src/modules/notifications/dto/register-device.dto.ts`

Sửa `deviceName` → `deviceModel`, xóa `osVersion`:

```typescript
export class RegisterDeviceDto {
  @ApiProperty({ example: 'eXAMPLE_FCM_TOKEN_HERE' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  @IsNotEmpty()
  platform: DevicePlatform;

  @ApiProperty({ example: 'Samsung Galaxy S23', required: false })
  @IsString()
  @IsOptional()
  deviceModel?: string;  // ← Đổi từ deviceName

  @ApiProperty({ example: '1.0.0', required: false })
  @IsString()
  @IsOptional()
  appVersion?: string;
  
  // ← Xóa osVersion
}
```

#### 📝 Bước 1.4: Thêm FCM endpoints vào UsersController (18 phút)

**File:** `plantracker-backend/src/modules/users/users.controller.ts`

```typescript
import { RegisterDeviceDto, UpdateTokenDto, DeviceResponseDto } from '../notifications/dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  // ... existing code

  // ========== FCM ENDPOINTS ==========
  
  @Post('fcm/register-device')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Register FCM device token' })
  async registerDevice(
    @CurrentUser() userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    return this.users.registerDevice(userId, dto);
  }

  @Post('fcm/update-token')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Update FCM token for device' })
  async updateFcmToken(
    @CurrentUser() userId: string,
    @Body() dto: UpdateTokenDto,
  ): Promise<{ message: string }> {
    await this.users.updateFcmToken(userId, dto);
    return { message: 'FCM token updated successfully' };
  }

  @Delete('fcm/devices/:deviceId')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Unregister device (on logout)' })
  async unregisterDevice(
    @CurrentUser() userId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<{ message: string }> {
    await this.users.unregisterDevice(userId, deviceId);
    return { message: 'Device unregistered successfully' };
  }

  @Get('fcm/devices')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Get all devices for current user' })
  async getUserDevices(@CurrentUser() userId: string): Promise<DeviceResponseDto[]> {
    return this.users.getUserDevices(userId);
  }
}
```

#### 📝 Bước 1.5: Implement methods trong UsersService (18 phút)

**File:** `plantracker-backend/src/modules/users/users.service.ts`

```typescript
import { RegisterDeviceDto, UpdateTokenDto, DeviceResponseDto } from '../notifications/dto';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class UsersService {
  // ... existing code

  // ========== FCM DEVICE MANAGEMENT ==========

  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<DeviceResponseDto> {
    try {
      // Check if device already exists
      const existingDevice = await this.prisma.user_devices.findFirst({
        where: {
          user_id: userId,
          fcm_token: dto.fcmToken,
        },
      });

      let device;
      if (existingDevice) {
        // Update existing device
        device = await this.prisma.user_devices.update({
          where: { id: existingDevice.id },
          data: {
            is_active: true,
            device_model: dto.deviceModel ?? existingDevice.device_model,
            app_version: dto.appVersion ?? existingDevice.app_version,
            last_active_at: new Date(),
          },
        });
      } else {
        // Create new device
        device = await this.prisma.user_devices.create({
          data: {
            user_id: userId,
            fcm_token: dto.fcmToken,
            platform: dto.platform,
            device_model: dto.deviceModel,
            app_version: dto.appVersion,
            is_active: true,
            last_active_at: new Date(),
          },
        });
      }

      return this.mapDeviceToDto(device);
    } catch (error) {
      console.error(`Failed to register device for user ${userId}:`, error);
      throw error;
    }
  }

  async updateFcmToken(userId: string, dto: UpdateTokenDto): Promise<void> {
    const device = await this.prisma.user_devices.findFirst({
      where: {
        id: dto.deviceId,
        user_id: userId,
      },
    });

    if (!device) {
      throw new NotFoundException(`Device ${dto.deviceId} not found`);
    }

    await this.prisma.user_devices.update({
      where: { id: dto.deviceId },
      data: {
        fcm_token: dto.newFcmToken,
        last_active_at: new Date(),
      },
    });
  }

  async unregisterDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.user_devices.findFirst({
      where: {
        id: deviceId,
        user_id: userId,
      },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    // Mark as inactive instead of deleting
    await this.prisma.user_devices.update({
      where: { id: deviceId },
      data: {
        is_active: false,
        last_active_at: new Date(),
      },
    });
  }

  async getUserDevices(userId: string): Promise<DeviceResponseDto[]> {
    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: userId,
        is_active: true,
      },
      orderBy: {
        last_active_at: 'desc',
      },
    });

    return devices.map(this.mapDeviceToDto);
  }

  private mapDeviceToDto(device: any): DeviceResponseDto {
    return {
      id: device.id,
      userId: device.user_id,
      fcmToken: device.fcm_token,
      platform: device.platform,
      deviceModel: device.device_model,  // ← Đổi từ deviceName
      isActive: device.is_active,
      createdAt: device.created_at,
      lastActiveAt: device.last_active_at,
    };
  }
}
```

---

### **GIAI ĐOẠN 2: Android Frontend Setup (90 phút)**

#### 📝 Bước 2.1: Tạo DTO classes (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/dto/fcm/RegisterDeviceRequest.java`

```java
package com.example.tralalero.data.remote.dto.fcm;

import com.google.gson.annotations.SerializedName;

public class RegisterDeviceRequest {
    @SerializedName("fcmToken")
    private String fcmToken;

    @SerializedName("platform")
    private String platform;

    @SerializedName("deviceModel")  // ← Đổi từ deviceName
    private String deviceModel;

    @SerializedName("appVersion")
    private String appVersion;

    public RegisterDeviceRequest(String fcmToken, String platform, String deviceModel, 
                                 String appVersion) {  // ← Xóa osVersion
        this.fcmToken = fcmToken;
        this.platform = platform;
        this.deviceModel = deviceModel;
        this.appVersion = appVersion;
    }

    // Getters
    public String getFcmToken() { return fcmToken; }
    public String getPlatform() { return platform; }
    public String getDeviceModel() { return deviceModel; }  // ← Đổi
    public String getAppVersion() { return appVersion; }
}
```

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/dto/fcm/DeviceResponse.java`

```java
package com.example.tralalero.data.remote.dto.fcm;

import com.google.gson.annotations.SerializedName;

public class DeviceResponse {
    @SerializedName("id")
    private String id;

    @SerializedName("userId")
    private String userId;

    @SerializedName("fcmToken")
    private String fcmToken;

    @SerializedName("platform")
    private String platform;

    @SerializedName("deviceName")
    private String deviceName;

    @SerializedName("isActive")
    private boolean isActive;

    // Getters
    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getFcmToken() { return fcmToken; }
    public String getPlatform() { return platform; }
    public String getDeviceName() { return deviceName; }
    public boolean isActive() { return isActive; }
}
```

#### 📝 Bước 2.2: Tạo FCM API Service (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/api/FcmApiService.java`

```java
package com.example.tralalero.data.remote.api;

import com.example.tralalero.data.remote.dto.fcm.DeviceResponse;
import com.example.tralalero.data.remote.dto.fcm.RegisterDeviceRequest;
import com.example.tralalero.data.remote.dto.fcm.UpdateTokenRequest;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.*;

public interface FcmApiService {

    @POST("users/fcm/register-device")
    Call<DeviceResponse> registerDevice(@Body RegisterDeviceRequest request);

    @POST("users/fcm/update-token")
    Call<Void> updateFcmToken(@Body UpdateTokenRequest request);

    @DELETE("users/fcm/devices/{deviceId}")
    Call<Void> unregisterDevice(@Path("deviceId") String deviceId);

    @GET("users/fcm/devices")
    Call<List<DeviceResponse>> getUserDevices();
}
```

#### 📝 Bước 2.3: Thêm FcmApiService vào RetrofitClient (10 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/data/remote/RetrofitClient.java`

Thêm method mới:
```java
public FcmApiService getFcmApiService() {
    return retrofit.create(FcmApiService.class);
}
```

#### 📝 Bước 2.4: Implement sendTokenToServer trong MyFirebaseMessagingService (20 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/service/MyFirebaseMessagingService.java`

```java
import android.os.Build;
import com.example.tralalero.BuildConfig;
import com.example.tralalero.auth.storage.TokenManager;
import com.example.tralalero.data.remote.RetrofitClient;
import com.example.tralalero.data.remote.api.FcmApiService;
import com.example.tralalero.data.remote.dto.fcm.DeviceResponse;
import com.example.tralalero.data.remote.dto.fcm.RegisterDeviceRequest;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    // ... existing code

    private void sendTokenToServer(String token) {
        Log.d(TAG, "Sending token to server: " + token);

        // Check if user is logged in
        TokenManager tokenManager = new TokenManager(this);
        String authToken = tokenManager.getToken();
        
        if (authToken == null || authToken.isEmpty()) {
            Log.w(TAG, "No auth token found, skipping FCM registration");
            return;
        }

        // Get device info
        String deviceModel = Build.MANUFACTURER + " " + Build.MODEL;
        String appVersion = BuildConfig.VERSION_NAME;

        RegisterDeviceRequest request = new RegisterDeviceRequest(
            token,
            "ANDROID",
            deviceModel,  // ← Đổi từ deviceName
            appVersion
        );

        // Call API
        RetrofitClient retrofitClient = RetrofitClient.getInstance(this);
        FcmApiService fcmApi = retrofitClient.getFcmApiService();
        
        fcmApi.registerDevice(request).enqueue(new retrofit2.Callback<DeviceResponse>() {
            @Override
            public void onResponse(Call<DeviceResponse> call, retrofit2.Response<DeviceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Log.d(TAG, "✅ Token registered successfully. Device ID: " + response.body().getId());
                    // Save device ID to preferences
                    saveDeviceId(response.body().getId());
                } else {
                    Log.e(TAG, "❌ Failed to register token: " + response.code());
                }
            }

            @Override
            public void onFailure(Call<DeviceResponse> call, Throwable t) {
                Log.e(TAG, "❌ Error registering token", t);
            }
        });
    }

    private void saveDeviceId(String deviceId) {
        getSharedPreferences("FCMPrefs", MODE_PRIVATE)
            .edit()
            .putString("device_id", deviceId)
            .apply();
        Log.d(TAG, "Device ID saved: " + deviceId);
    }
}
```

#### 📝 Bước 2.5: Request Notification Permission (Android 13+) (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/feature/home/ui/Home/HomeActivity.java`

```java
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

public class HomeActivity extends AppCompatActivity {
    private ActivityResultLauncher<String> notificationPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Setup permission launcher
        notificationPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (isGranted) {
                    Log.d("HomeActivity", "✅ Notification permission granted");
                    getFCMTokenAndRegister();
                } else {
                    Log.w("HomeActivity", "❌ Notification permission denied");
                }
            }
        );

        // Request permission and get FCM token
        requestNotificationPermissionAndRegister();
        
        // ... rest of onCreate
    }

    private void requestNotificationPermissionAndRegister() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+: Need to request runtime permission
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            } else {
                // Permission already granted
                getFCMTokenAndRegister();
            }
        } else {
            // Android < 13: Permission granted at install time
            getFCMTokenAndRegister();
        }
    }

    private void getFCMTokenAndRegister() {
        FCMHelper.getFCMToken(this, new FCMHelper.FCMTokenCallback() {
            @Override
            public void onSuccess(String token) {
                Log.d("HomeActivity", "✅ FCM Token obtained: " + token.substring(0, 20) + "...");
                // Token will be sent to backend automatically via MyFirebaseMessagingService
            }

            @Override
            public void onFailure(Exception e) {
                Log.e("HomeActivity", "❌ Failed to get FCM token", e);
            }
        });
    }
}
```

#### 📝 Bước 2.6: Trigger FCM registration sau khi login (15 phút)

**File:** `Plantracker/app/src/main/java/com/example/tralalero/feature/auth/ui/login/LoginActivity.java`

Thêm vào method `navigateToHome()`:
```java
private void navigateToHome(FirebaseUser user) {
    // Get FCM token ngay sau khi login thành công
    FCMHelper.getFCMToken(this, new FCMHelper.FCMTokenCallback() {
        @Override
        public void onSuccess(String token) {
            Log.d(TAG, "✅ FCM Token obtained after login");
            // Token sẽ tự động gửi lên server qua onNewToken()
        }

        @Override
        public void onFailure(Exception e) {
            Log.e(TAG, "Failed to get FCM token", e);
        }
    });

    Intent intent = new Intent(this, HomeActivity.class);
    intent.putExtra("user_name", user.getDisplayName());
    intent.putExtra("user_email", user.getEmail());
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    startActivity(intent);
    finish();
}
```

---

### **GIAI ĐOẠN 3: Testing & Verification (60 phút)**

#### 📝 Bước 3.1: Test Backend Endpoints (20 phút)

**Sử dụng Postman hoặc cURL:**

```bash
# 1. Login để lấy token
POST http://localhost:3000/api/users/firebase/auth
Content-Type: application/json

{
  "idToken": "your-firebase-id-token"
}

# Save JWT token from response

# 2. Register device
POST http://localhost:3000/api/users/fcm/register-device
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "fcmToken": "eXAMPLE_FCM_TOKEN",
  "platform": "ANDROID",
  "deviceName": "Test Device",
  "osVersion": "Android 14",
  "appVersion": "1.0.0"
}

# 3. Get devices
GET http://localhost:3000/api/users/fcm/devices
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 📝 Bước 3.2: Test Android App (30 phút)

**Test Flow:**
1. ✅ Clean install app
2. ✅ Login với Google/Email
3. ✅ Check Logcat xem FCM token có được gửi lên server không
4. ✅ Verify trong database có record trong `user_devices`
5. ✅ Logout và login lại → check token update

**Expected Logs:**
```
D/FCMService: New FCM token: eXAMPLE...
D/FCMService: Sending token to server: eXAMPLE...
D/FCMService: ✅ Token registered successfully. Device ID: uuid-here
D/HomeActivity: ✅ Notification permission granted
D/HomeActivity: ✅ FCM Token obtained: eXAMPLE...
```

#### 📝 Bước 3.3: Test Push Notification từ Firebase Console (10 phút)

1. Vào [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Cloud Messaging
3. Send test message
4. Paste FCM token từ Logcat
5. Click "Test" → App phải nhận được notification

---

### **GIAI ĐOẠN 4: Cleanup & Documentation (30 phút)**

#### 📝 Bước 4.1: Code Review & Testing Edge Cases (15 phút)

**Test Cases:**
- ✅ Token refresh khi Firebase tự động renew
- ✅ Multiple devices cùng 1 user
- ✅ Logout → token deactivated
- ✅ App force stopped → notification vẫn nhận được
- ✅ Permission denied → app vẫn hoạt động bình thường

#### 📝 Bước 4.2: Update Documentation (15 phút)

Tạo file `FCM_USAGE_GUIDE.md` với:
- How to send notification từ backend
- How to test locally
- Troubleshooting common issues

---

## 📋 CHECKLIST HOÀN THÀNH

### Backend:
- [x] Prisma schema có `user_devices` model ✅
- [x] Database có table `user_devices` ✅ 
- [x] DTOs đã tạo (cần update để match schema) ✅
- [ ] DTOs đã update: `deviceModel` thay vì `deviceName`
- [ ] Endpoints trong `UsersController`
- [ ] Service methods implement đầy đủ
- [ ] Test với Postman thành công

### Android:
- [ ] DTOs Java classes
- [ ] `FcmApiService` interface
- [ ] `sendTokenToServer()` implemented
- [ ] Notification permission request
- [ ] FCM token gửi sau login
- [ ] Logcat hiển thị logs thành công

### Testing:
- [ ] Backend endpoints hoạt động
- [ ] Android gửi token thành công
- [ ] Database có records trong `user_devices`
- [ ] Nhận được test notification từ Firebase Console

---

## 🚀 NEXT STEPS (SAU KHI HOÀN THÀNH)

1. **Notification Templates:** Tạo các loại thông báo khác nhau
2. **Rich Notifications:** Thêm images, actions vào notification
3. **Topic Subscriptions:** Subscribe theo workspace/project
4. **Analytics:** Track notification delivery rate
5. **Scheduled Notifications:** Daily summaries, reminders

---

## 🆘 TROUBLESHOOTING

### Issue: Token không gửi lên server
**Solution:** Check Logcat cho errors, verify auth token có valid không

### Issue: Permission denied
**Solution:** Android 13+ cần runtime permission, check đã request chưa

### Issue: Backend trả 401
**Solution:** Verify JWT token còn valid, check Firebase auth

### Issue: Notification không hiển thị
**Solution:** Check notification channel đã tạo, permission granted

---

## 📞 SUPPORT

Nếu gặp vấn đề trong quá trình triển khai:
1. Check logs cẩn thận (Android Logcat & Backend console)
2. Verify network connectivity
3. Test từng bước riêng lẻ
4. Review code changes

**Thời gian dự kiến:** 3 giờ (rút ngắn 1h do DB đã sẵn sàng)
**Độ khó:** Medium
**Kết quả:** Android app có thể nhận basic push notifications từ backend

---

## 🎉 UPDATES (28/10/2025)

### ✅ ĐÃ HOÀN THÀNH TỰ ĐỘNG:
1. Database đã có table `user_devices` 
2. Prisma schema đã sync với database
3. Migration status: UP TO DATE

### ⚡ RÚT NGẮN THỜI GIAN:
- **Trước:** 4 giờ (240 phút)
- **Sau:** 3 giờ (180 phút)
- **Tiết kiệm:** 1 giờ

### 🔄 THAY ĐỔI SCHEMA:
- `deviceName` → `deviceModel`
- Xóa `osVersion` (không có trong DB)
- Có thêm `locale`, `timezone` (bonus, không bắt buộc dùng)
