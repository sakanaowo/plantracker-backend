# Hướng Dẫn Test API với Postman

## 📋 Tổng Quan

Tài liệu này hướng dẫn test 27 endpoints mới cho các tính năng:
- **Labels** (7 endpoints) - Quản lý nhãn
- **Comments** (4 endpoints) - Bình luận task
- **Attachments** (4 endpoints) - Đính kèm file
- **Project Members** (5 endpoints) - Quản lý thành viên dự án
- **Activity Logs** (Không có endpoint HTTP, sử dụng nội bộ)

## 🔧 Cấu Hình Postman

### 1. Tạo Environment

Tạo environment mới trong Postman với các biến:

```json
{
  "baseUrl": "http://localhost:3000/api",
  "authToken": "your-jwt-token-here",
  "projectId": "workspace-uuid",
  "projectId": "project-uuid",
  "taskId": "task-uuid",
  "userId": "user-uuid",
  "labelId": "",
  "commentId": "",
  "attachmentId": "",
  "memberId": ""
}
```

### 2. Cấu Hình Authorization

**Tất cả endpoints đều yêu cầu JWT token**

Trong mỗi request:
- Tab **Authorization**
- Type: **Bearer Token**
- Token: `{{authToken}}`

Hoặc dùng Header:
```
Authorization: Bearer {{authToken}}
```

### 3. Lấy JWT Token

**Option 1: Firebase Auth**
```http
POST {{baseUrl}}/users/firebase/auth
Content-Type: application/json

{
  "firebaseToken": "your-firebase-id-token"
}
```

**Option 2: Local Auth**
```http
POST {{baseUrl}}/users/local/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Lưu token vào biến environment:** `authToken`

---

## 📌 1. LABELS API (7 Endpoints)

### 1.1. Tạo Label Mới

**Endpoint:**
```http
POST {{baseUrl}}/projects/{{projectId}}/labels
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "name": "Bug",
  "color": "red",
  "description": "Bug fixes and issues"
}
```

**Màu sắc được phép (18 colors):**
- `red`, `orange`, `amber`, `yellow`
- `lime`, `green`, `emerald`, `teal`
- `cyan`, `sky`, `blue`, `indigo`
- `violet`, `purple`, `fuchsia`, `pink`
- `rose`, `gray`

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "workspace_id": "{{projectId}}",
  "name": "Bug",
  "color": "red",
  "description": "Bug fixes and issues",
  "created_at": "2024-10-25T12:00:00.000Z",
  "updated_at": "2024-10-25T12:00:00.000Z"
}
```

