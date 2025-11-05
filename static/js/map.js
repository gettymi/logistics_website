let map;
let directionsService;
let directionsRenderer;
let autocompleteInputs = [];

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 50.4501, lng: 30.5234 }, // Київ
    zoom: 6,
    mapTypeControl: false,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false
  });

  // инициализация первой точки
  const firstInput = document.querySelector(".route-input");
  setupAutocomplete(firstInput);

  document.getElementById("add-point").addEventListener("click", addPoint);
  document.getElementById("build-route").addEventListener("click", buildRoute);
}

function setupAutocomplete(input) {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["geocode"], // ищет улицы, дома, города
    componentRestrictions: { country: ["ua", "pl", "ro", "hu", "sk", "cz", "de", "lt"] }, // Европа + Украина
  });

  // При выборе точки — автоматически обновляем значение поля
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      alert("Адрес не найден. Спробуйте уточнити адресу.");
      return;
    }
  });

  autocompleteInputs.push(autocomplete);
}

function addPoint() {
  const container = document.getElementById("points-list");
  const div = document.createElement("div");
  div.className = "input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "route-input";
  input.placeholder = "Введіть місто, вулицю або адресу";

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.innerHTML = "✕";
  removeBtn.addEventListener("click", () => div.remove());

  div.appendChild(input);
  div.appendChild(removeBtn);
  container.appendChild(div);

  setupAutocomplete(input);
}

function getPoints() {
  const inputs = document.querySelectorAll(".route-input");
  return Array.from(inputs).map((i) => i.value.trim()).filter((v) => v);
}

function buildRoute() {
  const points = getPoints();
  if (points.length < 2) {
    alert("Потрібно вказати щонайменше дві точки.");
    return;
  }

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).map((p) => ({ location: p, stopover: true }));

  directionsService.route(
    {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC,
      region: "UA", // регион по умолчанию Украина
    },
    (response, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(response);
        displayRouteInfo(response);
      } else {
        alert("Не вдалося побудувати маршрут: " + status);
      }
    }
  );
}

function displayRouteInfo(result) {
  const route = result.routes[0];
  let totalKm = 0;
  let html = `<h3>Відстані між точками:</h3>`;

  route.legs.forEach((leg, i) => {
    const km = leg.distance.value / 1000;
    totalKm += km;
    html += `
      <div class="leg">
        <div class="leg-header">
          <span class="leg-index">${i + 1}.</span>
          <span class="leg-from">${leg.start_address}</span>
          <span class="arrow">→</span>
          <span class="leg-to">${leg.end_address}</span>
        </div>
        <div class="leg-distance">${km.toFixed(1)} км</div>
      </div>
    `;
  });

  html += `<div class="total-distance"><strong>Загалом: ${totalKm.toFixed(1)} км</strong></div>`;
  document.getElementById("route-info").innerHTML = html;
}

window.initMap = initMap;
