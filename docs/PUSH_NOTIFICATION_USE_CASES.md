# Push Notification Use Cases - PlanTracker

## 📋 Phân tích Schema

Dựa trên schema, hệ thống có các entity chính:
- **Tasks**: Công việc (assignee, watchers, due_at, status, comments, attachments)
- **Events**: Sự kiện/Meeting (participants, start_at, end_at)
- **Projects**: Dự án (members via workspace)
- **Time Entries**: Theo dõi thời gian làm việc
- **Activity Logs**: Lịch sử hoạt động
- **Watchers**: Người theo dõi task

## 🎯 Use Cases Thông Báo Đẩy

### 1️⃣ **TASK-RELATED NOTIFICATIONS**

#### 1.1. Task được gán cho user
**Trigger**: `tasks.assignee_id` được set/update
```typescript
notification_type: TASK_ASSIGNED
priority: NORMAL
channel: PUSH
title: "Bạn được gán task mới"
body: "{creator_name} đã gán task '{task_title}' cho bạn"
data: {
  task_id: "uuid",
  project_id: "uuid",
  board_id: "uuid",
  assigned_by: "uuid"
}
deeplink: "/tasks/{task_id}"
```

**Recipients**: User được gán (assignee_id)

---

#### 1.2. Task sắp đến hạn (Due Date Reminder)
**Trigger**: `tasks.due_at` - 24h/1h/15m trước deadline
```typescript
notification_type: TIME_REMINDER
priority: HIGH
channel: PUSH
title: "Task sắp đến hạn"
body: "'{task_title}' sẽ đến hạn trong {time_remaining}"
data: {
  task_id: "uuid",
  due_at: "2025-10-28T10:00:00Z",
  time_remaining: "1 hour"
}
deeplink: "/tasks/{task_id}"
```

**Recipients**: 
- User được gán (assignee_id)
- Watchers (nếu có)

**Schedule**: 
- 24 giờ trước
- 1 giờ trước
- 15 phút trước

---

#### 1.3. Task quá hạn
**Trigger**: `tasks.due_at` < now() AND status != DONE
```typescript
notification_type: TIME_REMINDER
priority: HIGH
channel: PUSH
title: "Task đã quá hạn"
body: "'{task_title}' đã quá hạn {overdue_time}"
data: {
  task_id: "uuid",
  due_at: "2025-10-27T10:00:00Z",
  overdue_hours: 24
}
deeplink: "/tasks/{task_id}"
```

**Recipients**: 
- User được gán (assignee_id)
- Creator (created_by)

---

#### 1.4. Comment mới trên task
**Trigger**: `task_comments` được tạo
```typescript
notification_type: TASK_UPDATED
priority: NORMAL
channel: PUSH
title: "Bình luận mới"
body: "{commenter_name} đã bình luận: '{comment_preview}'"
data: {
  task_id: "uuid",
  comment_id: "uuid",
  commenter_id: "uuid"
}
deeplink: "/tasks/{task_id}#comment-{comment_id}"
```

**Recipients**:
- Assignee (nếu không phải commenter)
- Creator (nếu không phải commenter)
- Watchers (trừ commenter)
- Người được mention trong comment (nếu có)

---

#### 1.5. Task được mention trong comment
**Trigger**: Comment chứa mention @username
```typescript
notification_type: TASK_UPDATED
priority: NORMAL
channel: PUSH
title: "Bạn được nhắc đến"
body: "{commenter_name} đã nhắc đến bạn trong '{task_title}'"
data: {
  task_id: "uuid",
  comment_id: "uuid",
  mentioned_by: "uuid"
}
deeplink: "/tasks/{task_id}#comment-{comment_id}"
```

**Recipients**: User được mention

---

#### 1.6. Task status thay đổi
**Trigger**: `tasks.status` được update (TO_DO → IN_PROGRESS → DONE)
```typescript
notification_type: TASK_UPDATED
priority: NORMAL
channel: PUSH
title: "Trạng thái task thay đổi"
body: "'{task_title}' đã chuyển sang {new_status}"
data: {
  task_id: "uuid",
  old_status: "IN_PROGRESS",
  new_status: "DONE",
  updated_by: "uuid"
}
deeplink: "/tasks/{task_id}"
```

**Recipients**:
- Creator (nếu không phải người update)
- Watchers (trừ người update)

---

#### 1.7. Task được di chuyển (board khác)
**Trigger**: `tasks.board_id` được update
```typescript
notification_type: TASK_MOVED
priority: NORMAL
channel: PUSH
title: "Task được di chuyển"
body: "{user_name} đã di chuyển '{task_title}' sang {new_board}"
data: {
  task_id: "uuid",
  old_board_id: "uuid",
  new_board_id: "uuid",
  moved_by: "uuid"
}
deeplink: "/tasks/{task_id}"
```

**Recipients**:
- Assignee (nếu không phải người move)
- Watchers (trừ người move)

---

