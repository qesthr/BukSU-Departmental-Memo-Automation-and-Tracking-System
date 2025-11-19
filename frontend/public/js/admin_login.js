// Prevent login script from running on non-login pages
if (typeof window !== 'undefined' && typeof window.showMessageModal !== 'function') {
  window.showMessageModal = function(){ /* no-op outside login */ };
}

// ESLint: SweetAlert2 is loaded via CDN in the page head
/* global Swal */

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById('loginCard')) { return; }
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

    // Handle password input (guard against null)
    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            if (this.value.length >= 6) { // Minimum 6 characters
                if (recaptchaContainer) {
                    recaptchaContainer.style.display = 'block';
                    // Ensure reCAPTCHA container is above SweetAlert backdrop if modal is open
                    recaptchaContainer.style.zIndex = '10001';
                    recaptchaContainer.style.position = 'relative';
                }
                // Reset reCAPTCHA if it was previously solved (guarded)
                if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                    window.grecaptcha.reset();
                }
            } else {
                if (recaptchaContainer) {recaptchaContainer.style.display = 'none';}
                if (loginButton) {loginButton.disabled = true;}
            }
        });
    }

    // Handle email input (guard against null)
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            validateForm();
        });
    }

    // Validate form function
    function validateForm() {
        if (!emailInput || !passwordInput) {return;}
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const isValidEmail = email && email.includes('@');
        const isValidPassword = password && password.length >= 6;

        if (isValidEmail && isValidPassword) {
            if (recaptchaContainer) {
                recaptchaContainer.style.display = 'block';
                // Ensure reCAPTCHA container is above SweetAlert backdrop if modal is open
                recaptchaContainer.style.zIndex = '10001';
            }
        } else {
            if (recaptchaContainer) {recaptchaContainer.style.display = 'none';}
            if (loginButton) {loginButton.disabled = true;}
        }
    }

    // Delay before animation starts (only if elements exist)
    if (layers.length > 0 && loginCard && container) {
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
    }

    // Modal functionality
    // Open Google modal when Google login button is clicked (guard against null)
    if (googleLoginBtn && googleModal) {
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
    }

    // Close modal functions
    const closeGoogleModalFunc = () => {
        if (googleModal) {
            googleModal.style.display = 'none';
        }
        document.body.style.overflow = 'auto'; // Restore scrolling
    };

    // Close Google modal when X is clicked (guard against null)
    if (closeModal) {
        closeModal.addEventListener('click', closeGoogleModalFunc);
    }

    // Close Google modal when Cancel is clicked (guard against null)
    if (cancelGoogle) {
        cancelGoogle.addEventListener('click', closeGoogleModalFunc);
    }

    // Close modal when clicking outside (guard against null)
    if (googleModal) {
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
    }

    // Google Sign-In is now handled by the Google Sign-In API
    // No need for manual redirect - the API handles everything within the modal
});

// Enable submit button when reCAPTCHA is completed (exposed for grecaptcha callback)
window.enableSubmit = function enableSubmit(/* token */) {
    const btn = document.querySelector(".login-btn");
    if (btn) { btn.disabled = false; }
};

// Helper function to ensure reCAPTCHA is visible (accessible from form submit handler)
function ensureRecaptchaVisibleGlobal() {
    const passwordInput = document.getElementById('passwordInput');
    const recaptchaContainer = document.getElementById("recaptchaContainer");
    if (passwordInput && passwordInput.value.length >= 6 && recaptchaContainer) {
        recaptchaContainer.style.display = 'block';
        recaptchaContainer.style.zIndex = '10001';
        recaptchaContainer.style.position = 'relative';
    }
}

// Progress bar functions for admin login
function createAdminProgressBar() {
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
            if (progress > 90) {
                progress = 90;
            }
            progressFill.style.width = progress + '%';
        }
    }, 200);

    // Store interval ID for cleanup
    progressBar.dataset.intervalId = interval;
}

function completeAdminProgressBar() {
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
                        if (intervalId) {
                            clearInterval(intervalId);
                        }
                        progressBar.remove();
                    }
                }, 300);
            }
        }, 500);
    }
}

function removeAdminProgressBar() {
    const progressBar = document.getElementById('loginProgressBar');
    if (progressBar) {
        const intervalId = progressBar.dataset.intervalId;
        if (intervalId) {
            clearInterval(intervalId);
        }
        progressBar.style.opacity = '0';
        progressBar.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            progressBar.remove();
        }, 300);
    }
}

