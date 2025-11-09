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

    // Compose button modal toggle
    const composeBtn = document.querySelector(".compose-btn");
    const composeModal = document.getElementById("composeModal");
    const closeModalBtns = document.querySelectorAll(".close-modal");

    if (composeBtn && composeModal) {
        composeBtn.addEventListener("click", () => {
            composeModal.classList.add("show");
        });

        closeModalBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                composeModal.classList.remove("show");
            });
        });
    }
});
