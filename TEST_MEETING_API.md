# Test Meeting Scheduler APIs

## 1. Get Auth Token First
```bash
# Login to get token
POST http://localhost:3000/api/users/firebase/auth
Content-Type: application/json

{
  "firebaseToken": "YOUR_FIREBASE_TOKEN"
}
```

## 2. Test Suggest Meeting Times

```bash
POST http://localhost:3000/api/calendar/meetings/suggest-times
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "userIds": ["user_id_1", "user_id_2"],
  "startDate": "2025-11-08T00:00:00Z",
  "endDate": "2025-11-15T23:59:59Z",
  "durationMinutes": 60,
  "maxSuggestions": 5
}
```

### Expected Response:
```json
{
  "suggestions": [
    {
      "start": "2025-11-09T09:00:00Z",
      "end": "2025-11-09T10:00:00Z",
      "availableUsers": ["user_id_1", "user_id_2"],
      "score": 100
    }
  ],
  "totalUsersChecked": 2,
  "checkedRange": {
    "start": "2025-11-08T00:00:00Z",
    "end": "2025-11-15T23:59:59Z"
  }
}
```

## 3. Test Create Meeting

```bash
POST http://localhost:3000/api/calendar/meetings/create
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "attendeeIds": ["user_id_1", "user_id_2"],
  "timeSlot": {
    "start": "2025-11-09T09:00:00Z",
    "end": "2025-11-09T10:00:00Z",
    "availableUsers": ["user_id_1", "user_id_2"],
    "score": 100
  },
  "summary": "Sprint Planning Meeting",
  "description": "Discuss sprint goals and task allocation"
}
```

### Expected Response:
```json
{
  "eventId": "event_abc123",
  "meetLink": "https://meet.google.com/abc-defg-hij",
  "htmlLink": "https://calendar.google.com/event?eid=..."
}
```

## 4. PowerShell Test Commands

```powershell
# Test with PowerShell
$token = "YOUR_TOKEN_HERE"

# Suggest times
Invoke-RestMethod -Uri "http://localhost:3000/api/calendar/meetings/suggest-times" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
  } `
  -Body (@{
    userIds = @("user1", "user2")
    startDate = "2025-11-08T00:00:00Z"
    endDate = "2025-11-15T23:59:59Z"
    durationMinutes = 60
    maxSuggestions = 5
  } | ConvertTo-Json)
```

## Notes

- Make sure users have Google Calendar connected first
- Check `/api/auth/google/status` to verify calendar integration
- Free/Busy API requires users to have `ACTIVE` integration_tokens
