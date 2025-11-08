# 🔌 WebSocket Implementation Audit Report

**Generated:** ${new Date().toISOString()}  
**Project:** PlanTracker Backend  
**Audited By:** GitHub Copilot

---

## 📊 Executive Summary

WebSocket implementation hiện tại sử dụng **hybrid delivery strategy**:

- ✅ **Real-time WebSocket** cho users đang ONLINE
- ✅ **FCM Push Notifications** cho users OFFLINE
- ✅ Routing tự động dựa trên `isUserOnline()` check
- ✅ Multi-device support (Map<userId, Set<socketId>>)

---

## 🏗️ Architecture Overview

### WebSocket Gateway (`notifications.gateway.ts`)

**Namespace:** `/notifications`  
**Authentication:** JWT token via handshake query  
**Port:** 3000 (same as HTTP server)

```typescript
// Key Architecture Components
├── Connection Management
│   ├── handleConnection() - JWT auth, user room joining
│   ├── handleDisconnect() - Socket cleanup, offline detection
│   └── Online Tracking: Map<userId, Set<socketId>>
│
├── Room System
│   ├── user_{userId} - Personal user rooms
│   └── project_{projectId} - Project-wide broadcasts
│
├── Message Handlers
│   ├── subscribe - Join project rooms
│   ├── mark_read - Mark notifications as read
│   ├── ping/pong - Connection health check
│   └── notification - Incoming notification events
│
└── Emit Methods
    ├── emitToUser() - Send to specific user (all devices)
    ├── emitToUsers() - Send to multiple users
    └── emitToProject() - Broadcast to project room
```

### Notification Routing Logic

```typescript
// Decision Tree
const isOnline = this.notificationsGateway.isUserOnline(userId);

if (isOnline) {
  // ✅ User has active WebSocket connection
  this.notificationsGateway.emitToUser(userId, 'notification', payload);
  await this.logNotification({ status: 'DELIVERED' }); // ⚡ Real-time
} else {
  // ❌ User offline → fallback to FCM
  await this.fcmService.sendNotification({ ... });
  await this.logNotification({ status: 'SENT' }); // 📬 Push queued
}
```

---

## ✅ Covered Notification Types (5/7 from Prisma Schema)

### 1. ✅ TASK_ASSIGNED

**Implementation:** `NotificationsService.sendTaskAssigned()`  
**WebSocket:** YES  
**FCM Fallback:** YES  
**Triggered By:**

- `TasksService.createTask()` - New task with assignee
- `TasksService.updateAssignee()` - Assignee change

**Payload:**

```typescript
{
  type: 'TASK_ASSIGNED',
  title: 'Task Assigned',
  body: '${assignerName} assigned you task: ${taskTitle}',
  data: {
    taskId, taskTitle, projectName, assignedBy, assignedByName,
    deeplink: `/tasks/${taskId}`
  }
}
```

**Status:** ✅ **FULLY IMPLEMENTED**

---

### 2. ✅ PROJECT_INVITE (Custom Type - Not in Prisma Enum)

**Implementation:** `NotificationsService.sendProjectInvite()`  
**WebSocket:** YES  
**FCM Fallback:** YES  
**Triggered By:**

- `ProjectMembersService.addMember()` - User invited to project

**Payload:**

```typescript
{
  type: 'PROJECT_INVITE',
  title: 'Project Invite',
  body: '${inviterName} invited you to "${projectName}" as ${role}',
  data: {
    projectId, projectName, invitedBy, invitedByName, role,
    invitationId,
    deeplink: `/projects/${projectId}`,
    // Action buttons
    hasActions: 'true',
    actionAccept: 'accept',
    actionDecline: 'decline'
  }
}
```

**Status:** ✅ **FULLY IMPLEMENTED** (⚠️ Missing from Prisma enum - should add!)

---

### 3. ✅ TASK_COMMENT (Custom Type - Not in Prisma Enum)

**Implementation:** `NotificationsService.sendTaskComment()`  
**WebSocket:** YES  
**FCM Fallback:** YES  
**Triggered By:**

- `CommentsService.createComment()` - New comment on task

**Payload:**

```typescript
{
  type: 'TASK_COMMENT',
  title: 'New Comment',
  body: '${commenterName} commented on "${taskTitle}": ${snippet}...',
  data: {
    taskId, taskTitle, projectName, commenterId, commenterName,
    deeplink: `/tasks/${taskId}`
  }
}
```