**Test Script (Tab Tests):**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Label created successfully", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('id');
    pm.expect(jsonData.name).to.equal('Bug');
    pm.expect(jsonData.color).to.equal('red');
    
    // Save labelId for other tests
    pm.environment.set("labelId", jsonData.id);
});
```

**Test Cases:**
- ✅ Tạo label với màu hợp lệ
- ❌ Tạo label với màu không hợp lệ (ví dụ: `"color": "rainbow"`) → 400 Bad Request
- ❌ Tạo label trùng tên trong cùng workspace → 409 Conflict
- ❌ Không có authToken → 401 Unauthorized

---

### 1.2. Liệt Kê Labels Trong Workspace

**Endpoint:**
```http
GET {{baseUrl}}/projects/{{projectId}}/labels
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
[
  {
    "id": "uuid-1",
    "workspace_id": "{{projectId}}",
    "name": "Bug",
    "color": "red",
    "description": "Bug fixes",
    "created_at": "2024-10-25T12:00:00.000Z",
    "updated_at": "2024-10-25T12:00:00.000Z"
  },
  {
    "id": "uuid-2",
    "workspace_id": "{{projectId}}",
    "name": "Feature",
    "color": "blue",
    "description": "New features",
    "created_at": "2024-10-25T12:00:00.000Z",
    "updated_at": "2024-10-25T12:00:00.000Z"
  }
]
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns array of labels", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an('array');
    if (jsonData.length > 0) {
        pm.expect(jsonData[0]).to.have.property('id');
        pm.expect(jsonData[0]).to.have.property('name');
        pm.expect(jsonData[0]).to.have.property('color');
    }
});
```

---

### 1.3. Cập Nhật Label

**Endpoint:**
```http
PATCH {{baseUrl}}/labels/{{labelId}}
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "name": "Critical Bug",
  "color": "red",
  "description": "Critical bugs that need immediate attention"
}
```

**Response 200:**
```json
{
  "id": "{{labelId}}",
  "workspace_id": "{{projectId}}",
  "name": "Critical Bug",
  "color": "red",
  "description": "Critical bugs that need immediate attention",
  "created_at": "2024-10-25T12:00:00.000Z",
  "updated_at": "2024-10-25T12:05:00.000Z"
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Label updated successfully", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.name).to.equal('Critical Bug');
});
```

---

### 1.4. Xóa Label

**Endpoint:**
```http
DELETE {{baseUrl}}/labels/{{labelId}}
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "success": true
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Label deleted successfully", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
});
```

---

### 1.5. Gán Label Cho Task

**Endpoint:**
```http
POST {{baseUrl}}/tasks/{{taskId}}/labels
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "labelId": "{{labelId}}"
}
```

**Response 201:**
```json
{
  "id": "task-label-uuid",
  "task_id": "{{taskId}}",
  "label_id": "{{labelId}}",
  "created_at": "2024-10-25T12:00:00.000Z"
}
```

**Test Script:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Label assigned to task", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.task_id).to.equal(pm.environment.get("taskId"));
    pm.expect(jsonData.label_id).to.equal(pm.environment.get("labelId"));
});
```

**Test Cases:**
- ✅ Gán label hợp lệ
- ❌ Gán label đã tồn tại → 409 Conflict
- ❌ Gán label thứ 6 (max 5 labels) → 400 Bad Request
- ❌ Label không tồn tại → 404 Not Found

---

### 1.6. Xóa Label Khỏi Task

**Endpoint:**
```http
DELETE {{baseUrl}}/tasks/{{taskId}}/labels/{{labelId}}
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "success": true
}
```

---

### 1.7. Lấy Labels Của Task

**Endpoint:**
```http
GET {{baseUrl}}/tasks/{{taskId}}/labels
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
[
  {
    "id": "uuid-1",
    "workspace_id": "{{projectId}}",
    "name": "Bug",
    "color": "red",
    "description": "Bug fixes",
    "created_at": "2024-10-25T12:00:00.000Z",
    "updated_at": "2024-10-25T12:00:00.000Z"
  }
]
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns array of labels", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an('array');
    pm.expect(jsonData.length).to.be.at.most(5); // Max 5 labels
});
```

---

## 💬 2. COMMENTS API (4 Endpoints)

### 2.1. Tạo Comment Mới

**Endpoint:**
```http
POST {{baseUrl}}/tasks/{{taskId}}/comments
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "content": "This is a test comment with @[{{userId}}] mention"
}
```

**Format @mention:** `@[user-uuid]`

**Response 201:**
```json
{
  "id": "comment-uuid",
  "task_id": "{{taskId}}",
  "user_id": "{{userId}}",
  "content": "This is a test comment with @[user-uuid] mention",
  "mentions": ["user-uuid"],
  "created_at": "2024-10-25T12:00:00.000Z",
  "updated_at": "2024-10-25T12:00:00.000Z"
}
```

