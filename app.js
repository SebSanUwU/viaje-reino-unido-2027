(function () {
  "use strict";

  var root = document.documentElement;
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  /* Theme */
  var themeBtn = document.getElementById("theme-toggle");
  var themeListeners = [];

  function isDark() {
    var forced = root.getAttribute("data-theme");
    return forced ? forced === "dark" : darkQuery.matches;
  }
  function syncThemeButton() {
    var dark = isDark();
    themeBtn.setAttribute("aria-pressed", String(dark));
    themeBtn.querySelector(".toggle-state").textContent = dark ? "Sí" : "No";
    themeListeners.forEach(function (fn) { fn(dark); });
  }
  var savedTheme = readStore("viaje-theme");
  if (savedTheme === "light" || savedTheme === "dark") root.setAttribute("data-theme", savedTheme);
  themeBtn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    writeStore("viaje-theme", next);
    syncThemeButton();
  });
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", syncThemeButton);

  /* Menu sheet */
  var menuBtn = document.getElementById("menu-btn");
  var menu = document.getElementById("menu");
  var menuClose = document.getElementById("menu-close");

  function focusables() {
    return Array.prototype.slice.call(menu.querySelectorAll("a[href], button:not([disabled])"));
  }
  function openMenu() {
    menu.hidden = false;
    document.body.classList.add("menu-open");
    menuBtn.setAttribute("aria-expanded", "true");
    menuClose.focus();
  }
  function closeMenu(restoreFocus) {
    menu.hidden = true;
    document.body.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) menuBtn.focus();
  }
  menuBtn.addEventListener("click", openMenu);
  menuClose.addEventListener("click", function () { closeMenu(true); });
  menu.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a[href^='#']") : null;
    if (link) closeMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (menu.hidden) return;
    if (e.key === "Escape") {
      closeMenu(true);
      return;
    }
    if (e.key !== "Tab") return;
    var items = focusables();
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  syncThemeButton();

  /* Move focus to the section or day that a hash link points to */
  function focusHashTarget() {
    var id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var target = el;
    if (el.tagName === "SECTION" || el.tagName === "FOOTER") target = el.querySelector("h1, h2") || el;
    else if (el.classList.contains("day")) target = el.querySelector("h3") || el;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", focusHashTarget);
  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a[href^='#']") : null;
    if (!link || link.getAttribute("href") !== window.location.hash) return;
    window.setTimeout(focusHashTarget, 0);
  });
  if (window.location.hash) focusHashTarget();

  /* Photos that fail to load get the same block as missing ones */
  document.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || el.tagName !== "IMG" || el.classList.contains("photo-failed")) return;
    el.classList.add("photo-failed");
    el.style.visibility = "hidden";
    var parent = el.parentElement;
    if (parent) parent.style.background = "var(--accent-soft)";
  }, true);

  /* Checklist */
  var checks = document.querySelectorAll("input[data-check]");
  var saved = {};
  try { saved = JSON.parse(readStore("viaje-checks") || "{}") || {}; } catch (e) { saved = {}; }
  Array.prototype.forEach.call(checks, function (box) {
    var key = box.getAttribute("data-check");
    box.checked = saved[key] === true;
    box.addEventListener("change", function () {
      saved[key] = box.checked;
      writeStore("viaje-checks", JSON.stringify(saved));
    });
  });

  /* Map */
  var mapEl = document.getElementById("map");
  var fallbackEl = document.getElementById("map-fallback");

  function showMapFallback() {
    mapEl.hidden = true;
    fallbackEl.hidden = false;
    document.getElementById("map-activate").hidden = true;
    document.getElementById("map-hint").hidden = true;
  }

  function initMap(data) {
    var COLORS = { planA: "#D9501F", falabella: "#2F6DB5", liverpool: "#0E8A86" };
    var coarse = window.matchMedia("(pointer: coarse)").matches || L.Browser.mobile;

    var map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: !coarse,
      touchZoom: !coarse,
      doubleClickZoom: !coarse,
      boxZoom: !coarse,
      tap: false,
      minZoom: 4,
      maxZoom: 12,
      attributionControl: true
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
    }).addTo(map);
    function setTheme(dark) { mapEl.classList.toggle("map-dark", dark); }
    setTheme(isDark());
    themeListeners.push(setTheme);

    var stops = data.stops;
    function ll(id) { return [stops[id].lat, stops[id].lng]; }

    function path(route) {
      var pts = [];
      route.legs.forEach(function (leg, i) {
        if (i === 0) pts.push(ll(leg.from));
        if (leg.geometry) leg.geometry.forEach(function (p) { pts.push(p); });
        pts.push(ll(leg.to));
      });
      return pts;
    }

    function dot(id, label, color, opts, routeName) {
      opts = opts || {};
      var cls = "map-dot" + (opts.small ? " small" : "") + (opts.hollow ? " hollow" : "");
      var icon = L.divIcon({
        className: "map-dot-wrap",
        html: "<div class=\"" + cls + "\" style=\"--dot:" + color + "\"></div>",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -12]
      });
      var name = stops[id].name + ", " + routeName;
      var marker = L.marker(ll(id), { icon: icon, title: name, alt: name, keyboard: true });
      marker.on("add", function () { marker.getElement().setAttribute("aria-label", name); });
      marker.bindPopup("<strong>" + stops[id].name + "</strong><br>" + label);
      return marker;
    }

    var routes = data.routes;
    var layers = {};

    /* Falabella: dashed, with a stop marker for every place */
    var fal = L.layerGroup();
    L.polyline(path(routes.falabella), { color: COLORS.falabella, weight: 3.5, opacity: 0.9, dashArray: "10 8" }).addTo(fal);
    var seen = {};
    routes.falabella.sequence.forEach(function (id) {
      if (seen[id]) return;
      seen[id] = true;
      var nights = routes.falabella.nights[id];
      var text = nights ? nights + (nights === 1 ? " noche" : " noches") : "parada del recorrido";
      var note = routes.falabella.notes && routes.falabella.notes[id];
      if (id === "londres") text = nights + " noches (3 al inicio y 1 al final)";
      else if (id === "edimburgo") text = "1 noche (visita de medio día)";
      else if (note && id === "glasgow") text = text + " · luego ferry desde Cairnryan a Belfast";
      fal.addLayer(dot(id, "Falabella: " + text, COLORS.falabella, { small: !nights }, "ruta Falabella"));
    });
    layers.falabella = fal;

    /* Plan A: solid train line, dotted day trips, Durham optional */
    var plan = L.layerGroup();
    L.polyline(path(routes.planA), { color: COLORS.planA, weight: 5, opacity: 0.95 }).addTo(plan);
    routes.planA.daytrips.forEach(function (trip) {
      var pts = trip.sequence.map(ll);
      L.polyline(pts, { color: COLORS.planA, weight: 3, opacity: 0.95, dashArray: "1 9", lineCap: "round" }).addTo(plan);
    });
    ["londres", "york", "edimburgo"].forEach(function (id) {
      var n = routes.planA.nights[id];
      plan.addLayer(dot(id, "Plan A: " + n + " noches", COLORS.planA, {}, "ruta Plan A"));
    });
    plan.addLayer(dot("glasgow", "Excursión de un día en tren (~50 min), jueves 11", COLORS.planA, { small: true }, "excursión a Glasgow"));
    ["bankfoot", "culloden", "urquhart", "inverness", "pitlochry"].forEach(function (id) {
      plan.addLayer(dot(id, "Parada del tour de Highlands, martes 9", COLORS.planA, { small: true }, "excursión a las Highlands"));
    });
    routes.planA.optionalStops.forEach(function (id) {
      plan.addLayer(dot(id, "Parada opcional del tren entre York y Edimburgo", COLORS.planA, { small: true, hollow: true }, "parada opcional"));
    });
    layers.planA = plan;

    /* Plan A + Liverpool */
    var liv = L.layerGroup();
    L.polyline(path(routes.planALiverpool), { color: COLORS.liverpool, weight: 4, opacity: 0.95, dashArray: "14 5 2 5" }).addTo(liv);
    routes.planALiverpool.daytrips.forEach(function (trip) {
      var pts = trip.sequence.map(ll);
      L.polyline(pts, { color: COLORS.liverpool, weight: 3, opacity: 0.95, dashArray: "1 9", lineCap: "round" }).addTo(liv);
    });
    ["londres", "york", "edimburgo", "liverpool"].forEach(function (id) {
      var n = routes.planALiverpool.nights[id];
      liv.addLayer(dot(id, "Plan A + Liverpool: " + n + " noches", COLORS.liverpool, { small: id === "londres" || id === "york" || id === "edimburgo" }, "ruta Plan A con Liverpool"));
    });
    layers.liverpool = liv;

    var inputs = document.querySelectorAll("input[name=layer]");
    var bounds = {
      planA: L.latLngBounds([[51.0, -4.9], [58.0, 0.6]]),
      falabella: L.latLngBounds([[51.2, -6.8], [55.8, 0.4]]),
      liverpool: L.latLngBounds([[51.0, -4.9], [58.0, 0.6]])
    };

    function refresh(fit) {
      var union = null;
      Array.prototype.forEach.call(inputs, function (input) {
        var layer = layers[input.value];
        if (input.checked) {
          if (!map.hasLayer(layer)) layer.addTo(map);
          union = union ? union.extend(bounds[input.value]) : L.latLngBounds(bounds[input.value].getSouthWest(), bounds[input.value].getNorthEast());
        } else if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      if (fit) {
        if (!union) union = L.latLngBounds([[49.8, -8.5], [58.8, 1.9]]);
        map.fitBounds(union, { padding: [16, 16] });
      }
    }
    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener("change", function () { refresh(true); });
    });
    refresh(true);

    /* The map does not trap page scrolling until the viewer turns it on */
    var activate = document.getElementById("map-activate");
    var hint = document.getElementById("map-hint");
    var active = false;
    function setActive(on) {
      active = on;
      activate.setAttribute("aria-pressed", String(on));
      if (on) {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        activate.querySelector(".toggle-state").textContent = "Sí";
        hint.textContent = "El mapa está activo. Para volver a deslizar la página con el dedo, desactívelo.";
      } else {
        map.scrollWheelZoom.disable();
        if (coarse) {
          map.dragging.disable();
          map.touchZoom.disable();
          map.doubleClickZoom.disable();
        }
        activate.querySelector(".toggle-state").textContent = "No";
        hint.textContent = coarse
          ? "Está apagado para que la página se pueda deslizar con el dedo. Actívelo para mover y acercar el mapa."
          : "Puede arrastrar el mapa. Actívelo para acercar con la rueda del ratón.";
      }
    }
    activate.addEventListener("click", function () { setActive(!active); });
    setActive(false);

    window.addEventListener("resize", function () { map.invalidateSize(); });
  }

  if (typeof window.L === "undefined") {
    showMapFallback();
  } else {
    fetch("data/routes.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("routes " + res.status);
        return res.json();
      })
      .then(initMap)
      .catch(function (err) { window.console.error(err); showMapFallback(); });
  }
})();
