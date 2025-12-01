// Activity Logs Page Functionality
document.addEventListener('DOMContentLoaded', () => {
    let currentPage = 1;
    let currentFilters = {};
    let totalPages = 1;

    // Initialize
    init();

    function init() {
        setupEventListeners();
        loadActivityLogs();
    }

    function setupEventListeners() {
        // Filter controls
        document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
            currentPage = 1;
            applyFilters();
        });

        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            clearFilters();
        });

        // Pagination
        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadActivityLogs();
            }
        });

        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadActivityLogs();
            }
        });

        // Export
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            exportToCSV();
        });

        // Enter key on search
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentPage = 1;
                applyFilters();
            }
        });
    }

    function applyFilters() {
        currentFilters = {
            search: document.getElementById('searchInput')?.value || '',
            actorRole: document.getElementById('actorRoleSelect')?.value || '',
            actionType: document.getElementById('actionTypeSelect')?.value || '',
            targetResource: document.getElementById('targetResourceSelect')?.value || '',
            startDate: document.getElementById('startDateInput')?.value || '',
            endDate: document.getElementById('endDateInput')?.value || ''
        };
        loadActivityLogs();
    }

    function clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('actorRoleSelect').value = '';
        document.getElementById('actionTypeSelect').value = '';
        document.getElementById('targetResourceSelect').value = '';
        document.getElementById('startDateInput').value = '';
        document.getElementById('endDateInput').value = '';
        currentFilters = {};
        currentPage = 1;
        loadActivityLogs();
    }

    async function loadActivityLogs() {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) {return;}

        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-state">
                    <div class="spinner"></div>
                    <div>Loading activity logs...</div>
                </td>
            </tr>
        `;

        try {
            // Build query string
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '20',
                ...Object.fromEntries(Object.entries(currentFilters).filter(([_, v]) => v))
            });

            const response = await fetch(`/api/activity-logs/logs?${params}`, {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to load activity logs');
            }

            // Update pagination
            totalPages = data.pagination?.pages || 1;
            updatePagination(data.pagination);

            // Render logs
            if (data.logs && data.logs.length > 0) {
                renderLogs(data.logs);
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <i data-lucide="file-x" class="empty-state-icon"></i>
                            <div>No activity logs found</div>
                        </td>
                    </tr>
                `;
                if (window.lucide) {
                    window.lucide.createIcons();
                }
            }
        } catch (error) {
            console.error('Error loading activity logs:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="alert-circle" class="empty-state-icon"></i>
                        <div>Error loading activity logs: ${error.message}</div>
                    </td>
                </tr>
            `;
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }

    function renderLogs(logs) {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) {return;}

        tbody.innerHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp);
            const actor = log.actor || {};
            const actorName = actor.name || actor.email || 'Unknown';
            const actorEmail = actor.email || '';
            const actorRole = actor.role || '';
            const profilePicture = actor.profilePicture || '/images/memofy-logo.png';

            // Determine badge class based on action type
            let badgeClass = '';
            if (log.actionType?.startsWith('memo_')) {
                badgeClass = 'memo';
            } else if (log.actionType?.startsWith('calendar_')) {
                badgeClass = 'calendar';
            } else if (log.actionType?.startsWith('user_')) {
                badgeClass = 'user';
            } else if (log.actionType?.includes('login') || log.actionType?.includes('logout') || log.actionType?.includes('password')) {
                badgeClass = 'auth';
            }

            return `
                <tr>
                    <td>
                        <div class="timestamp">
                            ${timestamp.toLocaleString()}
                        </div>
                    </td>
                    <td>
                        <div class="actor-info">
                            <img src="${profilePicture}" alt="${actorName}" class="actor-avatar" onerror="this.src='/images/memofy-logo.png'">
                            <div class="actor-details">
                                <div class="actor-name">${escapeHtml(actorName)}</div>
                                <div class="actor-email">${escapeHtml(actorEmail)}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="action-badge ${badgeClass}">${formatActionType(log.actionType)}</span>
                    </td>
                    <td>${escapeHtml(log.description || '')}</td>
                    <td>
                        ${log.targetResource && log.targetName
                            ? `<span>${escapeHtml(log.targetResource)}: ${escapeHtml(log.targetName)}</span>`
                            : '<span style="color: #9ca3af;">-</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function updatePagination(pagination) {
        const paginationEl = document.getElementById('pagination');
        const infoEl = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (!pagination || pagination.total === 0) {
            if (paginationEl) {paginationEl.style.display = 'none';}
            return;
        }

        if (paginationEl) {paginationEl.style.display = 'flex';}
        if (infoEl) {
            infoEl.textContent = `Page ${pagination.page} of ${pagination.pages} (${pagination.total} total)`;
        }
        if (prevBtn) {
            prevBtn.disabled = pagination.page <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = pagination.page >= pagination.pages;
        }
    }

    async function exportToCSV() {
        try {
            // Build query string with current filters
            const params = new URLSearchParams({
                ...Object.fromEntries(Object.entries(currentFilters).filter(([_, v]) => v))
            });

            const response = await fetch(`/api/activity-logs/logs/export/csv?${params}`, {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            Swal.fire({
                icon: 'success',
                title: 'Export Successful',
                text: 'Activity logs exported to CSV',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error exporting activity logs:', error);
            Swal.fire({
                icon: 'error',
                title: 'Export Failed',
                text: error.message || 'Failed to export activity logs'
            });
        }
    }

    function formatActionType(actionType) {
        if (!actionType) {return '';}
        return actionType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

