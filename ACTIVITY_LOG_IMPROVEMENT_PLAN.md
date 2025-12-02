# 🎯 ACTIVITY LOG IMPROVEMENT PLAN - Dec 2, 2025 (Tonight)

## 📋 OBJECTIVES
1. Fix "not knowing name" issues in activity feed
2. Add missing logs (Leave Project, Project Deleted)
3. Standardize metadata/entityName structure
4. Complete context passing (workspaceId, projectId, boardId)
5. Implement real-time updates (WebSocket)

---

## 🔍 ROOT CAUSE ANALYSIS

### Issue 1: "user X created event (not knowing name)"
**Problem**: `eventTitle` passed to `logEventCreated()` but not stored in `entity_name`
```typescript
// events.service.ts - line 43
await this.activityLogsService.logEventCreated({
  projectId, eventId, userId,
  eventTitle: event.title,  // ✅ Passed
  eventType, startAt, endAt
});

// activity-logs.service.ts - line 840
async logEventCreated(params: {...}) {
  return this.log({
    action: 'CREATED',
    entityType: 'EVENT',
    entityId: params.eventId,
    entityName: params.eventTitle,  // ✅ Should work but check if actually saved
    metadata: { type, startAt, endAt }
  });
}
```
**Root Cause**: Need to verify if `entity_name` is properly populated in DB

### Issue 2: "you joined a project (not knowing name)"
**Problem**: `projectName` stored in `newValue` instead of `entity_name`
```typescript
// activity-logs.service.ts - line 569
async logMemberAdded(params: {...}) {
  return this.log({
    entityName: params.memberName,  // ❌ Shows invited person, not project
    newValue: params.projectName,   // ❌ Wrong place!
  });
}
```
**Solution**: Move `projectName` to `entity_name`

### Issue 3: "user X invited user Y to a project (not knowing name)"
**Same as Issue 2** - projectName in wrong field

### Issue 4: "Missing leave project log"
**Problem**: `leaveProject()` in projects.service.ts doesn't call logging
```typescript
// projects.service.ts - line 606
async leaveProject(projectId, userId) {
  // ... delete member ...
  // ❌ NO LOGGING!
  return { message: 'Successfully left' };
}
```

---

## ✅ PHASE 1: BACKEND FIXES (1.5 hours)

### Task 1.1: Fix MEMBERSHIP logs - entity_name structure (20 min)
**File**: `src/modules/activity-logs/activity-logs.service.ts`

**Current**:
```typescript
async logMemberAdded(params: {...}) {
  entityName: params.memberName,  // "John Doe"
  newValue: params.projectName,   // "Project X"
}
```

**Fix to**:
```typescript
async logMemberAdded(params: {...}) {
  entityName: params.projectName,  // "Project X" (what was joined)
  metadata: {
    role: params.role,
    memberId: params.memberId,
    memberName: params.memberName,  // "John Doe" (who joined)
    ...params.metadata
  }
}
```

**Why**: 
- `entity_name` should be the OBJECT (project)
- `metadata.memberName` is WHO performed action on that object
- Android can now display: "You joined project **Project X**"

### Task 1.2: Add missing context to all log calls (30 min)
**Files**: All service files calling `activityLogsService`

**Pattern**: Ensure ALL logs receive full context
```typescript
// ❌ BAD
await this.activityLogsService.logCommentCreated({
  taskId, commentId, userId
});

// ✅ GOOD  
const task = await this.prisma.tasks.findUnique({
  where: { id: taskId },
  include: { projects: { select: { workspace_id: true } } }
});

await this.activityLogsService.logCommentCreated({
  taskId, commentId, userId,
  workspaceId: task.projects.workspace_id,
  projectId: task.project_id,
  boardId: task.board_id
});
```

**Priority files**:
- [ ] `comments.service.ts` - logCommentCreated/Updated/Deleted
- [ ] `attachments.service.ts` - logAttachmentAdded/Removed
- [ ] `labels.service.ts` - logLabelAdded/Removed (already has taskId, need workspace/project/board)

### Task 1.3: Add Leave Project logging (15 min)
**File**: `src/modules/projects/projects.service.ts`

