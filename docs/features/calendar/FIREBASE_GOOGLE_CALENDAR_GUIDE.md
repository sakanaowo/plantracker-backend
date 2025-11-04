# Google Calendar Integration với Firebase - Setup Guide

## 🔥 Overview

PlanTracker sử dụng **Firebase Authentication** và **Firebase Admin SDK** để tích hợp với Google Calendar API. Approach này đơn giản hơn và không cần OAuth flow phức tạp vì sử dụng service account credentials đã có sẵn.

## 🔧 Firebase-based Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PlanTracker   │    │   Firebase       │    │  Google         │
│   Backend       │◄──►│   Admin SDK      │◄──►│  Calendar API   │
│   (NestJS)      │    │   (Service Acc.) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   PostgreSQL     │
                       │   - events       │
                       │   - participants │
                       │   - sync_maps    │
                       └──────────────────┘
```

## 🚀 Setup Steps

### 1. Enable Google Calendar API cho Firebase Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project: **plantracker-590f5**
3. Go to "APIs & Services" > "Library"
4. Search for "Google Calendar API" và click "Enable"

### 2. Verify Firebase Credentials

Firebase service account credentials đã sẵn có trong `firebase-keys.json`:
```json
{
  "type": "service_account",
  "project_id": "plantracker-590f5",
  "client_email": "firebase-adminsdk-fbsvc@plantracker-590f5.iam.gserviceaccount.com",
  // ... other fields
}
```

### 3. No Additional Environment Variables Needed!

Không cần thêm Google OAuth credentials vì sử dụng Firebase service account đã có.

## 📚 API Endpoints (Firebase-based)

### Calendar Management
- `GET /api/calendar/status` - Check Google Calendar service status
- `POST /api/calendar/sync-event` - Sync single event to Google Calendar
- `POST /api/calendar/bulk-sync` - Sync multiple events
- `GET /api/calendar/event-sync-status?eventId=xxx` - Get sync status
- `POST /api/calendar/unsync-event` - Remove event from Google Calendar
- `GET /api/calendar/events` - Get events from Google Calendar

### Events with Auto-sync
- `POST /api/events` - Create event (với `syncToGoogle: true` option)
- `PATCH /api/events/:id` - Update event (auto-sync nếu đã sync)
- `DELETE /api/events/:id` - Delete event (auto-remove from Google Calendar)

## 🧪 Testing Guide

### 1. Start Server
```bash
cd plantracker-backend
npm run dev
```

### 2. Test Calendar Service Status
```bash
curl -X GET "http://localhost:3000/api/calendar/status" \
     -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

Expected response:
```json
{
  "available": true,
  "calendarsCount": 1
}
```

### 3. Create Event with Google Sync
```bash
curl -X POST "http://localhost:3000/api/events" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     -d '{
       "projectId": "YOUR_PROJECT_UUID",
       "title": "Test Meeting",
       "startAt": "2025-11-05T10:00:00.000Z",
       "endAt": "2025-11-05T11:00:00.000Z",
       "location": "Online",
       "meetLink": "https://meet.google.com/xxx",
       "syncToGoogle": true,
       "participantEmails": ["test@example.com"]
     }'
```

### 4. Check Sync Status
```bash
curl -X GET "http://localhost:3000/api/calendar/event-sync-status?eventId=EVENT_UUID" \
     -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### 5. Manual Sync Existing Event
```bash
curl -X POST "http://localhost:3000/api/calendar/sync-event" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     -d '{"eventId": "YOUR_EVENT_UUID"}'
```

## 🔍 Swagger Testing

1. Open: http://localhost:3000/api/docs
2. Click "Authorize" và enter Firebase JWT token
3. Test endpoints theo thứ tự:
   - `GET /calendar/status` (check service)
   - `POST /events` với `syncToGoogle: true`
   - `GET /calendar/event-sync-status`
   - `POST /calendar/sync-event`

## 💾 Database Tables

### events
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  title VARCHAR NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location VARCHAR,
  meet_link VARCHAR,
  created_by UUID,
  -- ... other fields
);
```

### external_event_map
```sql
CREATE TABLE external_event_map (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  provider VARCHAR NOT NULL, -- 'GOOGLE_CALENDAR'
  external_event_id VARCHAR NOT NULL,
  sync_status VARCHAR NOT NULL, -- 'SYNCED', 'FAILED'
  last_synced_at TIMESTAMPTZ,
  -- ... other fields
);
```

### participants
```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  email VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  status participant_status, -- 'INVITED', 'ACCEPTED', 'DECLINED'
  -- ... other fields
);
```

## 🎯 Key Features

### ✅ **Auto-sync Events**
- Events created với `syncToGoogle: true` automatically sync to Google Calendar
- Updates to synced events automatically sync
- Deleting synced events removes from Google Calendar

### ✅ **Service Account Based**
- Uses existing Firebase service account credentials
- No OAuth flow required
- Events created in service account's calendar

### ✅ **Participant Management**
- Participants automatically added as attendees
- Email invitations sent by Google Calendar
- RSVP status tracking

### ✅ **Meeting Integration**
- Google Meet links automatically generated
- Custom meeting links supported
- Conference data included in calendar events

### ✅ **Sync Status Tracking**
- Track which events are synced
- Monitor sync success/failure
- Retry failed syncs

## 🚨 Important Notes

### Calendar Ownership
- Events are created in the **service account's calendar**
- Service account email: `firebase-adminsdk-fbsvc@plantracker-590f5.iam.gserviceaccount.com`
- Users will receive invitations to events, not see them directly in their calendar

### Alternative Approach (Future)
Để events xuất hiện trực tiếp trong user's personal calendar, cần:
1. Implement OAuth flow per user
2. Store individual user OAuth tokens
3. Create events in each user's personal calendar

### Permissions
- Service account needs Google Calendar API access
- Already configured through Firebase project
- No additional permissions required

## 🔧 Troubleshooting

### "Calendar API not enabled"
```bash
# Enable Google Calendar API in Google Cloud Console
# Project: plantracker-590f5
# Go to APIs & Services > Library > Search "Google Calendar API" > Enable
```

### "Service account authentication failed"
```bash
# Check if firebase-keys.json is properly loaded
# Verify Firebase Admin SDK initialization
```

### Events not appearing in personal calendar
```bash
# This is expected behavior with service account
# Users receive invitations instead
# To change this, implement OAuth per-user flow
```

### Sync status shows "FAILED"
```bash
# Check Google Calendar API quotas
# Verify network connectivity
# Check service account permissions
```

## 📊 Monitoring

Track these metrics:
- Sync success/failure rates
- Google Calendar API quota usage
- Event creation vs sync rates
- Failed sync retry attempts

## 🎉 Benefits of Firebase Approach

1. **Simplified Setup** - No OAuth configuration needed
2. **Unified Authentication** - Uses existing Firebase auth
3. **Service Account Security** - No user token management
4. **Automatic Sync** - Events sync automatically on create/update
5. **Centralized Calendar** - All events in one service calendar
6. **Easy Testing** - Direct API testing without OAuth flow

Approach này perfect cho team collaboration calendar! 🎯