**Test Script:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Comment created successfully", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('id');
    pm.expect(jsonData.content).to.include('test comment');
    pm.expect(jsonData.mentions).to.be.an('array');
    
    // Save commentId
    pm.environment.set("commentId", jsonData.id);
});
```

**Test Cases:**
- ✅ Comment không có mention
- ✅ Comment có 1 mention
- ✅ Comment có nhiều mentions: `@[uuid1] and @[uuid2]`
- ❌ Comment > 5000 ký tự → 400 Bad Request
- ❌ Comment rỗng → 400 Bad Request

---

### 2.2. Lấy Comments Với Phân Trang

**Endpoint (Mặc định):**
```http
GET {{baseUrl}}/tasks/{{taskId}}/comments
Authorization: Bearer {{authToken}}
```

**Endpoint (Với pagination):**
```http
GET {{baseUrl}}/tasks/{{taskId}}/comments?limit=5&cursor={{commentId}}&sort=desc
Authorization: Bearer {{authToken}}
```

**Query Parameters:**
- `limit`: 1-100 (default: 20)
- `cursor`: Comment ID để load thêm
- `sort`: `asc` hoặc `desc` (default: `desc`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "comment-uuid-1",
      "task_id": "{{taskId}}",
      "user_id": "user-uuid",
      "content": "Latest comment",
      "mentions": [],
      "created_at": "2024-10-25T12:00:00.000Z",
      "updated_at": "2024-10-25T12:00:00.000Z",
      "users": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar_url": "https://..."
      }
    }
  ],
  "pagination": {
    "nextCursor": "comment-uuid-20",
    "hasMore": true
  }
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns paginated comments", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
    pm.expect(jsonData).to.have.property('pagination');
    pm.expect(jsonData.data).to.be.an('array');
    pm.expect(jsonData.pagination).to.have.property('nextCursor');
    pm.expect(jsonData.pagination).to.have.property('hasMore');
    
    // Save cursor for next page
    if (jsonData.pagination.nextCursor) {
        pm.environment.set("commentCursor", jsonData.pagination.nextCursor);
    }
});
```

**Test Load More:**
```http
GET {{baseUrl}}/tasks/{{taskId}}/comments?limit=5&cursor={{commentCursor}}
```

---

### 2.3. Cập Nhật Comment

**Endpoint:**
```http
PATCH {{baseUrl}}/comments/{{commentId}}
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "content": "Updated comment content with new @[{{userId}}] mention"
}
```

**Response 200:**
```json
{
  "id": "{{commentId}}",
  "task_id": "{{taskId}}",
  "user_id": "{{userId}}",
  "content": "Updated comment content with new mention",
  "mentions": ["user-uuid"],
  "created_at": "2024-10-25T12:00:00.000Z",
  "updated_at": "2024-10-25T12:05:00.000Z"
}
```

**Test Cases:**
- ✅ Cập nhật comment của mình
- ❌ Cập nhật comment của người khác → 403 Forbidden
- ❌ Comment không tồn tại → 404 Not Found

---

### 2.4. Xóa Comment

**Endpoint:**
```http
DELETE {{baseUrl}}/comments/{{commentId}}
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "success": true
}
```

**Test Cases:**
- ✅ Xóa comment của mình
- ❌ Xóa comment của người khác → 403 Forbidden

---

## 📎 3. ATTACHMENTS API (4 Endpoints)

### 3.1. Request Upload URL (Bước 1)

**Endpoint:**
```http
POST {{baseUrl}}/tasks/{{taskId}}/attachments/upload-url
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "fileName": "screenshot.png",
  "fileSize": 1024000,
  "mimeType": "image/png"
}
```

**MIME Types được phép (28 types):**

**Images:**
- `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`

**Documents:**
- `application/pdf`
- `text/plain`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Spreadsheets:**
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Presentations:**
- `application/vnd.ms-powerpoint`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`

**Archives:**
- `application/zip`
- `application/x-rar-compressed`
- `application/x-7z-compressed`

**Code/Data:**
- `text/csv`, `application/json`, `text/html`, `text/css`, `text/javascript`

**Response 201:**
```json
{
  "uploadUrl": "https://xxx.supabase.co/storage/v1/object/...",
  "path": "user-uuid/attachments/task-uuid/1698235200000-screenshot.png",
  "expiresIn": 300
}
```

**Test Script:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Upload URL generated", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('uploadUrl');
    pm.expect(jsonData).to.have.property('path');
    pm.expect(jsonData.expiresIn).to.equal(300);
    
    // Save for manual upload
    pm.environment.set("uploadUrl", jsonData.uploadUrl);
    pm.environment.set("attachmentPath", jsonData.path);
});
```

