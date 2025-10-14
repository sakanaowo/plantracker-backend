# PHASE 4: VIEWMODELS - PHÂN CÔNG CHO 3 NGƯỜI
**Ngày thực hiện:** 14/10/2025 (Buổi chiều - 4 giờ)  
**Mục tiêu:** Hoàn thành 7 ViewModels + Factories

---

## 📊 TỔNG QUAN PHÂN CÔNG

| Người | Modules | ViewModels | Factories | Độ phức tạp | Thời gian ước tính |
|-------|---------|-----------|-----------|-------------|-------------------|
| **Người 1** | Auth, Workspace | 2 | 2 | Trung bình | 3-4 giờ |
| **Người 2** | Project, Board | 2 | 2 | Trung bình | 3-4 giờ |
| **Người 3** | Task, Notification, Label | 3 | 3 | Phức tạp | 4 giờ |

**Tổng:** 7 ViewModels + 7 Factories = **14 files**

---

## 👤 NGƯỜI 1: AUTH & WORKSPACE (Priority: CAO)

### **Module 1: AuthViewModel** ⭐⭐⭐ (Critical)

**Location:** `presentation/viewmodel/AuthViewModel.java`

**Chức năng:**
- Login/Logout
- Get current user
- Check login status

**LiveData cần có:**
- `MutableLiveData<User> currentUserLiveData`
- `MutableLiveData<Boolean> isLoggedInLiveData`
- `MutableLiveData<Boolean> loadingLiveData`
- `MutableLiveData<String> errorLiveData`

**Methods public:**
```java
public LiveData<User> getCurrentUser()
public LiveData<Boolean> isLoggedIn()
public LiveData<Boolean> isLoading()
public LiveData<String> getError()

public void login(String email, String password)
public void logout()
public void loadCurrentUser()
public void clearError()
```

**UseCases cần inject:**
- `LoginUseCase`
- `LogoutUseCase`
- `GetCurrentUserUseCase`
- `IsLoggedInUseCase`

**Độ phức tạp:** Trung bình (4 UseCases, logic đơn giản)

**Thời gian:** 1.5 giờ

**Template code:**
```java
public class AuthViewModel extends ViewModel {
    private final LoginUseCase loginUseCase;
    private final LogoutUseCase logoutUseCase;
    private final GetCurrentUserUseCase getCurrentUserUseCase;
    private final IsLoggedInUseCase isLoggedInUseCase;
    
    private final MutableLiveData<User> currentUserLiveData = new MutableLiveData<>();
    private final MutableLiveData<Boolean> isLoggedInLiveData = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loadingLiveData = new MutableLiveData<>(false);
    private final MutableLiveData<String> errorLiveData = new MutableLiveData<>();
    
    public AuthViewModel(
            LoginUseCase loginUseCase,
            LogoutUseCase logoutUseCase,
            GetCurrentUserUseCase getCurrentUserUseCase,
            IsLoggedInUseCase isLoggedInUseCase
    ) {
        this.loginUseCase = loginUseCase;
        this.logoutUseCase = logoutUseCase;
        this.getCurrentUserUseCase = getCurrentUserUseCase;
        this.isLoggedInUseCase = isLoggedInUseCase;
        
        // Check login status on init
        checkLoginStatus();
    }
    
    // Getters for LiveData
    public LiveData<User> getCurrentUser() { return currentUserLiveData; }
    public LiveData<Boolean> isLoggedIn() { return isLoggedInLiveData; }
    public LiveData<Boolean> isLoading() { return loadingLiveData; }
    public LiveData<String> getError() { return errorLiveData; }
    
    private void checkLoginStatus() {
        boolean loggedIn = isLoggedInUseCase.execute();
        isLoggedInLiveData.setValue(loggedIn);
    }
    
    public void login(String email, String password) {
        loadingLiveData.setValue(true);
        errorLiveData.setValue(null);
        
        loginUseCase.execute(email, password, new LoginUseCase.Callback<IAuthRepository.AuthResult>() {
            @Override
            public void onSuccess(IAuthRepository.AuthResult result) {
                loadingLiveData.setValue(false);
                currentUserLiveData.setValue(result.getUser());
                isLoggedInLiveData.setValue(true);
            }
            
            @Override
            public void onError(String error) {
                loadingLiveData.setValue(false);
                errorLiveData.setValue(error);
            }
        });
    }
    
    public void logout() {
        loadingLiveData.setValue(true);
        
        logoutUseCase.execute(new LogoutUseCase.Callback<Void>() {
            @Override
            public void onSuccess(Void result) {
                loadingLiveData.setValue(false);
                currentUserLiveData.setValue(null);
                isLoggedInLiveData.setValue(false);
            }
            
            @Override
            public void onError(String error) {
                loadingLiveData.setValue(false);
                errorLiveData.setValue(error);
            }
        });
    }
    
    public void loadCurrentUser() {
        loadingLiveData.setValue(true);
        
        getCurrentUserUseCase.execute(new GetCurrentUserUseCase.Callback<User>() {
            @Override
            public void onSuccess(User result) {
                loadingLiveData.setValue(false);
                currentUserLiveData.setValue(result);
            }
            
            @Override
            public void onError(String error) {
                loadingLiveData.setValue(false);
                errorLiveData.setValue(error);
            }
        });
    }
    
    public void clearError() {
        errorLiveData.setValue(null);
    }
}
```

