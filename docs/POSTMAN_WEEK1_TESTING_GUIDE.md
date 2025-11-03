# 📮 POSTMAN TESTING GUIDE - WEEK 1 FEATURES

**Collection**: PlanTracker Week 1 Critical Features  
**Base URL**: `http://localhost:3000/api`  
**Auth**: Bearer Token (get from login)

---

## 🔐 AUTHENTICATION (Setup First)

### **Get Bearer Token**:

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "yourpassword"
}

# Response:
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "user": { ... }
}

# Copy accessToken and set as Bearer Token in Postman
```

---

## 👥 TEAM MEMBERS API (Feature #7)

### **1. Invite Member**
```http
POST /api/projects/{{projectId}}/members/invite
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "email": "newmember@example.com",
  "role": "MEMBER"
}

# Roles: OWNER, ADMIN, MEMBER, VIEWER
```

**Expected Response** (201):
```json
{
  "id": "uuid",
  "userId": "uuid",
  "role": "MEMBER",
  "user": {
    "id": "uuid",
    "name": "New Member",
    "email": "newmember@example.com",
    "avatarUrl": "https://..."
  },
  "addedBy": "uuid",
  "createdAt": "2025-10-29T..."
}
```

---

### **2. List Project Members**
```http
GET /api/projects/{{projectId}}/members
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "role": "OWNER",
      "user": {
        "id": "uuid",
        "name": "Project Owner",
        "email": "owner@example.com",
        "avatarUrl": "https://..."
      },
      "addedBy": null,
      "createdAt": "2025-10-29T..."
    }
  ],
  "count": 3
}
```

---

### **3. Update Member Role**
```http
PATCH /api/projects/{{projectId}}/members/{{memberId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Expected Response** (200):
```json
{
  "id": "uuid",
  "userId": "uuid",
  "role": "ADMIN",
  "user": { ... },
  "createdAt": "2025-10-29T..."
}
```

---

### **4. Remove Member**
```http
DELETE /api/projects/{{projectId}}/members/{{memberId}}
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "success": true
}
```

---

## 💬 COMMENTS API (Feature #8)

### **1. Create Comment**
```http
POST /api/tasks/{{taskId}}/comments
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "body": "This task looks good! @[userId] please review."
}
```

**Expected Response** (201):
```json
{
  "id": "uuid",
  "taskId": "uuid",
  "userId": "uuid",
  "body": "This task looks good! @[userId] please review.",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "avatarUrl": "https://..."
  },
  "createdAt": "2025-10-29T..."
}
```

---

### **2. List Task Comments**
```http
GET /api/tasks/{{taskId}}/comments?limit=20&sort=desc
Authorization: Bearer {{token}}
```

**Query Params**:
- `limit`: Number of comments (default 20)
- `sort`: `asc` or `desc` (default desc)
- `cursor`: For pagination (optional)

**Expected Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "taskId": "uuid",
      "userId": "uuid",
      "body": "Comment text here",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "avatarUrl": "https://..."
      },
      "createdAt": "2025-10-29T..."
    }
  ],
  "pagination": {
    "nextCursor": "uuid",
    "hasMore": false
  }
}
```

---

### **3. Update Comment**
```http
PATCH /api/comments/{{commentId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "body": "Updated comment text"
}
```

**Expected Response** (200):
```json
{
  "id": "uuid",
  "body": "Updated comment text",
  "user": { ... },
  "createdAt": "2025-10-29T...",
  "updatedAt": "2025-10-29T..."
}
```

---

### **4. Delete Comment**
```http
DELETE /api/comments/{{commentId}}
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "success": true,
  "deletedId": "uuid"
}
```

---

## 📎 ATTACHMENTS API (Feature #9)

### **1. Request Upload URL** (Step 1)
```http
POST /api/tasks/{{taskId}}/attachments/upload-url
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "size": 1024000
}
```

**Expected Response** (201):
```json
{
  "attachmentId": "uuid",
  "uploadUrl": "https://storage.googleapis.com/...",
  "token": "upload-token",
  "expiresIn": 3600
}
```

---

### **2. Upload File** (Step 2 - Client Side)
```http
PUT {{uploadUrl}}
Content-Type: image/png
Body: <binary file data>
```

**Note**: Use the `uploadUrl` from step 1. This is done by the client app (Android/Web).

---

### **3. List Task Attachments**
```http
GET /api/tasks/{{taskId}}/attachments
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
[
  {
    "id": "uuid",
    "taskId": "uuid",
    "url": "storage-path",
    "mimeType": "image/png",
    "size": 1024000,
    "uploadedBy": "uuid",
    "createdAt": "2025-10-29T..."
  }
]
```

---

### **4. Get View URL**
```http
GET /api/attachments/{{attachmentId}}/view
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "viewUrl": "https://storage.googleapis.com/signed-url",
  "expiresIn": 3600
}
```

---

### **5. Delete Attachment**
```http
DELETE /api/attachments/{{attachmentId}}
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "success": true
}
```

---

## 🏷️ LABELS API (Feature #10)

### **1. Create Label**
```http
POST /api/projects/{{projectId}}/labels
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Bug",
  "color": "#FF6B6B"
}
```

**Expected Response** (201):
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "name": "Bug",
  "color": "#FF6B6B",
  "createdAt": "2025-10-29T..."
}
```

