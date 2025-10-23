# BukSU Departmental Memo Automation and Tracking System

A web-based application for automating and tracking departmental memos at Bukidnon State University (BukSU).

## 📋 Overview

This system streamlines the process of creating, managing, and tracking departmental memos within BukSU. It features Google OAuth authentication restricted to BukSU email addresses and provides a modern, user-friendly interface.

## 🚀 Features

- **Google OAuth Authentication** - Secure login with BukSU email addresses
- **Modern UI** - Responsive design with smooth animations
- **Session Management** - Secure session handling
- **Security** - Helmet.js protection, CORS support
- **MongoDB Integration** - (In development)
- **Memo Management** - (In development)
- **Tracking System** - (In development)

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Frontend:** EJS Templates, CSS3, JavaScript
- **Authentication:** Passport.js (Google OAuth 2.0)
- **Database:** MongoDB (planned)
- **Security:** Helmet.js, express-session

## 📦 Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB (for future features)
- Google OAuth credentials

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/qesthr/BukSU-Departmental-Memo-Automation-and-Tracking-System.git
   cd BukSU-Departmental-Memo-Automation-and-Tracking-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your configuration:
   - `SESSION_SECRET` - Generate a strong random secret
   - `GOOGLE_CLIENT_ID` - From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
   - `GOOGLE_CALLBACK_URL` - Your callback URL
   - `ALLOWED_EMAIL_DOMAIN` - buksu.edu.ph

4. **Set up Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

5. **Run the application**
   ```bash
   npm start
   ```
   
   The server will start at `http://localhost:5000`

## 🔧 Development

### Running in Development Mode

```bash
npm start
```

This uses nodemon for automatic restarts on file changes.

### Code Quality

Run ESLint to check code quality:
```bash
npx eslint .
```

### Project Structure

```
.
├── app.js                      # Main application entry
├── backend/
│   ├── config/                 # Configuration files
│   ├── routes/                 # Route definitions
│   ├── middleware/             # Custom middleware
│   ├── controllers/            # Request handlers (todo)
│   ├── models/                 # Database models (todo)
│   └── utils/                  # Utility functions (todo)
├── frontend/
│   ├── public/                 # Static assets
│   │   ├── css/               # Stylesheets
│   │   ├── js/                # Client-side scripts
│   │   └── images/            # Images
│   ├── views/                  # EJS templates
│   └── components/             # Reusable components
└── .vscode/                    # VSCode configuration
```

## 📝 Code Analysis

A comprehensive code analysis has been performed. See [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for:
- Code quality assessment
- Security issues and fixes
- Recommendations for improvement
- Missing features
- Best practices

## 🔒 Security

- Session secrets are required (no fallback in production)
- Email domain restriction for authentication
- Helmet.js for security headers
- CORS protection
- HTTP-only cookies
- (Planned) CSRF protection
- (Planned) Rate limiting

## 🐛 Known Issues

1. Dashboard route not implemented
2. Database integration pending
3. HTML closing tag mismatch in login.ejs
4. Missing 'next' parameter in logout route
5. reCAPTCHA placeholder key needs configuration

See [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for detailed issue tracking.

## 🗺️ Roadmap

- [ ] Fix critical bugs
- [ ] Implement MongoDB integration
- [ ] Create User model and authentication
- [ ] Build dashboard interface
- [ ] Implement memo creation system
- [ ] Add memo tracking features
- [ ] Create admin panel
- [ ] Add notification system
- [ ] Implement testing suite
- [ ] Add API documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- Initial work - [qesthr](https://github.com/qesthr)

## 🙏 Acknowledgments

- Bukidnon State University
- All contributors and maintainers

## 📞 Support

For support, email your-email@buksu.edu.ph or open an issue in the repository.

---

**Note:** This project is under active development. Features and documentation are subject to change.