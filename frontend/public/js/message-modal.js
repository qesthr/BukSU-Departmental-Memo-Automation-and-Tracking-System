// Generic Message Modal JavaScript
document.addEventListener('DOMContentLoaded', function() {
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
        messageModal.addEventListener('click', function(e) {
            if (e.target === messageModal) {
                closeMessageModal();
            }
        });
    }

    // Make functions globally available
    window.showMessageModal = function(title, message, type) {
        console.log('showMessageModal called with:', { title, message, type });

        var modal = document.getElementById('messageModal');
        var modalTitle = document.getElementById('messageModalTitle');
        var modalBody = document.getElementById('messageText');
        var iconDiv = document.getElementById('messageIcon');
        var closeBtn = document.getElementById('closeMessageModal');

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
            // Ensure it renders above any overlapping elements (e.g., icons)
            modalBody.style.position = 'relative';
            modalBody.style.zIndex = '2';
            modalBody.style.whiteSpace = 'pre-line';

            // Force repaint
            modalBody.offsetHeight;

            console.log('Message set to:', modalBody.textContent || modalBody.innerHTML);
            console.log('Message element:', modalBody);
            console.log('Message element computed style:', window.getComputedStyle(modalBody).display);
            console.log('Message element color:', window.getComputedStyle(modalBody).color);
        }

        // Remove all type classes first
        modal.classList.remove('modal-error', 'modal-success', 'modal-info');

        // Inline background/text color control to avoid page-specific CSS conflicts
        var content = modal.querySelector('.modal-content');
        if (content) {
            content.style.boxShadow = '0 8px 32px 0 rgba(0,0,0,0.15)';
            content.style.color = ''; // will be set below
            content.style.background = ''; // will be set below
        }

        // Set icon and styling based on type
        if (type === 'loading') {
            // Loading spinner icon
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="20" stroke="#fff" stroke-width="6" fill="none" opacity="0.25"/><circle cx="25" cy="25" r="20" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="90" stroke-dashoffset="60"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite"/></circle></svg>';
            if (content) { content.style.background = '#2196f3'; }
            if (modalTitle) { modalTitle.style.color = '#fff'; }
            if (modalBody) { modalBody.style.background = '#2196f3'; modalBody.style.color = '#eaf2ff'; }
            if (closeBtn) { closeBtn.style.visibility = 'hidden'; }
        } else if (type === 'error') {
            modal.classList.add('modal-info');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#2196f3"/><text x="50%" y="56%" text-anchor="middle" fill="#fff" font-size="28" font-family="Arial" dy=".3em">!</text></svg>';
            if (content) { content.style.background = '#2196f3'; }
            if (modalTitle) { modalTitle.style.color = '#fff'; }
            if (modalBody) { modalBody.style.background = '#2196f3'; modalBody.style.color = '#fff'; }
            if (closeBtn) { closeBtn.style.visibility = 'visible'; }
        } else if (type === 'warning') {
            modal.classList.add('modal-info');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#ff9800"/><text x="50%" y="56%" text-anchor="middle" fill="#fff" font-size="28" font-family="Arial" dy=".3em">!</text></svg>';
            if (content) { content.style.background = '#2196f3'; }
            if (modalTitle) { modalTitle.style.color = '#fff'; }
            if (modalBody) { modalBody.style.background = '#2196f3'; modalBody.style.color = '#fff'; }
            if (closeBtn) { closeBtn.style.visibility = 'visible'; }
        } else if (type === 'success') {
            modal.classList.add('modal-success');
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#4caf50"/><path d="M30 17L20 27L14 21" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            if (content) { content.style.background = '#fff'; }
            if (modalTitle) { modalTitle.style.color = '#0f172a'; }
            if (modalBody) { modalBody.style.background = '#fff'; modalBody.style.color = '#0f172a'; }
            if (closeBtn) { closeBtn.style.visibility = 'visible'; }
        } else {
            // default info
            iconDiv.innerHTML = '<svg style="display:block;margin:0 auto 14px auto;" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#2196f3"/><text x="50%" y="56%" text-anchor="middle" fill="#fff" font-size="28" font-family="Arial" dy=".3em">i</text></svg>';
            if (content) { content.style.background = '#fff'; }
            if (modalTitle) { modalTitle.style.color = '#0f172a'; }
            if (modalBody) { modalBody.style.background = '#fff'; modalBody.style.color = '#0f172a'; }
            if (closeBtn) { closeBtn.style.visibility = 'visible'; }
        }

        // Show modal - use flex for proper centering
        modal.style.display = 'flex';
        modal.style.zIndex = '1010';
        if (content) { content.style.position = 'relative'; content.style.zIndex = '1011'; }
        // Ensure backdrop is transparent so login page is visible
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        modal.style.backdropFilter = 'blur(2px)';
        document.body.style.overflow = 'hidden';

        // Ensure text has visible contrast against background (safety net)
        try {
            if (content && modalBody) {
                const bg = window.getComputedStyle(content).backgroundColor || '';
                const isWhiteBg = bg === 'rgb(255, 255, 255)' || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || !bg;
                if (isWhiteBg) {
                    // Use dark text for white/transparent backgrounds
                    modalBody.style.color = '#0f172a';
                    if (modalTitle) { modalTitle.style.color = '#0f172a'; }
                } else {
                    // Non-white backgrounds: prefer white text
                    modalBody.style.color = '#fff';
                    if (modalTitle) { modalTitle.style.color = '#fff'; }
                }
            }
        } catch (_) { /* ignore */ }

        console.log('Modal displayed:', title, message, type);
        console.log('Modal element:', modal);
        console.log('Title element:', modalTitle, 'Text:', modalTitle.textContent);
        console.log('Message element:', modalBody, 'Text:', modalBody.textContent);
    };

    // Update-only helper (keeps modal open)
    window.updateMessageModal = function(title, message, type) {
        window.showMessageModal(title, message, type);
    };
    window.closeMessageModal = closeMessageModal;
});