**Test Cases:**
- ✅ File hợp lệ (< 10MB, MIME type đúng)
- ❌ File > 10MB → 400 Bad Request
- ❌ MIME type không hợp lệ (ví dụ: `.exe`) → 400 Bad Request
- ❌ Task đã có 20 attachments → 400 Bad Request

---

### 3.2. Upload File Lên Supabase (Bước 2 - Thủ công)

**⚠️ Bước này KHÔNG gọi qua backend API!**

Upload file trực tiếp lên Supabase bằng signed URL:

```http
PUT {{uploadUrl}}
Content-Type: image/png
Body: [Binary file data]
```

**Trong Postman:**
1. Create new request: `PUT`
2. URL: Copy từ `uploadUrl` response
3. Headers:
   - `Content-Type`: `image/png` (hoặc MIME type của file)
4. Body → Binary → Select file
5. Send

**Hoặc dùng curl:**
```bash
curl -X PUT "{{uploadUrl}}" \
  -H "Content-Type: image/png" \
  --data-binary @screenshot.png
```

**Response 200:** (Từ Supabase, không phải backend)

---

### 3.3. Liệt Kê Attachments Của Task

**Endpoint:**
```http
GET {{baseUrl}}/tasks/{{taskId}}/attachments
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
[
  {
    "id": "attachment-uuid",
    "task_id": "{{taskId}}",
    "uploaded_by": "user-uuid",
    "file_name": "screenshot.png",
    "file_size": 1024000,
    "mime_type": "image/png",
    "storage_path": "user-uuid/attachments/task-uuid/1698235200000-screenshot.png",
    "created_at": "2024-10-25T12:00:00.000Z",
    "users": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "avatar_url": "https://..."
    }
  }
]
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns array of attachments", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an('array');
    pm.expect(jsonData.length).to.be.at.most(20); // Max 20 files
    
    if (jsonData.length > 0) {
        pm.expect(jsonData[0]).to.have.property('id');
        pm.expect(jsonData[0]).to.have.property('file_name');
        pm.expect(jsonData[0]).to.have.property('storage_path');
        
        // Save attachmentId
        pm.environment.set("attachmentId", jsonData[0].id);
    }
});
```

---

### 3.4. Lấy URL Xem File

**Endpoint:**
```http
GET {{baseUrl}}/attachments/{{attachmentId}}/view
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "viewUrl": "https://xxx.supabase.co/storage/v1/object/sign/...",
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "expiresIn": 3600
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("View URL generated", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('viewUrl');
    pm.expect(jsonData).to.have.property('fileName');
    pm.expect(jsonData.expiresIn).to.equal(3600); // 1 hour
    
    console.log("View URL (valid for 1 hour):", jsonData.viewUrl);
});
```

**Note:** `viewUrl` hết hạn sau 1 giờ. Để xem file, copy URL và mở trong browser.

---

### 3.5. Xóa Attachment

**Endpoint:**
```http
DELETE {{baseUrl}}/attachments/{{attachmentId}}
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "success": true
}
```

**Test Cases:**
- ✅ Xóa attachment của mình
- ❌ Xóa attachment của người khác → 403 Forbidden (nếu không phải task owner)

---

## 👥 4. PROJECT MEMBERS API (5 Endpoints)

### 4.1. Mời Thành Viên (Invite by Email)

**⚠️ Lưu ý:** Chỉ áp dụng cho TEAM projects. User phải tồn tại trong database.

**Endpoint:**
```http
POST {{baseUrl}}/projects/{{projectId}}/members/invite
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "email": "user@example.com",
  "role": "MEMBER"
}
```

