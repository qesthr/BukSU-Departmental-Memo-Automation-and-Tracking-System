document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const usersList = document.getElementById('usersList');
    const addUserModal = document.getElementById('addUserModal');
    const editUserModal = document.getElementById('editUserModal');
    const deleteModal = document.getElementById('deleteModal');
    const changeDeptModal = document.getElementById('changeDeptModal');
    const changeRoleModal = document.getElementById('changeRoleModal');
    const userSearch = document.getElementById('userSearch');
    const roleFilters = document.querySelectorAll('.filter-btn');
    const addUserForm = document.getElementById('addUserForm');
    const editUserForm = document.getElementById('editUserForm');
    const changeDeptForm = document.getElementById('changeDeptForm');
    const changeRoleForm = document.getElementById('changeRoleForm');

    let users = [];
    let currentFilter = 'all';
    let currentUserId = null;
    let currentEditingUserId = null;

    // Invitation Modal (vanilla JS): spinner -> success checkmark
    function ensureInviteModal() {
        if (document.getElementById('inviteModalOverlay')) { return; }
        const style = document.createElement('style');
        style.id = 'inviteModalStyles';
        style.textContent = `
        #inviteModalOverlay{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:9999;opacity:0;transition:opacity .2s ease}
        #inviteModalOverlay.open{display:flex;opacity:1}
        #inviteModal{background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(2,6,23,.2);width:100%;max-width:420px;padding:24px;text-align:center}
        #inviteModal h3{margin:12px 0 6px 0;color:#0f172a;font-weight:600;font-size:20px}
        #inviteModal p{margin:0;color:#475569}
        .invite-spinner{width:54px;height:54px;border:4px solid #e2e8f0;border-top-color:#1c89e3;border-radius:50%;margin:0 auto 10px auto;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .check-wrap{width:64px;height:64px;border-radius:50%;background:#e8f5e9;margin:0 auto 8px auto;display:flex;align-items:center;justify-content:center}
        .check{stroke:#22c55e;stroke-width:6;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:48;stroke-dashoffset:48;animation:draw .5s ease forwards}
        @keyframes draw{to{stroke-dashoffset:0}}
        #inviteDoneBtn{margin-top:14px;background:#1c89e3;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer}
        #inviteDoneBtn:active{transform:translateY(1px)}
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'inviteModalOverlay';
        overlay.innerHTML = `
            <div id="inviteModal" role="dialog" aria-modal="true">
                <div id="inviteState"></div>
                <h3 id="inviteTitle">Sending invitation…</h3>
                <p id="inviteMessage">Please wait while we send the invitation.</p>
                <button id="inviteDoneBtn" style="display:none">Done</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('inviteDoneBtn').addEventListener('click', () => closeInviteModal());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { closeInviteModal(); } });
    }

    function openInviteLoading(titleText, messageText) {
        ensureInviteModal();
        const overlay = document.getElementById('inviteModalOverlay');
        const state = document.getElementById('inviteState');
        const title = document.getElementById('inviteTitle');
        const msg = document.getElementById('inviteMessage');
        const btn = document.getElementById('inviteDoneBtn');
        state.innerHTML = '<div class="invite-spinner"></div>';
        title.textContent = titleText || 'Processing…';
        msg.textContent = messageText || 'Please wait while we process your request.';
        btn.style.display = 'none';
        requestAnimationFrame(() => overlay.classList.add('open'));
    }

    function showInviteSuccess(successTitle, successMessage, doneText) {
        const state = document.getElementById('inviteState');
        const title = document.getElementById('inviteTitle');
        const msg = document.getElementById('inviteMessage');
        const btn = document.getElementById('inviteDoneBtn');
        state.innerHTML = '<div class="check-wrap"><svg width="40" height="40" viewBox="0 0 24 24"><path class="check" d="M6 12l4 4 8-8" /></svg></div>';
        title.textContent = successTitle || 'Success';
        msg.textContent = successMessage || '';
        btn.textContent = doneText || 'Done';
        btn.style.display = 'inline-block';
    }

    function showInviteError(message) {
        const state = document.getElementById('inviteState');
        const title = document.getElementById('inviteTitle');
        const msg = document.getElementById('inviteMessage');
        const btn = document.getElementById('inviteDoneBtn');
        state.innerHTML = '<div class="check-wrap" style="background:#fee2e2"><svg width="40" height="40" viewBox="0 0 24 24"><path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
        title.textContent = 'Failed to send invitation';
        msg.textContent = message || 'Please try again or check the user details.';
        btn.textContent = 'Done';
        btn.style.display = 'inline-block';
    }

    function closeInviteModal() {
        const overlay = document.getElementById('inviteModalOverlay');
        if (!overlay) { return; }
        overlay.classList.remove('open');
        // allow fade-out to finish
        setTimeout(() => { overlay.style.display = 'none'; }, 200);
    }

    // Fetch and render users
    let userLocks = {};
    async function fetchUsers(role = 'all') {
        try {
            const response = await fetch(`/api/users?role=${role}`);
            const data = await response.json();
            users = data.users;
            // Load lock states for each user so UI can indicate editing/disable actions
            await loadLockStates(users);
            updateUserCounts(data.stats);
            renderUsers();
        } catch (error) {
            showNotification('Error fetching users', 'error');
        }
    }

    async function loadLockStates(list) {
        userLocks = {};
        try {
            await Promise.all((list || []).map(async (u) => {
                try {
                    const r = await fetch(`/api/users/locks/${u._id}/state`);
                    const j = await r.json();
                    userLocks[u._id] = j || { locked: false };
                } catch {
                    userLocks[u._id] = { locked: false };
                }
            }));
        } catch {
            // ignore lock loading errors; leave map empty
        }
    }

    function isLockedByOther(userId) {
        const l = userLocks && userLocks[userId];
        if (!l || !l.locked) { return false; }
        const by = l.lockedBy != null ? String(l.lockedBy) : null;
        const me = window.currentUserId != null ? String(window.currentUserId) : null;
        return by && me && by !== me;
    }

    // Update user counts in filter buttons
    function updateUserCounts(stats) {
        const total = document.getElementById('totalCount');
        const admin = document.getElementById('adminCount');
        const secretary = document.getElementById('secretaryCount');
        const faculty = document.getElementById('facultyCount');
        if (total) { total.textContent = stats.total; }
        if (admin) { admin.textContent = (typeof stats.admin === 'number') ? stats.admin : ((stats.total || 0) - (stats.secretary || 0) - (stats.faculty || 0)); }
        if (secretary) { secretary.textContent = stats.secretary || 0; }
        if (faculty) { faculty.textContent = stats.faculty || 0; }
    }

    // Normalize department (long form only for IT/EMC/EMC/IT variations):
