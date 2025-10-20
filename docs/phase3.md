# BÁO CÁO PHASE DỰ ÁN PLANTRACKER - CLEAN ARCHITECTURE MIGRATION

**Ngày báo cáo:** 10/10/2025  
**Tình trạng:** Đang ở Phase 3 - Domain Layer  
**Tiến trình tổng:** 57% hoàn thành

---

## 📊 TỔNG QUAN TIẾN TRÌNH

### **Tiến trình theo Phase:**

| Phase | Tên Phase | Tiến trình | Trạng thái | Ghi chú |
|-------|-----------|-----------|-----------|---------|
| **Phase 1** | Cấu trúc thư mục mới | **100%** | ✅ Hoàn thành | Clean Architecture structure đã được thiết lập |
| **Phase 2** | Data Layer | **100%** | ✅ Hoàn thành | DTOs, Mappers, Repositories đã sẵn sàng |
| **Phase 3** | Domain Layer | **85%** | 🔄 Đang làm | Models hoàn thành, UseCases cần triển khai |
| **Phase 4** | Presentation Layer | **0%** | ⏳ Chờ | ViewModels chưa bắt đầu |
| **Phase 5** | Migration & Testing | **0%** | ⏳ Chờ | Chưa di chuyển code cũ |

### **Biểu đồ tiến trình:**
```
Phase 1: ████████████████████ 100%
Phase 2: ████████████████████ 100%
Phase 3: █████████████████░░░  85%
Phase 4: ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5: ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## ✅ ĐÃ HOÀN THÀNH

### **PHASE 1: Cấu trúc thư mục (100%)**

**Đã tạo cấu trúc Clean Architecture đầy đủ:**

```
app/src/main/java/com/example/tralalero/
├── data/
│   ├── local/           # Room Database (chưa triển khai)
│   ├── mapper/          # 15 mappers ✅
│   ├── remote/          # API & DTOs ✅
│   └── repository/      # 9 repository implementations ✅
├── domain/
│   ├── model/           # 17 domain models ✅
│   ├── repository/      # 9 repository interfaces ✅
│   └── usecase/         # 6 thư mục con (chưa có classes)
├── presentation/        # ViewModels (chưa triển khai)
└── test/               # RepositoryTestActivity ✅
```

### **PHASE 2: Data Layer (100%)**

#### **2.1. DTOs - 9 modules (100%)**
- ✅ `auth/` - LoginDTO, SignupDTO, etc.
- ✅ `board/` - BoardDTO
- ✅ `event/` - EventDTO
- ✅ `label/` - LabelDTO
- ✅ `notification/` - NotificationDTO
- ✅ `project/` - ProjectDTO
- ✅ `sprint/` - SprintDTO
- ✅ `task/` - TaskDTO, AttachmentDTO, CheckListDTO, CheckListItemDTO, TaskCommentDTO, TimeEntryDTO
- ✅ `workspace/` - WorkspaceDTO, MembershipDTO

#### **2.2. Mappers - 15 classes (100%)**
1. ✅ AttachmentMapper - Convert AttachmentDTO ↔ Attachment
2. ✅ BoardMapper - Convert BoardDTO ↔ Board
3. ✅ ChecklistMapper - Convert CheckListDTO ↔ Checklist
4. ✅ ChecklistItemMapper - Convert CheckListItemDTO ↔ ChecklistItem
5. ✅ EventMapper - Convert EventDTO ↔ Event
6. ✅ LabelMapper - Convert LabelDTO ↔ Label
7. ✅ MembershipMapper - Convert MembershipDTO ↔ Membership
8. ✅ NotificationMapper - Convert NotificationDTO ↔ Notification
9. ✅ ProjectMapper - Convert ProjectDTO ↔ Project
10. ✅ SprintMapper - Convert SprintDTO ↔ Sprint
11. ✅ TaskMapper - Convert TaskDTO ↔ Task
12. ✅ TaskCommentMapper - Convert TaskCommentDTO ↔ TaskComment
13. ✅ TimeEntryMapper - Convert TimeEntryDTO ↔ TimeEntry
14. ✅ UserMapper - Convert UserDTO ↔ User
15. ✅ WorkspaceMapper - Convert WorkspaceDTO ↔ Workspace

**Tất cả mappers đều có:**
- Method `toDomain()` - DTO → Domain Model
- Method `toDTO()` - Domain Model → DTO
- Method `toDomainList()` - List DTO → List Domain
- Method `toDTOList()` - List Domain → List DTO
- Date parsing/formatting với UTC timezone
- Null safety handling

#### **2.3. Repository Interfaces - 9 interfaces (100%)**

| Repository | Chức năng chính | Methods count |
|-----------|----------------|---------------|
| **IWorkspaceRepository** | Quản lý workspaces | 5 methods |
| **IProjectRepository** | Quản lý projects | 6 methods |
| **IBoardRepository** | Quản lý boards | 6 methods |
| **ITaskRepository** | Quản lý tasks (CRUD + attachments, comments, checklists) | 23 methods |
| **INotificationRepository** | Quản lý notifications | 8 methods |
| **ILabelRepository** | Quản lý labels | 5 methods |
| **IEventRepository** | Quản lý events/meetings | 8 methods |
| **ISprintRepository** | Quản lý sprints (Scrum) | 11 methods |
| **ITimeEntryRepository** | Quản lý time tracking | 11 methods |

**Tổng:** 83 methods đã được định nghĩa

#### **2.4. Repository Implementations - 9 classes (100%)**

Tất cả đều đã implement đầy đủ:
- ✅ WorkspaceRepositoryImpl - 5/5 methods
- ✅ ProjectRepositoryImpl - 6/6 methods
- ✅ BoardRepositoryImpl - 6/6 methods (1 method pending API)
- ✅ TaskRepositoryImpl - 23/23 methods (một số methods pending API)
- ✅ NotificationRepositoryImpl - 8/8 methods
- ✅ LabelRepositoryImpl - 5/5 methods
- ✅ EventRepositoryImpl - 8/8 methods (2 methods pending API)
- ✅ SprintRepositoryImpl - 11/11 methods (3 methods pending API)
- ✅ TimeEntryRepositoryImpl - 11/11 methods (2 methods pending API)

**Lưu ý:** Một số methods báo lỗi "not yet implemented in API" - đây là tạm thời, đợi backend bổ sung endpoint.

#### **2.5. API Services - Đã cập nhật (100%)**

Các API Service đã được cập nhật để support repositories:
- ✅ WorkspaceApiService - CRUD workspaces, members, projects, boards
- ✅ ProjectApiService - CRUD projects
- ✅ BoardApiService - CRUD boards
- ✅ TaskApiService - CRUD tasks, comments, attachments, checklists
- ✅ NotificationApiService - Quản lý notifications (đã thêm getUnreadNotifications, getNotificationById)
- ✅ LabelApiService - CRUD labels
- ✅ EventApiService - CRUD events
- ✅ SprintApiService - CRUD sprints (đã thêm getActiveSprint, startSprint, completeSprint)
- ✅ TimerApiService - Time tracking (đã cập nhật hoàn toàn với CRUD operations)

### **PHASE 3: Domain Layer (85%)**

#### **3.1. Domain Models - 17 models (100%)**

**Core Models:**
1. ✅ **Workspace** - Workspace chứa projects
2. ✅ **Project** - Project chứa boards & tasks
3. ✅ **Board** - Kanban/Scrum board
4. ✅ **Task** - Task/Issue chính
5. ✅ **User** - User account

**Task Related Models:**
6. ✅ **Attachment** - File đính kèm task
7. ✅ **TaskComment** - Comment trong task
8. ✅ **Checklist** - Checklist trong task
9. ✅ **ChecklistItem** - Item trong checklist
10. ✅ **Label** - Label/tag cho tasks
11. ✅ **TimeEntry** - Time tracking entry

**Collaboration Models:**
12. ✅ **Membership** - User membership trong workspace
13. ✅ **Event** - Calendar event/meeting
14. ✅ **Notification** - Push notification

**Scrum Models:**
15. ✅ **Sprint** - Sprint cho Scrum methodology

**Enums:**
16. ✅ **Role** - OWNER, ADMIN, MEMBER
17. ✅ **SprintState** - PLANNED, ACTIVE, COMPLETED

**Tất cả models đều có:**
- Immutable fields (final)
- Constructor đầy đủ
- Getters
- Business logic methods
- equals() & hashCode() (nếu cần)

#### **3.2. UseCases - 0 classes (0%)**

**⚠️ CHƯA TRIỂN KHAI**

Đã tạo cấu trúc thư mục:
```
domain/usecase/
├── auth/          # Authentication use cases
├── board/         # Board use cases
├── notification/  # Notification use cases
├── project/       # Project use cases
├── task/          # Task use cases
└── workspace/     # Workspace use cases
```

**Cần tạo:** 30-40 UseCase classes (chi tiết ở phần tiếp theo)

---

## 🔧 TEST INFRASTRUCTURE

### **RepositoryTestActivity - Đã tạo (100%)**

**Files đã tạo:**
- ✅ `RepositoryTestActivity.java` - Test activity với UI
- ✅ `activity_repository_test.xml` - Layout
- ✅ `RepositoryTestHelper.java` - Helper methods
- ✅ FAB button màu đỏ trong HomeActivity để mở test

**Chức năng:**
- Test từng repository riêng lẻ (Workspace, Project, Board, Task, Notification)
- Test tất cả repositories cùng lúc
- Hiển thị log output trực tiếp trên màn hình
- Clear log button

**⚠️ Trạng thái hiện tại:**
- Code đã hoàn chỉnh và hoạt động
- Báo lỗi 404 từ backend vì **một số endpoints chưa được thiết lập**
- **Không cần sửa** - đợi backend team bổ sung endpoints

**Endpoints cần backend bổ sung:**
- `DELETE /boards/{id}/reorder` - Reorder boards
- `POST /sprints/{id}/tasks` - Add task to sprint
- `GET /events?startDate&endDate` - Get events by date range
- `POST /events/{id}/participants` - Add participant
- `GET /time-entries/stats` - Time tracking statistics

---

## ⏭️ PHASE TIẾP THEO - PHASE 3: UseCases

### **Mục tiêu:**
Hoàn thiện Domain Layer bằng cách tạo UseCases để xử lý business logic.

### **Tại sao cần UseCases?**

1. **Separation of Concerns** - Tách logic nghiệp vụ ra khỏi UI
2. **Reusability** - Có thể dùng lại trong nhiều screens
3. **Testability** - Dễ unit test hơn
4. **Single Responsibility** - Mỗi UseCase làm 1 việc duy nhất
5. **Clean Code** - ViewModel sẽ gọn hơn, chỉ quản lý UI state

### **UseCase Pattern:**

```java
public class GetWorkspacesUseCase {
    private final IWorkspaceRepository repository;
    
