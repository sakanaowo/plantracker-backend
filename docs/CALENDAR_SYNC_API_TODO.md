# 🔴 URGENT: Calendar Sync API Missing - Backend Implementation

**Priority:** Critical  
**Blocking:** Calendar tab sync functionality  
**Assignee:** Backend Dev  
**Estimate:** 2 hours

---

## 🐛 Issue Description

**Frontend Error:**

```json
{
  "message": "Cannot GET /api/calendar/sync/from-google?projectId=cf0b30d0-f683-4956-803f-962b5ad60858&timeMin=2025-11-01T00%3A00%3A00&timeMax=2025-11-30T23%3A59%3A59",
  "error": "Not Found",
  "statusCode": 404
}
```

**Root Cause:**

- Frontend calls `GET /api/calendar/sync/from-google`
- Backend only has `POST /api/calendar/sync`
- Parameters mismatch: Frontend sends `timeMin`, `timeMax` but backend không có

---

## 🎯 Required Endpoint

### API Specification

**Endpoint:** `GET /api/calendar/sync/from-google`

**Query Parameters:**

- `projectId` (string, required) - Project UUID
- `timeMin` (string, required) - ISO 8601 datetime (e.g., `2025-11-01T00:00:00`)
- `timeMax` (string, required) - ISO 8601 datetime (e.g., `2025-11-30T23:59:59`)

**Headers:**

- `Authorization: Bearer <firebase_token>` (from CombinedAuthGuard)

**Response:** `200 OK`

```json
[
  {
    "id": "event-uuid",
    "projectId": "project-uuid",
    "title": "Team Meeting",
    "description": "Discuss Q4 roadmap",
    "startTime": "2025-11-15T14:00:00Z",
    "endTime": "2025-11-15T15:00:00Z",
    "eventType": "MEETING",
    "status": "SCHEDULED",
    "location": "Conference Room A",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "googleEventId": "google_event_123",
    "attendees": ["user-1", "user-2"],
    "createdAt": "2025-11-10T10:00:00Z",
    "updatedAt": "2025-11-10T10:00:00Z"
  }
]
```

**Error Responses:**

`400 Bad Request` - Missing parameters

```json
{
  "statusCode": 400,
  "message": "projectId, timeMin, and timeMax are required",
  "error": "Bad Request"
}
```

`401 Unauthorized` - Google Calendar not connected

```json
{
  "statusCode": 401,
  "message": "Google Calendar not connected",
  "error": "Unauthorized"
}
```

---

## 📝 Implementation Guide

### File 1: Controller

**File:** `plantracker-backend/src/modules/calendar/calendar.controller.ts`

**Add this endpoint:**

```typescript
@Get('sync/from-google')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
@ApiOperation({
  summary: 'Sync events from Google Calendar to project',
  description: 'Fetch events from Google Calendar within time range and sync to project calendar'
})
@ApiResponse({
  status: 200,
  description: 'Events synced successfully',
  type: [CalendarEventDTO],
})
@ApiResponse({
  status: 400,
  description: 'Invalid parameters',
})
@ApiResponse({
  status: 401,
  description: 'Google Calendar not connected',
})
async syncFromGoogle(
  @CurrentUser('id') userId: string,
  @Query('projectId') projectId: string,
  @Query('timeMin') timeMin: string,
  @Query('timeMax') timeMax: string,
) {
  // Validate inputs
  if (!projectId || !timeMin || !timeMax) {
    throw new BadRequestException('projectId, timeMin, and timeMax are required');
  }

  // Validate time range
  const minDate = new Date(timeMin);
  const maxDate = new Date(timeMax);

  if (isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) {
    throw new BadRequestException('Invalid date format. Use ISO 8601 (e.g., 2025-11-01T00:00:00)');
  }

  if (minDate >= maxDate) {
    throw new BadRequestException('timeMin must be before timeMax');
  }

  // Sync events from Google Calendar
  const events = await this.googleCalendarService.syncEventsFromGoogle(
    userId,
    projectId,
    timeMin,
    timeMax,
  );

  return events;
}
```

### File 2: Service

**File:** `plantracker-backend/src/modules/calendar/google-calendar.service.ts`

**Add new method:**