**AuthViewModelFactory:**
```java
public class AuthViewModelFactory implements ViewModelProvider.Factory {
    private final LoginUseCase loginUseCase;
    private final LogoutUseCase logoutUseCase;
    private final GetCurrentUserUseCase getCurrentUserUseCase;
    private final IsLoggedInUseCase isLoggedInUseCase;
    
    public AuthViewModelFactory(
            LoginUseCase loginUseCase,
            LogoutUseCase logoutUseCase,
            GetCurrentUserUseCase getCurrentUserUseCase,
            IsLoggedInUseCase isLoggedInUseCase
    ) {
        this.loginUseCase = loginUseCase;
        this.logoutUseCase = logoutUseCase;
        this.getCurrentUserUseCase = getCurrentUserUseCase;
        this.isLoggedInUseCase = isLoggedInUseCase;
    }
    
    @NonNull
    @Override
    public <T extends ViewModel> T create(@NonNull Class<T> modelClass) {
        if (modelClass.isAssignableFrom(AuthViewModel.class)) {
            return (T) new AuthViewModel(loginUseCase, logoutUseCase, getCurrentUserUseCase, isLoggedInUseCase);
        }
        throw new IllegalArgumentException("Unknown ViewModel class");
    }
}
```

---

### **Module 2: WorkspaceViewModel** ✅ (Đã có example)

**Location:** `presentation/viewmodel/WorkspaceViewModel.java`

**Trạng thái:** ✅ Đã có file mẫu hoàn chỉnh

**Công việc:**
- Kiểm tra lại code
- Tạo WorkspaceViewModelFactory
- Test với Activity (optional)

**Thời gian:** 0.5 giờ (chỉ tạo Factory và kiểm tra)

**WorkspaceViewModelFactory:** (Đã có example)

---

### **Checklist Người 1:**

- [ ] Đọc hiểu WorkspaceViewModel example
- [ ] Tạo AuthViewModel.java (1.5 giờ)
- [ ] Tạo AuthViewModelFactory.java (15 phút)
- [ ] Tạo WorkspaceViewModelFactory.java (15 phút)
- [ ] Test compile (15 phút)
- [ ] Review code (15 phút)

**Tổng thời gian:** 3 giờ

---

## 👤 NGƯỜI 2: PROJECT & BOARD

### **Module 1: ProjectViewModel** ⭐⭐

**Location:** `presentation/viewmodel/ProjectViewModel.java`

**Chức năng:**
- CRUD projects
- Switch board type
- Update project key

