# 📅 Google Calendar Integration

Complete Google Calendar integration for PlanTracker backend with OAuth2 authentication and two-way sync.

## 🚀 Quick Start

### 1. Setup
```bash
# Make setup script executable
chmod +x setup-google-calendar.sh

# Run setup (builds, configures, and tests)
./setup-google-calendar.sh
```

### 2. Configure Google OAuth
1. Create Google Cloud Project
2. Enable Google Calendar API
3. Create OAuth2 credentials
4. Update `.env` with your credentials:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback
   ```

### 3. Test Integration
```bash
# Interactive test with OAuth flow
FIREBASE_TOKEN=your_token node _test-scripts/test-google-calendar.js --interactive

# Or use Swagger UI
# Visit: http://localhost:3000/api/docs
```

## 📚 Documentation

- **[Setup Guide](docs/GOOGLE_CALENDAR_SETUP_GUIDE.md)** - Complete setup instructions
- **[Implementation Details](docs/GOOGLE_CALENDAR_IMPLEMENTATION_COMPLETE.md)** - Technical overview
- **[API Docs](http://localhost:3000/api/docs)** - Interactive Swagger documentation

## 🔧 API Endpoints

### Calendar OAuth
- `GET /calendar/google/auth-url` - Get OAuth authorization URL
- `POST /calendar/google/callback` - Handle OAuth callback
- `GET /calendar/integration-status` - Check connection status
- `POST /calendar/disconnect` - Disconnect Google account

### Events Management  
- `POST /events` - Create event (with Google sync option)
- `GET /events` - List events
- `GET /events/:id` - Get event details
- `PATCH /events/:id` - Update event
- `DELETE /events/:id` - Delete event
- `POST /events/:id/participants` - Add participants
- `PATCH /events/:id/participants/:email/status` - Update participant status

### Calendar Sync
- `POST /calendar/sync` - Sync events with Google Calendar

## 🧪 Testing

### Manual Testing
```bash
# Start server
npm run dev

# Test with curl
curl -X GET "http://localhost:3000/api/calendar/google/auth-url" \
     -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Automated Testing
```bash
# Run test script
FIREBASE_TOKEN=your_token \
TEST_PROJECT_ID=project_uuid \
node _test-scripts/test-google-calendar.js --interactive
```

### Swagger UI Testing
1. Visit http://localhost:3000/api/docs
2. Click "Authorize" and enter Firebase JWT token
3. Test endpoints in order:
   - Get auth URL → Complete OAuth → Check status → Create event

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   PlanTracker    │    │  Google         │
│   (React/       │◄──►│   Backend        │◄──►│  Calendar API   │
│   Android)      │    │   (NestJS)       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   PostgreSQL     │
                       │   Database       │
                       │   - events       │
                       │   - participants │
                       │   - tokens       │
                       │   - mappings     │
                       └──────────────────┘
```

## 🔐 Security Features

- **OAuth2 Flow**: Secure Google authorization
- **Token Management**: Automatic refresh of expired tokens
- **Firebase Auth**: Integration with existing authentication
- **Encrypted Storage**: Secure token storage in database
- **Project Permissions**: Users can only access their project events

## 📊 Database Schema

### Core Tables
- `events` - Event storage with project association
- `participants` - Event participants with RSVP status
- `integration_tokens` - OAuth tokens for Google Calendar
- `external_event_map` - Mapping between PlanTracker and Google events

## 🔄 Sync Features

### Two-Way Sync
- **Push to Google**: Events created in PlanTracker sync to Google Calendar
- **Pull from Google**: Import events from Google Calendar (future feature)
- **Real-time Updates**: Changes sync automatically
- **Conflict Resolution**: Handle simultaneous edits

### Event Mapping
- Tracks external event IDs
- Maintains sync relationships
- Handles event deletions
- Prevents duplicate syncing

## 🚨 Troubleshooting

### Common Issues

**"Invalid client" error**
- Check Google OAuth credentials in `.env`
- Verify redirect URI matches exactly

**Token expired**
- Tokens refresh automatically
- Re-authorize if refresh fails

**Events not syncing**
- Check Google Calendar API quotas
- Verify user has valid integration token
- Check network connectivity

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

### Database Checks
```sql
-- Check user's OAuth status
SELECT * FROM integration_tokens WHERE user_id = 'USER_ID';

-- Check event sync mappings  
SELECT * FROM external_event_map WHERE event_id = 'EVENT_ID';
```

## 🚀 Production Deployment

### Environment Variables
```bash
GOOGLE_CLIENT_ID=prod_client_id
GOOGLE_CLIENT_SECRET=prod_client_secret  
GOOGLE_REDIRECT_URI=https://api.yourapp.com/calendar/google/callback
FRONTEND_URL=https://yourapp.com
```

### Security Checklist
- [ ] Use HTTPS in production
- [ ] Secure OAuth redirect URIs
- [ ] Monitor API quotas
- [ ] Implement rate limiting
- [ ] Regular token cleanup

## 📈 Monitoring

Track these metrics:
- OAuth success/failure rates
- API quota usage
- Sync operation success rates
- Token refresh frequency
- Error rates by endpoint

## 🤝 Contributing

1. Make changes to modules in `src/modules/calendar/` or `src/modules/events/`
2. Run tests: `npm run test`
3. Build: `npm run build`
4. Test integration: `./setup-google-calendar.sh`

## 📝 License

Part of PlanTracker project - see main project license.

---

**Need help?** Check the [Setup Guide](docs/GOOGLE_CALENDAR_SETUP_GUIDE.md) or [Implementation Details](docs/GOOGLE_CALENDAR_IMPLEMENTATION_COMPLETE.md).