    public GetWorkspacesUseCase(IWorkspaceRepository repository) {
        this.repository = repository;
    }
    
    public void execute(UseCaseCallback<List<Workspace>> callback) {
        repository.getWorkspaces(new IWorkspaceRepository.RepositoryCallback<List<Workspace>>() {
            @Override
            public void onSuccess(List<Workspace> result) {
                // Business logic here (nếu có)
                // Ví dụ: filter, sort, validate
                callback.onSuccess(result);
            }
            
            @Override
            public void onError(String error) {
                callback.onError(error);
            }
        });
    }
    
    public interface UseCaseCallback<T> {
        void onSuccess(T result);
        void onError(String error);
    }
}
```

---

## 👥 PHÂN CÔNG NHIỆM VỤ CHO 3 NGƯỜI

### **🎯 Nguyên tắc phân công:**
- Mỗi người phụ trách 2 modules
- Modules có mức độ phức tạp tương đương
- Có thể làm song song không phụ thuộc lẫn nhau

---

### **👤 NGƯỜI 1: Workspace & Project UseCases**

**Module 1: Workspace UseCases** (Ưu tiên: CAO)

**Location:** `domain/usecase/workspace/`

**UseCases cần tạo:** 5 classes

1. **GetWorkspacesUseCase** ⭐ Quan trọng
   - Input: Không
   - Output: List<Workspace>
   - Logic: Lấy tất cả workspaces của user
   - Repository: IWorkspaceRepository.getWorkspaces()

2. **GetWorkspaceByIdUseCase**
   - Input: String workspaceId
   - Output: Workspace
   - Logic: Lấy chi tiết một workspace
   - Repository: IWorkspaceRepository.getWorkspaceById()

3. **CreateWorkspaceUseCase** ⭐ Quan trọng
   - Input: Workspace workspace
   - Output: Workspace
   - Logic: Tạo workspace mới
   - Business logic: Validate tên không trống, không quá 100 ký tự
   - Repository: IWorkspaceRepository.createWorkspace()

4. **GetWorkspaceProjectsUseCase** ⭐ Quan trọng
   - Input: String workspaceId
   - Output: List<Project>
   - Logic: Lấy tất cả projects trong workspace
   - Business logic: Sort theo createdAt DESC
   - Repository: IWorkspaceRepository.getProjects()

5. **GetWorkspaceBoardsUseCase**
   - Input: String projectId
   - Output: List<Board>
   - Logic: Lấy tất cả boards trong project
   - Business logic: Sort theo order ASC
   - Repository: IWorkspaceRepository.getBoards()

---

**Module 2: Project UseCases** (Ưu tiên: CAO)

**Location:** `domain/usecase/project/`

**UseCases cần tạo:** 6 classes

1. **GetProjectByIdUseCase** ⭐ Quan trọng
   - Input: String projectId
   - Output: Project
   - Logic: Lấy chi tiết project
   - Repository: IProjectRepository.getProjectById()

2. **CreateProjectUseCase** ⭐ Quan trọng
   - Input: String workspaceId, Project project
   - Output: Project
   - Logic: Tạo project mới trong workspace
   - Business logic: 
     - Validate tên không trống
     - Validate key (2-10 ký tự, chữ hoa, không dấu)
     - Set default boardType = "KANBAN"
   - Repository: IProjectRepository.createProject()

3. **UpdateProjectUseCase**
   - Input: String projectId, Project project
   - Output: Project
   - Logic: Cập nhật thông tin project
   - Business logic: Validate tương tự CreateProject
   - Repository: IProjectRepository.updateProject()

4. **DeleteProjectUseCase**
   - Input: String projectId
   - Output: Void
   - Logic: Xóa project
   - Business logic: Confirm trước khi xóa (có thể thêm)
   - Repository: IProjectRepository.deleteProject()

5. **UpdateProjectKeyUseCase**
   - Input: String projectId, String newKey
   - Output: Project
   - Logic: Cập nhật key của project
   - Business logic: 
     - Validate key format (2-10 chars, uppercase)
     - Check duplicate (nếu có API)
   - Repository: IProjectRepository.updateProjectKey()

6. **SwitchBoardTypeUseCase**
   - Input: String projectId, String boardType (KANBAN/SCRUM)
   - Output: Project
   - Logic: Chuyển đổi giữa Kanban và Scrum
   - Business logic: Validate boardType chỉ là "KANBAN" hoặc "SCRUM"
   - Repository: IProjectRepository.updateBoardType()

---

**Tổng Người 1:** 11 UseCases

**Thời gian ước tính:** 4-6 giờ

**Files cần tạo:**
```
domain/usecase/workspace/
├── GetWorkspacesUseCase.java
├── GetWorkspaceByIdUseCase.java
├── CreateWorkspaceUseCase.java
├── GetWorkspaceProjectsUseCase.java
└── GetWorkspaceBoardsUseCase.java