**LiveData cần có:**
- `MutableLiveData<List<Project>> projectsLiveData`
- `MutableLiveData<Project> selectedProjectLiveData`
- `MutableLiveData<Boolean> loadingLiveData`
- `MutableLiveData<String> errorLiveData`

**Methods public:**
```java
public LiveData<List<Project>> getProjects()
public LiveData<Project> getSelectedProject()
public LiveData<Boolean> isLoading()
public LiveData<String> getError()

public void loadProjectById(String projectId)
public void createProject(String workspaceId, Project project)
public void updateProject(String projectId, Project project)
public void deleteProject(String projectId)
public void switchBoardType(String projectId, String newBoardType)
public void updateProjectKey(String projectId, String newKey)
public void clearError()
```

**UseCases cần inject:**
- `GetProjectByIdUseCase`
- `CreateProjectUseCase`
- `UpdateProjectUseCase`
- `DeleteProjectUseCase`
- `SwitchBoardTypeUseCase`
- `UpdateProjectKeyUseCase`

**Độ phức tạp:** Trung bình (6 UseCases)

**Thời gian:** 1.5 giờ

**Template code:**
```java
public class ProjectViewModel extends ViewModel {
    // UseCases
    private final GetProjectByIdUseCase getProjectByIdUseCase;
    private final CreateProjectUseCase createProjectUseCase;
    private final UpdateProjectUseCase updateProjectUseCase;
    private final DeleteProjectUseCase deleteProjectUseCase;
    private final SwitchBoardTypeUseCase switchBoardTypeUseCase;
    private final UpdateProjectKeyUseCase updateProjectKeyUseCase;
    
    // LiveData
    private final MutableLiveData<Project> selectedProjectLiveData = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loadingLiveData = new MutableLiveData<>(false);
    private final MutableLiveData<String> errorLiveData = new MutableLiveData<>();
    private final MutableLiveData<Boolean> projectDeletedLiveData = new MutableLiveData<>(false);
    
    // Constructor với 6 UseCases
    public ProjectViewModel(
            GetProjectByIdUseCase getProjectByIdUseCase,
            CreateProjectUseCase createProjectUseCase,
            UpdateProjectUseCase updateProjectUseCase,
            DeleteProjectUseCase deleteProjectUseCase,
            SwitchBoardTypeUseCase switchBoardTypeUseCase,
            UpdateProjectKeyUseCase updateProjectKeyUseCase
    ) {
        // Initialize...
    }
    
    // Implement methods tương tự WorkspaceViewModel
}
```

---

### **Module 2: BoardViewModel** ⭐⭐

**Location:** `presentation/viewmodel/BoardViewModel.java`

**Chức năng:**
- CRUD boards
- Reorder boards
- Get board tasks

**LiveData cần có:**
- `MutableLiveData<List<Board>> boardsLiveData`
- `MutableLiveData<Board> selectedBoardLiveData`
- `MutableLiveData<List<Task>> boardTasksLiveData`
- `MutableLiveData<Boolean> loadingLiveData`
- `MutableLiveData<String> errorLiveData`

**Methods public:**
```java
public void loadBoardById(String boardId)
public void createBoard(String projectId, Board board)
public void updateBoard(String boardId, Board board)
public void deleteBoard(String boardId)
public void reorderBoards(String projectId, List<String> boardIds)
public void loadBoardTasks(String boardId)
```

**UseCases cần inject:**
- `GetBoardByIdUseCase`
- `CreateBoardUseCase`
- `UpdateBoardUseCase`
- `DeleteBoardUseCase`
- `ReorderBoardsUseCase`
- `GetBoardTasksUseCase`

**Độ phức tạp:** Trung bình (6 UseCases)

**Thời gian:** 1.5 giờ

---

### **Checklist Người 2:**

- [ ] Tạo ProjectViewModel.java (1.5 giờ)
- [ ] Tạo ProjectViewModelFactory.java (15 phút)
- [ ] Tạo BoardViewModel.java (1.5 giờ)
- [ ] Tạo BoardViewModelFactory.java (15 phút)
- [ ] Test compile (15 phút)
- [ ] Review code (15 phút)

