# BÁO CÁO: CÁC PHẦN CẦN SỬA BÊN BACKEND
**Ngày:** 15/10/2025  
**Vấn đề:** Backend response trả về snake_case, Frontend expect camelCase  
**Người báo cáo:** AI Assistant  
**Priority:** 🔴 HIGH - Ảnh hưởng đến toàn bộ API responses

---

## 🔴 VẤN ĐỀ NGHIÊM TRỌNG

### **Backend đang trả về snake_case:**
```json
{
  "id": "caf87252-7e4a-4f8c-a150-d56ed3af7a7b",
  "project_id": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",  // ❌ snake_case
  "board_id": "8639c3e4-3492-406d-933b-bb225fbf8343",    // ❌ snake_case
  "title": "first task",
  "description": null,
  "assignee_id": null,                                    // ❌ snake_case
  "created_by": null,                                     // ❌ snake_case
  "due_at": null,                                         // ❌ snake_case
  "start_at": null,                                       // ❌ snake_case
  "priority": null,
  "position": "1024",
  "issue_key": null,                                      // ❌ snake_case
  "type": null,
  "status": "TO_DO",
  "sprint_id": null,                                      // ❌ snake_case
  "epic_id": null,                                        // ❌ snake_case
  "parent_task_id": null,                                 // ❌ snake_case
  "story_points": null,                                   // ❌ snake_case
  "original_estimate_sec": null,                          // ❌ snake_case
  "remaining_estimate_sec": null,                         // ❌ snake_case
  "created_at": "2025-10-15T05:02:38.492Z",              // ❌ snake_case
  "updated_at": "2025-10-15T05:02:38.492Z",              // ❌ snake_case
  "deleted_at": null                                      // ❌ snake_case
}
```

### **Frontend (Android/Mobile apps) expect camelCase:**
```json
{
  "id": "...",
  "projectId": "...",     // ✅ camelCase
  "boardId": "...",       // ✅ camelCase
  "assigneeId": null,     // ✅ camelCase
  "createdBy": null,      // ✅ camelCase
  "dueAt": null,          // ✅ camelCase
  "createdAt": "...",     // ✅ camelCase
  "updatedAt": "..."      // ✅ camelCase
}
```

---

## 🎯 GIẢI PHÁP CHO BACKEND (NestJS)

### **Option 1: Transform Interceptor (RECOMMENDED)** ⭐

Tạo một global interceptor để tự động convert tất cả responses sang camelCase.

#### **File: `src/common/interceptors/transform.interceptor.ts`**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {});
  }

  return obj;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => toCamelCase(data))
    );
  }
}
```

#### **Đăng ký trong `main.ts`:**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply transform interceptor globally
  app.useGlobalInterceptors(new TransformInterceptor());
  
  await app.listen(3000);
}
bootstrap();
```

**✅ Ưu điểm:**
- Tự động apply cho tất cả endpoints
- Không cần sửa từng controller/entity
- Dễ maintain
- Không ảnh hưởng đến database schema (vẫn dùng snake_case)

**❌ Nhược điểm:**
- Thêm overhead nhỏ cho mỗi response

---

### **Option 2: Class Transformer (Alternative)**

Sử dụng `class-transformer` với `@Expose()` decorator.

#### **File: `src/tasks/dto/task-response.dto.ts`**

```typescript
import { Expose } from 'class-transformer';

export class TaskResponseDto {
  @Expose()
  id: string;

  @Expose({ name: 'project_id' })
  projectId: string;

  @Expose({ name: 'board_id' })
  boardId: string;

  @Expose()
  title: string;

  @Expose()
  description: string;

  @Expose({ name: 'assignee_id' })
  assigneeId: string;

  @Expose({ name: 'created_by' })
  createdBy: string;

  @Expose({ name: 'due_at' })
  dueAt: Date;

  @Expose({ name: 'start_at' })
  startAt: Date;

  @Expose()
  priority: string;

  @Expose()
  position: number;

  @Expose({ name: 'issue_key' })
  issueKey: string;

  @Expose()
  type: string;

  @Expose()
  status: string;

  @Expose({ name: 'sprint_id' })
  sprintId: string;

  @Expose({ name: 'epic_id' })
  epicId: string;

  @Expose({ name: 'parent_task_id' })
  parentTaskId: string;

  @Expose({ name: 'story_points' })
  storyPoints: number;

  @Expose({ name: 'original_estimate_sec' })
  originalEstimateSec: number;

  @Expose({ name: 'remaining_estimate_sec' })
  remainingEstimateSec: number;

  @Expose({ name: 'created_at' })
  createdAt: Date;

  @Expose({ name: 'updated_at' })
  updatedAt: Date;

  @Expose({ name: 'deleted_at' })
  deletedAt: Date;
}
```

