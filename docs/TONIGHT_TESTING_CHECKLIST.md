# 🌙 TONIGHT TESTING CHECKLIST - Google Calendar Integration

**Date**: November 7, 2025  
**Testing with**: Real Google Calendar API + Frontend  
**Note**: Current unit tests use MOCKS - Real API testing required!

---

## ⚠️ Pre-Testing Setup

### 1. Environment Variables
Verify `.env` has correct Google OAuth credentials:
```bash
GOOGLE_CLIENT_ID=your-real-client-id
GOOGLE_CLIENT_SECRET=your-real-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/calendar/google/callback
```

### 2. Database Migration
```bash
# Run migration if not done yet
npx prisma migrate dev
```

### 3. Start Backend
```bash
npm run start:dev
# Server should be running on http://localhost:3000
```

---

## 📋 Testing Checklist

### Phase 1: OAuth Connection (Priority: HIGH 🔴)

#### ✅ Test 1.1: Get Authorization URL
**Endpoint**: `GET /calendar/google/auth-url`
- [ ] Call endpoint with valid JWT token
- [ ] Verify `authUrl` returned in response
- [ ] Open URL in browser → Should see Google consent screen
- [ ] Check URL contains correct scopes (calendar, calendar.events)

**Expected Response**:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### ✅ Test 1.2: Complete OAuth Flow
**Endpoint**: `POST /calendar/google/callback`
- [ ] Authorize in Google consent screen
- [ ] Copy authorization code from redirect URL
- [ ] Call callback endpoint with code
- [ ] Verify tokens saved to `integration_tokens` table
- [ ] Check `status` = 'ACTIVE' in database

**Request**:
```json
{
  "code": "4/0AeanUZtZK..."
}
```

**Database Check**:
```sql
SELECT * FROM integration_tokens 
WHERE provider = 'GOOGLE_CALENDAR' 
ORDER BY created_at DESC LIMIT 1;
```

#### ✅ Test 1.3: Check Integration Status
**Endpoint**: `GET /calendar/google/status`
- [ ] Call endpoint after OAuth complete
- [ ] Verify `isConnected: true`
- [ ] Check `accountEmail` shows correct Google account
- [ ] Verify `lastSyncAt` has timestamp

**Expected Response**:
```json
{
  "isConnected": true,
  "accountEmail": "user@gmail.com",
  "lastSyncAt": "2025-11-07T..."
}
```

---

### Phase 2: Task Calendar Sync (Priority: HIGH 🔴)

#### ✅ Test 2.1: Enable Task Reminder
**Endpoint**: `PUT /tasks/:taskId/calendar-sync`

