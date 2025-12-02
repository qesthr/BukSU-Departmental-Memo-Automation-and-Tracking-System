// Fetch and display dashboard stats from the database
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/log/dashboard/stats');
        const data = await response.json();

        if (data.success && data.stats) {
            // Update stat cards with real data
            updateStatCards(data.stats);

            // Update recent memos
            updateRecentMemos(data.stats.recentMemos);
        }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Keep default/hardcoded values if API fails
    }

    // Initialize system status widget
    initSystemStatusWidget();

    lucide.createIcons();
});

function updateStatCards(stats) {
    // Update Total Memos (use same total as Admin Reports / reportService)
    const totalMemosElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (totalMemosElement) {
        const totalMemos = stats.memos.total || 0;
        totalMemosElement.textContent = totalMemos.toLocaleString();
        const changeElement = totalMemosElement.parentElement.querySelector('.stat-change');
        if (changeElement) {
            // Remove sent/received breakdown
            changeElement.textContent = '';
        }
    }

    // Update Pending Acknowledgment
    const pendingElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (pendingElement) {
        pendingElement.textContent = stats.memos.pending;
    }

    // Update Overdue Memos
    const overdueElement = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (overdueElement) {
        overdueElement.textContent = stats.memos.overdue;
    }

    // Update Active Users
    const activeUsersElement = document.querySelector('.stat-card:nth-child(4) .stat-value');
    if (activeUsersElement) {
        activeUsersElement.textContent = stats.users.active;
    }
}

function updateRecentMemos(recentMemos) {
    const memoListContainer = document.querySelector('.memo-list');
    if (!memoListContainer || !recentMemos || recentMemos.length === 0) {
        return;
    }

    // Clear existing memos
    memoListContainer.innerHTML = '';

    // Add each recent memo
    recentMemos.forEach(memo => {
        const memoItem = document.createElement('div');
        memoItem.className = 'memo-item';
        memoItem.style.cursor = 'pointer';

        // Set icon based on type
        let iconName = 'file-text';
        if (memo.type === 'orange') {
            iconName = 'alert-triangle';
        } else if (memo.type === 'purple') {
            iconName = 'calendar';
        }

        // Format title: add "Sent: " prefix for sent memos
        let displayTitle = memo.title || '(No subject)';
        if (memo.isSent) {
            displayTitle = `Sent: ${displayTitle}`;
        }

        // Format department/recipient info
        let displayInfo = memo.department || 'Unknown';
        if (memo.isSent && memo.recipient) {
            displayInfo = `To: ${memo.recipient}`;
        } else if (memo.isReceived && memo.sender) {
            displayInfo = `From: ${memo.sender}`;
        } else {
            displayInfo = memo.department || 'Unknown';
        }

        memoItem.innerHTML = `
            <i data-lucide="${iconName}" class="memo-icon ${memo.type}"></i>
            <div class="memo-info">
                <h4>${displayTitle}</h4>
                <p>${displayInfo}</p>
            </div>
            <span class="memo-date">${memo.date}</span>
        `;

        // Add click handler to navigate to log
        memoItem.addEventListener('click', () => {
            window.location.href = '/admin/log';
        });

        memoListContainer.appendChild(memoItem);
    });

    // Reinitialize icons
    lucide.createIcons();
}

// System Status Widget Functionality
let systemStatusRefreshInterval = null;

function initSystemStatusWidget() {
    const widget = document.getElementById('systemStatusWidget');
    if (!widget) {return;}

    const refreshBtn = document.getElementById('systemStatusRefresh');
    const toggleBtn = document.getElementById('systemStatusToggle');

    // Initial fetch
    fetchSystemStatus();

    // Manual refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fetchSystemStatus(true);
        });
    }

    // Toggle details button
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const details = document.getElementById('systemStatusDetails');
            const isExpanded = details.style.display !== 'none';

            if (isExpanded) {
                details.style.display = 'none';
                toggleBtn.querySelector('.toggle-text').textContent = 'Show Details';
                widget.classList.remove('expanded');
            } else {
                details.style.display = 'block';
                toggleBtn.querySelector('.toggle-text').textContent = 'Hide Details';
                widget.classList.add('expanded');
            }

            lucide.createIcons();
        });
    }

    // Auto-refresh every 60 seconds
    systemStatusRefreshInterval = setInterval(() => {
        fetchSystemStatus();
    }, 60000);
}

