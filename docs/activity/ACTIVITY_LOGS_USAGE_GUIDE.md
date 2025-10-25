# 📝 ACTIVITY LOGS - USAGE GUIDE & COMMON USE CASES

## 🎯 MỤC ĐÍCH

Activity logs giúp track tất cả các hành động trong hệ thống để:
- 📊 **Audit trail** - Biết ai làm gì, khi nào
- 🔍 **Debugging** - Trace lại các thay đổi khi có bug
- 📈 **Analytics** - Phân tích user behavior
- 🔔 **Real-time updates** - Trigger notifications
- ⏮️ **Undo/Redo** - Có thể restore từ old_value

---

## 📊 SCHEMA OVERVIEW

```prisma
model activity_logs {
  id                  String          @id
  workspace_id        String?         // Context: Workspace
  project_id          String?         // Context: Project
  board_id            String?         // Context: Board
  task_id             String?         // Context: Task
  checklist_item_id   String?         // Context: Checklist Item
  user_id             String          // WHO did the action
  action              activity_action // WHAT action (CREATED, UPDATED, etc.)
  entity_type         entity_type     // WHAT entity (TASK, BOARD, etc.)
  entity_id           String?         // Which specific entity
  entity_name         String?         // Entity name for quick display
  old_value           Json?           // Value before change
  new_value           Json?           // Value after change
  metadata            Json?           // Additional context
  created_at          DateTime        // WHEN
}
```

---

## 📋 COMMON USE CASES

### **1️⃣ CHECKLIST ITEM - CREATE**

#### **Kịch bản:** User tạo checklist item mới trong task

```typescript
// Service: TaskChecklistService.create()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    checklist_item_id: checklistItem.id,
    user_id: currentUserId,
    action: 'CREATED',
    entity_type: 'TASK_CHECKLIST_ITEM',
    entity_id: checklistItem.id,
    entity_name: checklistItem.content.substring(0, 100), // Preview
    new_value: {
      content: checklistItem.content,
      is_done: false,
    },
    metadata: {
      task_title: task.title,
      created_via: 'web', // or 'mobile', 'api'
    },
  },
});
```

**Activity feed hiển thị:**
> 👤 **John Doe** created checklist item "Buy groceries" in task **"Weekly Planning"**
> 🕐 2 minutes ago

---

### **2️⃣ CHECKLIST ITEM - TOGGLE CHECKED/UNCHECKED**

#### **Kịch bản:** User check/uncheck checklist item

```typescript
// Service: TaskChecklistService.toggle()

const action = checklistItem.is_done ? 'UNCHECKED' : 'CHECKED';

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    checklist_item_id: checklistItem.id,
    user_id: currentUserId,
    action: action,
    entity_type: 'TASK_CHECKLIST_ITEM',
    entity_id: checklistItem.id,
    entity_name: checklistItem.content.substring(0, 100),
    old_value: {
      is_done: !checklistItem.is_done,
    },
    new_value: {
      is_done: checklistItem.is_done,
    },
    metadata: {
      task_title: task.title,
      completion_percentage: calculateCompletionPercentage(task.id),
    },
  },
});
```

**Activity feed hiển thị:**
> ✅ **Jane Smith** checked "Buy groceries" in **"Weekly Planning"**
> 🕐 5 minutes ago

---

### **3️⃣ CHECKLIST ITEM - UPDATE CONTENT**

#### **Kịch bản:** User sửa nội dung checklist item

```typescript
// Service: TaskChecklistService.update()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    checklist_item_id: checklistItem.id,
    user_id: currentUserId,
    action: 'UPDATED',
    entity_type: 'TASK_CHECKLIST_ITEM',
    entity_id: checklistItem.id,
    entity_name: newContent.substring(0, 100),
    old_value: {
      content: oldContent,
    },
    new_value: {
      content: newContent,
    },
    metadata: {
      task_title: task.title,
      changed_fields: ['content'],
    },
  },
});
```

**Activity feed hiển thị:**
> 📝 **John Doe** updated checklist item from "Buy groceries" to "Buy organic groceries"
> 🕐 10 minutes ago

---

### **4️⃣ CHECKLIST ITEM - DELETE**

#### **Kịch bản:** User xóa checklist item

