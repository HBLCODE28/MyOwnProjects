(() => {
  "use strict";

  const STORAGE = {
    active: "israelNewsMultiview.active.v2",
    order: "israelNewsMultiview.order.v2",
    layout: "israelNewsMultiview.layout.v2",
    quality: "israelNewsMultiview.quality.v2",
    custom: "israelNewsMultiview.custom.v2"
  };

  const QUALITY_MODES = [
    { id: "economy", label: "חסכון", maxHeight: 360 },
    { id: "balanced", label: "מאוזן", maxHeight: 720 },
    { id: "max", label: "מקסימום", maxHeight: Infinity }
  ];

  const els = {
    grid: document.getElementById("channelGrid"),
    empty: document.getElementById("emptyState"),
    cardTemplate: document.getElementById("channelCardTemplate"),
    clock: document.getElementById("clock"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    reloadBtn: document.getElementById("reloadBtn"),
    channelsBtn: document.getElementById("channelsBtn"),
    emptyChannelsBtn: document.getElementById("emptyChannelsBtn"),
    channelsDialog: document.getElementById("channelsDialog"),
    channelPicker: document.getElementById("channelPicker"),
    applyChannelsBtn: document.getElementById("applyChannelsBtn"),
    selectPrimaryBtn: document.getElementById("selectPrimaryBtn"),
    clearSelectionBtn: document.getElementById("clearSelectionBtn"),
    customName: document.getElementById("customName"),
    customUrl: document.getElementById("customUrl"),
    customOfficial: document.getElementById("customOfficial"),
    addCustomBtn: document.getElementById("addCustomBtn"),
    layoutBtn: document.getElementById("layoutBtn"),
    layoutPopover: document.getElementById("layoutPopover"),
    qualityBtn: document.getElementById("qualityBtn"),
    qualityLabel: document.getElementById("qualityLabel"),
    helpBtn: document.getElementById("helpBtn"),
    helpDialog: document.getElementById("helpDialog")
  };

  const hlsInstances = new Map();
  let activeIds = [];
  let currentLayout = localStorage.getItem(STORAGE.layout) || "auto";
  let currentQuality = localStorage.getItem(STORAGE.quality) || "economy";
  let maximizedId = null;
  let dragId = null;

  function safeJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function getCustomChannels() {
    const list = safeJson(STORAGE.custom, []);
    return Array.isArray(list) ? list : [];
  }

  function getAllChannels() {
    const base = Array.isArray(window.NEWS_CHANNELS) ? window.NEWS_CHANNELS : [];
    const custom = getCustomChannels();
    const seen = new Set();
    return [...base, ...custom].filter(channel => {
      if (!channel || !channel.id || seen.has(channel.id)) return false;
      seen.add(channel.id);
      return true;
    });
  }

  function byId(id) {
    return getAllChannels().find(channel => channel.id === id);
  }

  function channelUrls(channel) {
    if (Array.isArray(channel.urls) && channel.urls.length) return channel.urls.filter(Boolean);
    return channel.url ? [channel.url] : [];
  }

  function defaultActiveIds() {
    return getAllChannels().filter(channel => channel.primary).map(channel => channel.id).slice(0, 6);
  }

  function loadActiveIds() {
    const saved = safeJson(STORAGE.active, null);
    const validIds = new Set(getAllChannels().map(channel => channel.id));
    if (!Array.isArray(saved)) return defaultActiveIds();
    const filtered = saved.filter(id => validIds.has(id));
    return filtered.length || saved.length === 0 ? filtered : defaultActiveIds();
  }

  function saveActiveIds() {
    localStorage.setItem(STORAGE.active, JSON.stringify(activeIds));
    localStorage.setItem(STORAGE.order, JSON.stringify(activeIds));
  }

  function updateClock() {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function qualityMode() {
    return QUALITY_MODES.find(mode => mode.id === currentQuality) || QUALITY_MODES[0];
  }

  function applyQualityToHls(hls) {
    if (!hls || !Array.isArray(hls.levels) || !hls.levels.length) return;
    const maxHeight = qualityMode().maxHeight;
    if (!Number.isFinite(maxHeight)) {
      hls.autoLevelCapping = -1;
      return;
    }

    let selected = -1;
    hls.levels.forEach((level, index) => {
      const height = Number(level.height || 0);
      if (height && height <= maxHeight) selected = index;
    });

    if (selected < 0) {
      selected = hls.levels.reduce((best, level, index, list) => {
        const height = Number(level.height || Number.MAX_SAFE_INTEGER);
        const bestHeight = Number(list[best]?.height || Number.MAX_SAFE_INTEGER);
        return height < bestHeight ? index : best;
      }, 0);
    }
    hls.autoLevelCapping = selected;
  }

  function cycleQuality() {
    const index = QUALITY_MODES.findIndex(mode => mode.id === currentQuality);
    currentQuality = QUALITY_MODES[(index + 1) % QUALITY_MODES.length].id;
    localStorage.setItem(STORAGE.quality, currentQuality);
    els.qualityLabel.textContent = qualityMode().label;
    hlsInstances.forEach(applyQualityToHls);
  }

  function computeGrid(count, layout) {
    if (window.innerWidth <= 700) return { cols: 1, rows: Math.max(1, count) };

    const fixed = Number(layout);
    const target = Number.isFinite(fixed) && fixed > 0 ? fixed : count;
    if (target <= 1) return { cols: 1, rows: 1 };
    if (target === 2) return { cols: 2, rows: 1 };
    if (target <= 4) return { cols: 2, rows: 2 };
    if (target <= 6) return { cols: 3, rows: 2 };
    if (target <= 9) return { cols: 3, rows: 3 };
    if (target <= 12) return { cols: 4, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  }

  function updateGridGeometry() {
    const { cols, rows } = computeGrid(activeIds.length, currentLayout);
    els.grid.style.setProperty("--cols", String(cols));
    els.grid.style.setProperty("--rows", String(rows));
  }

  function destroyPlayer(id) {
    const hls = hlsInstances.get(id);
    if (hls) {
      try { hls.destroy(); } catch { }
      hlsInstances.delete(id);
    }
  }

  function destroyAllPlayers() {
    Array.from(hlsInstances.keys()).forEach(destroyPlayer);
  }

  function showError(card, message) {
    card.querySelector(".loading-overlay").hidden = true;
    const error = card.querySelector(".error-overlay");
    error.hidden = false;
    const text = error.querySelector(".error-text");
    if (message) text.textContent = message;
  }

  function showPlaying(card) {
    card.querySelector(".loading-overlay").hidden = true;
    card.querySelector(".error-overlay").hidden = true;
  }

  function streamUrlFor(channel, sourceUrl) {
    if (!channel.proxyProfile || location.protocol === "file:") return sourceUrl;
    return `/proxy?p=${encodeURIComponent(channel.proxyProfile)}&url=${encodeURIComponent(sourceUrl)}`;
  }

  function startPlayer(card, channel, sourceIndex = 0) {
    destroyPlayer(channel.id);

    const urls = channelUrls(channel);
    const video = card.querySelector("video");
    const loading = card.querySelector(".loading-overlay");
    const loadingText = card.querySelector(".loading-text");
    const error = card.querySelector(".error-overlay");

    const attemptToken = `${Date.now()}-${Math.random()}`;
    card.dataset.attemptToken = attemptToken;
    card.dataset.sourceIndex = String(sourceIndex);

    loading.hidden = false;
    error.hidden = true;
    loadingText.textContent = urls.length > 1 ? `מתחבר לשידור - מקור ${sourceIndex + 1} מתוך ${urls.length}` : "מתחבר לשידור...";
    video.muted = true;
    video.controls = false;
    video.removeAttribute("src");
    video.load();

    if (!urls.length) {
      showError(card, "לא הוגדרה כתובת שידור לערוץ הזה.");
      return;
    }

    if (sourceIndex >= urls.length) {
      const proxyHint = channel.proxyProfile && location.protocol === "file:"
        ? " הפעילי את האתר דרך Start.cmd כדי לאפשר את החיבור המקומי הנדרש לערוץ הזה."
        : "";
      showError(card, `כל מקורות השידור הזמינים נכשלו.${proxyHint}`);
      return;
    }

    const sourceUrl = urls[sourceIndex];
    const streamUrl = streamUrlFor(channel, sourceUrl);
    let hasStarted = false;

    const isCurrentAttempt = () => card.isConnected && card.dataset.attemptToken === attemptToken;

    const tryNextSource = (message) => {
      if (!isCurrentAttempt()) return;
      destroyPlayer(channel.id);
      if (sourceIndex + 1 < urls.length) {
        setTimeout(() => {
          if (isCurrentAttempt()) startPlayer(card, channel, sourceIndex + 1);
        }, 250);
        return;
      }
      const proxyHint = channel.proxyProfile && location.protocol === "file:"
        ? " הפעילי דרך Start.cmd ולא דרך Open-Direct.cmd."
        : "";
      showError(card, `${message || "השידור לא זמין כרגע."}${proxyHint}`);
    };

    const onCanPlay = () => {
      if (!isCurrentAttempt()) return;
      hasStarted = true;
      showPlaying(card);
      video.play().catch(() => { });
    };
    video.addEventListener("canplay", onCanPlay, { once: true });

    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 0,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
        manifestLoadingTimeOut: 12000,
        levelLoadingTimeOut: 12000,
        fragLoadingTimeOut: 15000
      });

      hlsInstances.set(channel.id, hls);
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (!isCurrentAttempt()) return;
        applyQualityToHls(hls);
        video.play().catch(() => { });
      });

      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || !isCurrentAttempt()) return;

        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && hasStarted) {
          try {
            hls.recoverMediaError();
            return;
          } catch { }
        }

        const message = data.type === window.Hls.ErrorTypes.NETWORK_ERROR
          ? "לא ניתן להתחבר למקור השידור."
          : "נגן הווידאו לא הצליח לפענח את השידור.";
        tryNextSource(message);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener("error", () => tryNextSource("לא ניתן להתחבר למקור השידור."), { once: true });
      video.play().catch(() => { });
    } else {
      showError(card, "הדפדפן לא תומך ב-HLS והספרייה hls.js לא נטענה. נסי Chrome או Edge מעודכן.");
      return;
    }

    setTimeout(() => {
      if (!isCurrentAttempt() || hasStarted) return;
      tryNextSource("החיבור לשידור ארך יותר מדי זמן.");
    }, 18000);
  }

  function muteAllExcept(id) {
    els.grid.querySelectorAll(".channel-card").forEach(card => {
      const video = card.querySelector("video");
      const button = card.querySelector(".audio-btn");
      const isTarget = card.dataset.id === id;
      video.muted = !isTarget;
      button.textContent = isTarget ? "קול" : "שקט";
      button.title = isTarget ? "השתקת הערוץ" : "הפעלת קול";
    });
  }

  function toggleAudio(card) {
    const video = card.querySelector("video");
    if (video.muted) {
      muteAllExcept(card.dataset.id);
      video.play().catch(() => { });
    } else {
      video.muted = true;
      const button = card.querySelector(".audio-btn");
      button.textContent = "שקט";
      button.title = "הפעלת קול";
    }
  }

  function toggleMaximize(card) {
    const id = card.dataset.id;
    if (maximizedId === id) {
      card.classList.remove("is-maximized");
      document.body.classList.remove("card-maximized");
      maximizedId = null;
      card.querySelector(".maximize-btn").textContent = "□";
      return;
    }

    const previous = els.grid.querySelector(".channel-card.is-maximized");
    if (previous) {
      previous.classList.remove("is-maximized");
      previous.querySelector(".maximize-btn").textContent = "□";
    }

    maximizedId = id;
    card.classList.add("is-maximized");
    document.body.classList.add("card-maximized");
    card.querySelector(".maximize-btn").textContent = "▣";
  }

  function buildCard(channel) {
    const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = channel.id;
    card.style.setProperty("--channel-accent", channel.accent || "#3196dc");
    card.querySelector(".channel-title").textContent = channel.name;
    card.querySelector(".channel-badge-card").textContent = channel.short || channel.name.slice(0, 3);

    const official = card.querySelector(".official-link");
    if (channel.official) {
      official.href = channel.official;
      official.hidden = false;
    } else {
      official.hidden = true;
    }

    card.querySelector(".audio-btn").addEventListener("click", () => toggleAudio(card));
    card.querySelector(".maximize-btn").addEventListener("click", () => toggleMaximize(card));
    card.querySelector(".restart-btn").addEventListener("click", () => startPlayer(card, channel, 0));
    card.querySelector(".close-btn").addEventListener("click", () => {
      activeIds = activeIds.filter(id => id !== channel.id);
      saveActiveIds();
      if (maximizedId === channel.id) {
        maximizedId = null;
        document.body.classList.remove("card-maximized");
      }
      render();
    });
    card.querySelector(".retry-stream").addEventListener("click", () => startPlayer(card, channel, 0));
    card.querySelector("video").addEventListener("dblclick", () => toggleMaximize(card));

    card.addEventListener("dragstart", event => {
      dragId = channel.id;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", channel.id);
    });
    card.addEventListener("dragend", () => {
      dragId = null;
      card.classList.remove("dragging");
      els.grid.querySelectorAll(".drag-over").forEach(element => element.classList.remove("drag-over"));
    });
    card.addEventListener("dragover", event => {
      if (!dragId || dragId === channel.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", event => {
      event.preventDefault();
      card.classList.remove("drag-over");
      const fromId = dragId || event.dataTransfer.getData("text/plain");
      const toId = channel.id;
      if (!fromId || fromId === toId) return;
      const from = activeIds.indexOf(fromId);
      const to = activeIds.indexOf(toId);
      if (from < 0 || to < 0) return;
      const [moved] = activeIds.splice(from, 1);
      activeIds.splice(to, 0, moved);
      saveActiveIds();
      render();
    });

    return card;
  }

  function render() {
    destroyAllPlayers();
    els.grid.textContent = "";
    updateGridGeometry();
    els.empty.hidden = activeIds.length !== 0;
    els.grid.hidden = activeIds.length === 0;

    activeIds.forEach(id => {
      const channel = byId(id);
      if (!channel) return;
      const card = buildCard(channel);
      els.grid.appendChild(card);
      startPlayer(card, channel, 0);
    });
  }

  function renderPicker() {
    els.channelPicker.textContent = "";
    const selected = new Set(activeIds);
    getAllChannels().forEach(channel => {
      const label = document.createElement("label");
      label.className = "channel-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = channel.id;
      checkbox.checked = selected.has(channel.id);

      const badge = document.createElement("span");
      badge.className = "channel-badge";
      badge.textContent = channel.short || channel.name.slice(0, 3);
      badge.style.setProperty("--picker-accent", channel.accent || "#284b69");

      const name = document.createElement("span");
      name.textContent = channel.name;

      label.append(checkbox, badge, name);
      els.channelPicker.appendChild(label);
    });
  }

  function openChannels() {
    renderPicker();
    els.channelsDialog.showModal();
  }

  function applyPickerSelection() {
    const checked = Array.from(els.channelPicker.querySelectorAll('input[type="checkbox"]:checked')).map(element => element.value);
    const oldOrder = activeIds.filter(id => checked.includes(id));
    const newOnes = checked.filter(id => !oldOrder.includes(id));
    activeIds = [...oldOrder, ...newOnes];
    saveActiveIds();
    render();
  }

  function addCustomChannel() {
    const name = els.customName.value.trim();
    const url = els.customUrl.value.trim();
    const official = els.customOfficial.value.trim();
    if (!name || !/^https?:\/\//i.test(url) || !/\.m3u8(?:$|\?)/i.test(url)) {
      alert("יש להזין שם וכתובת HTTP/HTTPS שמפנה לקובץ m3u8.");
      return;
    }

    const custom = getCustomChannels();
    const id = `custom-${Date.now().toString(36)}`;
    custom.push({
      id,
      name,
      short: "LIVE",
      type: "hls",
      urls: [url],
      official,
      accent: "#3f8fc5",
      primary: false
    });
    localStorage.setItem(STORAGE.custom, JSON.stringify(custom));
    activeIds.push(id);
    saveActiveIds();
    els.customName.value = "";
    els.customUrl.value = "";
    els.customOfficial.value = "";
    renderPicker();
  }

  function toggleLayoutPopover() {
    els.layoutPopover.hidden = !els.layoutPopover.hidden;
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { }
  }

  els.channelsBtn.addEventListener("click", openChannels);
  els.emptyChannelsBtn.addEventListener("click", openChannels);
  els.applyChannelsBtn.addEventListener("click", applyPickerSelection);
  els.selectPrimaryBtn.addEventListener("click", () => {
    const primary = new Set(getAllChannels().filter(channel => channel.primary).map(channel => channel.id));
    els.channelPicker.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = primary.has(checkbox.value);
    });
  });
  els.clearSelectionBtn.addEventListener("click", () => {
    els.channelPicker.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
  });
  els.addCustomBtn.addEventListener("click", addCustomChannel);
  els.reloadBtn.addEventListener("click", render);
  els.fullscreenBtn.addEventListener("click", toggleFullscreen);
  els.qualityBtn.addEventListener("click", cycleQuality);
  els.helpBtn.addEventListener("click", () => els.helpDialog.showModal());
  els.layoutBtn.addEventListener("click", event => {
    event.stopPropagation();
    toggleLayoutPopover();
  });
  els.layoutPopover.addEventListener("click", event => {
    const button = event.target.closest("button[data-layout]");
    if (!button) return;
    currentLayout = button.dataset.layout;
    localStorage.setItem(STORAGE.layout, currentLayout);
    els.layoutPopover.hidden = true;
    updateGridGeometry();
  });
  document.addEventListener("click", event => {
    if (!els.layoutPopover.hidden && !els.layoutPopover.contains(event.target) && !els.layoutBtn.contains(event.target)) {
      els.layoutPopover.hidden = true;
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && maximizedId) {
      const card = els.grid.querySelector(`.channel-card[data-id="${CSS.escape(maximizedId)}"]`);
      if (card) toggleMaximize(card);
    }
  });
  window.addEventListener("resize", updateGridGeometry);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      els.grid.querySelectorAll("video").forEach(video => video.play().catch(() => { }));
    }
  });

  activeIds = loadActiveIds();
  els.qualityLabel.textContent = qualityMode().label;
  updateClock();
  setInterval(updateClock, 1000);
  render();
})();