domain/usecase/project/
├── GetProjectByIdUseCase.java
├── CreateProjectUseCase.java
├── UpdateProjectUseCase.java
├── DeleteProjectUseCase.java
├── UpdateProjectKeyUseCase.java
└── SwitchBoardTypeUseCase.java
```

---

### **👤 NGƯỜI 2: Board & Notification UseCases**

**Module 1: Board UseCases** (Ưu tiên: CAO)

**Location:** `domain/usecase/board/`

**UseCases cần tạo:** 6 classes

1. **GetBoardByIdUseCase**
   - Input: String boardId
   - Output: Board
   - Logic: Lấy chi tiết board
   - Repository: IBoardRepository.getBoardById()

2. **CreateBoardUseCase** ⭐ Quan trọng
   - Input: String projectId, Board board
   - Output: Board
   - Logic: Tạo board mới trong project
   - Business logic:
     - Validate tên không trống
     - Auto set order = số board hiện có + 1
   - Repository: IBoardRepository.createBoard()

3. **UpdateBoardUseCase**
   - Input: String boardId, Board board
   - Output: Board
   - Logic: Cập nhật board
   - Business logic: Validate tên không trống
   - Repository: IBoardRepository.updateBoard()

4. **DeleteBoardUseCase**
   - Input: String boardId
   - Output: Void
   - Logic: Xóa board
   - Business logic: 
     - Không cho xóa board cuối cùng
     - Confirm trước khi xóa (có thể thêm)
   - Repository: IBoardRepository.deleteBoard()

5. **ReorderBoardsUseCase**
   - Input: String projectId, List<String> boardIds
   - Output: Void
   - Logic: Sắp xếp lại thứ tự boards
   - Business logic: Validate số lượng boardIds match với số boards
   - Repository: IBoardRepository.reorderBoards()
   - **Note:** Pending API implementation

6. **UpdateBoardOrderUseCase**
   - Input: String boardId, int newOrder
   - Output: Board
   - Logic: Cập nhật order của một board
   - Business logic: Validate order >= 0
   - Repository: IBoardRepository.updateBoardOrder()

---

**Module 2: Notification UseCases** (Ưu tiên: TRUNG BÌNH)

**Location:** `domain/usecase/notification/`

**UseCases cần tạo:** 7 classes

1. **GetNotificationsUseCase** ⭐ Quan trọng
   - Input: Không
   - Output: List<Notification>
   - Logic: Lấy tất cả notifications
   - Business logic: Sort theo createdAt DESC
   - Repository: INotificationRepository.getNotifications()

2. **GetUnreadNotificationsUseCase** ⭐ Quan trọng
   - Input: Không
   - Output: List<Notification>
   - Logic: Lấy notifications chưa đọc
   - Business logic: Filter readAt == null
   - Repository: INotificationRepository.getUnreadNotifications()

3. **GetUnreadCountUseCase** ⭐ Quan trọng
   - Input: Không
   - Output: Integer
   - Logic: Đếm số notifications chưa đọc
   - Business logic: Dùng để hiển thị badge
   - Repository: INotificationRepository.getUnreadCount()

4. **MarkAsReadUseCase** ⭐ Quan trọng
   - Input: String notificationId
   - Output: Void
   - Logic: Đánh dấu notification đã đọc
   - Repository: INotificationRepository.markAsRead()

5. **MarkAllAsReadUseCase**
   - Input: Không
   - Output: Void
   - Logic: Đánh dấu tất cả đã đọc
   - Repository: INotificationRepository.markAllAsRead()

6. **DeleteNotificationUseCase**
   - Input: String notificationId
   - Output: Void
   - Logic: Xóa một notification
   - Repository: INotificationRepository.deleteNotification()

7. **ClearAllNotificationsUseCase**
   - Input: Không
   - Output: Void
   - Logic: Xóa tất cả notifications
   - Business logic: Confirm trước khi xóa
   - Repository: INotificationRepository.deleteAllNotifications()
   - **Note:** Pending API implementation

---

**Tổng Người 2:** 13 UseCases

**Thời gian ước tính:** 4-6 giờ

**Files cần tạo:**
```
domain/usecase/board/
├── GetBoardByIdUseCase.java
├── CreateBoardUseCase.java
├── UpdateBoardUseCase.java
├── DeleteBoardUseCase.java
├── ReorderBoardsUseCase.java
└── UpdateBoardOrderUseCase.java

