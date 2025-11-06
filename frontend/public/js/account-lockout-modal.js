// Account Lockout Modal JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Account lockout modal script loaded');

    const accountLockoutModal = document.getElementById('accountLockoutModal');
    const closeLockoutModal = document.getElementById('closeLockoutModal');
    const lockoutMessage = document.getElementById('lockoutMessage');
    const timerMinutes = document.getElementById('timerMinutes');
    const timerProgress = document.querySelector('circle[fill="#1E92F3"]');

    // Close modal functions
    function closeAccountLockoutModal() {
        accountLockoutModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Show account lockout modal
    function showAccountLockoutModal(lockTimeRemaining) {
        console.log('Showing account lockout modal with', lockTimeRemaining, 'minutes remaining');

        // Update message with specific time
        lockoutMessage.textContent = `Account is temporarily locked due to too many failed login attempts. Please try again in ${lockTimeRemaining} minutes.`;

        // Start countdown timer
        startCountdownTimer(lockTimeRemaining);

        // Show modal
        accountLockoutModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Start countdown timer
    function startCountdownTimer(minutes) {
        const totalSeconds = minutes * 60;
        let remainingSeconds = totalSeconds;

        // Update timer display
        function updateTimer() {
            const remainingMinutes = Math.ceil(remainingSeconds / 60);
            timerMinutes.textContent = remainingMinutes;

            // Update progress circle
            const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
            const circumference = 2 * Math.PI * 50; // radius = 50
            const offset = circumference - (progress / 100) * circumference;
            timerProgress.style.strokeDashoffset = offset;

            if (remainingSeconds <= 0) {
                // Timer finished
                timerMinutes.textContent = '0';
                lockoutMessage.textContent = 'Account lockout has expired. You can now attempt to login again.';

                // Add a button to refresh the page
                const actions = document.querySelector('.lockout-actions');
                actions.innerHTML = `
                    <button type="button" class="btn-primary" onclick="window.location.reload()">Try Login Again</button>
                `;

                clearInterval(timerInterval);
                return;
            }

            remainingSeconds--;
        }

        // Update immediately
        updateTimer();

        // Update every second
        const timerInterval = setInterval(updateTimer, 1000);

        // Store interval ID for cleanup
        accountLockoutModal.timerInterval = timerInterval;
    }

    // Close button event listener
    if (closeLockoutModal) {
        closeLockoutModal.addEventListener('click', closeAccountLockoutModal);
    }

    // Close modal when clicking outside
    accountLockoutModal.addEventListener('click', (e) => {
        if (e.target === accountLockoutModal) {
            closeAccountLockoutModal();
        }
    });

    // Make functions globally available
    window.showAccountLockoutModal = showAccountLockoutModal;
    window.closeAccountLockoutModal = closeAccountLockoutModal;

    // Check for lockout status on page load (if coming from a failed login)
    const urlParams = new URLSearchParams(window.location.search);
    const lockoutTime = urlParams.get('lockout');
    if (lockoutTime) {
        const remainingMinutes = Math.ceil((parseInt(lockoutTime) - Date.now()) / (1000 * 60));
        if (remainingMinutes > 0) {
            showAccountLockoutModal(remainingMinutes);
        }
    }
});
