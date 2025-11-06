/**
 * Google Analytics Integration
 * Handles connection, data fetching, and visualization
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeAnalytics();
});

const analyticsData = {
    isConnected: false,
    propertyId: null,
    dateRange: 30
};

/**
 * Initialize analytics page
 */
async function initializeAnalytics() {
    try {
        // Check connection status
        await checkConnectionStatus();

        // Set up event listeners
        setupEventListeners();

        // Load data if connected
        if (analyticsData.isConnected) {
            await loadAnalyticsData();
        }
    } catch (error) {
        console.error('Error initializing analytics:', error);
        updateConnectionStatus(false, 'Error initializing');
    }
}

/**
 * Check Google Analytics connection status
 */
async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/analytics/status', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to check connection status');
        }

        const data = await response.json();
        analyticsData.isConnected = data.connected;
        analyticsData.propertyId = data.propertyId;

        updateConnectionStatus(data.connected, data.connected ? 'Connected' : 'Not connected');

        return data;
    } catch (error) {
        console.error('Error checking connection status:', error);
        updateConnectionStatus(false, 'Error checking status');
        return { connected: false };
    }
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(connected, message) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectGABtn');

    if (statusDot && statusText) {
        statusDot.className = 'status-dot';
        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = `Connected${analyticsData.propertyId ? ` (${analyticsData.propertyId})` : ''}`;
            if (connectBtn) {connectBtn.style.display = 'none';}
        } else {
            statusDot.classList.add('error');
            statusText.textContent = message || 'Not connected';
            if (connectBtn) {connectBtn.style.display = 'inline-flex';}
        }
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Connect button
    const connectBtn = document.getElementById('connectGABtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            document.getElementById('gaSetupModal').style.display = 'flex';
        });
    }

    // Setup form
    const setupForm = document.getElementById('gaSetupForm');
    if (setupForm) {
        setupForm.addEventListener('submit', handleSetupForm);
    }

    // Date range selector
    const dateRange = document.getElementById('dateRange');
    if (dateRange) {
        dateRange.addEventListener('change', handleDateRangeChange);
    }

    // Apply custom date range
    const applyDateRange = document.getElementById('applyDateRange');
    if (applyDateRange) {
        applyDateRange.addEventListener('click', handleApplyDateRange);
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadAnalyticsData());
    }

    // Export button
    const exportBtn = document.getElementById('exportReportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }

    // Activity metric selector
    const activityMetric = document.getElementById('activityMetric');
    if (activityMetric) {
        activityMetric.addEventListener('change', () => loadAnalyticsData());
    }

    // Close modal handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Check URL parameters for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
        setTimeout(() => {
            checkConnectionStatus().then(() => loadAnalyticsData());
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1000);
    }
    if (urlParams.get('error')) {
        updateConnectionStatus(false, 'Connection failed');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Handle setup form submission
 */
async function handleSetupForm(e) {
    e.preventDefault();

    const clientId = document.getElementById('gaClientId').value;
    const clientSecret = document.getElementById('gaClientSecret').value;
    const propertyId = document.getElementById('gaPropertyId').value;

    try {
        // Store credentials
        const response = await fetch('/api/analytics/credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                clientId,
                clientSecret,
                propertyId
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to store credentials');
        }

        // Start OAuth flow
        window.location.href = '/analytics/auth';

    } catch (error) {
        console.error('Error setting up Google Analytics:', error);
        alert('Failed to set up Google Analytics: ' + error.message);
    }
}

/**
 * Handle date range change
 */
function handleDateRangeChange(e) {
    const value = e.target.value;

    if (value === 'custom') {
        document.getElementById('customDateRange').style.display = 'flex';
    } else {
        document.getElementById('customDateRange').style.display = 'none';
        analyticsData.dateRange = parseInt(value);
        loadAnalyticsData();
    }
}

/**
 * Handle apply custom date range
 */
function handleApplyDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
    }

    analyticsData.startDate = startDate;
    analyticsData.endDate = endDate;
    loadAnalyticsData();
}

/**
 * Get date range based on selection
 */
function getDateRange() {
    if (analyticsData.startDate && analyticsData.endDate) {
        return {
            startDate: analyticsData.startDate,
            endDate: analyticsData.endDate
        };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - analyticsData.dateRange);

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}

/**
 * Load analytics data (both Google Analytics and Database)
 */
