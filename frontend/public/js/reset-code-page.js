// Reset Code Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Reset code page loaded');

    const resetCodeForm = document.getElementById('resetCodeForm');
    const submitButton = resetCodeForm.querySelector('button[type="submit"]');
    const resetCodeInput = resetCodeForm.querySelector('input[name="resetCode"]');
    let redirecting = false;

    // Loading overlay (consistent with forgot-password page)
    function createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'fpLoadingOverlay';
        overlay.style.cssText = [
            'position: fixed',
            'inset: 0',
            'background: rgba(255,255,255,0.85)',
            'backdrop-filter: blur(2px)',
            'display: flex',
            'align-items: center',
            'justify-content: center',
            'z-index: 9999'
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
        text.textContent = 'Verifying code…';
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
        return overlay;
    }

    function showLoadingOverlay(message) {
        let overlay = document.getElementById('fpLoadingOverlay');
        if (!overlay) {
            overlay = createLoadingOverlay();
            document.body.appendChild(overlay);
        }
        const text = document.getElementById('fpLoadingText');
        if (text && message) { text.textContent = message; }
        overlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('fpLoadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    // Auto-format reset code input (digits only, 6 characters)
    resetCodeInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 6) {
            value = value.substring(0, 6);
        }
        e.target.value = value;
    });

    // Handle form submission
    resetCodeForm.addEventListener('submit', async function(e) {
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
        submitButton.textContent = 'Verifying…';
        showLoadingOverlay('Verifying code…');

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
                redirecting = true;
                showLoadingOverlay('Code verified. Redirecting…');
                setTimeout(() => { window.location.href = data.redirect; }, 800);
            } else {
                hideLoadingOverlay();
                showMessage(data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            hideLoadingOverlay();
            showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.textContent = 'Verify Code';
            if (!redirecting) {
                hideLoadingOverlay();
            }
            redirecting = false;
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
