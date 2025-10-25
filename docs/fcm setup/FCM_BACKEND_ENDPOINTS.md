# 🔧 FCM BACKEND ENDPOINTS - COMPLETE IMPLEMENTATION

## 🎯 MỤC TIÊU

Implement các endpoints cần thiết để:
1. **Register device** - Đăng ký FCM token từ Android/iOS
2. **Update token** - Cập nhật token khi refresh
3. **Unregister device** - Xóa device khi logout
4. **Get devices** - Lấy danh sách devices của user
5. **Mark notification as read** - Đánh dấu notification đã đọc

---

## 📋 PHASE 1: CREATE DTOs

### Step 1.1: Create DTOs cho Device Registration

```typescript
// File: src/modules/notifications/dto/register-device.dto.ts

import { IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
}

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @IsEnum(DevicePlatform)
  @IsNotEmpty()
  platform: DevicePlatform;

  @IsString()
  @IsOptional()
  deviceName?: string;

  @IsString()
  @IsOptional()
  osVersion?: string;

  @IsString()
  @IsOptional()
  appVersion?: string;
}

// Response DTO
export class DeviceResponseDto {
  id: string;
  userId: string;
  fcmToken: string;
  platform: string;
  deviceName?: string;
  isActive: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}
```

### Step 1.2: Create DTOs cho Token Update

```typescript
// File: src/modules/notifications/dto/update-token.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateTokenDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  newFcmToken: string;
}
```

### Step 1.3: Create DTOs cho Notification Operations

```typescript
// File: src/modules/notifications/dto/mark-read.dto.ts

import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class MarkReadDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  notificationIds: string[];
}

export class MarkAllReadDto {
  @IsString()
  @IsOptional()
  beforeDate?: string; // ISO date string
}
```

---

## 📋 PHASE 2: UPDATE NOTIFICATIONS SERVICE

### Step 2.1: Add Device Management Methods

