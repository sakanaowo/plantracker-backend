# 📝 TODO Comments Added for Tonight Testing

## 🎯 Summary

Đã thêm TODO comments vào tất cả các files quan trọng để hướng dẫn testing với **real Google Calendar API** tối nay.

**Lưu ý quan trọng**: Unit tests hiện tại sử dụng **MOCK** OAuth2Client, không phải real API!

---

## 📁 Files with TODO Comments

### 1. **google-calendar.service.ts** ✅
**Location**: `/src/modules/calendar/google-calendar.service.ts`

**TODOs Added**:
- Line 6-15: Overall testing checklist (5 items)
- Line 26: `getAuthUrl()` - Test with real Google OAuth
- Line 41: `handleOAuthCallback()` - Test OAuth callback with real auth code
- Line 365: `createTaskReminderEvent()` - Test creating real task reminder
- Line 497: `createProjectEventInGoogle()` - Test creating event with Google Meet

**Key Points**:
- Test OAuth flow end-to-end
- Test calendar event creation/update/delete
- Test Google Meet link generation
- Test token refresh when expired

---

### 2. **calendar.controller.ts** ✅
**Location**: `/src/modules/calendar/calendar.controller.ts`

**TODOs Added**:
- Line 18-30: Complete OAuth testing flow (5 steps)
- Line 42: Test getting real auth URL

**Testing Flow**:
1. FE calls `/auth-url` → Opens Google consent
2. User authorizes → Google redirects with code
3. FE calls `/callback` with code → Tokens saved
4. Check `/status` → Should show connected
5. Test calendar sync with tasks/events

---

### 3. **tasks.controller.ts** ✅
**Location**: `/src/modules/tasks/tasks.controller.ts`

**TODOs Added**:
- Line 161-164: Test task calendar sync (3 items)
- Line 185-188: Test calendar view with FE

**Key Tests**:
- Enable reminder → Event created in Google Calendar
- Update task → Calendar event updated
- Disable reminder → Event deleted
- Calendar view filters by date range

---

### 4. **events.controller.ts** ✅
**Location**: `/src/modules/events/events.controller.ts`

**TODOs Added**:
- Line 103-108: Overall project events testing (5 items)
- Line 110: Test GET with filters
- Line 118-119: Test creating event with Google Meet
- Line 139: Test updating event
- Line 157: Test deleting event
- Line 176: Test send reminder (placeholder)

**Key Tests**:
- Create event with Google Meet → Verify Meet link
- Update event → Calendar syncs for all attendees
- Delete event → Removed from Google Calendar
- Filter events (UPCOMING/PAST/RECURRING)

---

## 📋 Complete Testing Checklist

**Created**: `/docs/TONIGHT_TESTING_CHECKLIST.md` (450+ lines)

### Checklist Sections:

#### ✅ Pre-Testing Setup
- Environment variables verification
- Database migration
- Start backend server

#### ✅ Phase 1: OAuth Connection (HIGH Priority)
- Test 1.1: Get Authorization URL
- Test 1.2: Complete OAuth Flow
- Test 1.3: Check Integration Status

#### ✅ Phase 2: Task Calendar Sync (HIGH Priority)
- Test 2.1: Enable Task Reminder
- Test 2.2: Update Task → Update Calendar
- Test 2.3: Disable Task Reminder
- Test 2.4: Get Tasks for Calendar View

#### ✅ Phase 3: Project Events with Google Meet (HIGH Priority)
- Test 3.1: Create Event with Google Meet
- Test 3.2: Create Event WITHOUT Google Meet
- Test 3.3: Update Project Event
- Test 3.4: Delete Project Event
- Test 3.5: Filter Events
- Test 3.6: Send Reminder

#### ✅ Phase 4: Error Handling (MEDIUM Priority)
- Test 4.1: No Google Calendar Integration
- Test 4.2: Expired/Invalid Tokens
- Test 4.3: Invalid Task/Event IDs
- Test 4.4: Missing Required Fields

#### ✅ Phase 5: Integration with Frontend (HIGH Priority)
- Test 5.1: Calendar Tab in FE
- Test 5.2: Task Card Calendar Toggle
- Test 5.3: Create Event from FE
- Test 5.4: Calendar View in FE

---

## 🔍 What to Test Tonight

### Critical Tests (Must Do):
1. ✅ **OAuth Flow**
   - Get auth URL → Authorize in Google → Save tokens
   - Verify tokens saved correctly in database

2. ✅ **Task Reminder Sync**
   - Enable reminder → Check appears in Google Calendar
   - Update task → Check calendar event updates
   - Disable reminder → Check event deleted

3. ✅ **Project Events + Google Meet**
   - Create event with `createGoogleMeet: true`
   - Verify Google Meet link generated
   - Check event appears in all attendees' calendars
   - Test update and delete

4. ✅ **Frontend Integration**
   - Test complete user flow from FE
   - Verify calendar view shows events
   - Test all buttons/toggles work

### Error Handling Tests:
5. ✅ **Graceful Degradation**
   - Test with user who has NO Google Calendar connected
   - Verify app still works (events saved to DB only)
   - No errors shown to user

---

## 🐛 Known Issues to Watch

1. **Token Refresh Loop**: Check `expires_at` timestamp
2. **Duplicate Events**: Verify `calendar_event_id` stored correctly
3. **Timezone Issues**: Verify UTC vs local time conversion
4. **No Meet Link**: Check Google Calendar API permissions

---

## 📞 Quick Reference

### Environment Variables
```bash
GOOGLE_CLIENT_ID=your-real-client-id
GOOGLE_CLIENT_SECRET=your-real-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/calendar/google/callback
```

### Database Check
```sql
-- Check integration tokens
SELECT * FROM integration_tokens 
WHERE provider = 'GOOGLE_CALENDAR';

-- Check calendar event IDs
SELECT id, title, calendar_event_id, calendar_reminder_enabled
FROM tasks 
WHERE calendar_event_id IS NOT NULL;

-- Check external event mappings
SELECT * FROM external_event_map;
```

### API Endpoints to Test
```
GET  /calendar/google/auth-url
POST /calendar/google/callback
GET  /calendar/google/status
PUT  /tasks/:id/calendar-sync
GET  /tasks/calendar?projectId&startDate&endDate
POST /events/projects
GET  /events/projects/:projectId?filter=UPCOMING
PATCH /events/projects/:id
DELETE /events/projects/:id
```

---

## 🎉 Success Criteria

Testing is successful when:
- ✅ OAuth flow works end-to-end
- ✅ Task reminders appear in Google Calendar
- ✅ Project events with Google Meet links work
- ✅ All CRUD operations sync to Google Calendar
- ✅ Error handling is graceful (no crashes)
- ✅ Frontend displays everything correctly
- ✅ Multi-user scenario works (attendees get invites)

---

## 📝 How to Use During Testing

1. **Open files with TODOs** in VS Code
2. **Follow TODO comments** as you test each feature
3. **Check off items** in `TONIGHT_TESTING_CHECKLIST.md`
4. **Document issues** in testing notes section
5. **Verify in Google Calendar** after each operation

---

**Good luck! 🚀**

Time to test with REAL Google Calendar API! 🌙
