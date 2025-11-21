// ESLint: SweetAlert2 is loaded via CDN in the page head
/* global Swal */

// Forgot Password Form Handling
document.addEventListener('DOMContentLoaded', () => {
    // Forgot Password Form
    const forgotForm = document.getElementById('forgotForm');
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
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message || 'Reset code sent successfully',
                            confirmButtonColor: '#10b981',
                            timer: 1500,
                            timerProgressBar: true
                        }).then(() => {
                            window.location.href = data.redirect;
                        });
                    } else {
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1500);
                    }
                } else {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            title: 'Request Failed',
                            text: data.message || 'Failed to send reset code',
                            confirmButtonColor: '#ef4444'
                        });
                    }
                }
            } catch (error) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Network Error',
                        text: 'Network error. Please try again.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            }
        });
    }

    // Reset Code Form
    const resetCodeForm = document.getElementById('resetCodeForm');
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
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message || 'Code verified successfully',
                            confirmButtonColor: '#10b981',
                            timer: 1500,
                            timerProgressBar: true
                        }).then(() => {
                            window.location.href = data.redirect;
                        });
                    } else {
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1500);
                    }
                } else {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            title: 'Verification Failed',
                            text: data.message || 'Invalid or expired reset code',
                            confirmButtonColor: '#ef4444'
                        });
                    }
                }
            } catch (error) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Network Error',
                        text: 'Network error. Please try again.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            }
        });
    }

    // Reset Password Form
    const resetPasswordForm = document.getElementById('resetPasswordForm');
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
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Password Reset Successful!',
                            text: data.message || 'Your password has been reset successfully',
                            confirmButtonColor: '#10b981',
                            timer: 2000,
                            timerProgressBar: true
                        }).then(() => {
                            window.location.href = data.redirect;
                        });
                    } else {
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1500);
                    }
                } else {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            title: 'Reset Failed',
                            text: data.message || 'Could not reset password',
                            confirmButtonColor: '#ef4444'
                        });
                    }
                }
            } catch (error) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Network Error',
                        text: 'Network error. Please try again.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            }
        });
    }
});

// Show message function - replaced with SweetAlert2
function showMessage(message, type) {
    if (typeof Swal !== 'undefined') {
        const icon = type === 'success' ? 'success' : 'error';
        Swal.fire({
            icon: icon,
            title: type === 'success' ? 'Success' : 'Error',
            text: message,
            confirmButtonColor: type === 'success' ? '#10b981' : '#ef4444'
        });
    }
}
