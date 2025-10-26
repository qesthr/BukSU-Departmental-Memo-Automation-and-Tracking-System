// Notification Bell Functionality
document.addEventListener('DOMContentLoaded', () => {
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationDropdown = document.getElementById('notificationDropdown');

    let notifications = [];
    let unreadCount = 0;

    // Check if notification button exists
    if (!notificationBtn) {
        // eslint-disable-next-line no-console
        console.warn('Notification button not found');
        return;
    }

    // Create dropdown if it doesn't exist
    if (!notificationDropdown) {
        const dropdown = document.createElement('div');
        dropdown.id = 'notificationDropdown';
        dropdown.className = 'notification-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            width: 400px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-height: 600px;
            overflow: hidden;
            display: none;
            z-index: 1000;
            margin-top: 0.5rem;
        `;
        dropdown.innerHTML = `
            <div class="notification-header" style="padding: 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b;">Notifications</h3>
                <button id="markAllReadBtn" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #f1f5f9; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; color: #64748b; transition: all 0.2s;">
                    <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                    <span>Mark All Read</span>
                </button>
            </div>
            <div class="notification-list" id="notificationList" style="max-height: 450px; overflow-y: auto;"></div>
            <div class="notification-footer">
                <a href="/admin/log" style="display: block; padding: 1rem; text-align: center; color: #1C89E3; text-decoration: none; border-top: 1px solid #e2e8f0; font-weight: 500;">View all in Log</a>
            </div>
        `;

        // Insert dropdown - append to header-actions container
        const headerActions = notificationBtn.closest('.header-actions');
        if (headerActions) {
            // Make container relative for positioning
            headerActions.style.position = 'relative';
            headerActions.appendChild(dropdown);
        } else {
            // Fallback: append to body
            document.body.appendChild(dropdown);
        }

        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .notification-badge {
                position: absolute;
                top: -2px;
                right: -2px;
                background: #dc2626;
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                font-size: 0.7rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
            }

            .notification-btn {
                position: relative;
            }

            .notification-item {
                padding: 1rem 1.25rem;
                border-bottom: 1px solid #e2e8f0;
                cursor: pointer;
                transition: background 0.2s;
                position: relative;
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
            }

            .notification-item:hover {
                background: #f8fafc;
            }

            .notification-item.unread {
                background: #f0f9ff;
            }

            .notification-item.unread::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                background: #1C89E3;
            }

            .notification-icon {
                flex-shrink: 0;
                width: 40px;
                height: 40px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f1f5f9;
                color: #1C89E3;
            }

            .notification-content {
                flex: 1;
            }

            .notification-title {
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 0.25rem;
                font-size: 0.875rem;
            }

            .notification-message {
                font-size: 0.8125rem;
                color: #64748b;
                margin-bottom: 0.5rem;
                line-height: 1.4;
            }

            .notification-meta {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.75rem;
                color: #94a3b8;
            }

            .notification-time {
                font-size: 0.75rem;
                color: #94a3b8;
            }

            #notificationList::-webkit-scrollbar {
                width: 6px;
            }

            #notificationList::-webkit-scrollbar-track {
                background: transparent;
            }

            #notificationList::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 3px;
            }

            #notificationList::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
        `;
        document.head.appendChild(style);
    }

    // Toggle dropdown
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                if (dropdown.style.display === 'block') {
                    fetchNotifications();
                }
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-btn') && !e.target.closest('#notificationDropdown')) {
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        }
    });

    // Fetch notifications
    async function fetchNotifications() {
        try {
            const response = await fetch('/api/log/notifications');
            const data = await response.json();

            if (data.success) {
                notifications = data.notifications;
                unreadCount = data.unreadCount;
                updateBadge();
                renderNotifications();
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching notifications:', error);
        }
    }

    // Update badge count
    function updateBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Render notifications
    function renderNotifications() {
        const list = document.getElementById('notificationList');
        if (!list) {
            return;
        }

        if (notifications.length === 0) {
            list.innerHTML = `
                <div style="padding: 3rem 2rem; text-align: center; color: #64748b;">
                    <i data-lucide="bell-off" style="width: 64px; height: 64px; color: #cbd5e1; margin: 0 auto 1rem; display: block;"></i>
                    <p style="margin: 0; font-size: 0.875rem;">No new notifications</p>
                </div>
            `;
            if (window.lucide) {
                window.lucide.createIcons();
            }
            return;
        }

        list.innerHTML = notifications.map(notif => {
            // Determine icon based on activity type
            let iconName = 'bell';
            if (notif.type === 'memo_sent') {
                iconName = 'file-text';
            }
            if (notif.type === 'user_deleted') {
                iconName = 'user-minus';
            }
            if (notif.type === 'password_reset') {
                iconName = 'key';
            }
            if (notif.type === 'welcome_email') {
                iconName = 'mail';
            }

            return `
                <div class="notification-item ${notif.isRead ? '' : 'unread'}" data-id="${notif.id}" onclick="window.location.href='/admin/log'">
                    <div class="notification-icon">
                        <i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title}</div>
                        <div class="notification-message">${notif.message}</div>
                        <div class="notification-meta">
                            ${notif.sender ? `<span>From: ${notif.sender.name}</span>` : ''}
                            <span>•</span>
                            <span class="notification-time">${formatTime(notif.timestamp)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Mark as read when clicked
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                await markAsRead(id);
            });
        });
    }

    // Mark all as read functionality
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Mark all unread notifications as read
                const unreadNotifications = notifications.filter(n => !n.isRead);
                const promises = unreadNotifications.map(notif => markAsRead(notif.id));
                await Promise.all(promises);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error marking all as read:', error);
            }
        });
    }

    // Mark notification as read
    async function markAsRead(id) {
        try {
            await fetch(`/api/log/notifications/${id}/read`, { method: 'PUT' });
            unreadCount = Math.max(0, unreadCount - 1);
            updateBadge();
            const item = document.querySelector(`.notification-item[data-id="${id}"]`);
            if (item) {
                item.classList.remove('unread');
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error marking notification as read:', error);
        }
    }

    // Format timestamp
    function formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;

        if (diff < 60000) {
            return 'Just now';
        }
        if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}m ago`;
        }
        if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}h ago`;
        }
        if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)}d ago`;
        }
        return time.toLocaleDateString();
    }

    // Fetch notifications on page load
    fetchNotifications();

    // Refresh notifications every 30 seconds
    setInterval(fetchNotifications, 30000);
});

