# 📤 STORAGE UPLOAD - POSTMAN TESTING GUIDE

## 🎯 Tổng Quan

Hệ thống storage sử dụng **Supabase Storage** với cơ chế **Signed Upload URLs** (2-step upload process):

1. **Step 1**: Client request signed upload URL từ backend
2. **Step 2**: Client upload file trực tiếp lên Supabase sử dụng signed URL

### Ưu điểm:
✅ **Bảo mật**: File không đi qua backend server  
✅ **Performance**: Upload trực tiếp lên CDN  
✅ **Scalable**: Không tốn bandwidth của backend  

---

## 🏗️ KIẾN TRÚC

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  Client  │  Step 1 │   Backend    │         │   Supabase   │
│ (Postman)│────────>│   Server     │         │   Storage    │
└──────────┘         └──────────────┘         └──────────────┘
     │                      │                         │
     │  POST /storage/upload-url                      │
     │  { fileName: "avatar.jpg" }                    │
     │                      │                         │
     │                      │  Generate Signed URL    │
     │                      │────────────────────────>│
     │                      │                         │
     │                      │<────────────────────────│
     │  Response:           │  Return signed URL      │
     │  {                   │                         │
     │    path: "...",      │                         │
     │    signedUrl: "...", │                         │
     │    token: "..."      │                         │
     │  }                   │                         │
     │<─────────────────────│                         │
     │                                                 │
     │  Step 2: PUT to signedUrl                      │
     │  Body: File binary (image)                     │
     │────────────────────────────────────────────────>│
     │                                                 │
     │<────────────────────────────────────────────────│
     │  200 OK - File uploaded                        │
```

---

## 📝 API ENDPOINTS

### 1. **POST `/api/storage/upload-url`** - Request Upload URL

**Mục đích**: Lấy signed URL để upload file

**Authentication**: ✅ Required (Firebase Token)

**Request:**
```http
POST /api/storage/upload-url
Authorization: Bearer {firebase_token}
Content-Type: application/json