async function loadAnalyticsData() {
    try {
        const { startDate, endDate } = getDateRange();

        // Always load database statistics (these are always available)
        await loadDatabaseStats();
        await loadDatabaseCharts(startDate, endDate);
        await loadRecentActivity();

        // Load Google Analytics data if connected (silently handle errors)
        if (analyticsData.isConnected) {
            try {
                await loadRealtimeData();
            } catch (error) {
                console.log('Google Analytics realtime data not available');
            }

            try {
                await loadActivityChart(startDate, endDate);
            } catch (error) {
                console.log('Google Analytics activity chart not available');
            }

            try {
                await loadTopPages(startDate, endDate);
            } catch (error) {
                console.log('Google Analytics top pages not available');
            }

            try {
                await loadStats(startDate, endDate);
            } catch (error) {
                console.log('Google Analytics stats not available');
            }
        }

    } catch (error) {
        console.error('Error loading analytics data:', error);
        showError('Failed to load analytics data: ' + error.message);
    }
}

/**
 * Load real-time data
 */
async function loadRealtimeData() {
    try {
        const response = await fetch('/api/analytics/realtime', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();

            // Check if Google Analytics is not connected
            if (data.message && data.message.includes('not connected')) {
                const activeUsersEl = document.getElementById('activeUsers');
                if (activeUsersEl) {
                    activeUsersEl.textContent = '0';
                }
                return;
            }

            // Check if there's an error
            if (data.error) {
                console.log('Google Analytics realtime error:', data.error);
                const activeUsersEl = document.getElementById('activeUsers');
                if (activeUsersEl) {
                    activeUsersEl.textContent = '0';
                }
                return;
            }

            const activeUsersEl = document.getElementById('activeUsers');
            if (activeUsersEl) {
                activeUsersEl.textContent = data.activeUsers || '0';
            }
        }
    } catch (error) {
        console.error('Error loading real-time data:', error);
        // Silently fail - realtime data is optional
        const activeUsersEl = document.getElementById('activeUsers');
        if (activeUsersEl) {
            activeUsersEl.textContent = '0';
        }
    }
}

/**
 * Load activity chart
 */
async function loadActivityChart(startDate, endDate) {
    try {
        // Map UI select values to GA4 metric API names and display labels
        const selected = document.getElementById('activityMetric')?.value || 'users';
        const metricMap = {
            users: { api: 'activeUsers', label: 'Active Users' },
            sessions: { api: 'sessions', label: 'Sessions' },
            pageviews: { api: 'screenPageViews', label: 'Page Views' }
        };
        const mapped = metricMap[selected] || metricMap.users;
        const response = await fetch(
            `/api/analytics/activity?startDate=${startDate}&endDate=${endDate}&metric=${mapped.api}`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load activity data`);
        }

        const data = await response.json();

        // Check if Google Analytics is not connected
        if (data.message && data.message.includes('not connected')) {
            showChartError('activityChart', 'Google Analytics not connected');
            return;
        }

        // Check if there's an error in the response
        if (data.error) {
            let errorMessage = data.error || 'Failed to load activity data';

            // Check if API is not enabled
            if (errorMessage.includes('not enabled') || errorMessage.includes('has not been used')) {
                errorMessage = 'Google Analytics Data API not enabled. Please enable it in Google Cloud Console.';
            }

            showChartError('activityChart', errorMessage);
            return;
        }

        // Check if data is empty
        if (!data.rows || data.rows.length === 0) {
            showChartError('activityChart', 'No activity data available');
            return;
        }

        drawActivityChart(data, mapped.label);

    } catch (error) {
        console.error('Error loading activity chart:', error);
        showChartError('activityChart', 'Failed to load activity data');
    }
}

/**
 * Draw activity chart using Google Charts
 */
function drawActivityChart(data, yLabel = 'Active Users') {
    if (!google || !google.charts) {
        console.error('Google Charts not loaded');
        showChartError('activityChart', 'Charts library not loaded');
        return;
    }

    const chartElement = document.getElementById('activityChart');
    if (!chartElement) {
        console.error('Activity chart element not found');
        return;
    }

    google.charts.setOnLoadCallback(() => {
        try {
            const chartData = new google.visualization.DataTable();
            chartData.addColumn('date', 'Date');
            chartData.addColumn('number', yLabel);

            if (data.rows && data.rows.length > 0) {
                data.rows.forEach(row => {
                    try {
                        if (row.dimensionValues && row.dimensionValues[0] && row.metricValues && row.metricValues[0]) {
                            const dateStr = row.dimensionValues[0].value;
                            const date = new Date(dateStr);
                            const value = parseInt(row.metricValues[0].value || 0);

                            if (!isNaN(date.getTime()) && !isNaN(value)) {
                                chartData.addRow([date, value]);
                            }
                        }
                    } catch (rowError) {
                        console.warn('Error processing chart row:', rowError);
                    }
                });
            }

            // If no valid data, show message
            if (chartData.getNumberOfRows() === 0) {
                showChartError('activityChart', 'No data available for selected period');
                return;
            }

            const options = {
                title: 'User Activity Over Time',
                hAxis: { title: 'Date' },
                vAxis: { title: yLabel },
                legend: { position: 'none' },
                chartArea: { width: '80%', height: '70%' }
            };

            const chart = new google.visualization.LineChart(chartElement);
            chart.draw(chartData, options);
        } catch (error) {
            console.error('Error drawing activity chart:', error);
            showChartError('activityChart', 'Error rendering chart');
        }
    });
}

/**
 * Load top pages
 */
async function loadTopPages(startDate, endDate) {
    try {
        const response = await fetch(
            `/api/analytics/top-pages?startDate=${startDate}&endDate=${endDate}&limit=10`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load top pages`);
        }

        const data = await response.json();

        // Check if Google Analytics is not connected
        if (data.message && data.message.includes('not connected')) {
            showChartError('topPagesChart', 'Google Analytics not connected');
            return;
        }

        // Check if there's an error in the response
        if (data.error) {
            showChartError('topPagesChart', data.error || 'Failed to load top pages');
            return;
        }

        // Check if data is empty
        if (!data.rows || data.rows.length === 0) {
            showChartError('topPagesChart', 'No page data available');
            return;
        }

        drawTopPagesChart(data);

    } catch (error) {
        console.error('Error loading top pages:', error);
        showChartError('topPagesChart', 'Failed to load top pages');
    }
}

