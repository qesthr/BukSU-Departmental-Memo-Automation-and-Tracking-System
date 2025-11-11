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
    const inlineError = document.getElementById('loginInlineError');
    const emailInlineError = document.getElementById('loginEmailError');

    function showInlineError(message) {
        if (!inlineError) { return; }
        inlineError.textContent = message || '';
        inlineError.style.display = message ? 'block' : 'none';
        if (passwordInput) {
            passwordInput.setAttribute('aria-invalid', 'true');
            passwordInput.style.border = '2px solid #ef4444';
            passwordInput.style.outline = 'none';
        }
    }

    function showEmailError(message) {
        if (!emailInlineError) { return; }
        emailInlineError.textContent = message || '';
        emailInlineError.style.display = message ? 'block' : 'none';
        if (emailInput) {
            emailInput.setAttribute('aria-invalid', 'true');
            emailInput.style.border = '2px solid #ef4444';
            emailInput.style.outline = 'none';
        }
    }

    function clearEmailError() {
        if (emailInlineError) {
            emailInlineError.textContent = '';
            emailInlineError.style.display = 'none';
        }
        if (emailInput) {
            emailInput.removeAttribute('aria-invalid');
            emailInput.style.border = '';
            emailInput.style.outline = '';
        }
    }

    function clearInlineError() {
        if (inlineError) {
            inlineError.textContent = '';
            inlineError.style.display = 'none';
        }
        if (passwordInput) {
            passwordInput.removeAttribute('aria-invalid');
            passwordInput.style.border = '';
            passwordInput.style.outline = '';
        }
    }

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

    // Initialize button state after a short delay to ensure reCAPTCHA widget is ready
    setTimeout(() => {
        updateButtonStateWithCaptcha();
    }, 1000);

    // Also check when reCAPTCHA is ready
    if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
        window.grecaptcha.ready(() => {
            setTimeout(() => {
                updateButtonStateWithCaptcha();
            }, 500);
        });
    }

    // Global callbacks for reCAPTCHA checkbox state changes
    // These will be called by the reCAPTCHA widget when checked/unchecked
    window.onRecaptchaVerified = function() {
        // eslint-disable-next-line no-console
        console.log('reCAPTCHA verified - updating button state');
        updateButtonStateWithCaptcha();
    };

    window.onRecaptchaExpired = function() {
        // eslint-disable-next-line no-console
        console.log('reCAPTCHA expired - updating button state');
        updateButtonStateWithCaptcha();
    };

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

                    await new Promise((resolve) => setTimeout(resolve, 300));
                    tries++;
                }

                const sitekey = container.getAttribute('data-sitekey');
                if (!sitekey) {
                    throw new Error('Missing reCAPTCHA site key');
                }

                widgetId = window.grecaptcha.render('googleRecaptchaWidget', {
                    sitekey: sitekey,
                    size: 'normal',
                    callback: function() {
                        // Called when reCAPTCHA is verified
                        if (window.onRecaptchaVerified) {
                            window.onRecaptchaVerified();
                        }
                        updateButtonStateWithCaptcha();
                    },
                    'expired-callback': function() {
                        // Called when reCAPTCHA expires
                        if (window.onRecaptchaExpired) {
                            window.onRecaptchaExpired();
                        }
                        updateButtonStateWithCaptcha();
                    }
                });
                document.getElementById('googleRecaptchaWidget').setAttribute('data-widget-id', widgetId);
            }

            // If already checked
            const token = window.grecaptcha.getResponse(widgetId);
            if (token && token.length > 0) {return token;}

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
                if (!container) {return null;}
                const div = document.createElement('div');
                div.id = 'googleRecaptchaWidget';
                container.appendChild(div);

                let tries = 0;
                while ((!window.grecaptcha || typeof window.grecaptcha.render !== 'function') && tries < 10) {

                    await new Promise((resolve) => setTimeout(resolve, 300));
                    tries++;
                }
                const sitekey = container.getAttribute('data-sitekey');
                if (!sitekey || !window.grecaptcha) {return null;}
                widgetId = window.grecaptcha.render('googleRecaptchaWidget', {
                    sitekey: sitekey,
                    size: 'normal',
                    callback: function() {
                        // Called when reCAPTCHA is verified
                        if (window.onRecaptchaVerified) {
                            window.onRecaptchaVerified();
                        }
                        updateButtonStateWithCaptcha();
                    },
                    'expired-callback': function() {
                        // Called when reCAPTCHA expires
                        if (window.onRecaptchaExpired) {
                            window.onRecaptchaExpired();
                        }
                        updateButtonStateWithCaptcha();
                    }
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

        // Clear hint message when reCAPTCHA is verified
        const recaptchaHint = document.getElementById('googleRecaptchaHint');
        if (captchaOk && recaptchaHint) {
            recaptchaHint.style.display = 'none';
            recaptchaHint.style.color = '#666';
            recaptchaHint.textContent = 'Please complete the reCAPTCHA before continuing';
        }
    }

    // Set up listeners and polling
    emailInput.addEventListener('input', () => { clearInlineError(); clearEmailError(); updateButtonStateWithCaptcha(); });
    passwordInput.addEventListener('input', () => { clearInlineError(); updateButtonStateWithCaptcha(); });
    // Light polling to catch checkbox changes
    setInterval(updateButtonStateWithCaptcha, 500);

    // Direct click handler on login button to check reCAPTCHA before form submission
    if (loginButton) {
        loginButton.addEventListener('click', async (e) => {
            // Only check if button is not disabled (to avoid duplicate checks)
            if (loginButton.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Check reCAPTCHA status before allowing form submission
            const widgetId = await ensureSharedRecaptchaWidget();
            let recaptchaVerified = false;

            if (widgetId && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                const token = window.grecaptcha.getResponse(widgetId);
                recaptchaVerified = !!(token && token.length > 0);
            }

            // If reCAPTCHA is not verified, prevent login and show inline hint
            if (!recaptchaVerified) {
                e.preventDefault();
                e.stopPropagation();

                // Inline banner under the form instead of modal/toast
                showInlineError('Please complete the reCAPTCHA before continuing.');

                // Highlight and scroll to reCAPTCHA section
                const recaptchaSection = document.getElementById('googleRecaptchaSection');
                const recaptchaHint = document.getElementById('googleRecaptchaHint');

                if (recaptchaSection) {
                    // Add visual highlight
                    recaptchaSection.style.border = '2px solid #ff6b6b';
                    recaptchaSection.style.borderRadius = '4px';
                    recaptchaSection.style.padding = '8px';
                    recaptchaSection.style.backgroundColor = '#fff5f5';
                    recaptchaSection.style.transition = 'all 0.3s ease';

                    // Scroll to reCAPTCHA section
                    recaptchaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Remove highlight after 5 seconds
                    setTimeout(() => {
                        recaptchaSection.style.border = '';
                        recaptchaSection.style.borderRadius = '';
                        recaptchaSection.style.padding = '';
                        recaptchaSection.style.backgroundColor = '';
                    }, 5000);
                }

                // Show hint message
                if (recaptchaHint) {
                    recaptchaHint.style.display = 'block';
                    recaptchaHint.style.color = '#ff6b6b';
                    recaptchaHint.textContent = '⚠️ Please verify the reCAPTCHA to continue';
                    recaptchaHint.style.fontWeight = '600';
                }

                // Ensure button is disabled
                loginButton.disabled = true;
                loginButton.style.opacity = '0.6';
                loginButton.style.cursor = 'not-allowed';

                // Re-check button state
                updateButtonStateWithCaptcha();
            }
        });
    }

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

        // Additional safety check: if button is disabled, prevent submission
        if (loginButton && loginButton.disabled) {
            // Check why it's disabled - likely missing reCAPTCHA
            const widgetId = await ensureSharedRecaptchaWidget();
            let recaptchaVerified = false;

            if (widgetId && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                const token = window.grecaptcha.getResponse(widgetId);
                recaptchaVerified = !!(token && token.length > 0);
            }

            if (!recaptchaVerified) {
                // Inline banner under the form instead of modal/toast
                showInlineError('Please complete the reCAPTCHA before continuing.');

                // Highlight reCAPTCHA section
                const recaptchaSection = document.getElementById('googleRecaptchaSection');
                if (recaptchaSection) {
                    recaptchaSection.style.border = '2px solid #ff6b6b';
                    recaptchaSection.style.borderRadius = '4px';
                    recaptchaSection.style.padding = '8px';
                    recaptchaSection.style.backgroundColor = '#fff5f5';
                    recaptchaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        recaptchaSection.style.border = '';
                        recaptchaSection.style.borderRadius = '';
                        recaptchaSection.style.padding = '';
                        recaptchaSection.style.backgroundColor = '';
                    }, 5000);
                }
            }
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // eslint-disable-next-line no-console
        console.log('Email entered:', email ? 'YES' : 'NO');
        // eslint-disable-next-line no-console
        console.log('Password entered:', password ? 'YES' : 'NO');

        // Clear any previous inline error
        clearInlineError();
        clearEmailError();

        // Basic validation
        if (!email || !password) {
            showInlineError('Please enter both email and password.');
            return;
        }

        // Check reCAPTCHA verification status first
        const widgetId = await ensureSharedRecaptchaWidget();
        let recaptchaVerified = false;

        if (widgetId && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
            const token = window.grecaptcha.getResponse(widgetId);
            recaptchaVerified = !!(token && token.length > 0);
        }

        // If reCAPTCHA is not verified, show error and highlight the reCAPTCHA section
        if (!recaptchaVerified) {
            // Show error message
            showInlineError('Please complete the reCAPTCHA before continuing.');

            // Highlight and scroll to reCAPTCHA section
            const recaptchaSection = document.getElementById('googleRecaptchaSection');
            const recaptchaHint = document.getElementById('googleRecaptchaHint');

            if (recaptchaSection) {
                // Add visual highlight
                recaptchaSection.style.border = '2px solid #ff6b6b';
                recaptchaSection.style.borderRadius = '4px';
                recaptchaSection.style.padding = '8px';
                recaptchaSection.style.backgroundColor = '#fff5f5';
                recaptchaSection.style.transition = 'all 0.3s ease';

                // Scroll to reCAPTCHA section
                recaptchaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Remove highlight after 5 seconds
                setTimeout(() => {
                    recaptchaSection.style.border = '';
                    recaptchaSection.style.borderRadius = '';
                    recaptchaSection.style.padding = '';
                    recaptchaSection.style.backgroundColor = '';
                }, 5000);
            }

            // Show hint message
            if (recaptchaHint) {
                recaptchaHint.style.display = 'block';
                recaptchaHint.style.color = '#ff6b6b';
                recaptchaHint.textContent = '⚠️ Please verify the reCAPTCHA to continue';
                recaptchaHint.style.fontWeight = '600';
            }

            // Re-enable button state check
            updateButtonStateWithCaptcha();
            return;
        }

        // Get token from shared reCAPTCHA (Google section) - should be verified at this point
        const recaptchaToken = await getSharedRecaptchaToken();
        if (!recaptchaToken) {
            // Fallback check - inline message only
            showInlineError('reCAPTCHA verification failed. Please reload the page and try again.');
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

            // Show loading modal while authenticating
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('Signing you in…', 'Please wait a moment.', 'loading');
            }

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
                if (typeof window.updateMessageModal === 'function') {
                    window.updateMessageModal('Login Successful', 'Redirecting to your dashboard…', 'success');
                } else if (typeof window.showMessageModal === 'function') {
                    window.showMessageModal('Login Successful', 'Redirecting to your dashboard…', 'success');
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

                setTimeout(() => { window.location.href = redirectUrl; }, 650);
            } else {
                // Set loginSuccessful to false to prevent any redirects
                loginSuccessful = false;
                // eslint-disable-next-line no-console
                console.log('❌ Login failed:', data.errorCode, data.message);

                // Handle different types of errors
                if (data.errorCode === 'ACCOUNT_NOT_FOUND') {
                    // Inline message for non-existent account (wrong email)
                    showEmailError('Couldn’t find your account. Please check your email or contact the administrator.');
                    showInlineError(''); // clear password error
                    if (typeof window.closeMessageModal === 'function') { window.closeMessageModal(); }
                } else if (data.errorCode === 'ACCOUNT_INACTIVE') {
                    // Account exists but is inactive
                    // eslint-disable-next-line no-console
                    console.log('🔍 Showing ACCOUNT_INACTIVE modal');
                    const inactiveMessage = data.message || 'Your account has been deactivated. Please contact your administrator.';

                    // Call modal directly
                    if (typeof window.updateMessageModal === 'function') {
                        window.updateMessageModal('Account Deactivated', inactiveMessage, 'error');
                    } else if (typeof window.showMessageModal === 'function') {
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
                    } else if (typeof window.updateMessageModal === 'function') {
                        window.updateMessageModal('Account Locked', data.message, 'error');
                    } else if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('Account Locked', data.message, 'error');
                    } else {
                        alert('Account Locked: ' + data.message);
                    }
                } else if (response.status === 429) {
                    // IP locked - show modal
                    if (typeof window.updateMessageModal === 'function') {
                        window.updateMessageModal('IP Blocked', data.message, 'error');
                    } else if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('IP Blocked', data.message, 'error');
                    } else {
                        alert('IP Blocked: ' + data.message);
                    }
                } else if (data.errorCode === 'INVALID_CREDENTIALS') {
                    // Inline message for wrong email/password
                    showInlineError('Wrong password. Try again or click "Forgot password?" for more options.');
                    if (typeof window.closeMessageModal === 'function') { window.closeMessageModal(); }
                } else if (data.errorCode === 'GOOGLE_ONLY') {
                    if (typeof window.updateMessageModal === 'function') {
                        window.updateMessageModal('Use Google Sign-In', data.message || 'Please sign in with Google for this account.', 'warning');
                    } else if (typeof window.showMessageModal === 'function') {
                        window.showMessageModal('Use Google Sign-In', data.message || 'Please sign in with Google for this account.', 'warning');
                    } else {
                        alert('Use Google Sign-In: ' + (data.message || 'Please sign in with Google for this account.'));
                    }
                } else if (data.attemptsRemaining !== undefined) {
                    // Inline message with remaining attempts
                    showInlineError(data.message || 'Invalid email or password.');
                    if (typeof window.closeMessageModal === 'function') { window.closeMessageModal(); }
                } else {
                    // Generic inline fallback for unknown errors
                    showInlineError(data.message || 'Login error. Please try again.');
                    if (typeof window.closeMessageModal === 'function') { window.closeMessageModal(); }
                }


            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Login error:', error);
            showInlineError('Network error. Please try again.');
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