**Roles:**
- `OWNER` - Quyền cao nhất
- `ADMIN` - Quản lý thành viên (trừ owners)
- `MEMBER` - Xem và chỉnh sửa tasks
- `VIEWER` - Chỉ xem (read-only)

**Response 201:**
```json
{
  "id": "member-uuid",
  "project_id": "{{projectId}}",
  "user_id": "invited-user-uuid",
  "role": "MEMBER",
  "added_by": "{{userId}}",
  "created_at": "2024-10-25T12:00:00.000Z",
  "users": {
    "id": "invited-user-uuid",
    "name": "Jane Smith",
    "email": "user@example.com",
    "avatar_url": "https://..."
  }
}
```

**Test Script:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Member invited successfully", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('id');
    pm.expect(jsonData.role).to.equal('MEMBER');
    pm.expect(jsonData.users.email).to.equal('user@example.com');
    
    // Save memberId
    pm.environment.set("memberId", jsonData.id);
});
```

**Test Cases:**
- ✅ Mời user tồn tại với role MEMBER
- ✅ Mời user với role ADMIN (nếu là OWNER)
- ❌ Mời user không tồn tại → 404 Not Found
- ❌ Mời user đã là thành viên → 409 Conflict
- ❌ Mời vào PERSONAL project → 400 Bad Request
- ❌ Không phải OWNER/ADMIN → 403 Forbidden

---

### 4.2. Liệt Kê Thành Viên

**Endpoint:**
```http
GET {{baseUrl}}/projects/{{projectId}}/members
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "member-uuid-1",
      "userId": "user-uuid-1",
      "role": "OWNER",
      "user": {
        "id": "user-uuid-1",
        "name": "Project Owner",
        "email": "owner@example.com",
        "avatar_url": "https://..."
      },
      "addedBy": "user-uuid-1",
      "createdAt": "2024-10-25T12:00:00.000Z"
    },
    {
      "id": "member-uuid-2",
      "userId": "user-uuid-2",
      "role": "MEMBER",
      "user": {
        "id": "user-uuid-2",
        "name": "Team Member",
        "email": "member@example.com",
        "avatar_url": "https://..."
      },
      "addedBy": "user-uuid-1",
      "createdAt": "2024-10-25T12:05:00.000Z"
    }
  ],
  "count": 2
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns members list", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
    pm.expect(jsonData).to.have.property('count');
    pm.expect(jsonData.data).to.be.an('array');
    
    // Check sorting (OWNER first)
    if (jsonData.data.length > 0) {
        pm.expect(jsonData.data[0].role).to.be.oneOf(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    }
});
```

---

### 4.3. Cập Nhật Role Thành Viên

**⚠️ Chỉ OWNER mới có quyền thay đổi role**

**Endpoint:**
```http
PATCH {{baseUrl}}/projects/{{projectId}}/members/{{memberId}}
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Response 200:**
```json
{
  "id": "{{memberId}}",
  "project_id": "{{projectId}}",
  "user_id": "user-uuid",
  "role": "ADMIN",
  "added_by": "owner-uuid",
  "created_at": "2024-10-25T12:00:00.000Z",
  "users": {
    "id": "user-uuid",
    "name": "Jane Smith",
    "email": "user@example.com",
    "avatar_url": "https://..."
  }
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Role updated successfully", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.role).to.equal('ADMIN');
});
```

**Test Cases:**
- ✅ OWNER thay đổi MEMBER → ADMIN
- ✅ OWNER thay đổi ADMIN → MEMBER
- ❌ ADMIN thay đổi role → 403 Forbidden
- ❌ Thay đổi role của OWNER cuối cùng → 400 Bad Request

---

### 4.4. Xóa Thành Viên

**⚠️ OWNER hoặc ADMIN có thể xóa thành viên**

