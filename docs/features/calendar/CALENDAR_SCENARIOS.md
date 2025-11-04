# Google Calendar Integration - Scenarios & Workflows

## Scenario 1: Project Manager - Sprint Planning Meeting

### Bối cảnh
PM cần tạo cuộc họp sprint planning cho team và muốn tất cả thành viên nhận thông báo qua Google Calendar.

### Các bước thực hiện

**Bước 1: Tạo Event trong PlanTracker**
```
1. Mở PlanTracker Android app
2. Vào project → Events tab
3. Tap "Create Event"
4. Điền thông tin:
   - Title: "Sprint 5 Planning Meeting"
   - Date: 2025-11-10
   - Time: 09:00 - 11:00
   - Location: "Conference Room A"
   - Add participants: team@company.com
5. Bật toggle "Sync to Google Calendar"
6. Tap "Create"
```

**Bước 2: Auto-sync Process (Backend)**
```
1. EventsService.create() được gọi
2. Event được lưu vào database
3. GoogleCalendarService.syncEventToGoogle() được trigger
4. Tạo event trong Google Calendar với service account
5. Lưu mapping vào external_event_map table
6. Return success response
```

**Bước 3: Team nhận thông báo**
```
1. Google Calendar tự động gửi invite cho participants
2. Team members nhận email invitation
3. Event xuất hiện trong Google Calendar app của họ
4. Mobile notifications được bật sẵn
```

### Kết quả mong đợi
- ✅ Event có trong PlanTracker và Google Calendar
- ✅ Team nhận invite và thông báo
- ✅ Sync status hiển thị "Synced" trong app

---

## Scenario 2: Remote Team - Project Deadline

### Bối cảnh
Team remote cần theo dõi deadline dự án và nhận nhắc nhở trước hạn.

### Các bước thực hiện

**Bước 1: Tạo Deadline Event**
```
1. Team lead tạo event "Project Alpha - Final Delivery"
2. Set ngày: 2025-11-30, 17:00
3. Add description: "Final code review & deployment"
4. Add tất cả team members
5. Enable sync to Google Calendar
```

**Bước 2: Bulk Sync cho Multiple Milestones**
```
API Call:
POST /api/calendar/bulk-sync
{
  "eventIds": [
    "deadline-uuid-1",
    "review-uuid-2", 
    "testing-uuid-3"
  ]
}
```

**Bước 3: Google Calendar Integration**
```
1. Events được tạo trong Google Calendar
2. Set reminder: 24 hours before
3. Team members thấy trong calendar app
4. Notifications được schedule tự động
```

**Bước 4: Theo dõi Progress**
```
1. Check sync status:
   GET /api/calendar/event-sync-status?eventId=deadline-uuid-1
2. Response: {"synced": true, "syncStatus": "SYNCED"}
3. Monitor trong PlanTracker app
```

### Kết quả mong đợi
- ✅ Tất cả milestones sync vào Google Calendar
- ✅ Team nhận reminder notifications
- ✅ Cross-platform calendar access

---

## Scenario 3: Client Presentation

### Bối cảnh
Cần schedule demo session với client và chia sẻ calendar invite.

### Các bước thực hiện

**Bước 1: Schedule Demo Session**
```
1. Tạo event "Product Demo - Client ABC"
2. Date: 2025-11-15, 14:00-15:00
3. Add meeting link: Google Meet URL
4. Participants: 
   - team-internal@company.com
   - client@abc-corp.com
5. Location: "Online Meeting"
```

**Bước 2: Sync & Share Process**
```
1. Event sync vào Google Calendar
2. Google Calendar generate invite link
3. Client có thể add vào calendar của họ
4. Meeting link được include trong invite
```

**Bước 3: Pre-meeting Reminders**
```
1. Google Calendar gửi reminder 1 day before
2. Additional reminder 30 minutes before
3. Mobile notifications cho tất cả participants
4. Meeting link accessible từ calendar event
```

**Bước 4: Meeting Management**
```
1. Nếu cần reschedule:
   - Update event trong PlanTracker
   - Auto-sync update vào Google Calendar
   - Google gửi updated invite

2. Nếu cancel:
   - Delete event trong PlanTracker
   - Hoặc unsync: POST /api/calendar/unsync-event
   - Google Calendar event được remove
```

### Kết quả mong đợi
- ✅ Client nhận professional calendar invite
- ✅ All parties có consistent meeting info
- ✅ Easy rescheduling/cancellation process

---

## Technical Implementation Notes

### API Endpoints Usage

**Check Service Status**
```bash
GET /api/calendar/status
Response: {"available": true, "calendarsCount": 1}
```

**Sync Single Event**
```bash
POST /api/calendar/sync-event
Body: {"eventId": "event-uuid"}
Response: {
  "success": true,
  "googleEventId": "google-event-id",
  "htmlLink": "https://calendar.google.com/event?eid=...",
  "message": "Event synced successfully"
}
```

**Check Sync Status**
```bash
GET /api/calendar/event-sync-status?eventId=event-uuid
Response: {
  "synced": true,
  "syncStatus": "SYNCED",
  "googleEventId": "google-event-id",
  "lastSyncedAt": "2025-11-04T22:47:23.000Z"
}
```

### Database Integration
```sql
-- Event mapping được lưu trong external_event_map
INSERT INTO external_event_map (
  event_id,
  provider,
  provider_event_id,
  html_link,
  last_synced_at
) VALUES (
  'plantracker-event-uuid',
  'GOOGLE_CALENDAR',
  'google-calendar-event-id',
  'https://calendar.google.com/event?eid=...',
  NOW()
);
```

### Error Handling Scenarios

**Case 1: Google Calendar API Down**
```
1. API returns {"available": false, "error": "Service unavailable"}
2. Events vẫn được tạo trong PlanTracker
3. Sync sẽ retry sau khi service phục hồi
4. User thấy sync status: "PENDING"
```

**Case 2: Invalid Firebase Credentials**
```
1. Service initialization fails
2. Calendar endpoints return 503 Service Unavailable
3. Events hoạt động bình thường trong PlanTracker
4. Admin được notify để fix credentials
```

**Case 3: Partial Sync Failure**
```
1. Bulk sync: một số events thành công, một số fail
2. Response: {
     "successful": 2,
     "failed": 1,
     "results": [...]
   }
3. User có thể retry failed events individually
```