**Features:**

- Batch send to multiple users (all task watchers)
- Skips the commenter (no self-notification)

**Status:** ✅ **FULLY IMPLEMENTED** (⚠️ Missing from Prisma enum - should add!)

---

### 4. ✅ TIME_REMINDER (Prisma Enum Type)

**Implementation:** `NotificationsService.sendTaskReminder()`  
**WebSocket:** ❌ **NO** (FCM ONLY)  
**FCM Fallback:** YES  
**Triggered By:**

- `WorkerService.sendUpcomingTaskReminders()` - Cron job (15 min before due)
- `WorkerService.sendOverdueTaskReminders()` - Cron job (daily at 9 AM)

**Payload:**

```typescript
{
  type: 'task_reminder',
  title: 'Task Reminder',
  body: 'Task "${taskTitle}" is due soon!',
  data: {
    taskId, taskTitle, projectName, dueDate,
    clickAction: 'OPEN_TASK_DETAIL'
  },
  android: {
    priority: 'high',
    notification: { channelId: 'task_reminders' }
  }
}
```

**Status:** ⚠️ **PARTIAL** - No WebSocket routing (FCM only)

---

### 5. ✅ DAILY_SUMMARY (Custom Type - Not in Prisma Enum)

**Implementation:** `NotificationsService.sendDailySummary()`  
**WebSocket:** ❌ **NO** (FCM ONLY)  
**FCM Fallback:** YES  
**Triggered By:**

- `WorkerService` - Scheduled cron job (daily at 8 AM)

**Payload:**

```typescript
{
  type: 'daily_summary',
  title: '☀️ Daily Summary',
  body: 'You have ${totalTasks} tasks (${upcomingTasks} upcoming, ${overdueTasks} overdue)',
  data: {
    totalTasks, upcomingTasks, overdueTasks,
    clickAction: 'OPEN_TASKS_LIST'
  },
  android: {
    priority: 'normal',
    notification: { channelId: 'daily_summary' }
  }
}
```

**Status:** ⚠️ **PARTIAL** - No WebSocket routing (FCM only)

---

## ❌ Missing Notification Types (2/7 from Prisma Schema)

### 1. ❌ TASK_MOVED

**Prisma Enum:** ✅ Defined  
**Implementation:** ❌ **NOT IMPLEMENTED**  
**Use Case:** Notify when task is moved to different board/project  
**Priority:** 🟡 **MEDIUM**

**Recommended Trigger:**

- `TasksService.moveTask()` / `updateTask()` when `project_id` or `board_id` changes

**Suggested Payload:**

```typescript
{
  type: 'TASK_MOVED',
  title: 'Task Moved',
  body: '${moverName} moved "${taskTitle}" to ${targetLocation}',
  data: {
    taskId, taskTitle,
    fromProject, toProject,
    fromBoard, toBoard,
    movedBy, movedByName,
    deeplink: `/tasks/${taskId}`
  }
}
```

---

### 2. ❌ EVENT_INVITE

**Prisma Enum:** ✅ Defined  
**Implementation:** ❌ **NOT IMPLEMENTED**  
**Use Case:** Notify when invited to calendar event  
**Priority:** 🔴 **HIGH** (related to Google Calendar integration!)

**Recommended Trigger:**

- `EventsService.createEvent()` - When event has participants
- `EventsService.updateParticipants()` - When adding new participants

**Suggested Payload:**

```typescript
{
  type: 'EVENT_INVITE',
  title: 'Event Invitation',
  body: '${organizerName} invited you to "${eventTitle}"',
  data: {
    eventId, eventTitle, eventDescription,
    startTime, endTime, location,
    organizerId, organizerName,
    meetLink, // If Google Meet link
    deeplink: `/events/${eventId}`,
    // Action buttons
    hasActions: 'true',
    actionAccept: 'accept',
    actionDecline: 'decline',
    actionTentative: 'tentative'
  }
}
```

---

### 3. ❌ EVENT_UPDATED

**Prisma Enum:** ✅ Defined  
**Implementation:** ❌ **NOT IMPLEMENTED**  
**Use Case:** Notify participants when event time/location changes  
**Priority:** 🔴 **HIGH** (critical for calendar sync!)

