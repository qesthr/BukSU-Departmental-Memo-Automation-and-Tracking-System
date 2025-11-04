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

    // Track reCAPTCHA verification state
    let recaptchaVerified = false;

    // Show reCAPTCHA when user starts typing password
    if (passwordInput && recaptchaContainer) {
        passwordInput.addEventListener('input', function() {
            if (this.value.trim().length > 0) {
                recaptchaContainer.style.display = 'block';
                // eslint-disable-next-line no-console
                console.log(' Info: Password entered - reCAPTCHA shown');
            } else {
                recaptchaContainer.style.display = 'none';
                recaptchaVerified = false;
                updateLoginButton();
            }
        });
    }

    // Function to enable/disable login button based on reCAPTCHA state
    function updateLoginButton() {
        if (loginButton) {
            if (recaptchaVerified) {
                loginButton.disabled = false;
                loginButton.style.opacity = '1';
                loginButton.style.cursor = 'pointer';
                // eslint-disable-next-line no-console
                console.log(' Success: Login button ENABLED');
            } else {
                loginButton.disabled = true;
                loginButton.style.opacity = '0.6';
                loginButton.style.cursor = 'not-allowed';
                // eslint-disable-next-line no-console
                console.log(' Error: Login button DISABLED - Complete reCAPTCHA first');
            }
        }
    }

    // Initialize button state on load
    updateLoginButton();

    // Track when reCAPTCHA is completed (called by reCAPTCHA widget)
    // eslint-disable-next-line no-unused-vars
    window.enableSubmit = function enableSubmit(token) {
        recaptchaVerified = true;
        updateLoginButton();
        // eslint-disable-next-line no-console
        console.log(' Success: reCAPTCHA verified - button enabled');
    };

    // Track when reCAPTCHA expires or is reset (called by reCAPTCHA widget)
    window.disableSubmit = function disableSubmit() {
        recaptchaVerified = false;
        updateLoginButton();
        // eslint-disable-next-line no-console
        console.log(' Error: reCAPTCHA expired - button disabled');
    };

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

        // Check if reCAPTCHA is loaded
        if (typeof window.grecaptcha === 'undefined' || !window.grecaptcha) {
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('reCAPTCHA Error', 'reCAPTCHA is not loaded. Please refresh the page and try again.', 'error');
            } else {
                alert('reCAPTCHA Error: reCAPTCHA is not loaded. Please refresh the page and try again.');
            }
            return;
        }

        // Get reCAPTCHA token and verify it's completed
        let recaptchaToken = '';
        try {
            if (typeof window.grecaptcha.getResponse === 'function') {
                recaptchaToken = window.grecaptcha.getResponse();
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error getting reCAPTCHA response:', error);
        }

        // If no token, show error immediately and STOP
        if (!recaptchaToken || recaptchaToken.trim() === '') {
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('reCAPTCHA Required', 'Please verify the reCAPTCHA before logging in.', 'warning');
            } else {
                alert('Please verify the reCAPTCHA before logging in.');
            }
            // Focus on the reCAPTCHA to help user
            const recaptchaContainer = document.getElementById('recaptchaContainer');
            if (recaptchaContainer) {
                recaptchaContainer.style.display = 'block';
                recaptchaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // eslint-disable-next-line no-console
        console.log(' Success: reCAPTCHA token obtained, verifying on server...');

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
                recaptchaVerified = false;
                if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                    window.grecaptcha.reset();
                }
                window.disableSubmit();
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

                // Reset reCAPTCHA on error
                recaptchaVerified = false;
                if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                    window.grecaptcha.reset();
                }
                window.disableSubmit();
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Login error:', error);
            if (typeof window.showMessageModal === 'function') {
                window.showMessageModal('Network Error', 'Network error. Please try again.', 'error');
            } else {
                alert('Network Error: Network error. Please try again.');
            }
            // Reset reCAPTCHA on network error
            recaptchaVerified = false;
            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                window.grecaptcha.reset();
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
