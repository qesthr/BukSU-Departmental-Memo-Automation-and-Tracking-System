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
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // eslint-disable-next-line no-console
        console.log('Email entered:', email ? 'YES' : 'NO');
        // eslint-disable-next-line no-console
        console.log('Password entered:', password ? 'YES' : 'NO');

        // Basic validation
        if (!email || !password) {
            showMessageModal('Missing Information', 'Please enter both email and password', 'warning');
            return;
        }

        // Check if reCAPTCHA is loaded
        if (typeof window.grecaptcha === 'undefined' || !window.grecaptcha) {
            showMessageModal('reCAPTCHA Error', 'reCAPTCHA is not loaded. Please refresh the page and try again.', 'error');
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
            showMessageModal('reCAPTCHA Required', 'Please verify the reCAPTCHA before logging in.', 'warning');
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

        // FIRST: Verify reCAPTCHA token on server
        try {
            // eslint-disable-next-line no-console
            console.log(' Info: Verifying reCAPTCHA token on server...');
            const verifyRes = await fetch('/auth/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: recaptchaToken })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
                // eslint-disable-next-line no-console
                console.error(' Error: reCAPTCHA verification failed');
                showMessageModal('reCAPTCHA Verification Failed', 'Please verify the reCAPTCHA again.', 'error');
                window.grecaptcha.reset();
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
                return;
            }

            // eslint-disable-next-line no-console
            console.log(' Success: reCAPTCHA verified on server, proceeding with login...');
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(' Error: verifying reCAPTCHA:', error);
            showMessageModal('reCAPTCHA Verification Error', 'Please try again.', 'error');
            window.grecaptcha.reset();
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            return;
        }

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
                body: JSON.stringify({ email, password, recaptchaToken })
            });

            const data = await response.json();

            if (data.success) {
                loginSuccessful = true;
                showMessageModal('Login Successful', data.message, 'success');
                loginButton.textContent = 'Success! Redirecting...';

                // Redirect based on user role
                const userRole = data.user?.role;
                let redirectUrl = '/admin-dashboard'; // Default for admin

                if (userRole === 'secretary') {
                    redirectUrl = '/dashboard'; // Secretary goes to secretary-dashboard
                } else if (userRole === 'faculty') {
                    redirectUrl = '/dashboard'; // Faculty goes to faculty-dashboard
                } else if (userRole === 'admin') {
                    redirectUrl = '/admin-dashboard'; // Admin goes to admin-dashboard
                }

                // eslint-disable-next-line no-console
                console.log(' Info: Redirecting to:', redirectUrl, 'for role:', userRole);

                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 2000);
            } else {
                // Handle different types of errors
                if (response.status === 423) {
                    // Account locked - show modal
                    if (data.lockTimeRemaining) {
                        showAccountLockoutModal(data.lockTimeRemaining);
                    } else {
                        showMessageModal('Account Locked', data.message, 'error');
                    }
                } else if (response.status === 429) {
                    // IP locked - show modal
                    showMessageModal('IP Blocked', data.message, 'error');
                } else if (data.attemptsRemaining !== undefined) {
                    // Show remaining attempts in modal
                    showMessageModal('Login Failed', data.message, 'warning');
                } else {
                    // Other errors in modal
                    showMessageModal('Login Error', data.message, 'error');
                }

                // Reset reCAPTCHA on error
                recaptchaVerified = false;
                window.grecaptcha.reset();
                window.disableSubmit();
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Login error:', error);
            showMessageModal('Network Error', 'Network error. Please try again.', 'error');
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
