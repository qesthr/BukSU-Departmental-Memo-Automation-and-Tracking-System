// Contextual Search Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Use ID selector to ensure we get the correct search input from topbar
    const searchInput = document.getElementById('globalSearchInput') || document.querySelector('.search-input');
    const currentPage = window.location.pathname;

    if (!searchInput) {
        return;
    }

    // Disable search for report and activity-logs pages
    if (currentPage.includes('/report') || currentPage.includes('/activity-logs')) {
        const searchContainer = searchInput.closest('.search-container');
        if (searchContainer) {
            searchContainer.style.display = 'none';
        }
        return;
    }

    // Update placeholder based on page
    updateSearchPlaceholder(currentPage);

    // Handle search based on current page
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();

        if (currentPage.includes('/users')) {
            searchUsers();
        } else if (currentPage.includes('/log') || currentPage.includes('/memos')) {
            searchLogs();
        } else if (currentPage.includes('/dashboard') || currentPage === '/admin-dashboard') {
            searchDashboard(searchTerm);
        } else if (currentPage.includes('/archive')) {
            searchArchive(searchTerm);
        } else if (currentPage.includes('/calendar')) {
            searchCalendar(searchTerm);
        }
    });

    function updateSearchPlaceholder(path) {
        if (path.includes('/users')) {
            searchInput.placeholder = 'Search users, departments, roles...';
        } else if (path.includes('/log') || path.includes('/memos')) {
            searchInput.placeholder = 'Search memos, subjects, senders...';
        } else if (path.includes('/dashboard') || path === '/admin-dashboard') {
            searchInput.placeholder = 'Search dashboard...';
        } else if (path.includes('/archive')) {
            searchInput.placeholder = 'Search archived memos, events...';
        } else if (path.includes('/calendar')) {
            searchInput.placeholder = 'Search events, titles, descriptions...';
        } else {
            searchInput.placeholder = 'Search anything in Memofy...';
        }
    }

    function searchUsers() {
        // Trigger global search function if it exists
        // renderUsers() reads from the input directly, so we just need to trigger it
        if (window.renderUsers) {
            window.renderUsers();
        }
    }

    function searchLogs() {
        // The search input is already connected to log.js via the globalSearchInput
        // log.js has its own event listener that will handle the search
        // We don't need to do anything here since log.js listens directly to the input
        // The input event will bubble and log.js will catch it
        // This function is kept for compatibility but doesn't need to do anything
    }

    function searchDashboard(searchTerm) {
        // Dashboard search filters recent memos
        const memoItems = document.querySelectorAll('.memo-item');
        const searchLower = searchTerm.toLowerCase();

        memoItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = !searchTerm || text.includes(searchLower) ? '' : 'none';
        });
    }

    function searchArchive(searchTerm) {
        // Archive search filters archived items (memos, events, signatures)
        // The archive page uses filteredMemos and allArchivedItems variables
        // We need to filter based on the search term and re-render

        if (typeof window !== 'undefined' && window.allArchivedItems) {
            const searchLower = searchTerm.toLowerCase();

            // Store search term globally so archive page can use it
            window.archiveSearchTerm = searchTerm;

            // Start with all archived items
            let itemsToFilter = [...window.allArchivedItems];

            // Apply existing priority filter if any
            const priorityFilter = document.getElementById('priorityFilterDropdown');
            if (priorityFilter && priorityFilter.value !== 'all') {
                const priority = priorityFilter.value;
                itemsToFilter = itemsToFilter.filter(item => {
                    if (item.type === 'event') {
                        const category = (item.category || '').toLowerCase();
                        if (priority === 'urgent') {
                            return category === 'urgent' || category === 'deadline';
                        }
                        if (priority === 'high') {
                            return category === 'high' || category === 'meeting';
                        }
                        if (priority === 'medium') {
                            return category === 'standard' || category === 'reminder';
                        }
                        if (priority === 'low') {
                            return category === 'low';
                        }
                        return false;
                    } else {
                        return (item.priority || '').toLowerCase() === priority;
                    }
                });
            }

            // Apply search filter
            if (searchTerm) {
                itemsToFilter = itemsToFilter.filter(item => {
                    // Search in subject/title
                    const subject = (item.subject || item.title || '').toLowerCase();
                    if (subject.includes(searchLower)) {
                        return true;
                    }

                    // Search in content/description
                    const content = (item.content || item.description || '').toLowerCase();
                    if (content.includes(searchLower)) {
                        return true;
                    }

                    // Search in sender/creator name
                    if (item.sender) {
                        const senderName = `${item.sender.firstName || ''} ${item.sender.lastName || ''}`.toLowerCase();
                        if (senderName.includes(searchLower)) {
                            return true;
                        }
                    }

                    // Search in department
                    const department = (item.department || '').toLowerCase();
                    if (department.includes(searchLower)) {
                        return true;
                    }

                    // Search in priority/category
                    const priority = (item.priority || item.category || '').toLowerCase();
                    if (priority.includes(searchLower)) {
                        return true;
                    }

                    return false;
                });
            }

            // Apply sorting
            const sortDropdown = document.getElementById('sortDropdown');
            if (sortDropdown) {
                const sort = sortDropdown.value;
                itemsToFilter.sort((a, b) => {
                    if (sort === 'newest') {
                        const aDate = new Date(a.updatedAt || a.createdAt || 0);
                        const bDate = new Date(b.updatedAt || b.createdAt || 0);
                        return bDate - aDate;
                    } else if (sort === 'oldest') {
                        const aDate = new Date(a.updatedAt || a.createdAt || 0);
                        const bDate = new Date(b.updatedAt || b.createdAt || 0);
                        return aDate - bDate;
                    } else if (sort === 'priority') {
                        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                        const aPriority = a.type === 'event' ? (a.category === 'urgent' || a.category === 'deadline' ? 'urgent' : a.category === 'high' || a.category === 'meeting' ? 'high' : a.category === 'low' ? 'low' : 'medium') : (a.priority || 'medium');
                        const bPriority = b.type === 'event' ? (b.category === 'urgent' || b.category === 'deadline' ? 'urgent' : b.category === 'high' || b.category === 'meeting' ? 'high' : b.category === 'low' ? 'low' : 'medium') : (b.priority || 'medium');
                        return (priorityOrder[bPriority] || 0) - (priorityOrder[aPriority] || 0);
                    } else if (sort === 'subject') {
                        const aTitle = a.type === 'event' ? (a.title || '') : (a.subject || '');
                        const bTitle = b.type === 'event' ? (b.title || '') : (b.subject || '');
                        return aTitle.localeCompare(bTitle);
                    }
                    return 0;
                });
            }

            // Update global filteredMemos
            window.filteredMemos = itemsToFilter;

            // Re-render the archive list if the function exists
            if (typeof window.renderArchiveList === 'function') {
                window.renderArchiveList();
            }
        }
    }

    function searchCalendar(searchTerm) {
        // Calendar search filters events
        // The calendar uses allEventsCache and filteredEvents variables
        // We need to filter events and update the calendar display

        if (typeof window !== 'undefined' && window.allEventsCache) {
            const searchLower = searchTerm.toLowerCase();

            // Filter events based on search term
            const filteredEvents = window.allEventsCache.filter(event => {
                if (!searchTerm) {
                    return true;
                }

                // Search in title
                const title = (event.title || '').toLowerCase();
                if (title.includes(searchLower)) {
                    return true;
                }

                // Search in description
                const description = (event.description || event.extendedProps?.description || '').toLowerCase();
                if (description.includes(searchLower)) {
                    return true;
                }

                // Search in category
                const category = (event.extendedProps?.category || event.category || '').toLowerCase();
                if (category.includes(searchLower)) {
                    return true;
                }

                // Search in location
                const location = (event.extendedProps?.location || event.location || '').toLowerCase();
                if (location.includes(searchLower)) {
                    return true;
                }

                // Search in participants
                if (event.extendedProps?.participants) {
                    const participants = event.extendedProps.participants.join(' ').toLowerCase();
                    if (participants.includes(searchLower)) {
                        return true;
                    }
                }

                return false;
            });

            // Update calendar with filtered events
            if (window.customCalendar && typeof window.customCalendar.setEvents === 'function') {
                window.customCalendar.setEvents(filteredEvents);
            }

            // Also update mini calendar if it exists
            if (window.miniCalendarEvents !== undefined) {
                window.miniCalendarEvents = filteredEvents;
                if (typeof window.renderMiniCalendar === 'function') {
                    window.renderMiniCalendar();
                }
            }

            // Trigger applyFilters to update UI
            if (typeof window.applyFilters === 'function') {
                // Store filtered events for applyFilters to use
                window.filteredEvents = filteredEvents;
                window.applyFilters();
            }
        }
    }
});