domain/usecase/notification/
├── GetNotificationsUseCase.java
├── GetUnreadNotificationsUseCase.java
├── GetUnreadCountUseCase.java
├── MarkAsReadUseCase.java
├── MarkAllAsReadUseCase.java
├── DeleteNotificationUseCase.java
└── ClearAllNotificationsUseCase.java
```

---

### **👤 NGƯỜI 3: Task UseCases (Module lớn nhất)**

**Module: Task UseCases** (Ưu tiên: CAO NHẤT)

**Location:** `domain/usecase/task/`

**UseCases cần tạo:** 15 classes (module phức tạp nhất)

**Core Task Operations:**

1. **GetTasksByBoardUseCase** ⭐⭐ Rất quan trọng
   - Input: String boardId
   - Output: List<Task>
   - Logic: Lấy tất cả tasks trong board
   - Business logic: 
     - Filter deleted tasks (deletedAt == null)
     - Sort theo position ASC
   - Repository: ITaskRepository.getTasksByBoard()

2. **GetTaskByIdUseCase** ⭐ Quan trọng
   - Input: String taskId
   - Output: Task
   - Logic: Lấy chi tiết task
   - Repository: ITaskRepository.getTaskById()

3. **CreateTaskUseCase** ⭐⭐ Rất quan trọng
   - Input: String boardId, Task task
   - Output: Task
   - Logic: Tạo task mới
   - Business logic:
     - Validate title không trống
     - Set default status = TO_DO
     - Set default priority = MEDIUM
     - Auto generate position
   - Repository: ITaskRepository.createTask()

4. **UpdateTaskUseCase** ⭐ Quan trọng
   - Input: String taskId, Task task
   - Output: Task
   - Logic: Cập nhật task
   - Business logic: Validate title không trống
   - Repository: ITaskRepository.updateTask()

5. **DeleteTaskUseCase**
   - Input: String taskId
   - Output: Void
   - Logic: Xóa task (soft delete)
   - Repository: ITaskRepository.deleteTask()

**Task Movement:**

6. **MoveTaskToBoardUseCase** ⭐⭐ Rất quan trọng
   - Input: String taskId, String targetBoardId, double position
   - Output: Task
   - Logic: Di chuyển task sang board khác
   - Business logic:
     - Calculate new position
     - Update board reference
   - Repository: ITaskRepository.moveTaskToBoard()

7. **UpdateTaskPositionUseCase** ⭐ Quan trọng
   - Input: String taskId, double newPosition
   - Output: Task
   - Logic: Thay đổi vị trí task trong board
   - Business logic: Calculate position giữa 2 tasks
   - Repository: ITaskRepository.updateTaskPosition()

**Task Assignment:**

8. **AssignTaskUseCase** ⭐ Quan trọng
   - Input: String taskId, String userId
   - Output: Task
   - Logic: Gán task cho user
   - Business logic: 
     - Validate userId tồn tại
     - Tạo notification cho user được assign
   - Repository: ITaskRepository.assignTask()

9. **UnassignTaskUseCase**
   - Input: String taskId
   - Output: Task
   - Logic: Bỏ gán task
   - Repository: ITaskRepository.unassignTask()

**Task Attachments:**

10. **GetTaskAttachmentsUseCase**
    - Input: String taskId
    - Output: List<Attachment>
    - Logic: Lấy tất cả attachments của task
    - Repository: ITaskRepository.getAttachments()

11. **AddAttachmentUseCase**
    - Input: String taskId, Attachment attachment
    - Output: Attachment
    - Logic: Thêm file đính kèm
    - Business logic: 
      - Validate file size < 10MB
      - Validate mime type (image, pdf, doc)
    - Repository: ITaskRepository.addAttachment()

**Task Comments:**

12. **GetTaskCommentsUseCase**
    - Input: String taskId
    - Output: List<TaskComment>
    - Logic: Lấy tất cả comments
    - Business logic: Sort theo createdAt ASC
    - Repository: ITaskRepository.getComments()

13. **AddCommentUseCase** ⭐ Quan trọng
    - Input: String taskId, TaskComment comment
    - Output: TaskComment
    - Logic: Thêm comment mới
    - Business logic: 
      - Validate body không trống
      - Detect mentions (@username)
      - Tạo notification cho mentions
    - Repository: ITaskRepository.addComment()

**Task Checklists:**

14. **GetTaskChecklistsUseCase**
    - Input: String taskId
    - Output: List<Checklist>
    - Logic: Lấy tất cả checklists
    - Repository: ITaskRepository.getChecklists()

15. **AddChecklistUseCase**
    - Input: String taskId, Checklist checklist
    - Output: Checklist
    - Logic: Thêm checklist mới
    - Business logic: Validate title không trống
    - Repository: ITaskRepository.addChecklist()

---

**Tổng Người 3:** 15 UseCases

**Thời gian ước tính:** 6-8 giờ (phức tạp hơn)

**Files cần tạo:**
```
domain/usecase/task/
├── GetTasksByBoardUseCase.java
├── GetTaskByIdUseCase.java
├── CreateTaskUseCase.java
├── UpdateTaskUseCase.java
├── DeleteTaskUseCase.java
├── MoveTaskToBoardUseCase.java
├── UpdateTaskPositionUseCase.java
├── AssignTaskUseCase.java
├── UnassignTaskUseCase.java
├── GetTaskAttachmentsUseCase.java
├── AddAttachmentUseCase.java
├── GetTaskCommentsUseCase.java
├── AddCommentUseCase.java
├── GetTaskChecklistsUseCase.java
└── AddChecklistUseCase.java
```

---

## 📊 TỔNG KẾT PHÂN CÔNG

| Người | Modules | Số UseCases | Độ phức tạp | Thời gian ước tính |
|-------|---------|-------------|-------------|-------------------|
| **Người 1** | Workspace + Project | 11 | Trung bình | 4-6 giờ |
| **Người 2** | Board + Notification | 13 | Trung bình | 4-6 giờ |
| **Người 3** | Task | 15 | Cao | 6-8 giờ |
| **Tổng** | 5 modules | **39 UseCases** | - | **14-20 giờ** |

---

## 🔧 TEMPLATE CODE MẪU

### **UseCase Template:**

```java
package com.example.tralalero.domain.usecase.[module];

