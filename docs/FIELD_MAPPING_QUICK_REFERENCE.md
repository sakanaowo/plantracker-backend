# 📊 QUICK REFERENCE: FIELD MAPPING SNAKE_CASE → CAMELCASE

**Quick lookup table cho Backend developers**

---

## 🎯 COMMON FIELDS (All Entities)

| ❌ Database (snake_case) | ✅ API Response (camelCase) | Type          | Notes       |
| ------------------------ | --------------------------- | ------------- | ----------- |
| `id`                     | `id`                        | UUID          | Unchanged   |
| `created_at`             | `createdAt`                 | ISO 8601      | Timestamp   |
| `updated_at`             | `updatedAt`                 | ISO 8601      | Timestamp   |
| `deleted_at`             | `deletedAt`                 | ISO 8601/null | Soft delete |

---

## 📋 TASKS

| ❌ Database              | ✅ API                 | Type          | Required |
| ------------------------ | ---------------------- | ------------- | -------- |
| `project_id`             | `projectId`            | UUID          | ✅       |
| `board_id`               | `boardId`              | UUID          | ✅       |
| `assignee_id`            | `assigneeId`           | UUID/null     | ❌       |
| `created_by`             | `createdBy`            | UUID/null     | ❌       |
| `due_at`                 | `dueAt`                | ISO 8601/null | ❌       |
| `start_at`               | `startAt`              | ISO 8601/null | ❌       |
| `issue_key`              | `issueKey`             | string/null   | ❌       |
| `sprint_id`              | `sprintId`             | UUID/null     | ❌       |
| `epic_id`                | `epicId`               | UUID/null     | ❌       |
| `parent_task_id`         | `parentTaskId`         | UUID/null     | ❌       |
| `story_points`           | `storyPoints`          | number/null   | ❌       |
| `original_estimate_sec`  | `originalEstimateSec`  | number/null   | ❌       |
| `remaining_estimate_sec` | `remainingEstimateSec` | number/null   | ❌       |

---

## 📊 BOARDS

| ❌ Database  | ✅ API      | Type | Required |
| ------------ | ----------- | ---- | -------- |
| `project_id` | `projectId` | UUID | ✅       |

---

## 📁 PROJECTS

| ❌ Database    | ✅ API        | Type | Required |
| -------------- | ------------- | ---- | -------- |
| `workspace_id` | `workspaceId` | UUID | ✅       |
| `owner_id`     | `ownerId`     | UUID | ✅       |

---

## 🏢 WORKSPACES

| ❌ Database   | ✅ API       | Type    | Required |
| ------------- | ------------ | ------- | -------- |
| `owner_id`    | `ownerId`    | UUID    | ✅       |
| `is_personal` | `isPersonal` | boolean | ✅       |

---

## 👥 MEMBERSHIPS

| ❌ Database    | ✅ API        | Type | Required |
| -------------- | ------------- | ---- | -------- |
| `user_id`      | `userId`      | UUID | ✅       |
| `workspace_id` | `workspaceId` | UUID | ✅       |

---

## ⏱️ TIME_ENTRIES (Timers)

| ❌ Database    | ✅ API        | Type          | Required |
| -------------- | ------------- | ------------- | -------- |
| `task_id`      | `taskId`      | UUID          | ✅       |
| `user_id`      | `userId`      | UUID          | ✅       |
| `start_at`     | `startAt`     | ISO 8601      | ✅       |
| `end_at`       | `endAt`       | ISO 8601/null | ❌       |
| `duration_sec` | `durationSec` | number/null   | ❌       |

---

## 👤 USERS

| ❌ Database    | ✅ API        | Type        | Required |
| -------------- | ------------- | ----------- | -------- |
| `firebase_uid` | `firebaseUid` | string/null | ❌       |
| `display_name` | `displayName` | string      | ✅       |
| `photo_url`    | `photoUrl`    | string/null | ❌       |

---

## 📎 ATTACHMENTS

| ❌ Database   | ✅ API       | Type        | Required |
| ------------- | ------------ | ----------- | -------- |
| `task_id`     | `taskId`     | UUID        | ✅       |
| `mime_type`   | `mimeType`   | string/null | ❌       |
| `uploaded_by` | `uploadedBy` | UUID/null   | ❌       |

---

## ✅ CHECKLIST_ITEMS

| ❌ Database    | ✅ API        | Type    | Required |
| -------------- | ------------- | ------- | -------- |
| `checklist_id` | `checklistId` | UUID    | ✅       |
| `is_done`      | `isDone`      | boolean | ✅       |

---

## 💬 TASK_COMMENTS

| ❌ Database | ✅ API   | Type | Required |
| ----------- | -------- | ---- | -------- |
| `task_id`   | `taskId` | UUID | ✅       |
| `user_id`   | `userId` | UUID | ✅       |

---

## 🏷️ TASK_LABELS

| ❌ Database | ✅ API    | Type | Required |
| ----------- | --------- | ---- | -------- |
| `task_id`   | `taskId`  | UUID | ✅       |
| `label_id`  | `labelId` | UUID | ✅       |

---

## 🏃 SPRINTS

| ❌ Database  | ✅ API      | Type          | Required |
| ------------ | ----------- | ------------- | -------- |
| `project_id` | `projectId` | UUID          | ✅       |
| `start_date` | `startDate` | ISO 8601/null | ❌       |
| `end_date`   | `endDate`   | ISO 8601/null | ❌       |

---

## 📅 EVENTS

