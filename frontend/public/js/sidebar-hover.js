// sidebar-hover.js
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.main-nav li a');

    navLinks.forEach(link => {
        const img = link.querySelector('img');
        if (!img) return;

        // determine active/inactive versions
        const normalSrc = img.src.includes('-in.')
            ? img.src
            : img.src.replace('.png', '-in.png');
        const activeSrc = img.src.includes('-in.')
            ? img.src.replace('-in.', '.')
            : img.src;


        link.addEventListener('mouseenter', () => {
            if (!link.parentElement.classList.contains('active')) {
                img.src = activeSrc;
            }
        });

        link.addEventListener('mouseleave', () => {
            if (!link.parentElement.classList.contains('active')) {
                img.src = normalSrc;
            }
        });
    });
});