```typescript
/**
 * Sync events from Google Calendar to project
 * @param userId User ID
 * @param projectId Project ID
 * @param timeMin Start of time range (ISO 8601)
 * @param timeMax End of time range (ISO 8601)
 * @returns Array of synced calendar events
 */
async syncEventsFromGoogle(
  userId: string,
  projectId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  // 1. Get user's Google Calendar integration
  const integration = await this.prisma.integrationToken.findFirst({
    where: {
      userId,
      provider: 'GOOGLE_CALENDAR',
      status: 'ACTIVE',
    },
  });

  if (!integration) {
    throw new UnauthorizedException('Google Calendar not connected. Please connect in Settings.');
  }

  // 2. Setup OAuth2 client
  const oauth2Client = this.getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
  });

  try {
    // 3. Fetch events from Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    this.logger.log(`Fetching events from Google Calendar for user ${userId}, project ${projectId}`);
    this.logger.log(`Time range: ${timeMin} to ${timeMax}`);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250, // Google Calendar API limit
    });

    const googleEvents = response.data.items || [];
    this.logger.log(`Found ${googleEvents.length} events from Google Calendar`);

    // 4. Sync each event to database
    const syncedEvents: CalendarEvent[] = [];

    for (const googleEvent of googleEvents) {
      try {
        const event = await this.syncEventFromGoogle(googleEvent, userId, projectId);
        syncedEvents.push(event);
      } catch (error) {
        this.logger.error(`Failed to sync event ${googleEvent.id}: ${error.message}`);
        // Continue syncing other events even if one fails
      }
    }

    this.logger.log(`Successfully synced ${syncedEvents.length} events`);
    return syncedEvents;

  } catch (error) {
    // Handle token refresh if needed
    if (error.code === 401 || error.code === 403) {
      this.logger.warn('Access token expired, attempting refresh...');

      try {
        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update token in database
        await this.prisma.integrationToken.update({
          where: { id: integration.id },
          data: {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || integration.refreshToken,
            expiresAt: credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : null,
          },
        });

        // Retry fetching events
        oauth2Client.setCredentials(credentials);
        return this.syncEventsFromGoogle(userId, projectId, timeMin, timeMax);

      } catch (refreshError) {
        this.logger.error('Failed to refresh token:', refreshError);
        throw new UnauthorizedException('Google Calendar session expired. Please reconnect in Settings.');
      }
    }

    this.logger.error('Error fetching events from Google Calendar:', error);
    throw new InternalServerErrorException('Failed to sync events from Google Calendar');
  }
}

/**
 * Sync a single Google Calendar event to database
 * Creates new event or updates existing one
 */
private async syncEventFromGoogle(
  googleEvent: any,
  userId: string,
  projectId: string,
): Promise<CalendarEvent> {
  // Check if event already exists
  const existingEvent = await this.prisma.calendarEvent.findFirst({
    where: {
      googleEventId: googleEvent.id,
      projectId,
    },
  });

  // Parse start/end times
  const startTime = new Date(
    googleEvent.start?.dateTime || googleEvent.start?.date
  );
  const endTime = new Date(
    googleEvent.end?.dateTime || googleEvent.end?.date
  );

  // Prepare event data
  const eventData = {
    title: googleEvent.summary || 'Untitled Event',
    description: googleEvent.description || null,
    startTime,
    endTime,
    location: googleEvent.location || null,
    meetLink: googleEvent.hangoutLink || googleEvent.conferenceData?.entryPoints?.[0]?.uri || null,
    eventType: this.determineEventType(googleEvent),
    status: this.mapGoogleStatus(googleEvent.status),
  };

  if (existingEvent) {
    // Update existing event
    this.logger.log(`Updating existing event: ${existingEvent.id}`);
    return this.prisma.calendarEvent.update({
      where: { id: existingEvent.id },
      data: eventData,
    });
  } else {
    // Create new event
    this.logger.log(`Creating new event from Google: ${googleEvent.id}`);
    return this.prisma.calendarEvent.create({
      data: {
        ...eventData,
        projectId,
        userId,
        googleEventId: googleEvent.id,
      },
    });
  }
}

/**
 * Determine event type based on Google Calendar event properties
 */
private determineEventType(googleEvent: any): string {
  // Check if it has Meet link
  if (googleEvent.hangoutLink || googleEvent.conferenceData) {
    return 'MEETING';
  }

  // Check if it's all-day
  if (googleEvent.start?.date && !googleEvent.start?.dateTime) {
    return 'MILESTONE';
  }

  // Default to OTHER
  return 'OTHER';
}

/**
 * Map Google Calendar event status to our status enum
 */
private mapGoogleStatus(googleStatus: string): string {
  switch (googleStatus) {
    case 'confirmed':
      return 'SCHEDULED';
    case 'tentative':
      return 'SCHEDULED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'SCHEDULED';
  }
}
```

### File 3: DTO (Optional)

