# Unauthorized Access Warning - When It Triggers

## When the Warning WILL Trigger:

### Scenario 1: Direct URL Access
**As a faculty user, try typing in the browser address bar:**
```
http://localhost:5000/admin-dashboard
```
**Result:** Warning logged, redirected to `/faculty-dashboard?error=unauthorized_access`

### Scenario 2: Admin Route Access
**As a faculty user, try accessing any admin route:**
```
http://localhost:5000/admin/users
http://localhost:5000/admin/settings
http://localhost:5000/admin/calendar
```
**Result:** Warning logged, redirected to `/faculty-dashboard?error=unauthorized_access`

### Scenario 3: API Call to Admin Endpoint
**As a faculty user, open browser console and run:**
```javascript
fetch('/api/admin/users', { credentials: 'include' })
  .then(res => res.json())
  .then(data => console.log(data));
```
**Result:** Warning logged, returns 403 JSON error

### Scenario 4: Clicking Admin Link (if somehow visible)
**If a faculty user somehow sees and clicks an admin navigation link:**
```html
<a href="/admin/users">Users</a>
```
**Result:** Warning logged, redirected with error message

### Scenario 5: Bookmarked Admin URL
**If a faculty user has a bookmark to:**
```
http://localhost:5000/admin-dashboard
```
**Result:** Warning logged when they click the bookmark

## When the Warning WILL NOT Trigger:

### ✅ Normal Login Redirect
**During login, if code temporarily hits `/admin-dashboard` before redirecting:**
- No warning (silent redirect to own dashboard)

### ✅ Redirect to Own Dashboard
**If user is being redirected to their own dashboard:**
- Faculty → `/faculty-dashboard` = No warning
- Secretary → `/secretary-dashboard` = No warning

### ✅ Non-Admin Routes
**Accessing routes that don't require admin:**
- `/faculty-dashboard` = No warning
- `/secretary-dashboard` = No warning
- `/dashboard` = No warning (redirects based on role)

## Testing the Warning:

### Method 1: Browser Address Bar
1. Login as faculty user
2. Manually type: `http://localhost:5000/admin-dashboard`
3. Press Enter
4. Check server console for warning

### Method 2: Browser Console
1. Login as faculty user
2. Open browser DevTools (F12)
3. Go to Console tab
4. Type: `window.location.href = '/admin-dashboard'`
5. Press Enter
6. Check server console for warning

### Method 3: Direct Link Test
1. Login as faculty user
2. Open browser DevTools (F12)
3. Go to Console tab
4. Create and click a link:
```javascript
const link = document.createElement('a');
link.href = '/admin/users';
link.click();
```
5. Check server console for warning

### Method 4: API Test
1. Login as faculty user
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run:
```javascript
fetch('/api/admin/users', { credentials: 'include' })
  .then(res => res.json())
  .then(data => console.log(data));
```
5. Check server console for warning

## Expected Console Output:

When warning triggers, you'll see:
```
Unauthorized access attempt: User test.faculty1@buksu.edu.ph (faculty) tried to access admin route: /admin-dashboard
```

Or for API:
```
Unauthorized access attempt: User test.faculty1@buksu.edu.ph (faculty) tried to access admin API route: /api/admin/users
```

