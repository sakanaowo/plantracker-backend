# HƯỚNG DẪN TRIỂN KHAI USECASES - PHASE 3
**Ngày tạo:** 14/10/2025  
**Người thực hiện:** Merge từ 2 nhánh + Bổ sung thêm

---

## ✅ TỔNG QUAN NHỮNG GÌ ĐÃ HOÀN THÀNH

### **Phase 3: Domain Layer - UseCases (100%)**

Đã tạo xong **48 UseCases** cho 7 modules:

| Module | Số UseCase | Trạng thái | Ghi chú |
|--------|-----------|-----------|---------|
| **Workspace** | 5 | ✅ Hoàn thành | Từ merge người 1 |
| **Project** | 6 | ✅ Hoàn thành | Từ merge người 1 |
| **Task** | 15 | ✅ Hoàn thành | Từ merge người 2 |
| **Board** | 6 | ✅ Hoàn thành | Mới tạo |
| **Notification** | 8 | ✅ Hoàn thành | Mới tạo |
| **Label** | 5 | ✅ Hoàn thành | Mới tạo |
| **Auth** | 4 | ✅ Hoàn thành | Mới tạo (bao gồm IAuthRepository) |

---

## 📁 CẤU TRÚC THỦ MỤC USECASES

```
domain/usecase/
├── auth/                           # Authentication UseCases (4)
│   ├── LoginUseCase.java
│   ├── LogoutUseCase.java
│   ├── GetCurrentUserUseCase.java
│   └── IsLoggedInUseCase.java
│
├── workspace/                      # Workspace UseCases (5)
│   ├── GetWorkspacesUseCase.java
│   ├── GetWorkspaceByIdUseCase.java
│   ├── CreateWorkspaceUseCase.java
│   ├── GetWorkspaceProjectsUseCase.java
│   └── GetWorkspaceBoardsUseCase.java
│
├── project/                        # Project UseCases (6)
│   ├── GetProjectByIdUseCase.java
│   ├── CreateProjectUseCase.java
│   ├── UpdateProjectUseCase.java
│   ├── DeleteProjectUseCase.java
│   ├── SwitchBoardTypeUseCase.java
│   └── UpdateProjectKeyUseCase.java
│
├── board/                          # Board UseCases (6)
│   ├── GetBoardByIdUseCase.java
│   ├── CreateBoardUseCase.java
│   ├── UpdateBoardUseCase.java
│   ├── DeleteBoardUseCase.java
│   ├── ReorderBoardsUseCase.java
│   └── GetBoardTasksUseCase.java
│
├── task/                           # Task UseCases (15)
│   ├── CreateTaskUseCase.java
│   ├── GetTaskByIdUseCase.java
│   ├── GetTasksByBoardUseCase.java
│   ├── UpdateTaskUseCase.java
│   ├── DeleteTaskUseCase.java
│   ├── AssignTaskUseCase.java
│   ├── UnassignTaskUseCase.java
│   ├── MoveTaskToBoardUseCase.java
│   ├── UpdateTaskPositionUseCase.java
│   ├── AddCommentUseCase.java
│   ├── GetTaskCommentsUseCase.java
│   ├── AddAttachmentUseCase.java
│   ├── GetTaskAttachmentsUseCase.java
│   ├── AddChecklistUseCase.java
│   └── GetTaskChecklistsUseCase.java
│
├── notification/                   # Notification UseCases (8)
│   ├── GetNotificationsUseCase.java
│   ├── GetUnreadNotificationsUseCase.java
│   ├── GetNotificationByIdUseCase.java
│   ├── MarkAsReadUseCase.java
│   ├── MarkAllAsReadUseCase.java
│   ├── DeleteNotificationUseCase.java
│   ├── DeleteAllNotificationsUseCase.java
│   └── GetNotificationCountUseCase.java
│
└── label/                          # Label UseCases (5)
    ├── GetLabelsByWorkspaceUseCase.java
    ├── GetLabelByIdUseCase.java
    ├── CreateLabelUseCase.java
    ├── UpdateLabelUseCase.java
    └── DeleteLabelUseCase.java
```

---

## 🔍 CHI TIẾT CÁC USECASES MỚI TẠO

### **1. NOTIFICATION USECASES (8 classes)**

#### **GetNotificationsUseCase**
- **Chức năng:** Lấy tất cả notifications của user
- **Input:** None
- **Output:** `List<Notification>`
- **Business Logic:** Lấy tất cả (read + unread), sorted by created date

