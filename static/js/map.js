/**
 * Leaflet + OpenStreetMap + OSRM — побудова маршруту (відстань і час).
 * Без цінника; вартість розраховується індивідуально.
 */
(function () {
  "use strict";

  var NOMINATIM_UA = "Vezemo24/1.0 (https://vezemo24.com)";
  var KYIV = [50.4501, 30.5234];
  var NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  var NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
  var OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

  var map = null;
  var routeLayer = null;
  var markersLayer = null;
  var mapClickMode = false;
  var mapClickHint = null;
  var autocompleteDropdown = null;
  var autocompleteTimer = null;
  var lastSearchAbort = null;
  var currentRouteData = null; // { distance: meters, duration: seconds }

  function initMap() {
    if (map) return;
    var el = document.getElementById("map");
    if (!el) return;

    map = L.map("map", {
      center: KYIV,
      zoom: 10,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);

    document.getElementById("add-point")?.addEventListener("click", addWayPoint);
    document.getElementById("add-point-map")?.addEventListener("click", enableMapClickMode);
    document.getElementById("build-route")?.addEventListener("click", buildRoute);
    document.getElementById("clear-route")?.addEventListener("click", clearRoute);

    var vehicleRadios = document.querySelectorAll('input[name="vehicle"]');
    vehicleRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        syncServicePanel();
        recalculatePrice();
      });
    });
    syncServicePanel();
    var samosvalServiceRadios = document.querySelectorAll('#services-samosval input[name="service"]');
    samosvalServiceRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        syncSamosvalQuantityBlock();
        recalculatePrice();
      });
    });
    var busServiceRadios = document.querySelectorAll('#services-bus input[name="service"]');
    busServiceRadios.forEach(function (radio) {
      radio.addEventListener("change", recalculatePrice);
    });
    var quantityInput = document.getElementById("samosval-quantity");
    if (quantityInput) {
      quantityInput.addEventListener("input", recalculatePrice);
      quantityInput.addEventListener("change", recalculatePrice);
    }

    map.on("click", onMapClick);

    createAutocompleteDropdown();
    document.querySelectorAll("#points-container .route-input").forEach(function (inp) {
      if (!inp.readOnly) setupAutocomplete(inp);
    });
  }

  function createAutocompleteDropdown() {
    if (autocompleteDropdown) return;
    autocompleteDropdown = document.createElement("div");
    autocompleteDropdown.className = "autocomplete-dropdown";
    autocompleteDropdown.setAttribute("role", "listbox");
    document.body.appendChild(autocompleteDropdown);
  }

  function searchAddresses(query) {
    if (!query || query.length < 2) return Promise.resolve([]);
    var params = new URLSearchParams({
      q: query,
      format: "json",
      limit: 6,
      countrycodes: "ua",
    });
    return fetch(NOMINATIM_URL + "?" + params, {
      headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!Array.isArray(data)) return [];
        return data.map(function (d) {
          return {
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            display: d.display_name,
          };
        });
      })
      .catch(function () { return []; });
  }

  function showAutocomplete(input, results) {
    if (!autocompleteDropdown) return;
    var rect = input.getBoundingClientRect();
    autocompleteDropdown.style.left = rect.left + "px";
    autocompleteDropdown.style.top = (rect.bottom + 2) + "px";
    autocompleteDropdown.style.width = Math.max(rect.width, 280) + "px";
    autocompleteDropdown.innerHTML = "";
    if (!results.length) {
      autocompleteDropdown.classList.add("autocomplete-dropdown--empty");
      autocompleteDropdown.innerHTML = '<div class="autocomplete-item autocomplete-item--hint">Нічого не знайдено</div>';
    } else {
      autocompleteDropdown.classList.remove("autocomplete-dropdown--empty");
      results.forEach(function (r) {
        var div = document.createElement("div");
        div.className = "autocomplete-item";
        div.setAttribute("role", "option");
        div.textContent = r.display;
        div.addEventListener("click", function () {
          selectAutocompleteItem(input, r);
        });
        autocompleteDropdown.appendChild(div);
      });
    }
    autocompleteDropdown.style.display = "block";
  }

  function selectAutocompleteItem(input, item) {
    input.value = item.display;
    var row = input.closest(".input-row");
    if (row && !row.classList.contains("input-row-map")) {
      row.setAttribute("data-lat", item.lat);
      row.setAttribute("data-lng", item.lng);
    }
    hideAutocomplete();
    input.blur();
  }

  function hideAutocomplete() {
    if (autocompleteDropdown) autocompleteDropdown.style.display = "none";
  }

  function setupAutocomplete(input) {
    if (input._autocompleteSetup) return;
    input._autocompleteSetup = true;

    input.addEventListener("input", function () {
      var row = input.closest(".input-row");
      if (row && row.getAttribute("data-lat") != null) {
        row.removeAttribute("data-lat");
        row.removeAttribute("data-lng");
        row.classList.remove("input-row-map");
        if (row._mapMarker && row._mapMarker.remove) row._mapMarker.remove();
        row._mapMarker = null;
      }
      if (row && row.classList.contains("input-row-map")) return;
      if (autocompleteTimer) clearTimeout(autocompleteTimer);
      var value = input.value.trim();
      if (value.length < 2) {
        hideAutocomplete();
        if (row) { row.removeAttribute("data-lat"); row.removeAttribute("data-lng"); }
        return;
      }
      autocompleteTimer = setTimeout(function () {
        autocompleteTimer = null;
        searchAddresses(value).then(function (results) {
          showAutocomplete(input, results);
        });
      }, 400);
    });

    input.addEventListener("focus", function () {
      var value = input.value.trim();
      if (value.length >= 2) searchAddresses(value).then(function (results) { showAutocomplete(input, results); });
    });

    input.addEventListener("blur", function () {
      setTimeout(hideAutocomplete, 220);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideAutocomplete();
    });
  }

  function geocode(query) {
    var params = new URLSearchParams({
      q: query,
      format: "json",
      limit: 1,
    });
    return fetch(NOMINATIM_URL + "?" + params, {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_UA,
      },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data[0]) return null;
        var d = data[0];
        return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), display: d.display_name };
      });
  }

  function reverseGeocode(lat, lng) {
    var params = new URLSearchParams({
      lat: lat,
      lon: lng,
      format: "json",
    });
    return fetch(NOMINATIM_REVERSE + "?" + params, {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_UA,
      },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        return data && data.display_name ? data.display_name : "Точка на карті";
      })
      .catch(function () { return "Точка на карті"; });
  }

  function enableMapClickMode() {
    mapClickMode = true;
    if (mapClickHint) mapClickHint.remove();
    mapClickHint = L.popup({ closeButton: true, autoClose: false })
      .setLatLng(map.getCenter())
      .setContent("<strong>Натисніть на карту</strong>, щоб додати точку маршруту.")
      .openOn(map);
    map.getContainer().classList.add("map-click-mode");
  }

  function onMapClick(e) {
    if (!mapClickMode) return;
    mapClickMode = false;
    map.getContainer().classList.remove("map-click-mode");
    if (mapClickHint) {
      mapClickHint.remove();
      mapClickHint = null;
    }
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;
    var container = document.getElementById("points-container");
    var rows = Array.from(container.querySelectorAll(".input-row"));
    if (rows.length === 0) return;
    var firstRow = rows[0];
    var lastRow = rows[rows.length - 1];
    function rowIsEmpty(row) {
      var inp = row.querySelector(".route-input");
      var hasCoords = row.getAttribute("data-lat") != null && row.getAttribute("data-lng") != null;
      var hasValue = inp && inp.value.trim().length > 0;
      return !hasCoords && !hasValue;
    }
    if (rowIsEmpty(firstRow)) {
      fillRowWithMapPoint(firstRow, lat, lng);
      return;
    }
    if (rows.length >= 2 && rowIsEmpty(lastRow)) {
      fillRowWithMapPoint(lastRow, lat, lng);
      return;
    }
    addRowFromMapClick(lat, lng);
  }

  function fillRowWithMapPoint(row, lat, lng) {
    if (row._mapMarker && row._mapMarker.remove) row._mapMarker.remove();
    row.setAttribute("data-lat", lat);
    row.setAttribute("data-lng", lng);
    row.classList.add("input-row-map");
    var inp = row.querySelector(".route-input");
    if (!inp) return;
    inp.value = "Точка на карті…";
    reverseGeocode(lat, lng).then(function (label) {
      inp.value = label;
    });
    var marker = L.marker([lat, lng]).addTo(markersLayer);
    marker.bindPopup(inp.value || "Точка на карті");
    row._mapMarker = marker;
  }

  function addRowFromMapClick(lat, lng) {
    var container = document.getElementById("points-container");
    var rows = container.querySelectorAll(".input-row");
    var lastRow = rows[rows.length - 1];

    var div = document.createElement("div");
    div.className = "input-row input-row-map";
    div.setAttribute("data-lat", lat);
    div.setAttribute("data-lng", lng);
    div.innerHTML =
      '<div class="icon-marker waypoint">•</div>' +
      '<input type="text" class="route-input" placeholder="Точка на карті" readonly>' +
      '<button class="remove-btn" title="Видалити">✕</button>';
    var inp = div.querySelector(".route-input");
    inp.value = "Точка на карті…";
    reverseGeocode(lat, lng).then(function (label) {
      inp.value = label;
    });
    var marker = L.marker([lat, lng]).addTo(markersLayer);
    marker.bindPopup(inp.value || "Точка на карті");
    div._mapMarker = marker;
    div.querySelector(".remove-btn").addEventListener("click", function () {
      if (div._mapMarker && div._mapMarker.remove) div._mapMarker.remove();
      div.remove();
    });
    container.insertBefore(div, lastRow);

    inp.addEventListener("change", function () {
      marker.getPopup().setContent(inp.value || "Точка на карті");
    });
  }

  function syncServicePanel() {
    var vehicleRadio = document.querySelector('input[name="vehicle"]:checked');
    var vehicle = vehicleRadio ? vehicleRadio.value : "bus";
    var busPanel = document.getElementById("services-bus");
    var samosvalPanel = document.getElementById("services-samosval");
    var quantityBlock = document.getElementById("samosval-quantity-block");
    if (busPanel && samosvalPanel) {
      if (vehicle === "samosval") {
        busPanel.style.display = "none";
        samosvalPanel.style.display = "flex";
        var firstSamosval = samosvalPanel.querySelector('input[name="service"]');
        if (firstSamosval) firstSamosval.checked = true;
        if (quantityBlock) quantityBlock.style.display = "flex";
        syncSamosvalQuantityBlock();
      } else {
        busPanel.style.display = "flex";
        samosvalPanel.style.display = "none";
        var firstBus = busPanel.querySelector('input[name="service"]');
        if (firstBus) firstBus.checked = true;
        if (quantityBlock) quantityBlock.style.display = "none";
      }
    }
  }

  function syncSamosvalQuantityBlock() {
    var quantityBlock = document.getElementById("samosval-quantity-block");
    var labelEl = document.getElementById("samosval-quantity-label");
    var unitEl = document.getElementById("samosval-quantity-unit");
    var serviceRadio = document.querySelector('#services-samosval input[name="service"]:checked');
    if (!quantityBlock || !labelEl || !unitEl) return;
    var serviceId = serviceRadio ? serviceRadio.value : "samosval_sand";
    var config = typeof PriceCalculator !== "undefined" && PriceCalculator.getDumpServiceConfig && PriceCalculator.getDumpServiceConfig()[serviceId];
    if (config && config.unit) {
      quantityBlock.style.display = "flex";
      labelEl.textContent = "Кількість (" + (config.unitLabel || "") + ")";
      unitEl.textContent = config.unitLabel || "";
      unitEl.style.display = "";
    } else {
      quantityBlock.style.display = "none";
      unitEl.style.display = "none";
    }
  }

  function clearRoute() {
    var container = document.getElementById("points-container");
    if (!container) return;
    var rows = Array.from(container.querySelectorAll(".input-row"));
    rows.forEach(function (row, i) {
      if (row._mapMarker && row._mapMarker.remove) row._mapMarker.remove();
      row._mapMarker = null;
      if (i > 1) row.remove();
    });
    var first = rows[0];
    var second = rows[1];
    if (first) {
      var inp1 = first.querySelector(".route-input");
      if (inp1) { inp1.value = ""; inp1.readOnly = false; }
      first.removeAttribute("data-lat");
      first.removeAttribute("data-lng");
      first.classList.remove("input-row-map");
    }
    if (second) {
      var inp2 = second.querySelector(".route-input");
      if (inp2) { inp2.value = ""; inp2.readOnly = false; }
      second.removeAttribute("data-lat");
      second.removeAttribute("data-lng");
      second.classList.remove("input-row-map");
    }
    markersLayer.clearLayers();
    routeLayer.clearLayers();
    currentRouteData = null;
    var resCard = document.getElementById("route-result");
    if (resCard) resCard.style.display = "none";
    var qInput = document.getElementById("samosval-quantity");
    if (qInput) qInput.value = "";
  }

  function addWayPoint() {
    var container = document.getElementById("points-container");
    var rows = container.querySelectorAll(".input-row");
    var lastRow = rows[rows.length - 1];

    var div = document.createElement("div");
    div.className = "input-row";
    div.innerHTML =
      '<div class="icon-marker waypoint">•</div>' +
      '<input type="text" class="route-input" placeholder="Проміжна точка (місто або адреса)" autocomplete="off">' +
      '<button class="remove-btn" title="Видалити">✕</button>';
    var inp = div.querySelector(".route-input");
    div.querySelector(".remove-btn").addEventListener("click", function () {
      div.remove();
    });
    container.insertBefore(div, lastRow);
    setupAutocomplete(inp);
  }

  function getOrderedPoints() {
    var rows = Array.from(document.querySelectorAll("#points-container .input-row"));
    return rows.map(function (row) {
      var lat = row.getAttribute("data-lat");
      var lng = row.getAttribute("data-lng");
      var input = row.querySelector(".route-input");
      var value = input ? input.value.trim() : "";
      if (lat != null && lng != null) {
        return { type: "coords", lat: parseFloat(lat), lng: parseFloat(lng), label: value || "Точка на карті" };
      }
      return { type: "address", value: value, label: value };
    });
  }

  function resolvePoints(points) {
    var promises = points.map(function (p) {
      if (p.type === "coords") {
        return Promise.resolve({ lat: p.lat, lng: p.lng, display: p.label });
      }
      if (!p.value) return Promise.resolve(null);
      return geocode(p.value);
    });
    return Promise.all(promises);
  }

  function buildRoute() {
    var points = getOrderedPoints();
    var filled = points.filter(function (p) {
      return p.type === "coords" || (p.value && p.value.length > 0);
    });

    if (filled.length < 2) {
      alert("Вкажіть мінімум дві точки: звідки та куди. Можна вписати місто/адресу або додати точку на карті.");
      return;
    }

    var resCard = document.getElementById("route-result");
    resCard.style.display = "none";
    markersLayer.clearLayers();
    routeLayer.clearLayers();

    resolvePoints(filled)
      .then(function (coords) {
        var missing = coords.findIndex(function (c) { return !c; });
        if (missing >= 0) {
          var label = filled[missing].label || filled[missing].value || "Точка " + (missing + 1);
          alert('Точку "' + label + '" не знайдено. Уточніть написання або поставте точку на карті.');
          return;
        }

        coords.forEach(function (c) {
          L.marker([c.lat, c.lng])
            .addTo(markersLayer)
            .bindPopup(c.display);
        });

        var coordsStr = coords.map(function (c) { return c.lng + "," + c.lat; }).join(";");
        return fetch(OSRM_URL + "/" + coordsStr + "?overview=full&geometries=geojson", {
          headers: { Accept: "application/json" },
        }).then(function (r) { return r.json(); });
      })
      .then(function (osrm) {
        if (!osrm || osrm.code !== "Ok") {
          alert("Маршрут не знайдено. Перевірте точки або спробуйте інші адреси.");
          return;
        }

        var route = osrm.routes[0];
        var geometry = route.geometry;
        var line = L.geoJSON(
          { type: "LineString", coordinates: geometry.coordinates },
          {
            style: {
              color: "#0ea5e9",
              weight: 5,
              opacity: 0.8,
            },
          }
        ).addTo(routeLayer);

        map.fitBounds(line.getBounds(), { padding: [40, 40] });

        currentRouteData = { distance: route.distance, duration: route.duration };
        var distKm = (route.distance / 1000).toFixed(1);
        var durationSec = route.duration;
        var hours = Math.floor(durationSec / 3600);
        var minutes = Math.floor((durationSec % 3600) / 60);
        var timeStr = hours > 0 ? hours + " год " + minutes + " хв" : minutes + " хв";

        var labels = filled.map(function (p) { return p.label || p.value || ""; });
        var legs = route.legs || [];
        var legsHtml = legs
          .map(function (leg, i) {
            var a = (labels[i] || "Точка " + (i + 1)).split(",")[0].trim();
            var b = (labels[i + 1] || "Точка " + (i + 2)).split(",")[0].trim();
            var dist = ((leg.distance || 0) / 1000).toFixed(1);
            return '<div class="leg-row"><span>' + (i + 1) + ". " + a + " → " + b + "</span><strong>" + dist + " км</strong></div>";
          })
          .join("");

        var vehicleRadio = document.querySelector('input[name="vehicle"]:checked');
        var vehicleValue = vehicleRadio ? vehicleRadio.value : "bus";
        var vehicleLabel = vehicleValue === "samosval" ? "Самосвал" : "Бус";
        var resVehicle = document.getElementById("res-vehicle");
        if (resVehicle) resVehicle.textContent = vehicleLabel;
        var serviceRadio = document.querySelector('input[name="service"]:checked');
        var serviceLabel = "";
        if (serviceRadio) {
          var opt = serviceRadio.closest("label") && serviceRadio.closest("label").querySelector(".service-option");
          if (opt) serviceLabel = opt.textContent.trim();
        }
        var resService = document.getElementById("res-service");
        if (resService) resService.textContent = serviceLabel || "—";
        document.getElementById("res-distance").textContent = distKm + " км";
        document.getElementById("res-duration").textContent = timeStr;
        document.getElementById("legs-details").innerHTML = legsHtml || "";

        if (typeof PriceCalculator !== "undefined") {
          var serviceType = PriceCalculator.serviceTypeFromVehicle(vehicleValue);
          var options;
          if (serviceType === "DUMP_TRUCK") {
            var dumpServiceRadio = document.querySelector('#services-samosval input[name="service"]:checked');
            var dumpServiceId = dumpServiceRadio ? dumpServiceRadio.value : "samosval_sand";
            var qInput = document.getElementById("samosval-quantity");
            var quantity = qInput && qInput.value !== "" ? parseFloat(qInput.value) : null;
            if (quantity !== null && isNaN(quantity)) quantity = null;
            options = { dumpTruckServiceId: dumpServiceId, quantity: quantity };
          } else if (serviceType === "BUS") {
            var busServiceRadio = document.querySelector('#services-bus input[name="service"]:checked');
            var busServiceId = busServiceRadio ? busServiceRadio.value : "bus_taxi";
            options = { busServiceId: busServiceId };
          }
          var priceResult = PriceCalculator.calculate(route.distance, route.duration, serviceType, options);
          var resPrice = document.getElementById("res-price");
          if (resPrice) resPrice.textContent = priceResult.total + " грн";
          var resBreakdown = document.getElementById("res-price-breakdown");
          if (resBreakdown) {
            resBreakdown.textContent = priceResult.breakdown;
            resBreakdown.style.display = "block";
          }
          var hourlyRateItem = document.getElementById("hourly-rate-item");
          var resHourlyRate = document.getElementById("res-hourly-rate");
          if (hourlyRateItem && resHourlyRate) {
            var serviceId = serviceType === "BUS" ? (options && options.busServiceId) || "bus_taxi" : (options && options.dumpTruckServiceId) || "samosval_sand";
            var hourlyRate = PriceCalculator.getHourlyRate(serviceType, serviceId);
            if (hourlyRate) {
              resHourlyRate.textContent = hourlyRate + " грн/год";
              hourlyRateItem.style.display = "flex";
            } else {
              hourlyRateItem.style.display = "none";
            }
          }
        } else {
          var resPrice = document.getElementById("res-price");
          if (resPrice) resPrice.textContent = "—";
          var resBreakdown = document.getElementById("res-price-breakdown");
          if (resBreakdown) resBreakdown.style.display = "none";
        }

        resCard.style.display = "block";
      })
      .catch(function (err) {
        console.error(err);
        alert("Помилка побудови маршруту. Спробуйте пізніше або перевірте адреси.");
      });
  }

  function recalculatePrice() {
    if (!currentRouteData) return;
    var resCard = document.getElementById("route-result");
    if (!resCard || resCard.style.display === "none") return;

    var vehicleRadio = document.querySelector('input[name="vehicle"]:checked');
    var vehicleValue = vehicleRadio ? vehicleRadio.value : "bus";
    var vehicleLabel = vehicleValue === "samosval" ? "Самосвал" : "Бус";
    var resVehicle = document.getElementById("res-vehicle");
    if (resVehicle) resVehicle.textContent = vehicleLabel;

    var serviceRadio = document.querySelector('input[name="service"]:checked');
    var serviceLabel = "";
    if (serviceRadio) {
      var opt = serviceRadio.closest("label") && serviceRadio.closest("label").querySelector(".service-option");
      if (opt) serviceLabel = opt.textContent.trim();
    }
    var resService = document.getElementById("res-service");
    if (resService) resService.textContent = serviceLabel || "—";

    if (typeof PriceCalculator !== "undefined") {
      var serviceType = PriceCalculator.serviceTypeFromVehicle(vehicleValue);
      var options;
      if (serviceType === "DUMP_TRUCK") {
        var dumpServiceRadio = document.querySelector('#services-samosval input[name="service"]:checked');
        var dumpServiceId = dumpServiceRadio ? dumpServiceRadio.value : "samosval_sand";
        var qInput = document.getElementById("samosval-quantity");
        var quantity = qInput && qInput.value !== "" ? parseFloat(qInput.value) : null;
        if (quantity !== null && isNaN(quantity)) quantity = null;
        options = { dumpTruckServiceId: dumpServiceId, quantity: quantity };
      } else if (serviceType === "BUS") {
        var busServiceRadio = document.querySelector('#services-bus input[name="service"]:checked');
        var busServiceId = busServiceRadio ? busServiceRadio.value : "bus_taxi";
        options = { busServiceId: busServiceId };
      }
      var priceResult = PriceCalculator.calculate(currentRouteData.distance, currentRouteData.duration, serviceType, options);
      var resPrice = document.getElementById("res-price");
      if (resPrice) resPrice.textContent = priceResult.total + " грн";
      var resBreakdown = document.getElementById("res-price-breakdown");
      if (resBreakdown) {
        resBreakdown.textContent = priceResult.breakdown;
        resBreakdown.style.display = "block";
      }
      var hourlyRateItem = document.getElementById("hourly-rate-item");
      var resHourlyRate = document.getElementById("res-hourly-rate");
      if (hourlyRateItem && resHourlyRate) {
        var serviceId = serviceType === "BUS" ? (options && options.busServiceId) || "bus_taxi" : (options && options.dumpTruckServiceId) || "samosval_sand";
        var hourlyRate = PriceCalculator.getHourlyRate(serviceType, serviceId);
        if (hourlyRate) {
          resHourlyRate.textContent = hourlyRate + " грн/год";
          hourlyRateItem.style.display = "flex";
        } else {
          hourlyRateItem.style.display = "none";
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMap);
  } else {
    initMap();
  }
})();
