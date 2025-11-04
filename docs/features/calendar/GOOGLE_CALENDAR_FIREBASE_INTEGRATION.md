# Firebase-based Google Calendar Integration - PlanTracker Backend

## Overview

Complete Firebase service account-based Google Calendar integration for PlanTracker. This implementation uses existing Firebase credentials (`firebase-keys.json`) to authenticate with Google Calendar API, allowing seamless synchronization between PlanTracker events and Google Calendar.

## 🚀 **Implementation Status: COMPLETE**

✅ **GoogleCalendarService**: Complete Firebase-based calendar service  
✅ **CalendarController**: RESTful API endpoints for calendar operations  
✅ **Module Integration**: Properly configured CalendarModule  
✅ **Database Integration**: Uses existing `external_event_map` table  
✅ **TypeScript Build**: All compilation errors resolved  
✅ **Events Service Integration**: GoogleCalendarService injected into EventsService  

## Architecture

### Core Components

1. **GoogleCalendarService** (`google-calendar-firebase.service.ts`)
   - Firebase Admin SDK authentication 
   - Full CRUD operations for Google Calendar events
   - Automatic sync with PlanTracker events database
   - Bulk operations support

2. **CalendarController** (`calendar-firebase.controller.ts`)
   - RESTful API endpoints
   - Authentication and authorization
   - Swagger documentation
   - Error handling

3. **CalendarModule** (`calendar.module.ts`)
   - Dependency injection configuration
   - Module exports for EventsService integration

## Key Features

### ✅ Event Management
- **Create Events**: Create Google Calendar events with full metadata
- **Update Events**: Modify existing calendar events
- **Delete Events**: Remove events from Google Calendar
- **Get Events**: Retrieve calendar events with filtering

### ✅ Synchronization
- **Sync to Google**: Convert PlanTracker events to Google Calendar
- **Unsync Events**: Remove sync and delete from Google Calendar
- **Bulk Sync**: Process multiple events in batches
- **Sync Status**: Check synchronization status of events

### ✅ Database Integration
- **External Event Mapping**: Uses `external_event_map` table
- **Provider Tracking**: Tracks GOOGLE_CALENDAR provider
- **Last Sync Timestamps**: Maintains sync history
- **HTML Links**: Stores Google Calendar event URLs

## API Endpoints

### Calendar Operations
```bash
# Check service status
GET /api/calendar/status

# Sync single event
POST /api/calendar/sync-event
Body: { "eventId": "event-uuid" }

# Get sync status
GET /api/calendar/sync-status?eventId=event-uuid

# Unsync event
POST /api/calendar/unsync-event
Body: { "eventId": "event-uuid" }

# Bulk sync events
POST /api/calendar/bulk-sync
Body: { "eventIds": ["uuid1", "uuid2", "uuid3"] }
```

### Event Management
```bash
# Create calendar event
POST /api/calendar/events
Body: {
  "title": "Meeting",
  "description": "Team sync",
  "startAt": "2024-01-15T10:00:00Z",
  "endAt": "2024-01-15T11:00:00Z",
  "location": "Conference Room",
  "attendees": ["user@example.com"],
  "meetLink": "true"
}

# Update calendar event
PUT /api/calendar/events/:googleEventId
Body: { "title": "Updated Meeting", ... }

# Delete calendar event
DELETE /api/calendar/events/:googleEventId

# Get calendar events
GET /api/calendar/events?timeMin=2024-01-01&timeMax=2024-12-31&maxResults=50
```

## Database Schema Integration

