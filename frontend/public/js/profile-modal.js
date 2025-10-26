// Profile Edit Modal Functionality
document.addEventListener('DOMContentLoaded', () => {
    const profileSection = document.getElementById('profileSection');
    const profileModal = document.getElementById('profileEditModal');
    const profileForm = document.getElementById('profileEditForm');
    const changePicBtn = document.getElementById('changePicBtn');
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePreviewImg = document.getElementById('profilePreviewImg');

    if (!profileSection || !profileModal) {
        return;
    }

    // Open modal when profile section is clicked
    profileSection.addEventListener('click', () => {
        openModal(profileModal);
        updateModalForm();
    });

    // Handle change picture button
    if (changePicBtn) {
        changePicBtn.addEventListener('click', () => {
            profilePictureInput.click();
        });
    }

    // Handle profile picture input change
    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    profilePreviewImg.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle form submission
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateProfile();
        });
    }

    // Close modal handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        });
    });

    // Close modal when clicking outside
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeModal(profileModal);
        }
    });

    function openModal(modal) {
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }

    function updateModalForm() {
        // Form values are already set via EJS template
    }

    async function updateProfile() {
        const userId = document.getElementById('profileUserId').value;
        const firstName = document.getElementById('editProfileFirstName').value;
        const lastName = document.getElementById('editProfileLastName').value;
        const email = document.getElementById('editProfileEmail').value;

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email
                })
            });

            const data = await response.json();

            if (data.success || response.ok) {
                // Update nav profile display
                document.getElementById('navProfileName').textContent = `${firstName} ${lastName}`;
                document.getElementById('navProfileEmail').textContent = email;

                // If profile picture was changed
                const fileInput = document.getElementById('profilePictureInput');
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    uploadProfilePicture(userId, fileInput.files[0]);
                }

                showNotification('Profile updated successfully', 'success');
                closeModal(profileModal);

                // Reload page to update all references
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                showNotification(data.message || 'Error updating profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification('Error updating profile', 'error');
        }
    }

    async function uploadProfilePicture(userId, file) {
        const formData = new FormData();
        formData.append('profilePicture', file);

        try {
            const response = await fetch(`/api/users/${userId}/profile-picture`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.profilePicture) {
                    // Update profile picture in nav
                    document.getElementById('navProfileImg').src = data.profilePicture;
                }
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
        }
    }

    function showNotification(message, type) {
        // You can implement your notification system here
        console.log(`${type}: ${message}`);
    }
});