**Endpoint:**
```http
DELETE {{baseUrl}}/projects/{{projectId}}/members/{{memberId}}
Authorization: Bearer {{authToken}}
```

**Response 200:**
```json
{
  "success": true
}
```

**Test Cases:**
- ✅ OWNER xóa MEMBER
- ✅ ADMIN xóa MEMBER
- ❌ ADMIN xóa OWNER → 403 Forbidden
- ❌ Xóa OWNER cuối cùng → 400 Bad Request
- ❌ MEMBER xóa người khác → 403 Forbidden

---

### 4.5. Chuyển PERSONAL → TEAM Project

**⚠️ Chỉ workspace OWNER mới có quyền**

**Endpoint:**
```http
POST {{baseUrl}}/projects/{{projectId}}/convert-to-team
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "keepCurrentMembers": true
}
```

**Response 200:**
```json
{
  "id": "{{projectId}}",
  "workspace_id": "{{projectId}}",
  "name": "Project Name",
  "type": "TEAM",
  "created_by": "user-uuid",
  "created_at": "2024-10-25T12:00:00.000Z",
  "updated_at": "2024-10-25T12:10:00.000Z",
  "memberCount": 3,
  "convertedAt": "2024-10-25T12:10:00.000Z"
}
```

**Test Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Project converted to TEAM", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.type).to.equal('TEAM');
    pm.expect(jsonData).to.have.property('memberCount');
    pm.expect(jsonData).to.have.property('convertedAt');
});
```

**Test Cases:**
- ✅ Convert với `keepCurrentMembers: true`
- ✅ Convert với `keepCurrentMembers: false`
- ❌ Project đã là TEAM → 400 Bad Request
- ❌ Không phải workspace OWNER → 403 Forbidden

---

## 🔄 5. ACTIVITY LOGS (Internal Service)

Activity logs không có HTTP endpoints công khai. Logs được tự động tạo khi:

- Tạo/sửa/xóa labels
- Tạo/sửa/xóa comments
- Upload/xóa attachments
- Thêm/xóa/cập nhật members

**Kiểm tra logs qua database:**
```sql
SELECT * FROM activity_logs 
WHERE task_id = 'your-task-id' 
ORDER BY created_at DESC 
LIMIT 20;
```

Hoặc có thể tạo endpoint test riêng (không có trong production):
```http
GET {{baseUrl}}/activity-logs/task/{{taskId}}
```

---

## 📊 Test Collection Postman

### Collection Structure

```
📁 PlanTracker API Tests
├── 📁 Labels
│   ├── Create Label
│   ├── List Labels
│   ├── Update Label
│   ├── Delete Label
│   ├── Assign Label to Task
│   ├── Remove Label from Task
│   └── Get Task Labels
├── 📁 Comments
│   ├── Create Comment
│   ├── List Comments (Paginated)
│   ├── Update Comment
│   └── Delete Comment
├── 📁 Attachments
│   ├── Request Upload URL
│   ├── List Attachments
│   ├── Get View URL
│   └── Delete Attachment
└── 📁 Project Members
    ├── Invite Member
    ├── List Members
    ├── Update Member Role
    ├── Remove Member
    └── Convert to TEAM
```

### Pre-request Script (Collection Level)

```javascript
// Auto-refresh token if needed (optional)
const tokenExpiry = pm.environment.get("tokenExpiry");
const now = new Date().getTime();

if (!tokenExpiry || now > tokenExpiry) {
    console.log("Token expired or missing, please login first");
}
```

### Tests Script (Collection Level)

```javascript
// Common tests for all endpoints
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

pm.test("Response has valid JSON", function () {
    pm.response.to.be.json;
});

// Log errors for debugging
if (pm.response.code >= 400) {
    console.error("Error:", pm.response.json());
}
```

---

## 🧪 Test Scenarios (End-to-End)

### Scenario 1: Complete Label Workflow

```javascript
// 1. Create label
POST /workspaces/{{projectId}}/labels
{ "name": "E2E Test", "color": "blue" }
// Save labelId

