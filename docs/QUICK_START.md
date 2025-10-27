# Quick Start Guide - BukSU Memo System

This guide will help you get the BukSU Departmental Memo Automation and Tracking System running on your local machine in VSCode.

## Prerequisites Checklist

- [ ] Node.js (v14 or higher) installed
- [ ] npm installed (comes with Node.js)
- [ ] VSCode installed
- [ ] Git installed
- [ ] Google Cloud account (for OAuth)

## Step 1: Clone the Repository

```bash
git clone https://github.com/qesthr/BukSU-Departmental-Memo-Automation-and-Tracking-System.git
cd BukSU-Departmental-Memo-Automation-and-Tracking-System
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- express
- passport (Google OAuth)
- mongodb
- ejs (templating)
- helmet (security)
- And more...

## Step 3: Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your actual values:

   ```env
   # Generate a secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   SESSION_SECRET=your-generated-secret-here
   
   # From Google Cloud Console
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
   
   ALLOWED_EMAIL_DOMAIN=buksu.edu.ph
   ```

### How to Get Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:5000/auth/google/callback`
7. Copy Client ID and Client Secret to your `.env` file

## Step 4: Open in VSCode

```bash
code .
```

### Install Recommended Extensions

VSCode will prompt you to install recommended extensions. Click "Install All" or install manually:

1. ESLint - For code quality
2. GitLens - For Git integration
3. MongoDB for VS Code - For database (future)
4. Thunder Client - For API testing
5. Auto Rename Tag - For HTML/EJS
6. Path Intellisense - For file paths
7. Error Lens - For inline errors

## Step 5: Run the Application

### Development Mode (with auto-restart):
```bash
npm start
```
or
```bash
npm run dev
```

### Production Mode:
```bash
npm run start:prod
```

The server will start at: **http://localhost:5000**

## Step 6: Test the Application

1. Open your browser and go to: `http://localhost:5000`
2. You should see the login page with animations
3. Click "Continue with Google" to test OAuth
4. Login with a BukSU email (@buksu.edu.ph)

## Troubleshooting

### Issue: "Cannot find module 'dotenv'"
**Solution:** Run `npm install` again

### Issue: "Error: SESSION_SECRET must be set"
**Solution:** Make sure you created the `.env` file and set SESSION_SECRET

### Issue: "Google OAuth Error"
**Solutions:**
- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in `.env`
- Verify callback URL matches in Google Console and `.env`
- Make sure you enabled Google+ API in Google Console

### Issue: Port 5000 already in use
**Solution:** Change PORT in `.env` or stop the process using port 5000:
```bash
# On Mac/Linux
lsof -ti:5000 | xargs kill

# On Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Issue: ESLint errors in VSCode
**Solution:** 
1. Make sure ESLint extension is installed
2. Run `npm run lint:fix` to auto-fix issues
3. Reload VSCode

## Useful Commands

### Linting
```bash
# Check for code issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### View Console Logs
When running the server, check the terminal for logs:
- Server start message
- Any errors or warnings
- Request logs (will add morgan later)

### Stop the Server
Press `Ctrl+C` in the terminal where the server is running

## Known Issues to Fix

Before using in production, fix these critical issues:

1. **Missing 'next' parameter in logout route** (backend/routes/auth.js)
2. **HTML closing tag mismatch** in login.ejs
3. **Database not connected** - MongoDB integration needed
4. **Dashboard route missing** - Implement dashboard page

See [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for detailed issue list.

## Development Workflow

1. **Make changes** to code files
2. **Save** - nodemon will auto-restart server
3. **Refresh browser** to see changes
4. **Check terminal** for errors
5. **Run ESLint** before committing: `npm run lint`
6. **Commit changes** with meaningful messages

## VSCode Tips

### Keyboard Shortcuts:
- `Ctrl+\`` - Open integrated terminal
- `Ctrl+P` - Quick file search
- `Ctrl+Shift+F` - Search across files
- `F2` - Rename symbol
- `Ctrl+Shift+P` - Command palette

### Debugging:
1. Set breakpoints by clicking left of line numbers
2. Press `F5` to start debugging
3. Use debug console to inspect variables

### Recommended Workspace Layout:
- Explorer (files) on left
- Editor in center
- Terminal at bottom
- Extensions on right sidebar

## Next Steps

After getting the app running:

1. ✅ Read [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for code quality insights
2. ✅ Read [ESLINT_REPORT.md](./ESLINT_REPORT.md) for specific code issues
3. ✅ Fix the critical bug in logout route
4. ✅ Fix HTML closing tag in login.ejs
5. ✅ Implement MongoDB connection
6. ✅ Create User model
7. ✅ Build dashboard page
8. ✅ Add memo management features

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [EJS Documentation](https://ejs.co/)
- [MongoDB Documentation](https://www.mongodb.com/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## Getting Help

- Check [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for detailed explanations
- Open an issue on GitHub
- Review the code comments
- Check console logs for errors

---

**Happy Coding! 🚀**

*Last Updated: 2025-10-20*
