# BukSU Memo System Utilities

This directory contains reusable utility functions for the BukSU Memo System.

## Files

- **`constants.js`** - System-wide constants (roles, statuses, priorities, etc.)
- **`validators.js`** - Validation functions for emails, passwords, memos, etc.
- **`formatters.js`** - Formatting functions for dates, files, text, etc.
- **`helpers.js`** - Helper functions for permissions, tokens, file operations, etc.
- **`google-calendar.js`** - Google Calendar API utilities

## Usage Examples

### Constants

```javascript
const {
    USER_ROLES,
    MEMO_STATUS,
    MEMO_PRIORITY,
    FILE_LIMITS,
    VALIDATION_LIMITS
} = require('./utils/constants');

// Check role
if (user.role === USER_ROLES.ADMIN) {
    // Admin logic
}

// Check status
if (memo.status === MEMO_STATUS.PENDING) {
    // Pending memo logic
}
```

### Validators

```javascript
const {
    isValidBukSuEmail,
    validatePassword,
    validateMemoSubject,
    isValidFileType,
    validateFileSize
} = require('./utils/validators');

// Validate BukSU email
if (isValidBukSuEmail(email)) {
    // Valid BukSU email
}

// Validate password
const passwordCheck = validatePassword(password);
if (!passwordCheck.valid) {
    return res.status(400).json({ message: passwordCheck.message });
}

// Validate memo subject
const subjectCheck = validateMemoSubject(subject);
if (!subjectCheck.valid) {
    return res.status(400).json({ message: subjectCheck.message });
}

// Validate file
if (!isValidFileType(file.mimetype)) {
    return res.status(400).json({ message: 'Invalid file type' });
}

const sizeCheck = validateFileSize(file.size);
if (!sizeCheck.valid) {
    return res.status(400).json({ message: sizeCheck.message });
}
```

### Formatters

```javascript
const {
    formatDateShort,
    formatDateTime,
    formatFileSize,
    formatUserName,
    truncateText,
    createSafeFilename
} = require('./utils/formatters');

// Format dates
const shortDate = formatDateShort(new Date()); // "01/15/2025"
const longDate = formatDateLong(new Date()); // "January 15, 2025"
const dateTime = formatDateTime(new Date()); // "01/15/2025, 10:30:00 AM"

// Format file size
const size = formatFileSize(1048576); // "1.0 MB"

// Format user name
const name = formatUserName(user); // "John Doe"

// Truncate text
const preview = truncateText(longText, 100); // "First 100 chars..."

// Create safe filename
const filename = createSafeFilename("Memo Subject: Important!"); // "Memo_Subject_Important"
```

### Helpers

```javascript
const {
    isAdmin,
    hasPermission,
    canCreateMemo,
    generateToken,
    isBukSuEmail,
    getUserDisplayName
} = require('./utils/helpers');

// Check permissions
if (isAdmin(user)) {
    // Admin-only logic
}

if (hasPermission(user, 'canApproveMemo')) {
    // Can approve memos
}

if (canCreateMemo(user)) {
    // Can create memos
}

// Generate tokens
const token = generateToken(32); // Random hex token

// Check email domain
if (isBukSuEmail(email)) {
    // Valid BukSU email
}

// Get display name
const displayName = getUserDisplayName(user);
```

## Real-World Examples

### In Controllers

```javascript
// backend/controllers/memoController.js
const { validateMemoSubject, validateMemoContent } = require('../utils/validators');
const { formatDateShort, formatUserName } = require('../utils/formatters');
const { canCreateMemo } = require('../utils/helpers');

exports.createMemo = async (req, res) => {
    // Check permission
    if (!canCreateMemo(req.user)) {
        return res.status(403).json({ message: 'Permission denied' });
    }

    // Validate subject
    const subjectCheck = validateMemoSubject(req.body.subject);
    if (!subjectCheck.valid) {
        return res.status(400).json({ message: subjectCheck.message });
    }

    // Validate content
    const contentCheck = validateMemoContent(req.body.content);
    if (!contentCheck.valid) {
        return res.status(400).json({ message: contentCheck.message });
    }

    // Create memo...
    const memo = await Memo.create({ ... });

    // Format response
    res.json({
        success: true,
        memo: {
            ...memo.toObject(),
            formattedDate: formatDateShort(memo.createdAt),
            senderName: formatUserName(memo.sender)
        }
    });
};
```

### In Middleware

```javascript
// backend/middleware/validateMemo.js
const { validateMemoSubject, isValidPriority } = require('../utils/validators');

const validateMemo = (req, res, next) => {
    const { subject, priority } = req.body;

    // Validate subject
    const subjectCheck = validateMemoSubject(subject);
    if (!subjectCheck.valid) {
        return res.status(400).json({ message: subjectCheck.message });
    }

    // Validate priority
    if (priority && !isValidPriority(priority)) {
        return res.status(400).json({ message: 'Invalid priority' });
    }

    next();
};

module.exports = validateMemo;
```

### In Services

```javascript
// backend/services/emailService.js
const { formatUserName, formatDateShort } = require('../utils/formatters');
const { isBukSuEmail } = require('../utils/helpers');

async function sendMemoNotification(memo, recipient) {
    // Validate email
    if (!isBukSuEmail(recipient.email)) {
        throw new Error('Invalid email domain');
    }

    // Format email content
    const emailContent = `
        Memo from: ${formatUserName(memo.sender)}
        Date: ${formatDateShort(memo.createdAt)}
        Subject: ${memo.subject}
    `;

    // Send email...
}
```

## Best Practices

1. **Use constants** instead of hardcoded strings
   ```javascript
   // ❌ Bad
   if (user.role === 'admin') { }

   // ✅ Good
   if (user.role === USER_ROLES.ADMIN) { }
   ```

2. **Validate early** in controllers
   ```javascript
   // ✅ Validate before processing
   const check = validateMemoSubject(subject);
   if (!check.valid) {
       return res.status(400).json({ message: check.message });
   }
   ```

3. **Use formatters** for consistent display
   ```javascript
   // ✅ Consistent formatting
   const date = formatDateShort(memo.createdAt);
   const size = formatFileSize(attachment.size);
   ```

4. **Check permissions** before operations
   ```javascript
   // ✅ Permission check
   if (!canCreateMemo(req.user)) {
       return res.status(403).json({ message: 'Permission denied' });
   }
   ```

## Testing Utilities

You can test utilities independently:

```javascript
// tests/utils/validators.test.js
const { isValidBukSuEmail, validatePassword } = require('../../backend/utils/validators');

test('should validate BukSU email', () => {
    expect(isValidBukSuEmail('user@buksu.edu.ph')).toBe(true);
    expect(isValidBukSuEmail('user@gmail.com')).toBe(false);
});

test('should validate password strength', () => {
    const result = validatePassword('Weak123');
    expect(result.valid).toBe(true);
});
```

## Adding New Utilities

When adding new utilities:

1. **Place in appropriate file** (validators, formatters, helpers, or constants)
2. **Add JSDoc comments** for documentation
3. **Export the function** in module.exports
4. **Update this README** with usage examples
5. **Write tests** for the new utility

## Notes

- All utilities are **pure functions** (no side effects)
- Utilities are **stateless** (no shared state)
- Functions are **synchronous** unless async is needed
- All functions include **error handling** for edge cases