{
  "fileName": "avatar.jpg"
}
```

**Response:**
```json
{
  "path": "user-uuid/uploads/1729536000000-avatar.jpg",
  "signedUrl": "https://xxx.supabase.co/storage/v1/object/upload/sign/bucket-name/user-uuid/uploads/1729536000000-avatar.jpg?token=eyJhbG...",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Path Format:**
```
{userId}/uploads/{timestamp}-{slugified-filename}.{ext}

Example:
- Original: "My Photo 123.jpg"
- Slugified: "user-id/uploads/1729536000000-my-photo-123.jpg"
```

---

### 2. **GET `/api/storage/view-url`** - Get View URL

**Mục đích**: Lấy signed URL để xem/download file (có thời hạn 600s = 10 phút)

**Authentication**: ❌ Not required (Public endpoint)

**Request:**
```http
GET /api/storage/view-url?path=user-uuid/uploads/1729536000000-avatar.jpg
```

**Response:**
```json
{
  "signedUrl": "https://xxx.supabase.co/storage/v1/object/sign/bucket-name/user-uuid/uploads/1729536000000-avatar.jpg?token=eyJhbG..."
}
```

---

## 🧪 POSTMAN TESTING - CHI TIẾT TỪNG BƯỚC

### ✅ **TEST CASE 1: Upload Ảnh Avatar**

#### **STEP 1: Request Upload URL**

1. **Tạo Request mới trong Postman**
   - Method: `POST`
   - URL: `{{baseUrl}}/api/storage/upload-url`
   - Replace `{{baseUrl}}` với: `http://localhost:3000/api` hoặc production URL

2. **Headers Tab**
   ```
   Key: Authorization
   Value: Bearer {{firebase_token}}
   
   Key: Content-Type
   Value: application/json
   ```

3. **Body Tab**
   - Chọn: `raw`
   - Type: `JSON`
   ```json
   {
     "fileName": "avatar.jpg"
   }
   ```

4. **Send Request**

5. **Expected Response (200 OK)**
   ```json
   {
     "path": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a/uploads/1729536000000-avatar.jpg",
     "signedUrl": "https://abcdefgh.supabase.co/storage/v1/object/upload/sign/plantracker-storage/d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a/uploads/1729536000000-avatar.jpg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

6. **Copy giá trị `signedUrl`** để dùng ở step 2

---

#### **STEP 2: Upload File lên Supabase**

1. **Tạo Request MỚI trong Postman**
   - Method: `PUT` ⚠️ **CHÚ Ý: phải là PUT, không phải POST**
   - URL: Paste `signedUrl` từ step 1
   - Example: `https://abcdefgh.supabase.co/storage/v1/object/upload/sign/plantracker-storage/...?token=...`

2. **Headers Tab**
   ```
   Key: Content-Type
   Value: image/jpeg
   
   (hoặc image/png, image/webp tùy loại file)
   ```
   
   ⚠️ **KHÔNG CẦN Authorization header** (signed URL đã chứa token)

3. **Body Tab**
   - Chọn: `binary`
   - Click: `Select File`
   - Chọn file ảnh từ máy tính (avatar.jpg)

4. **Send Request**

5. **Expected Response (200 OK)**
   ```json
   {
     "Id": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a/uploads/1729536000000-avatar.jpg",
     "Key": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a/uploads/1729536000000-avatar.jpg"
   }
   ```

6. **Lưu lại `path`** từ Step 1 để dùng cho các request khác (update user avatar, task attachment, etc.)

---

#### **STEP 3: Verify Upload - Get View URL**

1. **Tạo Request mới**
   - Method: `GET`
   - URL: `{{baseUrl}}/api/storage/view-url?path={path_from_step1}`
   - Example: `http://localhost:3000/api/storage/view-url?path=d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a/uploads/1729536000000-avatar.jpg`

2. **Headers Tab**
   - KHÔNG CẦN headers (public endpoint)

3. **Send Request**

4. **Expected Response (200 OK)**
   ```json
   {
     "signedUrl": "https://abcdefgh.supabase.co/storage/v1/object/sign/plantracker-storage/d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a/uploads/1729536000000-avatar.jpg?token=eyJhbG..."
   }
   ```

5. **Copy `signedUrl` và mở trong browser** để xem ảnh

---

### ✅ **TEST CASE 2: Upload File Attachment cho Task**

#### Flow tương tự như Test Case 1, nhưng:

**STEP 1: Request Upload URL**
```json
{
  "fileName": "document.pdf"
}
```

**STEP 2: Upload File**
- Headers: `Content-Type: application/pdf`
- Body: binary (chọn file PDF)

**STEP 3: Attach to Task**
```http
POST /api/tasks/{taskId}/attachments
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "url": "user-id/uploads/1729536000000-document.pdf",
  "mimeType": "application/pdf",
  "size": 102400
}
```

---

### ✅ **TEST CASE 3: Upload Multiple Files**

Repeat Step 1-2 cho mỗi file:

```javascript
// Postman Pre-request Script (optional)
// Loop upload nhiều files

const files = [
  { name: "image1.jpg", type: "image/jpeg" },
  { name: "image2.png", type: "image/png" },
  { name: "document.pdf", type: "application/pdf" }
];

// For each file:
// 1. POST /storage/upload-url với fileName
// 2. PUT signedUrl với file binary
// 3. Collect paths
```

---

## 🔍 COMMON ISSUES & SOLUTIONS

### ❌ Error 1: `401 Unauthorized` khi request upload URL

**Lỗi:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Nguyên nhân:**
- Firebase token không hợp lệ hoặc đã hết hạn
- Thiếu `Authorization` header

**Giải pháp:**
1. Đảm bảo có header: `Authorization: Bearer {firebase_token}`
2. Login lại để lấy token mới
3. Kiểm tra token format (phải có "Bearer " prefix)

---

### ❌ Error 2: `400 Bad Request` khi upload file

**Lỗi:**
```json
{
  "statusCode": 400,
  "message": "CREATE_SIGNED_URL_FAILED"
}
```

**Nguyên nhân:**
- Supabase credentials không đúng
- Bucket không tồn tại
- Permissions không đúng

**Giải pháp:**
1. Kiểm tra `.env`:
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   SUPABASE_BUCKET=plantracker-storage
   ```
2. Verify bucket tồn tại trong Supabase Dashboard
3. Check bucket policies (RLS rules)

---

### ❌ Error 3: `403 Forbidden` khi PUT file lên signed URL

**Lỗi:**
```
403 Forbidden
Access Denied
```

**Nguyên nhân:**
- Signed URL đã hết hạn (thường có TTL ngắn, khoảng 60 giây)
- Content-Type không match

**Giải pháp:**
1. Request signed URL mới (Step 1)
2. Upload ngay lập tức sau khi nhận signed URL
3. Đảm bảo Content-Type header đúng:
   - `.jpg`, `.jpeg`: `image/jpeg`
   - `.png`: `image/png`
   - `.pdf`: `application/pdf`
   - `.webp`: `image/webp`

---

### ❌ Error 4: File upload nhưng không thấy trong Supabase Storage

**Nguyên nhân:**
- Upload thành công nhưng chưa refresh dashboard
- Path không đúng format

**Giải pháp:**
1. Refresh Supabase Storage Dashboard
2. Navigate đúng path: `{userId}/uploads/`
3. Check bucket name có đúng không

---

### ❌ Error 5: `fileName` validation error

**Lỗi:**
```json
{
  "statusCode": 400,
  "message": ["fileName should not be empty", "fileName must be a string"]
}
```

**Nguyên nhân:**
- Body request thiếu `fileName`
- `fileName` không phải string

**Giải pháp:**
```json
// ✅ CORRECT
{
  "fileName": "avatar.jpg"
}

// ❌ WRONG
{
  "file": "avatar.jpg"  // Wrong key
}

// ❌ WRONG
{
  "fileName": 123  // Wrong type
}
```

---

## 📊 POSTMAN COLLECTION EXAMPLE

```json
{
  "info": {
    "name": "PlanTracker - Storage",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Request Upload URL",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{firebase_token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"fileName\": \"avatar.jpg\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "{{baseUrl}}/storage/upload-url",
          "host": ["{{baseUrl}}"],
          "path": ["storage", "upload-url"]
        }
      }
    },
    {
      "name": "2. Upload File to Supabase",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Content-Type",
            "value": "image/jpeg"
          }
        ],
        "body": {
          "mode": "file",
          "file": {
            "src": "/path/to/avatar.jpg"
          }
        },
        "url": {
          "raw": "{{signedUrl}}",
          "host": ["{{signedUrl}}"]
        }
      }
    },
    {
      "name": "3. Get View URL",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/storage/view-url?path={{filePath}}",
          "host": ["{{baseUrl}}"],
          "path": ["storage", "view-url"],
          "query": [
            {
              "key": "path",
              "value": "{{filePath}}"
            }
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api"
    },
    {
      "key": "firebase_token",
      "value": "your_firebase_token_here"
    },
    {
      "key": "signedUrl",
      "value": "will_be_set_from_step1_response"
    },
    {
      "key": "filePath",
      "value": "will_be_set_from_step1_response"
    }
  ]
}
```

---

## 🎬 POSTMAN TEST SCRIPTS (Automation)

### Script cho Request Upload URL (Step 1)

**Tab: Tests**
```javascript
// Parse response
const response = pm.response.json();