```typescript
// File: src/modules/notifications/notifications.service.ts

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';
import { RegisterDeviceDto, DeviceResponseDto, UpdateTokenDto, MarkReadDto } from './dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  // ========================================
  // DEVICE MANAGEMENT
  // ========================================

  /**
   * Register a new device or update existing one
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    try {
      // 1. Validate FCM token với Firebase
      const isValidToken = await this.fcmService.validateToken(dto.fcmToken);
      if (!isValidToken) {
        throw new BadRequestException('Invalid FCM token');
      }

      // 2. Check xem device đã tồn tại chưa (same fcmToken)
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
            device_name: dto.deviceName ?? existingDevice.device_name,
            os_version: dto.osVersion ?? existingDevice.os_version,
            app_version: dto.appVersion ?? existingDevice.app_version,
            last_active_at: new Date(),
          },
        });

        this.logger.log(`Updated existing device ${device.id} for user ${userId}`);
      } else {
        // Create new device
        device = await this.prisma.user_devices.create({
          data: {
            user_id: userId,
            fcm_token: dto.fcmToken,
            platform: dto.platform,
            device_name: dto.deviceName,
            os_version: dto.osVersion,
            app_version: dto.appVersion,
            is_active: true,
            last_active_at: new Date(),
          },
        });

        this.logger.log(`Registered new device ${device.id} for user ${userId}`);
      }

      return this.mapDeviceToDto(device);
    } catch (error) {
      this.logger.error(`Failed to register device for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update FCM token for existing device
   */
  async updateFCMToken(userId: string, dto: UpdateTokenDto): Promise<void> {
    try {
      // 1. Verify device belongs to user
      const device = await this.prisma.user_devices.findFirst({
        where: {
          id: dto.deviceId,
          user_id: userId,
        },
      });

      if (!device) {
        throw new NotFoundException(`Device ${dto.deviceId} not found for user ${userId}`);
      }

      // 2. Validate new token
      const isValidToken = await this.fcmService.validateToken(dto.newFcmToken);
      if (!isValidToken) {
        throw new BadRequestException('Invalid FCM token');
      }

      // 3. Update token
      await this.prisma.user_devices.update({
        where: { id: dto.deviceId },
        data: {
          fcm_token: dto.newFcmToken,
          last_active_at: new Date(),
        },
      });

      this.logger.log(`Updated FCM token for device ${dto.deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to update FCM token:`, error);
      throw error;
    }
  }

  /**
   * Unregister device (mark as inactive)
   */
  async unregisterDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const device = await this.prisma.user_devices.findFirst({
        where: {
          id: deviceId,
          user_id: userId,
        },
      });

      if (!device) {
        throw new NotFoundException(`Device ${deviceId} not found for user ${userId}`);
      }

      // Mark as inactive instead of deleting
      await this.prisma.user_devices.update({
        where: { id: deviceId },
        data: {
          is_active: false,
        },
      });

      this.logger.log(`Unregistered device ${deviceId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister device:`, error);
      throw error;
    }
  }

  /**
   * Get all devices for user
   */
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

    return devices.map((device) => this.mapDeviceToDto(device));
  }

  /**
   * Delete all inactive devices (cleanup)
   */
  async cleanupInactiveDevices(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const result = await this.prisma.user_devices.deleteMany({
      where: {
        is_active: false,
        last_active_at: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} inactive devices`);
    return result.count;
  }

  // ========================================
  // NOTIFICATION OPERATIONS
  // ========================================

  /**
   * Get notifications for user (với pagination)
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<{
    notifications: any[];
    total: number;
    unreadCount: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      user_id: userId,
    };

    if (options.unreadOnly) {
      where.read_at = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({
        where: {
          user_id: userId,
          read_at: null,
        },
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsAsRead(userId: string, dto: MarkReadDto): Promise<void> {
    await this.prisma.notifications.updateMany({
      where: {
        id: {
          in: dto.notificationIds,
        },
        user_id: userId, // Security: chỉ update notification của user này
      },
      data: {
        read_at: new Date(),
        status: 'READ',
      },
    });

    this.logger.log(`Marked ${dto.notificationIds.length} notifications as read for user ${userId}`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(userId: string, beforeDate?: Date): Promise<number> {
    const where: any = {
      user_id: userId,
      read_at: null,
    };

    if (beforeDate) {
      where.created_at = {
        lte: beforeDate,
      };
    }

    const result = await this.prisma.notifications.updateMany({
      where,
      data: {
        read_at: new Date(),
        status: 'READ',
      },
    });

    this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);
    return result.count;
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notifications.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    await this.prisma.notifications.delete({
      where: { id: notificationId },
    });

    this.logger.log(`Deleted notification ${notificationId} for user ${userId}`);
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    const [total, unread, byType] = await Promise.all([
      this.prisma.notifications.count({
        where: { user_id: userId },
      }),
      this.prisma.notifications.count({
        where: { user_id: userId, read_at: null },
      }),
      this.prisma.notifications.groupBy({
        by: ['type'],
        where: { user_id: userId },
        _count: true,
      }),
    ]);

    const byTypeMap = byType.reduce((acc, item) => {
      acc[item.type] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      unread,
      byType: byTypeMap,
    };
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Map database model to DTO
   */
  private mapDeviceToDto(device: any): DeviceResponseDto {
    return {
      id: device.id,
      userId: device.user_id,
      fcmToken: device.fcm_token,
      platform: device.platform,
      deviceName: device.device_name,
      isActive: device.is_active,
      createdAt: device.created_at,
      lastActiveAt: device.last_active_at,
    };
  }

  // ... existing methods (sendTaskReminder, sendDailySummary, etc.)
}
```

---

## 📋 PHASE 3: UPDATE NOTIFICATIONS CONTROLLER

### Step 3.1: Add Endpoints

```typescript
// File: src/modules/notifications/notifications.controller.ts

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  RegisterDeviceDto,
  UpdateTokenDto,
  MarkReadDto,
  MarkAllReadDto,
  DeviceResponseDto,
} from './dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ========================================
  // DEVICE MANAGEMENT ENDPOINTS
  // ========================================

  /**
   * POST /api/notifications/register-device
   * Register a new device with FCM token
   */
  @Post('register-device')
  @HttpCode(HttpStatus.OK)
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    return this.notificationsService.registerDevice(userId, dto);
  }

  /**
   * POST /api/notifications/update-token
   * Update FCM token for existing device
   */
  @Post('update-token')
  @HttpCode(HttpStatus.OK)
  async updateToken(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTokenDto,
  ): Promise<{ message: string }> {
    await this.notificationsService.updateFCMToken(userId, dto);
    return { message: 'FCM token updated successfully' };
  }

  /**
   * DELETE /api/notifications/devices/:deviceId
   * Unregister device (mark as inactive)
   */
  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.OK)
  async unregisterDevice(
    @CurrentUser('id') userId: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.unregisterDevice(userId, deviceId);
    return { message: 'Device unregistered successfully' };
  }

  /**
   * GET /api/notifications/devices
   * Get all devices for current user
   */
  @Get('devices')
  async getUserDevices(
    @CurrentUser('id') userId: string,
  ): Promise<DeviceResponseDto[]> {
    return this.notificationsService.getUserDevices(userId);
  }

  // ========================================
  // NOTIFICATION ENDPOINTS
  // ========================================

  /**
   * GET /api/notifications
   * Get notifications for current user with pagination
   * Query params:
   * - page: number (default 1)
   * - limit: number (default 20)
   * - unreadOnly: boolean (default false)
   */
  @Get()
  async getUserNotifications(
    @CurrentUser('id') userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('unreadOnly', new ParseBoolPipe({ optional: true })) unreadOnly?: boolean,
  ): Promise<{
    notifications: any[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const result = await this.notificationsService.getUserNotifications(userId, {
      page,
      limit,
      unreadOnly,
    });

    return {
      ...result,
      page: page || 1,
      limit: limit || 20,
    };
  }

  /**
   * PATCH /api/notifications/mark-read
   * Mark specific notifications as read
   */
  @Patch('mark-read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Body() dto: MarkReadDto,
  ): Promise<{ message: string }> {
    await this.notificationsService.markNotificationsAsRead(userId, dto);
    return { message: 'Notifications marked as read' };
  }

  /**
   * PATCH /api/notifications/mark-all-read
   * Mark all notifications as read
   */
  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @CurrentUser('id') userId: string,
    @Body() dto?: MarkAllReadDto,
  ): Promise<{ message: string; count: number }> {
    const beforeDate = dto?.beforeDate ? new Date(dto.beforeDate) : undefined;
    const count = await this.notificationsService.markAllNotificationsAsRead(
      userId,
      beforeDate,
    );
    return {
      message: 'All notifications marked as read',
      count,
    };
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) notificationId: string,
  ): Promise<{ message: string }> {
    await this.notificationsService.deleteNotification(userId, notificationId);
    return { message: 'Notification deleted' };
  }

  /**
   * GET /api/notifications/stats
   * Get notification statistics
   */
  @Get('stats')
  async getStats(
    @CurrentUser('id') userId: string,
  ): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    return this.notificationsService.getNotificationStats(userId);
  }
}
```

---

## 📋 PHASE 4: UPDATE FCM SERVICE

### Step 4.1: Add Token Validation Method

```typescript
// File: src/modules/fcm/fcm.service.ts

import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor() {
    // Firebase admin đã được init trong firebase-admin.provider.ts
  }

  /**
   * Validate FCM token
   * Gửi dry-run message để check token có valid không
   */
  async validateToken(fcmToken: string): Promise<boolean> {
    try {
      // Gửi dry-run message (không thực sự gửi notification)
      await admin.messaging().send(
        {
          token: fcmToken,
          data: {
            test: 'validation',
          },
        },
        true, // dry-run mode
      );

      return true;
    } catch (error: any) {
      // Check error codes
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Invalid FCM token: ${fcmToken}`);
        return false;
      }

      // Other errors (network, etc.) - consider token valid
      this.logger.warn(`Error validating FCM token:`, error.message);
      return true; // Don't reject token due to temporary errors
    }
  }

  /**
   * Send notification to single device
   */
  async sendNotification(payload: {
    token: string;
    notification: {
      title: string;
      body: string;
    };
    data?: Record<string, string>;
    android?: admin.messaging.AndroidConfig;
    apns?: admin.messaging.ApnsConfig;
  }): Promise<string> {
    try {
      const message: admin.messaging.Message = {
        token: payload.token,
        notification: payload.notification,
        data: payload.data,
        android: payload.android,
        apns: payload.apns,
      };

      const messageId = await admin.messaging().send(message);
      this.logger.log(`Notification sent successfully: ${messageId}`);
      return messageId;
    } catch (error: any) {
      // Handle specific FCM errors
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.error(`Invalid FCM token: ${payload.token}`);
        throw new Error('Invalid FCM token');
      }

      this.logger.error(`Failed to send notification:`, error);
      throw error;
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(
    tokens: string[],
    notification: {
      title: string;
      body: string;
    },
    data?: Record<string, string>,
  ): Promise<{
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
  }> {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification,
        data,
      };

      const response = await admin.messaging().sendMulticast(message);

      // Collect invalid tokens
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      this.logger.log(
        `Sent to ${response.successCount}/${tokens.length} devices`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error) {
      this.logger.error('Failed to send multicast notification:', error);
      throw error;
    }
  }

  // ... existing methods
}
```

---

## 📋 PHASE 5: TESTING

### Step 5.1: Test Device Registration

```http
### 1. Register Device
POST http://localhost:3000/api/notifications/register-device
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "fcmToken": "eXAMPLE_FCM_TOKEN_FROM_ANDROID",
  "platform": "ANDROID",
  "deviceName": "Samsung Galaxy S23",
  "osVersion": "Android 14",
  "appVersion": "1.0.0"
}

