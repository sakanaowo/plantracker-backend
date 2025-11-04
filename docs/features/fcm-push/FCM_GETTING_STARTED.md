# 🚀 HƯỚNG DẪN BẮT ĐẦU TRIỂN KHAI FCM

## ⚡ QUICK START

### Bước 1: Đọc Tình Trạng Hiện Tại
```bash
Đọc file: docs/FCM_QUICK_SUMMARY.md
```

### Bước 2: Backend Setup (BẮT ĐẦU NGAY - CHỈ 23 PHÚT)

#### ~~2.1. Thêm table vào database~~ ✅ BỎ QUA
**Table `user_devices` ĐÃ TỒN TẠI trong database!**
```bash
# ĐÃ VERIFY:
✅ Table user_devices có trong DB
✅ Prisma schema đã sync
✅ Migration status: UP TO DATE
```

#### 2.2. Verify DTOs đã tạo (1 phút)
```bash
ls plantracker-backend/src/modules/notifications/dto/
# Phải thấy:
# - register-device.dto.ts ✅
# - update-token.dto.ts ✅
# - device-response.dto.ts ✅
# - index.ts ✅
```

#### 2.3. Update DTOs để match schema thực tế (5 phút)
```bash
# Sửa register-device.dto.ts:
# - deviceName → deviceModel
# - Xóa osVersion

# Xem code mẫu trong FCM_IMPLEMENTATION_PLAN.md (Bước 1.3)
```

#### 2.4. Thêm code vào UsersController & UsersService (17 phút)
```bash
# Copy code từ FCM_IMPLEMENTATION_PLAN.md
# - Bước 1.4: UsersController (4 endpoints)
# - Bước 1.5: UsersService (4 methods + mapper)
```

---

### Bước 3: Android Setup

#### 3.1. Tạo DTOs (10 phút - Giảm 5 phút)
```bash
# Tạo folder
mkdir -p Plantracker/app/src/main/java/com/example/tralalero/data/remote/dto/fcm

# Tạo files (copy code từ plan):
# - RegisterDeviceRequest.java (LƯU Ý: deviceModel thay vì deviceName)
# - DeviceResponse.java (LƯU Ý: deviceModel thay vì deviceName)
# - UpdateTokenRequest.java
```

#### 3.2. Tạo API Service
```bash
# File: FcmApiService.java (copy từ plan)
```

#### 3.3. Update MyFirebaseMessagingService
```bash
# Implement sendTokenToServer() thật sự
# Copy code từ Bước 2.4 trong plan
```

#### 3.4. Request Permission trong HomeActivity
```bash
# Thêm permission request logic
# Copy từ Bước 2.5 trong plan
```

---

## 📋 CHECKLIST NHANH

### Backend:
- [x] Table `user_devices` đã tạo trong DB ✅
- [x] DTOs files có trong `src/modules/notifications/dto/` ✅
- [ ] DTOs đã update: deviceModel thay vì deviceName
- [ ] UsersController có 4 FCM endpoints
- [ ] UsersService có implement methods
- [ ] Test với Postman → 200 OK

### Android:
- [ ] DTOs Java classes đã tạo
- [ ] FcmApiService.java đã tạo
- [ ] sendTokenToServer() đã implement
- [ ] Permission request đã thêm vào HomeActivity
- [ ] Build thành công, không có errors

### Testing:
- [ ] Login vào app → check Logcat thấy "Token registered successfully"
- [ ] Vào database → thấy record trong table `user_devices`
- [ ] Gửi test notification từ Firebase Console → nhận được

---

## 🆘 TROUBLESHOOTING

### ~~"Table user_devices does not exist"~~
→ ✅ KHÔNG CÒN ISSUE NÀY! Table đã có sẵn.

### "Cannot find symbol: class FcmApiService"
→ Rebuild project: Build → Clean Project → Rebuild Project

### "401 Unauthorized"
→ Check JWT token còn valid không, login lại

### "Permission denied"
→ Android 13+ cần runtime permission, check code trong HomeActivity

### "Schema mismatch: deviceName vs deviceModel"
→ Check DTOs đã update đúng chưa: deviceModel thay vì deviceName

---

## 📁 FILES QUAN TRỌNG

**Đã tạo sẵn:**
- `docs/FCM_IMPLEMENTATION_PLAN.md` - Plan đầy đủ 3 giờ (rút ngắn!)
- `docs/FCM_QUICK_SUMMARY.md` - Tóm tắt tình trạng
- `plantracker-backend/src/modules/notifications/dto/*` - DTOs backend (cần update)

**Cần sửa (theo plan):**
1. `plantracker-backend/src/modules/notifications/dto/register-device.dto.ts` - Update DTO
2. `plantracker-backend/src/modules/users/users.controller.ts` - Thêm endpoints
3. `plantracker-backend/src/modules/users/users.service.ts` - Implement methods
4. `Plantracker/app/.../service/MyFirebaseMessagingService.java` - sendTokenToServer()
5. `Plantracker/app/.../HomeActivity.java` - Request permission
6. Tạo mới: `FcmApiService.java` và Java DTOs

---

## ⏱️ TIMELINE

- Backend: **23 phút** (rút ngắn từ 60 phút!)
- Android: 90 phút
- Testing: 60 phút
- **TỔNG: 3 giờ** (tiết kiệm 1 giờ!)

---

## 🎯 KẾT QUẢ MONG ĐỢI

Sau khi hoàn thành:
- ✅ Android app tự động gửi FCM token lên backend sau login
- ✅ Backend lưu token vào database
- ✅ Có thể gửi notification từ Firebase Console
- ✅ App nhận và hiển thị notification
- ✅ Foundation sẵn sàng cho advanced features (topics, rich notifications, etc.)

---

**BẮT ĐẦU NGAY:** Mở file `FCM_IMPLEMENTATION_PLAN.md` và làm theo từng bước!

## 🎉 UPDATE (28/10/2025)

**Phát hiện mới:**
- ✅ Database đã có table `user_devices`!
- ✅ Không cần chạy migration!
- ✅ Tiết kiệm 1 giờ setup!
- ⚠️ Schema khác một chút: `device_model` thay vì `device_name`
