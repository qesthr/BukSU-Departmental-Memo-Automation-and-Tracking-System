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

    lucide.createIcons();
});

function updateStatCards(stats) {
    // Update Total Memos Sent
    const totalMemosElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (totalMemosElement) {
        totalMemosElement.textContent = stats.memos.totalSent.toLocaleString();
        // Add percentage change if available
        const changeElement = totalMemosElement.parentElement.querySelector('.stat-change');
        if (changeElement) {
            changeElement.textContent = '+0% from last month'; // Can be calculated from historical data
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

        memoItem.innerHTML = `
            <i data-lucide="${iconName}" class="memo-icon ${memo.type}"></i>
            <div class="memo-info">
                <h4>${memo.title}</h4>
                <p>${memo.department}</p>
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