### Expected Response:
# {
#   "id": "uuid",
#   "userId": "uuid",
#   "fcmToken": "eXAMPLE_FCM_TOKEN...",
#   "platform": "ANDROID",
#   "deviceName": "Samsung Galaxy S23",
#   "isActive": true,
#   "createdAt": "2025-10-24T...",
#   "lastActiveAt": "2025-10-24T..."
# }
```

### Step 5.2: Test Get Devices

```http
### 2. Get User Devices
GET http://localhost:3000/api/notifications/devices
Authorization: Bearer {{firebase_token}}

### Expected Response:
# [
#   {
#     "id": "uuid",
#     "userId": "uuid",
#     "fcmToken": "...",
#     "platform": "ANDROID",
#     "deviceName": "Samsung Galaxy S23",
#     "isActive": true,
#     "createdAt": "...",
#     "lastActiveAt": "..."
#   }
# ]
```

### Step 5.3: Test Get Notifications

```http
### 3. Get Notifications (Paginated)
GET http://localhost:3000/api/notifications?page=1&limit=20&unreadOnly=false
Authorization: Bearer {{firebase_token}}

### Expected Response:
# {
#   "notifications": [...],
#   "total": 50,
#   "unreadCount": 10,
#   "page": 1,
#   "limit": 20
# }
```

### Step 5.4: Test Mark as Read

```http
### 4. Mark Notifications as Read
PATCH http://localhost:3000/api/notifications/mark-read
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "notificationIds": [
    "notification-uuid-1",
    "notification-uuid-2"
  ]
}