#### 1.8. Attachment mới được thêm
**Trigger**: `attachments` được tạo
```typescript
notification_type: TASK_UPDATED
priority: LOW
channel: PUSH
title: "File đính kèm mới"
body: "{uploader_name} đã thêm file '{filename}' vào '{task_title}'"
data: {
  task_id: "uuid",
  attachment_id: "uuid",
  uploaded_by: "uuid"
}
deeplink: "/tasks/{task_id}/attachments"
```

**Recipients**:
- Assignee (nếu không phải uploader)
- Watchers (trừ uploader)

---

#### 1.9. Checklist item hoàn thành
**Trigger**: `checklist_items.is_done` = true
```typescript
notification_type: TASK_UPDATED
priority: LOW
channel: PUSH
title: "Checklist hoàn thành"
body: "{completed_count}/{total_count} items đã hoàn thành trong '{task_title}'"
data: {
  task_id: "uuid",
  checklist_id: "uuid",
  completed_by: "uuid",
  progress: 75
}
deeplink: "/tasks/{task_id}"
```

**Recipients**:
- Creator (nếu checklist 100% hoàn thành)

---

### 2️⃣ **EVENT/MEETING NOTIFICATIONS**

#### 2.1. Được mời tham gia event
**Trigger**: `participants` được tạo với user_id
```typescript
notification_type: EVENT_INVITE
priority: NORMAL
channel: PUSH
title: "Lời mời sự kiện"
body: "{creator_name} đã mời bạn tham gia '{event_title}'"
data: {
  event_id: "uuid",
  project_id: "uuid",
  start_at: "2025-10-28T14:00:00Z",
  created_by: "uuid"
}
deeplink: "/events/{event_id}"
```

**Recipients**: User trong participants

---

#### 2.2. Event sắp bắt đầu (Meeting Reminder)
**Trigger**: `events.start_at` - 15m/1h trước
```typescript
notification_type: MEETING_REMINDER
priority: HIGH
channel: PUSH
title: "Meeting sắp bắt đầu"
body: "'{event_title}' sẽ bắt đầu trong {time_remaining}"
data: {
  event_id: "uuid",
  start_at: "2025-10-28T14:00:00Z",
  meet_link: "https://meet.google.com/xyz",
  location: "Room A"
}
deeplink: "/events/{event_id}"
actions: [
  { action: "join", label: "Tham gia ngay" },
  { action: "snooze", label: "Nhắc lại sau 5 phút" }
]
```

**Recipients**: Tất cả participants với status != DECLINED

**Schedule**:
- 1 giờ trước
- 15 phút trước
- 5 phút trước (nếu có meet_link)

---

#### 2.3. Event được cập nhật
**Trigger**: `events.start_at`, `events.end_at`, `events.location` thay đổi
```typescript
notification_type: EVENT_UPDATED
priority: NORMAL
channel: PUSH
title: "Sự kiện được cập nhật"
body: "'{event_title}' đã được thay đổi thời gian/địa điểm"
data: {
  event_id: "uuid",
  changes: {
    start_at: { old: "...", new: "..." },
    location: { old: "...", new: "..." }
  },
  updated_by: "uuid"
}
deeplink: "/events/{event_id}"
```

**Recipients**: Tất cả participants

---

#### 2.4. Participant trả lời lời mời
**Trigger**: `participants.status` thay đổi (ACCEPTED/DECLINED)
```typescript
notification_type: EVENT_UPDATED
priority: LOW
channel: PUSH
title: "Phản hồi lời mời"
body: "{participant_name} đã {status} lời mời '{event_title}'"
data: {
  event_id: "uuid",
  participant_id: "uuid",
  response_status: "ACCEPTED"
}
deeplink: "/events/{event_id}"
```

**Recipients**: Event creator (created_by)

---

### 3️⃣ **PROJECT/TEAM COLLABORATION**

#### 3.1. Được thêm vào workspace/project
**Trigger**: `memberships` được tạo
```typescript
notification_type: SYSTEM
priority: NORMAL
channel: PUSH
title: "Thêm vào workspace"
body: "{owner_name} đã thêm bạn vào workspace '{workspace_name}'"
data: {
  workspace_id: "uuid",
  role: "MEMBER",
  added_by: "uuid"
}
deeplink: "/workspaces/{workspace_id}"
```

**Recipients**: User được thêm (user_id trong memberships)

---

#### 3.2. Sprint sắp kết thúc
**Trigger**: `sprints.end_at` - 24h trước
```typescript
notification_type: TIME_REMINDER
priority: NORMAL
channel: PUSH
title: "Sprint sắp kết thúc"
body: "Sprint '{sprint_name}' sẽ kết thúc trong 24 giờ"
data: {
  sprint_id: "uuid",
  project_id: "uuid",
  end_at: "2025-10-29T23:59:59Z",
  incomplete_tasks_count: 5
}
deeplink: "/sprints/{sprint_id}"
```

**Recipients**: Tất cả members của project

---

### 4️⃣ **TIME TRACKING NOTIFICATIONS**