async function fetchSystemStatus(manualRefresh = false) {
    const statusText = document.getElementById('systemStatusText');
    const statusTime = document.getElementById('systemStatusTime');
    const statusIcon = document.getElementById('systemStatusIcon');
    const statusIndicator = document.getElementById('statusIndicator');
    const refreshBtn = document.getElementById('systemStatusRefresh');
    const servicesContainer = document.getElementById('systemStatusServices');

    if (!statusText) {return;}

    try {
        // Show loading state
        if (manualRefresh && refreshBtn) {
            refreshBtn.classList.add('refreshing');
        }

        statusText.textContent = 'Checking...';
        statusIndicator.className = 'status-indicator checking';
        statusIcon.setAttribute('data-lucide', 'activity');

        const response = await fetch('/api/system/health');
        const data = await response.json();

        if (data.success && data.health) {
            updateSystemStatusUI(data.health);
        } else {
            throw new Error(data.message || 'Failed to fetch system status');
        }
    } catch (error) {
        console.error('Error fetching system status:', error);
        statusText.textContent = 'Unable to check status';
        statusTime.textContent = '';
        statusIndicator.className = 'status-indicator down';
        statusIcon.setAttribute('data-lucide', 'x-circle');
        statusIcon.style.color = '#ef4444';

        if (servicesContainer) {
            servicesContainer.innerHTML = '<p style="color: #ef4444; font-size: 0.875rem;">Error: ' + error.message + '</p>';
        }
    } finally {
        if (manualRefresh && refreshBtn) {
            refreshBtn.classList.remove('refreshing');
        }
        lucide.createIcons();
    }
}

function updateSystemStatusUI(health) {
    const statusText = document.getElementById('systemStatusText');
    const statusTime = document.getElementById('systemStatusTime');
    const statusIcon = document.getElementById('systemStatusIcon');
    const statusIndicator = document.getElementById('statusIndicator');
    const servicesContainer = document.getElementById('systemStatusServices');

    // Update overall status
    const overallStatus = health.overall;
    let statusMessage = '';
    let iconName = 'activity';
    let iconColor = '#3b82f6';
    let indicatorClass = 'operational';

    switch (overallStatus) {
        case 'operational':
            statusMessage = 'All systems operational';
            iconName = 'check-circle';
            iconColor = '#10b981';
            indicatorClass = 'operational';
            break;
        case 'degraded':
            statusMessage = 'Some services not connected';
            iconName = 'alert-triangle';
            iconColor = '#f59e0b';
            indicatorClass = 'degraded';
            break;
        case 'down':
            statusMessage = 'Critical services down';
            iconName = 'x-circle';
            iconColor = '#ef4444';
            indicatorClass = 'down';
            break;
        default:
            statusMessage = 'Checking status...';
            iconName = 'activity';
            iconColor = '#6b7280';
            indicatorClass = 'checking';
    }

    if (statusText) {statusText.textContent = statusMessage;}
    if (statusIcon) {
        statusIcon.setAttribute('data-lucide', iconName);
        statusIcon.style.color = iconColor;
    }
    if (statusIndicator) {
        statusIndicator.className = `status-indicator ${indicatorClass}`;
    }

    // Update timestamp
    if (statusTime && health.timestamp) {
        const timestamp = new Date(health.timestamp);
        const now = new Date();
        const diffMs = now - timestamp;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);

        let timeText = '';
        if (diffSec < 60) {
            timeText = `Updated ${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
        } else if (diffMin < 60) {
            timeText = `Updated ${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        } else {
            timeText = `Updated at ${timestamp.toLocaleTimeString()}`;
        }
        statusTime.textContent = timeText;
    }

    // Update service details
    if (servicesContainer && health.services) {
        servicesContainer.innerHTML = '';

        const serviceNames = {
            database: 'Database',
            googleDrive: 'Google Drive',
            googleCalendar: 'Google Calendar',
            googleAnalytics: 'Google Analytics'
        };

        Object.entries(health.services).forEach(([key, service]) => {
            const serviceItem = document.createElement('div');
            serviceItem.className = 'service-status-item';

            const statusBadgeClass = service.status === 'operational' ? 'operational' :
                                    service.status === 'not_connected' ? 'not_connected' : 'error';

            const responseTime = service.responseTime ? `${service.responseTime}ms` : 'N/A';

            serviceItem.innerHTML = `
                <div class="service-status-info">
                    <span class="service-status-icon ${statusBadgeClass}"></span>
                    <span class="service-status-name">${serviceNames[key] || key}</span>
                </div>
                <div class="service-status-details">
                    <span class="service-status-badge ${statusBadgeClass}">${service.status.replace('_', ' ')}</span>
                    <span class="service-status-time-badge">${responseTime}</span>
                </div>
            `;

            servicesContainer.appendChild(serviceItem);
        });
    }

    lucide.createIcons();
}