### Expected Response:
# {
#   "message": "Notifications marked as read"
# }
```

### Step 5.5: Test Mark All as Read

```http
### 5. Mark All Notifications as Read
PATCH http://localhost:3000/api/notifications/mark-all-read
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "beforeDate": "2025-10-24T23:59:59.999Z"
}

### Expected Response:
# {
#   "message": "All notifications marked as read",
#   "count": 15
# }
```

### Step 5.6: Test Unregister Device

```http
### 6. Unregister Device (Logout)
DELETE http://localhost:3000/api/notifications/devices/{{deviceId}}
Authorization: Bearer {{firebase_token}}

### Expected Response:
# {
#   "message": "Device unregistered successfully"
# }
```

---

## 📋 PHASE 6: ANDROID INTEGRATION

### Step 6.1: Update Android API Service

```kotlin
// File: app/src/main/java/com/yourcompany/plantracker/api/ApiService.kt

interface ApiService {
    
    // Device Management
    @POST("api/notifications/register-device")
    suspend fun registerDevice(
        @Body request: RegisterDeviceRequest
    ): Response<DeviceResponse>
    
    @POST("api/notifications/update-token")
    suspend fun updateFCMToken(
        @Body request: UpdateTokenRequest
    ): Response<MessageResponse>
    
    @DELETE("api/notifications/devices/{deviceId}")
    suspend fun unregisterDevice(
        @Path("deviceId") deviceId: String
    ): Response<MessageResponse>
    
    @GET("api/notifications/devices")
    suspend fun getUserDevices(): Response<List<DeviceResponse>>
    
    // Notification Operations
    @GET("api/notifications")
    suspend fun getNotifications(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("unreadOnly") unreadOnly: Boolean = false
    ): Response<NotificationsResponse>
    
    @PATCH("api/notifications/mark-read")
    suspend fun markNotificationsAsRead(
        @Body request: MarkReadRequest
    ): Response<MessageResponse>
    
