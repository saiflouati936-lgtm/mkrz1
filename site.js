const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navlinks");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}
