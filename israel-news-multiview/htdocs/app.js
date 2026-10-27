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

  const WEATHER_CITIES = [
    { id: "jerusalem", name: "ירושלים", lat: 31.7683, lon: 35.2137 },
    { id: "telaviv", name: "תל אביב", lat: 32.0853, lon: 34.7818 },
    { id: "haifa", name: "חיפה", lat: 32.7940, lon: 34.9896 },
    { id: "beersheba", name: "באר שבע", lat: 31.2520, lon: 34.7915 },
    { id: "eilat", name: "אילת", lat: 29.5577, lon: 34.9519 }
  ];
  const WEATHER_CACHE_KEY = "israelNewsMultiview.weather.v3";
  const WEATHER_REFRESH_MS = 10 * 60 * 1000;
  const WEATHER_ROTATE_MS = 10 * 1000;
  const MARKET_CACHE_KEY = "israelNewsMultiview.markets.v1";
  const MARKET_REFRESH_MS = 5 * 60 * 1000;
  const MARKET_INDICES = [
    { id: "ta35", label: "תא 35", symbol: "^TA35.TA" },
    { id: "ta125", label: "תא 125", symbol: "^TA125.TA" },
    { id: "sp500", label: "S&P 500", symbol: "^GSPC" },
    { id: "nasdaq", label: "NASDAQ", symbol: "^IXIC" },
    { id: "teva", label: "טבע", symbol: "TEVA" },
    { id: "leumi", label: "לאומי", symbol: "LUMI.TA" },
    { id: "apple", label: "APPLE", symbol: "AAPL" },
    { id: "nvidia", label: "NVIDIA", symbol: "NVDA" }
  ];
  const TABLER_ICON_BASE = "https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/";

  const els = {
    topbar: document.getElementById("topbar"),
    grid: document.getElementById("channelGrid"),
    empty: document.getElementById("emptyState"),
    cardTemplate: document.getElementById("channelCardTemplate"),
    clock: document.getElementById("clock"),
    weatherRotator: document.getElementById("weatherRotator"),
    weatherRotatorContent: document.getElementById("weatherRotatorContent"),
    weatherIcon: document.getElementById("weatherIcon"),
    weatherCityName: document.getElementById("weatherCityName"),
    weatherTemperature: document.getElementById("weatherTemperature"),
    marketTicker: document.getElementById("marketTicker"),
    marketTickerItems: document.getElementById("marketTickerItems"),
    fullscreenBtn: document.getElementById("fullscreenBtn"),
    fullscreenIcon: document.getElementById("fullscreenIcon"),
    fullscreenLabel: document.getElementById("fullscreenLabel"),
    mobileMenuBtn: document.getElementById("mobileMenuBtn"),
    mobileMenuIcon: document.getElementById("mobileMenuIcon"),
    reloadBtn: document.getElementById("reloadBtn"),
    channelsBtn: document.getElementById("channelsBtn"),
    emptyChannelsBtn: document.getElementById("emptyChannelsBtn"),
    channelsDialog: document.getElementById("channelsDialog"),
    channelPicker: document.getElementById("channelPicker"),
    customName: document.getElementById("customName"),
    customUrl: document.getElementById("customUrl"),
    customOfficial: document.getElementById("customOfficial"),
    addCustomBtn: document.getElementById("addCustomBtn"),
    layoutBtn: document.getElementById("layoutBtn"),
    layoutPopover: document.getElementById("layoutPopover"),
    qualityBtn: document.getElementById("qualityBtn"),
    qualityLabel: document.getElementById("qualityLabel"),
    helpBtn: document.getElementById("helpBtn"),
    helpDialog: document.getElementById("helpDialog"),
    qualityPopover: document.getElementById("qualityPopover"),
    qualityIntro: document.getElementById("qualityIntro"),
    qualityIntroDismiss: document.getElementById("qualityIntroDismiss"),
    qualityIntroChange: document.getElementById("qualityIntroChange"),
    scheduleDialog: document.getElementById("scheduleDialog"),
    scheduleFrame: document.getElementById("scheduleFrame"),
    scheduleFrameWrap: document.getElementById("scheduleFrameWrap"),
    scheduleCustom: document.getElementById("scheduleCustom"),
    scheduleCustomHeading: document.getElementById("scheduleCustomHeading"),
    scheduleCustomMeta: document.getElementById("scheduleCustomMeta"),
    scheduleCustomBody: document.getElementById("scheduleCustomBody"),
    scheduleRefreshBtn: document.getElementById("scheduleRefreshBtn"),
    scheduleExternal: document.getElementById("scheduleExternal"),
    scheduleDoneBtn: document.getElementById("scheduleDoneBtn")
  };

  const hlsInstances = new Map();
  let activeIds = [];
  let currentLayout = localStorage.getItem(STORAGE.layout) || "auto";
  let currentQuality = localStorage.getItem(STORAGE.quality) || "economy";
  let maximizedId = null;
  let dragId = null;
  let currentScheduleChannel = null;
  let scheduleLoadToken = 0;
  let weatherValues = {};
  let weatherUpdatedAt = 0;
  let weatherIndex = 0;
  let weatherSwitchTimer = null;
  let channelsCloseTimer = null;

  function safeJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function isCustomChannel(channel) {
    return Boolean(channel && (channel.custom === true || String(channel.id || "").startsWith("custom-")));
  }

  function normalizedChannelName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("he-IL");
  }

  function normalizedStreamUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}`;
    } catch {
      return raw;
    }
  }

  function nextFreeChannelNumber(usedNumbers) {
    let number = 1;
    while (usedNumbers.has(number)) number += 1;
    usedNumbers.add(number);
    return String(number);
  }

  function getCustomChannels() {
    const stored = safeJson(STORAGE.custom, []);
    if (!Array.isArray(stored)) return [];

    const base = Array.isArray(window.NEWS_CHANNELS) ? window.NEWS_CHANNELS : [];
    const usedNumbers = new Set(
      base
        .map(channel => String(channel?.short || "").trim())
        .filter(value => /^\d+$/.test(value))
        .map(Number)
    );

    let changed = false;
    const repaired = stored.filter(Boolean).map(channel => {
      const copy = { ...channel, custom: true };
      const short = String(copy.short || "").trim();
      const numeric = /^\d+$/.test(short) ? Number(short) : null;
      if (numeric !== null && !usedNumbers.has(numeric)) {
        usedNumbers.add(numeric);
      } else {
        copy.short = nextFreeChannelNumber(usedNumbers);
        changed = true;
      }
      if (channel.custom !== true) changed = true;
      return copy;
    });

    if (changed) localStorage.setItem(STORAGE.custom, JSON.stringify(repaired));
    return repaired;
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

  function weatherCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object" || !parsed.values) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function weatherIconName(code, isDay = true) {
    const value = Number(code);
    const daytime = Number(isDay) !== 0;
    if (!Number.isFinite(value)) return daytime ? "cloud.svg" : "moon.svg";
    if (value === 0) return daytime ? "sun.svg" : "moon.svg";
    if ([1, 2, 3].includes(value)) return "cloud.svg";
    if ([45, 48].includes(value)) return "cloud-fog.svg";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "cloud-rain.svg";
    if ([71, 73, 75, 77, 85, 86].includes(value)) return "snowflake.svg";
    if ([95, 96, 99].includes(value)) return "cloud-storm.svg";
    return "cloud.svg";
  }

  function weatherDescription(code) {
    const value = Number(code);
    if (value === 0) return "בהיר";
    if ([1, 2].includes(value)) return "מעונן חלקית";
    if (value === 3) return "מעונן";
    if ([45, 48].includes(value)) return "ערפל";
    if ([51, 53, 55, 56, 57].includes(value)) return "טפטוף";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "גשם";
    if ([71, 73, 75, 77, 85, 86].includes(value)) return "שלג";
    if ([95, 96, 99].includes(value)) return "סופת רעמים";
    return "מזג אוויר נוכחי";
  }

  function paintWeatherCity(city, animate = false) {
    if (!els.weatherRotatorContent || !city) return;
    const value = weatherValues[city.id] || {};
    const temperature = Number(value.temperature);
    const code = Number(value.weatherCode);
    const localHour = new Date().getHours();
    const fallbackIsDay = localHour >= 6 && localHour < 18 ? 1 : 0;
    const isDay = value.isDay === undefined || value.isDay === null ? fallbackIsDay : Number(value.isDay);

    const apply = () => {
      els.weatherCityName.textContent = city.name;
      els.weatherTemperature.textContent = Number.isFinite(temperature) ? `${Math.round(temperature)}°` : "--°";
      els.weatherIcon.src = `${TABLER_ICON_BASE}${weatherIconName(code, isDay)}`;
      const condition = code === 0 && isDay === 0 ? "בהיר בלילה" : weatherDescription(code);
      const details = Number.isFinite(temperature) ? `${Math.round(temperature)}°C, ${condition}` : condition;
      const updated = weatherUpdatedAt ? `, עודכן ${new Date(weatherUpdatedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}` : "";
      els.weatherRotator.title = `${city.name}: ${details}${updated}`;
      els.weatherIcon.alt = code === 0 && isDay === 0 ? "לילה בהיר" : weatherDescription(code);
    };

    if (!animate) {
      apply();
      return;
    }

    els.weatherRotatorContent.classList.remove("weather-enter");
    els.weatherRotatorContent.classList.add("weather-leave");
    window.setTimeout(() => {
      apply();
      els.weatherRotatorContent.classList.remove("weather-leave");
      els.weatherRotatorContent.classList.add("weather-enter");
      window.setTimeout(() => els.weatherRotatorContent.classList.remove("weather-enter"), 430);
    }, 320);
  }

  function renderWeather(values, updatedAt) {
    weatherValues = values || {};
    weatherUpdatedAt = Number(updatedAt || 0);
    const city = WEATHER_CITIES[weatherIndex % WEATHER_CITIES.length];
    paintWeatherCity(city, false);
  }

  function rotateWeatherCity() {
    weatherIndex = (weatherIndex + 1) % WEATHER_CITIES.length;
    paintWeatherCity(WEATHER_CITIES[weatherIndex], true);
  }

  async function updateWeather() {
    const cached = weatherCache();
    if (cached) renderWeather(cached.values, cached.updatedAt);

    const latitudes = WEATHER_CITIES.map(city => city.lat).join(",");
    const longitudes = WEATHER_CITIES.map(city => city.lon).join(",");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitudes)}&longitude=${encodeURIComponent(longitudes)}&current=temperature_2m,weather_code,is_day&forecast_days=1`;
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
      const payload = await response.json();
      const locations = Array.isArray(payload) ? payload : [payload];
      const values = {};
      WEATHER_CITIES.forEach((city, index) => {
        const temperature = Number(locations[index]?.current?.temperature_2m);
        const weatherCode = Number(locations[index]?.current?.weather_code);
        const isDay = Number(locations[index]?.current?.is_day);
        if (Number.isFinite(temperature)) {
          values[city.id] = {
            temperature,
            weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
            isDay: Number.isFinite(isDay) ? isDay : 1
          };
        }
      });
      if (!Object.keys(values).length) throw new Error("No weather data");
      const entry = { updatedAt: Date.now(), values };
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(entry));
      renderWeather(values, entry.updatedAt);
    } catch {
      if (cached) renderWeather(cached.values, cached.updatedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  function marketCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MARKET_CACHE_KEY) || "null");
      return parsed && typeof parsed === "object" && parsed.values ? parsed : null;
    } catch {
      return null;
    }
  }

  function formatMarketNumber(value) {
    return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
  }

  function renderMarkets(values, updatedAt = 0) {
    if (!els.marketTickerItems) return;
    els.marketTickerItems.textContent = "";
    const fragment = document.createDocumentFragment();
    MARKET_INDICES.forEach(index => {
      const quote = values?.[index.id];
      const item = document.createElement("div");
      item.className = "market-item";
      const name = document.createElement("strong");
      name.textContent = index.label;
      const value = document.createElement("span");
      value.className = "market-value";
      const change = document.createElement("span");
      change.className = "market-change";

      if (quote && Number.isFinite(quote.price) && Number.isFinite(quote.changePercent)) {
        const direction = quote.changePercent > 0 ? "עלייה" : quote.changePercent < 0 ? "ירידה" : "ללא שינוי";
        value.textContent = formatMarketNumber(quote.price);
        change.textContent = `${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`;
        change.classList.add(quote.changePercent > 0 ? "is-up" : quote.changePercent < 0 ? "is-down" : "is-flat");
        item.setAttribute("aria-label", `${index.label}: ${value.textContent}, ${direction} של ${Math.abs(quote.changePercent).toFixed(2)} אחוז`);
      } else {
        value.textContent = "—";
        change.textContent = "לא זמין";
        change.classList.add("is-flat");
        item.setAttribute("aria-label", `${index.label}: נתון לא זמין`);
      }
      item.append(name, value, change);
      fragment.appendChild(item);
    });
    els.marketTickerItems.appendChild(fragment);
    els.marketTickerItems.setAttribute("aria-busy", "false");
    if (updatedAt) els.marketTicker.title = `עודכן ${new Date(updatedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }

  async function fetchMarketQuote(index) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(index.symbol)}?range=1d&interval=5m`;
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
      const result = (await response.json())?.chart?.result?.[0];
      const meta = result?.meta;
      const price = Number(meta?.regularMarketPrice);
      const previousClose = Number(meta?.chartPreviousClose || meta?.previousClose);
      if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) throw new Error("Invalid market quote");
      return { id: index.id, price, changePercent: ((price - previousClose) / previousClose) * 100 };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function updateMarkets() {
    const cached = marketCache();
    if (cached) renderMarkets(cached.values, cached.updatedAt);
    try {
      const results = await Promise.allSettled(MARKET_INDICES.map(fetchMarketQuote));
      const quotes = results.filter(result => result.status === "fulfilled").map(result => result.value);
      if (!quotes.length) throw new Error("No market quotes available");
      const values = Object.fromEntries(quotes.map(quote => [quote.id, quote]));
      const entry = { updatedAt: Date.now(), values };
      localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(entry));
      renderMarkets(values, entry.updatedAt);
    } catch {
      if (!cached) renderMarkets({});
    }
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

  function updateQualityUi() {
    const mode = qualityMode();
    els.qualityLabel.textContent = mode.label;
    if (els.qualityPopover) {
      els.qualityPopover.querySelectorAll("[data-quality]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.quality === mode.id);
      });
    }
  }

  function setQuality(id) {
    if (!QUALITY_MODES.some(mode => mode.id === id)) return;
    currentQuality = id;
    localStorage.setItem(STORAGE.quality, currentQuality);
    updateQualityUi();
    hlsInstances.forEach(applyQualityToHls);
    if (els.qualityPopover) els.qualityPopover.hidden = true;
    els.qualityBtn.setAttribute("aria-expanded", "false");
  }

  function toggleQualityPopover() {
    const willOpen = els.qualityPopover.hidden;
    els.qualityPopover.hidden = !willOpen;
    els.qualityBtn.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) els.layoutPopover.hidden = true;
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
    // InfinityFree version: streams are fetched directly from their public CDN.
    // No server-side proxy is used, which keeps the hosting lightweight and compliant.
    return sourceUrl;
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
      showError(card, "כל מקורות השידור הזמינים נכשלו. ייתכן שספק הערוץ חוסם ניגון מאתרים חיצוניים או ששינה את כתובת השידור.");
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
      showError(card, `${message || "השידור לא זמין כרגע."} אם הערוץ חוסם הטמעה חיצונית, אפשר להשתמש בכפתור "פתיחת האתר הרשמי".`);
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
      showError(card, "הדפדפן לא תומך ב-HLS והספרייה hls.js לא נטענה. נסו Chrome או Edge מעודכן.");
      return;
    }

    setTimeout(() => {
      if (!isCurrentAttempt() || hasStarted) return;
      tryNextSource("החיבור לשידור ארך יותר מדי זמן.");
    }, 18000);
  }

  const TABLER_RAW = "https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/";

  function setAudioButton(button, muted) {
    const img = button.querySelector("img");
    const label = button.querySelector("span");
    if (img) img.src = `${TABLER_RAW}${muted ? "volume-off" : "volume"}.svg`;
    if (label) label.textContent = muted ? "שקט" : "קול";
    button.title = muted ? "הפעלת קול" : "השתקת הערוץ";
    button.setAttribute("aria-label", button.title);
  }

  function muteAllExcept(id) {
    els.grid.querySelectorAll(".channel-card").forEach(card => {
      const video = card.querySelector("video");
      const button = card.querySelector(".audio-btn");
      const isTarget = card.dataset.id === id;
      video.muted = !isTarget;
      setAudioButton(button, !isTarget);
    });
  }

  function toggleAudio(card) {
    const video = card.querySelector("video");
    if (video.muted) {
      muteAllExcept(card.dataset.id);
      video.play().catch(() => { });
    } else {
      video.muted = true;
      setAudioButton(card.querySelector(".audio-btn"), true);
    }
  }

  function toggleMaximize(card) {
    const id = card.dataset.id;
    if (maximizedId === id) {
      card.classList.remove("is-maximized");
      document.body.classList.remove("card-maximized");
      maximizedId = null;
      return;
    }

    const previous = els.grid.querySelector(".channel-card.is-maximized");
    if (previous) previous.classList.remove("is-maximized");

    maximizedId = id;
    card.classList.add("is-maximized");
    document.body.classList.add("card-maximized");
  }

  function scheduleUrlFor(channel) {
    if (!channel.schedule) return "";
    if (!channel.schedule.includes("{weekday}")) return channel.schedule;
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return channel.schedule.replace("{weekday}", weekdays[new Date().getDay()]);
  }

  function cleanScheduleText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function normalizeScheduleTime(value) {
    const match = String(value || "").match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\D|$)/);
    if (!match) return "";
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  function scheduleMinutes(time) {
    const match = String(time).match(/^(\d{2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
  }

  function cleanProgramTitle(text, time) {
    let value = cleanScheduleText(text);
    if (time) value = value.replace(new RegExp(time.replace(":", "\\:"), "g"), " ");
    value = value
      .replace(/\b(?:לצפייה|לשידור חי|שידור חי|לפרטים נוספים|פרטים נוספים)\b/g, " ")
      .replace(/^(?:כאן\s*11|לוח\s*שידורים)(?:\s*[-|:]\s*)?/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[-|•·\s]+|[-|•·\s]+$/g, "")
      .trim();
    return value;
  }

  function addScheduleItem(target, seen, time, title, source) {
    const normalizedTime = normalizeScheduleTime(time);
    const normalizedTitle = cleanProgramTitle(title, normalizedTime);
    if (!normalizedTime || normalizedTitle.length < 2 || normalizedTitle.length > 180) return;
    if (/^(?:כאן|kan|tv guide|לוח שידורים)$/i.test(normalizedTitle)) return;
    const key = `${normalizedTime}|${normalizedTitle.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    target.push({ time: normalizedTime, title: normalizedTitle, source });
  }

  function extractScheduleFromTables(doc, items, seen) {
    const rows = Array.from(doc.querySelectorAll("table tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td,th"));
      if (cells.length < 2) continue;
      const time = normalizeScheduleTime(cells[0].textContent);
      if (!time) continue;
      const title = cleanScheduleText(cells[1].textContent);
      if (title) addScheduleItem(items, seen, time, title, "table");
    }
  }

  function extractScheduleFromJson(doc, items, seen) {
    const scripts = Array.from(doc.querySelectorAll('script[type="application/json"], script[type="application/ld+json"], script#__NEXT_DATA__'));
    let visited = 0;
    const titleKeys = ["title", "name", "programName", "programTitle", "programmeName", "episodeTitle", "description"];
    const timeKeys = ["time", "startTime", "start_time", "startDate", "start", "broadcastTime", "broadcast_time"];

    const visit = value => {
      if (visited++ > 12000 || value == null) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value !== "object") return;

      let time = "";
      for (const key of timeKeys) {
        if (key in value) {
          time = normalizeScheduleTime(value[key]);
          if (time) break;
        }
      }
      if (!time) {
        for (const [key, candidate] of Object.entries(value)) {
          if (/time|start/i.test(key) && typeof candidate === "string") {
            time = normalizeScheduleTime(candidate);
            if (time) break;
          }
        }
      }

      if (time) {
        let title = "";
        for (const key of titleKeys) {
          if (typeof value[key] === "string" && cleanScheduleText(value[key]).length >= 2) {
            title = value[key];
            break;
          }
        }
        if (title) addScheduleItem(items, seen, time, title, "json");
      }
      Object.values(value).forEach(visit);
    };

    scripts.forEach(script => {
      const text = script.textContent.trim();
      if (!text || text.length > 5_000_000) return;
      try { visit(JSON.parse(text)); } catch { }
    });
  }

  function extractScheduleFromDom(doc, items, seen) {
    doc.querySelectorAll("script,style,noscript,svg,header,footer,nav").forEach(node => node.remove());
    const nodes = Array.from(doc.querySelectorAll("body *"));
    const timeNodes = nodes.filter(node => {
      const text = cleanScheduleText(node.textContent);
      if (text.length > 28) return false;
      return /(?:^|\D)(?:[01]?\d|2[0-3]):[0-5]\d(?:\D|$)/.test(text);
    });

    for (const timeNode of timeNodes) {
      const time = normalizeScheduleTime(timeNode.textContent);
      if (!time) continue;
      let host = timeNode;
      let title = "";

      for (let depth = 0; depth < 5 && host?.parentElement; depth += 1) {
        host = host.parentElement;
        const text = cleanScheduleText(host.textContent);
        const times = text.match(/(?:[01]?\d|2[0-3]):[0-5]\d/g) || [];
        const candidate = cleanProgramTitle(text, time);
        if (times.length === 1 && candidate.length >= 2 && candidate.length <= 180) {
          title = candidate;
          break;
        }
      }

      if (!title && timeNode.parentElement) {
        const siblings = Array.from(timeNode.parentElement.children)
          .filter(node => node !== timeNode)
          .map(node => cleanScheduleText(node.textContent))
          .filter(text => text.length >= 2 && text.length <= 180 && !normalizeScheduleTime(text));
        title = siblings.join(" ");
      }

      if (title) addScheduleItem(items, seen, time, title, "html");
    }
  }

  function parseKanSchedule(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [];
    const seen = new Set();
    extractScheduleFromTables(doc, items, seen);
    extractScheduleFromJson(doc, items, seen);
    extractScheduleFromDom(doc, items, seen);

    const dedupByTimeAndLooseTitle = new Map();
    items.forEach(item => {
      const looseTitle = item.title.replace(/[\W_]+/g, "").slice(0, 45);
      const key = `${item.time}|${looseTitle}`;
      if (!dedupByTimeAndLooseTitle.has(key)) dedupByTimeAndLooseTitle.set(key, item);
    });

    return Array.from(dedupByTimeAndLooseTitle.values())
      .sort((a, b) => scheduleMinutes(a.time) - scheduleMinutes(b.time))
      .slice(0, 80);
  }

  function renderKanSchedule(items) {
    els.scheduleCustomBody.textContent = "";
    if (!items.length) {
      const error = document.createElement("div");
      error.className = "schedule-custom-error";
      error.innerHTML = '<strong>לא הצלחתי לקרוא את התוכניות מהעמוד של כאן.</strong><span>מבנה האתר הרשמי כנראה השתנה או שהתוכן נטען שם רק אחרי JavaScript. אפשר עדיין לפתוח את הלוח הרשמי מהכפתור למטה.</span>';
      els.scheduleCustomBody.appendChild(error);
      return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let currentIndex = -1;
    items.forEach((item, index) => {
      if (scheduleMinutes(item.time) <= nowMinutes) currentIndex = index;
    });

    const list = document.createElement("div");
    list.className = "schedule-list";
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "schedule-row";
      if (index === currentIndex) row.classList.add("is-now");

      const time = document.createElement("time");
      time.textContent = item.time;
      time.dateTime = item.time;

      const copy = document.createElement("div");
      copy.className = "schedule-row-copy";
      const title = document.createElement("strong");
      title.textContent = item.title;
      copy.appendChild(title);
      if (index === currentIndex) {
        const live = document.createElement("span");
        live.className = "schedule-now-label";
        live.textContent = "משודר עכשיו";
        copy.appendChild(live);
      }
      row.append(time, copy);
      list.appendChild(row);
    });
    els.scheduleCustomBody.appendChild(list);
  }

  async function loadKanSchedule(channel) {
    // Kept only as a defensive fallback. InfinityFree free hosting must not be used
    // for scraping/proxying third-party pages, so this build does not fetch guide HTML.
    els.scheduleCustomBody.innerHTML = '<div class="schedule-custom-error"><strong>לוח כאן נטען מהאתר הרשמי בגרסת InfinityFree.</strong><span>השתמשי בכפתור "פתיחה באתר הרשמי" אם האתר אינו מאפשר הצגה בתוך חלון.</span></div>';
    els.scheduleCustomMeta.textContent = "לוח חיצוני";
  }

  function openSchedule(channel) {
    const scheduleUrl = scheduleUrlFor(channel);
    if (!scheduleUrl) return;
    currentScheduleChannel = channel;
    els.scheduleExternal.href = scheduleUrl;

    if (channel.scheduleMode === "kan-html") {
      els.scheduleFrameWrap.hidden = true;
      els.scheduleCustom.hidden = false;
      els.scheduleCustomHeading.textContent = "לוח כאן 11 - היום";
      els.scheduleFrame.src = "about:blank";
      els.scheduleDialog.showModal();
      loadKanSchedule(channel);
      return;
    }

    els.scheduleCustom.hidden = true;
    els.scheduleFrameWrap.hidden = false;
    els.scheduleFrame.src = scheduleUrl;
    els.scheduleDialog.showModal();
  }

  function closeSchedule() {
    scheduleLoadToken += 1;
    currentScheduleChannel = null;
    if (els.scheduleDialog.open) els.scheduleDialog.close();
    els.scheduleFrame.src = "about:blank";
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
    const scheduleBtn = card.querySelector(".schedule-btn");
    if (channel.schedule) {
      scheduleBtn.hidden = false;
      scheduleBtn.addEventListener("click", () => openSchedule(channel));
    } else {
      scheduleBtn.hidden = true;
    }
    card.querySelector(".maximize-btn").addEventListener("click", () => toggleChannelFullscreen(card));
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
    card.querySelector("video").addEventListener("dblclick", () => toggleChannelFullscreen(card));

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
    const hasChannels = activeIds.some(id => Boolean(byId(id)));
    els.empty.hidden = hasChannels;
    els.grid.hidden = !hasChannels;

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
      const row = document.createElement("div");
      row.className = "channel-option-row";

      const label = document.createElement("label");
      label.className = "channel-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = channel.id;
      checkbox.checked = selected.has(channel.id);
      checkbox.addEventListener("change", applyPickerSelection);

      const badge = document.createElement("span");
      badge.className = "channel-badge";
      badge.textContent = channel.short || channel.name.slice(0, 3);
      badge.style.setProperty("--picker-accent", channel.accent || "#284b69");

      const name = document.createElement("span");
      name.className = "channel-option-name";
      name.textContent = channel.name;

      label.append(checkbox, badge, name);
      row.appendChild(label);

      if (isCustomChannel(channel)) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-custom-channel";
        deleteBtn.type = "button";
        deleteBtn.title = `מחיקת ${channel.name}`;
        deleteBtn.setAttribute("aria-label", `מחיקת ${channel.name}`);

        const icon = document.createElement("img");
        icon.className = "tabler-icon";
        icon.src = `${TABLER_ICON_BASE}trash.svg`;
        icon.alt = "";
        deleteBtn.appendChild(icon);
        deleteBtn.addEventListener("click", () => deleteCustomChannel(channel));
        row.appendChild(deleteBtn);
      }

      els.channelPicker.appendChild(row);
    });
  }

  function openChannels() {
    clearTimeout(channelsCloseTimer);
    renderPicker();
    els.channelsDialog.showModal();
  }

  function scheduleChannelsClose() {
    clearTimeout(channelsCloseTimer);
    channelsCloseTimer = window.setTimeout(() => {
      if (els.channelsDialog.open) els.channelsDialog.close();
    }, 5000);
  }

  function applyPickerSelection() {
    const checked = Array.from(els.channelPicker.querySelectorAll('input[type="checkbox"]:checked')).map(element => element.value);
    const oldOrder = activeIds.filter(id => checked.includes(id));
    const newOnes = checked.filter(id => !oldOrder.includes(id));
    activeIds = [...oldOrder, ...newOnes];
    saveActiveIds();
    render();
    scheduleChannelsClose();
  }

  function deleteCustomChannel(channel) {
    if (!isCustomChannel(channel)) return;
    if (!confirm(`למחוק את הערוץ "${channel.name}" מהרשימה?`)) return;

    const custom = getCustomChannels().filter(item => item.id !== channel.id);
    localStorage.setItem(STORAGE.custom, JSON.stringify(custom));
    activeIds = activeIds.filter(id => id !== channel.id);
    saveActiveIds();
    renderPicker();
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

    const allChannels = getAllChannels();
    const wantedName = normalizedChannelName(name);
    const wantedUrl = normalizedStreamUrl(url);
    const duplicate = allChannels.find(channel => {
      const sameName = normalizedChannelName(channel.name) === wantedName;
      const sameUrl = channelUrls(channel).some(source => normalizedStreamUrl(source) === wantedUrl);
      return sameName || sameUrl;
    });

    if (duplicate) {
      alert(`הערוץ כבר קיים ברשימה: ${duplicate.name}`);
      return;
    }

    const custom = getCustomChannels();
    const usedNumbers = new Set(
      allChannels
        .map(channel => String(channel.short || "").trim())
        .filter(value => /^\d+$/.test(value))
        .map(Number)
    );
    const id = `custom-${Date.now().toString(36)}`;
    custom.push({
      id,
      name,
      short: nextFreeChannelNumber(usedNumbers),
      type: "hls",
      urls: [url],
      official,
      accent: "#3f8fc5",
      primary: false,
      custom: true
    });
    localStorage.setItem(STORAGE.custom, JSON.stringify(custom));
    activeIds.push(id);
    saveActiveIds();
    els.customName.value = "";
    els.customUrl.value = "";
    els.customOfficial.value = "";
    renderPicker();
    render();
    scheduleChannelsClose();
  }

  function toggleLayoutPopover() {
    els.layoutPopover.hidden = !els.layoutPopover.hidden;
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isSiteFullscreen() {
    return fullscreenElement() === document.documentElement;
  }

  function updateChannelFullscreenUi() {
    const active = fullscreenElement();
    els.grid.querySelectorAll(".channel-card").forEach(card => {
      const button = card.querySelector(".maximize-btn");
      const icon = button?.querySelector("img");
      const isActive = active === card;
      card.classList.toggle("is-browser-fullscreen", isActive);
      if (button) {
        button.title = isActive ? "יציאה ממסך מלא" : "מסך מלא לערוץ";
        button.setAttribute("aria-label", isActive ? "יציאה ממסך מלא" : "מסך מלא לערוץ");
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      }
      if (icon) icon.src = `${TABLER_ICON_BASE}${isActive ? "arrows-minimize.svg" : "arrows-maximize.svg"}`;
    });
  }

  function updateFullscreenUi() {
    const active = isSiteFullscreen();
    document.documentElement.classList.toggle("fullscreen-active", active);
    els.fullscreenBtn?.setAttribute("aria-pressed", active ? "true" : "false");
    if (els.fullscreenLabel) els.fullscreenLabel.textContent = active ? "יציאה ממסך מלא" : "מסך מלא";
    if (els.fullscreenBtn) els.fullscreenBtn.title = active ? "יציאה ממסך מלא" : "מסך מלא";
    if (els.fullscreenIcon) {
      els.fullscreenIcon.src = `${TABLER_ICON_BASE}${active ? "arrows-minimize.svg" : "arrows-maximize.svg"}`;
    }
    updateChannelFullscreenUi();
    updateGridGeometry();
  }

  async function requestFullscreenFor(element) {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: "hide" });
      return true;
    }
    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
      return true;
    }
    return false;
  }

  async function exitFullscreenMode() {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return true;
    }
    return false;
  }

  async function toggleChannelFullscreen(card) {
    try {
      const current = fullscreenElement();
      if (current === card) {
        await exitFullscreenMode();
        return;
      }

      if (current) await exitFullscreenMode();
      const supported = await requestFullscreenFor(card);
      if (!supported) toggleMaximize(card);
    } catch (error) {
      console.warn("Channel fullscreen was blocked; using in-page maximize instead.", error);
      toggleMaximize(card);
    }
  }

  async function toggleFullscreen() {
    try {
      if (isSiteFullscreen()) {
        await exitFullscreenMode();
        return;
      }

      if (fullscreenElement()) await exitFullscreenMode();
      const supported = await requestFullscreenFor(document.documentElement);
      if (!supported) throw new Error("Fullscreen API is unavailable");
    } catch (error) {
      console.warn("Fullscreen request failed", error);
      window.alert("הדפדפן לא אפשר מעבר אוטומטי למסך מלא. אפשר להשתמש גם ב-F11.");
    }
  }

  function setMobileMenu(open) {
    const shouldOpen = Boolean(open) && window.innerWidth <= 700;
    els.topbar.classList.toggle("mobile-menu-open", shouldOpen);
    els.mobileMenuBtn.setAttribute("aria-expanded", String(shouldOpen));
    els.mobileMenuBtn.setAttribute("aria-label", shouldOpen ? "סגירת תפריט" : "פתיחת תפריט");
    els.mobileMenuBtn.title = shouldOpen ? "סגירת תפריט" : "פתיחת תפריט";
    els.mobileMenuIcon.src = `${TABLER_ICON_BASE}${shouldOpen ? "x.svg" : "menu-2.svg"}`;
  }

  els.channelsBtn.addEventListener("click", openChannels);
  els.emptyChannelsBtn.addEventListener("click", openChannels);
  els.channelsDialog.addEventListener("close", () => clearTimeout(channelsCloseTimer));
  els.addCustomBtn.addEventListener("click", addCustomChannel);
  els.reloadBtn.addEventListener("click", render);
  els.mobileMenuBtn.addEventListener("click", () => {
    setMobileMenu(!els.topbar.classList.contains("mobile-menu-open"));
  });
  els.topbar.addEventListener("click", event => {
    if (event.target.closest("button") && !event.target.closest("#mobileMenuBtn")) setMobileMenu(false);
  });
  els.fullscreenBtn.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenUi);
  document.addEventListener("webkitfullscreenchange", updateFullscreenUi);
  els.qualityBtn.addEventListener("click", event => {
    event.stopPropagation();
    setMobileMenu(false);
    toggleQualityPopover();
  });
  els.helpBtn.addEventListener("click", () => els.helpDialog.showModal());
  els.layoutBtn.addEventListener("click", event => {
    event.stopPropagation();
    setMobileMenu(false);
    els.qualityPopover.hidden = true;
    els.qualityBtn.setAttribute("aria-expanded", "false");
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
  els.qualityPopover.addEventListener("click", event => {
    const button = event.target.closest("button[data-quality]");
    if (!button) return;
    setQuality(button.dataset.quality);
  });
  els.qualityIntroDismiss.addEventListener("click", () => {
    localStorage.setItem("israelNewsMultiview.qualityIntroSeen.v1", "1");
    els.qualityIntro.hidden = true;
  });
  els.qualityIntroChange.addEventListener("click", () => {
    els.qualityIntro.hidden = true;
    localStorage.setItem("israelNewsMultiview.qualityIntroSeen.v1", "1");
    els.qualityPopover.hidden = false;
    els.qualityBtn.setAttribute("aria-expanded", "true");
  });
  els.scheduleRefreshBtn.addEventListener("click", () => {
    if (currentScheduleChannel?.scheduleMode === "kan-html") loadKanSchedule(currentScheduleChannel);
  });
  els.scheduleDoneBtn.addEventListener("click", closeSchedule);
  els.scheduleDialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeSchedule();
  });
  document.addEventListener("click", event => {
    if (!els.layoutPopover.hidden && !els.layoutPopover.contains(event.target) && !els.layoutBtn.contains(event.target)) {
      els.layoutPopover.hidden = true;
    }
    if (!els.qualityPopover.hidden && !els.qualityPopover.contains(event.target) && !els.qualityBtn.contains(event.target)) {
      els.qualityPopover.hidden = true;
      els.qualityBtn.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && els.topbar.classList.contains("mobile-menu-open")) setMobileMenu(false);
    if (event.key === "Escape" && maximizedId) {
      const card = els.grid.querySelector(`.channel-card[data-id="${CSS.escape(maximizedId)}"]`);
      if (card) toggleMaximize(card);
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 700) setMobileMenu(false);
    updateGridGeometry();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      els.grid.querySelectorAll("video").forEach(video => video.play().catch(() => { }));
    }
  });

  activeIds = loadActiveIds();
  updateQualityUi();
  if (!localStorage.getItem("israelNewsMultiview.qualityIntroSeen.v1")) {
    els.qualityIntro.hidden = false;
  }
  updateClock();
  setInterval(updateClock, 1000);
  updateWeather();
  setInterval(updateWeather, WEATHER_REFRESH_MS);
  updateMarkets();
  setInterval(updateMarkets, MARKET_REFRESH_MS);
  weatherSwitchTimer = setInterval(rotateWeatherCity, WEATHER_ROTATE_MS);
  updateFullscreenUi();
  render();
})();
