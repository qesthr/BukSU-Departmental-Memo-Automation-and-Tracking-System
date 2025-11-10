/* global showMessageModal, showAccountLockoutModal */

// Login Form Handler with Account Lockout Modal Integration and reCAPTCHA
document.addEventListener('DOMContentLoaded', () => {
    // eslint-disable-next-line no-console
    console.log('=== LOGIN FORM HANDLER LOADED ===');

    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const recaptchaContainer = document.getElementById('recaptchaContainer');

    // eslint-disable-next-line no-console
    console.log('Login form found:', !!loginForm);
    // eslint-disable-next-line no-console
    console.log('Login button found:', !!loginButton);
    // eslint-disable-next-line no-console
    console.log('Email input found:', !!emailInput);
    // eslint-disable-next-line no-console
    console.log('Password input found:', !!passwordInput);
    // eslint-disable-next-line no-console
    console.log('reCAPTCHA container found:', !!recaptchaContainer);

    if (!loginForm) {
        // eslint-disable-next-line no-console
        console.error(' Error: Login form not found');
        return;
    }

    if (!loginButton) {
        // eslint-disable-next-line no-console
        console.error(' Error: Login button not found');
        return;
    }

    if (!emailInput || !passwordInput) {
        // eslint-disable-next-line no-console
        console.error(' Error: Input fields not found');
        return;
    }

    // Check if required functions are available
    if (typeof showMessageModal === 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(' Error: showMessageModal is not defined. Make sure message-modal.js is loaded.');
    }

    if (typeof showAccountLockoutModal === 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(' Error: showAccountLockoutModal is not defined. Make sure account-lockout-modal.js is loaded.');
    }

    // Initial state: disabled until captcha + fields are valid
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.style.opacity = '0.6';
        loginButton.style.cursor = 'not-allowed';
    }

    // Helper: get token from the single Google reCAPTCHA checkbox (shared widget)
    async function getSharedRecaptchaToken() {
        try {
            // Ensure widget exists; if not, render it in the Google section
            const existing = document.getElementById('googleRecaptchaWidget');
            let widgetId = existing ? existing.getAttribute('data-widget-id') : null;

            if (!widgetId) {
                const container = document.getElementById('googleRecaptchaContainer');
                if (!container) {
                    throw new Error('Shared reCAPTCHA container not found');
                }
                const div = document.createElement('div');
                div.id = 'googleRecaptchaWidget';
                container.appendChild(div);

                // Wait for grecaptcha to be ready
                let tries = 0;
                while ((!window.grecaptcha || typeof window.grecaptcha.render !== 'function') && tries < 10) {
                    // 3 seconds total
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    tries++;
                }

                const sitekey = container.getAttribute('data-sitekey');
                if (!sitekey) {
                    throw new Error('Missing reCAPTCHA site key');
                }

                widgetId = window.grecaptcha.render('googleRecaptchaWidget', {
                    sitekey: sitekey,
                    size: 'normal'
                });
                document.getElementById('googleRecaptchaWidget').setAttribute('data-widget-id', widgetId);
            }

            // If already checked
            const token = window.grecaptcha.getResponse(widgetId);
            if (token && token.length > 0) return token;

            // Prompt user to check the box
            const hint = document.getElementById('googleRecaptchaHint');
            if (hint) {
                hint.style.display = 'block';
                hint.textContent = 'Please check the box to continue';
            }
            document.getElementById('googleRecaptchaWidget')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

            return await new Promise((resolve) => {
                const interval = setInterval(() => {
                    const t = window.grecaptcha.getResponse(widgetId);
                    if (t && t.length > 0) {
                        clearInterval(interval);
                        resolve(t);
                    }
                }, 300);
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('reCAPTCHA acquire error:', e);
            return '';
        }
    }

    // Ensure the shared reCAPTCHA is rendered and return widget id (string)
    async function ensureSharedRecaptchaWidget() {
        try {
            const existing = document.getElementById('googleRecaptchaWidget');
            let widgetId = existing ? existing.getAttribute('data-widget-id') : null;
            if (!widgetId) {
                const container = document.getElementById('googleRecaptchaContainer');
                if (!container) return null;
                const div = document.createElement('div');
                div.id = 'googleRecaptchaWidget';
                container.appendChild(div);

                let tries = 0;
                while ((!window.grecaptcha || typeof window.grecaptcha.render !== 'function') && tries < 10) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    tries++;
                }
                const sitekey = container.getAttribute('data-sitekey');
                if (!sitekey || !window.grecaptcha) return null;
                widgetId = window.grecaptcha.render('googleRecaptchaWidget', {
                    sitekey: sitekey,
                    size: 'normal'
                });
                document.getElementById('googleRecaptchaWidget').setAttribute('data-widget-id', widgetId);
            }
            return widgetId;
        } catch {
            return null;
        }
    }

    // Enable login button only when email+password filled and captcha checked
    async function updateButtonStateWithCaptcha() {
        const emailOk = !!emailInput.value.trim();
        const passwordOk = !!passwordInput.value;
        const widgetId = await ensureSharedRecaptchaWidget();
        let captchaOk = false;
        if (widgetId && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
            captchaOk = !!window.grecaptcha.getResponse(widgetId);
        }
        const enable = emailOk && passwordOk && captchaOk;
        if (loginButton) {
            loginButton.disabled = !enable;
            loginButton.style.opacity = enable ? '1' : '0.6';
            loginButton.style.cursor = enable ? 'pointer' : 'not-allowed';
        }
    }

    // Set up listeners and polling
    emailInput.addEventListener('input', updateButtonStateWithCaptcha);
    passwordInput.addEventListener('input', updateButtonStateWithCaptcha);
    // Light polling to catch checkbox changes
    setInterval(updateButtonStateWithCaptcha, 500);

    // Handle login submission
    loginForm.addEventListener('submit', async (e) => {
        // eslint-disable-next-line no-console
        console.log(' Info: FORM SUBMITTED!');

        // CRITICAL: Prevent default form submission to keep modal on page
        e.preventDefault();
        e.stopPropagation();

        // Prevent any potential page reload or redirect
        if (e.defaultPrevented === false) {
            e.preventDefault();
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // eslint-disable-next-line no-console
        console.log('Email entered:', email ? 'YES' : 'NO');
        // eslint-disable-next-line no-console
        console.log('Password entered:', password ? 'YES' : 'NO');

        // Basic validation
        if (!email || !password) {
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('Missing Information', 'Please enter both email and password', 'warning');
            } else {
                alert('Please enter both email and password');
            }
            return;
        }

        // Get token from shared reCAPTCHA (Google section)
        const recaptchaToken = await getSharedRecaptchaToken();
        if (!recaptchaToken) {
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('reCAPTCHA Required', 'Please complete the reCAPTCHA below the Google Sign-In before logging in.', 'warning');
            } else {
                alert('Please complete the reCAPTCHA below the Google Sign-In before logging in.');
            }
            return;
        }

        // Show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Verifying...';

        // Note: backend verifies reCAPTCHA with the token in the same /auth/login request.

        // Update button text
        loginButton.textContent = 'Logging in...';

        let loginSuccessful = false;

        try {
            // eslint-disable-next-line no-console
            console.log('📤 Sending login request to server...');

            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, password, recaptchaToken })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // eslint-disable-next-line no-console
                console.error('Error parsing response:', parseError);
                if (typeof window.showMessageModal === 'function') {
                    window.showMessageModal('Server Error', 'Unable to process login response. Please try again.', 'error');
                } else {
                    alert('Server Error: Unable to process login response. Please try again.');
                }
                return;
            }

            // eslint-disable-next-line no-console
            console.log('📥 Response received:', response.status, data);

            if (data.success) {
                loginSuccessful = true;
                if (typeof window.showMessageModal === 'function') {
                    window.showMessageModal('Login Successful', data.message, 'success');
                }
                loginButton.textContent = 'Success! Redirecting...';

                // Redirect based on role
                const userRole = data.user?.role;
                let redirectUrl = '/admin-dashboard';
                if (userRole === 'secretary' || userRole === 'faculty') {
                    redirectUrl = '/dashboard';
                }

                // eslint-disable-next-line no-console
                console.log(' Info: Redirecting to:', redirectUrl, 'for role:', userRole);

                window.location.href = redirectUrl;
            } else {
                // Set loginSuccessful to false to prevent any redirects
                loginSuccessful = false;
                // eslint-disable-next-line no-console
                console.log('❌ Login failed:', data.errorCode, data.message);

                // Handle different types of errors
                if (data.errorCode === 'ACCOUNT_NOT_FOUND') {
                    // Account not found - user hasn't been invited/added by admin
                    // eslint-disable-next-line no-console
                    console.log('🔍 Showing ACCOUNT_NOT_FOUND modal');
                    const errorMessage = 'Your account has not been added by an administrator. Please contact your administrator to create your account.';

                    // Call modal directly - it should be available after DOMContentLoaded
                    if (typeof window.showMessageModal === 'function') {
                        // eslint-disable-next-line no-console
                        console.log('✅ Calling showMessageModal for ACCOUNT_NOT_FOUND with message:', errorMessage);
                        window.showMessageModal('Account Not Found', errorMessage, 'error');
                    } else {
                        // eslint-disable-next-line no-console
                        console.error('showMessageModal is not available, using alert');
                        alert('Account Not Found: ' + errorMessage);
                    }
                } else if (data.errorCode === 'ACCOUNT_INACTIVE') {
                    // Account exists but is inactive
                    // eslint-disable-next-line no-console
                    console.log('🔍 Showing ACCOUNT_INACTIVE modal');
                    const inactiveMessage = data.message || 'Your account has been deactivated. Please contact your administrator.';

                    // Call modal directly
                    if (typeof window.showMessageModal === 'function') {
                        // eslint-disable-next-line no-console
                        console.log('✅ Calling showMessageModal for ACCOUNT_INACTIVE');
                        window.showMessageModal('Account Deactivated', inactiveMessage, 'error');
                    } else {
                        // eslint-disable-next-line no-console
                        console.error('showMessageModal is not available, using alert');
                        alert('Account Deactivated: ' + inactiveMessage);
                    }
                } else if (response.status === 423) {
                    // Account locked - show modal
                    if (data.lockTimeRemaining && typeof showAccountLockoutModal === 'function') {
                        showAccountLockoutModal(data.lockTimeRemaining);
                    } else if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('Account Locked', data.message, 'error');
                    } else {
                        alert('Account Locked: ' + data.message);
                    }
                } else if (response.status === 429) {
                    // IP locked - show modal
                    if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('IP Blocked', data.message, 'error');
                    } else {
                        alert('IP Blocked: ' + data.message);
                    }
                } else if (data.attemptsRemaining !== undefined) {
                    // Show remaining attempts in modal
                    if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('Login Failed', data.message, 'warning');
                    } else {
                        alert('Login Failed: ' + data.message);
                    }
                } else {
                    // Other errors in modal
                    // eslint-disable-next-line no-console
                    console.log('🔍 Showing generic error modal');
                    if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('Login Error', data.message || 'Invalid email or password', 'error');
                    } else {
                        alert('Login Error: ' + (data.message || 'Invalid email or password'));
                    }
                }


            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Login error:', error);
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('Network Error', 'Network error. Please try again.', 'error');
            } else {
                alert('Network Error: Network error. Please try again.');
            }
        } finally {
            // Re-enable button on failure
            if (!loginSuccessful) {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        }
    });

    // Make showMessage globally available for other scripts
    window.showLoginMessage = showMessageModal;
});