import com.example.tralalero.domain.model.*;
import com.example.tralalero.domain.repository.*;

/**
 * UseCase: [Mô tả chức năng]
 * 
 * Input: [Mô tả input]
 * Output: [Mô tả output]
 * 
 * Business Logic:
 * - [Logic 1]
 * - [Logic 2]
 */
public class [Name]UseCase {
    
    private final I[Repository]Repository repository;
    
    public [Name]UseCase(I[Repository]Repository repository) {
        this.repository = repository;
    }
    
    /**
     * Execute the use case
     * 
     * @param [params] Input parameters
     * @param callback Callback to receive result
     */
    public void execute([InputType] [inputParam], Callback<[OutputType]> callback) {
        // Input validation
        if ([inputParam] == null) {
            callback.onError("Input cannot be null");
            return;
        }
        
        // Business logic here (nếu có)
        // Ví dụ: validation, transformation, filtering
        
        // Call repository
        repository.[method]([params], new I[Repository]Repository.RepositoryCallback<[Type]>() {
            @Override
            public void onSuccess([Type] result) {
                // Post-processing (nếu cần)
                // Ví dụ: sort, filter, map
                
                callback.onSuccess(result);
            }
            
            @Override
            public void onError(String error) {
                callback.onError(error);
            }
        });
    }
    
