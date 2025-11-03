# WebSocket + FCM Notification Implementation Summary

## ✅ Implementation Complete

### 📂 Files Created/Modified

#### 1. **Gateway** - `src/modules/notifications/notifications.gateway.ts`
- ✅ WebSocket server with Socket.IO
- ✅ JWT authentication for connections
- ✅ User room management (`user_{userId}`)
- ✅ Online status tracking
- ✅ Subscribe to notification types
- ✅ Mark as read handler
- ✅ Ping/pong health check

#### 2. **Service** - `src/modules/notifications/notifications.service.ts`
- ✅ Hybrid notification delivery (WebSocket + FCM)
- ✅ `sendTaskAssigned()` - Updated with WebSocket support
- ✅ `sendNotificationToUser()` - Generic notification sender
- ✅ `sendNotificationToUsers()` - Bulk notifications
- ✅ `markAsRead()` - Mark notifications as read
- ✅ `getUnreadNotifications()` - Fetch unread
- ✅ Online/offline detection logic
- ✅ Channel ID mapping for Android

#### 3. **Module** - `src/modules/notifications/notifications.module.ts`
- ✅ JwtModule integration for WebSocket auth
- ✅ Gateway exported for use in other modules

#### 4. **Controller** - `src/modules/notifications/notifications.controller.ts`
- ✅ `GET /notifications/unread` - Get unread notifications
- ✅ `PATCH /notifications/:id/read` - Mark as read
- ✅ `POST /notifications/test/send` - Send test notification

#### 5. **Test Files**
- ✅ `test-scripts/test-websocket.http` - REST API tests
- ✅ `test-scripts/websocket-test-client.html` - WebSocket client UI

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Client (Android/Web)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  App FOREGROUND:                                        │
│  ┌──────────────┐         ┌──────────────┐            │
│  │  Socket.IO   │◄───────►│ WebSocket    │            │
│  │  Client      │  WSS    │ Gateway      │  ⚡ Real-time
│  └──────────────┘         └──────────────┘  < 100ms    │
│                                  │                      │
│                                  ▼                      │
│                     NotificationsService                │
│                                  │                      │
│  ┌──────────────┐         ┌──────────────┐            │
│  │  FCM         │◄───────►│  FCM         │            │
│  │  Receiver    │  HTTPS  │  Service     │  🔔 Push    │
│  └──────────────┘         └──────────────┘  1-10s      │
│                                                         │
│  App BACKGROUND: FCM Push Notifications                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Notification Flow

### Scenario 1: User Online (App Open)

```typescript
// In tasks.service.ts
await this.notificationsService.sendTaskAssigned({
  taskId: 'uuid',
  taskTitle: 'Implement WebSocket',
  projectName: 'PlanTracker',
  assigneeId: 'user-uuid',
  assignedBy: 'admin-uuid',
  assignedByName: 'Admin User'
});

// NotificationsService checks:
const isOnline = this.notificationsGateway.isUserOnline(assigneeId);

if (isOnline) {
  // ⚡ Send via WebSocket (instant)
  this.notificationsGateway.emitToUser(assigneeId, 'notification', {
    id: 'notif-uuid',
    type: 'TASK_ASSIGNED',
    title: '📋 Task Mới',
    body: 'Admin User đã giao task cho bạn...',
    data: { taskId, ... },
    createdAt: '2025-10-28T...'
  });
  
  // Mark as DELIVERED in DB
  status: 'DELIVERED'
}
```

**Client receives:**
```javascript
socket.on('notification', (data) => {
  // Show in-app banner/snackbar
  showInAppNotification(data);
  
  // No system notification (app is open)
});
```

---

### Scenario 2: User Offline (App Closed)

```typescript
if (!isOnline) {
  // 🔔 Send via FCM
  const device = await this.prisma.user_devices.findFirst({
    where: { user_id: assigneeId, is_active: true }
  });
  
  await this.fcmService.sendNotification({
    token: device.fcm_token,
    notification: {
      title: '📋 Task Mới',
      body: 'Admin User đã giao task...'
    },
    data: { taskId, type: 'task_assigned' },
    android: {
      priority: 'high',
      notification: { channelId: 'task_updates' }
    }
  });
  
  // Mark as SENT in DB
  status: 'SENT'
}
```

**Client receives:**
```kotlin
// MyFirebaseMessagingService.kt
override fun onMessageReceived(remoteMessage: RemoteMessage) {
  // Show system notification
  showSystemNotification(remoteMessage.data)
}
```

---

## 📡 WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `connect` | `{ auth: { token: 'jwt' } }` | Initial connection with JWT |
| `subscribe` | `{ types: ['TASK_ASSIGNED', ...] }` | Subscribe to notification types |
| `mark_read` | `{ notificationId: 'uuid' }` | Mark notification as read |
| `ping` | `{}` | Health check |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ message, userId, timestamp }` | Welcome message after auth |
| `notification` | `{ id, type, title, body, data, createdAt }` | Real-time notification |
| `subscribed` | `{ types, timestamp }` | Subscription confirmation |
| `status` | `{ online: true }` | Online status update |
| `pong` | `{ timestamp }` | Ping response |

---

## 🧪 Testing

### 1. Start Server
```bash
npm run dev
```

### 2. Test WebSocket Connection

**Option A: HTML Client**
1. Open `test-scripts/websocket-test-client.html` in browser
2. Enter JWT token from Firebase Auth
3. Click "Connect"
4. Watch notifications arrive in real-time

**Option B: Socket.IO Client (Node.js)**
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('✅ Connected!');
  
  socket.emit('subscribe', {
    types: ['TASK_ASSIGNED', 'MEETING_REMINDER']
  });
});

socket.on('notification', (data) => {
  console.log('🔔 Notification:', data);
});
```

