# 🔧 ACTION ITEMS: CODE CHANGES REQUIRED

**Những gì Backend team CẦN SỬA ngay**

---

## ❌ VẤN ĐỀ NGHIÊM TRỌNG CẦN FIX NGAY

### 1. **Projects Controller - Request Body sai format**

**File:** `src/modules/projects/projects.controller.ts`

#### ❌ Code hiện tại (SAI):

```typescript
@Post()
create(
  @Body()
  body: {
    name: string;
    workspace_id: string;  // ❌ SAI - snake_case
    key?: string;
    description?: string;
  },
) {
  return this.svc.create(body);
}
```

#### ✅ Cần sửa thành:

```typescript
@Post()
create(@Body() dto: CreateProjectDto) {
  return this.svc.create(dto);
}
```

#### ✅ Cần tạo DTO mới:

**File:** `src/modules/projects/dto/create-project.dto.ts` (CHƯA TỒN TẠI)

```typescript
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  workspaceId!: string; // ✅ ĐÚNG - camelCase

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

#### ✅ Import DTO trong controller:

```typescript
import { CreateProjectDto } from './dto/create-project.dto';
```

---

### 2. **Projects Service - Cần handle camelCase input**

**File:** `src/modules/projects/projects.service.ts`

#### Cần verify:

- Service method `create(body)` có handle đúng `workspaceId` không?
- Nếu service expect `workspace_id`, cần transform:

```typescript
async create(dto: CreateProjectDto) {
  return this.prisma.projects.create({
    data: {
      name: dto.name,
      workspace_id: dto.workspaceId,  // Transform here
      key: dto.key,
      description: dto.description,
      // ... other fields
    },
  });
}
```

---

### 3. **Projects Controller - Update method cũng cần DTO**

**File:** `src/modules/projects/projects.controller.ts`

#### ❌ Code hiện tại (SAI):

```typescript
@Patch(':id')
update(
  @Param('id') id: string,
  @Body() body: { name?: string; key?: string; description?: string },
) {
  return this.svc.update(id, body);
}
```

#### ✅ Cần tạo UpdateProjectDto:

**File:** `src/modules/projects/dto/update-project.dto.ts` (CHƯA TỒN TẠI)

```typescript
import { IsOptional, IsString } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

#### ✅ Update controller:

```typescript
import { UpdateProjectDto } from './dto/update-project.dto';

@Patch(':id')
update(
  @Param('id') id: string,
  @Body() dto: UpdateProjectDto,
) {
  return this.svc.update(id, dto);
}
```

---

## ⚠️ CẦN VERIFY (Có thể đã đúng nhưng cần test)

### 4. **Timers DTOs - Check camelCase**

**Files cần check:**

- `src/modules/timers/dto/create-timer.dto.ts`
- `src/modules/timers/dto/update-timer.dto.ts`

#### Cần verify:

```typescript
// create-timer.dto.ts
export class CreateTimerDto {
  @IsString()
  @IsNotEmpty()
  taskId!: string; // ✅ Phải là taskId (NOT task_id)
}

// update-timer.dto.ts
export class UpdateTimerDto {
  @IsOptional()
  @IsString()
  note?: string; // ✅ Should be ok

  // Check if there are other fields with underscore
}
```

---

### 5. **Move Task DTO - Check camelCase**

**File:** `src/modules/tasks/dto/move-task.dto.ts`

#### Cần verify:

```typescript
export class MoveTaskDto {
  @IsString()
  @IsNotEmpty()
  toBoardId!: string; // ✅ Phải là toBoardId (NOT to_board_id)

  @IsOptional()
  @IsString()
  beforeId?: string; // ✅ Phải là beforeId (NOT before_id)

  @IsOptional()
  @IsString()
  afterId?: string; // ✅ Phải là afterId (NOT after_id)
}
```

---

### 6. **Users DTOs - Check all fields**

**Files cần check:**

- `src/modules/users/dto/local-signup.dto.ts`
- `src/modules/users/dto/local-login.dto.ts`
- `src/modules/users/dto/firebase-auth.dto.ts`
- `src/modules/users/dto/update-me.dto.ts`

#### Cần verify:

```typescript
// local-signup.dto.ts
export class localSignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string; // ✅ Phải là displayName (NOT display_name)
}

// firebase-auth.dto.ts
export class FirebaseAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string; // ✅ Phải là idToken (NOT id_token)
}

// update-me.dto.ts
export class updateMeDto {
  @IsOptional()
  @IsString()
  displayName?: string; // ✅ Phải là displayName

  @IsOptional()
  @IsString()
  photoUrl?: string; // ✅ Phải là photoUrl (NOT photo_url)
}
```

---

### 7. **Workspaces DTOs - Check member-related fields**

**Files cần check:**

- `src/modules/workspaces/dto/add-member.dto.ts`

#### Cần verify:

```typescript
export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;  // ✅ Phải là userId (NOT user_id)

  @IsEnum(...)
  @IsNotEmpty()
  role!: string;  // ✅ Should be ok
}
```

---

## 📋 STEP-BY-STEP FIX GUIDE

### Step 1: Tạo CreateProjectDto

```bash
# Tạo file mới
New-Item -Path "src/modules/projects/dto/create-project.dto.ts" -ItemType File
```

