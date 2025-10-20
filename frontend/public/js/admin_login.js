document.addEventListener("DOMContentLoaded", () => {
  const layers = document.querySelectorAll(".layer");
  const loginCard = document.getElementById("loginCard");

  // Wait before starting animation (1 second delay)
  setTimeout(() => {
    // Animate layers sliding in one by one
    layers.forEach((layer, index) => {
      setTimeout(() => {
        layer.classList.add("active");
      }, index * 600); // 0.6s stagger between each layer
    });

    // After layers are done sliding, fade in the login form
    setTimeout(() => {
      loginCard.classList.add("show");
    }, layers.length * 600 + 400); // wait for all layers + a bit more
  }, 500); // initial delay before everything starts
});
