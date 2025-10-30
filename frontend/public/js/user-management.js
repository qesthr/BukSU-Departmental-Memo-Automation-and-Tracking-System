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
        if (!dept) return '';
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
        if (d === 'ft' || d === 'food tech' || d === 'food technology') return 'Food Technology';
        if (d === 'et' || d === 'electronics tech' || d === 'electronics technology') return 'Electronics Technology';
        if (d === 'at' || d === 'automotive tech' || d === 'automotive technology') return 'Automotive Technology';
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
                <div class="checkbox-cell">
                    <input type="checkbox" class="user-checkbox" data-id="${user._id}">
                </div>
                <div class="name-cell">
                    <img src="${user.profilePicture || '/images/memofy-logo.png'}" class="user-avatar"
                         alt="${user.firstName} ${user.lastName}"
                         onerror="this.src='/images/memofy-logo.png'">
                    <div class="user-info">
                        <div class="user-name">${user.firstName} ${user.lastName}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                <div class="department-cell">${normalizeDepartment(user.department) || '-'}</div>
                <div class="role-cell">
                    <span class="role-badge ${user.role}">${user.role}</span>
                </div>
                <div class="actions-cell">
                    <div class="user-menu">
                        <button class="btn-icon user-menu-btn" data-id="${user._id}" title="Actions">
                            <i data-lucide="more-vertical"></i>
                        </button>
                        <div class="user-menu-dropdown" id="menu-${user._id}" style="display: none;">
                            <button class="menu-item edit-user" data-id="${user._id}">
                                <i data-lucide="edit-2"></i> <span>Edit All</span>
                            </button>
                            <button class="menu-item change-dept" data-id="${user._id}">
                                <i data-lucide="building"></i> <span>Change Department</span>
                            </button>
                            <button class="menu-item change-role" data-id="${user._id}">
                                <i data-lucide="user-circle"></i> <span>Change Role</span>
                            </button>
                            <button class="menu-item delete-user" data-id="${user._id}">
                                <i data-lucide="trash-2"></i> <span>Delete Account</span>
                            </button>
                        </div>
                    </div>
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
            // Validate domain before sending
            const email = String(formData.email || '').toLowerCase();
            if (!(email.endsWith('@buksu.edu.ph') || email.endsWith('@student.buksu.edu.ph'))) {
                throw new Error('Email must be @buksu.edu.ph or @student.buksu.edu.ph');
            }

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
            if (window.showMessageModal) {
                window.showMessageModal('User Invited', 'Invitation sent successfully.', 'success');
            } else {
                alert('Invitation sent successfully');
            }
        } catch (error) {
            if (window.showMessageModal) {
                window.showMessageModal('Error', error.message || 'Failed to send invitation', 'error');
            } else {
                alert(error.message || 'Failed to send invitation');
            }
        }
    }

    // Update user
    async function updateUser(userId, formData) {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error updating user');
            }

            await fetchUsers(currentFilter);
            closeModal(editUserModal);
            showNotification('User updated successfully', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // Delete user
    async function deleteUser(userId) {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error deleting user');
            }

            await fetchUsers(currentFilter);
            closeModal(deleteModal);
            showNotification('User deleted successfully', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // Event Listeners
    document.getElementById('addUserBtn').addEventListener('click', () => {
        addUserForm.reset();
        // Set sensible defaults
        const dept = document.getElementById('department');
        const role = document.getElementById('role');
        if (dept && !dept.value) { dept.value = ''; }
        if (role && !role.value) { role.value = 'faculty'; }
        openModal(addUserModal);
    });

    usersList.addEventListener('click', (e) => {
        const row = e.target.closest('.table-row');
        if (!row) {return;}

        const userId = row.dataset.id;
        const user = users.find(u => u._id === userId);

        // Handle menu button click
        if (e.target.closest('.user-menu-btn')) {
            e.stopPropagation();
            const menuBtn = e.target.closest('.user-menu-btn');
            const menuDropdown = document.getElementById(`menu-${menuBtn.dataset.id}`);

            // Close all other menus
            document.querySelectorAll('.user-menu-dropdown').forEach(m => {
                if (m.id !== menuDropdown.id) {m.style.display = 'none';}
            });

            // Toggle this menu
            if (menuDropdown.style.display === 'none' || !menuDropdown.style.display) {
                menuDropdown.style.display = 'block';
            } else {
                menuDropdown.style.display = 'none';
            }
            return;
        }

        // Handle edit button in menu
        if (e.target.closest('.edit-user')) {
            e.stopPropagation();
            if (user) {
                document.getElementById('editUserId').value = user._id;
                document.getElementById('editFirstName').value = user.firstName;
                document.getElementById('editLastName').value = user.lastName;
                document.getElementById('editDepartment').value = user.department || '';
                document.getElementById('editRole').value = user.role;
                openModal(editUserModal);
            }
            closeAllMenus();
        }

        // Handle change department
        if (e.target.closest('.change-dept')) {
            e.stopPropagation();
            if (user) {
                openChangeDepartmentModal(user);
            }
            closeAllMenus();
        }

        // Handle change role
        if (e.target.closest('.change-role')) {
            e.stopPropagation();
            if (user) {
                openChangeRoleModal(user);
            }
            closeAllMenus();
        }

        // Handle delete
        if (e.target.closest('.delete-user')) {
            e.stopPropagation();
            currentUserId = userId;
            openModal(deleteModal);
            closeAllMenus();
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            closeAllMenus();
        }
    });

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
            role: document.getElementById('editRole').value
        };
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
        if (currentUserId) {
            deleteUser(currentUserId);
            currentUserId = null;
        }
    });

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
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
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
