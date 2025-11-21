/* eslint-disable no-console */
/* global google */
// Google OAuth Modal - FUNCTIONAL MODAL VERSION
// This version shows Google authentication modal on the login page
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== GOOGLE OAUTH MODAL SCRIPT LOADED ===');
    console.log('Current URL:', window.location.href);
    //
    // Initialize Google Sign-In with modal approach
    function initializeGoogleSignIn() {
        console.log('Initializing Google Sign-In with modal approach...');
        console.log('Google object available:', typeof google !== 'undefined');
        console.log('Google accounts available:', typeof google !== 'undefined' && google.accounts);
        console.log('Google accounts.id available:', typeof google !== 'undefined' && google.accounts && google.accounts.id);
    //
        const container = document.getElementById('google-signin-button');
        console.log('Container found:', !!container);
        console.log('Container element:', container);

        if (!container) {
            console.error('Google sign-in button container not found');
            console.log('Available elements with IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return;
        }

        // Enforce fallback so we can guard with reCAPTCHA before any Google modal appears
        console.log('Forcing fallback flow to apply pre-auth reCAPTCHA');
        initializeWithFallback();
        return;
    }


    // Initialize with fallback button (popup OAuth - no redirect)
    function initializeWithFallback() {
        const container = document.getElementById('google-signin-button');
        console.log('Creating fallback button in container:', container);

        // Clear any existing content
        container.innerHTML = '';

        // Create the fallback button (guarded by v2 Checkbox reCAPTCHA)
        const button = document.createElement('button');
        button.type = 'button';
        button.onclick = async function() {
            console.log('Fallback button clicked! Ensuring reCAPTCHA checkbox is completed...');
            try {
                const token = await ensureCheckboxRecaptcha();
                console.log('Checkbox reCAPTCHA token obtained:', !!token);
                const ok = await verifyRecaptchaServer(token);
                if (!ok) {
                    if (typeof window.showRecaptchaErrorModal === 'function') {
                        window.showRecaptchaErrorModal();
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Verification Failed',
                            text: 'reCAPTCHA verification failed. Please try again.'
                        });
                    }
                    return;
                }
                openGoogleOAuthPopup();
            } catch (err) {
                console.error('reCAPTCHA error:', err);
                if (typeof window.showRecaptchaErrorModal === 'function') {
                    window.showRecaptchaErrorModal();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Verification Error',
                        text: 'Unable to verify. Please try again.'
                    });
                }
            }
        };
        button.style.cssText = `
            width: 100%;
            padding: 12px 16px;
            background: white;
            border: 1px solid #dadce0;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            color: #3c4043;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

        // Add hover effects
        button.onmouseover = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        };
        button.onmouseout = function() {
            this.style.backgroundColor = 'white';
            this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        };

        // Add Google icon SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('fill', '#4285F4');
        path1.setAttribute('d', 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z');
        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('fill', '#34A853');
        path2.setAttribute('d', 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z');
        const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path3.setAttribute('fill', '#FBBC05');
        path3.setAttribute('d', 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z');
        const path4 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path4.setAttribute('fill', '#EA4335');
        path4.setAttribute('d', 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z');
        svg.appendChild(path1);
        svg.appendChild(path2);
        svg.appendChild(path3);
        svg.appendChild(path4);

        // Add text
        const text = document.createTextNode('Sign in with Google');

        button.appendChild(svg);
        button.appendChild(text);
        container.appendChild(button);

        console.log('Google Sign-In button created with fallback method');
    }

    // Ensure v2 Checkbox reCAPTCHA is rendered and completed
    async function ensureCheckboxRecaptcha() {
        // Ensure widget exists
        const existing = document.getElementById('googleRecaptchaWidget');
        let widgetId = existing ? existing.getAttribute('data-widget-id') : null;

        if (!widgetId) {
            const container = document.getElementById('googleRecaptchaContainer');
            if (!container) {
                throw new Error('Invisible reCAPTCHA container missing');
            }
            const div = document.createElement('div');
            div.id = 'googleRecaptchaWidget';
            container.appendChild(div);

            // Wait for grecaptcha to be available (retry up to ~3s)
            let tries = 0;
            while ((!window.grecaptcha || typeof window.grecaptcha.render !== 'function') && tries < 10) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                tries++;
            }

            const sitekey = container.getAttribute('data-sitekey');
            if (!sitekey) {
                throw new Error('Missing reCAPTCHA sitekey');
            }

            widgetId = window.grecaptcha.render('googleRecaptchaWidget', {
                sitekey: sitekey,
                size: 'normal'
            });
            document.getElementById('googleRecaptchaWidget').setAttribute('data-widget-id', widgetId);
        }

        // If user hasn't checked it yet, prompt them
        const token = window.grecaptcha.getResponse(widgetId);
        if (token && token.length > 0) {
            return token;
        }
        // Provide a hint and focus the widget; wait for change
        const hint = document.getElementById('googleRecaptchaHint');
        if (hint) { hint.style.display = 'block'; hint.textContent = 'Please check the box to continue'; }
        document.getElementById('googleRecaptchaWidget').scrollIntoView({ behavior: 'smooth', block: 'center' });

        return await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const t = window.grecaptcha.getResponse(widgetId);
                if (t && t.length > 0) {
                    clearInterval(checkInterval);
                    resolve(t);
                }
            }, 300);
        });
    }

    // Verify token on server
    async function verifyRecaptchaServer(token) {
        try {
            const res = await fetch('/auth/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            return res.ok && data && data.success;
        } catch {
            return false;
        }
    }

    /**
     * Open Google OAuth authentication in a popup window
     *
     * This function:
     * 1. Opens a modal popup window for Google OAuth (500x600px, centered)
     * 2. Shows loading state in the parent window
     * 3. Listens for messages from the popup via postMessage API
     * 4. When authentication succeeds, calls loadDashboardContent() to fetch and render dashboard
     *
     * Flow:
     * - User clicks "Sign in with Google" → popup opens
     * - Popup goes through Google OAuth flow (/auth/google → Google → /auth/google/callback)
     * - Callback page detects it's in a popup and sends message to parent
     * - Parent receives message and loads dashboard content dynamically
     * - Popup closes automatically
     * - User sees dashboard without leaving the login page
     */
    function openGoogleOAuthPopup() {
        console.log('🚀 Opening Google OAuth popup...');
        console.log('Parent window URL:', window.location.href);

        // Calculate popup window position (centered on screen)
        // This ensures the popup appears in the middle of the user's screen
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        // Show loading state in parent window while popup is open
        // This provides visual feedback that authentication is in progress
        const container = document.getElementById('google-signin-button');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;"><div style="border: 3px solid #f3f3f3; border-top: 3px solid #4285f4; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div><p>Opening sign-in...</p></div>';
        }

        // Open popup window
        // window.open() creates a new browser window/tab with specified parameters
        // The popup will navigate to /auth/google which triggers Passport.js OAuth flow
        console.log('📂 Opening popup window to /auth/google');
        const popup = window.open(
            '/auth/google',
            'google-auth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,directories=no,status=no`
        );
        console.log('Popup window opened:', !!popup);
        console.log('Popup closed:', popup?.closed);

        // Expose popup globally so parent can close it upon success
        try { window.authPopup = popup; } catch { /* ignore */ }

        // Initialize global auth completion flag
        window.googleAuthCompleted = false;

        // Monitor popup closure - global message listener will handle auth success
        console.log('📝 Popup opened, monitoring for close...');

        // Check if popup was blocked
        if (!popup || popup.closed) {
            console.log('⚠️ Popup was blocked - staying on page and showing inline button');
            if (container) {
                initializeWithFallback();
            }
            return;
        }

        // Monitor popup window to detect manual close by user
        // The global listener in login.ejs will set window.googleAuthCompleted = true
        let popupCheckCount = 0;
        const checkPopupInterval = setInterval(() => {
            popupCheckCount++;

            if (popup.closed) {
                console.log('🔍 Popup closed detected (check #' + popupCheckCount + ')');

                clearInterval(checkPopupInterval);

                // Reset login button if user closed popup before auth completed
                if (!window.googleAuthCompleted) {
                    console.log('⚠️ Popup closed by user before authentication completed');
                    initializeGoogleSignIn();
                } else {
                    console.log('✅ Popup closed after successful authentication');
                }
            }
        }, 100);
    }

    // Handle Google credential response (for GSI modal)
    function handleCredentialResponse(response) {
        console.log('=== GOOGLE CREDENTIAL RECEIVED ===');
        console.log('Credential length:', response.credential ? response.credential.length : 'null');

        // Clear modal interaction timeout since we got a response
        clearModalTimeout();

        if (!response || !response.credential) {
            console.error('No credential received from Google');
            return;
        }

        // Show loading state
        const container = document.getElementById('google-signin-button');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;"><div style="border: 3px solid #f3f3f3; border-top: 3px solid #4285f4; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div><p>Signing in...</p></div>';
        }

        // Set a timeout for the backend authentication request
        const authTimeout = setTimeout(() => {
            console.log('Backend authentication timeout reached, falling back...');
            Swal.fire({
                icon: 'warning',
                title: 'Timeout',
                text: 'Authentication is taking too long. Please try again.'
            });
            initializeGoogleSignIn();
        }, 15000); // 15 seconds timeout for backend response

        // Send credential to backend
        fetch('/auth/google-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                credential: response.credential
            })
        })
        .then(response => {
            console.log('Backend response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Backend response:', data);
            // Clear the timeout since we got a response
            clearTimeout(authTimeout);

            if (data.success) {
                console.log('Login successful! Verifying and redirecting to dashboard...');
                // Verify email and redirect based on role
                checkAuthAndRedirect();
            } else {
                console.error('Login failed:', data.message);
                Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: 'Login failed: ' + data.message
                });
                // Re-initialize button
                initializeGoogleSignIn();
            }
        })
        .catch(error => {
            console.error('Error during authentication:', error);
            clearTimeout(authTimeout);
            Swal.fire({
                icon: 'error',
                title: 'Authentication Error',
                text: 'Authentication error: ' + error.message
            });
            // Re-initialize button
            initializeGoogleSignIn();
        });
    }

    /**
     * Load dashboard content dynamically without full page reload
     *
     * This function:
     * 1. Verifies user authentication via /api/auth/current-user
     * 2. Determines user role (admin, secretary, faculty)
     * 3. Fetches the appropriate dashboard HTML (admin-dashboard or dashboard)
     * 4. Replaces the current page content with dashboard HTML
     * 5. Executes dashboard scripts automatically
     *
     * Note: This approach keeps the user in the same browser tab/window,
     * providing a seamless experience without page refreshes.
     */
    window.loadDashboardContent = async function() {
        console.log('📥 loadDashboardContent() called - fetching dashboard without reload');
        console.log('Current URL:', window.location.href);

        try {
            // STEP 1: Verify the user is authenticated and get their role
            // This ensures the session was properly established during OAuth
            console.log('🔍 Step 1: Verifying authentication...');
            const userResponse = await fetch('/api/auth/current-user', {
                credentials: 'include'  // CRITICAL: Send cookies/session
            });
            const userData = await userResponse.json();

            console.log('📥 User verification response:', userData);

            if (!userResponse.ok || !userData || !userData.success) {
                console.error('❌ User not authenticated');
                Swal.fire({
                    icon: 'error',
                    title: 'Authentication Failed',
                    text: 'Authentication failed. Please try again.'
                });
                return;
            }

            // STEP 2: Get user role from the authenticated session
            const userRole = userData.user?.role;
            console.log('👤 Step 2: User role detected:', userRole);

            // STEP 3: Determine which dashboard to load based on user role
            // Admin users get /admin-dashboard, others get /dashboard
            let dashboardUrl = '/admin-dashboard';
            if (userRole === 'secretary' || userRole === 'faculty') {
                dashboardUrl = '/dashboard';
            } else if (userRole !== 'admin') {
                console.error('❌ Invalid user role:', userRole);
                Swal.fire({
                    icon: 'error',
                    title: 'Access Denied',
                    text: 'You do not have access to the dashboard.'
                });
                return;
            }

            console.log('📊 Step 3: Fetching dashboard from:', dashboardUrl);

            // STEP 4: Fetch the dashboard HTML content using AJAX
            // This gets the full HTML of the dashboard page without redirecting
            const dashboardResponse = await fetch(dashboardUrl, {
                credentials: 'include'  // CRITICAL: Send cookies/session
            });
            if (!dashboardResponse.ok) {
                throw new Error(`Failed to load dashboard: ${dashboardResponse.status}`);
            }

            const dashboardHtml = await dashboardResponse.text();
            console.log('✅ Step 4: Dashboard HTML received, length:', dashboardHtml.length);

            // STEP 5: Replace the entire page content with dashboard HTML
            // This replaces the login page with the dashboard content
            // document.open/write/close pattern is used to replace entire page while executing scripts
            document.open();
            document.write(dashboardHtml);
            document.close();

            console.log('✅ Step 5: Dashboard loaded successfully');
            console.log('📝 Dashboard scripts are executing...');

            // STEP 6: Trigger custom event to notify that dashboard is loaded
            // This allows other scripts to react to the dashboard load if needed
            window.dispatchEvent(new Event('dashboardLoaded'));

        } catch (error) {
            // Error handling: If anything fails, fallback to traditional redirect
            console.error('❌ Error loading dashboard:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load dashboard. Redirecting...'
            });
            // Fallback to full page redirect
            window.location.href = '/admin-dashboard';
        }
    };

    // Legacy function for redirect-based flow (kept for reference)
    async function checkAuthAndRedirect() {
        console.log('🔍 checkAuthAndRedirect() called');
        console.log('Current window URL:', window.location.href);

        try {
            console.log('📡 Fetching current user info from /api/auth/current-user...');
            const response = await fetch('/api/auth/current-user', {
                credentials: 'include'
            });
            const data = await response.json();

            console.log('📥 Response status:', response.ok);
            console.log('📥 Response data:', data);

            if (!response.ok || !data || !data.success) {
                throw new Error('Failed to get user info');
            }

            console.log('👤 User data received:', data.user);
            console.log('👤 User role:', data.user?.role);

            // Redirect based on role
            if (data.user && data.user.role === 'admin') {
                console.log('✅ User is admin, redirecting to admin dashboard...');
                window.location.href = '/admin-dashboard';
            } else if (data.user && (data.user.role === 'secretary' || data.user.role === 'faculty')) {
                console.log('✅ User is ' + data.user.role + ', redirecting to user dashboard...');
                window.location.href = '/dashboard';
            } else {
                console.error('❌ Invalid role:', data.user?.role);
                window.location.href = '/?error=invalid_role';
            }
        } catch (error) {
            console.error('❌ Error checking auth status:', error);
            window.location.href = '/auth-success';
        }
    }

    // Add global error handler for Google Identity Services
    window.addEventListener('error', (event) => {
        console.log('=== GLOBAL ERROR DETECTED ===');
        console.log('Error message:', event.message);
        console.log('Error source:', event.filename);
        console.log('Error line:', event.lineno);

        // Handle postMessage errors (null reference issues)
        if (event.message && event.message.includes('postMessage')) {
            console.error('Google Identity Services postMessage error:', event);
            console.log('This is likely the gsi/transform null reference issue!');
            console.log('Falling back to traditional OAuth redirect...');
            // Prevent further GSI attempts
            window.gsiDisabled = true;
            initializeWithFallback();
        }

        // Handle gsi/transform errors
        if (event.message && event.message.includes('gsi/transform')) {
            console.error('GSI Transform error detected:', event);
            console.log('This is the gsi/transform freeze issue!');
            console.log('Aborting any ongoing gsi/transform requests...');
            // Prevent further GSI attempts
            window.gsiDisabled = true;
            // Force fallback immediately
            setTimeout(() => initializeWithFallback(), 100);
        }

        // Handle null reference errors in transform layer
        if (event.message && event.message.includes('Cannot read properties of null')) {
            console.error('Null reference error in GSI transform layer:', event);
            console.log('This is a critical GSI library error, falling back...');
            window.gsiDisabled = true;
            initializeWithFallback();
        }
    });

    // Add unhandled promise rejection handler for fetch timeouts
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.name === 'AbortError') {
            console.log('=== FETCH REQUEST ABORTED ===');
            console.log('This might be due to gsi/transform timeout');
            console.log('Falling back to traditional OAuth...');
            initializeWithFallback();
        }
    });

    // Monitor network requests for gsi/transform
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && url.includes('gsi/transform')) {
            console.log('=== GSI TRANSFORM REQUEST DETECTED ===');
            console.log('URL:', url);
            console.log('This is the problematic gsi/transform endpoint!');

            // Create AbortController to timeout the request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('Aborting gsi/transform request due to timeout');
                controller.abort();
            }, 5000); // 5 seconds timeout for gsi/transform

            // Modify args to include signal
            const modifiedArgs = [...args];
            if (modifiedArgs.length > 1 && typeof modifiedArgs[1] === 'object') {
                modifiedArgs[1].signal = controller.signal;
            } else {
                modifiedArgs[1] = { signal: controller.signal };
            }

            // Call original fetch with modified args
            const promise = originalFetch.apply(this, modifiedArgs);

            // Clear timeout if request completes
            promise.finally(() => clearTimeout(timeoutId));

            return promise;
        }
        return originalFetch.apply(this, args);
    };

    // Global timeout for modal interaction
    let modalInteractionTimeout;

    // Wait a bit for Google Identity Services to load, then initialize
    setTimeout(() => {
        // Check if we should skip GSI entirely
        if (window.gsiDisabled) {
            console.log('GSI disabled from previous session, using fallback...');
            initializeWithFallback();
        } else {
            initializeGoogleSignIn();
        }
    }, 500);

    // Function to start modal interaction timeout
    function startModalTimeout() {
        modalInteractionTimeout = setTimeout(() => {
            console.log('Modal interaction timeout reached, falling back to traditional OAuth...');
            Swal.fire({
                icon: 'warning',
                title: 'Timeout',
                text: 'The sign-in process is taking too long. Switching to alternative method.'
            });
            initializeWithFallback();
        }, 15000); // 15 seconds for complete modal interaction
    }

    // Function to clear modal interaction timeout
    function clearModalTimeout() {
        if (modalInteractionTimeout) {
            clearTimeout(modalInteractionTimeout);
            modalInteractionTimeout = undefined;
        }
    }

    // Override the renderButton to add click listener for timeout
    const originalRenderButton = google.accounts.id.renderButton;
    google.accounts.id.renderButton = function(container, options) {
        // Start timeout when button is rendered
        startModalTimeout();

        return originalRenderButton.call(this, container, options);
    };
});

// Add CSS for any loading states if needed
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
/* eslint-enable no-console */