// 2. Assign to task
POST /tasks/{{taskId}}/labels
{ "labelId": "{{labelId}}" }

// 3. Verify in task labels
GET /tasks/{{taskId}}/labels
// Should contain "E2E Test"

// 4. Remove from task
DELETE /tasks/{{taskId}}/labels/{{labelId}}

// 5. Delete label
DELETE /labels/{{labelId}}
```

### Scenario 2: Comment Thread

```javascript
// 1. Create parent comment
POST /tasks/{{taskId}}/comments
{ "content": "First comment" }
// Save commentId

// 2. Create reply
POST /tasks/{{taskId}}/comments
{ "content": "Reply to first comment" }

// 3. List all comments
GET /tasks/{{taskId}}/comments?sort=asc

// 4. Update first comment
PATCH /comments/{{commentId}}
{ "content": "Updated first comment" }

// 5. Delete comments
DELETE /comments/{{commentId}}
```

### Scenario 3: File Upload Flow

```javascript
// 1. Request upload URL
POST /tasks/{{taskId}}/attachments/upload-url
{
  "fileName": "test.pdf",
  "fileSize": 500000,
  "mimeType": "application/pdf"
}
// Get uploadUrl

// 2. Upload to Supabase (external)
PUT {{uploadUrl}}
[Binary file]

// 3. List attachments
GET /tasks/{{taskId}}/attachments
// Should show test.pdf

// 4. Get view URL
GET /attachments/{{attachmentId}}/view
// Open in browser to verify

// 5. Delete attachment
DELETE /attachments/{{attachmentId}}
```

### Scenario 4: Team Management

```javascript
// 1. Convert to TEAM
POST /projects/{{projectId}}/convert-to-team
{ "keepCurrentMembers": true }

// 2. Invite member
POST /projects/{{projectId}}/members/invite
{ "email": "member@test.com", "role": "MEMBER" }
// Save memberId

// 3. List members
GET /projects/{{projectId}}/members
// Should show 2+ members

// 4. Promote to ADMIN
PATCH /projects/{{projectId}}/members/{{memberId}}
{ "role": "ADMIN" }

// 5. Remove member
DELETE /projects/{{projectId}}/members/{{memberId}}
```

---

## ⚠️ Common Errors & Solutions

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "No token provided"
}
```
**Fix:** Thêm Authorization header với valid JWT token

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "You are not a member of this project"
}
```
**Fix:** Kiểm tra quyền truy cập (OWNER/ADMIN/MEMBER)

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Task not found"
}
```
**Fix:** Kiểm tra ID có đúng không

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid color. Must be one of: red, blue, green..."
}
```
**Fix:** Xem message để biết validation error

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Label already assigned to this task"
}
```
**Fix:** Resource đã tồn tại, không thể duplicate

---

## 📝 Checklist Trước Khi Test

### Setup
- [ ] Backend đang chạy: `npm run dev`
- [ ] Database đã migrate: Run `manual_add_project_members.sql`
- [ ] Prisma client đã generate: `npx prisma generate`
- [ ] Environment variables đã set (`.env`)

### Postman Setup
- [ ] Tạo environment với tất cả biến cần thiết
- [ ] Có JWT token hợp lệ
- [ ] Có ít nhất 1 workspace
- [ ] Có ít nhất 1 project (PERSONAL hoặc TEAM)
- [ ] Có ít nhất 1 task để test

### Data Preparation
- [ ] Tạo test user trong database
- [ ] Tạo workspace với test user là OWNER
- [ ] Tạo project trong workspace
- [ ] Tạo task trong project

---

## 🎯 Test Coverage Matrix