**Test Steps**:
1. Create a task with due date (via FE or API)
2. Enable calendar reminder:
```json
{
  "calendarReminderEnabled": true,
  "calendarReminderTime": 30,
  "title": "Test Task",
  "dueAt": "2025-11-08T10:00:00Z"
}
```
3. **Check in Google Calendar**:
   - [ ] Event appears 30 minutes before due time
   - [ ] Event duration = 15 minutes
   - [ ] Event color = red (#d50000)
   - [ ] Event title = "[Task Reminder] Test Task"

4. **Check Database**:
```sql
SELECT calendar_event_id, calendar_reminder_enabled, last_synced_at
FROM tasks WHERE id = 'task-id';
```
- [ ] `calendar_event_id` is not null
- [ ] `calendar_reminder_enabled` = true
- [ ] `last_synced_at` has recent timestamp

#### ✅ Test 2.2: Update Task → Update Calendar Event
**Endpoint**: `PUT /tasks/:taskId/calendar-sync`

**Test Steps**:
1. Update task with new title/due date:
```json
{
  "calendarReminderEnabled": true,
  "calendarReminderTime": 60,
  "title": "Updated Task Title",
  "dueAt": "2025-11-08T14:00:00Z"
}
```
2. **Check in Google Calendar**:
   - [ ] Event time changed to 60 minutes before new due time
   - [ ] Event title updated to "...Updated Task Title"
   - [ ] Old event updated (not duplicate created)

#### ✅ Test 2.3: Disable Task Reminder
**Endpoint**: `PUT /tasks/:taskId/calendar-sync`

**Test Steps**:
1. Disable reminder:
```json
{
  "calendarReminderEnabled": false
}
```
2. **Check in Google Calendar**:
   - [ ] Event deleted/removed from calendar
3. **Check Database**:
   - [ ] `calendar_event_id` = null
   - [ ] `calendar_reminder_enabled` = false

#### ✅ Test 2.4: Get Tasks for Calendar View
**Endpoint**: `GET /tasks/calendar?projectId=xxx&startDate=2025-11-01&endDate=2025-11-30`

**Test Steps**:
- [ ] Call endpoint with valid projectId and date range
- [ ] Verify tasks within date range returned
- [ ] Check response includes `calendarEventId`
- [ ] Verify `boardName`, `assignees`, `creator` included

---

### Phase 3: Project Events with Google Meet (Priority: HIGH 🔴)

#### ✅ Test 3.1: Create Event with Google Meet
**Endpoint**: `POST /events/projects`

**Test Steps**:
1. Create event with Google Meet:
```json
{
  "projectId": "project-id",
  "title": "Team Sprint Planning",
  "description": "Plan next sprint tasks",
  "date": "2025-11-08",
  "time": "10:00",
  "duration": 60,
  "type": "MEETING",
  "recurrence": "WEEKLY",
  "attendeeIds": ["user-id-1", "user-id-2"],
  "createGoogleMeet": true
}
```

2. **Check Response**:
   - [ ] `meet_link` field has Google Meet URL (meet.google.com/...)
   - [ ] `calendar_event_id` is not null

3. **Check in Google Calendar**:
   - [ ] Event appears at correct date/time
   - [ ] Event has Google Meet link attached
   - [ ] Attendees listed in event
   - [ ] Event marked as recurring (weekly)

4. **Check Database**:
```sql
SELECT * FROM events WHERE title = 'Team Sprint Planning';
SELECT * FROM external_event_map WHERE event_id = '...';
SELECT * FROM participants WHERE event_id = '...';
```
   - [ ] Event created in `events` table
   - [ ] External mapping created in `external_event_map`
   - [ ] Participants created for all attendees

5. **Check Attendees' Calendars**:
   - [ ] All attendees receive calendar invite
   - [ ] Event appears in their Google Calendar

#### ✅ Test 3.2: Create Event WITHOUT Google Meet
**Endpoint**: `POST /events/projects`

**Test Steps**:
1. Create event without Meet:
```json
{
  ...
  "createGoogleMeet": false
}
```
2. **Check Response**:
   - [ ] `meet_link` is null or empty
3. **Check in Google Calendar**:
   - [ ] Event created but no Meet link

#### ✅ Test 3.3: Update Project Event
**Endpoint**: `PATCH /events/projects/:eventId`

**Test Steps**:
1. Update event:
```json
{
  "title": "Updated Meeting Title",
  "date": "2025-11-09",
  "time": "14:00",
  "duration": 90,
  "attendeeIds": ["user-id-1", "user-id-3"]
}
```
2. **Check in Google Calendar**:
   - [ ] Event updated with new title
   - [ ] Event moved to new date/time
   - [ ] Duration changed to 90 minutes
   - [ ] Attendees updated (user-id-2 removed, user-id-3 added)
   - [ ] All attendees receive update notification

#### ✅ Test 3.4: Delete Project Event
**Endpoint**: `DELETE /events/projects/:eventId`

**Test Steps**:
1. Delete event via API
2. **Check in Google Calendar**:
   - [ ] Event removed from organizer's calendar
   - [ ] Event removed from all attendees' calendars
3. **Check Database**:
   - [ ] Event deleted from `events` table
   - [ ] External mapping deleted
   - [ ] Participants deleted

#### ✅ Test 3.5: Filter Events
**Endpoint**: `GET /events/projects/:projectId?filter=UPCOMING`

**Test Cases**:
- [ ] `filter=UPCOMING` → Returns only future events
- [ ] `filter=PAST` → Returns only past events
- [ ] `filter=RECURRING` → Returns only recurring events
- [ ] No filter → Returns all events

#### ✅ Test 3.6: Send Reminder (Placeholder)
**Endpoint**: `POST /events/projects/:eventId/send-reminder`

**Note**: Currently returns `{ success: true }` without actually sending
- [ ] Call endpoint → Returns success
- [ ] TODO: Integrate with NotificationsService later

---

### Phase 4: Error Handling (Priority: MEDIUM 🟡)

#### ✅ Test 4.1: No Google Calendar Integration
**Test Steps**:
1. Test with user who has NOT connected Google Calendar
2. Try to enable task reminder or create event
3. **Expected Behavior**:
   - [ ] Task/event still created in database
   - [ ] No Google Calendar event created (graceful degradation)
   - [ ] No error thrown to user
   - [ ] Warning logged in backend console

#### ✅ Test 4.2: Expired/Invalid Tokens
**Test Steps**:
1. Manually expire token in database OR wait for real expiry
2. Try to create calendar event
3. **Expected Behavior**:
   - [ ] Backend attempts token refresh
   - [ ] If refresh succeeds → Event created
   - [ ] If refresh fails → Graceful degradation (event in DB only)

#### ✅ Test 4.3: Invalid Task/Event IDs
**Test Steps**:
1. Call endpoints with non-existent IDs
2. **Expected Responses**:
   - [ ] HTTP 404 with "Task not found" / "Event not found"

#### ✅ Test 4.4: Missing Required Fields
**Test Steps**:
1. Send requests without required fields
2. **Expected Responses**:
   - [ ] HTTP 400 with validation errors

---

### Phase 5: Integration with Frontend (Priority: HIGH 🔴)

#### ✅ Test 5.1: Calendar Tab in FE
- [ ] Open Calendar tab in frontend
- [ ] Verify "Connect Google Calendar" button appears if not connected
- [ ] Click button → OAuth flow starts
- [ ] After connecting → Calendar integration badge shows "Connected"

#### ✅ Test 5.2: Task Card Calendar Toggle
- [ ] Open task details in FE
- [ ] Toggle "Add to Calendar" switch
- [ ] Verify event appears in embedded calendar view (if FE has one)
- [ ] Or open Google Calendar separately to verify

#### ✅ Test 5.3: Create Event from FE
- [ ] Create project event via FE form
- [ ] Toggle "Create Google Meet" checkbox
- [ ] Submit form
- [ ] Verify event shows in FE event list
- [ ] Verify Google Meet link displayed (if created)
- [ ] Click Meet link → Opens Google Meet in new tab

#### ✅ Test 5.4: Calendar View in FE
- [ ] View calendar in FE (month/week view)
- [ ] Verify tasks with reminders show on calendar
- [ ] Verify project events show on calendar
- [ ] Filter by upcoming/past/recurring
- [ ] Check date navigation works

---

## 🐛 Known Issues to Watch For

### Issue 1: Token Refresh Loop
**Symptom**: Multiple token refresh attempts in logs  
**Fix**: Check `expires_at` timestamp in database is correct

### Issue 2: Duplicate Calendar Events
**Symptom**: Multiple events created for same task  
**Fix**: Check `calendar_event_id` is properly stored/updated

### Issue 3: Timezone Issues
**Symptom**: Events appear at wrong time in calendar  
**Fix**: Verify date conversion in backend (UTC vs local time)

### Issue 4: Meet Link Not Generated
**Symptom**: `meet_link` is null even when `createGoogleMeet=true`  
**Fix**: Check Google Calendar API has Meet permissions enabled in Google Cloud Console

---

## 📊 Post-Testing Checklist

After completing all tests:

- [ ] All OAuth flows working correctly
- [ ] Task reminders sync to/from Google Calendar
- [ ] Project events with Google Meet work end-to-end
- [ ] Error handling graceful (no crashes)
- [ ] FE displays calendar integration correctly
- [ ] No duplicate events created
- [ ] Token refresh works automatically
- [ ] Multi-user scenario tested (attendees receive invites)

---

## 📝 Testing Notes Template

Use this to document issues found during testing:

```
### Issue #1: [Short Description]
**Time**: HH:MM PM
**Endpoint**: POST /events/projects
**Steps to Reproduce**:
1. ...
2. ...

**Expected**: ...
**Actual**: ...
**Error Logs**: (paste relevant logs)

**Status**: [ ] Fixed / [ ] Investigating / [ ] Won't Fix
```

---

## 🚀 Next Steps After Tonight

If all tests pass:
1. ✅ Mark feature as complete
2. 📸 Take screenshots/videos for documentation
3. 🎉 Merge to develop branch
4. 📢 Notify frontend team integration is ready

If tests fail:
1. 🐛 Document all issues in TESTING_NOTES.md
2. 🔧 Create GitHub issues for each bug
3. 📋 Prioritize fixes (high/medium/low)
4. 🔄 Schedule re-testing after fixes

---

## 💡 Tips for Testing

1. **Test with multiple Google accounts** to verify attendee experience
2. **Check Google Calendar on mobile** to see if events sync there too
3. **Test in incognito/private window** to simulate fresh OAuth flow
4. **Keep browser DevTools open** to monitor network requests
5. **Have Postman collection ready** for quick API testing
6. **Check database after each operation** to verify data integrity

---

**Good luck with testing! 🍀**

---

## 📞 Emergency Contacts

If critical issues found:
- Backend Dev: [Your Name]
- Frontend Dev 1: [FE Dev 1 Name]
- Frontend Dev 2: [FE Dev 2 Name]
