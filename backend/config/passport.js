const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
        // Check if email domain is allowed
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
        
        if (!email.endsWith(`@${allowedDomain}`)) {
            return cb(new Error('Email domain not allowed'));
        }

        // Here you would typically:
        // 1. Check if user exists in your database
        // 2. Create user if they don't exist
        // 3. Return user data
        return cb(null, profile);
    }
));

module.exports = passport;