// Validate response
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has required fields", function () {
    pm.expect(response).to.have.property('path');
    pm.expect(response).to.have.property('signedUrl');
    pm.expect(response).to.have.property('token');
});

// Save to environment variables for next request
pm.environment.set("signedUrl", response.signedUrl);
pm.environment.set("filePath", response.path);
pm.environment.set("uploadToken", response.token);

console.log("Signed URL:", response.signedUrl);
console.log("File Path:", response.path);
```

### Script cho Upload File (Step 2)

**Tab: Tests**
```javascript
pm.test("File uploaded successfully", function () {
    pm.response.to.have.status(200);
});

const response = pm.response.json();

pm.test("Response contains file key", function () {
    pm.expect(response).to.have.property('Key');
});

console.log("File uploaded at:", response.Key);
```

### Script cho Get View URL (Step 3)

**Tab: Tests**
```javascript
const response = pm.response.json();

pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has signedUrl", function () {
    pm.expect(response).to.have.property('signedUrl');
    pm.expect(response.signedUrl).to.include('https://');
});

// Save view URL
pm.environment.set("viewUrl", response.signedUrl);

console.log("View URL (valid for 10 minutes):", response.signedUrl);
console.log("Copy this URL to browser to view the file");
```

---

## 🔐 ENVIRONMENT VARIABLES

**Setup trong Postman:**

1. Click **Environments** (left sidebar)
2. Create new environment: "PlanTracker Local"
3. Add variables:

```
Variable        | Initial Value                    | Current Value
----------------|----------------------------------|----------------------------------
baseUrl         | http://localhost:3000/api        | http://localhost:3000/api
firebase_token  | (get from login response)        | eyJhbGciOiJSUzI1NiIs...
signedUrl       | (auto-set from script)           | https://xxx.supabase.co/...
filePath        | (auto-set from script)           | user-id/uploads/...
viewUrl         | (auto-set from script)           | https://xxx.supabase.co/...
```

---

## 📝 FILE NAME SLUGIFICATION RULES

Backend tự động chuyển đổi file name theo rules:

```javascript
Input:  "My Avatar Photo 123!@#.jpg"
Output: "user-id/uploads/1729536000000-my-avatar-photo-123.jpg"

Rules:
✅ Lowercase tất cả
✅ Thay spaces bằng dashes (-)
✅ Loại bỏ special characters
✅ Thêm timestamp prefix
✅ Preserve file extension
✅ Add userId prefix
```

**Examples:**
```
"Ảnh đại diện.png"           → "{userId}/uploads/1729536000000-anh-dai-dien.png"
"Document (Final v2).pdf"    → "{userId}/uploads/1729536000000-document-final-v2.pdf"
"Screenshot 2024-10-21.jpg"  → "{userId}/uploads/1729536000000-screenshot-2024-10-21.jpg"
"file"                       → "{userId}/uploads/1729536000000-file.jpg" (default .jpg)
```

---

## 🎯 SUPPORTED MIME TYPES

```javascript
// Images
"image/jpeg"      → .jpg, .jpeg
"image/png"       → .png
"image/webp"      → .webp
"image/gif"       → .gif
"image/svg+xml"   → .svg

