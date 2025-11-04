# 🔔 WebSocket + FCM Real-time Notifications

## 📋 QUICK START

Backend đã hoàn thành WebSocket + FCM hybrid notification system. Android client cần triển khai để nhận real-time notifications.

---

## 📚 DOCUMENTS

### 🎯 Cho Android Developer - BẮT ĐẦU TỪ ĐÂY:

1. **[WEBSOCKET_FULL_STACK_SUMMARY.md](./WEBSOCKET_FULL_STACK_SUMMARY.md)** ⭐ **READ FIRST**
   - Tổng quan backend đã làm gì
   - Android cần làm gì
   - Timeline 4-5 giờ

2. **[ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md](./ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md)** 📖 **MAIN GUIDE**
   - Plan chi tiết từng bước
   - Full source code examples
   - 4 phases implementation

3. **[WEBSOCKET_ANDROID_CHECKLIST.md](./WEBSOCKET_ANDROID_CHECKLIST.md)** ✅ **CHECKLIST**
   - Step-by-step checklist
   - Track progress
   - Success criteria

4. **[WEBSOCKET_ANDROID_SUMMARY.md](./WEBSOCKET_ANDROID_SUMMARY.md)** 📝 **SUMMARY**
   - Quick reference
   - Key concepts
   - Testing guide

---

### 📖 Backend Documentation:

5. **[WEBSOCKET_IMPLEMENTATION_COMPLETE.md](./WEBSOCKET_IMPLEMENTATION_COMPLETE.md)**
   - Backend architecture
   - API reference
   - Integration examples

6. **[PUSH_NOTIFICATION_USE_CASES.md](./PUSH_NOTIFICATION_USE_CASES.md)**
   - 19 notification use cases
   - Data structure
   - Priority matrix

7. **[ANDROID_WEBSOCKET_INTEGRATION.md](./ANDROID_WEBSOCKET_INTEGRATION.md)**
   - WebSocket vs FCM comparison
   - Security best practices
   - Performance optimization

---

## 🚀 IMPLEMENTATION PATH

```
START HERE
    ↓
[1] Read WEBSOCKET_FULL_STACK_SUMMARY.md (10 min)
    ↓
[2] Read ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md (20 min)
    ↓
[3] Follow WEBSOCKET_ANDROID_CHECKLIST.md (4-5 hours)
    ↓
    ├─ Phase 1: WebSocket Client (90 min)
    ├─ Phase 2: Lifecycle Management (60 min)
    ├─ Phase 3: In-App UI (90 min)
    └─ Phase 4: Testing (60 min)
    ↓
DONE ✅
```

---

## ⚡ TL;DR

### Backend (✅ DONE):
- WebSocket server running on `/notifications` namespace
- Hybrid delivery: WebSocket (online) + FCM (offline)
- 19 use cases implemented
- JWT authentication

### Android (⏳ TODO):
- Implement WebSocket client (OkHttp)
- Add lifecycle management (connect/disconnect)
- Build in-app notification UI
- Test end-to-end

**Time:** 4-5 giờ  
**Complexity:** Medium  
**Impact:** High (Real-time < 100ms)

---

## 🧪 TESTING

### Backend Test (Available Now):
```bash
# Open browser
plantracker-backend/test-scripts/websocket-test-client.html

# OR use REST API
POST http://localhost:3000/notifications/test/send
Authorization: Bearer YOUR_JWT_TOKEN
```

### Android Test (After Implementation):
```
1. Login → Keep app open
2. Backend: Send test notification
3. Expected: Snackbar appears in < 100ms
4. Press Home → Backend sends again
5. Expected: System notification appears
```

---

## 📊 ARCHITECTURE

```
┌─────────────────────────────────────┐
│         ANDROID APP                 │
├─────────────────────────────────────┤
│  FOREGROUND: WebSocket (< 100ms)    │
│  BACKGROUND: FCM Push (1-10s)       │
└─────────────────────────────────────┘
                  ▲
                  │
                  ▼
┌─────────────────────────────────────┐
│       BACKEND (NestJS)              │
├─────────────────────────────────────┤
│  - Check isUserOnline()             │
│  - If online → WebSocket            │
│  - If offline → FCM                 │
└─────────────────────────────────────┘
```

---

## 🎯 EXPECTED RESULTS

### App Foreground:
- ⚡ Latency: < 100ms
- 📱 Display: In-app Snackbar
- 🚫 No system notification

### App Background:
- 🔔 Latency: 1-10s
- 📱 Display: System notification
- 🔗 Deep link to content

---

## ✅ STATUS

| Component | Status | Time |
|-----------|--------|------|
| Backend WebSocket | ✅ Complete | - |
| Backend FCM | ✅ Complete | - |
| Backend Docs | ✅ Complete | - |
| **Android Client** | ⏳ **Ready to start** | **4-5h** |

---

## 📞 SUPPORT

**Stuck?** Check:
1. Troubleshooting sections in each document
2. Backend test client for reference
3. Logcat for detailed error messages

**Questions about:**
- Backend implementation → See `WEBSOCKET_IMPLEMENTATION_COMPLETE.md`
- Use cases → See `PUSH_NOTIFICATION_USE_CASES.md`
- Android implementation → See `ANDROID_WEBSOCKET_IMPLEMENTATION_PLAN.md`

---

**Next Step:** Open `WEBSOCKET_FULL_STACK_SUMMARY.md` 🚀
