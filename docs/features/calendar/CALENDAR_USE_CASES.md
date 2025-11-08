# 🗓️ Google Calendar Integration - Use Cases & Implementation Guide

> **Status**: Backend APIs created, ready for frontend implementation  
> **Priority**: Meeting Time Suggestion (Free/Busy API)  
> **Date**: November 8, 2025

---

## 📋 Available Tabs in Project Layout

1. **Calendar Tab** - Tích hợp Google Calendar, hiển thị events
2. **Events Tab** - Project events, tasks với deadline
3. **Summary Tab** (Planned) - Tổng hợp hoạt động, metrics

---

## 🎯 Top 5 Use Cases (Sorted by Priority & Ease)

### 1️⃣ **Meeting Time Suggestion** ⭐ HIGHEST PRIORITY
**Difficulty**: Medium | **Impact**: Very High | **Google API**: Free/Busy ✅

#### Description
Tự động gợi ý khung giờ họp dựa trên lịch trống của tất cả members trong project.

#### User Flow
```
1. User opens "Calendar" tab in Project
2. Clicks "Schedule Meeting" button
3. Selects members to invite (checkboxes)
4. Chooses meeting duration (30min / 1h / 2h)
5. System calls Free/Busy API → shows top 5 suggested time slots
6. User picks a time slot
7. System creates event + Google Meet link
8. Notifications sent to all attendees
```

#### Backend API (✅ READY)
```typescript
POST /api/calendar/meetings/suggest-times
Request:
{
  "userIds": ["user1", "user2", "user3"],
  "startDate": "2025-11-08T00:00:00Z",
  "endDate": "2025-11-15T23:59:59Z",
  "durationMinutes": 60,
  "maxSuggestions": 5
}

Response:
{
  "suggestions": [
    {
      "start": "2025-11-09T09:00:00Z",
      "end": "2025-11-09T10:00:00Z",
      "availableUsers": ["user1", "user2", "user3"],
      "score": 100  // % of users available
    },
    {
      "start": "2025-11-09T14:30:00Z",
      "end": "2025-11-09T15:30:00Z",
      "availableUsers": ["user1", "user2"],
      "score": 66
    }
  ],
  "totalUsersChecked": 3,
  "checkedRange": { "start": "...", "end": "..." }
}
```

```typescript
POST /api/calendar/meetings/create
Request:
{
  "attendeeIds": ["user1", "user2"],
  "timeSlot": {
    "start": "2025-11-09T09:00:00Z",
    "end": "2025-11-09T10:00:00Z"
  },
  "summary": "Sprint Planning Meeting",
  "description": "Discuss sprint goals and task allocation"
}

Response:
{
  "eventId": "abc123xyz",
  "meetLink": "https://meet.google.com/abc-defg-hij",
  "htmlLink": "https://calendar.google.com/event?eid=..."
}
```

#### Frontend Components Needed
1. **MeetingSchedulerDialog.java**
   - Member selection (multi-select chips)
   - Duration picker (30/60/120 min buttons)
   - Date range picker
   - "Find Times" button

2. **SuggestedTimeSlotsAdapter.java**
   - RecyclerView showing suggested time slots
   - Each item shows: date, time, available users, score badge
   - Click to select → shows confirmation dialog

3. **MeetingConfirmDialog.java**
   - Shows selected time, duration, attendees
   - Input fields: Meeting title, description
   - "Create Meeting" button → calls create API

#### Android Implementation Example
```java
// 1. Call suggest times API
private void suggestMeetingTimes(List<String> userIds, int durationMinutes) {
    SuggestMeetingTimeRequest request = new SuggestMeetingTimeRequest(
        userIds,
        getStartDate(), // Today
        getEndDate(),   // +7 days
        durationMinutes,
        5 // max suggestions
    );
    
    calendarApi.suggestMeetingTimes(request).enqueue(new Callback<MeetingTimeSuggestion>() {
        @Override
        public void onResponse(Call<MeetingTimeSuggestion> call, Response<MeetingTimeSuggestion> response) {
            if (response.isSuccessful() && response.body() != null) {
                showTimeSlotsDialog(response.body().getSuggestions());
            }
        }
        
        @Override
        public void onFailure(Call<MeetingTimeSuggestion> call, Throwable t) {
            Toast.makeText(context, "Failed to load suggestions", Toast.LENGTH_SHORT).show();
        }
    });
}

// 2. Create meeting with selected slot
private void createMeeting(TimeSlot slot, String title, String description) {
    CreateMeetingRequest request = new CreateMeetingRequest(
        selectedUserIds,
        slot,
        title,
        description
    );
    
    calendarApi.createMeeting(request).enqueue(new Callback<MeetingResponse>() {
        @Override
        public void onResponse(Call<MeetingResponse> call, Response<MeetingResponse> response) {
            if (response.isSuccessful() && response.body() != null) {
                String meetLink = response.body().getMeetLink();
                Toast.makeText(context, "✓ Meeting created!\n" + meetLink, Toast.LENGTH_LONG).show();
                
                // Copy Meet link to clipboard
                ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("Meet Link", meetLink));
            }
        }
        
        @Override
        public void onFailure(Call<MeetingResponse> call, Throwable t) {
            Toast.makeText(context, "Failed to create meeting", Toast.LENGTH_SHORT).show();
        }
    });
}
```

