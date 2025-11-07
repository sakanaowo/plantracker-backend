# 🧪 TESTING SESSION - Google Calendar OAuth Integration
**Date**: November 7, 2025  
**Time Started**: 22:00  
**Status**: ✅ Environment Ready

---

## ✅ SETUP COMPLETED

### 1. Environment Variables ✅
```bash
GOOGLE_CLIENT_ID=<from .env or secrets manager>
GOOGLE_CLIENT_SECRET=<from .env or secrets manager>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 2. Backend Server ✅
- Running on: `http://localhost:3000`
- Status: Active

### 3. Available Endpoints

#### OAuth Endpoints (GoogleAuthController)
```
GET  /auth/google/auth-url     - Get OAuth authorization URL
GET  /auth/google/callback     - Handle OAuth callback (browser redirect)
GET  /auth/google/status       - Check integration status
GET  /auth/google/disconnect   - Disconnect integration
```

#### Calendar Endpoints (CalendarController)
```
GET  /calendar/google/auth-url - Alternative auth URL endpoint
POST /calendar/google/callback - Alternative callback endpoint
GET  /calendar/google/status   - Alternative status endpoint
POST /calendar/sync            - Manual sync events
```

---

## 🎯 TESTING PHASES

### Phase 1: OAuth Connection (HIGH PRIORITY)

#### Test 1.1: Get Authorization URL ⏳ IN PROGRESS

**Endpoint**: `GET /auth/google/auth-url`

**Requirements**:
1. Valid Firebase JWT token
2. User must be authenticated in Firebase

**How to get Firebase Token**:

**Option A: From Android App (Recommended)**
1. Open Android app
2. Login with test account
3. Check logs for JWT token
4. Token format: `eyJhbGciOiJSUzI1NiIsImtpZCI6...`

**Option B: Create Test User**
1. Go to Firebase Console: https://console.firebase.google.com/
2. Project: plantracker-590f5
3. Authentication > Users > Add User
4. Create test user: test@plantracker.com / password123
5. Use Firebase Admin SDK to get custom token

**Option C: Use Existing User from Database**
```sql
SELECT id, email, firebase_uid FROM users LIMIT 5;
```

**Testing Steps**:
```bash
# Using curl
curl -X GET "http://localhost:3000/auth/google/auth-url" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# OR using the test script
cd _test-scripts
node quick-test-calendar.js

# OR using VS Code REST Client
# Open: _test-scripts/test-calendar-oauth.http
# Replace YOUR_FIREBASE_TOKEN
# Click "Send Request"
```

**Expected Response**:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar..."
}
```

**Verification Checklist**:
- [ ] Response status: 200 OK
- [ ] `authUrl` field present
- [ ] URL contains: `accounts.google.com/o/oauth2/v2/auth`
- [ ] URL contains scopes: `calendar`, `calendar.events`
- [ ] URL contains: `state` parameter (userId)
- [ ] URL contains: `prompt=consent`

---

#### Test 1.2: Complete OAuth Flow ⏳ PENDING

**Endpoint**: `GET /auth/google/callback`

**Steps**:
1. Copy the `authUrl` from Test 1.1
2. Open it in browser
3. Sign in with Google account
4. Click "Allow" to authorize PlanTracker
5. Browser redirects to: `http://localhost:3000/auth/google/callback?code=XXX&state=USER_ID`
6. Backend processes callback automatically
7. Final redirect: `http://localhost:3000/calendar/connected?success=true&email=XXX`

**Verification Checklist**:
- [ ] Google consent screen appears
- [ ] Shows correct app name: PlanTracker
- [ ] Shows requested permissions: Google Calendar
- [ ] Redirect to callback URL successful
- [ ] Final redirect shows `success=true`
- [ ] Database updated with tokens

**Database Verification**:
```sql
SELECT 
  user_id, 
  provider, 
  account_email, 
  status, 
  expires_at,
  created_at
FROM integration_tokens 
WHERE provider = 'GOOGLE_CALENDAR' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Database Record**:
- `provider`: GOOGLE_CALENDAR
- `status`: ACTIVE
- `access_token`: (encrypted)
- `refresh_token`: (encrypted)
- `account_email`: user's Google email
- `expires_at`: ~1 hour from now

---

#### Test 1.3: Check Integration Status ⏳ PENDING

**Endpoint**: `GET /auth/google/status`

**Testing**:
```bash
curl -X GET "http://localhost:3000/auth/google/status" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected Response** (Connected):
```json
{
  "connected": true,
  "isConnected": true,
  "accountEmail": "user@gmail.com",
  "status": "ACTIVE",
  "expiresAt": "2025-11-07T23:00:00.000Z",
  "lastSyncAt": "2025-11-07T22:00:00.000Z"
}
```

**Expected Response** (Not Connected):
```json
{
  "connected": false,
  "isConnected": false,
  "message": "Google Calendar not connected"
}
```

**Verification Checklist**:
- [ ] Response status: 200 OK
- [ ] `connected` or `isConnected`: true
- [ ] `accountEmail` shows correct Google account
- [ ] `status`: ACTIVE
- [ ] `expiresAt` is in future

---

### Phase 2: Task Calendar Sync ⏳ PENDING

*(Will be tested after OAuth connection successful)*

---

### Phase 3: Project Events with Google Meet ⏳ PENDING

*(Will be tested after OAuth connection successful)*

---

## 📊 TESTING PROGRESS

| Phase | Test | Status | Time | Notes |
|-------|------|--------|------|-------|
| 1 | Get Auth URL | ⏳ IN PROGRESS | - | Waiting for Firebase token |
| 1 | Complete OAuth | ⏳ PENDING | - | - |
| 1 | Check Status | ⏳ PENDING | - | - |
| 2 | Enable Task Reminder | ⏳ PENDING | - | - |
| 2 | Update Task | ⏳ PENDING | - | - |
| 2 | Disable Reminder | ⏳ PENDING | - | - |
| 3 | Create Event + Meet | ⏳ PENDING | - | - |
| 3 | Create Event No Meet | ⏳ PENDING | - | - |
| 3 | Update Event | ⏳ PENDING | - | - |
| 3 | Delete Event | ⏳ PENDING | - | - |

---

## 🚨 BLOCKERS & ISSUES

### Current Blocker
**Issue**: Need Firebase JWT token to test endpoints  
**Impact**: Cannot proceed with testing  
**Resolution Options**:
1. Get token from Android app
2. Create test user in Firebase
3. Use existing user from database

---

## 📝 NOTES

- Server is running successfully on localhost:3000
- Google OAuth credentials are configured correctly
- Database migrations skipped (as requested)
- Test scripts created and ready to use

---

## 🔄 NEXT STEPS

1. **IMMEDIATE**: Get Firebase JWT token
   - Option A: From Android app logs
   - Option B: Create test user in Firebase Console
   - Option C: Query existing user from database

2. **THEN**: Test OAuth flow (Phase 1)
   - Get auth URL
   - Complete authorization in browser
   - Verify tokens saved to database

3. **AFTER**: Test calendar sync features (Phase 2 & 3)

---

**Last Updated**: 22:05, November 7, 2025