```typescript
async leaveProject(projectId: string, userId: string) {
  // ... existing logic ...
  
  // Get project name before deletion
  const project = await this.prisma.projects.findUnique({
    where: { id: projectId },
    select: { name: true, workspace_id: true }
  });
  
  await this.prisma.project_members.delete({ where: { id: member.id } });
  
  // ✅ ADD THIS
  await this.activityLogsService.logMemberRemoved({
    projectId,
    userId,  // Who left
    memberId: userId,  // Same person
    memberName: member.users.name,
    role: member.role,
    workspaceId: project.workspace_id,
    metadata: {
      action: 'SELF_LEFT',  // Distinguish from being removed
      projectName: project.name
    }
  });
  
  return { message: 'Successfully left the project', projectId };
}
```

### Task 1.4: Add Project Deleted logging (15 min)
**File**: `src/modules/projects/projects.service.ts`

Add new method to `activity-logs.service.ts`:
```typescript
async logProjectDeleted(params: {
  workspaceId: string;
  projectId: string;
  userId: string;
  projectName: string;
}) {
  return this.log({
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    userId: params.userId,
    action: 'DELETED',
    entityType: 'PROJECT',
    entityId: params.projectId,
    entityName: params.projectName,
  });
}
```

Then call in `projects.service.ts`:
```typescript
async deleteProject(projectId: string, userId: string) {
  const project = await this.prisma.projects.findUnique({
    where: { id: projectId },
    include: { workspaces: true }
  });
  
  // ✅ Log BEFORE deletion
  await this.activityLogsService.logProjectDeleted({
    workspaceId: project.workspace_id,
    projectId,
    userId,
    projectName: project.name
  });
  
  await this.prisma.projects.delete({ where: { id: projectId } });
  
  return { message: 'Project deleted successfully' };
}
```

### Task 1.5: Verify EVENT entity_name population (10 min)
**Check**: Run query to see if event names are actually stored
```sql
SELECT id, action, entity_type, entity_name, metadata 
FROM activity_logs 
WHERE entity_type = 'EVENT' 
ORDER BY created_at DESC 
LIMIT 5;
```

If `entity_name` is NULL, fix in `events.service.ts`:
```typescript
// Verify this is correct
await this.activityLogsService.logEventCreated({
  projectId: createEventDto.projectId,
  eventId: event.id,
  userId: userId,
  eventTitle: event.title,  // ← Make sure this maps to entity_name
  eventType: createEventDto.type || 'MEETING',
  startAt: event.start_at,
  endAt: event.end_at,
});
```

### Task 1.6: Add Board context to Label logs (10 min)
**File**: `src/modules/labels/labels.service.ts`

```typescript
async assignToTask(taskId: string, labelId: string, userId: string) {
  const [task, label] = await Promise.all([
    this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        projects: { select: { id: true, workspace_id: true, name: true } }
      }
    }),
    // ...
  ]);
  
  await this.activityLogsService.logLabelAdded({
    taskId,
    labelId,
    userId,
    labelName: label.name,
    labelColor: label.color,
    // ✅ ADD CONTEXT
    workspaceId: task.projects.workspace_id,
    projectId: task.projects.id,
    boardId: task.board_id
  });
}
```

---

## ✅ PHASE 2: REAL-TIME UPDATES (1 hour)

### Task 2.1: Install WebSocket dependencies (5 min)
```bash
cd plantracker-backend
npm install @nestjs/websockets @nestjs/platform-socket.io
npm install -D @types/socket.io
```

### Task 2.2: Create WebSocket Gateway (30 min)
**File**: `src/modules/activity-logs/activity-logs.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },  // ⚠️ Restrict in production
  namespace: 'activity-logs',
})
export class ActivityLogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivityLogsGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

  handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) {
      this.logger.warn(`Client ${client.id} connected without userId`);
      client.disconnect();
      return;
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(client.id);

    this.logger.log(`User ${userId} connected (socket: ${client.id})`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(client.id);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Subscribe to project activity feed
   */
  @SubscribeMessage('subscribe:project')
  handleProjectSubscribe(client: Socket, projectId: string) {
    client.join(`project:${projectId}`);
    this.logger.log(`Socket ${client.id} subscribed to project:${projectId}`);
  }

  @SubscribeMessage('unsubscribe:project')
  handleProjectUnsubscribe(client: Socket, projectId: string) {
    client.leave(`project:${projectId}`);
  }

  /**
   * Subscribe to user activity feed
   */
  @SubscribeMessage('subscribe:user')
  handleUserSubscribe(client: Socket, userId: string) {
    client.join(`user:${userId}`);
    this.logger.log(`Socket ${client.id} subscribed to user:${userId}`);
  }

  /**
   * Emit new activity log to relevant clients
   */
  async emitActivityLog(log: any) {
    // Emit to project room
    if (log.project_id) {
      this.server.to(`project:${log.project_id}`).emit('activity:new', log);
    }

    // Emit to workspace room
    if (log.workspace_id) {
      this.server.to(`workspace:${log.workspace_id}`).emit('activity:new', log);
    }

    // Emit to user who performed action
    if (log.user_id) {
      this.server.to(`user:${log.user_id}`).emit('activity:new', log);
    }

    // Emit to all project members (complex query)
    if (log.project_id) {
      // TODO: Get all project members and emit to their user rooms
    }
  }
}
```

