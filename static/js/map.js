let map;
let directionsService;
let directionsRenderer;
// Зберігаємо посилання на автокомплити, щоб не втрачати їх
let autocompletes = [];

// Глобальна функція для перехоплення помилок Google Maps
window.gm_authFailure = function() {
    alert("Помилка Google Maps API. Перевірте API-ключ, налаштування Referrer та Billing Account у Google Cloud Console.");
    document.getElementById("map").innerHTML = '<div style="padding:20px; text-align:center;">Карта недоступна. Зв’яжіться з адміністратором.</div>';
};

function initMap() {
  // Налаштування карти (центр на Україні)
  const kyiv = { lat: 49.0, lng: 31.0 }; // Центр України
  
  map = new google.maps.Map(document.getElementById("map"), {
    center: kyiv,
    zoom: 6,
    disableDefaultUI: true, // Прибираємо зайві кнопки Google
    zoomControl: true, // Залишаємо тільки зум
    styles: [ // Трохи висвітлюємо карту, щоб не відволікала
      { "featureType": "poi", "stylers": [{ "visibility": "off" }] }
    ]
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false, // Google сам малює маркери A і B
    polylineOptions: {
      strokeColor: "#0ea5e9", // Наш фірмовий синій
      strokeWeight: 5,
      strokeOpacity: 0.8
    }
  });

  // Ініціалізація інпутів, які вже є на сторінці (А і B)
  document.querySelectorAll(".route-input").forEach(input => setupAutocomplete(input));

  // Кнопки
  document.getElementById("add-point").addEventListener("click", addWayPoint);
  document.getElementById("build-route").addEventListener("click", buildRoute);
}

function setupAutocomplete(input) {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["geocode"],
    // Обмежуємо пошук Європою, щоб не шукало США
    componentRestrictions: { country: ["ua", "pl", "de", "cz", "sk", "hu", "ro", "md"] },
  });
  autocompletes.push(autocomplete);
}

function addWayPoint() {
  const container = document.getElementById("points-container");
  
  // Знаходимо останній інпут (Куди), щоб вставити ПЕРЕД ним
  const allRows = container.querySelectorAll(".input-row");
  const lastRow = allRows[allRows.length - 1]; // Це точка B

  // Створюємо нову точку
  const div = document.createElement("div");
  div.className = "input-row";
  
  div.innerHTML = `
    <div class="icon-marker waypoint">•</div>
    <input type="text" class="route-input" placeholder="Проміжна точка">
    <button class="remove-btn" title="Видалити">✕</button>
  `;

  // Додаємо функціонал видалення
  div.querySelector(".remove-btn").addEventListener("click", () => {
    div.remove();
  });

  // Вставляємо перед точкою B
  container.insertBefore(div, lastRow);

  // Ініціалізуємо автокомпліт для нового поля
  setupAutocomplete(div.querySelector("input"));
}

function buildRoute() {
  const inputs = Array.from(document.querySelectorAll(".route-input"));
  const points = inputs.map(i => i.value.trim()).filter(v => v !== "");

  if (points.length < 2) {
    alert("Будь ласка, вкажіть точку відправлення та прибуття.");
    return;
  }

  const origin = points[0]; // Перша точка
  const destination = points[points.length - 1]; // Остання точка
  
  // Всі точки між першою і останньою — це waypoints
  const waypoints = points.slice(1, -1).map(loc => ({
    location: loc,
    stopover: true
  }));

  const request = {
    origin: origin,
    destination: destination,
    waypoints: waypoints,
    optimizeWaypoints: true, // Google сам оптимізує порядок точок для швидкості
    travelMode: google.maps.TravelMode.DRIVING,
    unitSystem: google.maps.UnitSystem.METRIC
  };

  directionsService.route(request, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsRenderer.setDirections(result);
      displayResults(result);
    } else {
      if (status === 'ZERO_RESULTS') {
        alert("Маршрут не знайдено. Перевірте, чи є дорога між цими точками.");
      } else {
        alert("Помилка побудови маршруту: " + status);
      }
    }
  });
}

function displayResults(result) {
  const route = result.routes[0];
  let totalDist = 0;
  let totalTime = 0;
  
  let legsHtml = "";

  route.legs.forEach((leg, i) => {
    totalDist += leg.distance.value;
    totalTime += leg.duration.value;
    
    // Красивий вивід відрізків
    legsHtml += `
      <div class="leg-row">
        <span>${i+1}. ${leg.start_address.split(',')[0]} → ${leg.end_address.split(',')[0]}</span>
        <strong>${leg.distance.text}</strong>
      </div>
    `;
  });

  // Конвертуємо метри в км
  const km = (totalDist / 1000).toFixed(1);
  
  // Конвертуємо секунди в години хвилини
  const hours = Math.floor(totalTime / 3600);
  const minutes = Math.floor((totalTime % 3600) / 60);
  const timeString = hours > 0 ? `${hours} год ${minutes} хв` : `${minutes} хв`;

  // Показуємо блок результатів
  const resCard = document.getElementById("route-result");
  document.getElementById("res-distance").innerText = `${km} км`;
  document.getElementById("res-duration").innerText = timeString;
  document.getElementById("legs-details").innerHTML = legsHtml;
  
  resCard.style.display = "block";
}

// Експортуємо initMap, щоб Google Script міг його викликати
window.initMap = initMap;