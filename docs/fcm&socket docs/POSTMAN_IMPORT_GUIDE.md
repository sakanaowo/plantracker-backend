# Quick Start - Import Postman Collection

## 📥 Bước 1: Import Collection

1. Mở Postman
2. Click **Import** (góc trên bên trái)
3. Kéo thả file hoặc chọn:
   - `PlanTracker_API_Tests.postman_collection.json`
   - `PlanTracker_Development.postman_environment.json`
4. Click **Import**

## ⚙️ Bước 2: Cấu Hình Environment

1. Click **Environments** (icon ⚙️ góc trên bên phải)
2. Chọn **PlanTracker - Development**
3. Điền các biến sau:

### Required Variables

```
authToken:    [Lấy từ API login - xem bước 3]
workspaceId:  [UUID của workspace]
projectId:    [UUID của project]
taskId:       [UUID của task để test]
userId:       [UUID của user hiện tại]
```

### Auto-Generated Variables (Không cần điền)

Các biến sau sẽ tự động được set khi chạy tests:
- `labelId`
- `commentId`
- `commentCursor`
- `attachmentId`
- `uploadUrl`
- `memberId`

## 🔐 Bước 3: Lấy Auth Token

### Option 1: Firebase Auth

```http
POST http://localhost:3000/api/users/firebase/auth
Content-Type: application/json

{
  "firebaseToken": "your-firebase-id-token"
}
```

### Option 2: Local Auth (Đơn giản hơn cho test)

```http
POST http://localhost:3000/api/users/local/signin
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    ...
  }
}
```

**Copy `token` và paste vào `authToken` trong environment**

## 🎯 Bước 4: Lấy IDs Cần Thiết

### Lấy Workspace ID

```http
GET http://localhost:3000/api/workspaces
Authorization: Bearer {{authToken}}
```

Copy `id` từ response → paste vào `workspaceId`

### Lấy Project ID

```http
GET http://localhost:3000/api/projects
Authorization: Bearer {{authToken}}
```

Copy `id` của project bất kỳ → paste vào `projectId`

### Lấy Task ID

```http
GET http://localhost:3000/api/tasks/by-board/{{boardId}}
Authorization: Bearer {{authToken}}
```

Hoặc tạo task mới:
```http
POST http://localhost:3000/api/tasks
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "title": "Test Task for API Testing",
  "board_id": "{{boardId}}"
}
```

Copy `id` từ response → paste vào `taskId`

### Lấy User ID

```http
GET http://localhost:3000/api/users/me
Authorization: Bearer {{authToken}}
```

Copy `id` từ response → paste vào `userId`

## ✅ Bước 5: Chạy Tests

### Test Từng Endpoint

1. Mở collection **PlanTracker API - Complete Tests**
2. Chọn endpoint muốn test
3. Đảm bảo environment **PlanTracker - Development** đã được chọn
4. Click **Send**

### Chạy Toàn Bộ Collection

1. Click vào collection name
2. Click tab **Tests**
3. Click **Run** (hoặc Runner icon)
4. Chọn environment
5. Click **Run PlanTracker API**

## 📋 Test Order (Recommended)

### 1. Labels Flow
```
✅ 1.1 Create Label
✅ 1.2 List Workspace Labels
✅ 1.4 Assign Label to Task
✅ 1.5 Get Task Labels
✅ 1.3 Update Label
✅ 1.6 Remove Label from Task
✅ 1.7 Delete Label
```

### 2. Comments Flow
```
✅ 2.1 Create Comment
✅ 2.2 List Comments (Paginated)
✅ 2.3 Update Comment
✅ 2.4 Delete Comment
```

### 3. Attachments Flow
```
✅ 3.1 Request Upload URL
   → Upload file manually to Supabase URL
✅ 3.2 List Task Attachments
✅ 3.3 Get Attachment View URL
✅ 3.4 Delete Attachment
```

### 4. Project Members Flow (Chỉ TEAM projects)
```
✅ 4.5 Convert to TEAM Project (nếu là PERSONAL)
✅ 4.1 Invite Member
✅ 4.2 List Project Members
✅ 4.3 Update Member Role
✅ 4.4 Remove Member
```

## ⚠️ Important Notes

### Attachments - 2 Steps Required

**Bước 1:** Request upload URL từ backend
```http
POST /tasks/{{taskId}}/attachments/upload-url
```

**Bước 2:** Upload file TRỰC TIẾP lên Supabase (KHÔNG qua backend)
- Copy `uploadUrl` từ response bước 1
- Tạo request mới: `PUT {{uploadUrl}}`
- Body → Binary → Select file
- Headers: `Content-Type: image/png` (hoặc MIME type của file)
- Send

Sau đó file sẽ tự động xuất hiện trong database.

### Project Members - TEAM Only

- Chỉ test được với TEAM projects
- Nếu project là PERSONAL, chạy endpoint **4.5 Convert to TEAM** trước
- User được mời phải TỒN TẠI trong database (không gửi email)

### Environment Variables Auto-Update

Các biến sau tự động update khi chạy tests:
- `labelId` → Sau khi tạo label
- `commentId` → Sau khi tạo comment
- `attachmentId` → Sau khi list attachments
- `memberId` → Sau khi invite member

## 🐛 Troubleshooting

### 401 Unauthorized
- Check `authToken` có đúng không
- Token có thể đã hết hạn → Login lại

### 404 Not Found
- Check các IDs có đúng không
- Resource có tồn tại không

### 403 Forbidden
- User không có quyền truy cập
- Check role (OWNER/ADMIN/MEMBER)

### 400 Bad Request
- Xem response message để biết validation error
- Check request body có đúng format không

## 📚 Full Documentation

Xem chi tiết đầy đủ tại:
- **`POSTMAN_TESTING_GUIDE.md`** - Hướng dẫn chi tiết từng endpoint
- **`IMPLEMENTATION_SUMMARY.md`** - Tài liệu API đầy đủ
- **`QUICK_START.md`** - Hướng dẫn bắt đầu nhanh

## 🎯 Quick Test Commands

```bash
# Start backend server
npm run dev

# Check server running
curl http://localhost:3000/api/health/db

# Login and get token (using curl)
curl -X POST http://localhost:3000/api/users/local/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email","password":"your-password"}'
```

---

**Total Endpoints in Collection:** 27  
**Status:** ✅ Ready to Import  
**Version:** 1.0
