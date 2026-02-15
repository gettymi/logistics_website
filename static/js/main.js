(function () {
  "use strict";

  var header = document.getElementById("site-header");
  var nav = document.getElementById("main-nav");
  var burger = document.getElementById("burger");

  if (header && window.requestAnimationFrame) {
    var lastY = 0;
    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      if (y > 20) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
      lastY = y;
    }
    window.addEventListener("scroll", function () { requestAnimationFrame(onScroll); }, { passive: true });
  }

  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (e) {
      if (nav.classList.contains("is-open") && !nav.contains(e.target) && !burger.contains(e.target)) {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }
})();
