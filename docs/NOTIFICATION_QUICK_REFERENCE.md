# 🚀 NOTIFICATION SYSTEM - QUICK REFERENCE

## 📊 Tổng Quan Use Cases

### Real-time Notifications (Trigger ngay khi action xảy ra)

| Use Case | Priority | Trigger Point | Recipients |
|----------|----------|---------------|------------|
| **TASK_ASSIGNED** | 🔴 HIGH | TasksService.create() / update() | Assignee |
| **TASK_COMMENTED** | 🟡 NORMAL | TasksService.createComment() | Assignee + Creator + Watchers |
| **TASK_MENTION** | 🔴 HIGH | TasksService.createComment() (detect @) | Mentioned users |
| **TASK_MOVED** | 🟡 NORMAL | TasksService.move() | Assignee + Watchers |
| **EVENT_INVITE** | 🔴 HIGH | EventsService.addParticipants() | Invitees |

### Scheduled Notifications (Qua Worker Jobs)

| Use Case | Schedule | Trigger Point | Recipients |
|----------|----------|---------------|------------|
| **TIME_REMINDER** | Daily 8AM | Tasks due in 24h | Assignees |
| **OVERDUE_REMINDER** | Daily 9AM | Overdue tasks | Assignees |
| **MEETING_REMINDER** | Every 5 min | Events in 15 min | Participants |
| **DAILY_SUMMARY** | Daily 6PM | Active users | All users with tasks |

---

## 🔧 Implementation Checklist

### Phase 1: Schema Update ✅
```bash
# 1. Update prisma/schema.prisma - Add new notification types
# 2. Run migration
npx prisma migrate dev --name add_notification_types
npx prisma generate
```

### Phase 2: NotificationsService Methods

```typescript
// Add to src/modules/notifications/notifications.service.ts

✅ sendTaskAssigned(data)      // TASK_ASSIGNED
✅ sendTaskCommented(data)     // TASK_COMMENTED  
✅ sendTaskMention(data)       // TASK_MENTION
✅ sendTaskMoved(data)         // TASK_MOVED
✅ sendEventInvite(data)       // EVENT_INVITE
✅ sendMeetingReminder(data)   // MEETING_REMINDER
```

### Phase 3: Service Integration

```typescript
// TasksService - Add notification triggers
create()         → sendTaskAssigned() if assigneeId
update()         → sendTaskAssigned() if assigneeId changed
createComment()  → sendTaskCommented() + sendTaskMention()
move()           → sendTaskMoved() if board changed

// EventsService - Add notification triggers  
addParticipants() → sendEventInvite()

// WorkerService - Add new job
sendMeetingReminders() → sendMeetingReminder()
```

### Phase 4: Module Dependencies

```typescript
// tasks.module.ts
imports: [NotificationsModule] ✅

// events.module.ts (create if not exist)
imports: [NotificationsModule] ✅

// notifications.module.ts
exports: [NotificationsService] ✅
```

---

## 📝 Code Snippets

### 1. Inject NotificationsService vào TasksService

```typescript
// src/modules/tasks/tasks.service.ts
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService, // ← Add
  ) {}
}
```

### 2. Trigger Notification trong create()

```typescript
// Trong TasksService.create()
if (dto.assigneeId && dto.assigneeId !== dto.createdBy) {
  await this.notificationsService.sendTaskAssigned({
    taskId: task.id,
    taskTitle: task.title,
    projectName: task.projects.name,
    assigneeId: dto.assigneeId,
    assignedBy: dto.createdBy || 'system',
    assignedByName: task.users_tasks_created_byTousers?.name || 'Hệ thống',
  });
}
```

### 3. Detect Mentions trong Comment

```typescript
// Trong TasksService.createComment()
import { MentionDetector } from '../../common/utils/mention-detector';

const mentions = MentionDetector.extractAllMentions(body);
if (mentions.userIds.length > 0) {
  await this.notificationsService.sendTaskMention({
    // ... data
    mentionedUserIds: mentions.userIds,
  });
}
```

### 4. Add Worker Endpoint