#### 4.1. Quên stop timer
**Trigger**: `time_entries.end_at` = null AND đã chạy > 8h
```typescript
notification_type: TIME_REMINDER
priority: NORMAL
channel: PUSH
title: "Timer đang chạy"
body: "Bạn quên dừng timer cho '{task_title}' ({duration})"
data: {
  time_entry_id: "uuid",
  task_id: "uuid",
  start_at: "2025-10-28T08:00:00Z",
  duration_hours: 9
}
deeplink: "/tasks/{task_id}/time"
actions: [
  { action: "stop", label: "Dừng ngay" }
]
```

**Recipients**: User (user_id trong time_entries)

---

## 📊 Notification Priority Matrix

| Priority | Use Cases | Delivery |
|----------|-----------|----------|
| **HIGH** | - Task quá hạn<br>- Meeting trong 15 phút<br>- Task sắp hết hạn (< 1h) | Ngay lập tức + Sound |
| **NORMAL** | - Task assigned<br>- Comment mới<br>- Event invite<br>- Status changes | Trong 1 phút |
| **LOW** | - Attachment added<br>- Checklist progress<br>- Participant responses | Batch mỗi 5 phút |

---

## 🔔 Notification Channels

### PUSH (Primary)
- Gửi qua FCM/APNS
- Hiển thị trên device notification tray
- Có thể có actions (snooze, join, stop, etc.)

### IN_APP (Secondary)
- Hiển thị trong app notification center
- Badge count
- Real-time updates qua WebSocket

### EMAIL (Fallback)
- Khi user offline > 24h
- Digest notifications (tổng hợp hàng ngày)

---

## 🎯 Notification Grouping Strategy

### Group by Task
```typescript
{
  group_key: "task_{task_id}",
  summary: "5 updates on '{task_title}'",
  notifications: [
    { type: "COMMENT", user: "A" },
    { type: "ASSIGNED", user: "B" },
    { type: "STATUS_CHANGE", user: "C" }
  ]
}
```

### Group by Event
```typescript
{
  group_key: "event_{event_id}",
  summary: "3 updates on '{event_title}'",
  notifications: [
    { type: "PARTICIPANT_ACCEPTED", user: "A" },
    { type: "PARTICIPANT_DECLINED", user: "B" },
    { type: "EVENT_UPDATED", user: "creator" }
  ]
}
```

---

## 📱 User Preferences (Future)

Cho phép user config:
```typescript
{
  task_assigned: { push: true, email: false, in_app: true },
  task_due_reminder: { push: true, email: true, in_app: true },
  task_comments: { push: true, email: false, in_app: true },
  meeting_reminders: { push: true, email: true, in_app: true },
  quiet_hours: { start: "22:00", end: "07:00" },
  do_not_disturb: false
}
```

---

## 🛠️ Implementation Priority

### Phase 1 (MVP) - Critical Notifications
1. ✅ Task Assigned
2. ✅ Task Due Reminder (24h, 1h)
3. ✅ Meeting Reminder (1h, 15m)
4. ✅ Comment Mention

### Phase 2 - Collaboration
5. Task Comments
6. Task Status Changes
7. Event Invites
8. Event Updates

### Phase 3 - Advanced
9. Timer Reminders
10. Sprint Reminders
11. Notification Grouping
12. User Preferences

---

## 📝 Data Structure for `notifications.data`

```typescript
interface NotificationData {
  // Common fields
  entity_type: 'task' | 'event' | 'project' | 'workspace';
  entity_id: string;
  
  // Task-specific
  task_id?: string;
  project_id?: string;
  board_id?: string;
  assignee_id?: string;
  created_by?: string;
  
  // Event-specific
  event_id?: string;
  start_at?: string;
  meet_link?: string;
  location?: string;
  
  // Action-specific
  actor_id: string; // User who triggered the notification
  actor_name: string;
  
  // Additional context
  preview_text?: string; // Comment preview, etc.
  changes?: Record<string, { old: any; new: any }>;
  
  // Metrics
  progress?: number; // Checklist completion %
  overdue_hours?: number;
  time_remaining?: string;
}
```

---

## 🔐 Security & Privacy

1. **Authorization**: Chỉ gửi notification cho users có quyền view entity
2. **Sensitive Data**: Không include sensitive info trong notification body
3. **Workspace Isolation**: Không leak data giữa các workspaces
4. **Device Management**: Tự động xóa inactive devices (> 90 days)

---

## 📈 Metrics to Track

1. **Delivery Rate**: % notifications delivered successfully
2. **Open Rate**: % notifications được mở
3. **Action Rate**: % notifications có action (click, join, etc.)
4. **Opt-out Rate**: % users tắt notification
5. **Response Time**: Time từ trigger → delivery

---

## 🚀 Next Steps

1. Implement FCM service và device registration
2. Tạo notification triggers trong các service (tasks, events, etc.)
3. Build notification queue system
4. Add deeplink routing
5. Implement retry logic cho failed notifications
6. Add notification preferences UI