// Add form submission handling (only if form exists)
const loginForm = document.querySelector('form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailField = document.querySelector('input[type="email"]');
    const passwordField = document.getElementById('passwordInput');
    const email = emailField ? emailField.value.trim() : '';
    const password = passwordField ? passwordField.value : '';
    const loginButton = document.querySelector(".login-btn");
    const recaptchaContainer = document.getElementById("recaptchaContainer");

    // Basic validation
    if (!email || !password) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Information',
                text: 'Please fill in all fields',
                confirmButtonColor: '#ef4444',
                didClose: () => {
                    // Ensure reCAPTCHA visibility is maintained after modal closes
                    setTimeout(() => {
                        ensureRecaptchaVisibleGlobal();
                    }, 100);
                }
            });
        }
        return;
    }

    if (password.length < 6) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Password',
                text: 'Password must be at least 6 characters long',
                confirmButtonColor: '#ef4444',
                didClose: () => {
                    // Ensure reCAPTCHA visibility is maintained after modal closes
                    setTimeout(() => {
                        ensureRecaptchaVisibleGlobal();
                    }, 100);
                }
            });
        }
        return;
    }

    // Check reCAPTCHA if it's visible
    const shouldCheckRecaptcha = recaptchaContainer && recaptchaContainer.style.display !== 'none';
    let recaptchaToken = '';
    if (shouldCheckRecaptcha) {
        if (typeof window.grecaptcha === 'undefined' || !window.grecaptcha || typeof window.grecaptcha.getResponse !== 'function') {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'reCAPTCHA Error',
                    text: 'reCAPTCHA not available. Please try again later.',
                    confirmButtonColor: '#ef4444'
                }).then(() => {
                    // Ensure reCAPTCHA container is visible after modal closes
                    setTimeout(() => {
                        ensureRecaptchaVisibleGlobal();
                    }, 100);
                });
            }
            return;
        }

        recaptchaToken = window.grecaptcha.getResponse();
        if (!recaptchaToken) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'reCAPTCHA Required',
                    text: 'Please complete the reCAPTCHA',
                    confirmButtonColor: '#ef4444'
                }).then(() => {
                    // Ensure reCAPTCHA container is visible after modal closes
                    setTimeout(() => {
                        ensureRecaptchaVisibleGlobal();
                    }, 100);
                });
            }
            return;
        }
    } else {
        // Attempt to grab token from default widget if present (even when container hidden)
        const recaptchaField = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (recaptchaField && recaptchaField.value) {
            recaptchaToken = recaptchaField.value;
        } else if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
            recaptchaToken = window.grecaptcha.getResponse() || '';
        }
    }

    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    // Show progress bar
    createAdminProgressBar();

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email,
                password: password,
                recaptchaToken: recaptchaToken
            })
        });

        const data = await response.json();

        if (data.success) {
            // Complete progress bar
            completeAdminProgressBar();

            // Show SweetAlert2 success modal
            // Wait for SweetAlert2 to be available
            const showSuccessModal = () => {
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
                            window.location.href = '/admin-dashboard';
                        }
                    }).then(() => {
                        window.location.href = '/admin-dashboard';
                    });
                } else {
                    // Fallback if SweetAlert2 is not available
                    setTimeout(() => {
                        window.location.href = '/admin-dashboard';
                    }, 2000);
                }
            };

            // Wait for SweetAlert2 to load if not immediately available
            if (typeof Swal !== 'undefined') {
                showSuccessModal();
            } else {
                // Wait up to 2 seconds for SweetAlert2 to load
                let attempts = 0;
                const checkSwal = setInterval(() => {
                    attempts++;
                    if (typeof Swal !== 'undefined') {
                        clearInterval(checkSwal);
                        showSuccessModal();
                    } else if (attempts >= 20) {
                        // After 2 seconds, give up and redirect
                        clearInterval(checkSwal);
                        window.location.href = '/admin-dashboard';
                    }
                }, 100);
            }
        } else {
            // Remove progress bar on error
            removeAdminProgressBar();

            // Handle different types of errors
            if (data.errorCode === 'ACCOUNT_NOT_FOUND') {
                // Account not found - user hasn't been invited/added by admin
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Account Not Found',
                        text: data.message || 'This account has not been added by an administrator. Please contact your administrator to create your account.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            } else if (data.errorCode === 'ACCOUNT_INACTIVE') {
                // Account exists but is inactive
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Account Deactivated',
                        text: data.message || 'Your account has been deactivated. Please contact your administrator.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            } else {
                // Other errors (wrong password, invalid credentials, etc.)
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Login Failed',
                        text: data.message || 'Invalid email or password. Please try again.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            }
            loginButton.disabled = false;
            loginButton.textContent = 'Login';

            // Reset reCAPTCHA (guarded)
            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                window.grecaptcha.reset();
            }
        }
    } catch (error) {
        // Remove progress bar on error
        removeAdminProgressBar();
        void error; // referenced to satisfy linters; actual info shown to user below
        // Network error: show friendly message (console logging intentionally omitted to satisfy lint rules)
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Network Error',
                text: 'Network error. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    }
    });
}

// Make showMessage globally available for other scripts
window.showAdminMessage = showMessageModal;

function showMessageModal(title, message, type) {
    const inlineError = document.getElementById('loginInlineError');
    if (inlineError) {
        const normalizedType = type || 'error';
        const colors = {
            success: '#15803d',
            warning: '#f97316',
            error: '#ef4444'
        };
        inlineError.textContent = message || title || 'Something went wrong. Please try again.';
        inlineError.style.display = 'block';
        inlineError.style.color = colors[normalizedType] || '#ef4444';
        inlineError.style.backgroundColor = normalizedType === 'success'
            ? 'rgba(34,197,94,0.12)'
            : 'rgba(239,68,68,0.1)';
        inlineError.style.border = `1px solid ${colors[normalizedType] || '#ef4444'}`;
        inlineError.style.borderRadius = '6px';
        inlineError.style.padding = '8px 12px';
        inlineError.style.fontWeight = '600';
        inlineError.style.marginTop = '8px';
        inlineError.style.lineHeight = '1.5';
        inlineError.setAttribute('role', 'alert');
        inlineError.setAttribute('aria-live', 'assertive');

        const passwordField = document.getElementById('passwordInput');
        if (passwordField && normalizedType !== 'success') {
            passwordField.setAttribute('aria-invalid', 'true');
            passwordField.style.border = `2px solid ${colors[normalizedType] || '#ef4444'}`;
            passwordField.style.outline = 'none';
        }

        try {
            inlineError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) { /* ignore */ }

        // Remove any existing modal fallback inserted by previous calls
        document.querySelectorAll('.message-modal').forEach((existingModal) => existingModal.remove());
        return;
    }

    // Fallback: if inline container missing, use modal
    const modal = document.createElement('div');
    modal.className = `message-modal ${type}`;
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <p>${message}</p>
            <button id="closeMsgModal">OK</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeMsgModal').addEventListener('click', () => modal.remove());
}
