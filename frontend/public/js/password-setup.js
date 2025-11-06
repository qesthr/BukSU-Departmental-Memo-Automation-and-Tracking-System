// Function to handle password setup UI and logic
function setupPasswordModal() {
    const modalHtml = `
    <div id="setPasswordModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Set Up Password</h2>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <form id="setPasswordForm">
                    <div class="form-group">
                        <label for="password">New Password</label>
                        <input type="password" id="password" name="password" required minlength="6">
                        <small>Password must be at least 6 characters long</small>
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">Confirm Password</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Set Password</button>
                </form>
            </div>
        </div>
    </div>
    `;

    // Insert modal HTML into the document
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add CSS for the modal
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 500px;
            border-radius: 8px;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .close {
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .close:hover {
            color: black;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
        }

        .form-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .form-group small {
            color: #666;
            font-size: 12px;
        }

        .btn-primary {
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .btn-primary:hover {
            background-color: #0056b3;
        }
    `;
    document.head.appendChild(style);

    // Get modal elements
    const modal = document.getElementById('setPasswordModal');
    const closeBtn = modal.querySelector('.close');
    const form = document.getElementById('setPasswordForm');

    // Event listeners
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        try {
            const response = await fetch('/api/password/set-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password, confirmPassword })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Password set successfully! You can now use manual login.');
                modal.style.display = "none";
            } else {
                alert(data.message || 'Error setting password');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error setting password. Please try again.');
        }
    };

    // Function to show the modal
    return {
        show: () => {
            modal.style.display = "block";
        }
    };
}

// Check if user needs to set up password
async function checkPasswordStatus() {
    try {
        const response = await fetch('/api/password/has-password');
        const data = await response.json();

        if (response.ok && !data.hasPassword) {
            // Show password setup prompt for Google OAuth users
            const modal = setupPasswordModal();
            modal.show();
        }
    } catch (error) {
        console.error('Error checking password status:', error);
    }
}

// Add this to your login success handler
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (you may need to adjust this based on your auth state management)
    if (document.querySelector('.user-profile')) {
        checkPasswordStatus();
    }
});