#### **Sử dụng trong Controller:**

```typescript
// src/tasks/tasks.controller.ts
import { Controller, Post, Body, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { plainToClass } from 'class-transformer';

@Controller('tasks')
@UseInterceptors(ClassSerializerInterceptor)
export class TasksController {
  @Post()
  async create(@Body() createTaskDto: CreateTaskDto) {
    const task = await this.tasksService.create(createTaskDto);
    
    // Transform to camelCase response
    return plainToClass(TaskResponseDto, task, { 
      excludeExtraneousValues: true 
    });
  }
}
```

**✅ Ưu điểm:**
- Type-safe với TypeScript
- Control chính xác từng field
- Có thể exclude sensitive fields

**❌ Nhược điểm:**
- Phải tạo DTO cho mỗi entity
- Nhiều boilerplate code
- Phải apply cho từng endpoint

---

### **Option 3: Prisma Transform (Database Level)**

Nếu dùng Prisma, có thể config field mapping.

#### **File: `prisma/schema.prisma`**

```prisma
model Task {
  id                  String    @id @default(uuid())
  projectId           String    @map("project_id")      // Map to snake_case in DB
  boardId             String    @map("board_id")
  title               String
  description         String?
  assigneeId          String?   @map("assignee_id")
  createdBy           String?   @map("created_by")
  dueAt               DateTime? @map("due_at")
  startAt             DateTime? @map("start_at")
  priority            String?
  position            Float
  issueKey            String?   @map("issue_key")
  type                String?
  status              String    @default("TO_DO")
  sprintId            String?   @map("sprint_id")
  epicId              String?   @map("epic_id")
  parentTaskId        String?   @map("parent_task_id")
  storyPoints         Int?      @map("story_points")
  originalEstimateSec Int?      @map("original_estimate_sec")
  remainingEstimateSec Int?     @map("remaining_estimate_sec")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  deletedAt           DateTime? @map("deleted_at")

  @@map("tasks")
}
```

#### **Regenerate Prisma Client:**

```bash
npx prisma generate
```

**✅ Ưu điểm:**
- Database giữ snake_case (convention)
- Application code dùng camelCase
- Prisma Client tự động mapping
- Không cần interceptor

**❌ Nhược điểm:**
- Chỉ work với Prisma
- Cần migrate lại nếu đã có data
- Breaking change nếu có service khác đang dùng DB

---

## 📋 CHECKLIST TRIỂN KHAI

### **Bước 1: Chọn giải pháp**
- [ ] Review 3 options trên
- [ ] Quyết định dùng Option nào (recommend: Option 1)
- [ ] Thảo luận với team về breaking changes

### **Bước 2: Implement**

#### **Nếu chọn Option 1 (Transform Interceptor):**
- [ ] Tạo file `transform.interceptor.ts`
- [ ] Register trong `main.ts`
- [ ] Test với 1 endpoint trước
- [ ] Deploy và test với frontend

#### **Nếu chọn Option 2 (Class Transformer):**
- [ ] Install `class-transformer`: `npm install class-transformer class-validator`
- [ ] Tạo Response DTOs cho tất cả entities
- [ ] Apply `ClassSerializerInterceptor` globally
- [ ] Update tất cả controllers

#### **Nếu chọn Option 3 (Prisma):**
- [ ] Backup database
- [ ] Update `schema.prisma` với `@map()` annotations
- [ ] Run `npx prisma generate`
- [ ] Test locally
- [ ] Create migration script nếu cần

### **Bước 3: Testing**

**Test các endpoints sau:**

1. **POST /api/tasks**
   ```bash
   # Request body: camelCase
   {
     "projectId": "...",
     "boardId": "...",
     "title": "Test"
   }
   
   # Response: camelCase
   {
     "id": "...",
     "projectId": "...",
     "boardId": "...",
     "createdAt": "..."
   }
   ```

2. **GET /api/tasks/by-board/{boardId}**
   ```bash
   # Response array: all camelCase
   [
     {
       "id": "...",
       "projectId": "...",
       "boardId": "..."
     }
   ]
   ```

3. **PATCH /api/tasks/{id}**
   ```bash
   # Request & Response: camelCase
   ```

4. **GET /api/boards?projectId={id}**
   ```bash
   # Response: camelCase
   [
     {
       "id": "...",
       "projectId": "...",
       "createdAt": "..."
     }
   ]
   ```

5. **GET /api/workspaces**
   ```bash
   # Response: camelCase
   [
     {
       "id": "...",
       "ownerId": "...",
       "createdAt": "..."
     }
   ]
   ```

