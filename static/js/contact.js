document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("contactForm");
  const phoneInput = document.querySelector("#phone");
  const submitBtn = document.getElementById("submitBtn");
  const alertBox = document.getElementById("formAlert");

  // Инициализация intl-tel-input
  const iti = window.intlTelInput(phoneInput, {
    initialCountry: "ua",
    preferredCountries: ["ua", "pl", "de", "us"],
    utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js"
  });

  // Проверка на лету
  form.querySelectorAll("input, textarea").forEach(input => {
    input.addEventListener("input", () => {
      if (input.validity.valid) input.classList.remove("error");
      else input.classList.add("error");
    });
  });

  form.addEventListener("submit", function(e) {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();
    const phoneValid = iti.isValidNumber();

    let hasError = false;

    if (!name) { form.name.classList.add("error"); hasError = true; }
    if (!phoneValid) { phoneInput.classList.add("error"); hasError = true; }
    if (!message) { form.message.classList.add("error"); hasError = true; }

    if (hasError) {
      showAlert("❌ Проверьте правильность введённых данных.", "error");
      return;
    }

    // Блокируем кнопку и отправляем
    submitBtn.disabled = true;
    const formData = new FormData(form);
    formData.set("phone", iti.getNumber()); // форматируем номер

    fetch("/contact", { method: "POST", body: formData })
      .then(res => {
        if (res.redirected) window.location.href = res.url;
        else return res.text();
      })
      .then(() => {
        showAlert("✅ Сообщение успешно отправлено!", "success");
        form.reset();
        iti.setNumber("");
      })
      .catch(() => showAlert("❌ Ошибка при отправке. Попробуйте позже.", "error"))
      .finally(() => (submitBtn.disabled = false));
  });

  function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = `alert ${type}`;
  }
});
