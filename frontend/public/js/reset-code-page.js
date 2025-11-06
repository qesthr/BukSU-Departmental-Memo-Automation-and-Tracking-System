// Reset Code Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Reset code page loaded');

    const resetCodeForm = document.getElementById('resetCodeForm');
    const submitButton = resetCodeForm.querySelector('button[type="submit"]');
    const resetCodeInput = resetCodeForm.querySelector('input[name="resetCode"]');

    // Auto-format reset code input (digits only, 6 characters)
    resetCodeInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 6) {
            value = value.substring(0, 6);
        }
        e.target.value = value;
    });

    // Handle form submission
    resetCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const resetCode = resetCodeInput.value.trim();

        if (!resetCode) {
            showMessage('Please enter the reset code', 'error');
            return;
        }

        if (resetCode.length !== 6) {
            showMessage('Reset code must be 6 digits long', 'error');
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Verifying...';

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
                // Redirect to reset password page after 2 seconds
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
            submitButton.textContent = 'Verify Code';
        }
    });

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
        resetCodeForm.parentNode.insertBefore(messageDiv, resetCodeForm.nextSibling);

        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
});