---

### 2️⃣ **Task Deadline → Calendar Event Sync**
**Difficulty**: Easy | **Impact**: High | **Google API**: Events API ✅

#### Description
Tự động tạo calendar event khi task có deadline được assign.

#### User Flow
```
1. User creates task with deadline
2. Assigns task to member(s)
3. System automatically creates calendar event
4. Event synced to assignee's Google Calendar
5. Reminder notification 1 day before & 1 hour before deadline
```

#### Implementation
```typescript
// Backend: Auto-create calendar event when task assigned
async onTaskAssigned(taskId: string, assigneeId: string, deadline: Date) {
  const calendar = await this.getCalendarClient(assigneeId);
  
  const event = {
    summary: `Task: ${task.title}`,
    description: `Deadline for task in project ${project.name}`,
    start: { dateTime: deadline.toISOString() },
    end: { dateTime: deadline.toISOString() },
    reminders: {
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 60 }       // 1 hour before
      ]
    }
  };
  
  await calendar.events.insert({ calendarId: 'primary', requestBody: event });
}
```

---

### 3️⃣ **Project Summary Dashboard**
**Difficulty**: Medium | **Impact**: High | **Google API**: Events API ✅

#### Description
Trang tổng hợp hoạt động của project trong tuần/tháng.

#### Components
- **Upcoming Events**: Next 7 days calendar events
- **Task Completion Rate**: % tasks completed vs total
- **Active Members**: Members with recent activity
- **Meeting Statistics**: Total meetings, average duration
- **Time Tracking**: Total hours spent (from task logs)

#### UI Mockup
```
┌─────────────────────────────────────┐
│ Project Summary - Sprint 5          │
│ Nov 4-10, 2025                      │
├─────────────────────────────────────┤
│ 📅 Upcoming Events (5)              │
│   • Sprint Planning - Tomorrow 9AM  │
│   • Code Review - Nov 9, 2PM        │
│   • Demo Day - Nov 10, 3PM          │
│                                     │
│ ✅ Tasks This Week                  │
│   Completed: 12/20 (60%)            │
│   [████████████░░░░░░░░]            │
│                                     │
│ 👥 Active Members (8)               │
│   [Avatar] John - 15 tasks          │
│   [Avatar] Sarah - 12 tasks         │
│                                     │
│ 🎯 Meeting Stats                    │
│   Total: 8 meetings                 │
│   Avg Duration: 45min               │
│   Google Meet Links: 8/8            │
└─────────────────────────────────────┘
```

---

### 4️⃣ **Quick Event Creation**
**Difficulty**: Easy | **Impact**: Medium | **Google API**: Events API ✅

#### Description
Tạo nhanh event từ Calendar tab với Google Meet link tự động.

#### User Flow
```
1. User clicks "+" button in Calendar tab
2. Quick dialog appears:
   - Event title
   - Date & time picker
   - Duration (30min / 1h / 2h)
   - Invite members (optional)
3. Toggle "Add Google Meet link"
4. Click "Create"
5. Event appears in calendar + synced to Google
```

#### Implementation
```java
private void showQuickEventDialog() {
    AlertDialog.Builder builder = new AlertDialog.Builder(this);
    View view = getLayoutInflater().inflate(R.layout.dialog_quick_event, null);
    
    EditText etTitle = view.findViewById(R.id.etTitle);
    DatePicker datePicker = view.findViewById(R.id.datePicker);
    TimePicker timePicker = view.findViewById(R.id.timePicker);
    Spinner durationSpinner = view.findViewById(R.id.spinnerDuration);
    SwitchMaterial swGoogleMeet = view.findViewById(R.id.swGoogleMeet);
    
    builder.setView(view)
        .setTitle("Create Event")
        .setPositiveButton("Create", (dialog, which) -> {
            String title = etTitle.getText().toString();
            Date startTime = getSelectedDateTime(datePicker, timePicker);
            int duration = getDurationMinutes(durationSpinner);
            boolean withMeet = swGoogleMeet.isChecked();
            
            createEvent(title, startTime, duration, withMeet);
        })
        .setNegativeButton("Cancel", null)
        .show();
}
```

---

### 5️⃣ **Event Attendee RSVP Status**
**Difficulty**: Medium | **Impact**: Medium | **Google API**: Events API ✅

#### Description
Hiển thị trạng thái tham gia của members cho mỗi event.

#### Features
- **Accepted** ✅ - Member confirmed attendance
- **Declined** ❌ - Member cannot attend
- **Maybe** ❓ - Member not sure
- **No Response** ⏳ - Pending response

