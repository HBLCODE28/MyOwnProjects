const TadarUI = (() => {
  const state = { currentBattleId: null };
  const loaderState = { timerId: null };
  const DEFAULT_LOADER_SECONDS = 25;
  const YOUTUBE_LOADER_SECONDS = 40;
  let loaderReady = false;

  async function getJson(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      window.location.href = "/login";
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const error = new Error(payload?.error || `הבקשה נכשלה (${response.status})`);
      error.payload = payload;
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  function initLoader() {
    if (loaderReady) return;
    const overlay = document.getElementById("loading-overlay");
    const loadingText = document.getElementById("loading-text");
    const loadingSubtext = document.getElementById("loading-subtext");
    const loadingEta = document.getElementById("loading-eta");
    const loadingMiniBar = document.getElementById("loading-mini-bar");
    if (!overlay) return;

    function clearLoaderTimer() {
      if (loaderState.timerId) {
        window.clearInterval(loaderState.timerId);
        loaderState.timerId = null;
      }
    }

    function updateLoaderCountdown(totalSeconds) {
      const startedAt = Date.now();
      const safeSeconds = Math.max(1, totalSeconds || DEFAULT_LOADER_SECONDS);

      clearLoaderTimer();

      const render = () => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const remainingSeconds = Math.max(0, safeSeconds - elapsedSeconds);
        const progressValue = Math.min(96, Math.round((elapsedSeconds / safeSeconds) * 100));

        if (loadingMiniBar) loadingMiniBar.style.width = `${progressValue}%`;
        if (loadingEta) loadingEta.textContent = `זמן משוער שנותר: ${remainingSeconds}s`;

        if (remainingSeconds === 0) {
          if (loadingText) loadingText.textContent = "עדיין עובדים על התוצאה שלך...";
          if (loadingSubtext) loadingSubtext.textContent = "התהליך מתעכב מעט, אבל הבקשה עדיין רצה.";
          if (loadingEta) loadingEta.textContent = "זמן משוער שנותר: כמעט סיימנו";
          clearLoaderTimer();
        }
      };

      render();
      loaderState.timerId = window.setInterval(render, 1000);
    }

    function hideOverlay() {
      clearLoaderTimer();
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
      if (loadingMiniBar) loadingMiniBar.style.width = "0%";
      if (loadingText) loadingText.textContent = "אנא המתן...";
      if (loadingSubtext) loadingSubtext.textContent = "התהליך נמשך בדרך כלל 10-40 שניות בהתאם למקור.";
      if (loadingEta) loadingEta.textContent = "זמן משוער שנותר: --";
    }

    function showOverlay(totalSeconds) {
      overlay.hidden = false;
      overlay.setAttribute("aria-hidden", "false");
      updateLoaderCountdown(totalSeconds);
    }

    window.hideLoader = hideOverlay;
    document.addEventListener(
      "submit",
      (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.dataset.showLoader !== "1") return;
        if (typeof form.checkValidity === "function" && !form.checkValidity()) {
          hideOverlay();
          return;
        }
        const sourceMode = form.querySelector('input[name="source_mode"]')?.value || "";
        const etaSeconds = sourceMode === "youtube" ? YOUTUBE_LOADER_SECONDS : DEFAULT_LOADER_SECONDS;
        showOverlay(etaSeconds);
      },
      true
    );

    window.addEventListener("pageshow", hideOverlay);
    hideOverlay();
    loaderReady = true;
  }

  function initLanding() {
    const canvas = document.getElementById("landing-visualizer");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const BAR_COUNT = 60;
      const GAP = 3;
      const bars = [];
      let animationFrameId = null;

      const palette = [
        "rgba(42, 157, 143, 0.82)",
        "rgba(233, 196, 106, 0.88)",
        "rgba(244, 162, 97, 0.8)",
      ];

      for (let i = 0; i < BAR_COUNT; i += 1) {
        bars.push({
          current: 0.18 + Math.random() * 0.2,
          target: 0.18 + Math.random() * 0.5,
          speed: 0.02 + Math.random() * 0.04,
          updateTimer: Math.floor(15 + Math.random() * 31),
          color: palette[i % palette.length],
        });
      }

      function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }

      function updateBar(bar) {
        bar.current += (bar.target - bar.current) * bar.speed;
        bar.updateTimer -= 1;
        if (bar.updateTimer <= 0) {
          bar.target = 0.05 + Math.random() * 0.85;
          bar.speed = 0.02 + Math.random() * 0.04;
          bar.updateTimer = Math.floor(15 + Math.random() * 31);
        }
      }

      function drawRoundedBar(x, y, width, height, radius, color) {
        const safeRadius = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + safeRadius, y);
        ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
        ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
        ctx.arcTo(x, y + height, x, y, safeRadius);
        ctx.arcTo(x, y, x + width, y, safeRadius);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      function draw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (!width || !height) return;

        ctx.clearRect(0, 0, width, height);

        const totalGapWidth = GAP * (BAR_COUNT - 1);
        const barWidth = Math.max(2, (width - totalGapWidth) / BAR_COUNT);
        const centerY = height / 2;
        const minHeight = height * 0.05;
        const maxHeight = height * 0.9;
        const radius = Math.min(12, barWidth / 2);

        for (let i = 0; i < BAR_COUNT; i += 1) {
          const bar = bars[i];
          updateBar(bar);
          const barHeight = minHeight + (maxHeight - minHeight) * bar.current;
          const x = i * (barWidth + GAP);
          const y = centerY - barHeight / 2;
          drawRoundedBar(x, y, barWidth, barHeight, radius, bar.color);
        }

        animationFrameId = window.requestAnimationFrame(draw);
      }

      resizeCanvas();
      draw();
      window.addEventListener("resize", resizeCanvas);
    }

    const overlays = document.querySelectorAll(".auth-modal-overlay");
    const open = (id) => {
      overlays.forEach((el) => {
        const match = el.id === id;
        el.hidden = !match;
        el.setAttribute("aria-hidden", String(!match));
      });
    };
    const closeAll = () => {
      overlays.forEach((el) => {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
      });
    };

    document.querySelectorAll("[data-open-modal]").forEach((btn) => btn.addEventListener("click", () => open(btn.dataset.openModal)));
    document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeAll));
    document.querySelectorAll("[data-switch-modal]").forEach((btn) => btn.addEventListener("click", () => open(btn.dataset.switchModal)));
    overlays.forEach((el) => el.addEventListener("click", (event) => { if (event.target === el) closeAll(); }));
  }

  function renderBarRows(target, rows) {
    if (!target) return;
    target.innerHTML = "";
    rows.forEach((row) => {
      const displayValue = row.displayValue ?? row.value;
      const displaySuffix = row.displaySuffix ?? row.suffix ?? "";
      const item = document.createElement("div");
      item.className = "bar-row";
      item.innerHTML = `
        <span>${row.label}</span>
        <div class="bar-shell">
          <div class="bar-fill ${row.tone || ""}" style="width: ${row.value}%"></div>
        </div>
        <strong>${displayValue}${displaySuffix}</strong>
      `;
      target.appendChild(item);
    });
  }

  function bindTrainingPanel() {
    const panel = document.getElementById("train-panel");
    if (!panel) return;
    const stage = document.getElementById("train-stage");
    const message = document.getElementById("train-message");
    const progress = document.getElementById("train-progress");
    const detail = document.getElementById("train-detail");
    const startButton = document.getElementById("train-start-btn");
    const genreList = document.getElementById("train-genre-list");
    const emptyState = document.getElementById("train-empty");
    const selectedGenre = document.getElementById("train-selected-genre");
    const selectedTotal = document.getElementById("train-selected-total");
    const selectedSummary = document.getElementById("train-selected-summary");
    const fileColumns = document.getElementById("train-file-columns");
    const isAdmin = panel.dataset.isAdmin === "1";
    let selectedIndex = 0;
    let genreButtons = [];
    let rows = [];
    let pollTimer = null;

    const splitLabels = {
      train: "אימון",
      val: "ולידציה",
      test: "בדיקה",
    };

    const updateStatus = (data) => {
      stage.textContent = `שלב: ${data.stage_label}`;
      message.textContent = data.message;
      progress.style.width = `${data.progress}%`;
      detail.textContent = `${data.progress}%`;
      renderTrainingBrowser(data.graph || []);
      if (startButton) startButton.disabled = Boolean(data.running) || !isAdmin;
      if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (data.running) {
        pollTimer = window.setTimeout(renderStatus, 2000);
      }
    };

    const renderGenreDetail = (row) => {
      if (!row) {
        selectedGenre.textContent = "בחר סגנון";
        selectedTotal.textContent = "עדיין לא נבחרו קבצים.";
        selectedSummary.textContent = "בחר סגנון מהרשימה כדי לראות את קבצי האימון שלו.";
        fileColumns.innerHTML = "";
        return;
      }

      selectedGenre.textContent = row.genre;
      selectedTotal.textContent = `${row.total} קבצים על פני אימון, ולידציה ובדיקה.`;
      selectedSummary.textContent = `אימון: ${row.train} | ולידציה: ${row.val} | בדיקה: ${row.test}`;
      fileColumns.innerHTML = "";

      ["train", "val", "test"].forEach((split) => {
        const card = document.createElement("section");
        card.className = "training-file-card";
        const files = row.files?.[split] || [];
        card.innerHTML = `
          <h4>${splitLabels[split]}</h4>
          <p class="muted-line">${files.length} קבצים</p>
        `;

        if (!files.length) {
          const empty = document.createElement("p");
          empty.className = "muted-line";
          empty.textContent = "אין קבצים בחלוקה הזו.";
          card.appendChild(empty);
        } else {
          const list = document.createElement("ul");
          list.className = "training-file-list";
          files.forEach((name) => {
            const item = document.createElement("li");
            item.textContent = name;
            list.appendChild(item);
          });
          card.appendChild(list);
        }

        fileColumns.appendChild(card);
      });
    };

    const selectGenre = (index, shouldFocus = false) => {
      if (!rows.length) {
        renderGenreDetail(null);
        return;
      }
      selectedIndex = Math.max(0, Math.min(index, rows.length - 1));
      genreButtons.forEach((button, buttonIndex) => {
        const isSelected = buttonIndex === selectedIndex;
        button.classList.toggle("active", isSelected);
        button.setAttribute("aria-selected", String(isSelected));
        button.tabIndex = isSelected ? 0 : -1;
      });
      if (shouldFocus && genreButtons[selectedIndex]) {
        genreButtons[selectedIndex].focus();
      }
      renderGenreDetail(rows[selectedIndex]);
    };

    const renderTrainingBrowser = (nextRows) => {
      rows = nextRows;
      genreList.innerHTML = "";
      genreButtons = [];

      if (!rows.length) {
        emptyState.hidden = false;
        renderGenreDetail(null);
        return;
      }

      emptyState.hidden = true;
      rows.forEach((row, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "training-genre-button";
        button.setAttribute("role", "option");
        button.innerHTML = `
          <span class="training-genre-name">${row.genre}</span>
          <span class="training-genre-meta">${row.total} קבצים</span>
        `;
        button.addEventListener("click", () => selectGenre(index));
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            selectGenre(index + 1, true);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            selectGenre(index - 1, true);
          }
          if (event.key === "Home") {
            event.preventDefault();
            selectGenre(0, true);
          }
          if (event.key === "End") {
            event.preventDefault();
            selectGenre(rows.length - 1, true);
          }
        });
        genreList.appendChild(button);
        genreButtons.push(button);
      });

      selectGenre(Math.min(selectedIndex, rows.length - 1));
    };

    const renderStatus = async () => {
      try {
        const data = await getJson("/api/training_status");
        if (!data) return;
        updateStatus(data);
      } catch (error) {
        message.textContent = error.message;
      }
    };

    if (startButton && isAdmin) {
      startButton.addEventListener("click", async () => {
        try {
          startButton.disabled = true;
          const data = await getJson("/api/start_training", { method: "POST" });
          if (data) updateStatus(data);
        } catch (error) {
          message.textContent = error.message;
          startButton.disabled = false;
        }
      });
    }

    renderStatus();
  }

  function bindMainTrainingPanel() {
    const panel = document.getElementById("main-train-panel");
    if (!panel) return;

    const stage = document.getElementById("main-train-stage");
    const message = document.getElementById("main-train-message");
    const progress = document.getElementById("main-train-progress");
    const detail = document.getElementById("main-train-detail");
    const startButton = document.getElementById("main-train-start-btn");
    const refreshButton = document.getElementById("main-train-refresh-btn");
    const runner = document.getElementById("main-train-runner");
    const started = document.getElementById("main-train-started");
    const finished = document.getElementById("main-train-finished");
    const output = document.getElementById("main-train-output");
    const logPath = document.getElementById("main-train-log-path");
    const log = document.getElementById("main-train-log");
    let pollTimer = null;

    const applyStatus = (data) => {
      stage.textContent = `שלב: ${data.stage_label}`;
      message.textContent = data.message;
      progress.style.width = `${data.progress}%`;
      detail.textContent = `${data.progress}%`;
      if (runner) runner.textContent = data.runner_name || "לא זמין";
      started.textContent = data.started_at || "עדיין לא התחיל";
      finished.textContent = data.finished_at || "עדיין לא הסתיים";
      output.textContent = data.output_notebook || "עדיין לא נוצר";
      logPath.textContent = data.log_path || "עדיין לא נוצר";
      log.textContent = data.log_tail?.length ? data.log_tail.join("\n") : "עדיין אין פלט לוג.";
      if (startButton) startButton.disabled = Boolean(data.running || data.runner_available === false);
      if (refreshButton) refreshButton.disabled = false;
      if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (data.running) {
        pollTimer = window.setTimeout(refresh, 3000);
      }
    };

    const refresh = async () => {
      if (refreshButton) refreshButton.disabled = true;
      try {
        const data = await getJson("/api/main_training/status");
        if (data) applyStatus(data);
      } catch (error) {
        if (error?.payload?.status) applyStatus(error.payload.status);
        message.textContent = error.message;
        if (refreshButton) refreshButton.disabled = false;
      }
    };

    if (startButton) {
      startButton.addEventListener("click", async () => {
        try {
          startButton.disabled = true;
          const data = await getJson("/api/main_training/start", { method: "POST" });
          if (data) applyStatus(data);
        } catch (error) {
          if (error?.payload?.status) applyStatus(error.payload.status);
          message.textContent = error.message;
          if (!error?.payload?.status) startButton.disabled = false;
        }
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", refresh);
    }

    refresh();
  }

  async function populateModelSelects() {
    const models = await getJson("/models_data");
    const selects = [document.getElementById("modelA"), document.getElementById("modelB")].filter(Boolean);
    selects.forEach((select) => {
      select.innerHTML = "";
      models.forEach((model) => select.add(new Option(model.short_name || shortModelLabel(model.name), model.path)));
    });
  }

  function renderStages(stages) {
    const container = document.getElementById("battleStages");
    if (!container) return;
    container.innerHTML = "";
    stages.forEach((stage) => {
      const item = document.createElement("div");
      item.className = `stage-chip ${stage.done ? "done" : ""}`;
      item.innerHTML = `<strong>${stage.name}</strong><span>${stage.done ? "הושלם" : "ממתין"}</span>`;
      container.appendChild(item);
    });
  }

  function shortModelLabel(raw) {
    if (!raw) return "ממתין";
    let value = String(raw).replace(/^models_history\//, "");
    value = value.replace(/^BeatSense_genre_/, "");
    value = value.replace(/_acc_.*$/, "");
    value = value.replace(/\.keras$/i, "");
    return value.replaceAll("_", " ");
  }

  function translateBattleStatus(status) {
    const labels = {
      ready: "מוכן",
      awaiting_judgement: "ממתין להכרעה",
      judged: "הוכרע",
      pending: "ממתין",
      running: "רץ",
      completed: "הושלם",
      failed: "נכשל",
      "מוכן": "מוכן",
      "ממתין להכרעה": "ממתין להכרעה",
      "הוכרע": "הוכרע",
    };
    return labels[status] || String(status || "").replaceAll("_", " ");
  }

  function translateResultLabel(label) {
    const labels = {
      Like: "אהבתי",
      Dislike: "לא אהבתי",
    };
    return labels[label] || label;
  }

  function updateArena(modelA, modelB) {
    const arenaA = document.getElementById("arenaModelA");
    const arenaB = document.getElementById("arenaModelB");
    if (arenaA) arenaA.textContent = shortModelLabel(modelA);
    if (arenaB) arenaB.textContent = shortModelLabel(modelB);
  }

  function setArenaRunning(isRunning) {
    const arena = document.getElementById("battleArena");
    if (!arena) return;
    arena.classList.toggle("is-running", Boolean(isRunning));
  }

  function renderVoteGraph(counts) {
    const voteCounts = {
      model_a: Number(counts?.model_a || 0),
      tie: Number(counts?.tie || 0),
      model_b: Number(counts?.model_b || 0),
    };
    const voteTotal = voteCounts.model_a + voteCounts.tie + voteCounts.model_b;
    const voteWidth = (value) => {
      if (!voteTotal || value <= 0) return 0;
      return Math.max(8, Math.round((value / voteTotal) * 100));
    };

    renderBarRows(document.getElementById("battleVoteGraph"), [
      { label: "הצבעות למודל א׳", value: voteWidth(voteCounts.model_a), tone: "ok", displayValue: voteCounts.model_a },
      { label: "הצבעות תיקו", value: voteWidth(voteCounts.tie), tone: "warn", displayValue: voteCounts.tie },
      { label: "הצבעות למודל ב׳", value: voteWidth(voteCounts.model_b), tone: "bad", displayValue: voteCounts.model_b },
    ]);
  }

  function renderCompareGraph(chart) {
    renderBarRows(document.getElementById("battleCompareGraph"), (chart || []).map((item, index) => ({
      label: item.label,
      value: item.value,
      tone: index === 0 ? "train" : "bad",
      suffix: "%",
    })));
  }

  function renderBattles(battles) {
    const battleList = document.getElementById("battleList");
    const battleSelect = document.getElementById("battleId");
    if (!battleList || !battleSelect) return;
    battleList.innerHTML = "";
    battleSelect.innerHTML = "";
    if (!battles.length) {
      const empty = document.createElement("li");
      empty.textContent = "עדיין לא נוצרו קרבות.";
      battleList.appendChild(empty);
      return;
    }
    battles.forEach((battle) => {
      const item = document.createElement("li");
      const counts = battle.judge_counts || { model_a: 0, model_b: 0, tie: 0 };
      item.innerHTML = `
        <div class="battle-list-row">
          <strong>#${battle.id} ${shortModelLabel(battle.model_a)} מול ${shortModelLabel(battle.model_b)}</strong>
          <span class="battle-status-pill">${translateBattleStatus(battle.status)}</span>
        </div>
        <div class="battle-list-meta">הצבעות: א׳ ${counts.model_a} | תיקו ${counts.tie} | ב׳ ${counts.model_b}</div>
      `;
      battleList.appendChild(item);
      battleSelect.add(new Option(`#${battle.id} - ${shortModelLabel(battle.model_a)} מול ${shortModelLabel(battle.model_b)}`, String(battle.id)));
    });
  }

  function renderJudgeStyles(styleOptions, selectedStyle) {
    const grid = document.getElementById("judgeStyleGrid");
    if (!grid) return;
    grid.innerHTML = "";
    (styleOptions || []).forEach((style) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `judge-style-btn ${selectedStyle === style ? "active" : ""}`;
      button.textContent = style;
      button.dataset.style = style;
      button.addEventListener("click", () => {
        document.querySelectorAll(".judge-style-btn").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
      });
      grid.appendChild(button);
    });
  }

  function renderBattleResult(result) {
    const resultEl = document.getElementById("battleResult");
    if (!resultEl) return;
    const styleScoreA = result.style_scores?.model_a;
    const styleScoreB = result.style_scores?.model_b;
    resultEl.innerHTML = `
      <div class="result-grid compact-results">
        <article class="result-card ${result.default_winner === "model_a" ? "winner" : ""}">
          <h3 class="model-card-title">${result.model_a_short || shortModelLabel(result.model_a.name)}</h3>
          <p class="muted-line">${translateResultLabel(result.model_a.label)}</p>
          <p class="model-card-meta">ביטחון: ${result.model_a.confidence}%</p>
        </article>
        <article class="result-card ${result.default_winner === "model_b" ? "winner" : ""}">
          <h3 class="model-card-title">${result.model_b_short || shortModelLabel(result.model_b.name)}</h3>
          <p class="muted-line">${translateResultLabel(result.model_b.label)}</p>
          <p class="model-card-meta">ביטחון: ${result.model_b.confidence}%</p>
        </article>
      </div>
      <div class="battle-result-meta">
        <p class="muted-line">מקור: ${result.source_name}</p>
        <p class="muted-line">מנצח אוטומטי: ${result.winner_name}</p>
        ${result.judge_style ? `<p class="muted-line">סגנון שנבחר: ${result.judge_style} | ציון א׳: ${styleScoreA}% | ציון ב׳: ${styleScoreB}%</p>` : ""}
      </div>
    `;
    renderStages(result.stages || []);
    renderCompareGraph(result.chart || []);
    renderVoteGraph(result.judge_counts || { model_a: 0, model_b: 0, tie: 0 });
    updateArena(result.model_a_short || result.model_a.name, result.model_b_short || result.model_b.name);
    renderJudgeStyles(result.style_options || [], result.judge_style || "");
  }

  /* Reset the battle result widgets when the selected battle has no finished run.
     Input: model names for the current battle selection.
     Output: clears stale result, graph, and stage content from the page. */
  function clearBattleResult(modelA, modelB) {
    const resultEl = document.getElementById("battleResult");
    if (resultEl) resultEl.textContent = "עדיין אין תוצאה.";
    renderStages([]);
    renderCompareGraph([]);
    renderVoteGraph({ model_a: 0, model_b: 0, tie: 0 });
    renderJudgeStyles([], "");
    updateArena(modelA, modelB);
  }

  async function refreshBattles() {
    const battles = await getJson("/api/get_battles");
    renderBattles(battles || []);
    return battles || [];
  }

  function initBattlesPage() {
    const createButton = document.getElementById("create-battle-btn");
    const runButton = document.getElementById("run-battle-btn");
    const judgePanel = document.getElementById("judgePanel");
    const judgeStyleButton = document.getElementById("judge-style-btn");
    if (!createButton || !runButton || !judgePanel) return;

    const modelA = document.getElementById("modelA");
    const modelB = document.getElementById("modelB");
    const battleId = document.getElementById("battleId");
    const battleAudio = document.getElementById("battleAudio");
    const battleRunStatus = document.getElementById("battle-run-status");
    const resultEl = document.getElementById("battleResult");

    const refreshAll = async () => {
      const battles = await refreshBattles();
      if (battles.length && !battleId.value) {
        battleId.value = String(battles[battles.length - 1].id);
      }
      const selected = battles.find((battle) => String(battle.id) === String(battleId.value));
      if (selected) {
        updateArena(selected.model_a, selected.model_b);
        renderVoteGraph(selected.judge_counts || { model_a: 0, model_b: 0, tie: 0 });
        if (selected.last_result) {
          renderBattleResult(selected.last_result);
          judgePanel.hidden = false;
        } else {
          clearBattleResult(selected.model_a, selected.model_b);
          judgePanel.hidden = true;
        }
      } else {
        clearBattleResult(modelA?.value, modelB?.value);
        judgePanel.hidden = true;
      }
    };

    populateModelSelects().then(refreshAll).catch((error) => { resultEl.textContent = error.message; });
    [modelA, modelB].forEach((select) => select?.addEventListener("change", () => updateArena(modelA.value, modelB.value)));

    battleId.addEventListener("change", async () => {
      const battles = await refreshBattles();
      const selected = battles.find((battle) => String(battle.id) === String(battleId.value));
      if (selected) {
        state.currentBattleId = selected.id;
        updateArena(selected.model_a, selected.model_b);
        renderVoteGraph(selected.judge_counts || { model_a: 0, model_b: 0, tie: 0 });
        if (selected.last_result) {
          renderBattleResult(selected.last_result);
          judgePanel.hidden = false;
        } else {
          clearBattleResult(selected.model_a, selected.model_b);
          judgePanel.hidden = true;
        }
      }
    });

    createButton.addEventListener("click", async () => {
      try {
        const response = await getJson("/api/create_battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_a: modelA.value, model_b: modelB.value }),
        });
        if (response?.battle?.id !== undefined) {
          battleId.value = String(response.battle.id);
          state.currentBattleId = response.battle.id;
        }
        await refreshAll();
        updateArena(modelA.value, modelB.value);
      } catch (error) {
        resultEl.textContent = error.message;
      }
    });

    runButton.addEventListener("click", async () => {
      try {
        runButton.disabled = true;
        setArenaRunning(true);
        if (battleRunStatus) {
          battleRunStatus.textContent = "הקרב התחיל. המערכת משווה עכשיו את שני המודלים על קובץ האודיו.";
        }
        const formData = new FormData();
        formData.append("battle_id", battleId.value);
        state.currentBattleId = battleId.value;
        if (battleAudio?.files?.[0]) formData.append("audio", battleAudio.files[0]);
        const result = await getJson("/api/run_battle", { method: "POST", body: formData });
        renderBattleResult(result);
        judgePanel.hidden = false;
        if (battleRunStatus) {
          battleRunStatus.textContent = "הקרב הסתיים. בדוק את התוצאה ובחר את הסגנון האמיתי של השיר.";
        }
        await refreshAll();
      } catch (error) {
        resultEl.textContent = error.message;
        if (battleRunStatus) {
          battleRunStatus.textContent = `הקרב נכשל: ${error.message}`;
        }
      } finally {
        setArenaRunning(false);
        runButton.disabled = false;
      }
    });

    if (judgeStyleButton) {
      judgeStyleButton.addEventListener("click", async () => {
        try {
          const selectedStyle = document.querySelector(".judge-style-btn.active")?.dataset.style || "";
          const response = await getJson("/api/judge_battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ battle_id: state.currentBattleId || battleId.value, actual_style: selectedStyle }),
          });
          renderVoteGraph(response.battle.judge_counts);
          await refreshAll();
        } catch (error) {
          resultEl.textContent = error.message;
        }
      });
    }
  }

  function initDashboardPage() {
    const dropZone = document.getElementById("audio-drop-zone");
    const fileInput = document.getElementById("audio-drop-input");
    const fileState = document.getElementById("audio-file-state");
    if (!dropZone || !fileInput) return;

    const syncFileState = () => {
      const selectedFile = fileInput.files?.[0];
      if (!fileState) return;
      if (selectedFile) {
        fileState.textContent = `הקובץ שנבחר: ${selectedFile.name}`;
        dropZone.classList.add("has-file");
      } else {
        fileState.textContent = "עדיין לא נבחר קובץ";
        dropZone.classList.remove("has-file");
      }
    };

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragover");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      const droppedFiles = event.dataTransfer?.files;
      if (droppedFiles?.length) {
        fileInput.files = droppedFiles;
        syncFileState();
      }
    });

    fileInput.addEventListener("change", syncFileState);
    syncFileState();
  }
  function initTrainingPage() {
    bindTrainingPanel();
    bindMainTrainingPanel();
  }

  return { initBattlesPage, initDashboardPage, initLanding, initLoader, initTrainingPage };
})();

document.addEventListener("DOMContentLoaded", () => {
  TadarUI.initLoader();
  if (document.body.classList.contains("landing-page")) TadarUI.initLanding();
});