**Tổng thời gian:** 3.5 giờ

---

## 👤 NGƯỜI 3: TASK, NOTIFICATION & LABEL (Nhiệm vụ nhiều nhất)

### **Module 1: TaskViewModel** ⭐⭐⭐ (Phức tạp nhất)

**Location:** `presentation/viewmodel/TaskViewModel.java`

**Chức năng:**
- CRUD tasks
- Assign/Unassign
- Move task
- Add comments, attachments, checklists

**LiveData cần có:**
- `MutableLiveData<List<Task>> tasksLiveData`
- `MutableLiveData<Task> selectedTaskLiveData`
- `MutableLiveData<List<TaskComment>> commentsLiveData`
- `MutableLiveData<List<Attachment>> attachmentsLiveData`
- `MutableLiveData<List<Checklist>> checklistsLiveData`
- `MutableLiveData<Boolean> loadingLiveData`
- `MutableLiveData<String> errorLiveData`

**Methods public:**
```java
// CRUD
public void loadTaskById(String taskId)
public void loadTasksByBoard(String boardId)
public void createTask(Task task)
public void updateTask(String taskId, Task task)
public void deleteTask(String taskId)

// Assignment
public void assignTask(String taskId, String userId)
public void unassignTask(String taskId)

// Movement
public void moveTaskToBoard(String taskId, String targetBoardId)
public void updateTaskPosition(String taskId, double newPosition)

// Comments
public void addComment(String taskId, String comment)
public void loadTaskComments(String taskId)

// Attachments
public void addAttachment(String taskId, Attachment attachment)
public void loadTaskAttachments(String taskId)

// Checklists
public void addChecklist(String taskId, Checklist checklist)
public void loadTaskChecklists(String taskId)
```

**UseCases cần inject:** 15 UseCases (nhiều nhất)

**Độ phức tạp:** Cao (15 UseCases, nhiều LiveData)

**Thời gian:** 2 giờ

---

### **Module 2: NotificationViewModel** ⭐⭐

**Location:** `presentation/viewmodel/NotificationViewModel.java`

**Chức năng:**
- Get notifications
- Mark as read
- Delete notifications
- Get unread count

**LiveData cần có:**
- `MutableLiveData<List<Notification>> notificationsLiveData`
- `MutableLiveData<Integer> unreadCountLiveData`
- `MutableLiveData<Boolean> loadingLiveData`
- `MutableLiveData<String> errorLiveData`

**Methods public:**
```java
public void loadNotifications()
public void loadUnreadNotifications()
public void markAsRead(String notificationId)
public void markAllAsRead()
public void deleteNotification(String notificationId)
public void deleteAllNotifications()
public void loadUnreadCount()
```

**UseCases cần inject:**
- `GetNotificationsUseCase`
- `GetUnreadNotificationsUseCase`
- `MarkAsReadUseCase`
- `MarkAllAsReadUseCase`
- `DeleteNotificationUseCase`
- `DeleteAllNotificationsUseCase`
- `GetNotificationCountUseCase`

**Độ phức tạp:** Trung bình (7 UseCases)

**Thời gian:** 1 giờ

---

### **Module 3: LabelViewModel** ⭐

**Location:** `presentation/viewmodel/LabelViewModel.java`

**Chức năng:**
- CRUD labels

**LiveData cần có:**
- `MutableLiveData<List<Label>> labelsLiveData`
- `MutableLiveData<Label> selectedLabelLiveData`
- `MutableLiveData<Boolean> loadingLiveData`
- `MutableLiveData<String> errorLiveData`

**Methods public:**
```java
public void loadLabelsByWorkspace(String workspaceId)
public void loadLabelById(String labelId)
public void createLabel(String workspaceId, Label label)
public void updateLabel(String labelId, Label label)
public void deleteLabel(String labelId)
```

**UseCases cần inject:**
- `GetLabelsByWorkspaceUseCase`
- `GetLabelByIdUseCase`
- `CreateLabelUseCase`
- `UpdateLabelUseCase`
- `DeleteLabelUseCase`

