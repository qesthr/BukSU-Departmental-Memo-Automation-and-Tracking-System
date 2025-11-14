(function () {
    if (typeof document === 'undefined') { return; }

    let logoutTimer = null;
    const defaultMinutes = 1440;
    const sessionOptions = new Set([1, 5, 10, 15, 30, 60, 1440]);

    function getTimeoutMinutes() {
        const settings = window.__initialUserSettings || {};
        const value = Number(settings.sessionTimeoutMinutes);
        if (sessionOptions.has(value)) {
            return value;
        }
        return defaultMinutes;
    }

    function scheduleLogout() {
        if (logoutTimer) {
            clearTimeout(logoutTimer);
        }
        const minutes = getTimeoutMinutes();
        logoutTimer = setTimeout(() => {
            window.location.href = '/auth/logout';
        }, minutes * 60 * 1000);
    }

    ['click', 'mousemove', 'keypress', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, scheduleLogout, { passive: true });
    });

    scheduleLogout();

    window.__applySessionTimeout = function (minutes) {
        if (!sessionOptions.has(minutes)) { return; }
        window.__initialUserSettings = window.__initialUserSettings || {};
        window.__initialUserSettings.sessionTimeoutMinutes = minutes;
        scheduleLogout();
    };
})();

