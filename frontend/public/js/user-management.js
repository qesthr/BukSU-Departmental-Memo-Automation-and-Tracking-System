document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const usersList = document.getElementById('usersList');
    const addUserModal = document.getElementById('addUserModal');
    const editUserModal = document.getElementById('editUserModal');
    const deleteModal = document.getElementById('deleteModal');
    const userSearch = document.getElementById('userSearch');
    const roleFilters = document.querySelectorAll('.filter-btn');
    const addUserForm = document.getElementById('addUserForm');
    const editUserForm = document.getElementById('editUserForm');

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
        document.getElementById('totalCount').textContent = stats.total;
        document.getElementById('secretaryCount').textContent = stats.secretary;
        document.getElementById('facultyCount').textContent = stats.faculty;
    }

    // Render users list
    function renderUsers() {
        const searchTerm = userSearch.value.toLowerCase();
        const filteredUsers = users.filter(user => {
            const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
            const email = user.email.toLowerCase();
            const matchesSearch = fullName.includes(searchTerm) ||
                                email.includes(searchTerm);
            const matchesFilter = currentFilter === 'all' || user.role === currentFilter;
            return matchesSearch && matchesFilter;
        });

        usersList.innerHTML = filteredUsers.map(user => `
            <div class="table-row" data-id="${user._id}">
                <div class="checkbox-cell">
                    <input type="checkbox" class="user-checkbox">
                </div>
                <div class="name-cell">
                    <img src="/images/default-avatar.png" class="user-avatar">
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
                    <button class="btn-icon edit-user" title="Edit">
                        <i class="lucide-pencil"></i>
                    </button>
                    <button class="btn-icon delete-user" title="Delete">
                        <i class="lucide-trash-2"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Add user
    async function addUser(formData) {
        try {
            const response = await fetch('/api/users', {
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
            showNotification('User added successfully', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
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
        openModal(addUserModal);
    });

    usersList.addEventListener('click', (e) => {
        const row = e.target.closest('.table-row');
        if (!row) {return;}

        const userId = row.dataset.id;
        const user = users.find(u => u._id === userId);

        if (e.target.closest('.edit-user')) {
            if (user) {
                document.getElementById('editUserId').value = user._id;
                document.getElementById('editFirstName').value = user.firstName;
                document.getElementById('editLastName').value = user.lastName;
                document.getElementById('editDepartment').value = user.department || '';
                document.getElementById('editRole').value = user.role;
                openModal(editUserModal);
            }
        } else if (e.target.closest('.delete-user')) {
            currentUserId = userId;
            openModal(deleteModal);
        }
    });

    addUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            department: document.getElementById('department').value,
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
            department: document.getElementById('editDepartment').value,
            role: document.getElementById('editRole').value
        };
        updateUser(userId, formData);
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

    userSearch.addEventListener('input', renderUsers);

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

    // Notification helper
    function showNotification(message, type) {
        // Implement your notification system here
        console.log(`${type}: ${message}`);
    }

    // Initial load
    fetchUsers();
});
