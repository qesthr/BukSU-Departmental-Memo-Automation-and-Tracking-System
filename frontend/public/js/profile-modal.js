/* global Swal */

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
            // Use self-update endpoint for non-admins
            const response = await fetch(`/auth/me`, {
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
                // Update nav profile display (check if elements exist)
                const navProfileName = document.getElementById('navProfileName');
                const navProfileEmail = document.getElementById('navProfileEmail');
                if (navProfileName) {navProfileName.textContent = `${firstName} ${lastName}`;}
                if (navProfileEmail) {navProfileEmail.textContent = email;}

                // If profile picture was changed
                const fileInput = document.getElementById('profilePictureInput');
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    await uploadProfilePicture(userId, fileInput.files[0]);
                }

                closeModal(profileModal);

                // Smooth loading effect, then green success check, then auto‑reload
                if (typeof Swal !== 'undefined') {
                    // Step 1: loading spinner
                    Swal.fire({
                        title: 'Saving changes...',
                        text: 'Please wait a moment.',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    // Step 2: after 2s, show green success check, then reload
                    setTimeout(() => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Profile updated',
                            text: 'Your changes have been saved.',
                            confirmButtonColor: '#16a34a',
                            showConfirmButton: false,
                            timer: 1200,
                            timerProgressBar: true,
                            willClose: () => {
                                window.location.reload();
                            }
                        });
                    }, 2000);
                } else {
                    // Fallback without SweetAlert
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }
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
                const response = await fetch(`/auth/me/profile-picture`, { method: 'POST', body: formData });

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
        // Prefer SweetAlert2 when available
        if (typeof Swal !== 'undefined') {
            const isSuccess = type === 'success';
            Swal.fire({
                icon: isSuccess ? 'success' : (type === 'error' ? 'error' : 'info'),
                title: isSuccess ? 'Profile Updated' : 'Notice',
                text: message || (isSuccess ? 'Your profile has been updated successfully.' : ''),
                confirmButtonColor: isSuccess ? '#16a34a' : '#3b82f6'
            });
        } else {
            // Fallback to console if SweetAlert2 is not loaded
            console.log(`${type}: ${message}`);
        }
    }
});