function normalizeDepartment(dept) {
        if (!dept) {return '';}
        const d = String(dept).trim().toLowerCase();
    if (
        d === 'it' ||
        d === 'emc' ||
        d === 'it/emc' ||
        d === 'it - emc' ||
        d === 'it & emc' ||
        (d.includes('information tech') && d.includes('multimedia')) ||
        (d.includes('entertainment') && d.includes('comput'))
    ) {
        return 'Information Technology and Entertainment Multimedia Computing';
        }
        if (d === 'ft' || d === 'food tech' || d === 'food technology') {return 'Food Technology';}
        if (d === 'et' || d === 'electronics tech' || d === 'electronics technology') {return 'Electronics Technology';}
        if (d === 'at' || d === 'automotive tech' || d === 'automotive technology') {return 'Automotive Technology';}
        return dept;
    }

    // Render users list
    function renderUsers() {
        // Get search term from global search input or userSearch if it exists
        let searchTerm = '';
        const globalSearchInput = document.getElementById('globalSearchInput');
        const userSearchInput = document.getElementById('userSearch');

        if (globalSearchInput) {
            searchTerm = globalSearchInput.value.toLowerCase();
        } else if (userSearchInput) {
            searchTerm = userSearchInput.value.toLowerCase();
        }

        const filteredUsers = users.filter(user => {
            const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
            const email = user.email.toLowerCase();
            const department = (user.department || '').toLowerCase();
            const role = user.role.toLowerCase();

            const matchesSearch = !searchTerm ||
                                fullName.includes(searchTerm) ||
                                email.includes(searchTerm) ||
                                department.includes(searchTerm) ||
                                role.includes(searchTerm);
            const matchesFilter = currentFilter === 'all' || user.role === currentFilter;
            return matchesSearch && matchesFilter;
        });

        usersList.innerHTML = filteredUsers.map(user => {
            const lock = userLocks[user._id] || {};
            const lockedByOther = !!(lock.locked && (String(lock.lockedBy || '') !== String(window.currentUserId || '')));
            const lockBadge = lockedByOther ? `<span class="lock-badge" style="margin-right:8px;color:#ef4444;font-size:.8rem;display:inline-flex;align-items:center;">Editing…</span>` : '';
            const editDisabled = lockedByOther ? 'disabled style="opacity:.5;cursor:not-allowed"' : '';
            const editTitle = lockedByOther ? 'Another admin is editing' : 'Edit';
            const deleteDisabled = lockedByOther ? 'disabled style="opacity:.5;cursor:not-allowed"' : '';
            const deleteTitle = lockedByOther ? 'Unavailable while editing' : 'Delete';
            return `
            <div class="table-row" data-id="${user._id}" data-index="${filteredUsers.indexOf(user)}">
                <div class="name-cell">
                    <img src="${user.profilePicture || '/images/memofy-logo.png'}" class="user-avatar"
                         alt="${user.firstName} ${user.lastName}"
                         onerror="this.src='/images/memofy-logo.png'">
                    <div class="user-info">
                        <div class="user-name">${user.firstName} ${user.lastName}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                <div class="department-cell">${user.department || '-'}</div>
                <div class="role-cell">
                    <span class="role-badge ${user.role}">${user.role}</span>
                </div>
                <div class="actions-cell">
                    ${lockBadge}
                    <button class="btn-icon edit-user" data-id="${user._id}" title="${editTitle}" ${editDisabled}>
                        <i data-lucide="edit-2"></i>
                    </button>
                    ${ (window.currentUserId && String(window.currentUserId) === String(user._id))
                        ? `<button class="btn-icon" title="You cannot delete your own account" disabled style="opacity:.5;cursor:not-allowed"><i data-lucide="trash-2"></i></button>`
                        : `<button class="btn-icon delete-user" data-id="${user._id}" title="${deleteTitle}" ${deleteDisabled}><i data-lucide="trash-2"></i></button>` }
                </div>
            </div>
        `}).join('');

        // Reinitialize Lucide icons if available
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Add user
    async function addUser(formData) {
        try {
            // Validate domain before sending (allow instructor and student domains)
            const email = String(formData.email || '').toLowerCase();
            const isInstructor = email.endsWith('@buksu.edu.ph');
            const isStudent = email.endsWith('@student.buksu.edu.ph');
            if (!isInstructor && !isStudent) {
                throw new Error('Email must be @buksu.edu.ph or @student.buksu.edu.ph');
            }

            // Show custom loading modal while sending
            openInviteLoading();

            // Send invite instead of direct creation
            const response = await fetch('/api/users/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error adding user');
            }

            await fetchUsers(currentFilter);
            closeModal(addUserModal);
            // Switch to success state in modal
            showInviteSuccess();
        } catch (error) {
            // Show error in the same modal so flow is consistent for all roles
            showInviteError(error && error.message);
        }
    }

    // Update user
    async function updateUser(userId, formData) {
        try {
            // disable edit form and show loading overlay
            setFormDisabled(editUserForm, true);
            openInviteLoading('Updating user information…', 'Please wait while we update this user.');
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                if (response.status === 409) {
                    // No conflict modal; just refresh & notify
                    try { await fetchUsers(currentFilter); } catch {}
                    await closeEditModal();
                    showToast('Update blocked: another admin has already updated this user.');
                    return;
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Error updating user');
                }
            }

            await fetchUsers(currentFilter);
            await closeEditModal();
            showInviteSuccess('User updated successfully', '', 'Done');
        } catch (error) {
            // show inline error on edit modal and re-enable form
            const errElId = 'editErrorMsg';
            let errEl = document.getElementById(errElId);
            if (!errEl) {
                errEl = document.createElement('div');
                errEl.id = errElId;
                errEl.style.color = '#ef4444';
                errEl.style.fontSize = '.85rem';
                errEl.style.marginTop = '6px';
                editUserForm.appendChild(errEl);
            }
            if (error && error.message === 'Conflict') {
                errEl.textContent = 'Another admin just updated this user.';
            } else {
                errEl.textContent = error && error.message ? error.message : 'Failed to update user. Please try again.';
            }
            setFormDisabled(editUserForm, false);
            closeInviteModal();
        }
    }

    // Delete user (API only). UI feedback handled by runDeleteFlow
    async function deleteUser(userId) {
        const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        if (!response.ok) {
            let message = 'Error deleting user';
            try { const e = await response.json(); message = e.message || message; } catch (err) { /* ignore */ }
            throw new Error(message);
        }
        return true;
    }

    // Event Listeners
    document.getElementById('addUserBtn').addEventListener('click', () => {
        addUserForm.reset();
        // Set sensible defaults
        const dept = document.getElementById('department');
        const role = document.getElementById('role');
        if (dept && !dept.value) { dept.value = ''; }
        if (role && !role.value) { role.value = 'faculty'; }
        // Email hint behavior
        const emailInputEl = document.getElementById('email');
        const emailHintEl = document.getElementById('emailHint');
        if (emailInputEl && emailHintEl) {
            const setState = (valid) => {
                if (valid) {
                    emailHintEl.style.display = 'none';
                    emailInputEl.classList.remove('input-error');
                } else {
                    emailHintEl.style.display = 'block';
                    emailInputEl.classList.add('input-error');
                }
            };
            // initial state hidden until focus
            emailHintEl.style.display = 'none';
            emailInputEl.classList.remove('input-error');

            const evaluate = () => {
                emailInputEl.value = (emailInputEl.value || '').toLowerCase();
                const v = emailInputEl.value;
                const valid = v.endsWith('@buksu.edu.ph') || v.endsWith('@student.buksu.edu.ph');
                setState(valid);
            };

            emailInputEl.addEventListener('focus', () => {
                // On focus, show hint unless already valid
                evaluate();
                const v = (emailInputEl.value || '').toLowerCase();
                if (!(v.endsWith('@buksu.edu.ph') || v.endsWith('@student.buksu.edu.ph'))) {
                    emailHintEl.style.display = 'block';
                }
            });
            emailInputEl.addEventListener('input', evaluate);
            emailInputEl.addEventListener('blur', () => {
                // On blur, keep visible if invalid; hide if valid
                const v = (emailInputEl.value || '').toLowerCase();
                const valid = v.endsWith('@buksu.edu.ph') || v.endsWith('@student.buksu.edu.ph');
                setState(valid);
            });
        }
        openModal(addUserModal);
    });

    usersList.addEventListener('click', async (e) => {
        const row = e.target.closest('.table-row');
        if (!row) {return;}

        const userId = row.dataset.id;
        const user = users.find(u => u._id === userId);

        // Handle edit
        if (e.target.closest('.edit-user')) {
            e.stopPropagation();
            if (isLockedByOther(userId)) {
                showToast('Another admin is editing this user.');
                return;
            }
            if (user) {
                const acquired = await acquireEditLock(user._id);
                if (!acquired) { return; }
                populateAndOpenEdit(user);
            }
            return;
        }

        // Handle delete
        if (e.target.closest('.delete-user')) {
            e.stopPropagation();
            if (isLockedByOther(userId)) {
                showToast('Cannot delete while another admin is editing this user.');
                return;
            }
            currentUserId = userId;
            resetDeleteModal();
            openModal(deleteModal);
            trapFocus(deleteModal, ['cancelDelete','confirmDelete']);
            return;
        }

        // Inline quick actions removed: no menu dropdowns
    });

    // Fallback global delegation in case icon click misses row handler
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-user');
        if (!btn) { return; }
        const row = btn.closest('.table-row');
        if (!row) { return; }
        currentUserId = row.dataset.id;
        resetDeleteModal();
        openModal(deleteModal);
        trapFocus(deleteModal, ['cancelDelete','confirmDelete']);
    });

    // Close menu when clicking outside
    // document.addEventListener('click', (e) => { ... })

    addUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const roleVal = document.getElementById('role').value;
        const depVal = normalizeDepartment(document.getElementById('department').value);
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            department: roleVal === 'admin' ? '' : depVal,
            role: roleVal
        };
        addUser(formData);
    });

    editUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = document.getElementById('editUserId').value;
        const formData = {
            firstName: document.getElementById('editFirstName').value,
            lastName: document.getElementById('editLastName').value,
            department: normalizeDepartment(document.getElementById('editDepartment').value),
            role: document.getElementById('editRole').value,
            lastUpdatedAt: document.getElementById('editLastUpdatedAt').value
        };
        // Include isActive flag
        const activeBox = document.getElementById('editIsActive');
        if (activeBox) {
            formData.isActive = !!activeBox.checked;
        }
        // Include canCrossSend only when role is secretary
        const roleVal = formData.role;
        const canCrossEl = document.getElementById('editCanCrossSend');
        if (roleVal === 'secretary' && canCrossEl) {
            formData.canCrossSend = !!canCrossEl.checked;
        }
        const errEl = document.getElementById('editErrorMsg');
        if (errEl) { errEl.textContent = ''; }
        updateUser(userId, formData);
    });

    // Change department form handler
    changeDeptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = document.getElementById('changeDeptUserId').value;
        const newDept = document.getElementById('changeDeptNewDept').value;
        updateUserDepartment(userId, normalizeDepartment(newDept));
    });

    // Change role form handler
    changeRoleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = document.getElementById('changeRoleUserId').value;
        const newRole = document.getElementById('changeRoleNewRole').value;
        updateUserRole(userId, newRole);
    });

    document.getElementById('confirmDelete').addEventListener('click', () => {
        if (!currentUserId) {return;}
        runDeleteFlow(currentUserId);
    });

    function resetDeleteModal() {
        const msg = document.getElementById('deleteMessage');
        const state = document.getElementById('deleteState');
        const cancelBtn = document.getElementById('cancelDelete');
        const deleteBtn = document.getElementById('confirmDelete');
        msg.textContent = 'Are you sure you want to delete this user? This action cannot be undone.';
        state.innerHTML = '';
        cancelBtn.disabled = false;
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = 'Delete';
        // focus primary action
        setTimeout(() => deleteBtn.focus(), 0);
    }

    function showDeletingState() {
        const msg = document.getElementById('deleteMessage');
        const state = document.getElementById('deleteState');
        const cancelBtn = document.getElementById('cancelDelete');
        const deleteBtn = document.getElementById('confirmDelete');
        cancelBtn.disabled = true;
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:#ef4444;border-radius:50%;display:inline-block;vertical-align:middle;margin-right:6px;animation:spin .9s linear infinite"></span>Deleting…';
        state.innerHTML = '<span class="spinner"></span>';
        msg.textContent = 'Deleting user… please wait';
    }

    function showDeleteSuccess() {
        const msg = document.getElementById('deleteMessage');
        const state = document.getElementById('deleteState');
        state.innerHTML = '<span class="checkwrap"><svg width="24" height="24" viewBox="0 0 24 24"><path class="check" d="M6 12l4 4 8-8"/></svg></span>';
        msg.textContent = 'User deleted successfully!';
    }

    async function runDeleteFlow(userId) {
        showDeletingState();
        try {
            await deleteUser(userId);
            showDeleteSuccess();
            // close after short delay and refresh list
            setTimeout(() => {
                closeModal(deleteModal);
                currentUserId = null;
                fetchUsers(currentFilter);
            }, 1600);
        } catch (err) {
            // revert minimal UI and show message
            const msg = document.getElementById('deleteMessage');
            msg.textContent = (err && err.message) ? err.message : 'Failed to delete user';
            const cancelBtn = document.getElementById('cancelDelete');
            const deleteBtn = document.getElementById('confirmDelete');
            cancelBtn.disabled = false;
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = 'Delete';
        }
    }

    function trapFocus(container, ids) {
        const focusables = ids.map(id => document.getElementById(id)).filter(Boolean);
        if (focusables.length === 0) {return;}
        function onKey(e){
            if (e.key !== 'Tab') {return;}
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        container.addEventListener('keydown', onKey, { once: true, capture: true });
    }

    roleFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            roleFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.role;
            fetchUsers(currentFilter);
        });
    });

    // Expose to global scope for contextual search
    window.userManagementLoaded = true;
    window.renderUsers = renderUsers;

    // Initial fetch
    fetchUsers();

    // Modal helpers
    function openModal(modal) {
        if (!modal) { return; }
        modal.style.display = 'block';
        modal.classList.add('open');
    }

    function closeModal(modal) {
        if (!modal) { return; }
        modal.classList.remove('open');
        setTimeout(() => { modal.style.display = 'none'; }, 200);
    }

    function cleanupEditLockState() {
        if (editCountdownTimer) {
            clearInterval(editCountdownTimer);
            editCountdownTimer = null;
        }
        if (editInactivityTimer) {
            clearTimeout(editInactivityTimer);
            editInactivityTimer = null;
        }
        secondsRemaining = 30;
        window.__editArmed = false;
    }

    async function releaseEditLock(userId) {
        if (!userId) { return; }
        try { await fetch(`/api/users/unlock-user/${userId}`, { method: 'POST' }); } catch {}
    }

    async function closeEditModal({ release = true } = {}) {
        cleanupEditLockState();
        const id = currentEditingUserId || document.getElementById('editUserId').value;
        currentEditingUserId = null;
        if (release && id) {
            await releaseEditLock(id);
        }
        if (id) {
            userLocks[id] = { locked: false };
            renderUsers();
        }
        setFormDisabled(editUserForm, false);
        closeModal(editUserModal);
    }

    // Close modals when clicking outside or on close button
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                if (modal === editUserModal) {
                    closeEditModal();
                } else {
                    closeModal(modal);
                }
            }
        });
    });

    // Close all menus
    function closeAllMenus() {
        document.querySelectorAll('.user-menu-dropdown').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    function setFormDisabled(form, disabled) {
        if (!form) { return; }
        Array.from(form.elements || []).forEach(el => { el.disabled = !!disabled; });
    }

    // --- 2PL Locking Frontend Helpers ---
    let editInactivityTimer;
    let editCountdownTimer;
    let secondsRemaining = 30;

    async function acquireEditLock(userId) {
        try {
            const res = await fetch(`/api/users/lock-user/${userId}`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                showLockBusyModal((data && data.remaining) || 30, userId);
                return false;
            }
            currentEditingUserId = userId;
            startEditTimers(userId);
            return true;
        } catch {
            return true; // fail-open
        }
    }

    function startEditTimers(userId) {
        secondsRemaining = 30;
        const badge = ensureEditCountdownBadge();
        badge.textContent = `Editing lock: ${secondsRemaining}s`;
        if (editCountdownTimer) {clearInterval(editCountdownTimer);}
        editCountdownTimer = setInterval(() => {
            secondsRemaining -= 1;
            if (secondsRemaining <= 0) {
                clearInterval(editCountdownTimer);
                // Only expire if user actually interacted
                if (window.__editArmed) { autoCloseEdit(userId, 'Session expired — no activity detected.'); }
                else { secondsRemaining = 30; }
            } else {
                badge.textContent = `Editing lock: ${secondsRemaining}s`;
            }
        }, 1000);

        // Arm inactivity only after first interaction
        window.__editArmed = false;
        const arm = () => { window.__editArmed = true; resetInactivity(userId); };
        ['input','keydown','click','mousemove'].forEach(evt => {
            editUserForm.addEventListener(evt, arm, { passive: true, once: true });
        });
        // Keep-alive on continued interactions
        ['input','keydown','click','mousemove'].forEach(evt => {
            editUserForm.addEventListener(evt, () => { if (window.__editArmed) { resetInactivity(userId); } }, { passive: true });
        });
    }

    function resetInactivity(userId) {
        if (editInactivityTimer) {clearTimeout(editInactivityTimer);}
        secondsRemaining = 30;
        const targetId = userId || currentEditingUserId;
        if (targetId) {
            fetch(`/api/users/lock-user/${targetId}/refresh`, { method: 'POST' }).catch(() => {});
            editInactivityTimer = setTimeout(() => autoCloseEdit(targetId, 'Session expired — no activity detected.'), 30000);
        }
    }

    function ensureEditCountdownBadge() {
        let badge = document.getElementById('editLockCountdown');
        if (!badge) {
            const header = editUserModal.querySelector('.modal-header');
            badge = document.createElement('div');
            badge.id = 'editLockCountdown';
            badge.style.marginLeft = 'auto';
            badge.style.fontSize = '.85rem';
            badge.style.color = '#64748b';
            header && header.appendChild(badge);
        }
        return badge;
    }

    async function autoCloseEdit(userId, message) {
        await releaseEditLock(userId);
        await closeEditModal({ release: false });
        showToast(message || 'Session ended');
    }

    function showLockBusyModal(seconds, userId) {
        ensureConflictModal();
        const overlay = document.getElementById('conflictModalOverlay');
        const cd = document.getElementById('conflictCountdown');
        const retry = document.getElementById('retryConflict');
        let remaining = Math.max(1, seconds || 30);
        retry.disabled = true;
        cd.textContent = String(remaining);
        // Poll lock state from server every 2s to sync countdown
        const poll = setInterval(async () => {
            try {
                const r = await fetch(`/api/users/locks/${userId}/state`);
                const j = await r.json();
                if (j && j.locked) {
                    remaining = j.remaining_seconds || j.remaining || remaining;
                    cd.textContent = String(Math.max(0, remaining));
                } else {
                    clearInterval(poll);
                    overlay.classList.remove('open');
                    retry.disabled = false;
                }
            } catch {}
        }, 2000);
        retry.onclick = () => { overlay.classList.remove('open'); };
        requestAnimationFrame(() => overlay.classList.add('open'));
    }

    function populateAndOpenEdit(user) {
        document.getElementById('editUserId').value = user._id;
        document.getElementById('editFirstName').value = user.firstName;
        document.getElementById('editLastName').value = user.lastName;
        const depSel = document.getElementById('editDepartment');
        depSel.value = user.department || '';
        const roleSel = document.getElementById('editRole');
        roleSel.value = user.role;
        // Active checkbox (show and set state)
        const activeBox = document.getElementById('editIsActive');
        const activeGroup = document.getElementById('editActiveGroup');
        if (activeGroup) { activeGroup.style.display = 'flex'; }
        if (activeBox) { activeBox.checked = (user.isActive !== false); }
        // Disable/clear department for admins
        if (user.role === 'admin') {
            depSel.disabled = true;
            depSel.value = '';
        } else {
            depSel.disabled = false;
        }
        // Toggle canCrossSend checkbox visibility for secretaries
        const ccGroup = document.getElementById('editCanCrossSendGroup');
        const ccBox = document.getElementById('editCanCrossSend');
        if (user.role === 'secretary') {
            if (ccGroup) ccGroup.style.display = 'flex';
            if (ccBox) ccBox.checked = !!user.canCrossSend;
        } else {
            if (ccGroup) ccGroup.style.display = 'none';
            if (ccBox) ccBox.checked = false;
        }
        const isSelf = window.currentUserId && String(window.currentUserId) === String(user._id);
        const note = document.getElementById('selfEditNote');
        if (isSelf) {
            roleSel.disabled = true;
            // Prevent self-deactivation
            if (activeBox) { activeBox.checked = true; activeBox.disabled = true; }
            if (note) { note.style.display = 'block'; }
        } else {
            roleSel.disabled = false;
            if (activeBox) { activeBox.disabled = false; }
            if (note) { note.style.display = 'none'; }
        }
        const lu = document.getElementById('editLastUpdatedAt');
        if (lu) { lu.value = user.lastUpdatedAt || user.updatedAt || ''; }
        openModal(editUserModal);
    }

    // Update canCrossSend visibility on role change in the edit form
    (function wireRoleChange(){
        const roleSel = document.getElementById('editRole');
        if (!roleSel) return;
        roleSel.addEventListener('change', () => {
            const ccGroup = document.getElementById('editCanCrossSendGroup');
            const ccBox = document.getElementById('editCanCrossSend');
            const depSel = document.getElementById('editDepartment');
            if (roleSel.value === 'secretary') {
                if (ccGroup) ccGroup.style.display = 'flex';
                if (depSel) depSel.disabled = false;
            } else {
                if (ccGroup) ccGroup.style.display = 'none';
                if (ccBox) ccBox.checked = false;
                if (roleSel.value === 'admin') {
                    if (depSel) { depSel.disabled = true; depSel.value = ''; }
                } else {
                    if (depSel) depSel.disabled = false;
                }
            }
        });
    })();

    // Subscribe to SSE notifications for toasts
    (function initSSE(){
        try {
            const es = new EventSource('/events');
            es.addEventListener('edit_success', (ev) => {
                try { const d = JSON.parse(ev.data); showToast(`${d.editorName || 'An admin'} updated ${d.name || 'a user'}`); fetchUsers(currentFilter); } catch {}
            });
            es.addEventListener('lock_released', (ev) => {
                try { const d = JSON.parse(ev.data); /* could update lock UI */ } catch {}
                // Refresh to reflect availability
                fetchUsers(currentFilter);
            });
            es.addEventListener('lock_acquired', (ev) => {
                // Another admin started editing: refresh to disable buttons
                fetchUsers(currentFilter);
            });
        } catch {}
    })();

    // Simple toast
    function showToast(msg){
        let el = document.getElementById('globalToast');
        if (!el){
            el = document.createElement('div');
            el.id = 'globalToast';
            el.style.position = 'fixed';
            el.style.right = '16px';
            el.style.bottom = '16px';
            el.style.background = '#0f172a';
            el.style.color = '#fff';
            el.style.padding = '10px 14px';
            el.style.borderRadius = '8px';
            el.style.boxShadow = '0 10px 30px rgba(2,6,23,.2)';
            el.style.zIndex = '10001';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    // Pre-locking removed; both admins can open the edit modal freely

    // Conflict modal removed; we use toast + refresh instead

    // Prompt to change department
    // Open change department modal
    function openChangeDepartmentModal(user) {
        document.getElementById('changeDeptUserId').value = user._id;
        document.getElementById('changeDeptUserName').textContent = `Department for ${user.firstName} ${user.lastName} (Current: ${user.department || 'None'})`;
        document.getElementById('changeDeptNewDept').value = user.department || '';
        openModal(changeDeptModal);
    }

    // Open change role modal
    function openChangeRoleModal(user) {
        document.getElementById('changeRoleUserId').value = user._id;
        document.getElementById('changeRoleUserName').textContent = `Role for ${user.firstName} ${user.lastName} (Current: ${user.role})`;
        document.getElementById('changeRoleNewRole').value = user.role;
        openModal(changeRoleModal);
    }

    // Update department only
    async function updateUserDepartment(userId, department) {
        try {
            const user = users.find(u => u._id === userId);
            if (!user) {return;}

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    department: department
                })
            });

            if (!response.ok) {
                throw new Error('Error updating department');
            }

            showNotification('Department updated successfully', 'success');
            closeModal(changeDeptModal);
            fetchUsers(currentFilter);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // Update role only
    async function updateUserRole(userId, role) {
        try {
            const user = users.find(u => u._id === userId);
            if (!user) {return;}

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: role,
                    department: user.department
                })
            });

            if (!response.ok) {
                throw new Error('Error updating role');
            }

            showNotification('Role updated successfully', 'success');
            closeModal(changeRoleModal);
            fetchUsers(currentFilter);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // Notification helper
    function showNotification(message, type) {
        // Implement your notification system here
        console.log(`${type}: ${message}`);
    }

    // Initial load
    fetchUsers();
});
