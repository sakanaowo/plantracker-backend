# 🎯 Project Invitation System - New Flow

## 📋 **FLOW MỚI (Đúng Logic)**

### **1. Invite Member → Send Invitation**
```
Admin/Owner → POST /projects/{id}/members/invite
              ↓
        Create project_invitations record (PENDING)
              ↓
        Send push notification với action buttons
              ↓
        Return invitation object (NOT member)
```

### **2. User Nhận Notification → Accept/Decline**
```
User → Nhận push notification
     → Click Accept/Decline
     → POST /invitations/{id}/respond
              ↓
        If ACCEPT: Create project_members record
        If DECLINE: Update invitation status only
              ↓
        Return response với kết quả
```

### **3. User Check Pending Invitations**
```
User → GET /invitations/my
     → Returns list of pending invitations
     → User có thể accept/decline từ app
```

## 🛠️ **API ENDPOINTS MỚI**

### **Modified:**
- `POST /projects/{id}/members/invite` - Tạo invitation thay vì member ngay lập tức

### **New:**
- `GET /invitations/my` - Lấy danh sách invitation pending của user
- `POST /invitations/{id}/respond` - Accept/Decline invitation

## 📊 **DATABASE CHANGES**

### **New Table: project_invitations**
```sql
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role project_role NOT NULL DEFAULT 'MEMBER',
  status invitation_status NOT NULL DEFAULT 'PENDING',
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
```

### **New Enum: invitation_status**
```sql
CREATE TYPE invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED', 
  'DECLINED',
  'EXPIRED'
);
```

## 🔄 **BEHAVIOR CHANGES**

### **Before (Wrong):**
1. Invite member → User becomes member immediately
2. No way to decline invitation
3. User forced to join project

### **After (Correct):**
1. Invite member → Creates pending invitation
2. User gets notification with Accept/Decline options
3. User chooses to join or not
4. Only becomes member after accepting

## 📱 **FRONTEND INTEGRATION**

### **Android App Changes Needed:**

#### **1. Handle Invitation Notifications**
```java
// FCM notification với action buttons
NotificationCompat.Builder notification = new NotificationCompat.Builder()
    .addAction(R.drawable.ic_check, "Accept", acceptPendingIntent)
    .addAction(R.drawable.ic_close, "Decline", declinePendingIntent);
```

#### **2. Invitation Response API**
```java
@POST("invitations/{invitationId}/respond")
Call<InvitationResponse> respondToInvitation(
    @Path("invitationId") String invitationId,
    @Body RespondToInvitationDTO dto
);
```

#### **3. My Invitations Screen**
```java
@GET("invitations/my")
Call<List<ProjectInvitation>> getMyInvitations();
```

## ✅ **TESTING CHECKLIST**

- [ ] Invite member → tạo invitation (không tạo member)
- [ ] User nhận push notification với Accept/Decline buttons
- [ ] Accept invitation → user becomes project member
- [ ] Decline invitation → invitation marked as declined
- [ ] Check expired invitations (7 days)
- [ ] List pending invitations API
- [ ] Prevent duplicate invitations to same user/project

## 🚀 **DEPLOYMENT STEPS**

1. ✅ Update Prisma schema
2. ✅ Run database migration
3. 🔄 Update backend service logic
4. 🔄 Test API endpoints
5. ⏳ Update Android app FCM handling
6. ⏳ Test end-to-end flow

**Current Status:** Backend logic updated, ready for frontend integration.