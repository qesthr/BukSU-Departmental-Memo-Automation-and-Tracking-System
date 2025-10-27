// freezeZoom.js
function freezeZoom() {
    // Disable Ctrl + +, Ctrl + -, and Ctrl + 0 zoom shortcuts
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) &&
            (event.key === '+' || event.key === '-' || event.key === '0')) {
            event.preventDefault();
        }
    });

    // Prevent zooming with mouse wheel + Ctrl
    document.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
            event.preventDefault();
        }
    }, { passive: false });
}

// Run immediately when loaded
freezeZoom();
