// Fallback function for immediate availability
function showForgotPasswordModalFallback() {
    console.log('Fallback function called');
    const forgot = document.getElementById('forgotPasswordModal');
    const code = document.getElementById('resetCodeModal');
    const reset = document.getElementById('resetPasswordModal');
    try { if (code) {code.style.display = 'none';} } catch (_) {}
    try { if (reset) {reset.style.display = 'none';} } catch (_) {}
    if (forgot) {
        forgot.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('Forgot modal shown via fallback (others hidden)');
    } else {
        console.error('Forgot modal not found in fallback');
    }
}

// Make fallback available immediately
window.showForgotPasswordModal = showForgotPasswordModalFallback;

// Forgot Password Modal Handling
document.addEventListener('DOMContentLoaded', () => {
    console.log('Forgot password modal script loaded');

    // Modal elements
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const resetCodeModal = document.getElementById('resetCodeModal');
    const resetPasswordModal = document.getElementById('resetPasswordModal');

    console.log('Modal elements found:', {
        forgotPasswordModal: !!forgotPasswordModal,
        resetCodeModal: !!resetCodeModal,
        resetPasswordModal: !!resetPasswordModal
    });

    // Test if modals exist
    if (!forgotPasswordModal) {
        console.error('Forgot password modal not found!');
        return;
    }
    if (!resetCodeModal) {
        console.error('Reset code modal not found!');
    }
    if (!resetPasswordModal) {
        console.error('Reset password modal not found!');
    }

    // Close buttons
    const closeForgotModal = document.getElementById('closeForgotModal');
    const closeResetCodeModal = document.getElementById('closeResetCodeModal');
    const closeResetPasswordModal = document.getElementById('closeResetPasswordModal');

    // Forms
    const forgotForm = document.getElementById('forgotForm');
    const resetCodeForm = document.getElementById('resetCodeForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    // Close modal functions
    function closeAllModals() {
        forgotPasswordModal.style.display = 'none';
        resetCodeModal.style.display = 'none';
        resetPasswordModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Inline form message helper (appears below the given form)
    function setFormMessage(formEl, message, type) {
        if (!formEl) {return;}
        let msg = formEl.parentNode.querySelector('.fp-inline-message');
        if (!msg) {
            msg = document.createElement('div');
            msg.className = 'fp-inline-message';
            msg.style.cssText = [
                'padding: 12px 16px',
                'margin: 12px 0 0 0',
                'border-radius: 8px',
                'font-size: 14px',
                'text-align: center',
                'border: 1px solid transparent'
            ].join(';');
            formEl.parentNode.appendChild(msg);
        }
        if (type === 'success') {
            msg.style.backgroundColor = '#d4edda';
            msg.style.color = '#155724';
            msg.style.borderColor = '#c3e6cb';
        } else if (type === 'warning') {
            msg.style.backgroundColor = '#fff3cd';
            msg.style.color = '#856404';
            msg.style.borderColor = '#ffeeba';
        } else {
            msg.style.backgroundColor = '#f8d7da';
            msg.style.color = '#721c24';
            msg.style.borderColor = '#f5c6cb';
        }
        msg.textContent = message || '';
    }

    // ---------- Loading Overlay (Spinner) ----------
    function createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'fpLoadingOverlay';
        overlay.style.cssText = [
            'position: fixed',
            'inset: 0',
            'background: rgba(255,255,255,0.85)',
            'backdrop-filter: blur(2px)',
            'display: none',
            'align-items: center',
            'justify-content: center',
            'z-index: 100000' // ensure above any modal/backdrop
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'align-items: center',
            'gap: 14px',
            'background: #ffffff',
            'border: 1px solid #e5e7eb',
            'box-shadow: 0 10px 30px rgba(0,0,0,.08)',
            'border-radius: 12px',
            'padding: 26px 28px',
            'min-width: 260px'
        ].join(';');

        const spinner = document.createElement('div');
        spinner.style.cssText = [
            'width: 36px',
            'height: 36px',
            'border: 3px solid #e5e7eb',
            'border-top-color: #1E92F3',
            'border-radius: 50%',
            'animation: fpSpin .9s linear infinite'
        ].join(';');

        const text = document.createElement('div');
        text.id = 'fpLoadingText';
        text.textContent = 'Please wait…';
        text.style.cssText = [
            'font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            'font-size: 15px',
            'color: #0f172a',
            'text-align: center'
        ].join(';');

        if (!document.getElementById('fpSpinKeyframes')) {
            const style = document.createElement('style');
            style.id = 'fpSpinKeyframes';
            style.textContent = '@keyframes fpSpin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }

        box.appendChild(spinner);
        box.appendChild(text);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        return overlay;
    }

    function showLoadingOverlay(message) {
        let overlay = document.getElementById('fpLoadingOverlay');
        if (!overlay) {overlay = createLoadingOverlay();}
        const text = document.getElementById('fpLoadingText');
        if (text && message) {text.textContent = message;}
        overlay.style.display = 'flex';
    }

    function updateLoadingText(message) {
        const text = document.getElementById('fpLoadingText');
        if (text && message) {text.textContent = message;}
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('fpLoadingOverlay');
        if (overlay) {overlay.style.display = 'none';}
    }

    // Show specific modal functions
    function showForgotPasswordModal() {
        console.log('showForgotPasswordModal called');
        closeAllModals();
        if (forgotPasswordModal) {
            forgotPasswordModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            console.log('Forgot password modal should be visible now');
        } else {
            console.error('forgotPasswordModal element not found');
        }
    }

    function showResetCodeModal() {
        closeAllModals();
        resetCodeModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function showResetPasswordModal() {
        closeAllModals();
        resetPasswordModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Make functions global (override fallback)
    window.showForgotPasswordModal = showForgotPasswordModal;
    window.showResetCodeModal = showResetCodeModal;
    window.showResetPasswordModal = showResetPasswordModal;
    window.closeForgotPasswordModal = closeAllModals;

    console.log('Global functions set:', {
        showForgotPasswordModal: typeof window.showForgotPasswordModal,
        showResetCodeModal: typeof window.showResetCodeModal,
        showResetPasswordModal: typeof window.showResetPasswordModal,
        closeForgotPasswordModal: typeof window.closeForgotPasswordModal
    });

    // Add event listener as backup for forgot password link
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Forgot password link clicked via event listener');
            showForgotPasswordModal();
        });
        console.log('Event listener added to forgot password link');
    } else {
        console.error('Forgot password link not found for event listener');
    }

    // Back link handlers to switch modals reliably
    const backToEmailLink = document.getElementById('backToEmailLink');
    if (backToEmailLink) {
        backToEmailLink.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPasswordModal();
        });
    }

    const backToCodeLink = document.getElementById('backToCodeLink');
    if (backToCodeLink) {
        backToCodeLink.addEventListener('click', (e) => {
            e.preventDefault();
            showResetCodeModal();
        });
    }

    // Close button event listeners
    closeForgotModal.addEventListener('click', closeAllModals);
    closeResetCodeModal.addEventListener('click', closeAllModals);
    closeResetPasswordModal.addEventListener('click', closeAllModals);

    // Close modal when clicking outside
    forgotPasswordModal.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            closeAllModals();
        }
    });

    resetCodeModal.addEventListener('click', (e) => {
        if (e.target === resetCodeModal) {
            closeAllModals();
        }
    });

    resetPasswordModal.addEventListener('click', (e) => {
        if (e.target === resetPasswordModal) {
            closeAllModals();
        }
    });

    // Forgot Password Form
    if (forgotForm) {
        forgotForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const email = formData.get('email');

            try {
                showLoadingOverlay('Sending reset code…');
                const response = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (data.success) {
                    // Switch to code modal and show success loading cue
                    try { showResetCodeModal(); } catch (_) {}
                    updateLoadingText('Email sent. Opening code entry…');
                    setTimeout(hideLoadingOverlay, 700);
                } else {
                    hideLoadingOverlay();
                    setFormMessage(forgotForm, data.message || 'Could not send reset code.', 'error');
                }
            } catch (error) {
                hideLoadingOverlay();
                setFormMessage(forgotForm, 'Network error. Please try again.', 'error');
            }
        });
    }

    // Reset Code Form
    if (resetCodeForm) {
        resetCodeForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            let resetCode = formData.get('resetCode') || '';
            // Sanitize: digits only and 6 chars
            resetCode = String(resetCode).replace(/[^0-9]/g, '').slice(0, 6);
            if (!resetCode || resetCode.length !== 6) {
                setFormMessage(resetCodeForm, 'Please enter the 6-digit reset code.', 'warning');
                return;
            }

            try {
                showLoadingOverlay('Verifying code…');
                const response = await fetch('/reset-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ resetCode })
                });

                const data = await response.json();

                if (data.success) {
                    try { showResetPasswordModal(); } catch (_) {}
                    updateLoadingText('Code verified. Opening password reset…');
                    setTimeout(hideLoadingOverlay, 700);
                } else {
                    hideLoadingOverlay();
                    setFormMessage(resetCodeForm, data.message || 'Invalid or expired reset code.', 'error');
                }
            } catch (error) {
                hideLoadingOverlay();
                setFormMessage(resetCodeForm, 'Network error. Please try again.', 'error');
            }
        });
    }

    // Reset Password Form
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const newPassword = formData.get('newPassword');
            const confirmPassword = formData.get('confirmPassword');

            try {
                showLoadingOverlay('Resetting password…');
                const response = await fetch('/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ newPassword, confirmPassword })
                });

                const data = await response.json();

                if (data.success) {
                    updateLoadingText('Password reset. Returning to login…');
                    // Close modals so user can log in, then hide overlay shortly after
                    try { closeAllModals(); } catch (_) {}
                    setTimeout(() => {
                        hideLoadingOverlay();
                        // Auto refresh/redirect to login or provided redirect
                        try {
                            window.location.replace(data.redirect || '/');
                        } catch (_) {
                            window.location.href = data.redirect || '/';
                        }
                    }, 700);
                } else {
                    hideLoadingOverlay();
                    setFormMessage(resetPasswordForm, data.message || 'Could not reset password.', 'error');
                }
            } catch (error) {
                hideLoadingOverlay();
                setFormMessage(resetPasswordForm, 'Network error. Please try again.', 'error');
            }
        });
    }
});

// Show message function
function showMessage(message, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        max-width: 300px;
        word-wrap: break-word;
        ${type === 'success' ? 'background-color: #4CAF50;' : 'background-color: #f44336;'}
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}
