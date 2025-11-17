document.addEventListener("DOMContentLoaded", () => {
    const memoContainer = document.querySelector(".memo-container");
    const memoListArea = document.querySelector(".memo-list-area");
    const memoViewerArea = document.getElementById("memoViewerArea");
    const backBtn = document.getElementById("backBtn");

    // When memo item is clicked → slide in viewer
    document.addEventListener("click", (e) => {
        const item = e.target.closest(".memo-item");
        if (item && memoContainer) {
            memoContainer.classList.add("viewer-active");
            memoListArea.classList.add("shrink");
            memoViewerArea.classList.add("active");
        }
    });

    // When back button is clicked → slide out viewer
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            memoContainer.classList.remove("viewer-active");
            memoViewerArea.classList.remove("active");
            memoListArea.classList.remove("shrink");
        });
    }

    // Compose button modal toggle (fallback for pages without log.js)
    // Note: log.js usually handles this, but this ensures it works if log.js doesn't
    const composeBtn = document.querySelector(".compose-btn");
    const composeModal = document.getElementById("composeModal");
    const closeModalBtns = document.querySelectorAll(".close-modal");

    if (composeBtn && composeModal) {
        composeBtn.addEventListener("click", () => {
            // Add show class as fallback (log.js uses inline style.display)
            composeModal.classList.add("show");
        });
    }

    // Ensure close buttons work regardless of how modal was opened
    // This handles both inline styles (from log.js) and classes (from this script)
    closeModalBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const modal = btn.closest('.modal') || composeModal;
            if (modal) {
                modal.classList.remove("show");
                modal.style.display = 'none';
            }
        });
    });
});
