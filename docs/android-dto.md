# Android DTO Reference

Các DTO dưới đây được thiết kế dựa trên `prisma/schema.prisma` để phục vụ cho Android FE (Java). Mỗi mục thể hiện nội dung một file Java độc lập.

## File: `com/plantracker/android/dto/enums/Enums.java`

```java
package com.plantracker.android.dto.enums;

public enum WorkspaceType {
    PERSONAL,
    TEAM
}

public enum Role {
    OWNER,
    ADMIN,
    MEMBER
}

public enum Priority {
    LOW,
    MEDIUM,
    HIGH
}

public enum IssueType {
    TASK,
    STORY,
    BUG,
    EPIC,
    SUBTASK
}

public enum IssueStatus {
    TO_DO,
    IN_PROGRESS,
    IN_REVIEW,
    DONE
}

public enum NotificationChannel {
    PUSH,
    IN_APP,
    EMAIL
}

public enum NotificationPriority {
    LOW,
    NORMAL,
    HIGH
}

public enum NotificationStatus {
    QUEUED,
    SENT,
    DELIVERED,
    READ,
    FAILED
}

public enum NotificationType {
    TASK_ASSIGNED,
    TASK_MOVED,
    TIME_REMINDER,
    EVENT_INVITE,
    EVENT_UPDATED,
    MEETING_REMINDER,
    SYSTEM
}

public enum ParticipantStatus {
    INVITED,
    ACCEPTED,
    DECLINED,
    TENTATIVE
}
```

## File: `com/plantracker/android/dto/UserDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record UserDto(
    String id,
    String name,
    String email,
    String avatarUrl,
    String firebaseUid,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
```

## File: `com/plantracker/android/dto/WorkspaceMembershipDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import com.plantracker.android.dto.enums.Role;

public record WorkspaceMembershipDto(
    String id,
    String workspaceId,
    String userId,
    Role role,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/LabelDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record LabelDto(
    String id,
    String workspaceId,
    String name,
    String color,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
```

## File: `com/plantracker/android/dto/WorkspaceDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import java.util.List;
import com.plantracker.android.dto.enums.WorkspaceType;

public record WorkspaceDto(
    String id,
    String name,
    String ownerId,
    WorkspaceType type,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<LabelDto> labels,
    List<WorkspaceMembershipDto> memberships,
    List<ProjectDto> projects
) {}
```

## File: `com/plantracker/android/dto/BoardDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record BoardDto(
    String id,
    String projectId,
    String name,
    int order,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
```

## File: `com/plantracker/android/dto/SprintDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record SprintDto(
    String id,
    String projectId,
    String name,
    String goal,
    OffsetDateTime startAt,
    OffsetDateTime endAt,
    String state,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/ProjectDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record ProjectDto(
    String id,
    String workspaceId,
    String name,
    String description,
    String key,
    int issueSeq,
    String boardType,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<BoardDto> boards,
    List<SprintDto> sprints
) {}
```

## File: `com/plantracker/android/dto/AttachmentDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record AttachmentDto(
    String id,
    String taskId,
    String url,
    String mimeType,
    Integer size,
    String uploadedBy,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/ChecklistItemDto.java`

```java
package com.plantracker.android.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ChecklistItemDto(
    String id,
    String checklistId,
    String content,
    boolean isDone,
    BigDecimal position,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/ChecklistDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record ChecklistDto(
    String id,
    String taskId,
    String title,
    OffsetDateTime createdAt,
    List<ChecklistItemDto> items
) {}
```

## File: `com/plantracker/android/dto/TaskCommentDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record TaskCommentDto(
    String id,
    String taskId,
    String userId,
    String body,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/TaskWatcherDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record TaskWatcherDto(
    String taskId,
    String userId,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/TaskDto.java`

```java
package com.plantracker.android.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import com.plantracker.android.dto.enums.IssueStatus;
import com.plantracker.android.dto.enums.IssueType;
import com.plantracker.android.dto.enums.Priority;

public record TaskDto(
    String id,
    String projectId,
    String boardId,
    String title,
    String description,
    String assigneeId,
    String createdBy,
    OffsetDateTime dueAt,
    OffsetDateTime startAt,
    Priority priority,
    BigDecimal position,
    String issueKey,
    IssueType type,
    IssueStatus status,
    String sprintId,
    String epicId,
    String parentTaskId,
    Integer storyPoints,
    Integer originalEstimateSec,
    Integer remainingEstimateSec,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime deletedAt,
    List<LabelDto> labels,
    List<ChecklistDto> checklists,
    List<AttachmentDto> attachments,
    List<TaskCommentDto> comments,
    List<TaskWatcherDto> watchers
) {}
```

## File: `com/plantracker/android/dto/TimeEntryDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;

public record TimeEntryDto(
    String id,
    String taskId,
    String userId,
    OffsetDateTime startAt,
    OffsetDateTime endAt,
    Integer durationSec,
    String note,
    OffsetDateTime createdAt
) {}
```

## File: `com/plantracker/android/dto/NotificationDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import com.plantracker.android.dto.enums.NotificationChannel;
import com.plantracker.android.dto.enums.NotificationPriority;
import com.plantracker.android.dto.enums.NotificationStatus;
import com.plantracker.android.dto.enums.NotificationType;

public record NotificationDto(
    String id,
    String userId,
    NotificationType type,
    String title,
    String body,
    String dataJson,
    NotificationChannel channel,
    NotificationPriority priority,
    NotificationStatus status,
    OffsetDateTime scheduledAt,
    OffsetDateTime sentAt,
    OffsetDateTime deliveredAt,
    OffsetDateTime readAt,
    Integer ttlSec,
    String deeplink,
    Integer retryCount,
    String lastError,
    OffsetDateTime createdAt,
    String createdBy
) {}
```

## File: `com/plantracker/android/dto/EventDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record EventDto(
    String id,
    String projectId,
    String title,
    OffsetDateTime startAt,
    OffsetDateTime endAt,
    String location,
    String meetLink,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<ParticipantDto> participants
) {}
```

## File: `com/plantracker/android/dto/ParticipantDto.java`

```java
package com.plantracker.android.dto;

import java.time.OffsetDateTime;
import com.plantracker.android.dto.enums.ParticipantStatus;

public record ParticipantDto(
    String id,
    String eventId,
    String userId,
    String email,
    ParticipantStatus status,
    OffsetDateTime createdAt
) {}
```