### Task 2.3: Integrate Gateway with ActivityLogsService (15 min)
**File**: `src/modules/activity-logs/activity-logs.service.ts`

```typescript
import { ActivityLogsGateway } from './activity-logs.gateway';

@Injectable()
export class ActivityLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ActivityLogsGateway,  // ✅ Inject gateway
  ) {}

  private async log(data: BaseLogParams) {
    try {
      const result = await this.prisma.activity_logs.create({
        data: { /* ... */ },
        include: {
          users: {
            select: { id: true, name: true, avatar_url: true }
          }
        }
      });
      
      console.log(`✅ Activity log created: ${data.action} ${data.entityType}`);
      
      // ✅ Emit to WebSocket clients
      await this.gateway.emitActivityLog(result);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create activity log:', error);
      throw error;
    }
  }
}
```

### Task 2.4: Update Module (10 min)
**File**: `src/modules/activity-logs/activity-logs.module.ts`

```typescript
import { ActivityLogsGateway } from './activity-logs.gateway';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [ActivityLogsController],
  providers: [
    ActivityLogsService,
    ActivityLogsGateway,  // ✅ Add gateway
  ],
  exports: [ActivityLogsService, AuthModule],
})
export class ActivityLogsModule {}
```

---

## ✅ PHASE 3: ANDROID IMPLEMENTATION (1.5 hours)

### Task 3.1: Update ActivityLogDTO to handle new structure (15 min)
**File**: `ActivityLogDTO.java`

```java
public class ActivityLogDTO {
    private String id;
    private String userId;
    private String action;
    private String entityType;
    private String entityName;  // ✅ Now contains project name for MEMBERSHIP
    private String createdAt;
    
    private UserDTO users;
    
    // NEW: Parse metadata for additional context
    private Map<String, Object> metadata;
    private Map<String, Object> oldValue;
    private Map<String, Object> newValue;
    
    // Getters/Setters...
    
    public String getMemberName() {
        // Extract member name from metadata for MEMBERSHIP logs
        if (metadata != null && metadata.containsKey("memberName")) {
            return metadata.get("memberName").toString();
        }
        return null;
    }
}
```

### Task 3.2: Update ActivityLogAdapter message formatting (30 min)
**File**: `ActivityLogAdapter.java`