```typescript
// src/modules/worker/worker.controller.ts
@Post('meeting-reminders')
@HttpCode(HttpStatus.OK)
async sendMeetingReminders(@Headers('authorization') authHeader: string) {
  if (!this.validateWorkerToken(authHeader)) {
    throw new UnauthorizedException('Invalid worker token');
  }
  return await this.workerService.sendMeetingReminders();
}
```

---

## 🧪 Testing Commands

### Manual Testing

```bash
# Test task assigned
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "uuid",
    "boardId": "uuid",
    "title": "Test notification",
    "assigneeId": "other-user-uuid"
  }'

# Test comment
curl -X POST http://localhost:3000/api/tasks/TASK_ID/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Test comment with @mention"}'

# Test worker job
curl -X POST http://localhost:3000/api/worker/meeting-reminders \
  -H "Authorization: Bearer WORKER_SECRET"
```

### Check Logs

```bash
# Watch notification logs
tail -f logs/app.log | grep -i notification

# Check database
npx prisma studio
# Navigate to notifications table
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Module not found
```
Error: Nest can't resolve dependencies of TasksService
```

**Solution:**
```typescript
// Ensure NotificationsModule is imported in TasksModule
@Module({
  imports: [PrismaModule, NotificationsModule], // ← Add this
  // ...
})
export class TasksModule {}
```

### Issue 2: Circular dependency
```
Error: Circular dependency between modules
```

**Solution:**
```typescript
// Use forwardRef if needed
@Module({
  imports: [forwardRef(() => NotificationsModule)],
  // ...
})
```

### Issue 3: FCM token not found
```
Warn: User has no active FCM token
```

**Solution:**
- Check user_devices table has is_active = true
- Verify FCM token is still valid
- User might need to re-login on mobile app

### Issue 4: Notification not received
```
Notification sent but not received on device
```

**Solution:**
1. Check FCM channel ID exists in Android app
2. Verify notification permission granted
3. Check Firebase console for errors
4. Test with Firebase Console test message

---

## 📊 Database Queries

### Check recent notifications
```sql
SELECT 
  n.type,
  n.title,
  n.body,
  n.status,
  n.created_at,
  u.name as user_name,
  u.email
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;
```

### Check user's unread notifications
```sql
SELECT 
  type,
  title,
  body,
  created_at
FROM notifications
WHERE user_id = 'USER_UUID'
  AND read_at IS NULL
ORDER BY created_at DESC;
```

### Notification delivery stats
```sql
SELECT 
  type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
  COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read,
  ROUND(AVG(EXTRACT(EPOCH FROM (read_at - sent_at)))) as avg_read_time_seconds
FROM notifications
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY type;
```

---

## 🎯 Implementation Priority

### Week 1 - Critical (Must Have)
- [x] Schema migration
- [ ] TASK_ASSIGNED notification
- [ ] TASK_COMMENTED notification
- [ ] Integration in TasksService
- [ ] Module dependencies setup
- [ ] Basic testing

### Week 2 - Important (Should Have)
- [ ] TASK_MENTION detection & notification
- [ ] TASK_MOVED notification
- [ ] EVENT_INVITE notification
- [ ] EventsService creation
- [ ] Comprehensive testing

### Week 3 - Enhancement (Nice to Have)
- [ ] MEETING_REMINDER worker
- [ ] Cron job setup
- [ ] Analytics dashboard
- [ ] Performance optimization
- [ ] Full integration testing

---

## 📞 Need Help?

### Documentation
- Full implementation: `docs/NOTIFICATION_IMPLEMENTATION_PLAN.md`
- FCM setup: `docs/FCM_BACKEND_SETUP.md`
- Worker setup: `docs/RENDER_CRON_WORKER_FCM_SETUP.md`

### Quick Start
```bash
# 1. Update schema
code prisma/schema.prisma
# Add new notification types to enum

# 2. Migrate
npx prisma migrate dev --name add_notification_types

# 3. Implement services
code src/modules/notifications/notifications.service.ts
# Copy methods from implementation plan

# 4. Integrate
code src/modules/tasks/tasks.service.ts
# Add notification triggers

# 5. Test
npm run start:dev
# Test with Postman/curl
```

---

**Last Updated:** October 21, 2025  
**Quick Reference Version:** 1.0
