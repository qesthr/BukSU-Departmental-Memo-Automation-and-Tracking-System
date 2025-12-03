// Logout Confirmation Modal
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutModal');
    const logoutCancelBtn = document.getElementById('logoutCancelBtn');
    const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');

    if (!logoutBtn || !logoutModal) {
        return;
    }

    // Open modal when logout button is clicked
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(logoutModal);
    });

    // Close modal handlers
    const closeButtons = document.querySelectorAll('#logoutModal .close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(logoutModal);
        });
    });

    // Cancel button
    if (logoutCancelBtn) {
        logoutCancelBtn.addEventListener('click', () => {
            closeModal(logoutModal);
        });
    }

    // Confirm button
    if (logoutConfirmBtn) {
        logoutConfirmBtn.addEventListener('click', () => {
            // Redirect to logout
            window.location.href = '/auth/logout';
        });
    }

    // Close modal when clicking outside
    logoutModal.addEventListener('click', (e) => {
        if (e.target === logoutModal) {
            closeModal(logoutModal);
        }
    });

    function openModal(modal) {
        // Create overlay/backdrop
        let overlay = document.getElementById('globalModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'globalModalOverlay';
            overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9999998; transition: opacity .18s ease; opacity: 0;`;
            document.body.appendChild(overlay);
            // Force reflow so transition works
            window.getComputedStyle(overlay).opacity;
            overlay.style.opacity = '1';
            if (!overlay._hasCloseListener) {
                overlay.addEventListener('click', () => { closeModal(modal); });
                overlay._hasCloseListener = true;
            }
        } else {
            overlay.style.display = 'block';
            overlay.style.opacity = '1';
            if (!overlay._hasCloseListener) {
                overlay.addEventListener('click', () => { closeModal(modal); });
                overlay._hasCloseListener = true;
            }
        }

        // Optionally blur/dim main app content
        const appEl = document.getElementById('app') || document.querySelector('.dashboard-container') || document.body;
        if (appEl && !appEl.dataset._originalStyleSaved) {
            appEl.dataset._originalStyleSaved = 'true';
            appEl.dataset._origFilter = appEl.style.filter || '';
            appEl.dataset._origPointer = appEl.style.pointerEvents || '';
            appEl.dataset._origUserSel = appEl.style.userSelect || '';
        }
        if (appEl) {
            appEl.style.filter = 'blur(3px) brightness(.9)';
            appEl.style.pointerEvents = 'none';
            appEl.style.userSelect = 'none';
        }

        // Prevent body from scrolling
        document.body.style.overflow = 'hidden';

        // Remember original position to restore later
        if (!modal._originalParent) {
            modal._originalParent = modal.parentNode;
            modal._originalNextSibling = modal.nextSibling;
        }

        // Make sure modal is appended to body so it's not clipped by parent stacking contexts
        if (modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }

        // Ensure correct styling as a centered modal on body
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000000';
        modal.style.padding = '1rem';
    }

    function closeModal(modal) {
        const overlay = document.getElementById('globalModalOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                try { overlay.remove(); } catch { /* ignore */ }
            }, 200);
        }

        const appEl = document.getElementById('app') || document.querySelector('.dashboard-container') || document.body;
        if (appEl && appEl.dataset._originalStyleSaved) {
            appEl.style.filter = appEl.dataset._origFilter || '';
            appEl.style.pointerEvents = appEl.dataset._origPointer || '';
            appEl.style.userSelect = appEl.dataset._origUserSel || '';
            delete appEl.dataset._originalStyleSaved;
            delete appEl.dataset._origFilter;
            delete appEl.dataset._origPointer;
            delete appEl.dataset._origUserSel;
        }

        // Restore body scrolling
        document.body.style.overflow = '';

        // Hide modal and try to put it back where it was
        modal.style.display = 'none';
        modal.style.position = '';
        modal.style.inset = '';
        modal.style.alignItems = '';
        modal.style.justifyContent = '';
        modal.style.zIndex = '';
        modal.style.padding = '';

        if (modal._originalParent) {
            try {
                if (modal._originalNextSibling) {
                    modal._originalParent.insertBefore(modal, modal._originalNextSibling);
                } else {
                    modal._originalParent.appendChild(modal);
                }
                delete modal._originalParent;
                delete modal._originalNextSibling;
            } catch { /* ignore if element no longer exists */ }
        }
    }
});