**Recommended Trigger:**

- `EventsService.updateEvent()` - When event details change
- Google Calendar webhook sync updates

**Suggested Payload:**

```typescript
{
  type: 'EVENT_UPDATED',
  title: 'Event Updated',
  body: '"${eventTitle}" has been updated',
  data: {
    eventId, eventTitle,
    changes: { // What changed
      time: true, location: true, description: false
    },
    newStartTime, newEndTime, newLocation,
    updatedBy, updatedByName,
    deeplink: `/events/${eventId}`
  }
}
```

---

### 4. ❌ MEETING_REMINDER

**Prisma Enum:** ✅ Defined  
**Implementation:** ❌ **NOT IMPLEMENTED**  
**Use Case:** Remind users before meeting starts  
**Priority:** 🔴 **HIGH** (Meeting Scheduler just implemented!)

**Recommended Trigger:**

- Cron job - 15 minutes before meeting start
- Cron job - 1 hour before meeting start

**Suggested Payload:**

```typescript
{
  type: 'MEETING_REMINDER',
  title: 'Meeting Starting Soon',
  body: '"${meetingTitle}" starts in ${timeUntilStart}',
  data: {
    eventId, meetingTitle, meetLink,
    startTime, endTime, participants,
    deeplink: `/events/${eventId}`,
    // Quick actions
    actionJoin: meetLink, // Direct Google Meet link
    actionSnooze: '5' // Snooze 5 minutes
  },
  android: {
    priority: 'high',
    notification: { channelId: 'meeting_reminders' }
  }
}
```

---

### 5. ❌ SYSTEM

**Prisma Enum:** ✅ Defined  
**Implementation:** ❌ **NOT IMPLEMENTED**  
**Use Case:** System-wide announcements, maintenance notices  
**Priority:** 🟢 **LOW**

**Recommended Trigger:**

- Admin panel broadcast
- System maintenance scheduler

**Suggested Payload:**

```typescript
{
  type: 'SYSTEM',
  title: 'System Notification',
  body: '${systemMessage}',
  data: {
    severity: 'info' | 'warning' | 'critical',
    actionUrl, // Optional link
    deeplink: '/settings'
  }
}
```

---

## 🔍 Additional Custom Types (Not in Prisma)

These types are **implemented in code** but **missing from Prisma enum**:

### 1. ⚠️ PROJECT_INVITE

**Status:** Implemented but not in `notification_type` enum  
**Action Required:** Add to Prisma schema

### 2. ⚠️ TASK_COMMENT

**Status:** Implemented but not in `notification_type` enum  
**Action Required:** Add to Prisma schema

### 3. ⚠️ DAILY_SUMMARY

**Status:** Implemented but not in `notification_type` enum  
**Action Required:** Add to Prisma schema

---

## 🎯 Recommendations

### Priority 1: Fix Prisma Schema Mismatch

```prisma
// Update schema.prisma
enum notification_type {
  TASK_ASSIGNED
  TASK_MOVED
  TASK_COMMENT          // ✅ ADD THIS
  PROJECT_INVITE        // ✅ ADD THIS
  TIME_REMINDER
  EVENT_INVITE
  EVENT_UPDATED
  MEETING_REMINDER
  DAILY_SUMMARY         // ✅ ADD THIS
  SYSTEM
}
```

### Priority 2: Add WebSocket to Reminders

Update `sendTaskReminder()` and `sendDailySummary()` to use hybrid routing:

```typescript
// Before (FCM only)
await this.fcmService.sendNotification({ ... });

// After (WebSocket + FCM)
const isOnline = this.notificationsGateway.isUserOnline(userId);
if (isOnline) {
  this.notificationsGateway.emitToUser(userId, 'notification', payload);
  await this.logNotification({ status: 'DELIVERED' });
} else {
  await this.fcmService.sendNotification({ ... });
  await this.logNotification({ status: 'SENT' });
}
```

### Priority 3: Implement Meeting Notifications

Since Meeting Scheduler was just implemented, add these notifications:

1. **MEETING_SCHEDULED** (new custom type)
   - Trigger: `MeetingSchedulerService.createMeetingEvent()`
   - Notify all attendees when meeting is created

