# Google Calendar Integration Setup Guide

## 🔧 Setup Google OAuth Credentials

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized redirect URIs:
   ```
   http://localhost:3000/api/calendar/google/callback
   https://plantracker-backend.onrender.com/api/calendar/google/callback
   ```
5. Download the credentials JSON file

### 3. Configure Environment Variables

Create or update `.env` file in the backend root:

```bash
# Google OAuth2 Configuration (REQUIRED)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000

# Existing variables (keep these)
NEON_DATABASE_URL=your_database_url
FIREBASE_PROJECT_ID=your_firebase_project_id
# ... other existing env vars
```

### 4. Test OAuth Flow

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Open Swagger docs: http://localhost:3000/api/docs

3. Test the OAuth flow:
   - Use `GET /api/calendar/google/auth-url` to get authorization URL
   - Visit the URL to authorize with Google
   - Copy the authorization code from callback
   - Use `POST /api/calendar/google/callback` with the code

## 🧪 API Testing Guide

### Manual Testing Steps

1. **Get Auth URL**:
   ```bash
   curl -X GET "http://localhost:3000/api/calendar/google/auth-url" \
        -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
   ```

2. **Handle OAuth Callback** (after user authorizes):
   ```bash
   curl -X POST "http://localhost:3000/api/calendar/google/callback" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
        -d '{"code": "OAUTH_CODE_FROM_GOOGLE"}'
   ```

3. **Check Integration Status**:
   ```bash
   curl -X GET "http://localhost:3000/api/calendar/integration-status" \
        -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
   ```

4. **Create Event with Google Sync**:
   ```bash
   curl -X POST "http://localhost:3000/api/events" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
        -d '{
          "projectId": "PROJECT_UUID",
          "title": "Test Meeting",
          "startAt": "2025-11-05T10:00:00.000Z",
          "endAt": "2025-11-05T11:00:00.000Z",
          "location": "Online",
          "syncToGoogle": true,
          "participantEmails": ["test@example.com"]
        }'
   ```

### Swagger UI Testing

1. Open http://localhost:3000/api/docs
2. Authorize with Firebase token (click "Authorize" button)
3. Test endpoints in this order:
   - `GET /calendar/google/auth-url`
   - `POST /calendar/google/callback` (after OAuth)
   - `GET /calendar/integration-status`
   - `POST /events` (with syncToGoogle: true)
   - `POST /calendar/sync` (to sync existing events)

## 🔍 Troubleshooting

### Common Issues

1. **"Invalid client" error**:
   - Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   - Verify redirect URI matches exactly

2. **"Access denied" error**:
   - User denied calendar permissions
   - Request proper scopes in frontend

3. **Token refresh fails**:
   - Check if refresh_token exists in database
   - May need to re-authorize user

4. **Events not syncing**:
   - Check if user has integration_tokens record
   - Verify Google Calendar API quota limits

### Debug Logs

Enable debug logs by setting:
```bash
LOG_LEVEL=debug
```

### Database Verification

Check integration status in database:
```sql
-- Check user's OAuth tokens
SELECT * FROM integration_tokens WHERE user_id = 'USER_ID';

-- Check synced events
SELECT * FROM external_event_map WHERE event_id = 'EVENT_ID';

-- Check created events
SELECT * FROM events WHERE created_by = 'USER_ID';
```

## 🎯 Production Deployment

### Environment Setup

```bash
# Production environment variables
GOOGLE_CLIENT_ID=prod_client_id
GOOGLE_CLIENT_SECRET=prod_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/calendar/google/callback
FRONTEND_URL=https://yourfrontend.com
```

### Security Considerations

1. Use HTTPS in production
2. Secure OAuth redirect URIs
3. Monitor API quota usage
4. Implement rate limiting
5. Regular token cleanup for inactive users

### Monitoring

Monitor these metrics:
- OAuth success/failure rates
- API call quotas
- Token refresh frequency
- Sync operation success rates

## 📱 Frontend Integration Example

```typescript
// Example frontend OAuth flow
const initiateGoogleAuth = async () => {
  const response = await fetch('/api/calendar/google/auth-url', {
    headers: {
      'Authorization': `Bearer ${firebaseToken}`
    }
  });
  const { authUrl } = await response.json();
  window.location.href = authUrl;
};

// Handle callback (in your callback page)
const handleCallback = async (code: string) => {
  await fetch('/api/calendar/google/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firebaseToken}`
    },
    body: JSON.stringify({ code })
  });
};
```

This completes the Google Calendar integration setup! 🎉