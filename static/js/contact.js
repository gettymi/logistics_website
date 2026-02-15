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

  // 3. Обробка форми (обов'язкове лише поле "телефон")
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetUI();

    const isPhoneValid = validatePhone();
    const phoneVal = (phoneInput.value && iti.getNumber) ? iti.getNumber().trim() : phoneInput.value.trim();

    if (!phoneVal || !isPhoneValid) {
      showAlert("Введіть коректний номер телефону.", "error");
      phoneInput.classList.add("error");
      const itiInput = document.querySelector(".iti__tel-input, .iti input");
      if (itiInput) itiInput.classList.add("error");
      alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      // Google Ads / GTM: подія конверсії при успішній відправці
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "form_submission" });
      window.location.href = "/thank-you";

    } catch (err) {
      showAlert("Сервер недоступний. Спробуйте пізніше або зателефонуйте нам.", "error");
      alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
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