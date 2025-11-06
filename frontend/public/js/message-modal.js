// Generic Message Modal JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Message modal script loaded');

    const messageModal = document.getElementById('messageModal');
    const closeMessageModalBtn = document.getElementById('closeMessageModal');
    const messageModalTitle = document.getElementById('messageModalTitle');
    const messageIcon = document.getElementById('messageIcon');
    const messageText = document.getElementById('messageText');

    // Close modal function
    function closeMessageModal() {
        if (messageModal) {
            messageModal.style.display = 'none';
        }
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
    // Note: The internal function above is not used, window.showMessageModal is used instead

    // Close button event listener
    if (closeMessageModalBtn) {
        closeMessageModalBtn.addEventListener('click', closeMessageModal);
    }

    // Close modal when clicking outside
    if (messageModal) {
        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) {
                closeMessageModal();
            }
        });
    }

    // Make functions globally available
    window.showMessageModal = function(title, message, type) {
        console.log('showMessageModal called with:', { title, message, type });

        const modal = document.getElementById('messageModal');
        const modalTitle = document.getElementById('messageModalTitle');
        const modalBody = document.getElementById('messageText');
        const iconDiv = document.getElementById('messageIcon');

        // Check if elements exist
        if (!modal || !modalTitle || !modalBody || !iconDiv) {
            console.error('Message modal elements not found. Modal:', !!modal, 'Title:', !!modalTitle, 'Body:', !!modalBody, 'Icon:', !!iconDiv);
            // Fallback to alert if modal elements don't exist
            alert(title + ': ' + message);
            return;
        }

        // Set title and message explicitly - ensure visibility
        if (modalTitle) {
            modalTitle.textContent = title || 'Message';
            modalTitle.innerHTML = title || 'Message'; // Fallback to innerHTML
            modalTitle.style.display = 'block';
            modalTitle.style.color = '#fff';
            modalTitle.style.visibility = 'visible';
            modalTitle.style.opacity = '1';
            console.log('Title set to:', modalTitle.textContent || modalTitle.innerHTML);
        }

        if (modalBody) {
            const messageText = message || '';

            // Clear any existing content first
            modalBody.innerHTML = '';
            modalBody.textContent = '';

            // Set the message text
            modalBody.textContent = messageText;
            modalBody.innerHTML = messageText;

            // Ensure visibility with explicit styles
            modalBody.style.display = 'block';
            modalBody.style.visibility = 'visible';
            modalBody.style.opacity = '1';
            modalBody.style.color = '#fff';
            modalBody.style.marginTop = '10px';
            modalBody.style.marginBottom = '10px';
            modalBody.style.textAlign = 'center';
            modalBody.style.fontSize = '1.13rem';
            modalBody.style.fontWeight = '500';
            modalBody.style.lineHeight = '1.5';
            modalBody.style.padding = '10px 20px';
            modalBody.style.minHeight = 'auto';

            // Force repaint
            modalBody.offsetHeight;

            console.log('Message set to:', modalBody.textContent || modalBody.innerHTML);
            console.log('Message element:', modalBody);
            console.log('Message element computed style:', window.getComputedStyle(modalBody).display);
            console.log('Message element color:', window.getComputedStyle(modalBody).color);
        }

        // Remove all type classes first
        modal.classList.remove('modal-error', 'modal-success', 'modal-info');

        // Set icon and styling based on type
        if (type === 'error') {
            modal.classList.add('modal-info');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#2196f3"/><text x="50%" y="56%" text-anchor="middle" fill="#fff" font-size="28" font-family="Arial" dy=".3em">!</text></svg>';
        } else if (type === 'success') {
            modal.classList.add('modal-success');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#4caf50"/><path d="M30 17L20 27L14 21" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        } else if (type === 'warning') {
            modal.classList.add('modal-info');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#ff9800"/><text x="50%" y="56%" text-anchor="middle" fill="#fff" font-size="28" font-family="Arial" dy=".3em">!</text></svg>';
        } else {
            iconDiv.innerHTML = '';
        }

        // Show modal - use flex for proper centering
        modal.style.display = 'flex';
        // Ensure backdrop is transparent so login page is visible
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        modal.style.backdropFilter = 'blur(2px)';
        document.body.style.overflow = 'hidden';

        console.log('Modal displayed:', title, message, type);
        console.log('Modal element:', modal);
        console.log('Title element:', modalTitle, 'Text:', modalTitle.textContent);
        console.log('Message element:', modalBody, 'Text:', modalBody.textContent);
    };
    window.closeMessageModal = closeMessageModal;
});