```java
private String formatActivityMessage(ActivityLog log) {
    boolean isSelf = currentUserId != null && currentUserId.equals(log.getUserId());
    String userName = isSelf ? "You" : log.getUserName();
    String action = log.getAction();
    String entityType = log.getEntityType();
    String entityName = log.getEntityName();  // ✅ Now contains correct names
    
    switch (action) {
        case "CREATED":
            if ("EVENT".equals(entityType)) {
                return userName + " created event \"" + entityName + "\"";  // ✅ Fixed
            }
            // ... other cases
            
        case "ADDED":
            if ("MEMBERSHIP".equals(entityType)) {
                // entityName = project name (e.g., "Project X")
                // metadata.memberName = invited person
                String invitedPerson = getMetadataValue(log.getMetadata(), "memberName");
                String invitationType = getMetadataValue(log.getMetadata(), "type");
                
                if ("INVITATION_ACCEPTED".equals(invitationType)) {
                    // Someone accepted invitation
                    if (isSelf) {
                        return "You joined project \"" + entityName + "\"";  // ✅ Fixed
                    } else {
                        return invitedPerson + " joined project \"" + entityName + "\"";
                    }
                } else {
                    // Someone was invited
                    if (isSelf) {
                        return "You invited " + invitedPerson + " to project \"" + entityName + "\"";
                    } else {
                        return userName + " invited " + invitedPerson + " to project \"" + entityName + "\"";
                    }
                }
            }
            return userName + " added " + entityType.toLowerCase();
            
        case "REMOVED":
            if ("MEMBERSHIP".equals(entityType)) {
                String action = getMetadataValue(log.getMetadata(), "action");
                if ("SELF_LEFT".equals(action)) {
                    // User left project themselves
                    if (isSelf) {
                        return "You left project \"" + entityName + "\"";  // ✅ New
                    } else {
                        return userName + " left project \"" + entityName + "\"";
                    }
                } else {
                    // User was removed by someone else
                    String removedPerson = getMetadataValue(log.getMetadata(), "memberName");
                    if (isSelf) {
                        return "You removed " + removedPerson + " from project \"" + entityName + "\"";
                    } else {
                        return userName + " removed " + removedPerson + " from project \"" + entityName + "\"";
                    }
                }
            }
            return userName + " removed " + entityType.toLowerCase();
            
        case "DELETED":
            if ("PROJECT".equals(entityType)) {
                if (isSelf) {
                    return "You deleted project \"" + entityName + "\"";  // ✅ New
                } else {
                    return userName + " deleted project \"" + entityName + "\"";
                }
            }
            return userName + " deleted " + entityType.toLowerCase() + " \"" + entityName + "\"";
    }
}
```

### Task 3.3: Add Socket.IO client library (10 min)
**File**: `app/build.gradle.kts`

```kotlin
dependencies {
    // WebSocket for real-time activity updates
    implementation("io.socket:socket.io-client:2.1.0")
    
    // ... existing dependencies
}
```

### Task 3.4: Create WebSocket Manager (30 min)
**File**: `ActivityLogWebSocketManager.java`

```java
public class ActivityLogWebSocketManager {
    private static final String TAG = "ActivityLogWebSocket";
    private static final String SOCKET_URL = "http://your-backend-url:3000/activity-logs";
    
    private Socket socket;
    private String userId;
    private ActivityLogListener listener;
    
    public interface ActivityLogListener {
        void onNewActivityLog(ActivityLog log);
    }
    
    public ActivityLogWebSocketManager(String userId, ActivityLogListener listener) {
        this.userId = userId;
        this.listener = listener;
        initSocket();
    }
    
    private void initSocket() {
        try {
            IO.Options options = new IO.Options();
            options.auth = Collections.singletonMap("userId", userId);
            
            socket = IO.socket(SOCKET_URL, options);
            
            socket.on(Socket.EVENT_CONNECT, args -> {
                Log.d(TAG, "Connected to activity log socket");
                subscribeToUser();
            });
            
            socket.on("activity:new", args -> {
                if (args.length > 0) {
                    JSONObject data = (JSONObject) args[0];
                    ActivityLog log = parseActivityLog(data);
                    if (listener != null) {
                        listener.onNewActivityLog(log);
                    }
                }
            });
            
            socket.on(Socket.EVENT_DISCONNECT, args -> {
                Log.d(TAG, "Disconnected from activity log socket");
            });
            
            socket.connect();
        } catch (URISyntaxException e) {
            Log.e(TAG, "Invalid socket URL", e);
        }
    }
    
    private void subscribeToUser() {
        socket.emit("subscribe:user", userId);
    }
    
    public void subscribeToProject(String projectId) {
        socket.emit("subscribe:project", projectId);
    }
    
    public void disconnect() {
        if (socket != null) {
            socket.disconnect();
        }
    }
    
    private ActivityLog parseActivityLog(JSONObject data) {
        // Parse JSON to ActivityLog object
        // ...
    }
}
```

### Task 3.5: Integrate WebSocket in ActivityFragment (15 min)
**File**: `ActivityFragment.java`

```java
public class ActivityFragment extends Fragment {
    private ActivityLogWebSocketManager wsManager;
    
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        
        // ... existing setup ...
        
        // ✅ Initialize WebSocket
        if (currentUserId != null) {
            wsManager = new ActivityLogWebSocketManager(
                currentUserId,
                log -> {
                    // Update UI on main thread
                    requireActivity().runOnUiThread(() -> {
                        activityAdapter.addActivityLog(log);  // Add new method to adapter
                        rvActivityFeed.smoothScrollToPosition(0);
                    });
                }
            );
        }
    }
    
    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (wsManager != null) {
            wsManager.disconnect();
        }
    }
}
```