```typescript
// Service: TaskChecklistService.delete()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    checklist_item_id: checklistItem.id,
    user_id: currentUserId,
    action: 'DELETED',
    entity_type: 'TASK_CHECKLIST_ITEM',
    entity_id: checklistItem.id,
    entity_name: checklistItem.content.substring(0, 100),
    old_value: {
      content: checklistItem.content,
      is_done: checklistItem.is_done,
    },
    metadata: {
      task_title: task.title,
      can_restore: true, // Flag để show "Undo" button
    },
  },
});
```

**Activity feed hiển thị:**
> 🗑️ **Jane Smith** deleted checklist item "Buy groceries"
> 🕐 15 minutes ago • [Undo]

---

### **5️⃣ TASK - ASSIGN TO USER**

#### **Kịch bản:** User assign task cho người khác

```typescript
// Service: TasksService.update()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    user_id: currentUserId,
    action: 'ASSIGNED',
    entity_type: 'TASK',
    entity_id: task.id,
    entity_name: task.title,
    old_value: oldAssignee ? {
      assignee_id: oldAssignee.id,
      assignee_name: oldAssignee.name,
    } : null,
    new_value: {
      assignee_id: newAssignee.id,
      assignee_name: newAssignee.name,
    },
    metadata: {
      notification_sent: true,
      assigned_via: 'drag_and_drop', // or 'task_detail', 'bulk_assign'
    },
  },
});
```

**Activity feed hiển thị:**
> 👥 **John Doe** assigned **"Weekly Planning"** to **Jane Smith**
> 🕐 20 minutes ago

---

### **6️⃣ TASK - MOVE TO ANOTHER BOARD**

#### **Kịch bản:** User move task từ board này sang board khác

```typescript
// Service: TasksService.move()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: newBoardId, // Board mới
    task_id: task.id,
    user_id: currentUserId,
    action: 'MOVED',
    entity_type: 'TASK',
    entity_id: task.id,
    entity_name: task.title,
    old_value: {
      board_id: oldBoardId,
      board_name: oldBoard.name,
      position: oldPosition,
    },
    new_value: {
      board_id: newBoardId,
      board_name: newBoard.name,
      position: newPosition,
    },
    metadata: {
      drag_and_drop: true,
      from_status: oldBoard.name,
      to_status: newBoard.name,
    },
  },
});
```

**Activity feed hiển thị:**
> 🔀 **Jane Smith** moved **"Weekly Planning"** from **To Do** to **In Progress**
> 🕐 25 minutes ago

---

### **7️⃣ TASK - ADD COMMENT**

#### **Kịch bản:** User thêm comment vào task

```typescript
// Service: TaskCommentsService.create()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    user_id: currentUserId,
    action: 'COMMENTED',
    entity_type: 'COMMENT',
    entity_id: comment.id,
    entity_name: comment.body.substring(0, 100), // Preview
    new_value: {
      body: comment.body,
      mentions: extractMentions(comment.body), // @john, @jane
    },
    metadata: {
      task_title: task.title,
      has_mentions: extractMentions(comment.body).length > 0,
      comment_length: comment.body.length,
    },
  },
});
```

**Activity feed hiển thị:**
> 💬 **John Doe** commented on **"Weekly Planning"**: "Great progress! @jane"
> 🕐 30 minutes ago

---

### **8️⃣ TASK - ADD ATTACHMENT**

#### **Kịch bản:** User upload file vào task

```typescript
// Service: AttachmentsService.create()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    user_id: currentUserId,
    action: 'ATTACHED',
    entity_type: 'ATTACHMENT',
    entity_id: attachment.id,
    entity_name: getFileName(attachment.url),
    new_value: {
      url: attachment.url,
      mime_type: attachment.mime_type,
      size: attachment.size,
    },
    metadata: {
      task_title: task.title,
      file_type: attachment.mime_type,
      file_size_mb: (attachment.size / 1024 / 1024).toFixed(2),
    },
  },
});
```

**Activity feed hiển thị:**
> 📎 **Jane Smith** attached **"meeting-notes.pdf"** (2.5 MB) to **"Weekly Planning"**
> 🕐 35 minutes ago

---

### **9️⃣ TASK - CHANGE PRIORITY**