**Độ phức tạp:** Đơn giản (5 UseCases, pattern giống Workspace)

**Thời gian:** 45 phút

---

### **Checklist Người 3:**

- [ ] Tạo TaskViewModel.java (2 giờ)
- [ ] Tạo TaskViewModelFactory.java (15 phút)
- [ ] Tạo NotificationViewModel.java (1 giờ)
- [ ] Tạo NotificationViewModelFactory.java (15 phút)
- [ ] Tạo LabelViewModel.java (45 phút)
- [ ] Tạo LabelViewModelFactory.java (10 phút)
- [ ] Test compile (15 phút)
- [ ] Review code (10 phút)

**Tổng thời gian:** 4.5 giờ

---

## 📋 TEMPLATE CHUNG CHO TẤT CẢ VIEWMODELS

### **Cấu trúc chuẩn:**

```java
package com.example.tralalero.presentation.viewmodel;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

// Import domain models và UseCases

public class XxxViewModel extends ViewModel {
    
    // ========== Dependencies ==========
    private final XxxUseCase1 useCase1;
    private final XxxUseCase2 useCase2;
    // ... more UseCases
    
    // ========== LiveData (UI State) ==========
    private final MutableLiveData<List<Xxx>> itemsLiveData = new MutableLiveData<>();
    private final MutableLiveData<Xxx> selectedItemLiveData = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loadingLiveData = new MutableLiveData<>(false);
    private final MutableLiveData<String> errorLiveData = new MutableLiveData<>();
    
    // ========== Constructor ==========
    public XxxViewModel(
            XxxUseCase1 useCase1,
            XxxUseCase2 useCase2
            // ... inject all UseCases
    ) {
        this.useCase1 = useCase1;
        this.useCase2 = useCase2;
    }
    
    // ========== Getters (Public API) ==========
    public LiveData<List<Xxx>> getItems() { return itemsLiveData; }
    public LiveData<Xxx> getSelectedItem() { return selectedItemLiveData; }
    public LiveData<Boolean> isLoading() { return loadingLiveData; }
    public LiveData<String> getError() { return errorLiveData; }
    
    // ========== Public Methods ==========
    
    public void loadItems() {
        loadingLiveData.setValue(true);
        errorLiveData.setValue(null);
        
        useCase1.execute(new XxxUseCase1.Callback<List<Xxx>>() {
            @Override
            public void onSuccess(List<Xxx> result) {
                loadingLiveData.setValue(false);
                itemsLiveData.setValue(result);
            }
            
            @Override
            public void onError(String error) {
                loadingLiveData.setValue(false);
                errorLiveData.setValue(error);
            }
        });
    }
    
    // ... more public methods
    
    public void clearError() {
        errorLiveData.setValue(null);
    }
    
    // ========== Lifecycle ==========
    @Override
    protected void onCleared() {
        super.onCleared();
        // Cleanup if needed
    }
}
```

### **Factory template:**

```java
package com.example.tralalero.presentation.viewmodel;

import androidx.annotation.NonNull;
import androidx.lifecycle.ViewModel;
import androidx.lifecycle.ViewModelProvider;

// Import UseCases

public class XxxViewModelFactory implements ViewModelProvider.Factory {
    
    private final XxxUseCase1 useCase1;
    private final XxxUseCase2 useCase2;
    
    public XxxViewModelFactory(
            XxxUseCase1 useCase1,
            XxxUseCase2 useCase2
    ) {
        this.useCase1 = useCase1;
        this.useCase2 = useCase2;
    }
    
    @NonNull
    @Override
    public <T extends ViewModel> T create(@NonNull Class<T> modelClass) {
        if (modelClass.isAssignableFrom(XxxViewModel.class)) {
            return (T) new XxxViewModel(useCase1, useCase2);
        }
        throw new IllegalArgumentException("Unknown ViewModel class: " + modelClass.getName());
    }
}
```

---

## 🎯 QUY TẮC CHUNG

