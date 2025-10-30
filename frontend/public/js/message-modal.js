// Generic Message Modal JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Message modal script loaded');

    const messageModal = document.getElementById('messageModal');
    const closeMessageModal = document.getElementById('closeMessageModal');
    const messageModalTitle = document.getElementById('messageModalTitle');
    const messageIcon = document.getElementById('messageIcon');
    const messageText = document.getElementById('messageText');

    // Close modal functions
    function closeMessageModal() {
        messageModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Show message modal
    function showMessageModal(title, message, type) {
        console.log('Showing message modal:', title, message, type);

        // Set title
        messageModalTitle.textContent = title;

        // Set message
        messageText.textContent = message;

        // Set icon based on type
        let iconSvg = '';
        switch (type) {
            case 'success':
                iconSvg = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#4caf50"/>
                        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                break;
            case 'warning':
                iconSvg = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#ff9800"/>
                        <path d="M12 8v4M12 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                break;
            case 'error':
                iconSvg = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#f44336"/>
                        <path d="M15 9l-6 6M9 9l6 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                break;
            default:
                iconSvg = `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#2196f3"/>
                        <path d="M12 16v-4M12 8h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
        }
        messageIcon.innerHTML = iconSvg;

        // Show modal
        messageModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Close button event listener
    if (closeMessageModal) {
        closeMessageModal.addEventListener('click', closeMessageModal);
    }

    // Close modal when clicking outside
    messageModal.addEventListener('click', function(e) {
        if (e.target === messageModal) {
            closeMessageModal();
        }
    });

    // Make functions globally available
    window.showMessageModal = function(title, message, type) {
        var modal = document.getElementById('messageModal');
        var modalTitle = document.getElementById('messageModalTitle');
        var modalBody = document.getElementById('messageText');
        var iconDiv = document.getElementById('messageIcon');
        modalTitle.textContent = title || 'Message';
        modalBody.textContent = message || '';
        // Info error styling
        modal.classList.remove('modal-error', 'modal-success', 'modal-info');
        if (type === 'error') {
            modal.classList.add('modal-info');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#2196f3"/><text x="50%" y="56%" text-anchor="middle" fill="#fff" font-size="28" font-family="Arial" dy=".3em">!</text></svg>';
        } else if (type === 'success') {
            modal.classList.add('modal-success');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#4caf50"/><path d="M30 17L20 27L14 21" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        } else {
            iconDiv.innerHTML = '';
        }
        modal.style.display = 'block';
    };
    window.closeMessageModal = closeMessageModal;
});