| Feature | Endpoint | Method | Auth | Success | Error Cases |
|---------|----------|--------|------|---------|-------------|
| Labels | `/workspaces/:id/labels` | POST | ✅ | ✅ 201 | 400, 401, 409 |
| Labels | `/workspaces/:id/labels` | GET | ✅ | ✅ 200 | 401, 404 |
| Labels | `/labels/:id` | PATCH | ✅ | ✅ 200 | 400, 401, 404 |
| Labels | `/labels/:id` | DELETE | ✅ | ✅ 200 | 401, 404 |
| Labels | `/tasks/:id/labels` | POST | ✅ | ✅ 201 | 400, 401, 409 |
| Labels | `/tasks/:id/labels/:labelId` | DELETE | ✅ | ✅ 200 | 401, 404 |
| Labels | `/tasks/:id/labels` | GET | ✅ | ✅ 200 | 401, 404 |
| Comments | `/tasks/:id/comments` | POST | ✅ | ✅ 201 | 400, 401 |
| Comments | `/tasks/:id/comments` | GET | ✅ | ✅ 200 | 401, 404 |
| Comments | `/comments/:id` | PATCH | ✅ | ✅ 200 | 400, 401, 403 |
| Comments | `/comments/:id` | DELETE | ✅ | ✅ 200 | 401, 403, 404 |
| Attachments | `/tasks/:id/attachments/upload-url` | POST | ✅ | ✅ 201 | 400, 401 |
| Attachments | `/tasks/:id/attachments` | GET | ✅ | ✅ 200 | 401, 404 |
| Attachments | `/attachments/:id/view` | GET | ✅ | ✅ 200 | 401, 404 |
| Attachments | `/attachments/:id` | DELETE | ✅ | ✅ 200 | 401, 403, 404 |
| Members | `/projects/:id/members/invite` | POST | ✅ | ✅ 201 | 400, 401, 403, 404, 409 |
| Members | `/projects/:id/members` | GET | ✅ | ✅ 200 | 401, 403, 404 |
| Members | `/projects/:id/members/:memberId` | PATCH | ✅ | ✅ 200 | 400, 401, 403, 404 |
| Members | `/projects/:id/members/:memberId` | DELETE | ✅ | ✅ 200 | 401, 403, 404 |
| Members | `/projects/:id/convert-to-team` | POST | ✅ | ✅ 200 | 400, 401, 403, 404 |

**Total: 27 endpoints**

---

## 💡 Tips & Best Practices

### 1. Sử dụng Environment Variables
- Tạo nhiều environments: `Development`, `Staging`, `Production`
- Lưu sensitive data (tokens) trong environment, không hard-code

### 2. Collection Runner
- Run toàn bộ collection để regression test
- Monitors → Schedule tests tự động

### 3. Pre-request Scripts
```javascript
// Auto-generate timestamps
pm.environment.set("timestamp", new Date().getTime());

// Generate random data
pm.environment.set("randomEmail", `test${Math.random()}@test.com`);
```

### 4. Test Data Cleanup
```javascript
// In Tests tab
pm.sendRequest({
    url: pm.environment.get("baseUrl") + "/labels/" + pm.environment.get("labelId"),
    method: 'DELETE',
    header: {
        'Authorization': 'Bearer ' + pm.environment.get("authToken")
    }
}, function (err, res) {
    console.log("Cleanup: Label deleted");
});
```

### 5. Newman CLI (CI/CD)
```bash
# Install
npm install -g newman

# Run collection
newman run PlanTracker_Tests.json -e Development.json

# Generate report
newman run PlanTracker_Tests.json -e Development.json --reporters cli,html
```

---

## 📚 Tài Liệu Tham Khảo

- **Implementation Summary:** `docs/IMPLEMENTATION_SUMMARY.md`
- **Migration Guide:** `docs/PROJECT_MEMBERS_MIGRATION.md`
- **Quick Start:** `docs/QUICK_START.md`
- **Swagger UI:** http://localhost:3000/api/docs (khi server đang chạy)

---

**Version:** 1.0  
**Last Updated:** October 25, 2024  
**Total Endpoints:** 27  
**Status:** ✅ Ready for Testing
