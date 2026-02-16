/**
 * Dynamic price calculation for logistics (moving, cargo taxi, dump truck).
 * Input: distance (m), duration (s), service type. Output: total UAH + breakdown string.
 */
(function (global) {
  "use strict";

  // ─── BUS (Cargo Taxi, Moving, Furniture Delivery) ─────────────────────────
  /** Виїзд для всіх бусів (UAH). */
  var BUS_FEED_UAH = 799;
  /** Price per km for fuel on long trips (UAH/km). */
  var BUS_PRICE_PER_KM_UAH = 3;
  /** Minimum billable hours (user pays at least this). */
  var BUS_MIN_HOURS = 2;

  /** Bus service config: hourly rate per service (UAH/hour). */
  var BUS_SERVICE_CONFIG = {
    bus_taxi: { hourlyRate: 799, label: "Вантажне таксі" },
    bus_relocation: { hourlyRate: 1099, label: "Переїзд під ключ" },
    bus_delivery: { hourlyRate: 859, label: "Доставка меблів / техніки" },
  };

  // ─── DUMP_TRUCK: послуги з базовим тарифом + додаткова плата ─────────────
  /** Доставка піску: базовий тариф (включає виїзд, перші 5 км, 1 год) + 300 грн/т (купівля піску). */
  var DUMP_SAND_BASE_UAH = 1500;
  var DUMP_SAND_PER_TON_UAH = 300;
  /** Буд. сміття: базовий тариф (включає виїзд, перші 5 км, 1 год) + 150 грн/т (полігон). */
  var DUMP_WASTE_BASE_UAH = 1800;
  var DUMP_WASTE_PER_TON_UAH = 150;
  /** Мотлох/сміття: базовий тариф (включає виїзд, перші 5 км, 1 год) + 350 грн/м³ (полігон ТПВ). */
  var DUMP_RUBBLE_BASE_UAH = 1800;
  var DUMP_RUBBLE_PER_M3_UAH = 350;
  /** Металобрухт: базовий тариф (включає виїзд, перші 5 км, 1 год). */
  var DUMP_METAL_BASE_UAH = 1200;

  /** Самосвал: додаткові км понад базові (UAH/km). */
  var DUMP_TRUCK_PRICE_PER_KM_UAH = 25;
  /** Самосвал: додаткові години понад базові (UAH/hour). */
  var DUMP_TRUCK_HOURLY_RATE_UAH = 250;
  /** Самосвал: скільки км включено в базовий тариф. */
  var DUMP_TRUCK_BASE_KM_INCLUDED = 5;
  /** Самосвал: скільки годин включено в базовий тариф (мінімум). */
  var DUMP_TRUCK_BASE_HOURS_INCLUDED = 2;
  /** Самосвал: мінімальний час замовлення (години). */
  var DUMP_TRUCK_MIN_HOURS = 2;

  var METERS_PER_KM = 1000;
  var SECONDS_PER_HOUR = 3600;

  /** Dump truck service config: base UAH, unit ('ton'|'m3'|null), rate per unit (UAH). */
  var DUMP_SERVICE_CONFIG = {
    samosval_sand: { base: DUMP_SAND_BASE_UAH, unit: "ton", rate: DUMP_SAND_PER_TON_UAH, unitLabel: "т" },
    samosval_waste: { base: DUMP_WASTE_BASE_UAH, unit: "ton", rate: DUMP_WASTE_PER_TON_UAH, unitLabel: "т" },
    samosval_rubble: { base: DUMP_RUBBLE_BASE_UAH, unit: "m3", rate: DUMP_RUBBLE_PER_M3_UAH, unitLabel: "м³" },
    samosval_metal: { base: DUMP_METAL_BASE_UAH, unit: null, rate: 0, unitLabel: null },
  };

  /**
   * @typedef {'BUS'|'DUMP_TRUCK'} ServiceType
   */

  /**
   * @typedef {Object} PriceResult
   * @property {number} total - Total price in UAH
   * @property {string} breakdown - Human-readable breakdown (e.g. for UI)
   * @property {number} distanceKm - Distance in km (converted from input)
   * @property {number} durationHours - Duration in hours (converted from input)
   */

  /**
   * Calculate price from route data.
   * @param {number} distanceInMeters - Route distance (e.g. from OSRM/Mapbox).
   * @param {number} durationInSeconds - Route duration in seconds.
   * @param {ServiceType} serviceType - 'BUS' or 'DUMP_TRUCK'.
   * @param {{ dumpTruckServiceId?: string, quantity?: number, busServiceId?: string }} [options] - Service IDs and optional quantity.
   * @returns {PriceResult}
   */
  function calculate(distanceInMeters, durationInSeconds, serviceType, options) {
    var distanceKm = (distanceInMeters || 0) / METERS_PER_KM;
    var durationHours = (durationInSeconds || 0) / SECONDS_PER_HOUR;

    if (serviceType === "DUMP_TRUCK") {
      var serviceId = (options && options.dumpTruckServiceId) || "samosval_sand";
      var quantity = options && typeof options.quantity === "number" && options.quantity >= 0 ? options.quantity : null;
      return calculateDumpTruckByService(serviceId, quantity, distanceKm, durationHours);
    }
    var busServiceId = (options && options.busServiceId) || "bus_taxi";
    return calculateBusByService(busServiceId, distanceKm, durationHours);
  }

  /**
   * BUS formula: feed (799) + max(actualHours, minHours) * hourlyRate(service) + distanceKm * pricePerKm.
   * @param {string} serviceId - bus_taxi | bus_relocation | bus_delivery
   * @param {number} distanceKm
   * @param {number} durationHours
   * @returns {PriceResult}
   */
  function calculateBusByService(serviceId, distanceKm, durationHours) {
    var config = BUS_SERVICE_CONFIG[serviceId] || BUS_SERVICE_CONFIG.bus_taxi;
    var feed = BUS_FEED_UAH;
    var hourly = config.hourlyRate;
    var minH = BUS_MIN_HOURS;
    var perKm = BUS_PRICE_PER_KM_UAH;

    var billableHours = Math.max(durationHours, minH);
    var hoursPart = billableHours * hourly;
    var kmPart = distanceKm * perKm;
    var total = feed + hoursPart + kmPart;
    var minTotal = feed + minH * hourly;

    var roundedHours = Math.round(billableHours * 100) / 100;
    var breakdown =
      "Виїзд " + feed + " грн + " + roundedHours + " год × " + hourly + " грн + " + distanceKm.toFixed(1) + " км × " + perKm + " грн";
    if (total < minTotal) {
      total = minTotal;
      breakdown += " = " + total + " грн (мін. замовлення)";
    } else {
      breakdown += " = " + Math.round(total) + " грн";
    }

    return {
      total: Math.round(total),
      breakdown: breakdown,
      distanceKm: distanceKm,
      durationHours: durationHours,
    };
  }

  /**
   * DUMP_TRUCK: base (включає виїзд + перші 5 км + 2 год мін.) + додаткові км + додаткові години + кількість × тариф.
   * @param {string} serviceId - samosval_sand | samosval_waste | samosval_rubble | samosval_metal
   * @param {number|null} quantity - Tons or m³ (ignored for metal).
   * @param {number} distanceKm
   * @param {number} durationHours
   * @returns {PriceResult}
   */
  function calculateDumpTruckByService(serviceId, quantity, distanceKm, durationHours) {
    var config = DUMP_SERVICE_CONFIG[serviceId] || DUMP_SERVICE_CONFIG.samosval_sand;
    var base = config.base;
    var baseKm = DUMP_TRUCK_BASE_KM_INCLUDED;
    var baseHours = DUMP_TRUCK_BASE_HOURS_INCLUDED;
    var minHours = DUMP_TRUCK_MIN_HOURS;
    var perKm = DUMP_TRUCK_PRICE_PER_KM_UAH;
    var hourly = DUMP_TRUCK_HOURLY_RATE_UAH;

    var total = base;
    var extraKm = Math.max(0, distanceKm - baseKm);
    var billableHours = Math.max(durationHours, minHours);
    var extraHours = Math.max(0, billableHours - baseHours);
    var kmPart = extraKm * perKm;
    var hoursPart = extraHours * hourly;
    total += kmPart + hoursPart;

    var breakdown = "Базовий тариф " + base + " грн (виїзд + " + baseKm + " км + " + baseHours + " год мін.)";
    if (extraKm > 0) {
      breakdown += " + " + extraKm.toFixed(1) + " км × " + perKm + " грн";
    }
    if (billableHours > baseHours) {
      breakdown += " + " + (Math.round(extraHours * 100) / 100) + " год × " + hourly + " грн";
    } else if (durationHours < minHours) {
      breakdown += " (мінімум " + minHours + " год)";
    }

    if (config.unit && config.rate > 0) {
      var q = quantity != null && quantity >= 0 ? quantity : 0;
      var extra = q * config.rate;
      total += extra;
      if (q > 0) {
        breakdown += " + " + q + " " + config.unitLabel + " × " + config.rate + " грн";
      } else {
        breakdown += " (+ кількість " + config.unitLabel + " за бажанням)";
      }
    }

    breakdown += " = " + Math.round(total) + " грн";

    return {
      total: Math.round(total),
      breakdown: breakdown,
      distanceKm: distanceKm,
      durationHours: durationHours,
    };
  }

  /**
   * Map UI vehicle value to calculator service type.
   * @param {string} vehicleValue - 'bus' | 'samosval'
   * @returns {ServiceType}
   */
  function serviceTypeFromVehicle(vehicleValue) {
    return vehicleValue === "samosval" ? "DUMP_TRUCK" : "BUS";
  }

  /**
   * Get hourly rate for a service.
   * @param {ServiceType} serviceType
   * @param {string} serviceId - bus_taxi | bus_relocation | bus_delivery | samosval_sand | etc.
   * @returns {number|null} Hourly rate in UAH, or null if not applicable.
   */
  function getHourlyRate(serviceType, serviceId) {
    if (serviceType === "BUS") {
      var config = BUS_SERVICE_CONFIG[serviceId];
      return config ? config.hourlyRate : null;
    } else if (serviceType === "DUMP_TRUCK") {
      return DUMP_TRUCK_HOURLY_RATE_UAH;
    }
    return null;
  }

  var PriceCalculator = {
    calculate: calculate,
    serviceTypeFromVehicle: serviceTypeFromVehicle,
    getHourlyRate: getHourlyRate,
    // Expose constants for tweaking (optional)
    getBusServiceConfig: function () {
      return BUS_SERVICE_CONFIG;
    },
    constants: {
      BUS_FEED_UAH: BUS_FEED_UAH,
      BUS_MIN_HOURS: BUS_MIN_HOURS,
      BUS_PRICE_PER_KM_UAH: BUS_PRICE_PER_KM_UAH,
      DUMP_SAND_BASE_UAH: DUMP_SAND_BASE_UAH,
      DUMP_SAND_PER_TON_UAH: DUMP_SAND_PER_TON_UAH,
      DUMP_WASTE_BASE_UAH: DUMP_WASTE_BASE_UAH,
      DUMP_WASTE_PER_TON_UAH: DUMP_WASTE_PER_TON_UAH,
      DUMP_RUBBLE_BASE_UAH: DUMP_RUBBLE_BASE_UAH,
      DUMP_RUBBLE_PER_M3_UAH: DUMP_RUBBLE_PER_M3_UAH,
      DUMP_METAL_BASE_UAH: DUMP_METAL_BASE_UAH,
      DUMP_TRUCK_PRICE_PER_KM_UAH: DUMP_TRUCK_PRICE_PER_KM_UAH,
      DUMP_TRUCK_HOURLY_RATE_UAH: DUMP_TRUCK_HOURLY_RATE_UAH,
      DUMP_TRUCK_BASE_KM_INCLUDED: DUMP_TRUCK_BASE_KM_INCLUDED,
      DUMP_TRUCK_BASE_HOURS_INCLUDED: DUMP_TRUCK_BASE_HOURS_INCLUDED,
      DUMP_TRUCK_MIN_HOURS: DUMP_TRUCK_MIN_HOURS,
    },
    getDumpServiceConfig: function () {
      return DUMP_SERVICE_CONFIG;
    },
  };

  global.PriceCalculator = PriceCalculator;
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
