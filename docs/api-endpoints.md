# PlanTracker API Endpoints

Base URL: `http://localhost:3000/api`

## Users

### POST /users/local/signup
- **Auth:** Public
- **Description:** Register a new user with email/password. Also provisions a Firebase account and persists the profile.
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "string (6-100 chars)",
    "name": "optional display name"
  }
  ```
- **Response:** Returns the persisted user plus Firebase ID/refresh tokens.

### POST /users/local/signin
- **Auth:** Public
- **Description:** Sign in with email/password via Firebase.
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "string (6-100 chars)"
  }
  ```
- **Response:** Returns the user profile along with `token`, `refreshToken`, and `expiresIn`.

### POST /users/firebase/sync
- **Auth:** Bearer token (Firebase ID token)
- **Description:** Syncs the Firebase profile into the local database. Only available to Firebase-sourced users.
- **Body:** None
- **Response:** `{ "user": { ...synced user row... } }`

### GET /users/me
- **Auth:** Bearer token
- **Description:** Fetch the current authenticated user. Resolves either by Firebase UID or local user ID, depending on the token source.
- **Body:** None

### PUT /users/me
- **Auth:** Bearer token
- **Description:** Update the authenticated user's profile.
- **Body:**
  ```json
  {
    "name": "optional string (<=100 chars)",
    "email": "optional valid email",
    "avatar_url": "optional HTTPS URL"
  }
  ```

## Workspaces
_All workspace routes require a Bearer token._

### POST /workspaces/users/{userId}/personal
- **Description:** Create (or ensure) the personal workspace for the specified user. Caller must match `{userId}`.
- **Body:**
  ```json
  {
    "name": "optional override for personal workspace name"
  }
  ```

### POST /workspaces
- **Description:** Create a new workspace owned by the caller.
- **Body:**
  ```json
  {
    "name": "required string (<=100 chars)",
    "type": "optional workspace_type enum"
  }
  ```

### GET /workspaces
- **Description:** List workspaces the caller belongs to.

### GET /workspaces/{id}
- **Description:** Fetch workspace details the caller has access to.

### PATCH /workspaces/{id}
- **Description:** Update workspace metadata.
- **Body:**
  ```json
  {
    "name": "optional string (<=100 chars)",
    "type": "optional workspace_type enum"
  }
  ```

### DELETE /workspaces/{id}
- **Description:** Remove a workspace (requires proper permissions).

### GET /workspaces/{id}/members
- **Description:** List members of the workspace.

### POST /workspaces/{id}/members
- **Description:** Add a member to the workspace.
- **Body:**
  ```json
  {
    "userId": "UUID of the user to add",
    "role": "role enum (owner | admin | member)"
  }
  ```

### DELETE /workspaces/{id}/members/{userId}
- **Description:** Remove a member from the workspace.

> `workspace_type` and `role` enums come from the Prisma schema. Check `@prisma/client` definitions for the accepted values.