/**
 * Draw top pages chart
 */
function drawTopPagesChart(data) {
    if (!google || !google.charts) {
        console.error('Google Charts not loaded');
        showChartError('topPagesChart', 'Charts library not loaded');
        return;
    }

    const chartElement = document.getElementById('topPagesChart');
    if (!chartElement) {
        console.error('Top pages chart element not found');
        return;
    }

    google.charts.setOnLoadCallback(() => {
        try {
            const chartData = new google.visualization.DataTable();
            chartData.addColumn('string', 'Page');
            chartData.addColumn('number', 'Page Views');

            if (data.rows && data.rows.length > 0) {
                data.rows.slice(0, 10).forEach(row => {
                    try {
                        if (row.dimensionValues && row.dimensionValues[0] && row.metricValues && row.metricValues[0]) {
                            const page = row.dimensionValues[0].value || 'Unknown';
                            const views = parseInt(row.metricValues[0].value || 0);
                            if (!isNaN(views)) {
                                chartData.addRow([page, views]);
                            }
                        }
                    } catch (rowError) {
                        console.warn('Error processing chart row:', rowError);
                    }
                });
            }

            // If no valid data, show message
            if (chartData.getNumberOfRows() === 0) {
                showChartError('topPagesChart', 'No page data available');
                return;
            }

            const options = {
                title: 'Top Pages',
                chartArea: { width: '70%', height: '70%' }
            };

            const chart = new google.visualization.BarChart(chartElement);
            chart.draw(chartData, options);
        } catch (error) {
            console.error('Error drawing top pages chart:', error);
            showChartError('topPagesChart', 'Error rendering chart');
        }
    });
}

/**
 * Load stats
 */