    /**
     * Callback interface for use case result
     */
    public interface Callback<T> {
        void onSuccess(T result);
        void onError(String error);
    }
}
```

### **Ví dụ cụ thể - CreateTaskUseCase:**

```java
package com.example.tralalero.domain.usecase.task;

import com.example.tralalero.domain.model.Task;
import com.example.tralalero.domain.model.IssueStatus;
import com.example.tralalero.domain.model.Priority;
import com.example.tralalero.domain.repository.ITaskRepository;

/**
 * UseCase: Create a new task
 * 
 * Input: String boardId, Task task
 * Output: Task (created)
 * 
 * Business Logic:
 * - Validate title is not empty
 * - Set default status = TO_DO if not set
 * - Set default priority = MEDIUM if not set
 * - Validate boardId exists
 */
public class CreateTaskUseCase {
    
    private final ITaskRepository taskRepository;
    
    public CreateTaskUseCase(ITaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }
    
    /**
     * Create a new task in the specified board
     * 
     * @param boardId Board ID where task will be created
     * @param task Task object to create
     * @param callback Callback to receive result
     */
    public void execute(String boardId, Task task, Callback<Task> callback) {
        // Validate board ID
        if (boardId == null || boardId.trim().isEmpty()) {
            callback.onError("Board ID cannot be empty");
            return;
        }
        
        // Validate task
        if (task == null) {
            callback.onError("Task cannot be null");
            return;
        }
        
        // Validate title
        if (task.getTitle() == null || task.getTitle().trim().isEmpty()) {
            callback.onError("Task title cannot be empty");
            return;
        }
        
        // Apply business rules
        Task processedTask = applyBusinessRules(task);
        
        // Call repository
        taskRepository.createTask(boardId, processedTask, 
            new ITaskRepository.RepositoryCallback<Task>() {
                @Override
                public void onSuccess(Task result) {
                    callback.onSuccess(result);
                }
                
                @Override
                public void onError(String error) {
                    callback.onError(error);
                }
            }
        );
    }
    
    /**
     * Apply business rules to task before creation
     */
    private Task applyBusinessRules(Task task) {
        // Set default status if not set
        IssueStatus status = task.getStatus() != null ? 
            task.getStatus() : IssueStatus.TO_DO;
        
        // Set default priority if not set
        Priority priority = task.getPriority() != null ? 
            task.getPriority() : Priority.MEDIUM;
        
        // Create new task with business rules applied
        return new Task(
            task.getId(),
            task.getProjectId(),
            task.getBoardId(),
            task.getTitle(),
            task.getDescription(),
            task.getAssigneeId(),
            task.getCreatedBy(),
            task.getDueAt(),
            task.getStartAt(),
            priority,  // Applied default
            task.getPosition(),
            task.getIssueKey(),
            task.getType(),
            status,    // Applied default
            task.getSprintId(),
            task.getEpicId(),
            task.getParentTaskId(),
            task.getStoryPoints(),
            task.getOriginalEstimateSec(),
            task.getRemainingEstimateSec(),
            task.getCreatedAt(),
            task.getUpdatedAt(),
            task.getDeletedAt()
        );
    }
    
    /**
     * Callback interface for use case result
     */
    public interface Callback<T> {
        void onSuccess(T result);
        void onError(String error);
    }
}
```

---

## 📝 HƯỚNG DẪN TRIỂN KHAI

### **Bước 1: Setup workspace**

```bash
# Mỗi người tạo branch riêng
git checkout -b feature/usecases-[module-name]

