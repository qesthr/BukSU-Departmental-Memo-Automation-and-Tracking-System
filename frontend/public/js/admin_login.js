document.addEventListener("DOMContentLoaded", () => {
  const layers = document.querySelectorAll(".layer");
  const loginCard = document.getElementById("loginCard");
  const container = document.querySelector(".container");

  // Delay before animation starts
  setTimeout(() => {
    // Animate layers sliding in one by one
    layers.forEach((layer, index) => {
      setTimeout(() => {
        layer.classList.add("active");
      }, index * 600);
    });

    // After all layers are done, fade in the login form
    setTimeout(() => {
      loginCard.classList.add("show");

      // 👇 After form fades in, show background image
      setTimeout(() => {
        container.classList.add("show-bg");
      }, 800); // delay ensures layers + form animation are done
    }, layers.length * 600 + 400);
  }, 900);
});
