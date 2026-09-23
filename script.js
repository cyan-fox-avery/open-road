(() => {
  const STORAGE_KEY = "roadTripAtlasStopsV01";
  const categories = Object.keys(CATEGORY_META);
  const attractionById = new Map(ATTRACTIONS.map((item) => [item.id, item]));

  const state = {
    activeCategories: new Set(categories),
    markers: new Map(),
    tripIds: loadTrip(),
    selectedAttractionId: null,
    tripLine: null
  };

  const els = {
    categoryFilters: document.getElementById("categoryFilters"),
    detailCard: document.getElementById("detailCard"),
    detailContent: document.getElementById("detailContent"),
    detailClose: document.getElementById("detailClose"),
    tripPanel: document.getElementById("tripPanel"),
    tripToggle: document.getElementById("tripToggle"),
    tripClose: document.getElementById("tripClose"),
    tripCount: document.getElementById("tripCount"),
    tripTitleCount: document.getElementById("tripTitleCount"),
    tripList: document.getElementById("tripList"),
    emptyTrip: document.getElementById("emptyTrip"),
    clearTripButton: document.getElementById("clearTripButton"),
    fitTripButton: document.getElementById("fitTripButton"),
    fitAllButton: document.getElementById("fitAllButton"),
    mapStatus: document.getElementById("mapStatus"),
    scrim: document.getElementById("scrim"),
    toast: document.getElementById("toast")
  };

  const map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
    minZoom: 3,
    maxZoom: 18,
    worldCopyJump: true
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  map.zoomControl.setPosition("bottomright");

  function loadTrip() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.filter((id) => attractionById.has(id));
    } catch {
      return [];
    }
  }

  function saveTrip() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tripIds));
  }

  function markerIcon(attraction) {
    const color = CATEGORY_META[attraction.primaryCategory]?.color || "#555";
    return L.divIcon({
      className: "attraction-marker-wrapper",
      html: `<div class="attraction-marker" style="--marker-color:${color}"></div>`,
      iconSize: [28, 32],
      iconAnchor: [14, 29],
      popupAnchor: [0, -30]
    });
  }

  function buildMarkers() {
    ATTRACTIONS.forEach((attraction) => {
      const marker = L.marker([attraction.lat, attraction.lng], {
        icon: markerIcon(attraction),
        keyboard: true,
        riseOnHover: true,
        title: attraction.name,
        alt: `${attraction.name}, ${attraction.region}`
      });

      marker.on("click", () => openDetail(attraction.id, true));
      marker.addTo(map);
      state.markers.set(attraction.id, marker);
    });
  }

  function buildFilters() {
    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "filter-chip all-chip";
    allButton.dataset.filter = "all";
    allButton.setAttribute("aria-pressed", "true");
    allButton.textContent = "All";
    allButton.addEventListener("click", toggleAllCategories);
    els.categoryFilters.appendChild(allButton);

    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.filter = category;
      button.setAttribute("aria-pressed", "true");
      button.innerHTML = `<span class="filter-dot" style="background:${CATEGORY_META[category].color}"></span><span>${escapeHtml(category)}</span>`;
      button.addEventListener("click", () => toggleCategory(category));
      els.categoryFilters.appendChild(button);
    });
  }

  function toggleAllCategories() {
    const allActive = state.activeCategories.size === categories.length;
    state.activeCategories = new Set(allActive ? [] : categories);
    updateFilterUI();
    applyFilters();
  }

  function toggleCategory(category) {
    if (state.activeCategories.has(category)) {
      state.activeCategories.delete(category);
    } else {
      state.activeCategories.add(category);
    }
    updateFilterUI();
    applyFilters();
  }

  function updateFilterUI() {
    document.querySelectorAll(".filter-chip").forEach((button) => {
      const filter = button.dataset.filter;
      const isPressed = filter === "all"
        ? state.activeCategories.size === categories.length
        : state.activeCategories.has(filter);
      button.setAttribute("aria-pressed", String(isPressed));
    });
  }

  function isAttractionVisible(attraction) {
    return attraction.categories.some((category) => state.activeCategories.has(category));
  }

  function applyFilters() {
    let shown = 0;
    ATTRACTIONS.forEach((attraction) => {
      const marker = state.markers.get(attraction.id);
      const visible = isAttractionVisible(attraction);
      if (visible) {
        if (!map.hasLayer(marker)) marker.addTo(map);
        shown += 1;
      } else if (map.hasLayer(marker)) {
        marker.removeFrom(map);
      }
    });

    els.mapStatus.textContent = `${shown} of ${ATTRACTIONS.length} attractions visible`;
  }

  function openDetail(id, panToMarker = false) {
    const attraction = attractionById.get(id);
    if (!attraction) return;

    state.selectedAttractionId = id;
    const added = state.tripIds.includes(id);

    const categoryBadges = attraction.categories
      .map((category) => {
        const color = CATEGORY_META[category]?.color || "#555";
        return `<span class="category-badge"><span class="category-badge-dot" style="background:${color}"></span>${escapeHtml(category)}</span>`;
      })
      .join("");

    const meta = [
      attraction.visitLength,
      attraction.cost,
      attraction.setting,
      attraction.seasonal,
      attraction.accessibility
    ]
      .filter(Boolean)
      .map((item) => `<span class="meta-pill">${escapeHtml(item)}</span>`)
      .join("");

    els.detailContent.innerHTML = `
      <p class="detail-kicker">${escapeHtml(attraction.region)} · ${escapeHtml(attraction.country)}</p>
      <h2 class="detail-title">${escapeHtml(attraction.name)}</h2>
      <div class="badge-row">
        ${categoryBadges}
        ${attraction.editorial ? `<span class="editorial-badge">${escapeHtml(attraction.editorial)}</span>` : ""}
      </div>
      <p class="detail-description">${escapeHtml(attraction.description)}</p>
      <div class="meta-grid">${meta}</div>
      <div class="detail-actions">
        <button type="button" class="primary-button ${added ? "is-added" : ""}" id="detailTripButton">
          ${added ? "✓ Added to trip" : "+ Add to trip"}
        </button>
        ${attraction.website ? `<a class="website-link" href="${sanitizeUrl(attraction.website)}" target="_blank" rel="noopener noreferrer">Official website ↗</a>` : ""}
      </div>
    `;

    document.getElementById("detailTripButton").addEventListener("click", () => toggleTripStop(id));
    els.detailCard.setAttribute("aria-hidden", "false");

    if (panToMarker) {
      const targetZoom = Math.max(map.getZoom(), 6);
      map.flyTo([attraction.lat, attraction.lng], targetZoom, { duration: 0.55 });
    }
  }

  function closeDetail() {
    els.detailCard.setAttribute("aria-hidden", "true");
    state.selectedAttractionId = null;
  }

  function toggleTripStop(id) {
    const attraction = attractionById.get(id);
    if (!attraction) return;

    const index = state.tripIds.indexOf(id);
    if (index >= 0) {
      state.tripIds.splice(index, 1);
      showToast(`${attraction.name} removed from trip`);
    } else {
      state.tripIds.push(id);
      showToast(`${attraction.name} added as stop ${state.tripIds.length}`);
    }

    saveTrip();
    renderTrip();
    updateTripLine();
    openDetail(id, false);
  }

  function renderTrip() {
    const count = state.tripIds.length;
    els.tripCount.textContent = count;
    els.tripTitleCount.textContent = count;
    els.clearTripButton.disabled = count === 0;
    els.fitTripButton.disabled = count === 0;
    els.emptyTrip.hidden = count !== 0;
    els.tripList.hidden = count === 0;
    els.tripList.innerHTML = "";

    state.tripIds.forEach((id, index) => {
      const attraction = attractionById.get(id);
      if (!attraction) return;

      const item = document.createElement("li");
      item.className = "trip-item";
      item.innerHTML = `
        <span class="trip-number" aria-hidden="true">${index + 1}</span>
        <button type="button" class="trip-item-main" aria-label="Show ${escapeHtml(attraction.name)} on the map">
          <strong>${escapeHtml(attraction.name)}</strong>
          <span>${escapeHtml(attraction.region)}</span>
        </button>
        <div class="trip-item-controls">
          <button type="button" class="reorder-button move-up" aria-label="Move ${escapeHtml(attraction.name)} earlier" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="reorder-button move-down" aria-label="Move ${escapeHtml(attraction.name)} later" ${index === state.tripIds.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="remove-button" aria-label="Remove ${escapeHtml(attraction.name)} from trip">×</button>
        </div>
      `;

      item.querySelector(".trip-item-main").addEventListener("click", () => {
        openDetail(id, true);
        if (window.innerWidth <= 900) closeTripPanel();
      });
      item.querySelector(".move-up").addEventListener("click", () => moveStop(index, -1));
      item.querySelector(".move-down").addEventListener("click", () => moveStop(index, 1));
      item.querySelector(".remove-button").addEventListener("click", () => removeStop(id));
      els.tripList.appendChild(item);
    });
  }

  function moveStop(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.tripIds.length) return;
    const [moved] = state.tripIds.splice(index, 1);
    state.tripIds.splice(newIndex, 0, moved);
    saveTrip();
    renderTrip();
    updateTripLine();
  }

  function removeStop(id) {
    const attraction = attractionById.get(id);
    state.tripIds = state.tripIds.filter((tripId) => tripId !== id);
    saveTrip();
    renderTrip();
    updateTripLine();
    if (state.selectedAttractionId === id) openDetail(id, false);
    if (attraction) showToast(`${attraction.name} removed from trip`);
  }

  function clearTrip() {
    if (!state.tripIds.length) return;
    state.tripIds = [];
    saveTrip();
    renderTrip();
    updateTripLine();
    if (state.selectedAttractionId) openDetail(state.selectedAttractionId, false);
    showToast("Trip cleared");
  }

  function updateTripLine() {
    if (state.tripLine) {
      state.tripLine.removeFrom(map);
      state.tripLine = null;
    }

    if (state.tripIds.length < 2) return;

    const points = state.tripIds
      .map((id) => attractionById.get(id))
      .filter(Boolean)
      .map((item) => [item.lat, item.lng]);

    state.tripLine = L.polyline(points, {
      color: "#335f56",
      weight: 3,
      opacity: 0.82,
      dashArray: "8 8",
      lineCap: "round",
      lineJoin: "round",
      interactive: false
    }).addTo(map);
  }

  function fitVisibleAttractions() {
    const visible = ATTRACTIONS.filter(isAttractionVisible);
    if (!visible.length) {
      showToast("Turn on at least one category to show attractions");
      return;
    }
    fitItems(visible, 4);
  }

  function fitTrip() {
    const items = state.tripIds.map((id) => attractionById.get(id)).filter(Boolean);
    if (!items.length) return;
    fitItems(items, 8);
    if (window.innerWidth <= 900) closeTripPanel();
  }

  function fitItems(items, singleZoom) {
    if (items.length === 1) {
      map.flyTo([items[0].lat, items[0].lng], singleZoom, { duration: 0.6 });
      return;
    }

    const bounds = L.latLngBounds(items.map((item) => [item.lat, item.lng]));
    map.fitBounds(bounds.pad(0.12), {
      animate: true,
      duration: 0.6,
      maxZoom: 7,
      paddingTopLeft: [24, 76],
      paddingBottomRight: [24, 24]
    });
  }

  function openTripPanel() {
    if (window.innerWidth > 900) return;
    els.tripPanel.classList.add("open");
    els.tripToggle.setAttribute("aria-expanded", "true");
    els.scrim.hidden = false;
    closeDetail();
  }

  function closeTripPanel() {
    els.tripPanel.classList.remove("open");
    els.tripToggle.setAttribute("aria-expanded", "false");
    els.scrim.hidden = true;
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "#";
    } catch {
      return "#";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  els.detailClose.addEventListener("click", closeDetail);
  els.tripToggle.addEventListener("click", () => {
    if (window.innerWidth > 900) return;
    els.tripPanel.classList.contains("open") ? closeTripPanel() : openTripPanel();
  });
  els.tripClose.addEventListener("click", closeTripPanel);
  els.scrim.addEventListener("click", closeTripPanel);
  els.clearTripButton.addEventListener("click", clearTrip);
  els.fitTripButton.addEventListener("click", fitTrip);
  els.fitAllButton.addEventListener("click", fitVisibleAttractions);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetail();
      closeTripPanel();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      els.tripPanel.classList.remove("open");
      els.scrim.hidden = true;
      els.tripToggle.setAttribute("aria-expanded", "false");
    }
    setTimeout(() => map.invalidateSize(), 50);
  });

  buildFilters();
  buildMarkers();
  renderTrip();
  updateTripLine();
  applyFilters();
  fitVisibleAttractions();
})();
