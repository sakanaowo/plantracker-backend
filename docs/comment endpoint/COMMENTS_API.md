# Task Comments API Documentation

## 📝 Tổng quan

API này cung cấp các endpoints để quản lý comments (bình luận) trong tasks. 

### ⚠️ Quan trọng về User ID

**Client KHÔNG ĐƯỢC truyền userId trực tiếp trong request body!**

- Khi client gọi Firebase: `String userId = FirebaseAuth.getInstance().getCurrentUser().getUid()` - đây là **Firebase UID**
- Backend tự động:
  1. Verify Firebase token
  2. Tìm user trong database bằng `firebase_uid`
  3. Lấy `database user ID` (UUID) từ bảng `users.id`
  4. Sử dụng ID này cho các operations

**userId được lấy tự động từ authentication token thông qua `@CurrentUser` decorator!**

## 📚 Endpoints

### 1. Lấy tất cả comments của một task

```http
GET /api/tasks/:taskId/comments
Authorization: Bearer {firebase_token}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "taskId": "uuid", 
    "userId": "uuid",
    "body": "Comment content",
    "createdAt": "2025-10-20T15:30:00Z"
  }
]
```

---

### 2. Tạo comment mới

```http
POST /api/tasks/:taskId/comments
Authorization: Bearer {firebase_token}
Content-Type: application/json

{
  "body": "This is my comment"
}
```

**⚡ Lưu ý:**
- ✅ `userId` được lấy TỰ ĐỘNG từ token
- ❌ KHÔNG truyền `userId` trong body
- Backend tự động kiểm tra task có tồn tại không

**Response:**
```json
{
  "id": "uuid",
  "taskId": "uuid",
  "userId": "uuid",  // Tự động từ auth token
  "body": "This is my comment",
  "createdAt": "2025-10-20T15:30:00Z"
}
```

---

### 3. Cập nhật comment

```http
PATCH /api/tasks/comments/:commentId
Authorization: Bearer {firebase_token}
Content-Type: application/json

{
  "body": "Updated comment content"
}
```

**🔒 Bảo mật:**
- Chỉ user TẠO comment mới được phép cập nhật
- Backend tự động kiểm tra `comment.user_id === authenticated_user_id`
- Nếu không phải chủ sở hữu → `403 Forbidden`

**Response:**
```json
{
  "id": "uuid",
  "taskId": "uuid",
  "userId": "uuid",
  "body": "Updated comment content",
  "createdAt": "2025-10-20T15:30:00Z"
}
```

**Error Response (403):**
```json
{
  "statusCode": 403,
  "message": "You can only update your own comments",
  "error": "Forbidden"
}
```

---

### 4. Xóa comment

```http
DELETE /api/tasks/comments/:commentId
Authorization: Bearer {firebase_token}
```

**🔒 Bảo mật:**
- Chỉ user TẠO comment mới được phép xóa
- Backend tự động kiểm tra quyền sở hữu
- Nếu không phải chủ sở hữu → `403 Forbidden`

**Response:**
```json
{
  "id": "uuid",
  "taskId": "uuid",
  "userId": "uuid",
  "body": "Deleted comment",
  "createdAt": "2025-10-20T15:30:00Z"
}
```

**Error Response (403):**
```json
{
  "statusCode": 403,
  "message": "You can only delete your own comments",
  "error": "Forbidden"
}
```

---

## 🔐 Authentication Flow

```
Client (Android/iOS)
    ↓
[1] Login với Firebase Auth
    ↓
[2] Lấy Firebase ID Token
    ↓
[3] Gửi request với header: Authorization: Bearer {token}
    ↓
Backend (NestJS)
    ↓
[4] CombinedAuthGuard verify token
    ↓
[5] Tìm user trong DB: WHERE firebase_uid = {decoded.uid}
    ↓
[6] Lưu database user.id vào req.user
    ↓
[7] Controller nhận userId qua @CurrentUser decorator
    ↓
[8] Service sử dụng database user ID
```

---

## 💾 Database Schema

```sql
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);
```

**Quan hệ:**
- `task_id` → Foreign key đến `tasks.id`
- `user_id` → Foreign key đến `users.id` (DATABASE ID, không phải firebase_uid!)

---

## ✅ Validation Rules

### CreateCommentDto
- `body`: string, required, not empty

### UpdateCommentDto  
- `body`: string, required, not empty

---

## 🧪 Testing với HTTP Client

File: `test-scripts/test-comments.http`

```http
### 1. Get comments
GET http://localhost:3000/api/tasks/{taskId}/comments
Authorization: Bearer {your_firebase_token}

### 2. Create comment
POST http://localhost:3000/api/tasks/{taskId}/comments
Authorization: Bearer {your_firebase_token}
Content-Type: application/json

{
  "body": "Test comment from API"
}

### 3. Update comment
PATCH http://localhost:3000/api/tasks/comments/{commentId}
Authorization: Bearer {your_firebase_token}
Content-Type: application/json

{
  "body": "Updated comment"
}

### 4. Delete comment
DELETE http://localhost:3000/api/tasks/comments/{commentId}
Authorization: Bearer {your_firebase_token}
```

---

## ⚠️ Error Handling

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid UUID format hoặc validation failed |
| 401 | Unauthorized | Token không hợp lệ hoặc thiếu |
| 403 | Forbidden | Không có quyền update/delete comment |
| 404 | Not Found | Task hoặc Comment không tồn tại |
| 500 | Internal Server Error | Lỗi server |

---

## 📱 Example Client Code (Android/Kotlin)

```kotlin
// ✅ ĐÚNG - Backend tự động lấy userId từ token
suspend fun createComment(taskId: String, body: String): Comment {
    val token = FirebaseAuth.getInstance().currentUser?.getIdToken(false)?.await()?.token
    
    val response = apiService.createComment(
        taskId = taskId,
        authorization = "Bearer $token",
        body = CreateCommentRequest(body = body)
    )
    
    return response
}

// ❌ SAI - KHÔNG làm thế này
data class CreateCommentRequest(
    val body: String,
    val userId: String  // ❌ KHÔNG CẦN FIELD NÀY!
)
```

---

## 🎯 Key Points

1. **User ID tự động**: Backend lấy từ authentication token
2. **Firebase UID ≠ Database User ID**: Backend tự động map
3. **Authorization check**: Chỉ owner mới update/delete được comment
4. **Cascade delete**: Xóa task → tự động xóa comments
5. **Ordered by created_at**: Comments được sắp xếp theo thời gian tạo (ascending)

---

## 🔗 Related Endpoints

- Tasks API: `/api/tasks/*`
- Users API: `/api/users/*`
- Authentication: `/api/users/firebase/auth`