# Ví dụ:
git checkout -b feature/usecases-workspace-project   # Người 1
git checkout -b feature/usecases-board-notification  # Người 2
git checkout -b feature/usecases-task                # Người 3
```

### **Bước 2: Tạo UseCase classes**

Mỗi UseCase class cần có:

1. **Package declaration** - Đúng package theo module
2. **Imports** - Import domain models và repository interfaces
3. **JavaDoc** - Mô tả UseCase, Input/Output, Business Logic
4. **Constructor** - Inject repository qua constructor
5. **execute() method** - Method chính để thực thi UseCase
6. **Business logic** - Validation, transformation, rules
7. **Repository call** - Gọi repository với callback
8. **Callback interface** - Interface để trả kết quả

### **Bước 3: Testing**

**Unit Test cho mỗi UseCase:**

```java
// Ví dụ: CreateTaskUseCaseTest.java
@Test
public void testCreateTask_Success() {
    // Given
    Task task = new Task(...);
    String boardId = "board-123";
    
    // When
    useCase.execute(boardId, task, callback);
    
    // Then
    verify(repository).createTask(eq(boardId), any(Task.class), any());
    verify(callback).onSuccess(any(Task.class));
}

@Test
public void testCreateTask_EmptyTitle_ShouldFail() {
    // Given
    Task task = new Task(null, null, null, "", ...); // Empty title
    
    // When
    useCase.execute("board-123", task, callback);
    
    // Then
    verify(callback).onError("Task title cannot be empty");
    verify(repository, never()).createTask(any(), any(), any());
}
```

### **Bước 4: Code Review Checklist**

Trước khi submit PR, kiểm tra:

- [ ] Tất cả UseCases đã được tạo theo danh sách
- [ ] JavaDoc đầy đủ cho mỗi class và method
- [ ] Input validation đầy đủ (null check, empty check)
- [ ] Business logic được implement đúng theo spec
- [ ] Error messages rõ ràng và hữu ích
- [ ] Code format đúng chuẩn (4 spaces indent)
- [ ] Không có hardcoded values
- [ ] Repository được inject qua constructor (DI)
- [ ] Unit tests pass 100%
- [ ] Không có lỗi compile

### **Bước 5: Submit Pull Request**

```bash
# Commit changes
git add .
git commit -m "feat: implement [module] use cases"

# Push to remote
git push origin feature/usecases-[module-name]

# Create PR với template:
Title: [Phase 3] Implement [Module] UseCases
Description:
- Implemented [số] UseCases for [module]
- All UseCases have proper validation
- Unit tests included
- Checklist: [link to this document]
```

---

## 🎯 ACCEPTANCE CRITERIA

### **Định nghĩa "Hoàn thành" cho Phase 3:**

1. ✅ **Tất cả 39 UseCases đã được tạo**
   - Workspace: 5 UseCases
   - Project: 6 UseCases
   - Board: 6 UseCases
   - Notification: 7 UseCases
   - Task: 15 UseCases

2. ✅ **Mỗi UseCase có đầy đủ:**
   - JavaDoc mô tả rõ ràng
   - Input validation
   - Business logic (nếu có)
   - Repository call với proper callback handling
   - Error handling

3. ✅ **Code quality:**
   - Không có lỗi compile
   - Follow naming conventions
   - Proper indentation
   - No code duplication

4. ✅ **Unit tests:**
   - Mỗi UseCase có ít nhất 2 test cases (success & error)
   - Test coverage > 80%

5. ✅ **Documentation:**
   - README trong mỗi module package
   - Code examples trong JavaDoc

---

## 📅 TIMELINE ƯỚC TÍNH

### **Phase 3 Timeline:**

| Ngày | Milestone | Người phụ trách |
|------|-----------|----------------|
| **10/10** | Kickoff meeting - Phân công nhiệm vụ | Team Lead |
| **11/10** | Người 1: Hoàn thành Workspace UseCases (5) | Người 1 |
| **11/10** | Người 2: Hoàn thành Board UseCases (6) | Người 2 |
| **11/10** | Người 3: Hoàn thành Core Task UseCases (8) | Người 3 |
| **12/10** | Người 1: Hoàn thành Project UseCases (6) | Người 1 |
| **12/10** | Người 2: Hoàn thành Notification UseCases (7) | Người 2 |
| **12/10** | Người 3: Hoàn thành Advanced Task UseCases (7) | Người 3 |
| **13/10** | Code Review & Fixes | All |
| **13/10** | Merge all branches | Team Lead |
| **14/10** | Integration Testing | All |
| **14/10** | Phase 3 Done ✅ | - |

**Tổng thời gian:** 4 ngày làm việc

---

## ⚠️ LƯU Ý QUAN TRỌNG

### **1. Dependency Injection**

Tất cả UseCases phải nhận Repository qua constructor:

```java
// ✅ ĐÚNG
public class GetWorkspacesUseCase {
    private final IWorkspaceRepository repository;
    
    public GetWorkspacesUseCase(IWorkspaceRepository repository) {
        this.repository = repository;
    }
}

// ❌ SAI - Không khởi tạo repository trong UseCase
public class GetWorkspacesUseCase {
    private final IWorkspaceRepository repository = new WorkspaceRepositoryImpl(...);
}
```

### **2. Single Responsibility**

Mỗi UseCase chỉ làm 1 việc duy nhất:

```java
// ✅ ĐÚNG - Mỗi UseCase một nhiệm vụ riêng
CreateTaskUseCase
UpdateTaskUseCase
DeleteTaskUseCase