**Valid Colors** (20 predefined):
```
#FF6B6B, #4ECDC4, #45B7D1, #FFA07A, #98D8C8,
#F7DC6F, #BB8FCE, #85C1E2, #F8B4D9, #52B788,
#FFD93D, #6BCF7F, #95E1D3, #F38181, #AA96DA,
#FCBAD3, #A8D8EA, #FFAAA5, #FFD3B6, #DCEDC1
```

---

### **2. List Project Labels**
```http
GET /api/projects/{{projectId}}/labels
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Bug",
    "color": "#FF6B6B",
    "taskCount": 5,
    "createdAt": "2025-10-29T...",
    "updatedAt": "2025-10-29T..."
  }
]
```

---

### **3. Update Label**
```http
PATCH /api/labels/{{labelId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Critical Bug",
  "color": "#F38181"
}
```

**Expected Response** (200):
```json
{
  "id": "uuid",
  "name": "Critical Bug",
  "color": "#F38181",
  "updatedAt": "2025-10-29T..."
}
```

---

### **4. Delete Label**
```http
DELETE /api/labels/{{labelId}}
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "success": true,
  "removedFromTasks": 5
}
```

---

### **5. Assign Label to Task**
```http
POST /api/tasks/{{taskId}}/labels
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "labelId": "uuid"
}
```

**Expected Response** (200):
```json
{
  "success": true,
  "label": {
    "id": "uuid",
    "name": "Bug",
    "color": "#FF6B6B"
  }
}
```

---

### **6. Get Task Labels**
```http
GET /api/tasks/{{taskId}}/labels
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
[
  {
    "id": "uuid",
    "name": "Bug",
    "color": "#FF6B6B"
  },
  {
    "id": "uuid",
    "name": "High Priority",
    "color": "#F38181"
  }
]
```

---

### **7. Remove Label from Task**
```http
DELETE /api/tasks/{{taskId}}/labels/{{labelId}}
Authorization: Bearer {{token}}
```

**Expected Response** (200):
```json
{
  "success": true
}
```

---

## 🧪 TESTING WORKFLOW

### **1. Setup** (One time):
```bash
1. Login → Get Bearer token
2. Create workspace
3. Create project (TEAM type for member features)
4. Create board
5. Create task
```

### **2. Test Team Members**:
```bash
1. Invite member by email
2. List members (verify shows)
3. Update role to ADMIN
4. Try remove (verify can't remove last owner)
5. Add another owner
6. Remove member
```

### **3. Test Comments**:
```bash
1. Create comment on task
2. List comments (verify shows)
3. Update comment text
4. Delete comment
5. Verify pagination works with limit
```

### **4. Test Attachments**:
```bash
1. Request upload URL
2. Upload file to signed URL (use Postman or cURL)
3. List attachments (verify shows)
4. Get view URL
5. Open view URL in browser (verify works)
6. Delete attachment
```

### **5. Test Labels**:
```bash
1. Create 3-4 labels with different colors
2. List labels (verify all show)
3. Assign label to task
4. Get task labels (verify assigned)
5. Assign another label (max 10)
6. Remove label from task
7. Delete label (verify removed from tasks)
```

---

## 🐛 COMMON ERRORS

### **401 Unauthorized**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Fix**: Add valid Bearer token in Authorization header

---

### **403 Forbidden**:
```json
{
  "statusCode": 403,
  "message": "You are not a member of this project"
}
```
**Fix**: Ensure you have project/workspace membership

---

### **404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Task not found"
}
```
**Fix**: Verify ID is correct

---

### **409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Label already assigned to this task"
}
```
**Fix**: Check existing data

---

### **400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "File size must be between 1 byte and 10485760 bytes (10 MB)"
}
```
**Fix**: Validate input data

---

## 📊 POSTMAN ENVIRONMENT VARIABLES

```json
{
  "baseUrl": "http://localhost:3000/api",
  "token": "YOUR_BEARER_TOKEN",
  "workspaceId": "uuid",
  "projectId": "uuid",
  "taskId": "uuid",
  "memberId": "uuid",
  "commentId": "uuid",
  "attachmentId": "uuid",
  "labelId": "uuid"
}
```

---

## ✅ TESTING CHECKLIST

### **Team Members**:
- [ ] Invite member ✅
- [ ] List members ✅
- [ ] Update role ✅
- [ ] Remove member ✅
- [ ] Verify notifications sent ✅

### **Comments**:
- [ ] Create comment ✅
- [ ] List comments ✅
- [ ] Update comment ✅
- [ ] Delete comment ✅
- [ ] Test pagination ✅

### **Attachments**:
- [ ] Request upload URL ✅
- [ ] Upload file ✅
- [ ] List attachments ✅
- [ ] Get view URL ✅
- [ ] Delete attachment ✅

### **Labels**:
- [ ] Create label ✅
- [ ] List labels ✅
- [ ] Update label ✅
- [ ] Assign to task ✅
- [ ] Get task labels ✅
- [ ] Remove from task ✅
- [ ] Delete label ✅

---

**Status**: ✅ All APIs tested and working  
**Date**: 29/10/2025  
**Ready for**: Frontend integration 🚀
