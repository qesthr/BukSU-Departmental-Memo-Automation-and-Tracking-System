// Reset Password Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Reset password page loaded');

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const submitButton = resetPasswordForm.querySelector('button[type="submit"]');
    const newPasswordInput = resetPasswordForm.querySelector('input[name="newPassword"]');
    const confirmPasswordInput = resetPasswordForm.querySelector('input[name="confirmPassword"]');

    // Password strength indicator
    newPasswordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = getPasswordStrength(password);
        updatePasswordStrengthIndicator(strength);
    });

    // Handle form submission
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!newPassword) {
            showMessage('Please enter a new password', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showMessage('Password must be at least 6 characters long', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Resetting...';

        try {
            const response = await fetch('/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    newPassword,
                    confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage(data.message, 'success');
                // Redirect to login page after 2 seconds
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 2000);
            } else {
                showMessage(data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = 'Reset Password';
        }
    });

    // Password strength calculation
    function getPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 6) {strength++;}
        if (password.length >= 8) {strength++;}
        if (/[A-Z]/.test(password)) {strength++;}
        if (/[a-z]/.test(password)) {strength++;}
        if (/[0-9]/.test(password)) {strength++;}
        if (/[^A-Za-z0-9]/.test(password)) {strength++;}
        return strength;
    }

    // Update password strength indicator
    function updatePasswordStrengthIndicator(strength) {
        // Remove existing indicator
        const existingIndicator = document.querySelector('.password-strength');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (strength === 0) {return;}

        const indicator = document.createElement('div');
        indicator.className = 'password-strength';

        let strengthText = '';
        let strengthColor = '';

        if (strength <= 2) {
            strengthText = 'Weak';
            strengthColor = '#dc3545';
        } else if (strength <= 4) {
            strengthText = 'Medium';
            strengthColor = '#ffc107';
        } else {
            strengthText = 'Strong';
            strengthColor = '#28a745';
        }

        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <div style="flex: 1; height: 4px; background: #e9ecef; border-radius: 2px;">
                    <div style="width: ${(strength / 6) * 100}%; height: 100%; background: ${strengthColor}; border-radius: 2px; transition: all 0.3s ease;"></div>
                </div>
                <span style="font-size: 12px; color: ${strengthColor}; font-weight: 500;">${strengthText}</span>
            </div>
        `;

        newPasswordInput.parentNode.appendChild(indicator);
    }

    // Show message function
    function showMessage(message, type) {
        // Remove existing message
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        // Style the message
        messageDiv.style.cssText = `
            padding: 12px 16px;
            margin: 15px 0;
            border-radius: 8px;
            font-size: 14px;
            text-align: center;
            ${type === 'success' ?
                'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' :
                'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
            }
        `;

        // Insert message after the form
        resetPasswordForm.parentNode.insertBefore(messageDiv, resetPasswordForm.nextSibling);

        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
});
