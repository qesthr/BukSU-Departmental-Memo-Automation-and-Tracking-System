// Contextual Search Functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.search-input');
    const currentPage = window.location.pathname;

    if (!searchInput) {
        return;
    }

    // Update placeholder based on page
    updateSearchPlaceholder(currentPage);

    // Handle search based on current page
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        if (currentPage.includes('/users')) {
            searchUsers(searchTerm);
        } else if (currentPage.includes('/log')) {
            searchLogs(searchTerm);
        } else if (currentPage.includes('/dashboard') || currentPage === '/admin-dashboard') {
            searchDashboard(searchTerm);
        }
    });

    // Clear search on page change
    searchInput.value = '';

    function updateSearchPlaceholder(path) {
        if (path.includes('/users')) {
            searchInput.placeholder = 'Search users, departments, roles...';
        } else if (path.includes('/log')) {
            searchInput.placeholder = 'Search logs, memos, activity...';
        } else if (path.includes('/dashboard') || path === '/admin-dashboard') {
            searchInput.placeholder = 'Search dashboard...';
        } else {
            searchInput.placeholder = 'Search anything in Memofy...';
        }
    }

    function searchUsers(searchTerm) {
        // Trigger global search function if it exists
        if (window.renderUsers) {
            window.renderUsers();
        }
    }

    function searchLogs(searchTerm) {
        // Check if log JS is loaded
        if (window.logLoaded) {
            // Trigger search in log.js
            const logSearch = document.getElementById('logSearch');
            if (logSearch) {
                logSearch.value = searchTerm;
                logSearch.dispatchEvent(new Event('input'));
            }
        }
    }

    function searchDashboard(searchTerm) {
        // Dashboard search could filter recent memos
        const memoItems = document.querySelectorAll('.memo-item');
        memoItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }
});