### **Bước 4: Documentation**
- [ ] Update API documentation (Swagger/OpenAPI)
- [ ] Update example requests/responses
- [ ] Notify frontend team về changes
- [ ] Update Postman collection nếu có

---

## 🚨 LƯU Ý QUAN TRỌNG

### **Breaking Changes:**
⚠️ **Giải pháp này sẽ break tất cả clients hiện tại đang dùng snake_case!**

**Cần làm:**
1. **Versioning API:** Tạo `/api/v2/` với camelCase, giữ `/api/v1/` với snake_case
2. **Deprecation notice:** Thông báo clients migrate trong X tháng
3. **Support cả 2 format:** Dùng middleware để accept cả 2 (temporary)

### **Alternative: Support cả 2 format (Temporary)**

```typescript
// Middleware để accept cả camelCase và snake_case
function dualFormatMiddleware(req, res, next) {
  // Convert camelCase request body to snake_case for backend
  if (req.body) {
    req.body = toSnakeCase(req.body);
  }
  
  // Convert snake_case response to camelCase
  const originalSend = res.send;
  res.send = function(data) {
    if (typeof data === 'object') {
      data = toCamelCase(data);
    }
    return originalSend.call(this, data);
  };
  
  next();
}
```

---

## 📊 SO SÁNH GIẢI PHÁP

| Tiêu chí | Option 1: Interceptor | Option 2: Class Transformer | Option 3: Prisma |
|----------|----------------------|----------------------------|------------------|
| **Độ khó** | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Hard |
| **Maintenance** | ⭐⭐⭐ Low | ⭐⭐ Medium | ⭐⭐⭐ Low |
| **Performance** | ⭐⭐ Good | ⭐⭐⭐ Best | ⭐⭐ Good |
| **Type Safety** | ⭐ None | ⭐⭐⭐ Full | ⭐⭐⭐ Full |
| **Breaking Change** | ⚠️ Yes | ⚠️ Yes | ⚠️⚠️⚠️ Major |
| **Recommend** | ✅ Yes | ⭐ For new projects | ❌ Too risky |

---

## 🎯 RECOMMENDATION

### **Giải pháp đề xuất: Option 1 (Transform Interceptor)**

**Lý do:**
1. ✅ Dễ implement (< 30 minutes)
2. ✅ Không cần sửa existing code
3. ✅ Apply globally cho tất cả endpoints
4. ✅ Dễ rollback nếu có vấn đề
5. ✅ Không ảnh hưởng database

**Implementation plan:**
```
1. Tạo TransformInterceptor (10 mins)
2. Test trên local (10 mins)
3. Deploy lên staging (5 mins)
4. Test với frontend team (30 mins)
5. Deploy production (5 mins)
```

**Total time:** ~1 hour

---

## 🔧 SAMPLE CODE - TRANSFORM INTERCEPTOR

### **Full Implementation:**

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Convert snake_case to camelCase recursively
 */
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle plain objects
  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => 
        letter.toUpperCase()
      );
      
      // Recursively transform nested objects
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {});
  }

  // Return primitive types as-is
  return obj;
}

/**
 * Global interceptor to transform all responses to camelCase
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // Don't transform if data is undefined/null
        if (!data) {
          return data;
        }

        // Transform to camelCase
        return toCamelCase(data);
      })
    );
  }
}
```

### **Register in main.ts:**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors();
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe());
  
  // ✅ Apply transform interceptor globally
  app.useGlobalInterceptors(new TransformInterceptor());
  
  await app.listen(3000);
  console.log('🚀 Server running on http://localhost:3000');
  console.log('✅ All responses will be transformed to camelCase');
}
bootstrap();
```

---

## 🧪 TESTING SCRIPT

### **Test với curl:**

```bash
# Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
    "boardId": "8639c3e4-3492-406d-933b-bb225fbf8343",
    "title": "Test Task",
    "description": "Testing camelCase response"
  }'

# Expected response: camelCase ✅
# {
#   "id": "...",
#   "projectId": "...",  // ✅ camelCase
#   "boardId": "...",    // ✅ camelCase
#   "createdAt": "...",  // ✅ camelCase
#   "updatedAt": "..."   // ✅ camelCase
# }
```

---

## 📞 CONTACT

**Nếu cần hỗ trợ thêm:**
- Frontend team: Đã update DTOs để accept cả 2 formats (temporary)
- Backend team: Cần implement 1 trong 3 options trên
- DevOps: Cần plan deployment strategy

**Priority:** 🔴 **HIGH** - Cần fix ngay để app hoạt động đúng!

---

**Người tạo:** AI Assistant  
**Ngày:** 15/10/2025  
**Status:** ⏳ **CHỜ BACKEND TEAM IMPLEMENT**