2. **MEETING_REMINDER** (Prisma enum exists)
   - Trigger: Cron job 15 min before start
   - Send to all attendees with Google Meet link

### Priority 4: Implement Event Notifications

Complete the calendar integration:

1. **EVENT_INVITE**
   - Trigger: `EventsService.createEvent()` with participants
   - Include RSVP action buttons (Accept/Decline/Tentative)

2. **EVENT_UPDATED**
   - Trigger: `EventsService.updateEvent()`
   - Show what changed (time, location, description)

### Priority 5: Implement TASK_MOVED

Add notification when tasks move between boards/projects:

```typescript
async sendTaskMoved(data: {
  taskId: string;
  taskTitle: string;
  fromLocation: string;
  toLocation: string;
  movedBy: string;
  movedByName: string;
  notifyUserIds: string[];
}): Promise<void> {
  // Implementation similar to sendTaskAssigned
}
```

---

## 📈 Coverage Statistics

| Category              | Implemented | Missing | Coverage |
| --------------------- | ----------- | ------- | -------- |
| **Prisma Enum Types** | 3/7         | 4/7     | 43%      |
| **Custom Types**      | 3/3         | 0/3     | 100%     |
| **Total Types**       | 6/10        | 4/10    | 60%      |
| **WebSocket Routing** | 3/6         | 3/6     | 50%      |

### Breakdown by Feature Area

**✅ Task Management:** TASK_ASSIGNED ✅, TASK_COMMENT ✅, TASK_MOVED ❌, TIME_REMINDER ⚠️  
**✅ Project Management:** PROJECT_INVITE ✅  
**❌ Calendar/Events:** EVENT_INVITE ❌, EVENT_UPDATED ❌, MEETING_REMINDER ❌  
**⚠️ System:** DAILY_SUMMARY ⚠️, SYSTEM ❌

---

## 🛠️ Implementation Checklist

### Immediate Actions (High Priority)

- [ ] **Fix Prisma Schema** - Add missing types (PROJECT_INVITE, TASK_COMMENT, DAILY_SUMMARY)
- [ ] **Add WebSocket to Reminders** - Update sendTaskReminder() and sendDailySummary()
- [ ] **Implement MEETING_REMINDER** - Cron job for meeting notifications
- [ ] **Implement EVENT_INVITE** - Notify when invited to events
- [ ] **Implement EVENT_UPDATED** - Notify when event changes

### Medium Priority

- [ ] **Implement TASK_MOVED** - Notify when task changes location
- [ ] **Add MEETING_SCHEDULED** - Notify when new meeting created via Meeting Scheduler
- [ ] **Test WebSocket Reconnection** - Ensure messages queue during disconnection
- [ ] **Add Notification Preferences** - Let users configure notification types

### Low Priority

- [ ] **Implement SYSTEM Notifications** - Admin broadcast capability
- [ ] **Add Notification Analytics** - Track delivery rates, read rates
- [ ] **WebSocket Performance Monitoring** - Track connection counts, message latency
- [ ] **Batch Notification API** - Send multiple notifications efficiently

---

## 🔗 Related Documentation

- **WebSocket Gateway:** `src/modules/notifications/notifications.gateway.ts`
- **Notifications Service:** `src/modules/notifications/notifications.service.ts`
- **FCM Service:** `src/modules/fcm/fcm.service.ts`
- **Prisma Schema:** `prisma/schema.prisma`
- **Meeting Scheduler:** `docs/MEETING_SCHEDULER_IMPLEMENTATION.md`
- **Calendar Integration:** `docs/CALENDAR_QUICK_SUMMARY.md`

---

## ✅ Conclusion

WebSocket implementation có **foundation tốt** với:

- ✅ JWT authentication
- ✅ Multi-device support
- ✅ Automatic online/offline routing
- ✅ Room-based architecture

**Gaps chính:**

1. ⚠️ Prisma schema mismatch (3 types missing)
2. ❌ Meeting/Event notifications chưa có (4 types)
3. ⚠️ Reminders không dùng WebSocket (2 types)

**Next Steps:**

1. Fix Prisma schema ngay (5 phút)
2. Add WebSocket to reminders (15 phút)
3. Implement meeting notifications (1 giờ)
4. Implement event notifications (1 giờ)

**Estimated Total Time:** ~2.5 giờ để coverage lên 90%+

---

**Report End** 🎉