// ❌ SAI - UseCase làm nhiều việc
TaskManagementUseCase {
    createTask()
    updateTask()
    deleteTask()
}
```

### **3. Error Handling**

Luôn validate input và handle errors:

```java
public void execute(String id, Callback callback) {
    // Validate input
    if (id == null || id.isEmpty()) {
        callback.onError("ID cannot be empty");
        return; // Important: return after error
    }
    
    // Proceed with logic
    repository.get(id, new RepositoryCallback() {
        @Override
        public void onError(String error) {
            callback.onError(error); // Forward error
        }
    });
}
```

### **4. Không hardcode values**

```java
// ❌ SAI
if (task.getTitle().length() > 100) {
    callback.onError("Title too long");
}

// ✅ ĐÚNG
private static final int MAX_TITLE_LENGTH = 100;

if (task.getTitle().length() > MAX_TITLE_LENGTH) {
    callback.onError("Title cannot exceed " + MAX_TITLE_LENGTH + " characters");
}
```

### **5. Testing**

Mỗi UseCase phải có unit tests:

```java
// CreateTaskUseCaseTest.java
@Test
public void execute_ValidTask_ShouldSucceed() { ... }

@Test
public void execute_NullTask_ShouldReturnError() { ... }

@Test
public void execute_EmptyTitle_ShouldReturnError() { ... }

@Test
public void execute_RepositoryError_ShouldForwardError() { ... }
```

---

## 🚀 SAU KHI HOÀN THÀNH PHASE 3

### **Phase 4: Presentation Layer (Dự kiến 1 tuần)**

**Mục tiêu:** Tạo ViewModels và refactor UI

**Công việc chính:**

1. **Tạo ViewModels** (12-15 ViewModels)
   - WorkspaceViewModel
   - ProjectViewModel
   - BoardViewModel
   - TaskViewModel
   - NotificationViewModel
   - Etc.

2. **Refactor Activities/Fragments**
   - HomeActivity → Dùng WorkspaceViewModel
   - WorkspaceActivity → Dùng ProjectViewModel
   - ProjectActivity → Dùng BoardViewModel & TaskViewModel
   - Etc.

3. **Update Adapters**
   - Migrate từ old models sang domain models
   - Thêm DiffUtil cho RecyclerView
   - Implement ViewHolder pattern đúng cách

**Phân công có thể tương tự:**
- Người 1: Workspace + Project ViewModels
- Người 2: Board + Notification ViewModels
- Người 3: Task ViewModels (phức tạp nhất)

---

## 📞 HỖ TRỢ & LIÊN HỆ

### **Khi gặp vấn đề:**

1. **Repository không có method cần thiết:**
   - Kiểm tra lại `domain/repository/I[Module]Repository.java`
   - Nếu thiếu, thông báo Team Lead để bổ sung

2. **Không hiểu business logic:**
   - Tham khảo document trong `docs/`
   - Hỏi Product Owner hoặc Team Lead

3. **Conflict với code khác:**
   - Pull latest code từ develop
   - Resolve conflicts cẩn thận
   - Test lại sau khi resolve

4. **API endpoint chưa có:**
   - Đánh dấu "Pending API" trong comment
   - Implement logic, sẽ hoạt động khi API sẵn sàng

### **Resources:**

- **Repository Testing Guide:** `docs/Repository_Testing_Guide.md`
- **Test Activity Guide:** `docs/Test_Repository_In_Activity_Guide.md`
- **API Endpoints:** `docs/api-endpoints.md`
- **Package Structure:** `docs/Current_Package_Structure.md`

---

## ✅ CHECKLIST TỔNG THỂ

### **Trước khi bắt đầu:**
- [ ] Đọc kỹ document này
- [ ] Hiểu rõ module được phân công
- [ ] Setup development environment
- [ ] Create feature branch
- [ ] Pull latest code from develop

### **Trong quá trình làm:**
- [ ] Follow template code
- [ ] Write JavaDoc cho mỗi class
- [ ] Validate inputs properly
- [ ] Handle errors gracefully
- [ ] Write unit tests
- [ ] Test manually (nếu có thể)

### **Trước khi submit PR:**
- [ ] All UseCases implemented
- [ ] No compile errors
- [ ] All tests pass
- [ ] Code formatted properly
- [ ] JavaDoc complete
- [ ] Self code review
- [ ] Update CHANGELOG (nếu có)

### **Sau khi submit PR:**
- [ ] Address code review comments
- [ ] Fix failing tests
- [ ] Update based on feedback
- [ ] Rebase if needed
- [ ] Wait for approval

---

## 🎉 KẾT LUẬN

**Phase 3 là phase quan trọng** để hoàn thiện Domain Layer - trung tâm của Clean Architecture.

**UseCases giúp:**
- ✅ Tách biệt business logic khỏi UI
- ✅ Code dễ test hơn
- ✅ Dễ maintain và mở rộng
- ✅ Tái sử dụng được trong nhiều contexts
- ✅ Tuân theo SOLID principles

**Sau khi hoàn thành Phase 3:**
- Sẽ có 39 UseCases hoạt động tốt
- Có thể bắt đầu Phase 4 (ViewModels)
- Architecture sẽ rõ ràng và maintainable
- Dễ dàng onboard members mới

**Chúc team làm việc hiệu quả! 🚀**

---

**Document version:** 1.0  
**Last updated:** 10/10/2025  
**Author:** AI Assistant  
**Reviewers:** Team Lead, Product Owner

