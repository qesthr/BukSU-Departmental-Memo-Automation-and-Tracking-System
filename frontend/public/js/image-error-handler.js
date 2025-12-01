// Image Error Handler - CSP-compliant error handling for profile pictures
// This script handles image loading errors without using inline event handlers

(function() {
    'use strict';

    // Default fallback image
    const DEFAULT_IMAGE = '/images/memofy-logo.png';

    /**
     * Handle image load errors by setting fallback image
     * @param {Event} event - The error event
     */
    function handleImageError(event) {
        const img = event.target;
        if (img && img.tagName === 'IMG' && img.src !== DEFAULT_IMAGE) {
            // Prevent infinite loop if fallback also fails
            img.removeEventListener('error', handleImageError);
            img.src = DEFAULT_IMAGE;
        }
    }

    /**
     * Attach error handlers to existing images
     */
    function attachErrorHandlers() {
        // Find all profile picture images - expanded selector to catch more images
        const selectors = [
            'img.profile-img',
            'img.chip-avatar',
            'img.user-avatar',
            'img.memo-avatar',
            'img.actor-avatar',
            'img.suggestion-avatar',
            'img.recipient-suggestion-avatar',
            'img.ack-avatar-img',
            'img.recipient-avatar-img-inline',
            'img[alt*="Profile"]',
            'img[alt*="Avatar"]',
            '#navProfileImg',
            '#profilePreviewImg'
        ];

        // Also catch images in /uploads/ that might be profile pictures
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            // Check if image is from uploads directory (likely a profile picture or attachment)
            const src = img.src || img.getAttribute('src') || '';
            if (src.includes('/uploads/') || src.includes('/images/uploads/')) {
                if (!img.dataset.errorHandlerAttached) {
                    img.addEventListener('error', handleImageError);
                    img.dataset.errorHandlerAttached = 'true';
                }
            }
        });

        // Attach to specific selectors
        selectors.forEach(selector => {
            try {
                const images = document.querySelectorAll(selector);
                images.forEach(img => {
                    if (!img.dataset.errorHandlerAttached) {
                        img.addEventListener('error', handleImageError);
                        img.dataset.errorHandlerAttached = 'true';
                    }
                });
            } catch (e) {
                // Ignore invalid selectors
            }
        });
    }

    /**
     * Handle dynamically added images using MutationObserver
     */
    function observeDynamicImages() {
        if (!document.body) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node is an image
                        if (node.tagName === 'IMG') {
                            const src = node.src || node.getAttribute('src') || '';
                            // Attach to all images, especially those from uploads
                            if (!node.dataset.errorHandlerAttached) {
                                node.addEventListener('error', handleImageError);
                                node.dataset.errorHandlerAttached = 'true';
                            }
                        }
                        // Check for images within the added node
                        if (node.querySelectorAll) {
                            const images = node.querySelectorAll('img');
                            images.forEach(img => {
                                if (!img.dataset.errorHandlerAttached) {
                                    img.addEventListener('error', handleImageError);
                                    img.dataset.errorHandlerAttached = 'true';
                                }
                            });
                        }
                    }
                });
            });
        });

        // Observe the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Run immediately if possible
    if (document.body) {
        attachErrorHandlers();
        observeDynamicImages();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            attachErrorHandlers();
            observeDynamicImages();
        });
    } else {
        // DOM is already ready
        attachErrorHandlers();
        observeDynamicImages();
    }

    // Also run after delays to catch any images loaded asynchronously
    setTimeout(attachErrorHandlers, 50);
    setTimeout(attachErrorHandlers, 100);
    setTimeout(attachErrorHandlers, 300);
    setTimeout(attachErrorHandlers, 500);
    setTimeout(attachErrorHandlers, 1000);
})();

