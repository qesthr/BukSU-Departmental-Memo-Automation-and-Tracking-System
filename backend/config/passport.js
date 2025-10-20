const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Local Strategy for email/password login
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        // Find user by email
        const user = await User.findOne({ 
            email: email.toLowerCase().trim(),
            isActive: true 
        });

        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        // Check if account is locked
        if (user.isLocked) {
            return done(null, false, { message: 'Account is temporarily locked due to too many failed login attempts' });
        }

        // Check if user has a password (not Google OAuth only)
        if (!user.password) {
            return done(null, false, { message: 'Please use Google login for this account' });
        }

        // Compare password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            // Increment login attempts
            await user.incLoginAttempts();
            return done(null, false, { message: 'Invalid email or password' });
        }

        // Reset login attempts on successful login
        if (user.loginAttempts > 0) {
            await user.resetLoginAttempts();
        }

        // Update last login
        await User.findByIdAndUpdate(user._id, {
            lastLogin: new Date()
        });

        return done(null, user);

    } catch (error) {
        return done(error);
    }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    async function(accessToken, refreshToken, profile, cb) {
        try {
            // Check if user exists by Google ID
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                // Check if user exists by email
                user = await User.findOne({ email: profile.emails[0].value });
                
                if (user) {
                    // Update existing user with Google ID
                    user.googleId = profile.id;
                    user.profilePicture = profile.photos[0].value;
                    await user.save();
                } else {
                    // Create new user
                    user = await User.create({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        profilePicture: profile.photos[0].value,
                        role: 'faculty', // Default role for Google OAuth users
                        lastLogin: new Date()
                    });
                }
            } else {
                // Update last login and profile picture
                user.lastLogin = new Date();
                user.profilePicture = profile.photos[0].value;
                await user.save();
            }

            return cb(null, user);
        } catch (error) {
            return cb(error, null);
        }
    }
));

module.exports = passport;