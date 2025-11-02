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
            if (notif.type === 'memo_sent' || notif.type === 'memo_received') {
                iconName = 'file-text';
            } else if (notif.type === 'user_deleted') {
                iconName = 'user-minus';
            } else if (notif.type === 'password_reset') {
                iconName = 'key';
            } else if (notif.type === 'welcome_email') {
                iconName = 'mail';
            } else if (notif.type === 'pending_memo') {
                iconName = 'clock';
            } else if (notif.type === 'memo_approved') {
                iconName = 'check-circle';
            } else if (notif.type === 'memo_rejected') {
                iconName = 'x-circle';
            }

            // For memo notifications, use data attributes to identify them
            const isMemoNotification = notif.type === 'memo_received' || notif.type === 'memo_sent';

            return `
                <div class="notification-item ${notif.isRead ? '' : 'unread'}" data-id="${notif.id}" data-memo-id="${isMemoNotification ? notif.id : ''}" data-notification-type="${notif.type}">
                    <div class="notification-icon">
                        <i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title || 'Notification'}</div>
                        <div class="notification-message">${notif.message || ''}</div>
                        <div class="notification-meta">
                            ${notif.sender ? `<span>From: ${notif.sender.name}</span>` : ''}
                            ${notif.hasAttachments ? `<span>📎 Attachment</span>` : ''}
                            ${notif.sender || notif.hasAttachments ? '<span>•</span>' : ''}
                            <span class="notification-time">${formatTime(notif.timestamp)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Handle click on notification items
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const id = item.dataset.id;
                const memoId = item.dataset.memoId;
                const notificationType = item.dataset.notificationType;

                // eslint-disable-next-line no-console
                console.log('Notification clicked:', { id, memoId, notificationType });

                // Mark as read
                await markAsRead(id);

                // For memo notifications, open modal
                if (memoId && (notificationType === 'memo_received' || notificationType === 'memo_sent')) {
                    // eslint-disable-next-line no-console
                    console.log('Opening memo modal with ID:', memoId);
                    try {
                        await openMemoModal(memoId);
                        // eslint-disable-next-line no-console
                        console.log('openMemoModal call completed');
                    } catch (modalError) {
                        // eslint-disable-next-line no-console
                        console.error('Error in openMemoModal:', modalError);
                        // Fallback to navigation
                        window.location.href = `/admin/log?memo=${memoId}`;
                    }
                } else {
                    // For other notifications, navigate to log
                    // eslint-disable-next-line no-console
                    console.log('Navigating to log page');
                    window.location.href = '/admin/log';
                }
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

    // Function to open memo in modal
    async function openMemoModal(memoId) {
        // eslint-disable-next-line no-console
        console.log('Opening memo modal for ID:', memoId);

        if (!memoId) {
            // eslint-disable-next-line no-console
            console.error('No memo ID provided');
            return;
        }

        try {
            // Fetch memo data
            // eslint-disable-next-line no-console
            console.log('Fetching memo from API:', `/api/log/memos/${memoId}`);
            const response = await fetch(`/api/log/memos/${memoId}`);
            const data = await response.json();

            // eslint-disable-next-line no-console
            console.log('API Response:', data);

            if (!data.success || !data.memo) {
                // eslint-disable-next-line no-console
                console.error('Memo not found:', memoId, data);
                // Fallback to navigation
                window.location.href = `/admin/log?memo=${memoId}`;
                return;
            }

            const memo = data.memo;
            // eslint-disable-next-line no-console
            console.log('Memo fetched:', memo);

            // Create or get memo modal
            let memoModal = document.getElementById('notificationMemoModal');
            if (!memoModal) {
                // eslint-disable-next-line no-console
                console.log('Creating new memo modal');
                memoModal = createMemoModal();
            } else {
                // eslint-disable-next-line no-console
                console.log('Using existing memo modal');
            }

            // Populate modal with memo data
            populateMemoModal(memo, memoModal);

            // Show modal - force visibility with !important
            memoModal.style.setProperty('display', 'flex', 'important');
            memoModal.style.setProperty('visibility', 'visible', 'important');
            memoModal.style.setProperty('opacity', '1', 'important');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling

            // Verify modal is visible
            // eslint-disable-next-line no-console
            console.log('Modal displayed, checking visibility:', {
                display: memoModal.style.display,
                computedDisplay: window.getComputedStyle(memoModal).display,
                visibility: window.getComputedStyle(memoModal).visibility,
                zIndex: window.getComputedStyle(memoModal).zIndex
            });

            // Force a reflow to ensure display
            void memoModal.offsetHeight;

            // Close notification dropdown
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching memo:', error);
            // Fallback to navigation
            window.location.href = `/admin/log?memo=${memoId}`;
        }
    }

    // Create memo modal structure
    function createMemoModal() {
        const modal = document.createElement('div');
        modal.id = 'notificationMemoModal';
        modal.className = 'notification-memo-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            overflow-y: auto;
        `;

        modal.innerHTML = `
            <div class="notification-memo-content" style="
                background: white;
                border-radius: 12px;
                max-width: 800px;
                width: 100%;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            ">
                <div class="notification-memo-header" style="
                    padding: 1.5rem;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                ">
                    <h2 id="notificationMemoSubject" style="margin: 0; font-size: 1.25rem; font-weight: 600; color: #111827;"></h2>
                    <button id="closeNotificationMemoModal" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        color: #6b7280;
                        cursor: pointer;
                        padding: 0.5rem;
                        line-height: 1;
                        border-radius: 6px;
                        transition: all 0.2s;
                    ">&times;</button>
                </div>
                <div class="notification-memo-body" style="
                    padding: 1.5rem;
                    overflow-y: auto;
                    flex: 1;
                ">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                        <img id="notificationMemoSenderAvatar" src="/images/memofy-logo.png" alt="Sender" style="
                            width: 48px;
                            height: 48px;
                            border-radius: 50%;
                            object-fit: cover;
                            border: 2px solid #e5e7eb;
                        " />
                        <div style="flex: 1;">
                            <div id="notificationMemoSenderName" style="font-weight: 600; color: #111827; font-size: 0.9375rem;"></div>
                            <div id="notificationMemoSenderEmail" style="color: #6b7280; font-size: 0.8125rem; margin-top: 0.25rem;"></div>
                        </div>
                        <div id="notificationMemoDate" style="color: #9ca3af; font-size: 0.8125rem; text-align: right;"></div>
                    </div>
                    <div id="notificationMemoBodyContent" style="
                        color: #111827;
                        line-height: 1.6;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    "></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close button handler
        const closeBtn = modal.querySelector('#closeNotificationMemoModal');
        closeBtn.addEventListener('click', closeMemoModal);

        // Hover effect for close button
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = '#f3f4f6';
            closeBtn.style.color = '#111827';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
            closeBtn.style.color = '#6b7280';
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeMemoModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeMemoModal();
            }
        });

        return modal;
    }

    // Populate memo modal with data
    function populateMemoModal(memo, modal) {
        // Subject
        const subjectEl = modal.querySelector('#notificationMemoSubject');
        if (subjectEl) {
            subjectEl.textContent = memo.subject || 'Memo';
        }

        // Sender info
        const senderNameEl = modal.querySelector('#notificationMemoSenderName');
        const senderEmailEl = modal.querySelector('#notificationMemoSenderEmail');
        const senderAvatarEl = modal.querySelector('#notificationMemoSenderAvatar');

        if (senderNameEl) {
            const senderName = memo.sender
                ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim()
                : 'Unknown Sender';
            senderNameEl.textContent = senderName;
        }

        if (senderEmailEl) {
            senderEmailEl.textContent = memo.sender?.email || '';
        }

        if (senderAvatarEl) {
            senderAvatarEl.src = memo.sender?.profilePicture || '/images/memofy-logo.png';
        }

        // Date
        const dateEl = modal.querySelector('#notificationMemoDate');
        if (dateEl && memo.createdAt) {
            const date = new Date(memo.createdAt);
            dateEl.textContent = date.toLocaleString();
        }

        // Content
        const bodyContentEl = modal.querySelector('#notificationMemoBodyContent');
        if (bodyContentEl) {
            let htmlContent = '';

            // Text content
            if (memo.content && memo.content.trim()) {
                const safeContent = memo.content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                htmlContent += `<div style="white-space: pre-wrap; margin-bottom: ${memo.attachments && memo.attachments.length > 0 ? '1.5rem' : '0'}; line-height: 1.6;">${safeContent}</div>`;
            } else {
                htmlContent += `<div style="color: #9ca3af; font-style: italic; margin-bottom: ${memo.attachments && memo.attachments.length > 0 ? '1.5rem' : '0'};">No text content</div>`;
            }

            // Attachments
            if (memo.attachments && memo.attachments.length > 0) {
                htmlContent += '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1rem;">';

                memo.attachments.forEach((attachment) => {
                    const attachmentUrl = attachment.url || `/uploads/${attachment.filename}`;
                    const isPDF = attachment.mimetype === 'application/pdf';
                    const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

                    // Helper function to format file size
                    function formatFileSize(bytes) {
                        if (!bytes || bytes === 0) return '0 B';
                        const k = 1024;
                        const sizes = ['B', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                    }

                    if (isPDF || !isImage) {
                        htmlContent += `
                            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 13px;">
                                <i data-lucide="${isPDF ? 'file-text' : 'paperclip'}" style="width: 16px; height: 16px; color: #6b7280;"></i>
                                <a href="${attachmentUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">${attachment.filename}</a>
                                <span style="font-size: 12px; color: #6b7280;">(${formatFileSize(attachment.size || 0)})</span>
                            </div>
                        `;
                    } else if (isImage) {
                        htmlContent += `
                            <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
                                <img src="${attachmentUrl}" alt="${attachment.filename}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;" onclick="window.open('${attachmentUrl}', '_blank')" />
                                <div style="margin-top: 0.5rem; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">
                                    <i data-lucide="image" style="width: 16px; height: 16px; color: #6b7280;"></i>
                                    <a href="${attachmentUrl}" target="_blank" style="font-size: 13px; color: #2563eb; text-decoration: none; font-weight: 500;">${attachment.filename}</a>
                                    <span style="font-size: 12px; color: #6b7280;">(${formatFileSize(attachment.size || 0)})</span>
                                </div>
                            </div>
                        `;
                    }
                });

                htmlContent += '</div>';
            }

            bodyContentEl.innerHTML = htmlContent || '<div style="color: #9ca3af;">No content available</div>';

            // Reinitialize icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }

    // Close memo modal
    function closeMemoModal() {
        const modal = document.getElementById('notificationMemoModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    // Fetch notifications on page load
    fetchNotifications();

    // Refresh notifications every 30 seconds
    setInterval(fetchNotifications, 30000);
});