#### **GetUnreadNotificationsUseCase**
- **Chức năng:** Lấy chỉ notifications chưa đọc
- **Input:** None
- **Output:** `List<Notification>`
- **Business Logic:** Dùng cho notification badge count

#### **GetNotificationByIdUseCase**
- **Chức năng:** Lấy chi tiết 1 notification
- **Input:** `String notificationId`
- **Output:** `Notification`
- **Validation:** UUID format

#### **MarkAsReadUseCase**
- **Chức năng:** Đánh dấu 1 notification đã đọc
- **Input:** `String notificationId`
- **Output:** `Void`
- **Business Logic:** Update read_at timestamp

#### **MarkAllAsReadUseCase**
- **Chức năng:** Đánh dấu tất cả đã đọc
- **Input:** None
- **Output:** `Void`
- **Business Logic:** Batch operation

#### **DeleteNotificationUseCase**
- **Chức năng:** Xóa 1 notification
- **Input:** `String notificationId`
- **Output:** `Void`
- **Use case:** Swipe to dismiss

#### **DeleteAllNotificationsUseCase**
- **Chức năng:** Xóa tất cả notifications
- **Input:** None
- **Output:** `Void`
- **Use case:** Clear all button

#### **GetNotificationCountUseCase**
- **Chức năng:** Lấy số lượng unread
- **Input:** None
- **Output:** `Integer`
- **Business Logic:** Lightweight, dùng cho badge

---

### **2. BOARD USECASES (6 classes)**

#### **GetBoardByIdUseCase**
- **Chức năng:** Lấy chi tiết 1 board
- **Input:** `String boardId`
- **Output:** `Board`
- **Validation:** UUID format

#### **CreateBoardUseCase**
- **Chức năng:** Tạo board mới trong project
- **Input:** `String projectId`, `Board board`
- **Output:** `Board`
- **Validation:** 
  - Board name not empty
  - Name max 100 chars
  - Project ID valid UUID

#### **UpdateBoardUseCase**
- **Chức năng:** Cập nhật board
- **Input:** `String boardId`, `Board board`
- **Output:** `Board`
- **Validation:** Name and order optional

#### **DeleteBoardUseCase**
- **Chức năng:** Xóa board
- **Input:** `String boardId`
- **Output:** `Void`
- **Business Logic:** Cascade delete tasks

#### **ReorderBoardsUseCase**
- **Chức năng:** Sắp xếp lại thứ tự boards
- **Input:** `String projectId`, `List<String> boardIds`
- **Output:** `Void`
- **Use case:** Drag-and-drop reordering
- **Validation:** All board IDs must be valid UUIDs

#### **GetBoardTasksUseCase**
- **Chức năng:** Lấy tất cả tasks trong board
- **Input:** `String boardId`
- **Output:** `List<Task>`
- **Business Logic:** Sorted by position
- **Use case:** Hiển thị Kanban board view

---

### **3. LABEL USECASES (5 classes)**

#### **GetLabelsByWorkspaceUseCase**
- **Chức năng:** Lấy tất cả labels của workspace
- **Input:** `String workspaceId`
- **Output:** `List<Label>`
- **Use case:** Label picker trong task editor

#### **GetLabelByIdUseCase**
- **Chức năng:** Lấy chi tiết 1 label
- **Input:** `String labelId`
- **Output:** `Label`
- **Validation:** UUID format