#### UI Component
```
┌─────────────────────────────────────┐
│ Sprint Planning                     │
│ Tomorrow, 9:00 AM - 10:00 AM        │
├─────────────────────────────────────┤
│ Attendees (8)                       │
│                                     │
│ ✅ John Doe                         │
│ ✅ Sarah Smith                      │
│ ❌ Mike Johnson                     │
│ ❓ Emma Davis                       │
│ ⏳ Alex Brown (No response)         │
│                                     │
│ [View in Google Calendar]           │
│ [Copy Meet Link]                    │
└─────────────────────────────────────┘
```

---

## 🚀 Implementation Priority

### Week 1 (Current Sprint)
1. ✅ Backend APIs (Meeting Scheduler) - **DONE**
2. 🔄 Frontend: Meeting Time Suggestion UI
3. 🔄 Test Free/Busy API with real accounts

### Week 2
1. Task → Calendar Event sync
2. Quick Event creation
3. Calendar tab UI polish

### Week 3
1. Summary Dashboard
2. RSVP status display
3. Calendar filters & search

---

## 📱 Retrofit API Definitions Needed

```java
// CalendarMeetingApi.java
public interface CalendarMeetingApi {
    
    @POST("calendar/meetings/suggest-times")
    Call<MeetingTimeSuggestion> suggestMeetingTimes(@Body SuggestMeetingTimeRequest request);
    
    @POST("calendar/meetings/create")
    Call<MeetingResponse> createMeeting(@Body CreateMeetingRequest request);
    
    @GET("calendar/events")
    Call<List<CalendarEvent>> getCalendarEvents(
        @Query("startDate") String startDate,
        @Query("endDate") String endDate
    );
    
    @POST("calendar/events")
    Call<CalendarEvent> createEvent(@Body CreateEventRequest request);
    
    @GET("calendar/events/{eventId}")
    Call<CalendarEvent> getEventDetails(@Path("eventId") String eventId);
}
```

---

## 🎨 UI/UX Recommendations

### Calendar Tab Layout
```
┌─────────────────────────────────────┐
│ [< Nov 2025 >]    [Schedule Meeting]│
├─────────────────────────────────────┤
│ Mon  Tue  Wed  Thu  Fri  Sat  Sun  │
│  4    5    6    7    8    9   10   │
│ [●]  [●●] [●]  [●●●] [●]  [ ]  [ ] │
│                                     │
│ Today's Events                      │
│ ┌─────────────────────────────────┐ │
│ │ 9:00 AM Sprint Planning         │ │
│ │ 👥 8 attendees • Google Meet    │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 2:00 PM Code Review             │ │
│ │ 👥 4 attendees • Google Meet    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Quick Event]                     │
└─────────────────────────────────────┘
```

### Color Coding
- 🟢 **Meeting (with Meet link)** - Green
- 🔵 **Task deadline** - Blue
- 🟡 **Personal event** - Yellow
- 🔴 **High priority** - Red

---

## 🧪 Testing Checklist

### Meeting Time Suggestion
- [ ] Test with 2 users having overlapping free time
- [ ] Test with users in different timezones
- [ ] Test when no common free slots exist
- [ ] Test with user who hasn't connected Google Calendar
- [ ] Verify score calculation (% available users)

### Event Creation
- [ ] Verify Google Meet link is generated
- [ ] Check email invites sent to attendees
- [ ] Test with invalid date/time
- [ ] Test timezone handling

### Calendar Sync
- [ ] Create event in app → appears in Google Calendar
- [ ] Create event in Google Calendar → appears in app
- [ ] Update event → synced both ways
- [ ] Delete event → removed from both

---

## 📊 Success Metrics

1. **Adoption Rate**: % of project members with Google Calendar connected
2. **Meeting Efficiency**: Average time to schedule meeting (target: < 2 minutes)
3. **Calendar Usage**: # events created per project per week
4. **Meet Link Usage**: % meetings with Google Meet vs without
5. **User Satisfaction**: Rating for meeting scheduler feature

---

## 🔧 Technical Notes

### Google Calendar API Quotas
- **Free/Busy queries**: 1,000,000 per day
- **Event operations**: 1,000,000 per day
- **Meet link creation**: Unlimited (part of event creation)

### Optimization Tips
1. Cache Free/Busy results for 5 minutes
2. Batch event creation when possible
3. Use webhooks for real-time calendar updates
4. Store frequently used time slots in Redis

### Error Handling
```java
try {
    MeetingTimeSuggestion result = calendarApi.suggestMeetingTimes(request).execute().body();
} catch (HttpException e) {
    if (e.code() == 401) {
        // Token expired - refresh
        refreshGoogleToken();
    } else if (e.code() == 403) {
        // User revoked access
        showReconnectDialog();
    }
}
```

---

## 🎯 Next Steps

1. **Immediate** (Today):
   - Test Meeting Scheduler API với Postman
   - Create model classes for Android (SuggestMeetingTimeRequest, TimeSlot, etc.)
   - Design MeetingSchedulerDialog layout

2. **This Week**:
   - Implement Meeting Time Suggestion UI
   - Test with 2-3 real Google accounts
   - Polish Calendar tab layout

3. **Next Week**:
   - Add Task → Calendar sync
   - Implement Summary Dashboard
   - User testing & feedback

---

**Ready to start? Let's begin with Meeting Time Suggestion! 🚀**