#### **Kịch bản:** User thay đổi priority của task

```typescript
// Service: TasksService.update()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: task.id,
    user_id: currentUserId,
    action: 'UPDATED',
    entity_type: 'TASK',
    entity_id: task.id,
    entity_name: task.title,
    old_value: {
      priority: oldPriority, // 'LOW'
    },
    new_value: {
      priority: newPriority, // 'HIGH'
    },
    metadata: {
      changed_fields: ['priority'],
      priority_icon: getPriorityIcon(newPriority),
    },
  },
});
```

**Activity feed hiển thị:**
> ⚡ **John Doe** changed priority of **"Weekly Planning"** from **Low** to **High**
> 🕐 40 minutes ago

---

### **🔟 TASK - DUPLICATE**

#### **Kịch bản:** User duplicate task

```typescript
// Service: TasksService.duplicate()

await prisma.activity_logs.create({
  data: {
    workspace_id: task.project.workspace_id,
    project_id: task.project_id,
    board_id: task.board_id,
    task_id: newTask.id,
    user_id: currentUserId,
    action: 'DUPLICATED',
    entity_type: 'TASK',
    entity_id: newTask.id,
    entity_name: newTask.title,
    old_value: {
      original_task_id: originalTask.id,
      original_task_title: originalTask.title,
    },
    new_value: {
      duplicated_task_id: newTask.id,
      duplicated_task_title: newTask.title,
      checklist_items_count: checklistItemsCount,
      attachments_count: attachmentsCount,
    },
    metadata: {
      duplicate_options: {
        include_checklist: true,
        include_attachments: true,
        include_comments: false,
      },
    },
  },
});
```

**Activity feed hiển thị:**
> 📋 **Jane Smith** duplicated **"Weekly Planning"** → **"Weekly Planning (Copy)"**
> 🕐 45 minutes ago

---

## 📊 QUERY EXAMPLES

### **1. Get Activity Feed cho Task**

```typescript
// Get all activities for a specific task
const activities = await prisma.activity_logs.findMany({
  where: {
    task_id: taskId,
  },
  include: {
    users: {
      select: {
        id: true,
        name: true,
        avatar_url: true,
      },
    },
  },
  orderBy: {
    created_at: 'desc',
  },
  take: 50,
});
```

### **2. Get Checklist Activity Feed**

```typescript
// Get all checklist activities for a task
const checklistActivities = await prisma.activity_logs.findMany({
  where: {
    task_id: taskId,
    entity_type: 'TASK_CHECKLIST_ITEM',
  },
  include: {
    users: {
      select: {
        name: true,
        avatar_url: true,
      },
    },
  },
  orderBy: {
    created_at: 'desc',
  },
});
```

### **3. Get User Activity Summary**

```typescript
// Get activity summary for a user (last 7 days)
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const userStats = await prisma.activity_logs.groupBy({
  by: ['action', 'entity_type'],
  where: {
    user_id: userId,
    created_at: {
      gte: sevenDaysAgo,
    },
  },
  _count: true,
});

// Result:
// [
//   { action: 'CREATED', entity_type: 'TASK', _count: 5 },
//   { action: 'CHECKED', entity_type: 'TASK_CHECKLIST_ITEM', _count: 12 },
//   { action: 'COMMENTED', entity_type: 'COMMENT', _count: 8 },
// ]
```

### **4. Get Project Activity Timeline**

```typescript
// Get recent activity in project
const projectTimeline = await prisma.activity_logs.findMany({
  where: {
    project_id: projectId,
  },
  include: {
    users: {
      select: {
        name: true,
        avatar_url: true,
      },
    },
    tasks: {
      select: {
        title: true,
      },
    },
  },
  orderBy: {
    created_at: 'desc',
  },
  take: 100,
});
```

### **5. Find Changes to Specific Field**

```typescript
// Find all priority changes in last month
const priorityChanges = await prisma.activity_logs.findMany({
  where: {
    project_id: projectId,
    action: 'UPDATED',
    entity_type: 'TASK',
    metadata: {
      path: ['changed_fields'],
      array_contains: ['priority'],
    },
    created_at: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
});
```

---

## 🎨 FRONTEND DISPLAY TEMPLATES

