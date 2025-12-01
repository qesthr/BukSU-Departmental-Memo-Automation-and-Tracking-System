// ESLint: SweetAlert2 is loaded via CDN in the page head
/* global Swal */

// Forgot Password Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Forgot password page loaded');

    const forgotForm = document.getElementById('forgotForm');
    const submitButton = forgotForm.querySelector('button[type="submit"]');
    const emailInput = forgotForm.querySelector('input[name="email"]');
    let redirecting = false;

    // Simple full-screen loading overlay
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
        text.textContent = 'Sending reset code…';
        text.style.cssText = [
            'font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            'font-size: 15px',
            'color: #0f172a',
            'text-align: center'
        ].join(';');

        // Keyframes (once)
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
        if (overlay) {overlay.style.display = 'none';}
    }

    // Handle form submission
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();

        if (!email) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Email',
                    text: 'Please enter your email address',
                    confirmButtonColor: '#ef4444'
                });
            }
            return;
        }

        // Validate email format
        const emailRegex = /^[\w-]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Email',
                    text: 'Please enter a valid email address',
                    confirmButtonColor: '#ef4444'
                });
            }
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Sending…';
        showLoadingOverlay('Sending reset code…');

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
                redirecting = true;
                // Update overlay text instead of toast so user sees progress
                if (data.emailSent) {
                    showLoadingOverlay('Email sent. Redirecting…');
                } else {
                    // If email unavailable, still proceed but inform user in overlay
                    showLoadingOverlay('Code generated. Redirecting…');
                }
                // Short delay for UX, then go
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 800);
            } else {
                hideLoadingOverlay();
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
            submitButton.textContent = 'Send Code';
            if (!redirecting) {
                hideLoadingOverlay();
            }
            // reset flag for subsequent attempts
            redirecting = false;
        }
    });
});