### external_event_map Table
```sql
CREATE TABLE external_event_map (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id),
  provider provider NOT NULL, -- GOOGLE_CALENDAR enum value
  provider_event_id TEXT NOT NULL, -- Google Calendar event ID
  html_link TEXT, -- Google Calendar event URL
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Provider Enum
```sql
CREATE TYPE provider AS ENUM ('GOOGLE_CALENDAR', 'OUTLOOK', 'APPLE_CALENDAR');
```

## Firebase Authentication Setup

### Prerequisites
1. **Firebase Service Account**: `firebase-keys.json` in project root
2. **Google Calendar API**: Enabled in Google Cloud Console
3. **Service Account Permissions**: Calendar API access configured

### Authentication Flow
```typescript
// Service account authentication
const auth = admin.app().options.credential;
const calendar = google.calendar({ version: 'v3', auth });
```

### Required Scopes
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

## Usage Examples

### Sync PlanTracker Event to Google Calendar
```typescript
// In EventsService after creating an event
const syncResult = await this.googleCalendarService.syncEventToGoogle(eventId);
console.log(`Event synced: ${syncResult.googleEventId}`);
```

### Check Service Status
```typescript
const status = await this.googleCalendarService.checkServiceStatus();
if (status.available) {
  console.log(`Google Calendar connected: ${status.calendarsCount} calendars`);
}
```

### Bulk Sync Events
```typescript
const eventIds = ['uuid1', 'uuid2', 'uuid3'];
const results = await this.googleCalendarService.bulkSyncEvents(eventIds);
console.log(`${results.filter(r => r.success).length}/${results.length} events synced`);
```

## Error Handling

### Common Error Scenarios
1. **Firebase Authentication**: Invalid credentials or expired tokens
2. **Google API Limits**: Rate limiting and quota exceeded
3. **Calendar Permissions**: Insufficient access to calendar
4. **Event Not Found**: Missing events in database or Google Calendar

### Error Response Format
```json
{
  "error": "Event not found",
  "statusCode": 404,
  "message": "Event uuid-123 not found in database"
}
```

## Testing

### Manual Testing Scripts
Use the existing `_test-scripts/` infrastructure:

```bash
# Test calendar service status
curl -X GET "https://plantracker-backend.onrender.com/api/calendar/status" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Test event sync
curl -X POST "https://plantracker-backend.onrender.com/api/calendar/sync-event" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": "your-event-uuid"}'
```

### Integration with Events Flow
```typescript
// After creating an event in EventsService
async create(createEventDto: any, userId: string) {
  const event = await this.prisma.events.create({...});
  
  // Optional: Auto-sync to Google Calendar
  if (createEventDto.syncToGoogle) {
    try {
      await this.googleCalendarService.syncEventToGoogle(event.id);
    } catch (error) {
      this.logger.warn(`Failed to sync event to Google Calendar: ${error.message}`);
    }
  }
  
  return event;
}
```

## Configuration

### Environment Variables
```env
# Firebase credentials automatically loaded from firebase-keys.json
# No additional environment variables required
```

### Module Configuration
```typescript
// CalendarModule already configured in events.module.ts
@Module({
  imports: [PrismaModule, ActivityLogsModule, CalendarModule, UsersModule],
  // ...
})
export class EventsModule {}
```

## Security Considerations

### Service Account Security
- **Credentials Protection**: `firebase-keys.json` should never be committed to version control
- **Least Privilege**: Service account has minimal required permissions
- **Token Management**: Firebase Admin SDK handles token refresh automatically

### API Security
- **Authentication Required**: All endpoints require valid Firebase tokens
- **User Authorization**: Events can only be synced by event creators or project members
- **Input Validation**: All request data validated with DTOs

## Performance Optimization

### Bulk Operations
- **Batch Processing**: `bulkSyncEvents()` processes multiple events efficiently
- **Error Isolation**: Individual event failures don't stop batch processing
- **Result Tracking**: Detailed success/failure reporting for each event

### Database Efficiency
- **Indexed Queries**: Efficient lookups using `event_id` and `provider` indexes
- **Connection Pooling**: Prisma connection pool optimization
- **Query Optimization**: Selective field fetching with `include` statements

## Deployment Considerations

### Production Deployment
1. **Firebase Keys**: Ensure `firebase-keys.json` is properly deployed
2. **Google Cloud Project**: Verify Calendar API is enabled
3. **Service Account Permissions**: Confirm calendar access rights
4. **Environment Configuration**: Production vs development settings

### Monitoring
- **Logging**: Comprehensive logging for all calendar operations
- **Error Tracking**: Automatic error reporting and monitoring
- **Performance Metrics**: Calendar API response time tracking

## Next Steps & Enhancements

### Potential Improvements
1. **Webhook Integration**: Real-time sync from Google Calendar changes
2. **Conflict Resolution**: Handle simultaneous updates to events
3. **Calendar Selection**: Allow users to choose specific calendars
4. **Recurring Events**: Support for repeating event patterns
5. **Timezone Handling**: Enhanced timezone conversion logic

### Integration Opportunities
1. **Frontend Integration**: Android app calendar sync UI
2. **Notification Integration**: WebSocket notifications for sync events
3. **Activity Logging**: Enhanced audit trails for calendar operations
4. **User Preferences**: Per-user calendar sync settings

## Conclusion

The Firebase-based Google Calendar integration is **PRODUCTION READY** with:

✅ **Complete Implementation**: All core features implemented and tested  
✅ **Type Safety**: Full TypeScript support with proper error handling  
✅ **Database Integration**: Seamless integration with existing schema  
✅ **API Documentation**: Comprehensive Swagger documentation  
✅ **Security**: Firebase service account authentication  
✅ **Performance**: Optimized bulk operations and database queries  

The integration provides a solid foundation for calendar synchronization between PlanTracker and Google Calendar, ready for immediate production deployment.