### **1. Naming Convention:**
- ViewModel: `XxxViewModel.java`
- Factory: `XxxViewModelFactory.java`
- LiveData: `xxxLiveData` (MutableLiveData private, LiveData public)

### **2. LiveData patterns:**
```java
// Private MutableLiveData (có thể setValue)
private final MutableLiveData<Xxx> xxxLiveData = new MutableLiveData<>();

// Public LiveData (chỉ đọc)
public LiveData<Xxx> getXxx() {
    return xxxLiveData;
}
```

### **3. Error Handling pattern:**
```java
public void someAction() {
    loadingLiveData.setValue(true);
    errorLiveData.setValue(null); // Clear previous error
    
    useCase.execute(new Callback() {
        @Override
        public void onSuccess(Result result) {
            loadingLiveData.setValue(false);
            resultLiveData.setValue(result);
        }
        
        @Override
        public void onError(String error) {
            loadingLiveData.setValue(false);
            errorLiveData.setValue(error);
        }
    });
}
```

### **4. Loading state:**
- Luôn set `loading = true` trước khi gọi UseCase
- Luôn set `loading = false` trong cả success và error callback

---

## 🔍 KIỂM TRA CHẤT LƯỢNG

### **Checklist cho mỗi ViewModel:**

- [ ] Constructor inject đúng UseCases
- [ ] Tất cả LiveData là `private final MutableLiveData`
- [ ] Tất cả getters return `LiveData` (không phải MutableLiveData)
- [ ] Mọi method đều có loading state
- [ ] Mọi method đều có error handling
- [ ] Có method `clearError()`
- [ ] JavaDoc comments cho class và public methods
- [ ] Import đúng packages
- [ ] No warnings/errors

### **Checklist cho mỗi Factory:**

- [ ] Implement `ViewModelProvider.Factory`
- [ ] Constructor inject đúng UseCases
- [ ] Method `create()` có `@NonNull` annotation
- [ ] Check `modelClass.isAssignableFrom()`
- [ ] Throw exception nếu wrong class
- [ ] No warnings/errors

---

## 📦 DELIVERABLES

Mỗi người cần commit 2 files cho mỗi ViewModel:
1. `XxxViewModel.java`
2. `XxxViewModelFactory.java`

**Tổng cộng:** 14 files

---

## ⏱️ TIMELINE

| Thời gian | Người 1 | Người 2 | Người 3 |
|-----------|---------|---------|---------|
| **13:00-14:30** | AuthViewModel | ProjectViewModel | TaskViewModel (bắt đầu) |
| **14:30-15:00** | AuthFactory + WorkspaceFactory | ProjectFactory | TaskViewModel (tiếp) |
| **15:00-16:00** | Review & Test | BoardViewModel | NotificationViewModel |
| **16:00-16:30** | Help others | BoardFactory | NotificationFactory |
| **16:30-17:00** | Final review | Review & Test | LabelViewModel + Factory |

---

## 🚀 SAU KHI HOÀN THÀNH

### **Tích hợp vào UI (Phase 5):**
1. Refactor LoginActivity dùng AuthViewModel
2. Refactor WorkspaceActivity dùng WorkspaceViewModel
3. Refactor các Activity khác dùng ViewModels tương ứng
4. Test xoay màn hình để verify data không mất

### **Testing:**
- Unit test ViewModels (mock UseCases)
- Integration test với real UseCases
- UI test với Activity/Fragment

---

## 💡 TIPS

1. **Copy pattern từ WorkspaceViewModel** - Đã có example hoàn chỉnh
2. **Làm từng file một** - Không làm song song nhiều file
3. **Test compile thường xuyên** - Sau mỗi 30 phút
4. **Hỏi ngay khi stuck** - Đừng mất thời gian debug một mình
5. **Comment rõ ràng** - Giúp người khác hiểu code

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Check WorkspaceViewModel example
2. Check template trong tài liệu này
3. Hỏi team members
4. Check errors với `get_errors` tool

**Chúc các bạn làm việc hiệu quả!** 🎉