**File:** `plantracker-backend/src/modules/calendar/dto/calendar-event.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CalendarEventDTO {
  @ApiProperty({ example: 'event-uuid' })
  id: string;

  @ApiProperty({ example: 'project-uuid' })
  projectId: string;

  @ApiProperty({ example: 'Team Meeting' })
  title: string;

  @ApiProperty({ example: 'Discuss Q4 roadmap', required: false })
  description?: string;

  @ApiProperty({ example: '2025-11-15T14:00:00Z' })
  startTime: Date;

  @ApiProperty({ example: '2025-11-15T15:00:00Z' })
  endTime: Date;

  @ApiProperty({ example: 'MEETING', enum: ['MEETING', 'MILESTONE', 'OTHER'] })
  eventType: string;

  @ApiProperty({ example: 'SCHEDULED', enum: ['SCHEDULED', 'CANCELLED'] })
  status: string;

  @ApiProperty({ example: 'Conference Room A', required: false })
  location?: string;

  @ApiProperty({
    example: 'https://meet.google.com/abc-defg-hij',
    required: false,
  })
  meetLink?: string;

  @ApiProperty({ example: 'google_event_123', required: false })
  googleEventId?: string;

  @ApiProperty({
    example: ['user-1', 'user-2'],
    type: [String],
    required: false,
  })
  attendees?: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

---

## 🧪 Testing

### Manual Testing with curl

```bash
# Get Firebase token first
FIREBASE_TOKEN="your-firebase-id-token"

# Test sync endpoint
curl -X GET "http://localhost:3000/api/calendar/sync/from-google?projectId=cf0b30d0-f683-4956-803f-962b5ad60858&timeMin=2025-11-01T00:00:00&timeMax=2025-11-30T23:59:59" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
[
  {
    "id": "cm123abc...",
    "projectId": "cf0b30d0-f683-4956-803f-962b5ad60858",
    "title": "Sprint Planning",
    "description": "Plan sprint 12 tasks",
    "startTime": "2025-11-15T09:00:00.000Z",
    "endTime": "2025-11-15T10:00:00.000Z",
    "eventType": "MEETING",
    "status": "SCHEDULED",
    "location": null,
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "googleEventId": "abc123xyz_20251115T090000Z",
    "attendees": null,
    "createdAt": "2025-11-10T12:00:00.000Z",
    "updatedAt": "2025-11-10T12:00:00.000Z"
  }
]
```

### Test with REST Client

**File:** `_test-scripts/test-calendar-sync.http`

```http
### Sync events from Google Calendar
GET {{baseUrl}}/calendar/sync/from-google?projectId={{projectId}}&timeMin=2025-11-01T00:00:00&timeMax=2025-11-30T23:59:59
Authorization: Bearer {{firebaseToken}}
Content-Type: application/json

### Test với invalid date format
GET {{baseUrl}}/calendar/sync/from-google?projectId={{projectId}}&timeMin=invalid&timeMax=2025-11-30T23:59:59
Authorization: Bearer {{firebaseToken}}

### Test without Google Calendar connected
GET {{baseUrl}}/calendar/sync/from-google?projectId={{projectId}}&timeMin=2025-11-01T00:00:00&timeMax=2025-11-30T23:59:59
Authorization: Bearer {{firebaseToken}}
```

---

## ✅ Acceptance Criteria

- [ ] Endpoint `GET /api/calendar/sync/from-google` created
- [ ] Accepts `projectId`, `timeMin`, `timeMax` query params
- [ ] Validates user has Google Calendar connected
- [ ] Fetches events from Google Calendar API
- [ ] Creates/updates events in `calendar_events` table
- [ ] Returns array of CalendarEvent DTOs
- [ ] Handles token refresh if expired
- [ ] Proper error handling (400, 401, 500)
- [ ] Swagger documentation updated
- [ ] Tested with real Google Calendar account
- [ ] Frontend Calendar tab sync works

---

## 🔗 Related Files

**Backend:**

- `src/modules/calendar/calendar.controller.ts` (add endpoint)
- `src/modules/calendar/google-calendar.service.ts` (add sync logic)
- `src/modules/calendar/dto/calendar-event.dto.ts` (response DTO)

**Frontend (Already Implemented):**

- `CalendarApiService.java` - Has `syncFromGoogle()` method
- `CalendarRepositoryImpl.java` - Calls API
- `ProjectCalendarViewModel.java` - Triggers sync
- `ProjectCalendarFragment.java` - Sync button

**Database:**

- Table: `calendar_events`
- Table: `integration_tokens` (for Google auth)

---

## 📊 Impact

**Blocked Features:**

- Calendar tab "Sync" button ❌
- Display events from Google Calendar ❌
- Two-way sync with Google ❌

**After Fix:**

- Users can sync Google Calendar events to project ✅
- Events display in Calendar tab ✅
- Meetings show in project timeline ✅

---

## 💡 Notes

**Google Calendar API Limits:**

- Max 250 events per request
- Rate limit: 1M requests/day/project
- Quota: 1000 requests/100 seconds/user

**Optimization Ideas (Later):**

- Implement pagination for >250 events
- Add incremental sync (only fetch changed events)
- Cache events to reduce API calls
- Background job for auto-sync every hour

**Security:**

- Validate `projectId` belongs to user
- Rate limit sync endpoint (max 10/minute)
- Log all Google API calls for debugging

---

**Deadline:** ASAP - blocking Calendar tab functionality  
**Questions:** Contact frontend dev về DTO format hoặc error codes cần thêm