// Documents
"application/pdf"                    → .pdf
"application/msword"                 → .doc
"application/vnd.openxmlformats..."  → .docx
"application/vnd.ms-excel"           → .xls
"application/vnd.openxmlformats..."  → .xlsx

// Text
"text/plain"      → .txt
"text/csv"        → .csv
"text/markdown"   → .md

// Archives
"application/zip"              → .zip
"application/x-rar-compressed" → .rar
```

---

## 🔬 ADVANCED TESTING

### Test với cURL (Alternative)

**Step 1: Get Upload URL**
```bash
curl -X POST http://localhost:3000/api/storage/upload-url \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName": "avatar.jpg"}'
```

**Step 2: Upload File**
```bash
# Lấy signedUrl từ response step 1
curl -X PUT "SIGNED_URL_FROM_STEP_1" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@/path/to/avatar.jpg"
```

**Step 3: Get View URL**
```bash
curl -X GET "http://localhost:3000/api/storage/view-url?path=PATH_FROM_STEP_1"
```

---

### Test với JavaScript/Fetch

```javascript
// Step 1: Get signed URL
const response1 = await fetch('http://localhost:3000/api/storage/upload-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ fileName: 'avatar.jpg' })
});

const { signedUrl, path } = await response1.json();

// Step 2: Upload file
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const response2 = await fetch(signedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type
  },
  body: file
});

console.log('File uploaded at:', path);

// Step 3: Get view URL
const response3 = await fetch(`http://localhost:3000/api/storage/view-url?path=${path}`);
const { signedUrl: viewUrl } = await response3.json();

console.log('View URL:', viewUrl);
```

---

## 📚 INTEGRATION EXAMPLES

### Example 1: Update User Avatar

```http
### 1. Get upload URL
POST /api/storage/upload-url
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "fileName": "avatar.jpg"
}

### 2. Upload file (sử dụng signedUrl từ response)
PUT {{signedUrl}}
Content-Type: image/jpeg
Body: binary file

### 3. Update user profile
PATCH /api/users/me
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "avatarUrl": "user-id/uploads/1729536000000-avatar.jpg"
}
```

### Example 2: Add Task Attachment

```http
### 1. Get upload URL
POST /api/storage/upload-url
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "fileName": "design-mockup.pdf"
}

### 2. Upload file
PUT {{signedUrl}}
Content-Type: application/pdf
Body: binary file

### 3. Add attachment to task
POST /api/tasks/{{taskId}}/attachments
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "url": "user-id/uploads/1729536000000-design-mockup.pdf",
  "mimeType": "application/pdf",
  "size": 2048000
}
```

---

## ✅ TESTING CHECKLIST

- [ ] Request upload URL với valid fileName
- [ ] Request upload URL với invalid fileName (empty, null)
- [ ] Request upload URL without authentication
- [ ] Upload file với correct Content-Type
- [ ] Upload file với wrong Content-Type
- [ ] Upload file lớn (> 5MB)
- [ ] Upload file với tên có special characters
- [ ] Upload file với tên tiếng Việt có dấu
- [ ] Get view URL với valid path
- [ ] Get view URL với invalid path
- [ ] Verify view URL expires sau 10 phút
- [ ] Upload multiple files liên tiếp
- [ ] Upload file, delete, upload lại cùng tên

---

## 📊 PERFORMANCE BENCHMARKS

**Expected Response Times:**

| Endpoint | Expected Time |
|----------|---------------|
| POST /storage/upload-url | < 200ms |
| PUT signedUrl (5MB file) | < 3s |
| GET /storage/view-url | < 100ms |

**File Size Limits:**

- Recommended: < 5MB per file
- Maximum: Check Supabase plan limits (usually 50MB)

---

## 🎓 SUMMARY

**Complete Flow:**
1. ✅ POST `/storage/upload-url` + fileName → Get signedUrl + path
2. ✅ PUT signedUrl + file binary → Upload to Supabase
3. ✅ Save `path` to database (user.avatar_url, attachment.url, etc.)
4. ✅ GET `/storage/view-url?path={path}` → Get temporary view URL

**Key Points:**
- 🔒 Step 1 requires authentication
- 🚀 Step 2 goes directly to Supabase (no auth needed, signed URL has token)
- 👁️ Step 3 is public (anyone with path can get view URL)
- ⏰ View URLs expire after 10 minutes
- 📝 File names are auto-slugified
- 🎯 Path format: `{userId}/uploads/{timestamp}-{slug}.{ext}`

---

**Document Version:** 1.0  
**Last Updated:** October 22, 2025  
**Tested With:** Postman v10.x