    @PATCH("api/notifications/mark-all-read")
    suspend fun markAllNotificationsAsRead(
        @Body request: MarkAllReadRequest = MarkAllReadRequest()
    ): Response<MarkAllReadResponse>
    
    @DELETE("api/notifications/{id}")
    suspend fun deleteNotification(
        @Path("id") notificationId: String
    ): Response<MessageResponse>
    
    @GET("api/notifications/stats")
    suspend fun getNotificationStats(): Response<NotificationStatsResponse>
}

// Data models
data class RegisterDeviceRequest(
    val fcmToken: String,
    val platform: String,
    val deviceName: String?,
    val osVersion: String?,
    val appVersion: String?
)

data class DeviceResponse(
    val id: String,
    val userId: String,
    val fcmToken: String,
    val platform: String,
    val deviceName: String?,
    val isActive: Boolean,
    val createdAt: String,
    val lastActiveAt: String
)

data class UpdateTokenRequest(
    val deviceId: String,
    val newFcmToken: String
)

data class MarkReadRequest(
    val notificationIds: List<String>
)

data class MarkAllReadRequest(
    val beforeDate: String? = null
)

data class MarkAllReadResponse(
    val message: String,
    val count: Int
)

data class NotificationsResponse(
    val notifications: List<NotificationItem>,
    val total: Int,
    val unreadCount: Int,
    val page: Int,
    val limit: Int
)

data class NotificationItem(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val data: Map<String, Any>?,
    val readAt: String?,
    val createdAt: String
)

data class NotificationStatsResponse(
    val total: Int,
    val unread: Int,
    val byType: Map<String, Int>
)

data class MessageResponse(
    val message: String
)
```

### Step 6.2: Example Android Usage

```kotlin
// File: MainActivity.kt

class MainActivity : AppCompatActivity() {
    
    private val api = RetrofitClient.apiService
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Register device với FCM token
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            lifecycleScope.launch {
                registerDeviceWithBackend(token)
            }
        }
    }
    
    private suspend fun registerDeviceWithBackend(fcmToken: String) {
        try {
            val request = RegisterDeviceRequest(
                fcmToken = fcmToken,
                platform = "ANDROID",
                deviceName = Build.MODEL,
                osVersion = Build.VERSION.RELEASE,
                appVersion = BuildConfig.VERSION_NAME
            )
            
            val response = api.registerDevice(request)
            
            if (response.isSuccessful) {
                val device = response.body()
                Log.d("FCM", "Device registered: ${device?.id}")
                
                // Save deviceId to local storage
                saveDeviceId(device?.id ?: "")
            } else {
                Log.e("FCM", "Failed to register: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e("FCM", "Error registering device", e)
        }
    }
    
    private fun saveDeviceId(deviceId: String) {
        val prefs = getSharedPreferences("plantracker_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("device_id", deviceId).apply()
    }
}
```

---

## 📋 SUMMARY: API ENDPOINTS

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/notifications/register-device` | Register FCM token | ✅ Yes |
| POST | `/api/notifications/update-token` | Update FCM token | ✅ Yes |
| DELETE | `/api/notifications/devices/:id` | Unregister device | ✅ Yes |
| GET | `/api/notifications/devices` | Get user's devices | ✅ Yes |
| GET | `/api/notifications` | Get notifications (paginated) | ✅ Yes |
| PATCH | `/api/notifications/mark-read` | Mark notifications as read | ✅ Yes |
| PATCH | `/api/notifications/mark-all-read` | Mark all as read | ✅ Yes |
| DELETE | `/api/notifications/:id` | Delete notification | ✅ Yes |
| GET | `/api/notifications/stats` | Get notification stats | ✅ Yes |

---

## 🎯 CHECKLIST

### Backend Implementation:
- [ ] Create DTOs (register-device, update-token, mark-read)
- [ ] Add device management methods to NotificationsService
- [ ] Add notification operations methods
- [ ] Add endpoints to NotificationsController
- [ ] Update FCM service with validateToken()
- [ ] Test all endpoints với Postman/HTTP client

### Android Implementation:
- [ ] Setup Firebase SDK
- [ ] Create notification channels
- [ ] Implement FirebaseMessagingService
- [ ] Request notification permission (Android 13+)
- [ ] Get FCM token
- [ ] Call register-device API
- [ ] Handle token refresh
- [ ] Call unregister-device on logout
- [ ] Test receiving notifications

---

**Next Steps:** Deploy backend và test end-to-end với Android app