**Paste code:**

```typescript
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

### Step 2: Tạo UpdateProjectDto

```bash
# Tạo file mới
New-Item -Path "src/modules/projects/dto/update-project.dto.ts" -ItemType File
```

**Paste code:**

```typescript
import { IsOptional, IsString } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

### Step 3: Update Projects Controller

**File:** `src/modules/projects/projects.controller.ts`

**Thêm imports:**

```typescript
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
```

**Sửa POST method:**

```typescript
@Post()
create(@Body() dto: CreateProjectDto) {
  return this.svc.create(dto);
}
```

**Sửa PATCH method:**

```typescript
@Patch(':id')
update(
  @Param('id') id: string,
  @Body() dto: UpdateProjectDto,
) {
  return this.svc.update(id, dto);
}
```

---

### Step 4: Update Projects Service

**File:** `src/modules/projects/projects.service.ts`

**Check method `create`:**

```typescript
async create(dto: CreateProjectDto) {
  // Transform camelCase → snake_case for Prisma
  return this.prisma.projects.create({
    data: {
      name: dto.name,
      workspace_id: dto.workspaceId,  // ⚠️ Transform here
      key: dto.key,
      description: dto.description,
      owner_id: userId,  // from context
      // ...
    },
  });
}
```

**Alternative (if using Prisma with @map):**

```typescript
// If Prisma schema has @map("workspace_id")
async create(dto: CreateProjectDto) {
  return this.prisma.projects.create({
    data: {
      name: dto.name,
      workspaceId: dto.workspaceId,  // Prisma handles mapping
      key: dto.key,
      description: dto.description,
      // ...
    },
  });
}
```

---

### Step 5: Verify All Other DTOs

**Run this checklist:**

```bash
# Check all DTO files for snake_case
Get-ChildItem -Path "src/modules/*/dto/*.dto.ts" -Recurse | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  if ($content -match "_[a-z]") {
    Write-Host "⚠️  CHECK: $($_.FullName)"
  }
}
```

**Manually review files printed by above command**

---

### Step 6: Test Everything

**Start server:**

```bash
npm run start:dev
```

**Check console output:**

```
✅ All API responses transformed to camelCase
```

**Test endpoints:**

```powershell
# Test create project
$body = @{
  name = "Test Project"
  workspaceId = "workspace-uuid"
  key = "TEST"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/projects" `
  -Method POST `
  -Headers @{"Authorization"="Bearer TOKEN"; "Content-Type"="application/json"} `
  -Body $body
```

---

## 🧪 TESTING CHECKLIST

After making changes, test these endpoints:

### Critical Tests:

- [ ] **POST /api/projects** - Should accept `workspaceId` in request
- [ ] **PATCH /api/projects/:id** - Should work with DTO
- [ ] **GET /api/projects?workspaceId=...** - Response should be camelCase
- [ ] **POST /api/tasks** - Should accept `projectId`, `boardId`
- [ ] **POST /api/timers/start** - Should accept `taskId`
- [ ] **POST /api/users/local/signup** - Should accept `displayName`
- [ ] **PUT /api/users/me** - Should accept `photoUrl`, `displayName`
- [ ] **POST /api/workspaces/:id/members** - Should accept `userId`

### Verify Responses:

- [ ] All responses return camelCase fields
- [ ] No `_` (underscore) in any field name
- [ ] Arrays of objects all have camelCase
- [ ] Nested objects have camelCase
- [ ] Null values don't cause errors

---

## 📊 PRIORITY MATRIX

| Task                    | Priority  | Impact   | Difficulty | Time   |
| ----------------------- | --------- | -------- | ---------- | ------ |
| Fix Projects Controller | 🔴 HIGH   | Breaking | Easy       | 15 min |
| Create Projects DTOs    | 🔴 HIGH   | Breaking | Easy       | 10 min |
| Update Projects Service | 🔴 HIGH   | Breaking | Medium     | 15 min |
| Verify Timers DTOs      | 🟡 MEDIUM | Medium   | Easy       | 5 min  |
| Verify Users DTOs       | 🟡 MEDIUM | Medium   | Easy       | 5 min  |
| Verify Move Task DTO    | 🟡 MEDIUM | Medium   | Easy       | 5 min  |
| Test all endpoints      | 🔴 HIGH   | Critical | Medium     | 30 min |

**Total estimated time:** ~1.5 hours

---

## ✅ COMPLETION CHECKLIST

### Code Changes:

- [ ] CreateProjectDto created
- [ ] UpdateProjectDto created
- [ ] Projects controller updated to use DTOs
- [ ] Projects service updated to handle camelCase
- [ ] All other DTOs verified for camelCase
- [ ] No snake_case in any DTO fields

### Testing:

- [ ] Server starts without errors
- [ ] Console shows interceptor message
- [ ] POST /api/projects works with camelCase
- [ ] All responses are camelCase
- [ ] Frontend can successfully call all APIs

### Documentation:

- [x] API specification created
- [x] Field mapping reference created
- [x] Action items documented
- [ ] Team notified of changes

---

**Start with Projects module first - it's the most critical!** 🔴

---

**Created:** October 15, 2025  
**Status:** 🚧 IN PROGRESS  
**Assigned to:** Backend Team
