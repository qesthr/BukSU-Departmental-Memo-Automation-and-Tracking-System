/**
 * Error Handler for Dashboard Pages
 * Displays error messages from URL query parameters
 * Specifically handles unauthorized access errors
 */

(function() {
    'use strict';

    // Parse URL query parameters
    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            error: params.get('error'),
            message: params.get('message')
        };
    }

    // Add CSS for white backdrop
    function addWhiteBackdropStyles() {
        if (document.getElementById('swal-white-backdrop-styles')) {
            return; // Already added
        }
        const style = document.createElement('style');
        style.id = 'swal-white-backdrop-styles';
        style.textContent = `
            .swal2-backdrop-show {
                background-color: #FFFFFF !important;
            }
            .swal2-container {
                background-color: #FFFFFF !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Show error message using SweetAlert2 if available, otherwise use alert
    function showErrorModal(title, message) {
        if (typeof Swal !== 'undefined') {
            // Add white backdrop styles
            addWhiteBackdropStyles();

            // Hide dashboard content when showing unauthorized access error
            const dashboardContainer = document.querySelector('.dashboard-container');
            const mainContent = document.querySelector('.main-content');
            const sidebar = document.querySelector('.sidebar');
            const navigations = document.querySelector('.navigations');

            if (dashboardContainer) {
                dashboardContainer.style.display = 'none';
            }
            if (mainContent) {
                mainContent.style.display = 'none';
            }
            if (sidebar) {
                sidebar.style.display = 'none';
            }
            if (navigations) {
                navigations.style.display = 'none';
            }

            // Set body background to white
            document.body.style.backgroundColor = '#FFFFFF';

            Swal.fire({
                icon: 'error',
                title: title || 'Unauthorized Access',
                text: message || 'You do not have permission to access this page.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#ef4444',
                allowOutsideClick: false,
                allowEscapeKey: true,
                backdrop: true
            }).then(() => {
                // Clean URL after showing error
                cleanUrl();
                // Restore dashboard visibility
                if (dashboardContainer) {
                    dashboardContainer.style.display = '';
                }
                if (mainContent) {
                    mainContent.style.display = '';
                }
                if (sidebar) {
                    sidebar.style.display = '';
                }
                if (navigations) {
                    navigations.style.display = '';
                }
            });
        } else {
            // Fallback to browser alert
            alert(title + ': ' + (message || 'You do not have permission to access this page.'));
            cleanUrl();
        }
    }

    // Show inline error banner
    function showInlineError(message) {
        // Try to find existing error container
        let errorContainer = document.getElementById('errorBanner');

        if (!errorContainer) {
            // Create error banner if it doesn't exist
            errorContainer = document.createElement('div');
            errorContainer.id = 'errorBanner';
            errorContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background-color: #ef4444;
                color: white;
                padding: 12px 20px;
                text-align: center;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                animation: slideDown 0.3s ease-out;
            `;

            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideDown {
                    from {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);

            document.body.insertBefore(errorContainer, document.body.firstChild);
        }

        errorContainer.textContent = message || 'Unauthorized access. You do not have permission to access this page.';
        errorContainer.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorContainer) {
                errorContainer.style.display = 'none';
            }
            cleanUrl();
        }, 5000);
    }

    // Clean URL by removing query parameters
    function cleanUrl() {
        if (window.history && window.history.replaceState) {
            const url = new URL(window.location);
            url.searchParams.delete('error');
            url.searchParams.delete('message');
            window.history.replaceState({}, '', url);
        }
    }

    // Handle different error types
    function handleError(error, message) {
        const decodedMessage = message ? decodeURIComponent(message) : null;

        // Check if user is on their own dashboard - don't show "Admin access required" errors
        // This prevents showing irrelevant errors when faculty/secretary users access their dashboard
        const currentPath = window.location.pathname;
        const isDashboard = currentPath === '/dashboard' || currentPath === '/admin-dashboard';

        // If error is about admin access and user is on their own dashboard, ignore it
        // This happens when middleware redirects non-admin users from admin routes to their dashboard
        if (error === 'unauthorized_access' && isDashboard && decodedMessage && decodedMessage.includes('Admin access required')) {
            // Silently clean the URL - this is a redirect from an admin route, not a real error
            cleanUrl();
            return;
        }

        switch(error) {
            case 'unauthorized_access':
                // Show modal for unauthorized access (only if not filtered out above)
                showErrorModal(
                    'Unauthorized Access',
                    decodedMessage || 'You do not have permission to access this page. Please contact your administrator if you believe this is an error.'
                );
                break;

            case 'access_denied':
                // Legacy error code - treat as unauthorized
                showErrorModal(
                    'Access Denied',
                    decodedMessage || 'You do not have permission to access this resource.'
                );
                break;

            default:
                // Show inline banner for other errors
                if (decodedMessage) {
                    showInlineError(decodedMessage);
                }
        }
    }

    // Initialize error handling when DOM is ready
    function init() {
        const params = getQueryParams();

        if (params.error) {
            // Wait a bit for page to load, then show error
            setTimeout(() => {
                handleError(params.error, params.message);
            }, 500);
        }
    }

    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }

    // Export for manual use
    window.showUnauthorizedError = function(message) {
        showErrorModal('Unauthorized Access', message || 'You do not have permission to access this page.');
    };

})();

