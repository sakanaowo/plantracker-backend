# 🚨 ISSUE: OAuth 403 - Access Denied

**Error**: `Lỗi 403: access_denied`  
**Reason**: App chưa verified và user chưa được thêm vào test users list

---

## ✅ SOLUTION: Thêm Test Users

### Bước 1: Vào Google Cloud Console
1. **URL**: https://console.cloud.google.com/
2. **Project**: plantracker-590f5 (Project ID: 710677395196)

### Bước 2: Cấu hình OAuth Consent Screen
1. Vào **APIs & Services** → **OAuth consent screen**
2. Scroll xuống phần **Test users**
3. Click **+ ADD USERS**
4. Thêm email: `anhlandibo88@gmail.com`
5. Click **SAVE**

### Bước 3: (Optional) Thêm nhiều test users
Nếu cần test với nhiều accounts, thêm các emails khác:
- sakanaowo@gmail.com
- developer@plantracker.com
- etc.

---

## 🔄 SAU KHI THÊM TEST USERS

### Test lại OAuth flow:

**1. Get Auth URL (đã PASS)**
```bash
curl -X GET "http://localhost:3000/api/auth/google/auth-url" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**2. Mở Auth URL trong browser**
- Copy authUrl từ response
- Paste vào browser
- **BÂY GIỜ SẼ HOẠT ĐỘNG** vì email đã được thêm vào test users

**3. Authorize với Google**
- Click "Continue" hoặc "Tiếp tục"
- Chọn account: anhlandibo88@gmail.com
- Click "Allow" để cấp quyền Calendar

**4. Browser sẽ redirect về:**
```
http://localhost:3000/calendar/connected?success=true&email=anhlandibo88@gmail.com
```

**5. Check logs server để verify tokens saved**

---

## 📋 ALTERNATIVE: Publish App (For Production)

Nếu muốn app public cho tất cả users (không cần thêm test users):

1. Vào OAuth consent screen
2. Click **PUBLISH APP**
3. Submit for verification (có thể mất vài ngày)
4. Hoặc giữ ở "Testing" mode và chỉ thêm test users (đủ cho development)

---

## 🎯 RECOMMENDED: Giữ Testing Mode

Cho development và testing, **KHÔNG CẦN** publish app:
- ✅ Đơn giản hơn
- ✅ Không cần verification
- ✅ Chỉ cần add test users
- ✅ Đủ cho 100 test users

---

**Next Steps:**
1. ✅ Thêm `anhlandibo88@gmail.com` vào test users
2. ✅ Get auth URL lại (hoặc dùng URL cũ)
3. ✅ Authorize trong browser → SẼ HOẠT ĐỘNG!
4. ✅ Complete OAuth flow
5. ✅ Test calendar integration

---

**Status**: ⏳ Waiting for test user to be added
