/* global showMessageModal, showAccountLockoutModal */
// ESLint: SweetAlert2 is loaded via CDN in the page head
/* global Swal */

// Login Form Handler with Account Lockout Modal Integration and reCAPTCHA
document.addEventListener('DOMContentLoaded', () => {
    // eslint-disable-next-line no-console
    console.log('=== LOGIN FORM HANDLER LOADED ===');

    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const recaptchaContainer = document.getElementById('recaptchaContainer');
    const googleRecaptchaSection = document.getElementById('googleRecaptchaSection');
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

    // Helper function to ensure reCAPTCHA is visible when password is long enough
    function ensureRecaptchaVisible() {
        if (passwordInput && passwordInput.value.length >= 6) {
            if (googleRecaptchaSection) {
                googleRecaptchaSection.style.display = 'block';
                googleRecaptchaSection.style.zIndex = '10001';
                googleRecaptchaSection.style.position = 'relative';
            }
            if (recaptchaContainer) {
                recaptchaContainer.style.display = 'block';
                recaptchaContainer.style.zIndex = '10001';
                recaptchaContainer.style.position = 'relative';
            }
        }
    }

    // Progress bar functions
    function createProgressBar() {
        // Remove existing progress bar if any
        const existing = document.getElementById('loginProgressBar');
        if (existing) {
            existing.remove();
        }

        const progressBar = document.createElement('div');
        progressBar.id = 'loginProgressBar';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background-color: rgba(0, 102, 255, 0.2);
            z-index: 10000;
            overflow: hidden;
        `;

        const progressFill = document.createElement('div');
        progressFill.id = 'loginProgressFill';
        progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #0066ff, #0052cc, #0066ff);
            background-size: 200% 100%;
            transition: width 0.3s ease;
            animation: progressShimmer 1.5s infinite;
        `;

        progressBar.appendChild(progressFill);
        document.body.appendChild(progressBar);

        // Animate progress bar
        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                progressFill.style.width = progress + '%';
            }
        }, 200);

        // Store interval ID for cleanup
        progressBar.dataset.intervalId = interval;
    }

    function completeProgressBar() {
        const progressBar = document.getElementById('loginProgressBar');
        const progressFill = document.getElementById('loginProgressFill');
        if (progressFill) {
            progressFill.style.width = '100%';
            progressFill.style.transition = 'width 0.5s ease';
            setTimeout(() => {
                if (progressBar) {
                    progressBar.style.opacity = '0';
                    progressBar.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        if (progressBar) {
                            const intervalId = progressBar.dataset.intervalId;
                            if (intervalId) clearInterval(intervalId);
                            progressBar.remove();
                        }
                    }, 300);
                }
            }, 500);
        }
    }

    function removeProgressBar() {
        const progressBar = document.getElementById('loginProgressBar');
        if (progressBar) {
            const intervalId = progressBar.dataset.intervalId;
            if (intervalId) clearInterval(intervalId);
            progressBar.style.opacity = '0';
            progressBar.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                progressBar.remove();
            }, 300);
        }
    }

    // Set up listeners and polling
    emailInput.addEventListener('input', () => { clearInlineError(); clearEmailError(); updateButtonStateWithCaptcha(); });
    passwordInput.addEventListener('input', () => {
        clearInlineError();
        // Show/hide reCAPTCHA based on password length
        if (passwordInput.value.length >= 6) {
            // Show reCAPTCHA containers
            if (googleRecaptchaSection) {
                googleRecaptchaSection.style.display = 'block';
                googleRecaptchaSection.style.zIndex = '10001';
                googleRecaptchaSection.style.position = 'relative';
            }
            if (recaptchaContainer) {
                recaptchaContainer.style.display = 'block';
                recaptchaContainer.style.zIndex = '10001';
                recaptchaContainer.style.position = 'relative';
            }
        } else {
            // Hide reCAPTCHA containers
            if (googleRecaptchaSection) {
                googleRecaptchaSection.style.display = 'none';
            }
            if (recaptchaContainer) {
                recaptchaContainer.style.display = 'none';
            }
            if (loginButton) {
                loginButton.disabled = true;
            }
        }
        updateButtonStateWithCaptcha();
    });
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
            // Ensure reCAPTCHA is visible if password is long enough
            if (password.length >= 6) {
                if (googleRecaptchaSection) {
                    googleRecaptchaSection.style.display = 'block';
                    googleRecaptchaSection.style.zIndex = '10001';
                }
                if (recaptchaContainer) {
                    recaptchaContainer.style.display = 'block';
                    recaptchaContainer.style.zIndex = '10001';
                }
            }
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

        // Show progress bar
        createProgressBar();

        let loginSuccessful = false;

        try {
            // eslint-disable-next-line no-console
            console.log('📤 Sending login request to server...');

            // Show loading modal while authenticating (using SweetAlert2)
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Signing you in…',
                    text: 'Please wait a moment.',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });
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
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Server Error',
                        text: 'Unable to process login response. Please try again.',
                        confirmButtonColor: '#ef4444'
                    });
                }
                return;
            }

            // eslint-disable-next-line no-console
            console.log('📥 Response received:', response.status, data);

            if (data.success) {
                loginSuccessful = true;

                // Complete progress bar
                completeProgressBar();

                // Redirect based on role
                const userRole = data.user?.role;
                let redirectUrl = '/admin-dashboard';
                if (userRole === 'secretary') {
                    redirectUrl = '/secretary-dashboard';
                } else if (userRole === 'faculty') {
                    redirectUrl = '/faculty-dashboard';
                }

                // eslint-disable-next-line no-console
                console.log(' Info: Redirecting to:', redirectUrl, 'for role:', userRole);

                // Show SweetAlert2 success modal
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Login Successful!',
                        text: 'Redirecting to your dashboard...',
                        showConfirmButton: false,
                        timer: 1500,
                        timerProgressBar: true,
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didClose: () => {
                            window.location.href = redirectUrl;
                        }
                    }).then(() => {
                        window.location.href = redirectUrl;
                    });
                } else {
                    // Fallback if SweetAlert2 is not available
                    setTimeout(() => { window.location.href = redirectUrl; }, 650);
                }
            } else {
                // Set loginSuccessful to false to prevent any redirects
                loginSuccessful = false;
                // Remove progress bar on error
                removeProgressBar();
                // eslint-disable-next-line no-console
                console.log('❌ Login failed:', data.errorCode, data.message);

                // Handle different types of errors
                if (data.errorCode === 'ACCOUNT_NOT_FOUND') {
                    // Account not found - show SweetAlert
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Account Not Found',
                            text: 'Couldn\'t find your account. Please check your email or contact the administrator.',
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                // Ensure reCAPTCHA visibility is maintained after modal closes
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                    showEmailError(''); // clear email error
                    showInlineError(''); // clear password error
                } else if (data.errorCode === 'ACCOUNT_INACTIVE') {
                    // Account exists but is inactive
                    // eslint-disable-next-line no-console
                    console.log('🔍 Showing ACCOUNT_INACTIVE modal');
                    const inactiveMessage = data.message || 'Your account has been deactivated. Please contact your administrator.';

                    // Close any loading modals first
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Account Deactivated',
                            text: inactiveMessage,
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                } else if (response.status === 423) {
                    // Account locked - show modal
                    if (data.lockTimeRemaining && typeof showAccountLockoutModal === 'function') {
                        if (typeof Swal !== 'undefined') { Swal.close(); }
                        showAccountLockoutModal(data.lockTimeRemaining);
                    } else {
                        if (typeof Swal !== 'undefined') {
                            Swal.close();
                            Swal.fire({
                                icon: 'error',
                                title: 'Account Locked',
                                text: data.message || 'Your account has been locked. Please contact your administrator.',
                                confirmButtonColor: '#ef4444',
                                didClose: () => {
                                    setTimeout(() => {
                                        ensureRecaptchaVisible();
                                    }, 100);
                                }
                            });
                        }
                    }
                } else if (response.status === 429) {
                    // IP locked - show modal
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'IP Blocked',
                            text: data.message || 'Your IP address has been blocked due to too many failed login attempts.',
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                } else if (data.errorCode === 'INVALID_CREDENTIALS') {
                    // Wrong password - show SweetAlert
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Invalid Credentials',
                            text: 'Wrong password. Try again or click "Forgot password?" for more options.',
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                    showInlineError(''); // clear inline error
                } else if (data.errorCode === 'GOOGLE_ONLY') {
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'warning',
                            title: 'Use Google Sign-In',
                            text: data.message || 'Please sign in with Google for this account.',
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                } else if (data.attemptsRemaining !== undefined) {
                    // Show SweetAlert for invalid credentials with remaining attempts
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Invalid Credentials',
                            text: (data.message || 'Invalid email or password.') + (data.attemptsRemaining ? ` ${data.attemptsRemaining} attempt(s) remaining.` : ''),
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                    showInlineError(''); // clear inline error
                } else {
                    // Generic error fallback
                    if (typeof Swal !== 'undefined') {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Login Error',
                            text: data.message || 'Login error. Please try again.',
                            confirmButtonColor: '#ef4444',
                            didClose: () => {
                                setTimeout(() => {
                                    ensureRecaptchaVisible();
                                }, 100);
                            }
                        });
                    }
                    showInlineError(''); // clear inline error
                }


            }
        } catch (error) {
            // Remove progress bar on error
            removeProgressBar();
            // eslint-disable-next-line no-console
            console.error('Login error:', error);
            if (typeof Swal !== 'undefined') {
                Swal.close();
                Swal.fire({
                    icon: 'error',
                    title: 'Network Error',
                    text: 'Network error. Please try again.',
                    confirmButtonColor: '#ef4444'
                });
            }
            showInlineError(''); // clear inline error
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
