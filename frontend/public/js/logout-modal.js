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
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }
});