#### **CreateLabelUseCase**
- **Chức năng:** Tạo label mới
- **Input:** `String workspaceId`, `Label label`
- **Output:** `Label`
- **Validation:**
  - Name: not empty, max 50 chars
  - Color: hex format (#RRGGBB or #RGB)

#### **UpdateLabelUseCase**
- **Chức năng:** Cập nhật label
- **Input:** `String labelId`, `Label label`
- **Output:** `Label`
- **Validation:** Same as Create (name, color optional)

#### **DeleteLabelUseCase**
- **Chức năng:** Xóa label
- **Input:** `String labelId`
- **Output:** `Void`
- **Business Logic:** Remove from all tasks

---

### **4. AUTH USECASES (4 classes) + Auth Repository**

⚠️ **Lưu ý:** Auth module chưa có Repository, đã tạo mới **IAuthRepository**

#### **IAuthRepository Interface** (Mới tạo)
**Location:** `domain/repository/IAuthRepository.java`

**Methods:**
- `login(email, password, callback)` → AuthResult
- `logout(callback)` → Void
- `getCurrentUser(callback)` → User
- `isLoggedIn()` → boolean
- `refreshToken(refreshToken, callback)` → String

**AuthResult class:**
```java
class AuthResult {
    User user;
    String accessToken;
    String refreshToken;
}
```

#### **LoginUseCase**
- **Chức năng:** Đăng nhập email/password
- **Input:** `String email`, `String password`
- **Output:** `AuthResult` (User + tokens)
- **Validation:**
  - Email format valid
  - Password min 6 chars

#### **LogoutUseCase**
- **Chức năng:** Đăng xuất
- **Input:** None
- **Output:** `Void`
- **Business Logic:** Clear tokens, clear session

#### **GetCurrentUserUseCase**
- **Chức năng:** Lấy thông tin user hiện tại
- **Input:** None
- **Output:** `User`
- **Use case:** App startup, profile screen

#### **IsLoggedInUseCase**
- **Chức năng:** Kiểm tra đã đăng nhập chưa
- **Input:** None
- **Output:** `boolean`
- **Use case:** Navigation logic (Login vs Home)

---

## 🚀 BƯỚC TIẾP THEO - TRIỂN KHAI AUTH REPOSITORY

Auth module cần thêm các thành phần sau:

### **1. Tạo AuthApiService** (Chưa có)

**Location:** `data/remote/api/AuthApiService.java`

```java
public interface AuthApiService {
    @POST("/api/auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);
    
    @POST("/api/auth/logout")
    Call<Void> logout();
    
    @GET("/api/auth/me")
    Call<UserDTO> getCurrentUser();
    
    @POST("/api/auth/refresh")
    Call<RefreshTokenResponse> refreshToken(@Body RefreshTokenRequest request);
}
```

### **2. Tạo Auth DTOs** (Đã có 1 phần)

**Đã có:**
- ✅ `LoginRequest.java`
- ✅ `LoginResponse.java`

**Cần tạo thêm:**
- ⏳ `RefreshTokenRequest.java`
- ⏳ `RefreshTokenResponse.java`

### **3. Tạo AuthRepositoryImpl**

**Location:** `data/repository/AuthRepositoryImpl.java`

**Chức năng:**
- Implement IAuthRepository
- Call AuthApiService
- Manage token storage (SharedPreferences hoặc DataStore)
- Handle token refresh logic

### **4. Tạo TokenManager** (Helper class)

**Location:** `data/local/TokenManager.java`

**Chức năng:**
- Save/Load access token
- Save/Load refresh token
- Check token expiration
- Clear tokens on logout

---

## 📊 TIẾN ĐỘ TỔNG THỂ

### **Phase 3: Domain Layer - 100% ✅**

| Component | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Domain Models | ✅ 100% | 17 models |
| Repository Interfaces | ✅ 100% | 10 interfaces (bao gồm IAuthRepository) |
| UseCases | ✅ 100% | 48 UseCases |

### **Phần còn thiếu để Auth hoạt động:**

| Component | Trạng thái | Ưu tiên |
|-----------|-----------|---------|
| AuthApiService | ❌ Chưa có | CAO |
| AuthRepositoryImpl | ❌ Chưa có | CAO |
| TokenManager | ❌ Chưa có | CAO |
| Refresh Token DTOs | ❌ Chưa có | TRUNG BÌNH |

---

## 💡 HƯỚNG DẪN SỬ DỤNG USECASES

### **Ví dụ 1: Login trong Activity**

```java
public class LoginActivity extends AppCompatActivity {
    
    private LoginUseCase loginUseCase;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize UseCase with Repository
        IAuthRepository authRepository = new AuthRepositoryImpl(/* dependencies */);
        loginUseCase = new LoginUseCase(authRepository);
        
        btnLogin.setOnClickListener(v -> {
            String email = etEmail.getText().toString();
            String password = etPassword.getText().toString();
            
            loginUseCase.execute(email, password, new LoginUseCase.Callback<IAuthRepository.AuthResult>() {
                @Override
                public void onSuccess(IAuthRepository.AuthResult result) {
                    // Login thành công
                    Toast.makeText(LoginActivity.this, "Welcome " + result.getUser().getName(), Toast.LENGTH_SHORT).show();
                    
                    // Navigate to Home
                    Intent intent = new Intent(LoginActivity.this, HomeActivity.class);
                    startActivity(intent);
                    finish();
                }
                
                @Override
                public void onError(String error) {
                    // Login thất bại
                    Toast.makeText(LoginActivity.this, error, Toast.LENGTH_SHORT).show();
                }
            });
        });
    }
}
```

### **Ví dụ 2: Get Notifications**

```java
public class NotificationActivity extends AppCompatActivity {
    
    private GetNotificationsUseCase getNotificationsUseCase;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize UseCase
        INotificationRepository repository = new NotificationRepositoryImpl(/* dependencies */);
        getNotificationsUseCase = new GetNotificationsUseCase(repository);
        
        // Load notifications
        loadNotifications();
    }
    
    private void loadNotifications() {
        getNotificationsUseCase.execute(new GetNotificationsUseCase.Callback<List<Notification>>() {
            @Override
            public void onSuccess(List<Notification> result) {
                // Update UI with notifications
                notificationAdapter.setNotifications(result);
            }
            
            @Override
            public void onError(String error) {
                Toast.makeText(NotificationActivity.this, error, Toast.LENGTH_SHORT).show();
            }
        });
    }
}
```

### **Ví dụ 3: Create Board**

```java
public class CreateBoardActivity extends AppCompatActivity {
    
    private CreateBoardUseCase createBoardUseCase;
    
    private void createBoard() {
        String projectId = getIntent().getStringExtra("PROJECT_ID");
        String boardName = etBoardName.getText().toString();
        
        // Create Board object
        Board board = new Board(
            null, // ID will be generated
            projectId,
            boardName,
            0, // order will be auto-assigned
            null, // createdAt
            null  // updatedAt
        );
        
        createBoardUseCase.execute(projectId, board, new CreateBoardUseCase.Callback<Board>() {
            @Override
            public void onSuccess(Board result) {
                Toast.makeText(CreateBoardActivity.this, "Board created successfully", Toast.LENGTH_SHORT).show();
                finish();
            }
            
            @Override
            public void onError(String error) {
                Toast.makeText(CreateBoardActivity.this, error, Toast.LENGTH_SHORT).show();
            }
        });
    }
}
```

---

## 🎯 KẾ HOẠCH TIẾP THEO

### **Option 1: Hoàn thiện Auth Module (Khuyến nghị)**

1. ✅ Tạo IAuthRepository interface (Done)
2. ✅ Tạo 4 Auth UseCases (Done)
3. ⏳ Tạo AuthApiService
4. ⏳ Tạo TokenManager
5. ⏳ Tạo AuthRepositoryImpl
6. ⏳ Test authentication flow

**Thời gian ước tính:** 3-4 giờ

### **Option 2: Chuyển sang Phase 4 (ViewModels)**

Bắt đầu tạo ViewModels cho các module đã có UseCases:
- WorkspaceViewModel
- ProjectViewModel
- TaskViewModel
- BoardViewModel
- NotificationViewModel
- LabelViewModel

**Lưu ý:** Auth vẫn cần hoàn thiện để app hoạt động đầy đủ.

---

## 📝 CHECKLIST KIỂM TRA

### **Phase 3 - UseCases**
- [x] Workspace UseCases (5/5)
- [x] Project UseCases (6/6)
- [x] Task UseCases (15/15)
- [x] Board UseCases (6/6)
- [x] Notification UseCases (8/8)
- [x] Label UseCases (5/5)
- [x] Auth UseCases (4/4)
- [x] IAuthRepository interface

### **Phase 3 - Còn thiếu cho Auth**
- [ ] AuthApiService
- [ ] TokenManager
- [ ] AuthRepositoryImpl
- [ ] Refresh Token DTOs

### **Phase 4 - ViewModels (Chưa bắt đầu)**
- [ ] WorkspaceViewModel
- [ ] ProjectViewModel
- [ ] TaskViewModel
- [ ] BoardViewModel
- [ ] NotificationViewModel
- [ ] LabelViewModel
- [ ] AuthViewModel

---

## 🎉 KẾT LUẬN

**Phase 3 đã hoàn thành 100%** về mặt UseCases!

Tổng cộng đã tạo:
- ✅ 48 UseCases
- ✅ 10 Repository Interfaces
- ✅ 17 Domain Models

**Còn thiếu:**
- Auth implementation (AuthApiService, TokenManager, AuthRepositoryImpl)
- Phase 4: ViewModels
- Phase 5: Migration & Testing

Bạn có thể chuyển sang Phase 4 để làm ViewModels, sau đó quay lại hoàn thiện Auth implementation khi cần.

