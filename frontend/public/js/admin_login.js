document.addEventListener("DOMContentLoaded", () => {
    const layers = document.querySelectorAll(".layer");
    const loginCard = document.getElementById("loginCard");
    const container = document.querySelector(".container");
    const passwordInput = document.getElementById("passwordInput");
    const emailInput = document.querySelector('input[type="email"]');
    const recaptchaContainer = document.getElementById("recaptchaContainer");
    const loginButton = document.getElementById("loginButton");

    // Modal elements
    const googleModal = document.getElementById("googleModal");
    const googleLoginBtn = document.getElementById("googleLoginBtn");
    const closeModal = document.getElementById("closeModal");
    const cancelGoogle = document.getElementById("cancelGoogle");
    const continueGoogle = document.getElementById("continueGoogle");

    // Handle password input
    passwordInput.addEventListener('input', function () {
        if (this.value.length >= 6) { // Minimum 6 characters
            recaptchaContainer.style.display = 'block';
            // Reset reCAPTCHA if it was previously solved (guarded)
            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                window.grecaptcha.reset();
            }
        } else {
            recaptchaContainer.style.display = 'none';
            loginButton.disabled = true;
        }
    });

    // Handle email input
    emailInput.addEventListener('input', () => {
        validateForm();
    });

    // Validate form function
    function validateForm() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const isValidEmail = email && email.includes('@');
        const isValidPassword = password && password.length >= 6;

        if (isValidEmail && isValidPassword) {
            recaptchaContainer.style.display = 'block';
        } else {
            recaptchaContainer.style.display = 'none';
            loginButton.disabled = true;
        }
    }

    // Delay before animation starts
    setTimeout(() => {
        // Animate layers sliding in one by one
        layers.forEach((layer, index) => {
            setTimeout(() => {
                layer.classList.add("active");
            }, index * 600);
        });

        // After all layers are done, fade in the login form
        setTimeout(() => {
            loginCard.classList.add("show");

            // 👇 After form fades in, show background image
            setTimeout(() => {
                container.classList.add("show-bg");
            }, 800); // delay ensures layers + form animation are done
        }, layers.length * 600 + 400);
    }, 900);

    // Modal functionality
    // Open Google modal when Google login button is clicked
    googleLoginBtn.addEventListener('click', () => {
        googleModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Ensure Google Sign-In button is visible
        const googleSignInButton = document.getElementById('googleSignInButton');
        if (googleSignInButton) {
            googleSignInButton.style.display = 'block';
        }

        // Initialize Google Sign-In button when modal opens
        setTimeout(() => {
            if (typeof initializeGoogleSignIn === 'function') {
                initializeGoogleSignIn();
            }
        }, 100);
    });

    // Close modal functions
    const closeGoogleModalFunc = () => {
        googleModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    };

    // Close Google modal when X is clicked
    closeModal.addEventListener('click', closeGoogleModalFunc);

    // Close Google modal when Cancel is clicked
    cancelGoogle.addEventListener('click', closeGoogleModalFunc);

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === googleModal) {
            closeGoogleModalFunc();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && googleModal.style.display === 'block') {
            closeGoogleModalFunc();
        }
    });

    // Google Sign-In is now handled by the Google Sign-In API
    // No need for manual redirect - the API handles everything within the modal
});

// Enable submit button when reCAPTCHA is completed (exposed for grecaptcha callback)
window.enableSubmit = function enableSubmit(/* token */) {
    const btn = document.querySelector(".login-btn");
    if (btn) { btn.disabled = false; }
};

// Add form submission handling
document.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.querySelector('input[type="email"]').value.trim();
    const password = document.getElementById('passwordInput').value;
    const loginButton = document.querySelector(".login-btn");

    // Basic validation
    if (!email || !password) {
        showMessageModal('Missing Information', 'Please fill in all fields', 'warning');
        return;
    }

    if (password.length < 6) {
        showMessageModal('Invalid Password', 'Password must be at least 6 characters long', 'warning');
        return;
    }

    // Check reCAPTCHA if it's visible
    const recaptchaContainer = document.getElementById("recaptchaContainer");
    if (recaptchaContainer.style.display !== 'none') {
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

    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessageModal('Login Successful', 'Login successful! Redirecting...', 'success');

            // All users are redirected to admin-dashboard
            setTimeout(() => {
                window.location.href = '/admin-dashboard';
            }, 2000);
        } else {
            showMessageModal('Login Failed', data.message || 'Login failed', 'error');
            loginButton.disabled = false;
            loginButton.textContent = 'Login';

            // Reset reCAPTCHA (guarded)
            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                window.grecaptcha.reset();
            }
        }
    } catch (error) {
        void error; // referenced to satisfy linters; actual info shown to user below
        // Network error: show friendly message (console logging intentionally omitted to satisfy lint rules)
        showMessageModal('Network Error', 'Network error. Please try again.', 'error');
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

// Make showMessage globally available for other scripts
window.showAdminMessage = showMessageModal;