---

## ⏱️ TIMELINE

| Phase | Task | Time | Start | End |
|-------|------|------|-------|-----|
| **PHASE 1** | Fix MEMBERSHIP entity_name | 20 min | 19:00 | 19:20 |
| | Add context to log calls | 30 min | 19:20 | 19:50 |
| | Add Leave Project log | 15 min | 19:50 | 20:05 |
| | Add Project Deleted log | 15 min | 20:05 | 20:20 |
| | Verify EVENT entity_name | 10 min | 20:20 | 20:30 |
| | Add Board context to Labels | 10 min | 20:30 | 20:40 |
| **Break** | | 10 min | 20:40 | 20:50 |
| **PHASE 2** | Install WebSocket deps | 5 min | 20:50 | 20:55 |
| | Create Gateway | 30 min | 20:55 | 21:25 |
| | Integrate with Service | 15 min | 21:25 | 21:40 |
| | Update Module | 10 min | 21:40 | 21:50 |
| **Break** | | 10 min | 21:50 | 22:00 |
| **PHASE 3** | Update ActivityLogDTO | 15 min | 22:00 | 22:15 |
| | Update Adapter formatting | 30 min | 22:15 | 22:45 |
| | Add Socket.IO library | 10 min | 22:45 | 22:55 |
| | Create WebSocket Manager | 30 min | 22:55 | 23:25 |
| | Integrate in Fragment | 15 min | 23:25 | 23:40 |
| **Testing** | E2E test all scenarios | 20 min | 23:40 | 00:00 |

**Total**: ~4 hours (19:00 - 00:00)

---

## ✅ TESTING CHECKLIST

After implementation, test these scenarios:

### Backend Tests
- [ ] Create event → Check activity log shows event name
- [ ] Invite user → Check log shows "X invited Y to project **[name]**"
- [ ] Accept invitation → Check log shows "Y joined project **[name]**"
- [ ] Leave project → Check log shows "X left project **[name]**"
- [ ] Delete project → Check log shows "X deleted project **[name]**"
- [ ] Add label → Check log has workspace/project/board context
- [ ] Comment on task → Check log has full context

### WebSocket Tests
- [ ] Connect to WebSocket → Check connection successful
- [ ] Subscribe to user feed → Check subscription
- [ ] Create task → Check real-time notification received
- [ ] Multiple tabs → Check all tabs receive updates

### Android Tests
- [ ] Launch ActivityFragment → Check feed loads
- [ ] Perform action → Check new log appears at top
- [ ] Pull to refresh → Check manual refresh works
- [ ] Accept invitation → Check "You joined project X" displays
- [ ] Leave project → Check "You left project X" displays
- [ ] Event creation → Check event name visible

---

## 🚀 DEPLOYMENT

### Backend
```bash
cd plantracker-backend

# 1. Test locally
npm run start:dev

# 2. Commit changes
git add .
git commit -m "feat: improve activity logs with real-time updates and better naming"

# 3. Push to develop
git push origin develop

# 4. Deploy (your deployment process)
# ...
```

### Android
```bash
cd Plantracker

# 1. Test on emulator
./gradlew assembleDebug

# 2. Commit changes
git add .
git commit -m "feat: sync activity log display with backend improvements"

# 3. Push
git push origin develop
```

---

## 📊 SUCCESS METRICS

After deployment:
- ✅ Zero "not knowing name" issues in activity feed
- ✅ All project actions (join/leave/delete) logged
- ✅ Real-time updates working (<500ms latency)
- ✅ All logs have complete context (workspace/project/board)
- ✅ Message formatting consistent and user-friendly

---

## 🔄 FUTURE IMPROVEMENTS (Not tonight)

- [ ] Pagination for activity feed (cursor-based)
- [ ] Activity filtering (by action, entity type, date)
- [ ] Activity search
- [ ] Local caching (Room database)
- [ ] Infinite scroll
- [ ] Activity grouping ("John made 5 changes")
- [ ] Export activity history
- [ ] Activity analytics dashboard