### **Activity Item Component**

```typescript
function formatActivityMessage(activity: ActivityLog): string {
  const templates = {
    CREATED: {
      TASK_CHECKLIST_ITEM: (a) => 
        `created checklist item "${a.entity_name}"`,
      TASK: (a) => 
        `created task "${a.entity_name}"`,
    },
    CHECKED: {
      TASK_CHECKLIST_ITEM: (a) => 
        `checked "${a.entity_name}"`,
    },
    UNCHECKED: {
      TASK_CHECKLIST_ITEM: (a) => 
        `unchecked "${a.entity_name}"`,
    },
    MOVED: {
      TASK: (a) => 
        `moved "${a.entity_name}" from ${a.old_value.board_name} to ${a.new_value.board_name}`,
    },
    ASSIGNED: {
      TASK: (a) => 
        `assigned "${a.entity_name}" to ${a.new_value.assignee_name}`,
    },
    // ... more templates
  };
  
  const template = templates[activity.action]?.[activity.entity_type];
  return template ? template(activity) : 'performed an action';
}
```

---

## 🔔 TRIGGER NOTIFICATIONS FROM ACTIVITY LOGS

### **Example: Notify on Assignment**

```typescript
// After creating activity log for ASSIGNED action
if (activity.action === 'ASSIGNED') {
  await notificationsService.sendTaskAssigned({
    taskId: activity.task_id,
    taskTitle: activity.entity_name,
    assigneeId: activity.new_value.assignee_id,
    assignedBy: activity.user_id,
    assignedByName: activity.users.name,
    projectName: activity.projects.name,
  });
}
```

---

## 📈 ANALYTICS QUERIES

### **1. Most Active Users**

```typescript
const mostActiveUsers = await prisma.activity_logs.groupBy({
  by: ['user_id'],
  where: {
    workspace_id: workspaceId,
    created_at: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    },
  },
  _count: true,
  orderBy: {
    _count: {
      user_id: 'desc',
    },
  },
  take: 10,
});
```

### **2. Checklist Completion Rate**

```typescript
const checklistStats = await prisma.$queryRaw`
  SELECT 
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE action = 'CHECKED') as checked_count,
    COUNT(*) FILTER (WHERE action = 'UNCHECKED') as unchecked_count
  FROM activity_logs
  WHERE entity_type = 'TASK_CHECKLIST_ITEM'
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at)
  ORDER BY date DESC
`;
```

---

## ✅ BEST PRACTICES

### **1. Always Include Context**

```typescript
// ✅ GOOD - Full context
{
  workspace_id: '...',
  project_id: '...',
  board_id: '...',
  task_id: '...',
}

// ❌ BAD - Missing context
{
  task_id: '...',
}
```

### **2. Store Meaningful Entity Names**

```typescript
// ✅ GOOD - Truncate long content
entity_name: checklistItem.content.substring(0, 100)

// ❌ BAD - Too long
entity_name: checklistItem.content // Could be 5000+ chars
```

### **3. Use Metadata for Additional Info**

```typescript
// ✅ GOOD - Rich metadata
metadata: {
  task_title: task.title,
  completion_percentage: 75,
  created_via: 'mobile',
  trigger: 'drag_and_drop',
}

// ❌ BAD - No context
metadata: {}
```

### **4. Cleanup Old Logs**

```typescript
// Run monthly cleanup job
async function cleanupOldActivityLogs() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  await prisma.activity_logs.deleteMany({
    where: {
      created_at: {
        lt: sixMonthsAgo,
      },
      // Keep important actions
      action: {
        notIn: ['CREATED', 'DELETED'],
      },
    },
  });
}
```

---

## 🎯 SUMMARY

**Activity logs phải track:**
- ✅ Checklist items (create, check, uncheck, update, delete)
- ✅ Task changes (assign, move, update, duplicate)
- ✅ Comments
- ✅ Attachments
- ✅ Priority/status changes
- ✅ Labels
- ✅ Time tracking
- ✅ Watchers

**Sử dụng activity logs để:**
- 📊 Hiển thị activity feed
- 🔔 Trigger notifications
- 📈 Analytics & reporting
- ⏮️ Undo/Redo features
- 🔍 Audit trail
