/* global showMessageModal, showAccountLockoutModal */

// Login Form Handler with Account Lockout Modal Integration and reCAPTCHA
document.addEventListener('DOMContentLoaded', () => {
    // eslint-disable-next-line no-console
    console.log('Login form handler loaded');

    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const recaptchaContainer = document.getElementById('recaptchaContainer');

    if (!loginForm) {
        // eslint-disable-next-line no-console
        console.log('Login form not found');
        return;
    }

    // Track reCAPTCHA verification state
    let recaptchaVerified = false;

    // Show reCAPTCHA when user starts typing password
    if (passwordInput && recaptchaContainer) {
        passwordInput.addEventListener('input', function() {
            if (this.value.trim().length > 0) {
                recaptchaContainer.style.display = 'block';
            } else {
                recaptchaContainer.style.display = 'none';
                recaptchaVerified = false;
            }
        });
    }

    // Track when reCAPTCHA is completed
    // eslint-disable-next-line no-unused-vars
    window.enableSubmit = function enableSubmit(token) {
        recaptchaVerified = true;
        // eslint-disable-next-line no-console
        console.log('✅ reCAPTCHA verified');
    };

    // Track when reCAPTCHA expires or is reset
    window.disableSubmit = function disableSubmit() {
        recaptchaVerified = false;
        // eslint-disable-next-line no-console
        console.log('❌ reCAPTCHA expired');
    };

    // Handle login submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!email || !password) {
            showMessageModal('Missing Information', 'Please enter both email and password', 'warning');
            return;
        }

        // Check reCAPTCHA verification
        if (!recaptchaVerified) {
            alert('⚠️ Please verify that you are not a robot.');
            return;
        }

        // Show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        let loginSuccessful = false;

        try {
            // Get reCAPTCHA token
            let recaptchaToken = '';
            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                recaptchaToken = window.grecaptcha.getResponse();
            }

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
                // Redirect to admin dashboard
                setTimeout(() => {
                    window.location.href = '/admin-dashboard';
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
