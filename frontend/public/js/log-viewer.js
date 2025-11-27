document.addEventListener("DOMContentLoaded", () => {
    const memoContainer = document.querySelector(".memo-container");
    const memoListArea = document.querySelector(".memo-list-area");
    const memoViewerArea = document.getElementById("memoViewerArea"); // Old side view (may not exist)
    const memoViewerModal = document.getElementById("memoViewerModal"); // New modal view
    const backBtn = document.getElementById("backBtn");

    // When memo item is clicked → open modal (or slide in viewer if old structure exists)
    document.addEventListener("click", (e) => {
        const item = e.target.closest(".memo-item");
        if (item) {
            // Check if new modal structure exists
            if (memoViewerModal) {
                // New modal structure - modal opening is handled by log.ejs script
                // No need to do anything here, the mutation observer handles it
                return;
            }

            // Old side view structure (for backward compatibility)
            if (memoContainer && memoViewerArea) {
                memoContainer.classList.add("viewer-active");
                memoListArea.classList.add("shrink");
                memoViewerArea.classList.add("active");
            }
        }
    });

    // When back button is clicked → close modal or slide out viewer
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            // Check if new modal structure exists
            if (memoViewerModal) {
                // New modal structure - close modal
                memoViewerModal.style.display = 'none';
                document.body.style.overflow = '';
                return;
            }

            // Old side view structure (for backward compatibility)
            if (memoContainer && memoViewerArea) {
                memoContainer.classList.remove("viewer-active");
                memoViewerArea.classList.remove("active");
                memoListArea.classList.remove("shrink");
            }
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
