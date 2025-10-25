// Fallback function for immediate availability
function showForgotPasswordModalFallback() {
    console.log('Fallback function called');
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('Modal shown via fallback');
    } else {
        console.error('Modal not found in fallback');
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
                const response = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (data.success) {
                    showMessage(data.message, 'success');
                    setTimeout(() => {
                        showResetCodeModal();
                    }, 1500);
                } else {
                    showMessage(data.message, 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        });
    }

    // Reset Code Form
    if (resetCodeForm) {
        resetCodeForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const resetCode = formData.get('resetCode');

            try {
                const response = await fetch('/reset-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ resetCode })
                });

                const data = await response.json();

                if (data.success) {
                    showMessage(data.message, 'success');
                    setTimeout(() => {
                        showResetPasswordModal();
                    }, 1500);
                } else {
                    showMessage(data.message, 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
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
                const response = await fetch('/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ newPassword, confirmPassword })
                });

                const data = await response.json();

                if (data.success) {
                    showMessage(data.message, 'success');
                    setTimeout(() => {
                        closeAllModals();
                        // Optionally redirect to login or show success message
                        showMessage('Password reset successfully! You can now login with your new password.', 'success');
                    }, 1500);
                } else {
                    showMessage(data.message, 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
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