### 3. Send Test Notification

**Via REST API:**
```http
POST http://localhost:3000/notifications/test/send
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Test Notification",
  "body": "WebSocket is working!",
  "type": "SYSTEM"
}
```

**Via Code:**
```typescript
// In any service
await this.notificationsService.sendNotificationToUser(userId, {
  type: 'TASK_ASSIGNED',
  title: 'New Task',
  body: 'You have been assigned a task',
  data: { taskId: 'uuid' },
  priority: 'HIGH'
});
```

---

## 🔌 Integration với Tasks Service

Update `src/modules/tasks/tasks.service.ts`:

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService, // ← Inject
  ) {}

  async assignTask(taskId: string, assigneeId: string, assignedBy: string) {
    // Update task in DB
    const task = await this.prisma.tasks.update({
      where: { id: taskId },
      data: { assignee_id: assigneeId },
      include: { 
        project: true,
        created_by_user: true
      }
    });

    // Send notification (WebSocket or FCM)
    await this.notificationsService.sendTaskAssigned({
      taskId: task.id,
      taskTitle: task.title,
      projectName: task.project.name,
      assigneeId: assigneeId,
      assignedBy: assignedBy,
      assignedByName: task.created_by_user.full_name
    });

    return task;
  }

  async addComment(taskId: string, userId: string, content: string) {
    const comment = await this.prisma.task_comments.create({
      data: { task_id: taskId, user_id: userId, content },
      include: { 
        task: { include: { created_by_user: true, assignee: true } },
        user: true
      }
    });

    // Notify task creator and assignee
    const recipientIds = [
      comment.task.created_by,
      comment.task.assignee_id
    ].filter(id => id !== userId); // Don't notify commenter

    await this.notificationsService.sendNotificationToUsers(recipientIds, {
      type: 'TASK_UPDATED',
      title: 'New Comment',
      body: `${comment.user.full_name} commented: "${content}"`,
      data: {
        taskId,
        commentId: comment.id,
        deeplink: `/tasks/${taskId}#comment-${comment.id}`
      },
      priority: 'NORMAL'
    });

    return comment;
  }
}
```

---

## 📊 Database Schema

Notifications are logged to `notifications` table:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type notification_type NOT NULL, -- TASK_ASSIGNED, MEETING_REMINDER, etc.
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  channel notification_channel NOT NULL, -- PUSH, IN_APP, EMAIL
  priority notification_priority NOT NULL, -- HIGH, NORMAL, LOW
  status notification_status NOT NULL, -- QUEUED, SENT, DELIVERED, READ, FAILED
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Status Lifecycle:**
- `QUEUED` → Initial state (not yet sent)
- `SENT` → FCM message sent (waiting for delivery)
- `DELIVERED` → WebSocket delivered OR FCM delivered
- `READ` → User acknowledged notification
- `FAILED` → Delivery failed

---

## 🚀 Next Steps (Future Enhancements)

### Phase 1 (Current) ✅
- [x] WebSocket Gateway with JWT auth
- [x] Online/offline detection
- [x] Hybrid delivery (WebSocket + FCM)
- [x] Task assigned notifications
- [x] Test endpoints

### Phase 2 (Recommended)
- [ ] Implement more use cases (see `PUSH_NOTIFICATION_USE_CASES.md`)
  - [ ] Meeting reminders (cron job)
  - [ ] Task due date reminders
  - [ ] Comment notifications
  - [ ] Event invites
- [ ] Notification preferences per user
- [ ] Notification grouping/batching
- [ ] Retry logic for failed deliveries

### Phase 3 (Advanced)
- [ ] Read receipts (delivered_at tracking)
- [ ] Notification history pagination
- [ ] Push to multiple devices per user
- [ ] Quiet hours support
- [ ] Rich notifications (images, actions)

---

## 📚 Related Documentation

- `docs/PUSH_NOTIFICATION_USE_CASES.md` - 19 use cases chi tiết
- `docs/ANDROID_WEBSOCKET_INTEGRATION.md` - Android client implementation
- `docs/NOTIFICATION_IMPLEMENTATION_PLAN.md` - Original FCM setup
- `test-scripts/websocket-test-client.html` - Live test client

---

## 🔐 Security Considerations

1. **JWT Validation**: Every WebSocket connection validates JWT token
2. **User Isolation**: Users can only receive their own notifications
3. **Rate Limiting**: Consider adding rate limits for test endpoints
4. **CORS**: Currently set to `*`, restrict in production
5. **Token Expiry**: JWT tokens expire, clients must handle re-auth

---

## 📱 Android Client Setup

See `docs/ANDROID_WEBSOCKET_INTEGRATION.md` for full Android implementation with:
- OkHttp WebSocket client
- Lifecycle management (connect on foreground, disconnect on background)
- Notification deduplication
- Deep linking
- Kotlin code examples

---

## ✅ Summary

**What works now:**
- ✅ WebSocket server running on `/notifications` namespace
- ✅ JWT authentication for connections
- ✅ Real-time notification delivery to online users
- ✅ FCM fallback for offline users
- ✅ Notification logging to database
- ✅ REST API for unread/read notifications
- ✅ Test client for debugging

**How to use:**
```typescript
// Anywhere in your NestJS services
await this.notificationsService.sendNotificationToUser(userId, {
  type: 'TASK_ASSIGNED',
  title: 'New Task',
  body: 'You have been assigned to implement WebSocket',
  data: { taskId: 'uuid' },
  priority: 'HIGH'
});
```

**Result:**
- If user online → WebSocket delivery (< 100ms)
- If user offline → FCM push notification (1-10s)

🎉 **Ready to use!**
