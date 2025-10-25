// Forgot Password Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Forgot password page loaded');

    const forgotForm = document.getElementById('forgotForm');
    const submitButton = forgotForm.querySelector('button[type="submit"]');
    const emailInput = forgotForm.querySelector('input[name="email"]');

    // Handle form submission
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();

        if (!email) {
            showMessageModal('Missing Email', 'Please enter your email address', 'warning');
            return;
        }

        // Validate email format
        const emailRegex = /^[\w-]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
            showMessageModal('Invalid Email', 'Please enter a valid email address', 'warning');
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

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
                if (data.emailSent) {
                    showMessageModal('Email Sent', data.message, 'success');
                } else {
                    showMessageModal('Email Service Unavailable', `${data.message} (Code: ${data.resetCode})`, 'warning');
                }
                // Redirect to reset code page after 2 seconds
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 2000);
            } else {
                showMessageModal('Request Failed', data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessageModal('Network Error', 'Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = 'Send Reset Link';
        }
    });
});
