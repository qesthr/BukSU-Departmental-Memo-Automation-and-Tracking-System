document.addEventListener('DOMContentLoaded', () => {
    if (typeof window === 'undefined') { return; }

    const state = window.__initialUserSettings = window.__initialUserSettings || {};
    state.notifications = state.notifications || { memoEmails: true, profileUpdates: true };
    const role = window.__currentUserRole || '';

    const passwordForm = document.getElementById('passwordForm');
    const passwordFeedback = document.getElementById('passwordFeedback');
    const securityFeedback = document.getElementById('securityFeedback');
    const sessionFeedback = document.getElementById('sessionFeedback');
    const notificationFeedback = document.getElementById('notificationFeedback');

    const sessionSelect = document.getElementById('sessionTimeoutSelect');

    const darkToggle = document.getElementById('darkModeToggle');
    const twoFactorToggle = document.getElementById('twoFactorToggle');
    const memoEmailToggle = document.getElementById('memoEmailToggle');
    const profileUpdateToggle = document.getElementById('profileUpdateToggle');

    function setFeedback(el, message, type = 'success') {
        if (!el || !message) { return; }
        el.textContent = message;
        el.classList.remove('success', 'error');
        el.classList.add(type);
        setTimeout(() => {
            el.textContent = '';
            el.classList.remove('success', 'error');
        }, 4000);
    }

    function applyDarkMode(enabled) {
        document.documentElement.classList.toggle('dark-mode', enabled);
        document.body && document.body.classList.toggle('dark-mode', enabled);
        state.darkMode = enabled;
    }

    async function updateSetting(payload, feedbackEl) {
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to update setting');
            }
            Object.assign(state, data.settings);
            if (payload.hasOwnProperty('darkMode')) {
                applyDarkMode(!!payload.darkMode);
            }
            if (payload.hasOwnProperty('sessionTimeoutMinutes') && typeof window.__applySessionTimeout === 'function') {
                window.__applySessionTimeout(payload.sessionTimeoutMinutes);
            }
            setFeedback(feedbackEl, 'Saved successfully', 'success');
        } catch (error) {
            console.error(error);
            setFeedback(feedbackEl, error.message || 'Failed to update setting', 'error');
        }
    }

    function applySettingsToUI() {
        if (darkToggle) {
            darkToggle.checked = !!state.darkMode;
            applyDarkMode(!!state.darkMode);
        }
        if (twoFactorToggle) {
            twoFactorToggle.checked = !!state.twoFactorEnabled;
        }
        if (sessionSelect && state.sessionTimeoutMinutes) {
            sessionSelect.value = state.sessionTimeoutMinutes.toString();
        }
        if (memoEmailToggle) {
            memoEmailToggle.checked = state.notifications ? !!state.notifications.memoEmails : true;
        }
        if (profileUpdateToggle) {
            profileUpdateToggle.checked = state.notifications ? !!state.notifications.profileUpdates : true;
        }
    }

    async function hydrateSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to load settings');
            }
            Object.assign(state, data.settings || {});
            applySettingsToUI();
        } catch (error) {
            console.warn('Unable to refresh settings:', error.message);
            applySettingsToUI();
        }
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitBtn = passwordForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                if (!submitBtn.dataset.loadingText) {
                    submitBtn.dataset.loadingText = submitBtn.textContent || 'Update Password';
                }
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving…';
            }
            const body = {
                currentPassword: passwordForm.currentPassword ? passwordForm.currentPassword.value.trim() : '',
                newPassword: passwordForm.newPassword.value.trim(),
                confirmPassword: passwordForm.confirmPassword.value.trim()
            };
            try {
                const res = await fetch('/api/password/change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Failed to change password');
                }
                passwordForm.reset();
                setFeedback(passwordFeedback, data.message || 'Password updated', 'success');
            } catch (error) {
                setFeedback(passwordFeedback, error.message || 'Failed to change password', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitBtn.dataset.loadingText || 'Update Password';
                }
            }
        });
    }

    if (darkToggle) {
        darkToggle.addEventListener('change', () => {
            updateSetting({ darkMode: darkToggle.checked }, securityFeedback || notificationFeedback || sessionFeedback);
        });
    }

    if (twoFactorToggle) {
        twoFactorToggle.addEventListener('change', () => {
            updateSetting({ twoFactorEnabled: twoFactorToggle.checked }, securityFeedback || notificationFeedback || sessionFeedback);
        });
    }

    if (sessionSelect) {
        sessionSelect.addEventListener('change', () => {
            const minutes = Number(sessionSelect.value);
            updateSetting({ sessionTimeoutMinutes: minutes }, sessionFeedback);
        });
    }

    if (memoEmailToggle) {
        memoEmailToggle.addEventListener('change', () => {
            updateSetting({
                notifications: { memoEmails: memoEmailToggle.checked }
            }, notificationFeedback || securityFeedback);
        });
    }

    if (profileUpdateToggle) {
        profileUpdateToggle.addEventListener('change', () => {
            updateSetting({
                notifications: { profileUpdates: profileUpdateToggle.checked }
            }, notificationFeedback || securityFeedback);
        });
    }

    applySettingsToUI();
    hydrateSettings();
});

