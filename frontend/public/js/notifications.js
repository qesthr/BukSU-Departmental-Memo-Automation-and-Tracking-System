// Notification Bell Functionality
(function() {
    // Initialize notifications - handle both cases: DOM already loaded or not
    function initNotifications() {
        console.log('🔔 Initializing notifications...');
        const notificationBtn = document.querySelector('.notification-btn');
        const notificationDropdown = document.getElementById('notificationDropdown');

        // Helpers to hide/show Add User button while dropdown is open
        function getAddBtn(){
            return document.getElementById('addUserBtn');
        }
        function hideAddButton(){
            const btn = getAddBtn();
            if (!btn) {return;}
            // store previous visibility only once
            if (btn.dataset.prevVisibility == null) {
                btn.dataset.prevVisibility = btn.style.visibility || '';
            }
            btn.style.visibility = 'hidden';
            btn.style.pointerEvents = 'none';
        }
        function showAddButton(){
            const btn = getAddBtn();
            if (!btn) {return;}
            btn.style.visibility = btn.dataset.prevVisibility || '';
            btn.style.pointerEvents = '';
            delete btn.dataset.prevVisibility;
        }

        let notifications = [];
        let unreadCount = 0;

        // Determine the correct API base URL (works for local + production)
        const apiBaseUrl = window.__MEMOFY_API_BASE_URL__ ||
            (window.location && window.location.origin ? window.location.origin : '');

        const buildApiUrl = (path) => {
            if (!path) {
                return apiBaseUrl || path;
            }
            if (path.startsWith('http://') || path.startsWith('https://')) {
                return path;
            }
            const base = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
            if (!base) {
                return path;
            }
            return `${base}${path.startsWith('/') ? path : `/${path}`}`;
        };

        const apiFetch = (path, options = {}) => {
            const url = buildApiUrl(path);
            return fetch(url, options);
        };

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
                position: fixed;
                top: 0; /* will be positioned on open */
                right: 0; /* will be positioned on open */
                width: 400px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-height: 600px;
                overflow: hidden;
                display: none;
                z-index: 200000; /* ensure above any page UI */
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
                    <a href="/admin/activity-logs" style="display: block; padding: 1rem; text-align: center; color: #1C89E3; text-decoration: none; border-top: 1px solid #e2e8f0; font-weight: 500;">View Activity Logs</a>
                </div>
            `;

            // Always append to body to escape local stacking contexts
            document.body.appendChild(dropdown);

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
                if (!isOpen) {
                    // Position dropdown relative to the bell with fixed coords
                    const rect = notificationBtn.getBoundingClientRect();
                    const spacing = 8;
                    dropdown.style.top = `${Math.round(rect.bottom + spacing)}px`;
                    // Align to the right edge of the viewport
                    dropdown.style.right = `0px`;
                    fetchNotifications();
                    hideAddButton();
                } else {
                    showAddButton();
                }
                dropdown.style.display = isOpen ? 'none' : 'block';
                console.log('🔔 Dropdown toggled:', isOpen ? 'closed' : 'opened');
            }
        }, true); // Use capture phase to catch event before it bubbles
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-btn') && !e.target.closest('#notificationDropdown')) {
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
                // Restore Add button when dropdown closes
                const restore = true; restore && (function(){ const btn = document.getElementById('addUserBtn'); if (btn) { btn.style.visibility = btn.dataset.prevVisibility || ''; btn.style.pointerEvents = ''; delete btn.dataset.prevVisibility; } })();
            }
        }
    });

    // Fetch notifications
    async function fetchNotifications() {
        try {
            const response = await apiFetch('/api/log/notifications', {
                credentials: 'same-origin',
                redirect: 'manual' // Don't follow redirects automatically
            });

            // Handle redirects manually
            if (response.type === 'opaqueredirect' || response.status === 0) {
                // This is a redirect, likely to /unauthorized - silently fail
                return;
            }

            if (!response.ok) {
                // Don't show error if unauthorized - user might not be logged in
                if (response.status === 401 || response.status === 403) {
                    return; // Silently fail if not authenticated
                }
                // Only throw for other errors
                if (response.status >= 500) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return; // Silently fail for client errors
            }

            const data = await response.json();

            if (data.success) {
                notifications = data.notifications;
                unreadCount = data.unreadCount;
                updateBadge();
                renderNotifications();
            }
        } catch (error) {
            // Only log network errors, not redirect/unauthorized errors
            if (error.name !== 'TypeError' || !error.message.includes('Failed to fetch')) {
                // eslint-disable-next-line no-console
                console.error('Error fetching notifications:', error);
            }
            // Silently handle network errors (SSL, connection issues, etc.)
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

        // Filter out any remaining audit logs (shouldn't be any, but just in case)
        const filtered = notifications.filter(n => n.type !== 'user_log');

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="padding: 3rem 2rem; text-align: center; color: #64748b;">
                    <i data-lucide="bell-off" style="width: 64px; height: 64px; color: #cbd5e1; margin: 0 auto 1rem; display: block;"></i>
                    <p style="margin: 0; font-size: 0.875rem;">No notifications to show</p>
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
            } else if (notif.type === 'user_profile_edited') {
                iconName = 'user-cog';
            } else if (notif.type === 'calendar_connected') {
                iconName = 'calendar-check';
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
                        if (line.startsWith('Date:')) {dateStr = line.replace('Date:', '').trim();}
                        if (line.startsWith('Time:')) {timeStr = line.replace('Time:', '').trim();}
                        if (line.startsWith('Category:')) {categoryStr = line.replace('Category:', '').trim();}
                    });

                    // Create a clean preview message
                    displayMessage = `📅 ${title}`;
                    if (dateStr) {displayMessage += ` • ${dateStr}`;}
                    if (timeStr) {displayMessage += ` • ${timeStr}`;}
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

                // Only admins (or pending memo notifications) should fall back to the original memo.
                const canViewOriginal =
                    originalMemoId &&
                    (
                        notificationType === 'pending_memo' ||
                        (window.currentUser && window.currentUser.role === 'admin')
                    );

                const finalMemoId = canViewOriginal ? originalMemoId : targetMemoId;

                // eslint-disable-next-line no-console
                console.log('Opening notification modal with ID:', finalMemoId, 'Type:', notificationType);

                try {
                        await openMemoModal(finalMemoId);
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


    // Mark all as read functionality
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Mark all unread notifications as read
                const unreadNotifications = notifications.filter(n => !n.isRead && n.type !== 'user_log');
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
            await apiFetch(`/api/log/notifications/${id}/read`, { method: 'PUT', credentials: 'same-origin' });
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
            const response = await apiFetch(`/api/log/memos/${memoId}`, { credentials: 'same-origin' });
            const data = await response.json();

            // eslint-disable-next-line no-console
            console.log('API Response:', data);

            if (!response.ok) {
                // eslint-disable-next-line no-console
                console.error('API Error:', response.status, data);
                if (response.status === 403) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permission Denied',
                        text: 'You do not have permission to view this memo.'
                    });
                } else if (response.status === 404) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: 'Memo not found.'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: `Error loading memo: ${data.message || 'Unknown error'}`
                    });
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

            let memo = data.memo;
            // eslint-disable-next-line no-console
            console.log('Memo fetched:', memo);

            // If this is a notification memo with an originalMemoId, fetch the original pending memo
            // This ensures we show approve/reject buttons for the actual pending memo
            if (memo.metadata && (memo.metadata.originalMemoId || memo.metadata.relatedMemoId)) {
                const originalMemoId = memo.metadata.originalMemoId || memo.metadata.relatedMemoId;
                // Check if the current memo is not pending (it's a notification memo)
                const isNotificationMemo = memo.status !== 'pending_admin' && memo.status !== 'PENDING_ADMIN' && memo.status !== 'pending' && memo.status !== 'PENDING';

                if (isNotificationMemo && originalMemoId) {
                    try {
                        // eslint-disable-next-line no-console
                        console.log('Fetching original pending memo:', originalMemoId);
                        const originalResponse = await apiFetch(`/api/log/memos/${originalMemoId}`, { credentials: 'same-origin' });
                        const originalData = await originalResponse.json();

                        if (originalResponse.ok && originalData.success && originalData.memo) {
                            // Use the original pending memo instead
                            memo = originalData.memo;
                            // eslint-disable-next-line no-console
                            console.log('Using original pending memo:', memo);
                        }
                    } catch (fetchError) {
                        // eslint-disable-next-line no-console
                        console.warn('Could not fetch original memo, using notification memo:', fetchError);
                        // Continue with notification memo if fetch fails
                    }
                }
            }

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
                // Dropdown closed due to opening memo modal; restore Add button
                const btn = document.getElementById('addUserBtn');
                if (btn) { btn.style.visibility = btn.dataset.prevVisibility || ''; btn.style.pointerEvents = ''; delete btn.dataset.prevVisibility; }
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
                <div id="notificationMemoFooter" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: none; gap: 12px; justify-content: flex-end; align-items: center; flex-shrink: 0; flex-direction: row;">
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

        // Detect user/audit log entries
        const isUserLog = (memo.activityType === 'user_activity') ||
                          ((memo.subject || '').toLowerCase().includes('user login')) ||
                          ((memo.subject || '').toLowerCase().includes('user activity'));

        // Determine if this is a system notification (not an actual memo)
        // Real memos: memo_received, memo_sent, or no activityType
        // System notifications: everything else with activityType
        const isSystemNotification = memo.activityType &&
            memo.activityType !== 'memo_received' &&
            memo.activityType !== 'memo_sent' &&
            memo.activityType !== null;

        const memoHeader = modal.querySelector('.notification-memo-body > div:first-child');
        const memoDetails = modal.querySelector('.notification-memo-body > div:first-child > div:last-child'); // The details section

        // Hide MEMO header and details for system notifications, calendar events, and user logs
        if ((isSystemNotification || isCalendarEvent || isUserLog) && memoHeader) {
            memoHeader.style.display = 'none';
        }

        // Only show memo details (Subject, From, To, etc.) for actual memos
        const isActualMemo = !isSystemNotification && !isCalendarEvent && !isUserLog;

        // Subject
        const subjectEl = modal.querySelector('#notificationMemoSubject');
        if (subjectEl && isActualMemo) {
            subjectEl.textContent = memo.subject || '(No subject)';
        }

        // From (Sender)
        const fromEl = modal.querySelector('#notificationMemoFrom');
        if (fromEl && isActualMemo) {
            const senderName = memo.sender
                ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim()
                : 'Unknown Sender';
            const senderEmail = memo.sender?.email || '';
            fromEl.textContent = senderEmail ? `${senderName} (${senderEmail})` : senderName;
        }

        // To (Recipient)
        const toEl = modal.querySelector('#notificationMemoTo');
        if (toEl && isActualMemo) {
            const recipientName = memo.recipient
                ? `${memo.recipient.firstName || ''} ${memo.recipient.lastName || ''}`.trim()
                : 'Unknown Recipient';
            const recipientEmail = memo.recipient?.email || '';
            toEl.textContent = recipientEmail ? `${recipientName} (${recipientEmail})` : recipientName;
        }

        // Department
        const departmentEl = modal.querySelector('#notificationMemoDepartment');
        if (departmentEl && isActualMemo) {
            departmentEl.textContent = memo.department || 'N/A';
        }

        // Priority
        const priorityEl = modal.querySelector('#notificationMemoPriority');
        if (priorityEl && isActualMemo) {
            priorityEl.textContent = memo.priority || 'medium';
        }

        // Date
        const dateEl = modal.querySelector('#notificationMemoDate');
        if (dateEl && memo.createdAt && isActualMemo) {
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
                if (titleEl) {titleEl.textContent = 'User Log';}
                const email = memo.sender?.email || memo.metadata?.userEmail || '(unknown)';
                const dt = memo.createdAt ? new Date(memo.createdAt) : null;
                const when = dt ? dt.toLocaleString() : '';
                const dateOnly = dt ? dt.toLocaleDateString() : '';
                const timeOnly = dt ? dt.toLocaleTimeString() : '';
                const safe = (s) => String(s || '')
                    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
                const body = memo.content && memo.content.trim() ? safe(memo.content) : `User ${safe(email)} activity recorded.`;
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
            } else if (isSystemNotification) {
                // System notification format: simple, clean format without memo structure
                const titleEl = modal.querySelector('.notification-memo-header h2');
                if (titleEl) {
                    // Update title based on notification type
                    if (memo.activityType === 'calendar_connected') {
                        titleEl.textContent = 'Google Calendar Connected';
                    } else if (memo.activityType === 'user_profile_edited') {
                        titleEl.textContent = 'Profile Updated';
                    } else if (memo.activityType === 'user_deleted') {
                        titleEl.textContent = 'User Deleted';
                    } else if (memo.activityType === 'password_reset') {
                        titleEl.textContent = 'Password Reset';
                    } else if (memo.activityType === 'welcome_email') {
                        titleEl.textContent = 'Welcome to Memofy';
                    } else if (memo.activityType === 'pending_memo') {
                        titleEl.textContent = 'Memo Pending Approval';
                    } else if (memo.activityType === 'memo_approved') {
                        titleEl.textContent = 'Memo Approved';
                    } else if (memo.activityType === 'memo_rejected') {
                        titleEl.textContent = 'Memo Rejected';
                    } else {
                        titleEl.textContent = memo.subject || 'Notification';
                    }
                }

                const dt = memo.createdAt ? new Date(memo.createdAt) : null;
                const when = dt ? dt.toLocaleString() : '';
                const safe = (s) => String(s || '')
                    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

                htmlContent += `
                    <div style="text-align:center;margin-top:20px;margin-bottom:24px;">
                        <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:#f0f9ff;margin-bottom:16px;">
                            ${memo.activityType === 'calendar_connected' ? '<i data-lucide="calendar-check" style="width:32px;height:32px;color:#1C89E3;"></i>' : ''}
                            ${memo.activityType === 'user_profile_edited' ? '<i data-lucide="user-cog" style="width:32px;height:32px;color:#1C89E3;"></i>' : ''}
                            ${memo.activityType === 'user_deleted' ? '<i data-lucide="user-minus" style="width:32px;height:32px;color:#ef4444;"></i>' : ''}
                            ${memo.activityType === 'password_reset' ? '<i data-lucide="key" style="width:32px;height:32px;color:#1C89E3;"></i>' : ''}
                            ${memo.activityType === 'welcome_email' ? '<i data-lucide="mail" style="width:32px;height:32px;color:#1C89E3;"></i>' : ''}
                            ${memo.activityType === 'pending_memo' ? '<i data-lucide="clock" style="width:32px;height:32px;color:#f59e0b;"></i>' : ''}
                            ${memo.activityType === 'memo_approved' ? '<i data-lucide="check-circle" style="width:32px;height:32px;color:#16a34a;"></i>' : ''}
                            ${memo.activityType === 'memo_rejected' ? '<i data-lucide="x-circle" style="width:32px;height:32px;color:#ef4444;"></i>' : ''}
                            ${!['calendar_connected','user_profile_edited','user_deleted','password_reset','welcome_email','pending_memo','memo_approved','memo_rejected'].includes(memo.activityType) ? '<i data-lucide="bell" style="width:32px;height:32px;color:#1C89E3;"></i>' : ''}
                        </div>
                        <h3 style="margin:0 0 8px 0; font-size:20px; font-weight:600; color:#111827;">${safe(memo.subject || 'Notification')}</h3>
                        <p style="margin:0; color:#6b7280; font-size:14px;">${safe(when)}</p>
                    </div>
                    <div style="width:100%; height:1px; background:#e5e7eb; margin:24px 0;"></div>
                    <div style="color:#111827; font-size:15px; padding:0 8px;">
                        ${(() => {
                            let content = safe(memo.content || '');
                            let rejectionReason = '';

                            // Extract rejection reason if present
                            if (memo.activityType === 'memo_rejected' || (memo.metadata?.action === 'rejected')) {
                                rejectionReason = memo.metadata?.reason ||
                                                 (memo.content && memo.content.match(/Reason:\s*(.+?)(?:\n|$)/i)?.[1]?.trim()) ||
                                                 '';
                                // Remove "Reason: ..." line from content if it exists
                                if (rejectionReason && content.includes('Reason:')) {
                                    content = content.replace(/Reason:\s*[^\n]+/i, '').trim();
                                }
                            }

                            // Build the content HTML with rejection reason integrated
                            let contentHtml = '';
                            if (content) {
                                contentHtml += `<div style="white-space: pre-wrap; line-height: 1.8; margin-bottom: ${rejectionReason ? '24px' : '0'}; color: #111827;">${content}</div>`;
                            }

                            // Add rejection reason box directly after content, inside the same container
                            if (rejectionReason) {
                                contentHtml += `
                                    <div style="padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                            <i data-lucide="alert-circle" style="width: 20px; height: 20px; color: #ef4444;"></i>
                                            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #991b1b;">Rejection Reason</h4>
                                        </div>
                                        <div style="color: #7f1d1d; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                                            ${safe(rejectionReason)}
                                        </div>
                                    </div>
                                `;
                            }

                            return contentHtml || '<div style="color: #9ca3af; font-style: italic;">No content</div>';
                        })()}
                    </div>
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
                        if (!bytes || bytes === 0) {return '0 B';}
                        const k = 1024;
                        const sizes = ['B', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                    }

                    if (isPDF || !isImage) {
                        htmlContent += `
                            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 13px;">
                                <i data-lucide="${isPDF ? 'file-text' : 'paperclip'}" style="width: 16px; height: 16px; color: #6b7280;"></i>
                                <a href="${attachmentUrl}" download="${attachment.filename}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${attachment.filename}</a>
                                <span style="font-size: 12px; color: #6b7280;">(${formatFileSize(attachment.size || 0)})</span>
                            </div>
                        `;
                    } else if (isImage) {
                        htmlContent += `
                            <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
                                <img src="${attachmentUrl}" alt="${attachment.filename}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;" onclick="(function(){const a=document.createElement('a');a.href='${attachmentUrl}';a.download='${attachment.filename}';document.body.appendChild(a);a.click();document.body.removeChild(a);})()" />
                                <div style="margin-top: 0.5rem; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">
                                    <i data-lucide="image" style="width: 16px; height: 16px; color: #6b7280;"></i>
                                    <a href="${attachmentUrl}" download="${attachment.filename}" style="font-size: 13px; color: #2563eb; text-decoration: none; font-weight: 500;">${attachment.filename}</a>
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

            bodyContentEl.innerHTML = htmlContent || '';

            // Footer actions for admin approval workflow and recipient acknowledgment
            const footer = modal.querySelector('#notificationMemoFooter');
            if (footer) {
                footer.innerHTML = '';
                // Generic overlay helpers for action feedback
                function showActionOverlay(text){
                    const overlay = modal.querySelector('#notificationActionOverlay');
                    const sp = modal.querySelector('#naoSpinner');
                    const ck = modal.querySelector('#naoCheck');
                    const tx = modal.querySelector('#naoText');
                    if (!overlay) {return;}
                    if (tx) {tx.textContent = text || 'Processing...';}
                    if (sp) {sp.style.display = 'block';}
                    if (ck) {ck.style.display = 'none';}
                    overlay.style.display = 'flex';
                }
                function showActionOverlaySuccess(text){
                    const overlay = modal.querySelector('#notificationActionOverlay');
                    const sp = modal.querySelector('#naoSpinner');
                    const ck = modal.querySelector('#naoCheck');
                    const tx = modal.querySelector('#naoText');
                    if (!overlay) {return;}
                    if (sp) {sp.style.display = 'none';}
                    if (ck) {ck.style.display = 'block';}
                    if (tx) {tx.textContent = text || 'Done';}
                    overlay.style.display = 'flex';
                }

                // Check if current user is recipient and can acknowledge
                const currentUserId = window.currentUser?._id || window.currentUser?.id;
                const isRecipient = memo.recipient && (
                    (memo.recipient._id && memo.recipient._id.toString() === currentUserId?.toString()) ||
                    (memo.recipient.toString && memo.recipient.toString() === currentUserId?.toString())
                );
                // Check if user is the sender (should not see acknowledge button)
                const isSender = memo.sender && (
                    (memo.sender._id && memo.sender._id.toString() === currentUserId?.toString()) ||
                    (memo.sender.toString && memo.sender.toString() === currentUserId?.toString())
                );
                const acknowledgments = memo.acknowledgments || [];
                const acknowledgedUserIds = acknowledgments.map(ack =>
                    ack.userId?._id?.toString() || ack.userId?.toString()
                ).filter(Boolean);
                const isAcknowledged = isRecipient && acknowledgedUserIds.includes(currentUserId?.toString());
                // Only show acknowledge button if user is recipient AND NOT the sender
                const canAcknowledge = isRecipient && !isSender && !isAcknowledged && isActualMemo;

                const statusStr = (memo.status || '').toString();
                // Check if this is a notification about a pending memo (check metadata for original memo)
                const isNotificationAboutPending = memo.metadata &&
                    (memo.metadata.eventType === 'memo_pending_review' ||
                     memo.metadata.relatedMemoId ||
                     memo.metadata.originalMemoId);
                const isPendingStatus = ['pending_admin','PENDING_ADMIN','pending','PENDING'].includes(statusStr);
                const looksPendingBySubject = (memo.subject || '').toLowerCase().includes('pending approval');
                const isAdminUser = (window.currentUser && (window.currentUser.role === 'admin'));

                // Also check if this is a notification memo that points to a pending memo
                // If we have originalMemoId, we should fetch that memo to check its status
                const hasOriginalMemoId = memo.metadata && (memo.metadata.originalMemoId || memo.metadata.relatedMemoId);

                // Show buttons if: pending status OR notification about pending memo OR subject contains "pending approval"
                // OR if this is a notification memo with an originalMemoId (we'll fetch the original to check)
                if (!isCalendarEvent && isAdminUser && (isPendingStatus || isNotificationAboutPending || looksPendingBySubject || hasOriginalMemoId)) {
                    footer.style.display = 'flex';
                    footer.style.flexDirection = 'row';
                    footer.style.gap = '12px';
                    footer.style.justifyContent = 'flex-end';
                    footer.style.alignItems = 'center';
                    const rejectBtn = document.createElement('button');
                    rejectBtn.textContent = 'Reject';
                    rejectBtn.style.cssText = 'background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:500;font-size:14px;transition:all 0.2s;min-width:100px;';
                    rejectBtn.addEventListener('mouseenter', () => {
                        rejectBtn.style.background = '#e5e7eb';
                    });
                    rejectBtn.addEventListener('mouseleave', () => {
                        rejectBtn.style.background = '#f3f4f6';
                    });
                    const approveBtn = document.createElement('button');
                    approveBtn.textContent = 'Approve';
                    approveBtn.style.cssText = 'background:#1C89E3;color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:500;font-size:14px;transition:all 0.2s;min-width:100px;';
                    approveBtn.addEventListener('mouseenter', () => {
                        approveBtn.style.background = '#1570cd';
                    });
                    approveBtn.addEventListener('mouseleave', () => {
                        approveBtn.style.background = '#1C89E3';
                    });

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
                        if (!overlay) {return;}
                        if (tx) {tx.textContent = text || 'Processing...';}
                        if (sp) {sp.style.display = 'block';}
                        if (ck) {ck.style.display = 'none';}
                        overlay.style.display = 'flex';
                    }
                    function showOverlaySuccess(text){
                        const overlay = modal.querySelector('#notificationActionOverlay');
                        const sp = modal.querySelector('#naoSpinner');
                        const ck = modal.querySelector('#naoCheck');
                        const tx = modal.querySelector('#naoText');
                        if (!overlay) {return;}
                        if (sp) {sp.style.display = 'none';}
                        if (ck) {ck.style.display = 'block';}
                        if (tx) {tx.textContent = text || 'Done';}
                        overlay.style.display = 'flex';
                    }

                    // Use original memo id if present (pending review notifications)
                    const targetMemoId = (memo.metadata && (memo.metadata.originalMemoId || memo.metadata.relatedMemoId)) || memo._id;

                    // Function to show rejection reason modal
                    function showRejectionReasonModal() {
                        return new Promise((resolve) => {
                            const modal = document.createElement('div');
                            modal.id = 'rejectionReasonModal';
                            modal.style.cssText = `
                                display: flex;
                                position: fixed;
                                top: 0;
                                left: 0;
                                right: 0;
                                bottom: 0;
                                background: rgba(0, 0, 0, 0.5);
                                z-index: 20000;
                                align-items: center;
                                justify-content: center;
                                padding: 2rem;
                            `;

                            modal.innerHTML = `
                                <div style="
                                    background: white;
                                    border-radius: 12px;
                                    max-width: 500px;
                                    width: 100%;
                                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                                ">
                                    <div style="
                                        padding: 1.5rem;
                                        border-bottom: 1px solid #e5e7eb;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                    ">
                                        <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600; color: #111827;">Rejection Reason</h3>
                                        <button id="closeRejectionModal" style="
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
                                    <div style="padding: 1.5rem;">
                                        <label style="
                                            display: block;
                                            font-size: 0.875rem;
                                            font-weight: 500;
                                            color: #374151;
                                            margin-bottom: 0.5rem;
                                        ">Optional reason for rejection:</label>
                                        <textarea id="rejectionReasonInput" style="
                                            width: 100%;
                                            padding: 0.75rem;
                                            border: 1px solid #d1d5db;
                                            border-radius: 8px;
                                            font-size: 0.875rem;
                                            font-family: inherit;
                                            resize: vertical;
                                            min-height: 100px;
                                            box-sizing: border-box;
                                        " placeholder="Enter reason for rejection (optional)"></textarea>
                                    </div>
                                    <div style="
                                        padding: 1rem 1.5rem;
                                        border-top: 1px solid #e5e7eb;
                                        display: flex;
                                        justify-content: flex-end;
                                        gap: 0.75rem;
                                    ">
                                        <button id="cancelRejectionBtn" style="
                                            padding: 0.625rem 1.25rem;
                                            background: #f3f4f6;
                                            border: none;
                                            border-radius: 8px;
                                            font-size: 0.875rem;
                                            font-weight: 500;
                                            color: #374151;
                                            cursor: pointer;
                                            transition: all 0.2s;
                                        ">Cancel</button>
                                        <button id="confirmRejectionBtn" style="
                                            padding: 0.625rem 1.25rem;
                                            background: #2563eb;
                                            border: none;
                                            border-radius: 8px;
                                            font-size: 0.875rem;
                                            font-weight: 500;
                                            color: white;
                                            cursor: pointer;
                                            transition: all 0.2s;
                                        ">OK</button>
                                    </div>
                                </div>
                            `;

                            document.body.appendChild(modal);

                            const closeModal = () => {
                                document.body.removeChild(modal);
                            };

                            const confirm = () => {
                                const input = document.getElementById('rejectionReasonInput');
                                const reason = input ? input.value.trim() : '';
                                closeModal();
                                resolve(reason);
                            };

                            const cancel = () => {
                                closeModal();
                                resolve(null);
                            };

                            // Event listeners
                            document.getElementById('closeRejectionModal').addEventListener('click', cancel);
                            document.getElementById('cancelRejectionBtn').addEventListener('click', cancel);
                            document.getElementById('confirmRejectionBtn').addEventListener('click', confirm);

                            // Close on background click
                            modal.addEventListener('click', (e) => {
                                if (e.target === modal) {
                                    cancel();
                                }
                            });

                            // Close on Escape key
                            const escapeHandler = (e) => {
                                if (e.key === 'Escape') {
                                    cancel();
                                    document.removeEventListener('keydown', escapeHandler);
                                }
                            };
                            document.addEventListener('keydown', escapeHandler);

                            // Focus on textarea
                            setTimeout(() => {
                                const input = document.getElementById('rejectionReasonInput');
                                if (input) {input.focus();}
                            }, 100);

                            // Hover effects
                            const cancelBtn = document.getElementById('cancelRejectionBtn');
                            const confirmBtn = document.getElementById('confirmRejectionBtn');
                            const closeBtn = document.getElementById('closeRejectionModal');

                            cancelBtn.addEventListener('mouseenter', () => {
                                cancelBtn.style.background = '#e5e7eb';
                            });
                            cancelBtn.addEventListener('mouseleave', () => {
                                cancelBtn.style.background = '#f3f4f6';
                            });

                            confirmBtn.addEventListener('mouseenter', () => {
                                confirmBtn.style.background = '#1d4ed8';
                            });
                            confirmBtn.addEventListener('mouseleave', () => {
                                confirmBtn.style.background = '#2563eb';
                            });

                            closeBtn.addEventListener('mouseenter', () => {
                                closeBtn.style.background = '#f3f4f6';
                                closeBtn.style.color = '#111827';
                            });
                            closeBtn.addEventListener('mouseleave', () => {
                                closeBtn.style.background = 'none';
                                closeBtn.style.color = '#6b7280';
                            });
                        });
                    }

                    rejectBtn.onclick = async () => {
                        try {
                            const reason = await showRejectionReasonModal();
                            if (reason === null) {return;} // User cancelled
                            showOverlay('Rejecting...');
                            // Remove notification item immediately (before API call completes)
                            const notifItem = document.querySelector(`.notification-item[data-memo-id="${memo._id}"]`);
                            if (notifItem && notifItem.parentNode) {
                                notifItem.parentNode.removeChild(notifItem);
                                // Update badge count
                                const badge = document.querySelector('.notification-badge');
                                if (badge) {
                                    const currentCount = parseInt(badge.textContent) || 0;
                                    const newCount = Math.max(0, currentCount - 1);
                                    if (newCount > 0) {
                                        badge.textContent = newCount > 99 ? '99+' : newCount;
                                        badge.style.display = 'flex';
                                    } else {
                                        badge.style.display = 'none';
                                    }
                                }
                            }
                            const res = await apiFetch(`/api/log/memos/${targetMemoId}/reject`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason: reason || '' }), credentials: 'same-origin' });
                            const data = await res.json().catch(()=>({}));
                            if (!res.ok) {throw new Error(data.message || 'Failed to reject');}
                            showOverlaySuccess('Rejected');
                            // Refresh notifications to ensure archived ones are gone
                            setTimeout(()=>{ closeMemoModal(); fetchNotifications(); }, 700);
                        } catch (err) {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: err?.message || 'Failed to reject'
                            });
                            // Reload notifications on error to restore UI state
                            fetchNotifications();
                        }
                    };

                    approveBtn.onclick = async () => {
                        try {
                            showOverlay('Approving...');
                            // Remove notification item immediately (before API call completes)
                            const notifItem = document.querySelector(`.notification-item[data-memo-id="${memo._id}"]`);
                            if (notifItem && notifItem.parentNode) {
                                notifItem.parentNode.removeChild(notifItem);
                                // Update badge count
                                const badge = document.querySelector('.notification-badge');
                                if (badge) {
                                    const currentCount = parseInt(badge.textContent) || 0;
                                    const newCount = Math.max(0, currentCount - 1);
                                    if (newCount > 0) {
                                        badge.textContent = newCount > 99 ? '99+' : newCount;
                                        badge.style.display = 'flex';
                                    } else {
                                        badge.style.display = 'none';
                                    }
                                }
                            }
                            const res = await apiFetch(`/api/log/memos/${targetMemoId}/approve`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials: 'same-origin' });
                            const data = await res.json().catch(()=>({}));
                            if (!res.ok) {throw new Error(data.message || 'Failed to approve');}
                            showOverlaySuccess('Approved');
                            // Refresh notifications to ensure archived ones are gone
                            setTimeout(()=>{ closeMemoModal(); fetchNotifications(); }, 700);
                        } catch (err) {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: err?.message || 'Failed to approve'
                            });
                            // Reload notifications on error to restore UI state
                            fetchNotifications();
                        }
                    };

                    // Append buttons in order: Reject first (left), Approve second (right)
                    footer.appendChild(rejectBtn);
                    footer.appendChild(approveBtn);

                    // Ensure footer stays at bottom of modal
                    footer.style.position = 'relative';
                    footer.style.zIndex = '1';
                } else if (canAcknowledge) {
                    // Show acknowledge button for recipients
                    footer.style.display = 'flex';
                    footer.style.flexDirection = 'row';
                    footer.style.gap = '12px';
                    footer.style.justifyContent = 'flex-end';
                    footer.style.alignItems = 'center';

                    const acknowledgeBtn = document.createElement('button');
                    acknowledgeBtn.innerHTML = '<i data-lucide="check-circle" style="width: 16px; height: 16px; margin-right: 6px;"></i>Acknowledge';
                    acknowledgeBtn.style.cssText = 'background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:500;font-size:14px;transition:all 0.2s;min-width:140px;display:flex;align-items:center;justify-content:center;';

                    acknowledgeBtn.addEventListener('mouseenter', () => {
                        acknowledgeBtn.style.background = '#15803d';
                    });
                    acknowledgeBtn.addEventListener('mouseleave', () => {
                        acknowledgeBtn.style.background = '#16a34a';
                    });

                    acknowledgeBtn.onclick = async () => {
                        try {
                            acknowledgeBtn.disabled = true;
                            showActionOverlay('Acknowledging...');

                            const res = await apiFetch(`/api/log/memos/${memo._id}/acknowledge`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'same-origin'
                            });

                            const data = await res.json();
                            if (!res.ok) {
                                throw new Error(data.message || 'Failed to acknowledge memo');
                            }

                            showActionOverlaySuccess('Acknowledged');

                            // Update memo to reflect acknowledgment
                            memo.acknowledgments = data.memo?.acknowledgments || memo.acknowledgments || [];

                            // Hide button after successful acknowledgment
                            setTimeout(() => {
                                footer.style.display = 'none';
                                const overlay = modal.querySelector('#notificationActionOverlay');
                                if (overlay) {overlay.style.display = 'none';}
                            }, 700);

                            // Refresh notifications
                            if (typeof fetchNotifications === 'function') {
                                setTimeout(() => fetchNotifications(), 800);
                            }
                        } catch (err) {
                            acknowledgeBtn.disabled = false;
                            const overlay = modal.querySelector('#notificationActionOverlay');
                            if (overlay) {overlay.style.display = 'none';}

                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: err?.message || 'Failed to acknowledge memo'
                            });
                        }
                    };

                    footer.appendChild(acknowledgeBtn);

                    // Ensure footer stays at bottom of modal
                    footer.style.position = 'relative';
                    footer.style.zIndex = '1';

                    // Initialize Lucide icons for the button
                    if (window.lucide) {
                        setTimeout(() => window.lucide.createIcons(), 100);
                    }
                } else {
                    footer.style.display = 'none';
                }
            }

            // Reinitialize icons (especially important for system notifications)
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

