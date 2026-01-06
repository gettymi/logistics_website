document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  const submitBtn = document.getElementById("submitBtn");
  const alertBox = document.getElementById("formAlert");
  const phoneInput = document.getElementById("phone");

  const iti = window.intlTelInput(phoneInput, {
    initialCountry: "ua",
    separateDialCode: true,
    preferredCountries: ["ua", "pl", "de"],
    utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js",
  });


  const validatePhone = () => {
    if (phoneInput.value.trim()) {
      if (iti.isValidNumber()) {
        phoneInput.classList.remove("error");
        phoneInput.classList.add("valid");
        return true;
      } else {
        phoneInput.classList.remove("valid");
        phoneInput.classList.add("error");
        return false;
      }
    }
    return false;
  };

  phoneInput.addEventListener('keyup', validatePhone);
  phoneInput.addEventListener('change', validatePhone);

  // 3. Обробка форми
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetUI();

    const isPhoneValid = validatePhone();
    const name = form.name.value.trim();
    const message = form.message.value.trim();

    if (!name || !isPhoneValid || !message) {
      if (!isPhoneValid) {
        showAlert("Номер телефону введено некоректно. Перевірте кількість цифр.", "error");
      } else {
        showAlert("Будь ласка, заповніть усі обов'язкові поля.", "error");
      }

      form.querySelectorAll("[required]").forEach(input => {
        if (!input.value.trim()) input.classList.add("error");
      });
      return;
    }

    submitBtn.disabled = true;
    const formData = new FormData(form);
    
    formData.set("phone", iti.getNumber());

    try {
      const res = await fetch("/contact", {
        method: "POST",
        body: formData,
        headers: { "Accept": "application/json" }
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || "Помилка відправки", "error");
        return;
      }

      showAlert(" Дякуємо! Повідомлення успішно надіслано.", "success");
      form.reset();
      phoneInput.classList.remove("valid");

    } catch (err) {
      showAlert(" Сервер недоступний. Спробуйте пізніше або напишіть у месенджери.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = "block";
  }

  function resetUI() {
    alertBox.style.display = "none";
    form.querySelectorAll(".form-input, .iti input").forEach(el => el.classList.remove("error"));
  }
});