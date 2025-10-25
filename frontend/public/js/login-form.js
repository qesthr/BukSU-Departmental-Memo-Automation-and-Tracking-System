// Login Form Handler with Account Lockout Modal Integration and reCAPTCHA
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login form handler loaded');

    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[name="password"]');
    const recaptchaContainer = document.getElementById('recaptchaContainer');

    if (!loginForm) {
        console.log('Login form not found');
        return;
    }

    // Show reCAPTCHA when password is long enough
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            if (this.value.length >= 6) {
                if (recaptchaContainer) {
                    recaptchaContainer.style.display = 'block';
                    // Reset reCAPTCHA if it was previously solved
                    if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                        window.grecaptcha.reset();
                    }
                }
            } else {
                if (recaptchaContainer) {
                    recaptchaContainer.style.display = 'none';
                }
                if (loginButton) {
                    loginButton.disabled = true;
                }
            }
        });
    }

    // Enable submit button when reCAPTCHA is completed
    window.enableSubmit = function enableSubmit(/* token */) {
        if (loginButton) {
            loginButton.disabled = false;
        }
    };

    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!email || !password) {
            showMessageModal('Missing Information', 'Please enter both email and password', 'warning');
            return;
        }

        if (password.length < 6) {
            showMessageModal('Invalid Password', 'Password must be at least 6 characters long', 'warning');
            return;
        }

        // Check reCAPTCHA if it's visible
        if (recaptchaContainer && recaptchaContainer.style.display !== 'none') {
            if (typeof window.grecaptcha === 'undefined' || !window.grecaptcha || typeof window.grecaptcha.getResponse !== 'function') {
                showMessageModal('reCAPTCHA Error', 'reCAPTCHA not available. Please try again later.', 'error');
                return;
            }

            const recaptchaResponse = window.grecaptcha.getResponse();
            if (!recaptchaResponse) {
                showMessageModal('reCAPTCHA Required', 'Please complete the reCAPTCHA', 'warning');
                return;
            }
        }

        // Show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                showMessageModal('Login Successful', data.message, 'success');
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
                if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                    window.grecaptcha.reset();
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessageModal('Network Error', 'Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });

    // Make showMessage globally available for other scripts
    window.showLoginMessage = showMessageModal;
});
