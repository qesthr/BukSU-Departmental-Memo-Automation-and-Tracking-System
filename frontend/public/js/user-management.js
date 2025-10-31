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
    async function fetchUsers(role = 'all') {
        try {
            const response = await fetch(`/api/users?role=${role}`);
            const data = await response.json();
            users = data.users;
            updateUserCounts(data.stats);
            renderUsers();
        } catch (error) {
            showNotification('Error fetching users', 'error');
        }
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

        usersList.innerHTML = filteredUsers.map(user => `
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
                    <button class="btn-icon edit-user" data-id="${user._id}" title="Edit">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button class="btn-icon delete-user" data-id="${user._id}" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `).join('');

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
                    const data = await response.json().catch(() => ({}));
                    showConflictModal(data && data.wait ? data.wait : 30, async () => {
                        // Refresh user data then reopen modal
                        try {
                            const r = await fetch(`/api/users/${userId}`);
                            const j = await r.json();
                            const u = j && j.user ? j.user : null;
                            if (u) {
                                document.getElementById('editUserId').value = u._id;
                                document.getElementById('editFirstName').value = u.firstName;
                                document.getElementById('editLastName').value = u.lastName;
                                document.getElementById('editDepartment').value = u.department || '';
                                document.getElementById('editRole').value = u.role;
                                const lu = document.getElementById('editLastUpdatedAt');
                                if (lu) { lu.value = u.lastUpdatedAt || u.updatedAt || ''; }
                                openModal(editUserModal);
                            }
                        } catch (e) { /* ignore */ }
                    });
                    throw new Error('Conflict');
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Error updating user');
                }
            }

            await fetchUsers(currentFilter);
            closeModal(editUserModal);
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
            // no pre-locking; nothing to release
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
            if (user) {
                document.getElementById('editUserId').value = user._id;
                document.getElementById('editFirstName').value = user.firstName;
                document.getElementById('editLastName').value = user.lastName;
                document.getElementById('editDepartment').value = user.department || '';
                document.getElementById('editRole').value = user.role;
                const lu = document.getElementById('editLastUpdatedAt');
                if (lu) { lu.value = user.lastUpdatedAt || user.updatedAt || ''; }
                openModal(editUserModal);
            }
            return;
        }

        // Handle delete
        if (e.target.closest('.delete-user')) {
            e.stopPropagation();
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
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            department: normalizeDepartment(document.getElementById('department').value),
            role: document.getElementById('role').value
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

    // Close modals when clicking outside or on close button
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                closeModal(modal);
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

    // Pre-locking removed; both admins can open the edit modal freely

    // Conflict modal
    function ensureConflictModal() {
        if (document.getElementById('conflictModalOverlay')) { return; }
        const style = document.createElement('style');
        style.textContent = `#conflictModalOverlay{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;z-index:10000;opacity:0;transition:opacity .2s ease}#conflictModalOverlay.open{display:flex;opacity:1}#conflictModal{background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(2,6,23,.2);width:100%;max-width:480px;padding:24px;text-align:center}#conflictModal h3{margin:12px 0 6px 0;color:#0f172a;font-weight:600;font-size:20px}#conflictModal p{margin:0;color:#475569}.conflict-actions{margin-top:12px;display:flex;gap:8px;justify-content:center}#retryConflict{background:#1c89e3;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer}#closeConflict{background:#e2e8f0;border:1px solid #cbd5e1;border-radius:8px;padding:8px 14px;cursor:pointer}`;
        document.head.appendChild(style);
        const overlay = document.createElement('div');
        overlay.id = 'conflictModalOverlay';
        overlay.innerHTML = `<div id="conflictModal" role="dialog" aria-modal="true"><div class="warn"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div><h3>Update Conflict Detected</h3><p id="conflictMsg">Another admin has just updated this user’s information. Please wait <span id='conflictCountdown'>30</span>s before trying again.</p><div class="conflict-actions"><button id="closeConflict">Close</button><button id="retryConflict" disabled>Retry</button></div></div>`;
        document.body.appendChild(overlay);
        document.getElementById('closeConflict').onclick = () => overlay.classList.remove('open');
    }

    function showConflictModal(seconds, onRetry) {
        ensureConflictModal();
        const overlay = document.getElementById('conflictModalOverlay');
        const cd = document.getElementById('conflictCountdown');
        const retry = document.getElementById('retryConflict');
        let remaining = Math.max(1, seconds || 30);
        retry.disabled = true;
        cd.textContent = String(remaining);
        const t = setInterval(() => {
            remaining -= 1;
            cd.textContent = String(remaining);
            if (remaining <= 0) {
                clearInterval(t);
                retry.disabled = false;
            }
        }, 1000);
        retry.onclick = () => { overlay.classList.remove('open'); if (onRetry) { onRetry(); } };
        requestAnimationFrame(() => overlay.classList.add('open'));
    }

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
