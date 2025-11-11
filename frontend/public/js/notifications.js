// Notification Bell Functionality
(function() {
    // Initialize notifications - handle both cases: DOM already loaded or not
    function initNotifications() {
        console.log('🔔 Initializing notifications...');
        const notificationBtn = document.querySelector('.notification-btn');
        const notificationDropdown = document.getElementById('notificationDropdown');

        let notifications = [];
        let unreadCount = 0;
        let currentTab = 'memos'; // 'memos' | 'audit'

        // Check if notification button exists
        if (!notificationBtn) {
            // eslint-disable-next-line no-console
            console.warn('⚠️ Notification button not found');
            return;
        }

        console.log('✅ Notification button found:', notificationBtn);

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
                <div class="notif-tabs" style="display:flex; gap:.5rem; padding:.5rem 1rem; border-bottom:1px solid #e2e8f0;">
                    <button id="notifTabMemos" class="notif-tab active" style="padding:.4rem .65rem; border:none; background:#eef2f7; border-radius:6px; font-size:.85rem; cursor:pointer;">For You</button>
                    <button id="notifTabAudit" class="notif-tab" style="padding:.4rem .65rem; border:none; background:transparent; border-radius:6px; font-size:.85rem; cursor:pointer;">System Activity</button>
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

            .notification-btn i,
            .notification-btn svg {
                pointer-events: none;
                user-select: none;
            }

            .notification-badge {
                pointer-events: none;
                user-select: none;
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
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f1f5f9;
                color: #1C89E3;
            }

            .notification-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                display: block;
                border: 1px solid #e2e8f0;
                background: #fff;
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
        console.log('🔔 Setting up click handler for notification button');
        // Handle clicks on button and any child elements (icon, badge)
        // Using capture phase to ensure we catch the event early
        notificationBtn.addEventListener('click', (e) => {
            console.log('🔔 Notification button clicked!');
            e.stopPropagation();
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                const isOpen = dropdown.style.display === 'block';
                dropdown.style.display = isOpen ? 'none' : 'block';
                console.log('🔔 Dropdown toggled:', isOpen ? 'closed' : 'opened');
                if (!isOpen) {
                    fetchNotifications();
                }
            }
        }, true); // Use capture phase to catch event before it bubbles
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
            const response = await fetch('/api/log/notifications', {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                // Don't show error if unauthorized - user might not be logged in
                if (response.status === 401) {
                    return; // Silently fail if not authenticated
                }
                throw new Error(`HTTP ${response.status}`);
            }
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

        const filtered = notifications.filter(n => currentTab === 'audit' ? n.type === 'user_log' : n.type !== 'user_log');

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="padding: 3rem 2rem; text-align: center; color: #64748b;">
                    <i data-lucide="bell-off" style="width: 64px; height: 64px; color: #cbd5e1; margin: 0 auto 1rem; display: block;"></i>
                    <p style="margin: 0; font-size: 0.875rem;">No ${currentTab === 'audit' ? 'system activity' : 'notifications'} to show</p>
                </div>
            `;
            if (window.lucide) {
                window.lucide.createIcons();
            }
            return;
        }

        list.innerHTML = filtered.map(notif => {
            // Check if this is a calendar event notification
            const isCalendarEvent = (notif.title && notif.title.includes('Calendar Event')) ||
                                   (notif.title && notif.title.includes('📅'));

            // Determine icon based on activity type
            let iconName = 'bell';
            if (isCalendarEvent) {
                iconName = 'calendar';
            } else if (notif.type === 'memo_sent' || notif.type === 'memo_received') {
                iconName = 'file-text';
            } else if (notif.type === 'user_log') {
                iconName = 'user';
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

            // Extract original memo id for workflow notifications (pending/approved/rejected)
            // The API provides originalMemoId directly, but also check metadata for backward compatibility
            const originalMemoId = notif.originalMemoId || (notif.metadata && (notif.metadata.originalMemoId || notif.metadata.relatedMemoId)) || '';
            const derivedMemoId = notif.memoId || originalMemoId || notif.id;

            // For memo notifications, use data attributes to identify them
            const isMemoNotification = notif.type === 'memo_received' || notif.type === 'memo_sent' || isCalendarEvent || notif.type === 'pending_memo';

            // ALL notifications should have a memoId - use the notification's own ID if no memoId is provided
            // This ensures all notifications can be opened in modals
            const notificationMemoId = derivedMemoId || notif.id;

            // Format calendar event message for dropdown preview
            let displayMessage = notif.message || '';
            if (isCalendarEvent && notif.message) {
                // Parse the calendar event content to extract key info
                // Format: "Title\n\nDate: ...\nTime: ...\nCategory: ...\nDescription: ..."
                const lines = notif.message.split('\n').filter(l => l.trim());
                if (lines.length > 0) {
                    const title = lines[0].trim();
                    // Extract date, time, category from content
                    let dateStr = '';
                    let timeStr = '';
                    let categoryStr = '';

                    lines.forEach(line => {
                        if (line.startsWith('Date:')) dateStr = line.replace('Date:', '').trim();
                        if (line.startsWith('Time:')) timeStr = line.replace('Time:', '').trim();
                        if (line.startsWith('Category:')) categoryStr = line.replace('Category:', '').trim();
                    });

                    // Create a clean preview message
                    displayMessage = `📅 ${title}`;
                    if (dateStr) displayMessage += ` • ${dateStr}`;
                    if (timeStr) displayMessage += ` • ${timeStr}`;
                }
            }

            // Try to resolve sender avatar if present
            const senderAvatar = (notif.sender && (notif.sender.profilePicture || notif.sender.avatar || notif.sender.photoURL)) || '';
            const showAvatar = !!senderAvatar;

            return `
                <div class="notification-item ${notif.isRead ? '' : 'unread'}" data-id="${notif.id}" data-memo-id="${notificationMemoId}" data-original-memo-id="${originalMemoId}" data-notification-type="${isCalendarEvent ? 'memo_received' : notif.type}">
                    ${showAvatar
                        ? `<img class="notification-avatar" src="${senderAvatar}" alt="${(notif.sender && notif.sender.name) ? notif.sender.name : 'Sender'}">`
                        : `<div class="notification-icon"><i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i></div>`
                    }
                    <div class="notification-content">
                        <div class="notification-title">${isCalendarEvent ? (notif.title || 'Calendar Event') : (notif.title || 'Notification')}</div>
                        <div class="notification-message">${displayMessage}</div>
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
                const originalMemoId = item.dataset.originalMemoId;

                // eslint-disable-next-line no-console
                console.log('Notification clicked:', { id, memoId, notificationType, originalMemoId });

                // Mark as read
                await markAsRead(id);

                // ALL notifications should open in modal - use the notification's own ID if no memoId
                const targetMemoId = memoId || id;

                // For pending_memo notifications, use originalMemoId to fetch the actual pending memo
                const finalMemoId = (notificationType === 'pending_memo' && originalMemoId) ? originalMemoId : targetMemoId;

                // eslint-disable-next-line no-console
                console.log('Opening notification modal with ID:', finalMemoId, 'Type:', notificationType);

                try {
                    if (notificationType === 'user_log') {
                        await openAuditLogModal(id);
                    } else {
                        await openMemoModal(finalMemoId);
                    }
                    // eslint-disable-next-line no-console
                    console.log('openMemoModal call completed');
                } catch (modalError) {
                    // eslint-disable-next-line no-console
                    console.error('Error in openMemoModal:', modalError);
                    // Fallback to navigation
                    window.location.href = `/admin/log?memo=${finalMemoId}`;
                }
            });
        });
    }

    async function openAuditLogModal(auditId){
        if (!auditId) return;
        const res = await fetch(`/api/audit/logs/${auditId}`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error('Failed to load audit log');
        const log = data.log;
        const memoLike = {
            _id: log._id,
            subject: log.subject || 'User Activity',
            content: log.message || '',
            sender: { email: log.email || 'system' },
            recipient: null,
            department: 'System',
            priority: 'low',
            createdAt: log.createdAt,
            activityType: 'user_activity',
            metadata: { userEmail: log.email, isAuditLog: true }
        };
        let memoModal = document.getElementById('notificationMemoModal');
        if (!memoModal) memoModal = createMemoModal();
        populateMemoModal(memoLike, memoModal);
        memoModal.style.setProperty('display', 'flex', 'important');
        memoModal.style.setProperty('visibility', 'visible', 'important');
        memoModal.style.setProperty('opacity', '1', 'important');
        document.body.style.overflow = 'hidden';
    }

    // Mark all as read functionality
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Mark all unread notifications as read
                const unreadNotifications = notifications.filter(n => !n.isRead && (currentTab === 'audit' ? n.type === 'user_log' : n.type !== 'user_log'));
                const promises = unreadNotifications.map(notif => markAsRead(notif.id));
                await Promise.all(promises);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error marking all as read:', error);
            }
        });
    }

    // Tabs handlers
    const tabMemos = document.getElementById('notifTabMemos');
    const tabAudit = document.getElementById('notifTabAudit');
    if (tabMemos && tabAudit) {
        tabMemos.addEventListener('click', (e) => {
            e.stopPropagation();
            currentTab = 'memos';
            tabMemos.classList.add('active');
            tabAudit.classList.remove('active');
            renderNotifications();
        });
        tabAudit.addEventListener('click', (e) => {
            e.stopPropagation();
            currentTab = 'audit';
            tabAudit.classList.add('active');
            tabMemos.classList.remove('active');
            renderNotifications();
        });
    }

    // Mark notification as read
    async function markAsRead(id) {
        try {
            await fetch(`/api/log/notifications/${id}/read`, { method: 'PUT', credentials: 'same-origin' });
            // Decrement badge only for items that are counted (exclude audit logs)
            const notif = notifications.find(n => String(n.id) === String(id));
            if (notif && notif.type !== 'user_log') {
                unreadCount = Math.max(0, unreadCount - 1);
                updateBadge();
            }
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
            const response = await fetch(`/api/log/memos/${memoId}`, { credentials: 'same-origin' });
            const data = await response.json();

            // eslint-disable-next-line no-console
            console.log('API Response:', data);

            if (!response.ok) {
                // eslint-disable-next-line no-console
                console.error('API Error:', response.status, data);
                if (response.status === 403) {
                    alert('You do not have permission to view this memo.');
                } else if (response.status === 404) {
                    alert('Memo not found.');
                } else {
                    alert(`Error loading memo: ${data.message || 'Unknown error'}`);
                }
                // Fallback to navigation
                window.location.href = `/admin/log?memo=${memoId}`;
                return;
            }

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
                <div id="notificationActionOverlay" style="position:absolute; inset:0; display:none; align-items:center; justify-content:center; background: rgba(255,255,255,0.85); z-index: 5;">
                    <div style="text-align:center;">
                        <div id="naoSpinner" style="width:44px;height:44px;border:4px solid #93c5fd;border-top-color:#1C89E3;border-radius:50%;margin:0 auto 12px;animation:spin .8s linear infinite;"></div>
                        <div id="naoCheck" style="display:none; font-size:36px; color:#16a34a; margin-bottom:8px;">✔</div>
                        <div id="naoText" style="color:#111827; font-weight:600;">Processing...</div>
                    </div>
                </div>
                <div class="notification-memo-header" style="
                    padding: 1.5rem;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                ">
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: #111827;">View Memo</h2>
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
                    <!-- PDF-style Memo Header -->
                    <div style="margin-bottom: 24px; padding-bottom: 16px;">
                        <h1 style="font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 20px 0; color: #111827; letter-spacing: 1px;">MEMO</h1>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.5;">
                                <span style="font-weight: 600; color: #374151; min-width: 100px; flex-shrink: 0;">Subject:</span>
                                <span id="notificationMemoSubject" style="color: #111827; flex: 1;"></span>
                            </div>
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.5;">
                                <span style="font-weight: 600; color: #374151; min-width: 100px; flex-shrink: 0;">From:</span>
                                <span id="notificationMemoFrom" style="color: #111827; flex: 1;"></span>
                            </div>
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.5;">
                                <span style="font-weight: 600; color: #374151; min-width: 100px; flex-shrink: 0;">To:</span>
                                <span id="notificationMemoTo" style="color: #111827; flex: 1;"></span>
                            </div>
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.5;">
                                <span style="font-weight: 600; color: #374151; min-width: 100px; flex-shrink: 0;">Department:</span>
                                <span id="notificationMemoDepartment" style="color: #111827; flex: 1;"></span>
                            </div>
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.5;">
                                <span style="font-weight: 600; color: #374151; min-width: 100px; flex-shrink: 0;">Priority:</span>
                                <span id="notificationMemoPriority" style="color: #111827; flex: 1;"></span>
                            </div>
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.5;">
                                <span style="font-weight: 600; color: #374151; min-width: 100px; flex-shrink: 0;">Date:</span>
                                <span id="notificationMemoDate" style="color: #111827; flex: 1;"></span>
                            </div>
                        </div>
                        <div style="width: 100%; height: 1px; background: #e5e7eb; margin: 16px 0;"></div>
                    </div>
                    <div id="notificationMemoBodyContent" style="
                        color: #111827;
                        line-height: 1.6;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    "></div>
                </div>
                <div id="notificationMemoFooter" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: none; gap: 8px; justify-content: flex-end;">
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
        // Check if this is a calendar event notification
        // Check both metadata and subject/content patterns as fallback
        const isCalendarEvent = (memo.metadata && memo.metadata.eventType === 'calendar_event') ||
                               (memo.subject && memo.subject.includes('Calendar Event')) ||
                               (memo.activityType === 'system_notification' && memo.subject && memo.subject.includes('📅'));

        const memoHeader = modal.querySelector('.notification-memo-body > div:first-child');

        // Detect user/audit log entries
        const isUserLog = (memo.activityType === 'user_activity') ||
                          ((memo.subject || '').toLowerCase().includes('user login')) ||
                          ((memo.subject || '').toLowerCase().includes('user activity'));

        if ((isCalendarEvent || isUserLog) && memoHeader) {
            // Hide MEMO header for calendar events
            memoHeader.style.display = 'none';
        }

        // Subject
        const subjectEl = modal.querySelector('#notificationMemoSubject');
        if (subjectEl && !isCalendarEvent && !isUserLog) {
            subjectEl.textContent = memo.subject || '(No subject)';
        }

        // From (Sender)
        const fromEl = modal.querySelector('#notificationMemoFrom');
        if (fromEl && !isCalendarEvent && !isUserLog) {
            const senderName = memo.sender
                ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim()
                : 'Unknown Sender';
            const senderEmail = memo.sender?.email || '';
            fromEl.textContent = senderEmail ? `${senderName} (${senderEmail})` : senderName;
        }

        // To (Recipient)
        const toEl = modal.querySelector('#notificationMemoTo');
        if (toEl) {
            const recipientName = memo.recipient
                ? `${memo.recipient.firstName || ''} ${memo.recipient.lastName || ''}`.trim()
                : 'Unknown Recipient';
            const recipientEmail = memo.recipient?.email || '';
            toEl.textContent = recipientEmail ? `${recipientName} (${recipientEmail})` : recipientName;
        }

        // Department
        const departmentEl = modal.querySelector('#notificationMemoDepartment');
        if (departmentEl) {
            departmentEl.textContent = memo.department || 'N/A';
        }

        // Priority
        const priorityEl = modal.querySelector('#notificationMemoPriority');
        if (priorityEl) {
            priorityEl.textContent = memo.priority || 'medium';
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

            // Calendar event format - simple display without footer/button
            if (isCalendarEvent) {
                if (memo.content && memo.content.trim()) {
                    // Format calendar event content nicely - remove markdown asterisks
                    let formattedContent = memo.content.replace(/\*\*/g, '');
                    // Remove any lines like: "View the calendar to see more details."
                    formattedContent = formattedContent
                        .split('\n')
                        .filter(line => !/\bview\s+the\s+calendar\b/i.test(line))
                        .join('\n')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#039;');
                    htmlContent += `<div style="white-space: pre-wrap; line-height: 1.8; color: #111827; font-size: 15px; margin-bottom: 1.5rem;">${formattedContent}</div>`;
                }
            } else if (isUserLog) {
                // User log format: professional, branded
                const titleEl = modal.querySelector('.notification-memo-header h2');
                if (titleEl) titleEl.textContent = 'User Log';
                const email = memo.sender?.email || memo.metadata?.userEmail || '(unknown)';
                const dt = memo.createdAt ? new Date(memo.createdAt) : null;
                const when = dt ? dt.toLocaleString() : '';
                const dateOnly = dt ? dt.toLocaleDateString() : '';
                const timeOnly = dt ? dt.toLocaleTimeString() : '';
                const safe = (s) => String(s || '')
                    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
                let body = memo.content && memo.content.trim() ? safe(memo.content) : `User ${safe(email)} activity recorded.`;
                htmlContent += `
                    <div style="text-align:center;margin-top:6px;">
                        <img src="/images/memofy-logo.png" alt="Memofy" style="width:48px;height:48px;opacity:.95;" />
                        <h3 style="margin:10px 0 0 0; font-size:18px; color:#111827;">${safe(memo.subject || 'User Activity')}</h3>
                        <p style="margin:4px 0 0 0; color:#6b7280; font-size:12px;">${safe(email)} • ${safe(when)}</p>
                    </div>
                    <div style="display:flex; gap:16px; justify-content:center; margin-top:10px; color:#374151; font-size:12px;">
                        <div><span style="font-weight:600;">Date:</span> ${safe(dateOnly)}</div>
                        <div><span style="font-weight:600;">Time:</span> ${safe(timeOnly)}</div>
                    </div>
                    <div style="width:100%; height:1px; background:#e5e7eb; margin:16px 0;"></div>
                    <div style="white-space:pre-wrap; line-height:1.8; color:#111827; font-size:14px;">${body}</div>
                `;
            } else {
                // Regular memo format
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

            // Add signatures if present (for regular memos only, not calendar events or user logs)
            if (!isCalendarEvent && !isUserLog && memo.signatures && Array.isArray(memo.signatures) && memo.signatures.length > 0) {
                htmlContent += '<div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">';
                htmlContent += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 1rem;">';

                memo.signatures.forEach(sig => {
                    const name = sig.displayName || sig.roleTitle || sig.role || '';
                    const title = sig.roleTitle || sig.role || '';
                    const imgSrc = sig.imageUrl || '';

                    // Escape HTML for security
                    const escapeHtml = (text) => String(text || '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#039;');

                    const safeName = escapeHtml(name);
                    const safeTitle = escapeHtml(title);
                    const safeImgSrc = escapeHtml(imgSrc);

                    htmlContent += '<div style="text-align: center;">';
                    if (imgSrc) {
                        htmlContent += `<img src="${safeImgSrc}" alt="${safeName}" style="max-width: 180px; max-height: 60px; object-fit: contain; margin-bottom: 8px;" onerror="this.style.display='none'">`;
                    } else {
                        htmlContent += '<div style="height: 60px; margin-bottom: 8px;"></div>';
                    }
                    htmlContent += `<div style="font-weight: 600; color: #111827; margin-top: 4px;">${safeName}</div>`;
                    htmlContent += `<div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${safeTitle}</div>`;
                    htmlContent += '</div>';
                });

                htmlContent += '</div></div>';
            }

            bodyContentEl.innerHTML = htmlContent || '<div style="color: #9ca3af;">No content available</div>';

            // Footer actions for admin approval workflow
            const footer = modal.querySelector('#notificationMemoFooter');
            if (footer) {
                footer.innerHTML = '';
                // Generic overlay helpers for action feedback
                function showActionOverlay(text){
                    const overlay = modal.querySelector('#notificationActionOverlay');
                    const sp = modal.querySelector('#naoSpinner');
                    const ck = modal.querySelector('#naoCheck');
                    const tx = modal.querySelector('#naoText');
                    if (!overlay) return;
                    if (tx) tx.textContent = text || 'Processing...';
                    if (sp) sp.style.display = 'block';
                    if (ck) ck.style.display = 'none';
                    overlay.style.display = 'flex';
                }
                function showActionOverlaySuccess(text){
                    const overlay = modal.querySelector('#notificationActionOverlay');
                    const sp = modal.querySelector('#naoSpinner');
                    const ck = modal.querySelector('#naoCheck');
                    const tx = modal.querySelector('#naoText');
                    if (!overlay) return;
                    if (sp) sp.style.display = 'none';
                    if (ck) ck.style.display = 'block';
                    if (tx) tx.textContent = text || 'Done';
                    overlay.style.display = 'flex';
                }
                const statusStr = (memo.status || '').toString();
                const isPendingStatus = ['pending_admin','PENDING_ADMIN','pending','PENDING'].includes(statusStr);
                const looksPendingBySubject = (memo.subject || '').toLowerCase().includes('pending approval');
                const isAdminUser = (window.currentUser && (window.currentUser.role === 'admin'));
                if (!isCalendarEvent && isAdminUser && (isPendingStatus || looksPendingBySubject)) {
                    footer.style.display = 'flex';
                    const rejectBtn = document.createElement('button');
                    rejectBtn.textContent = 'Reject';
                    rejectBtn.style.cssText = 'background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;cursor:pointer;';
                    const approveBtn = document.createElement('button');
                    approveBtn.textContent = 'Approve';
                    approveBtn.style.cssText = 'background:#1C89E3;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;';

                    // Spinner keyframes (inject once)
                    if (!document.getElementById('notif-modal-spinner-style')){
                        const kf = document.createElement('style');
                        kf.id = 'notif-modal-spinner-style';
                        kf.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
                        document.head.appendChild(kf);
                    }

                    function showOverlay(text){
                        const overlay = modal.querySelector('#notificationActionOverlay');
                        const sp = modal.querySelector('#naoSpinner');
                        const ck = modal.querySelector('#naoCheck');
                        const tx = modal.querySelector('#naoText');
                        if (!overlay) return;
                        if (tx) tx.textContent = text || 'Processing...';
                        if (sp) sp.style.display = 'block';
                        if (ck) ck.style.display = 'none';
                        overlay.style.display = 'flex';
                    }
                    function showOverlaySuccess(text){
                        const overlay = modal.querySelector('#notificationActionOverlay');
                        const sp = modal.querySelector('#naoSpinner');
                        const ck = modal.querySelector('#naoCheck');
                        const tx = modal.querySelector('#naoText');
                        if (!overlay) return;
                        if (sp) sp.style.display = 'none';
                        if (ck) ck.style.display = 'block';
                        if (tx) tx.textContent = text || 'Done';
                        overlay.style.display = 'flex';
                    }

                    // Use original memo id if present (pending review notifications)
                    const targetMemoId = (memo.metadata && (memo.metadata.originalMemoId || memo.metadata.relatedMemoId)) || memo._id;

                    rejectBtn.onclick = async () => {
                        try {
                            const reason = window.prompt('Optional reason for rejection:', '');
                            showOverlay('Rejecting...');
                            const res = await fetch(`/api/log/memos/${targetMemoId}/reject`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason: reason || '' }), credentials: 'same-origin' });
                            const data = await res.json().catch(()=>({}));
                            if (!res.ok) throw new Error(data.message || 'Failed to reject');
                            showOverlaySuccess('Rejected');
                            // Remove notification item immediately
                            const notifItem = document.querySelector(`.notification-item[data-memo-id="${memo._id}"]`);
                            if (notifItem && notifItem.parentNode) notifItem.parentNode.removeChild(notifItem);
                            setTimeout(()=>{ closeMemoModal(); fetchNotifications(); window.location.href = '/admin/log'; }, 700);
                        } catch (err) {
                            alert(err?.message || 'Failed to reject');
                        }
                    };

                    approveBtn.onclick = async () => {
                        try {
                            showOverlay('Approving...');
                            const res = await fetch(`/api/log/memos/${targetMemoId}/approve`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials: 'same-origin' });
                            const data = await res.json().catch(()=>({}));
                            if (!res.ok) throw new Error(data.message || 'Failed to approve');
                            showOverlaySuccess('Approved');
                            const notifItem = document.querySelector(`.notification-item[data-memo-id="${memo._id}"]`);
                            if (notifItem && notifItem.parentNode) notifItem.parentNode.removeChild(notifItem);
                            setTimeout(()=>{ closeMemoModal(); fetchNotifications(); window.location.href = '/admin/log'; }, 700);
                        } catch (err) {
                            alert(err?.message || 'Failed to approve');
                        }
                    };

                    footer.appendChild(rejectBtn);
                    footer.appendChild(approveBtn);
                } else if (isUserLog && isAdminUser) {
                    footer.style.display = 'flex';
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete Log';
                    deleteBtn.style.cssText = 'background:#ef4444;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;';
                    deleteBtn.onclick = async () => {
                        try {
                            // Show modal overlay, then perform delete
                            showActionOverlay('Deleting...');
                            await new Promise(r => setTimeout(r, 500));
                            const endpoint = (memo.metadata && memo.metadata.isAuditLog) ? `/api/audit/logs/${memo._id}` : `/api/log/memos/${memo._id}`;
                            const res = await fetch(endpoint, { method: 'DELETE', credentials: 'same-origin' });
                            if (!res.ok) throw new Error('Failed to delete');
                            showActionOverlaySuccess('Deleted');
                            // Remove from list if it exists in dropdown
                            const notifItem = document.querySelector(`.notification-item[data-memo-id="${memo._id}"]`);
                            if (notifItem && notifItem.parentNode) notifItem.parentNode.removeChild(notifItem);
                            setTimeout(() => { closeMemoModal(); fetchNotifications && fetchNotifications(); }, 600);
                        } catch (err) {
                            alert(err?.message || 'Delete failed');
                        }
                    };
                    footer.appendChild(deleteBtn);
                } else {
                    footer.style.display = 'none';
                }
            }

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
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
        // DOM is already loaded, initialize immediately
        // Use setTimeout to ensure all scripts are loaded
        setTimeout(initNotifications, 0);
    }
})();