async function loadStats(startDate, endDate) {
    try {
        const response = await fetch(
            `/api/analytics/data?startDate=${startDate}&endDate=${endDate}&metrics=activeUsers,screenPageViews,sessions`,
            { credentials: 'include' }
        );

        if (response.ok) {
            const data = await response.json();

            // Check if Google Analytics is not connected
            if (data.message && data.message.includes('not connected')) {
                // Keep existing values or show default
                return;
            }

            // Check if there's an error
            if (data.error) {
                console.log('Google Analytics stats error:', data.error);
                return;
            }

            // Update stats cards
            if (data.rows && data.rows.length > 0) {
                const metrics = data.rows[0].metricValues;
                const pageViewsEl = document.getElementById('pageViews');
                if (pageViewsEl && metrics && metrics[1]) {
                    pageViewsEl.textContent = parseInt(metrics[1].value || 0).toLocaleString();
                }
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Silently fail - stats are optional
    }
}

/**
 * Show chart error
 */
function showChartError(chartId, message) {
    const chartEl = document.getElementById(chartId);
    if (chartEl) {
        chartEl.innerHTML = `<div class="loading-state">${message}</div>`;
    }
}

/**
 * Show error message
 */
function showError(message) {
    // You can implement a toast notification here
    console.error(message);
}

/**
 * Load database statistics
 */
async function loadDatabaseStats() {
    try {
        // Get DOM elements first
        const totalUsersEl = document.getElementById('totalUsers');
        const totalMemosEl = document.getElementById('totalMemos');

        // Load overall stats
        const statsResponse = await fetch('/api/analytics/db/stats', {
            credentials: 'include'
        });

        if (statsResponse.ok) {
            const stats = await statsResponse.json();

            // Update stats cards
            if (totalUsersEl) {
                totalUsersEl.textContent = stats.totalUsers || 0;
            }
            if (totalMemosEl) {
                totalMemosEl.textContent = stats.totalMemos || 0;
            }
        }

        // Load memo stats for date range
        const { startDate, endDate } = getDateRange();
        const memosResponse = await fetch(
            `/api/analytics/db/memos?startDate=${startDate}&endDate=${endDate}`,
            { credentials: 'include' }
        );

        if (memosResponse.ok) {
            const memoStats = await memosResponse.json();

            // Update memo-related stats (use the date range specific count)
            if (totalMemosEl && memoStats.total !== undefined) {
                totalMemosEl.textContent = memoStats.total.toLocaleString();
            }
        }

    } catch (error) {
        console.error('Error loading database stats:', error);
    }
}

/**
 * Load database charts
 */
async function loadDatabaseCharts(startDate, endDate) {
    try {
        // Load memos over time
        await loadMemosOverTimeChart(startDate, endDate);

        // Load department chart
        await loadDepartmentChart(startDate, endDate);

        // Load memo statistics chart
        await loadMemoStatsChart(startDate, endDate);

    } catch (error) {
        console.error('Error loading database charts:', error);
    }
}

/**
 * Load memos over time chart
 */
async function loadMemosOverTimeChart(startDate, endDate) {
    try {
        const response = await fetch(
            `/api/analytics/db/memos-over-time?startDate=${startDate}&endDate=${endDate}`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error('Failed to load memos over time');
        }

        const data = await response.json();
        drawMemosOverTimeChart(data);

    } catch (error) {
        console.error('Error loading memos over time:', error);
        showChartError('memoChart', 'Failed to load memo statistics');
    }
}

/**
 * Draw memos over time chart
 */
function drawMemosOverTimeChart(data) {
    if (!google || !google.charts) {
        console.error('Google Charts not loaded');
        return;
    }

    google.charts.setOnLoadCallback(() => {
        const chartData = new google.visualization.DataTable();
        chartData.addColumn('date', 'Date');
        chartData.addColumn('number', 'Memos');

        if (data && data.length > 0) {
            data.forEach(item => {
                const date = new Date(item._id);
                const count = item.count || 0;
                chartData.addRow([date, count]);
            });
        }

        const options = {
            title: 'Memos Created Over Time',
            hAxis: { title: 'Date' },
            vAxis: { title: 'Number of Memos' },
            legend: { position: 'none' },
            chartArea: { width: '80%', height: '70%' }
        };

        const chart = new google.visualization.LineChart(
            document.getElementById('memoChart')
        );
        chart.draw(chartData, options);
    });
}

/**
 * Load department chart
 */
async function loadDepartmentChart(startDate, endDate) {
    try {
        const response = await fetch(
            `/api/analytics/db/memos-by-department?startDate=${startDate}&endDate=${endDate}`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error('Failed to load department data');
        }

        const data = await response.json();
        drawDepartmentChart(data);

    } catch (error) {
        console.error('Error loading department chart:', error);
        showChartError('departmentChart', 'Failed to load department data');
    }
}

/**
 * Draw department chart
 */
function drawDepartmentChart(data) {
    if (!google || !google.charts) {
        console.error('Google Charts not loaded');
        return;
    }

    google.charts.setOnLoadCallback(() => {
        const chartData = new google.visualization.DataTable();
        chartData.addColumn('string', 'Department');
        chartData.addColumn('number', 'Memos');

        if (data && data.length > 0) {
            data.forEach(item => {
                const dept = item._id || 'Admin';
                const count = item.count || 0;
                chartData.addRow([dept, count]);
            });
        }

        const options = {
            title: 'Memos by Department',
            chartArea: { width: '70%', height: '70%' },
            hAxis: { title: 'Number of Memos' },
            vAxis: { title: 'Department' }
        };

        const chart = new google.visualization.BarChart(
            document.getElementById('departmentChart')
        );
        chart.draw(chartData, options);
    });
}

/**
 * Load memo statistics chart
 */
async function loadMemoStatsChart(startDate, endDate) {
    try {
        const response = await fetch(
            `/api/analytics/db/memos?startDate=${startDate}&endDate=${endDate}`,
            { credentials: 'include' }
        );

        if (response.ok) {
            const data = await response.json();
            // Update any additional stats displays if needed
        }
    } catch (error) {
        console.error('Error loading memo stats chart:', error);
    }
}

/**
 * Load recent activity
 */
async function loadRecentActivity() {
    try {
        const response = await fetch('/api/analytics/db/activity?limit=50', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load recent activity');
        }

        const activities = await response.json();
        displayRecentActivity(activities);

    } catch (error) {
        console.error('Error loading recent activity:', error);
        const tbody = document.getElementById('activityTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-state">Failed to load activity</td></tr>';
        }
    }
}

/**
 * Display recent activity in table
 */
function displayRecentActivity(activities) {
    const tbody = document.getElementById('activityTableBody');
    if (!tbody) {return;}

    if (!activities || activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-state">No activity found</td></tr>';
        return;
    }

    tbody.innerHTML = activities.map(activity => {
        const date = new Date(activity.date).toLocaleDateString();
        const senderName = activity.sender ? activity.sender.name : 'Unknown';
        const recipientName = activity.recipient ? activity.recipient.name : 'Unknown';
        const action = activity.status === 'sent' ? 'Sent' :
                      activity.status === 'read' ? 'Read' :
                      activity.status === 'pending' ? 'Pending' : activity.status;
        const department = activity.department || activity.sender?.department || 'Admin';

        return `
            <tr>
                <td>${date}</td>
                <td>${senderName}</td>
                <td>${action}</td>
                <td>${department}</td>
                <td><span class="status-badge status-${activity.status}">${action}</span></td>
            </tr>
        `;
    }).join('');
}

/**
 * Handle export
 */
async function handleExport() {
    try {
        const { startDate, endDate } = getDateRange();

        // Show loading state
        const exportBtn = document.getElementById('exportReportBtn');
        const originalText = exportBtn?.querySelector('span')?.textContent;
        if (exportBtn) {
            exportBtn.disabled = true;
            const span = exportBtn.querySelector('span');
            if (span) {span.textContent = 'Generating PDF...';}
        }

        // Generate PDF
        const url = `/api/analytics/export/pdf?startDate=${startDate}&endDate=${endDate}`;

        // Fetch PDF and create blob for download
        const response = await fetch(url, {
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
            throw new Error(error.message || 'Failed to generate PDF');
        }

        // Get PDF blob
        const blob = await response.blob();

        // Create download link
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Memofy-Report-${startDate}-to-${endDate}.pdf`;
        document.body.appendChild(link);
        link.click();

        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

        // Reset button state after a delay
        setTimeout(() => {
            if (exportBtn) {
                exportBtn.disabled = false;
                const span = exportBtn.querySelector('span');
                if (span && originalText) {span.textContent = originalText;}
            }
        }, 1000);

    } catch (error) {
        console.error('Error exporting report:', error);
        alert('Failed to export report: ' + error.message);

        // Reset button state
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
            const span = exportBtn.querySelector('span');
            if (span) {span.textContent = 'Export Report';}
        }
    }
}

// Export functions for use in other scripts
window.analyticsJS = {
    checkConnectionStatus,
    loadAnalyticsData,
    connectGoogleAnalytics: () => {
        document.getElementById('gaSetupModal').style.display = 'flex';
    }
};

