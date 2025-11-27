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

        // Check if user is on their own dashboard - don't show errors when on correct dashboard
        // This prevents showing irrelevant errors when users access their own dashboard after login
        const currentPath = window.location.pathname;

        // Get user role from data attribute
        let currentUserRole = '';
        try {
            const userDataAttr = document.body.getAttribute('data-current-user');
            if (userDataAttr) {
                const userData = JSON.parse(userDataAttr);
                currentUserRole = userData.role || '';
            }
        } catch (e) {
            // Can't parse user data, continue with error handling
        }

        // Check if user is on their correct dashboard
        const isOnCorrectDashboard =
            (currentUserRole === 'admin' && currentPath === '/admin-dashboard') ||
            (currentUserRole === 'secretary' && currentPath === '/secretary-dashboard') ||
            (currentUserRole === 'faculty' && currentPath === '/faculty-dashboard');

        // If user is on their correct dashboard, be VERY strict - default to NOT showing errors
        // Only show errors if we have CLEAR evidence they tried to access a different role's dashboard
        if (isOnCorrectDashboard && error === 'unauthorized_access') {
            const referrer = document.referrer || '';

            // Check if referrer shows they came from trying to access a different role's dashboard
            const referrerShowsDashboardAccess =
                (currentUserRole === 'secretary' && (referrer.includes('/admin-dashboard') || referrer.includes('/faculty-dashboard'))) ||
                (currentUserRole === 'faculty' && (referrer.includes('/admin-dashboard') || referrer.includes('/secretary-dashboard'))) ||
                (currentUserRole === 'admin' && (referrer.includes('/secretary-dashboard') || referrer.includes('/faculty-dashboard')));

            // Check if error message matches what would happen if they tried to access wrong dashboard
            let errorMessageMatches = false;
            if (decodedMessage) {
                if (currentUserRole === 'secretary' && decodedMessage.includes('Admin access required')) {
                    errorMessageMatches = true;
                } else if (currentUserRole === 'secretary' && decodedMessage.includes('Faculty access required')) {
                    errorMessageMatches = true;
                } else if (currentUserRole === 'faculty' && decodedMessage.includes('Admin access required')) {
                    errorMessageMatches = true;
                } else if (currentUserRole === 'faculty' && decodedMessage.includes('Secretary access required')) {
                    errorMessageMatches = true;
                } else if (currentUserRole === 'admin' && decodedMessage.includes('Secretary access required')) {
                    errorMessageMatches = true;
                } else if (currentUserRole === 'admin' && decodedMessage.includes('Faculty access required')) {
                    errorMessageMatches = true;
                }
            }

            // Check if this is from a login redirect (suppress errors in this case)
            const isFromLogin = referrer.includes('/login') ||
                               referrer.includes('/auth/') ||
                               referrer.includes('/auth-success');

            // Show error if:
            // 1. Error message matches unauthorized access to different role's dashboard, AND
            // 2. Either referrer shows dashboard access OR referrer is empty (server redirect), AND
            // 3. NOT from login redirect
            // This ensures we show errors for actual unauthorized access attempts
            if (errorMessageMatches && !isFromLogin && (referrerShowsDashboardAccess || referrer === '')) {
                // They actually tried to access a different role's dashboard - show error
                // Continue to showErrorModal below
            } else {
                // Normal login redirect or no clear evidence - clean URL silently
                cleanUrl();
                return;
            }
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
            // Wait for user data to be available before handling error
            // This prevents showing errors when user is on their correct dashboard
            function checkAndHandleError() {
                // Check if user data is available
                const userDataAttr = document.body.getAttribute('data-current-user');
                if (!userDataAttr) {
                    // User data not available yet, try again
                    setTimeout(checkAndHandleError, 100);
                    return;
                }

                // User data is available, now handle the error
                handleError(params.error, params.message);
            }

            // Start checking after a short delay to ensure DOM is ready
            setTimeout(checkAndHandleError, 100);
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

