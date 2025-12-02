/**
 * Mobile Sidebar Toggle Functionality
 * Handles opening/closing sidebar on mobile devices
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.querySelector('.sidebar-overlay');
        const body = document.body;

        if (!mobileMenuToggle || !sidebar) {
            return; // Exit if elements don't exist
        }

        // Create overlay if it doesn't exist
        let overlay = sidebarOverlay;
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        // Store scroll position
        let scrollPosition = 0;

        // Toggle sidebar function
        function toggleSidebar() {
            const isOpen = sidebar.classList.contains('open');

            if (isOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        }

        // Open sidebar
        function openSidebar() {
            // Save current scroll position
            scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

            sidebar.classList.add('open');
            overlay.classList.add('active');
            body.classList.add('sidebar-open');

            // Apply saved scroll position to body to prevent jump
            body.style.top = '-' + scrollPosition + 'px';

            // Update icon to close (X)
            const icon = mobileMenuToggle.querySelector('i');
            if (icon && typeof lucide !== 'undefined') {
                icon.setAttribute('data-lucide', 'x');
                lucide.createIcons();
            }

            // Reinitialize all Lucide icons in the sidebar (for archive, settings, logout icons)
            if (typeof lucide !== 'undefined') {
                // Small delay to ensure sidebar is visible
                setTimeout(() => {
                    lucide.createIcons();
                }, 50);
            }
        }

        // Close sidebar
        function closeSidebar() {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            body.classList.remove('sidebar-open');

            // Restore scroll position
            body.style.top = '';
            if (scrollPosition !== undefined) {
                window.scrollTo(0, scrollPosition);
            }

            // Update icon to menu (hamburger)
            const icon = mobileMenuToggle.querySelector('i');
            if (icon && typeof lucide !== 'undefined') {
                icon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            }
        }

        // Event listeners
        mobileMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });

        // Close sidebar when clicking overlay
        overlay.addEventListener('click', () => {
            closeSidebar();
        });

        // Close sidebar when clicking a link inside sidebar
        const sidebarLinks = sidebar.querySelectorAll('a');
        sidebarLinks.forEach((link) => {
            link.addEventListener('click', () => {
                // Small delay to allow navigation
                setTimeout(() => {
                    closeSidebar();
                }, 100);
            });
        });

        // Close sidebar on window resize if it becomes desktop size
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (window.innerWidth >= 577) {
                    closeSidebar();
                }
            }, 250);
        });

        // Initialize Lucide icons for the toggle button
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    });
})();