| ❌ Database    | ✅ API        | Type      | Required |
| -------------- | ------------- | --------- | -------- |
| `task_id`      | `taskId`      | UUID/null | ❌       |
| `workspace_id` | `workspaceId` | UUID      | ✅       |
| `created_by`   | `createdBy`   | UUID      | ✅       |
| `start_time`   | `startTime`   | ISO 8601  | ✅       |
| `end_time`     | `endTime`     | ISO 8601  | ✅       |
| `all_day`      | `allDay`      | boolean   | ✅       |

---

## 🔗 EXTERNAL_EVENTS

| ❌ Database         | ✅ API            | Type          | Required |
| ------------------- | ----------------- | ------------- | -------- |
| `event_id`          | `eventId`         | UUID          | ✅       |
| `provider_event_id` | `providerEventId` | string        | ✅       |
| `html_link`         | `htmlLink`        | string/null   | ❌       |
| `last_synced_at`    | `lastSyncedAt`    | ISO 8601/null | ❌       |

---

## 🔐 INTEGRATION_TOKENS

| ❌ Database        | ✅ API           | Type          | Required |
| ------------------ | ---------------- | ------------- | -------- |
| `user_id`          | `userId`         | UUID          | ✅       |
| `account_email`    | `accountEmail`   | string/null   | ❌       |
| `external_user_id` | `externalUserId` | string/null   | ❌       |
| `access_token`     | `accessToken`    | string        | ✅       |
| `refresh_token`    | `refreshToken`   | string/null   | ❌       |
| `token_type`       | `tokenType`      | string/null   | ❌       |
| `expires_at`       | `expiresAt`      | ISO 8601/null | ❌       |

---

## 📱 USER_DEVICES

| ❌ Database      | ✅ API         | Type          | Required |
| ---------------- | -------------- | ------------- | -------- |
| `user_id`        | `userId`       | UUID          | ✅       |
| `fcm_token`      | `fcmToken`     | string        | ✅       |
| `device_model`   | `deviceModel`  | string/null   | ❌       |
| `app_version`    | `appVersion`   | string/null   | ❌       |
| `is_active`      | `isActive`     | boolean       | ✅       |
| `last_active_at` | `lastActiveAt` | ISO 8601/null | ❌       |

---

## 🔔 NOTIFICATIONS

| ❌ Database    | ✅ API        | Type          | Required |
| -------------- | ------------- | ------------- | -------- |
| `user_id`      | `userId`      | UUID          | ✅       |
| `scheduled_at` | `scheduledAt` | ISO 8601/null | ❌       |
| `sent_at`      | `sentAt`      | ISO 8601/null | ❌       |
| `delivered_at` | `deliveredAt` | ISO 8601/null | ❌       |
| `read_at`      | `readAt`      | ISO 8601/null | ❌       |
| `ttl_sec`      | `ttlSec`      | number/null   | ❌       |
| `retry_count`  | `retryCount`  | number        | ✅       |
| `last_error`   | `lastError`   | string/null   | ❌       |
| `created_by`   | `createdBy`   | UUID/null     | ❌       |

---

## 🔗 ISSUE_LINKS

| ❌ Database      | ✅ API         | Type | Required |
| ---------------- | -------------- | ---- | -------- |
| `source_task_id` | `sourceTaskId` | UUID | ✅       |
| `target_task_id` | `targetTaskId` | UUID | ✅       |
| `link_type`      | `linkType`     | enum | ✅       |

---

## 👁️ WATCHERS

| ❌ Database | ✅ API   | Type | Required |
| ----------- | -------- | ---- | -------- |
| `task_id`   | `taskId` | UUID | ✅       |
| `user_id`   | `userId` | UUID | ✅       |

---

## 📈 TRANSFORMATION RULES

### Pattern:

```
snake_case → camelCase
-----------------------
user_id    → userId
created_at → createdAt
is_active  → isActive
html_link  → htmlLink
fcm_token  → fcmToken
```

### Algorithm:

```javascript
// Replace underscore + lowercase letter with uppercase letter
snake_case.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
```

### Examples:

```
project_id              → projectId
original_estimate_sec   → originalEstimateSec
last_active_at          → lastActiveAt
provider_event_id       → providerEventId
```

---

## 🧪 TESTING

### Quick Test (PowerShell):

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/tasks/by-board/YOUR_BOARD_ID" -Headers @{"Authorization"="Bearer TOKEN"}
$response | ConvertTo-Json

# Check if response contains camelCase fields:
# ✅ projectId, boardId, createdAt, updatedAt
# ❌ project_id, board_id, created_at, updated_at
```

### Quick Test (cURL):

```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/tasks/by-board/YOUR_BOARD_ID \
  | jq '.[0] | keys'

# Expected output: ["assigneeId", "boardId", "createdAt", "id", "projectId", ...]
# NOT: ["assignee_id", "board_id", "created_at", "id", "project_id", ...]
```

---

## ✅ CHECKLIST

### Before starting server:

- [x] TransformInterceptor created
- [x] Registered in main.ts
- [ ] All DTOs reviewed for camelCase

### After starting server:

- [ ] Console shows: "✅ All API responses transformed to camelCase"
- [ ] Test GET endpoints (arrays)
- [ ] Test POST endpoints (single object)
- [ ] Test PATCH endpoints (updates)
- [ ] Verify nested objects
- [ ] Verify null values

---

**Print this and keep it handy when developing!** 📌

---

**Version:** 1.0.0  
**Last Updated:** October 15, 2025  
**Status:** ✅ Reference Ready
