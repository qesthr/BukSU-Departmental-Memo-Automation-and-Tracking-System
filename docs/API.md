## API Documentation

### Module Description

This API provides endpoints to manage user authentication, session control, and secure operations. It supports Google OAuth as the primary method and manual email/password login for invited users. The API includes endpoints for login, Google token verification, profile retrieval and update, one-time code (OTP) request and verification for password reset, and session termination. Inputs are validated, protected routes require authentication, and responses use meaningful HTTP status codes:

- 200 OK – Successful operation
- 201 Created – Resource successfully created
- 400 Bad Request – Invalid input
- 401 Unauthorized – Missing/invalid credentials or token
- 403 Forbidden – Insufficient permissions
- 404 Not Found – Resource not available
- 500 Internal Server Error – Unexpected server error

### Essential Endpoints (sample-style)

Base URL: http://localhost:5000

- http://localhost:5000/api/auth/login
- http://localhost:5000/api/auth/google-token (verify Google users via token)
- http://localhost:5000/api/auth/current-user (profile retrieval)
- http://localhost:5000/api/auth/me (profile update, PUT)
- http://localhost:5000/forgot-password (send OTP/code, POST)
- http://localhost:5000/reset-code (verify OTP/code, POST)
- http://localhost:5000/api/auth/logout

### Quick Endpoint List (sample style)

Base URL: http://localhost:5000

- http://localhost:5000/api/auth/login
- http://localhost:5000/api/auth/verify-recaptcha
- http://localhost:5000/api/auth/current-user
- http://localhost:5000/api/auth/logout
- http://localhost:5000/api/auth/google (start Google OAuth)
- http://localhost:5000/api/auth/google/callback (OAuth callback)
- http://localhost:5000/api/auth/google-token (modal/token login)
- http://localhost:5000/api/users (GET all users, admin)
- http://localhost:5000/api/users/invite (POST invite user, admin)
- http://localhost:5000/invite/:token (GET invite page)
- http://localhost:5000/invite/complete (POST complete invite)
- http://localhost:5000/api/log/memos (GET/POST memos)
- http://localhost:5000/api/log/memos/:id (GET/PUT/DELETE memo)
- http://localhost:5000/api/log/memos/:id/restore (PUT restore memo)
- http://localhost:5000/api/log/memos/:id/permanent (DELETE permanently)
- http://localhost:5000/api/log/notifications (GET)
- http://localhost:5000/api/log/notifications/:id/read (PUT)
- http://localhost:5000/api/drive/status (GET)
- http://localhost:5000/api/drive/authorize (GET, admin)
- http://localhost:5000/api/drive/callback (GET)
- http://localhost:5000/api/drive/folder (GET/POST, admin)
- http://localhost:5000/api/drive/disconnect (DELETE, admin)
- http://localhost:5000/api/calendar/events (GET/POST)
- http://localhost:5000/api/calendar/events/:id (PUT/DELETE)
- http://localhost:5000/api/calendar/events/:id/time (PATCH)
- http://localhost:5000/forgot-password (GET/POST)
- http://localhost:5000/reset-code (GET/POST)
- http://localhost:5000/reset-password (GET/POST)

Note: The `auth` router is mounted at both `/api/auth` and `/auth`. Endpoints are identical under both prefixes unless noted.

### Auth Endpoints (base: `/api/auth`)

- POST `/login`
- POST `/verify-recaptcha`
- POST `/logout`
- GET `/current-user`
- GET `/check-auth`
- PUT `/me` (auth)
- POST `/me/profile-picture` (auth, multipart)
- GET `/forgot-password-system-test`
- GET `/google-oauth-test`
- GET `/gsi-debug-test`
- GET `/google-signin-test`
- GET `/forgot-password-test`
- GET `/google-modal-test`
- GET `/google-test`
- GET `/debug-google`
- GET `/google/modal`
- GET `/google/modal/callback`
- POST `/google-token`
- GET `/google/callback-page`
- GET `/google` (starts OAuth)
- GET `/google/callback` (OAuth callback)
- GET `/google/error`
- GET `/logout` (legacy)

Total: 24

### User Endpoints (base: `/api/users`)

- GET `/departments` (auth)
- GET `/` (auth, admin)
- POST `/` (auth, admin)
- PUT `/:id` (auth, admin)
- DELETE `/:id` (auth, admin)
- POST `/:id/profile-picture` (auth, admin, multipart)
- POST `/invite` (auth, admin)
- GET `/invite/:token` (public – renders invite page)
- POST `/invite/complete` (public – complete invite)

Total: 9

### Memo/Log Endpoints (base: `/api/log`)

- GET `/memos` (auth)
- GET `/memos/:id` (auth)
- POST `/memos` (auth, multipart attachments)
- PUT `/memos/:id` (auth)
- DELETE `/memos/:id` (auth)
- PUT `/memos/:id/restore` (auth)
- DELETE `/memos/:id/permanent` (auth)
- PUT `/memos/:id/approve` (auth, admin)
- PUT `/memos/:id/reject` (auth, admin)
- GET `/department-users` (auth)
- POST `/memos/distribute` (auth)
- GET `/dashboard/stats` (auth, admin)
- GET `/notifications` (auth)
- PUT `/notifications/:id/read` (auth)

Total: 14

### Google Drive Endpoints (base: `/api/drive`)

- GET `/authorize` (auth, admin)
- GET `/callback`
- GET `/status` (auth)
- DELETE `/disconnect` (auth, admin)
- POST `/folder` (auth, admin)
- GET `/folder` (auth, admin)

Total: 6

### Calendar Endpoints (base: `/api/calendar`) [auth, admin]

- GET `/events`
- POST `/events`
- PUT `/events/:id`
- PATCH `/events/:id/time`
- DELETE `/events/:id`

Total: 5

### Password Endpoints (base: `/api/password`) [auth]

- POST `/set-password`
- GET `/has-password`

Total: 2

### Public Password Flow (mounted at `/`)

- GET `/forgot-password`
- POST `/forgot-password`
- GET `/reset-code`
- POST `/reset-code`
- GET `/reset-password`
- POST `/reset-password`

Total: 6

### Public Invite Flow (mounted at `/`)

- GET `/invite/:token`
- POST `/invite/complete`

Total: 2

### Summary Counts

- `/api/auth`: 24 (also available under `/auth`)
- `/api/users`: 9
- `/api/log`: 14
- `/api/drive`: 6
- `/api/calendar`: 5
- `/api/password`: 2
- Public password flow: 6
- Public invite flow: 2

Overall endpoints listed: 68

Notes

- Some endpoints render EJS pages (test/debug and invite pages); they are included for completeness.
- File upload endpoints expect `multipart/form-data`.
- Most `/api/*` endpoints require authentication; admin-only endpoints are marked.
