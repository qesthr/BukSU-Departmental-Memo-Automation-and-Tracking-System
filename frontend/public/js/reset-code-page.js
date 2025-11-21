// ESLint: SweetAlert2 is loaded via CDN in the page head
/* global Swal */

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
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Reset Code Required',
                    text: 'Please enter the reset code',
                    confirmButtonColor: '#ef4444'
                });
            }
            return;
        }

        if (resetCode.length !== 6) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Code',
                    text: 'Reset code must be 6 digits long',
                    confirmButtonColor: '#ef4444'
                });
            }
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
            console.error('Error:', error);
            hideLoadingOverlay();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Network Error',
                    text: 'Network error. Please try again.',
                    confirmButtonColor: '#ef4444'
                });
            }
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
});
