/* =========================================================
   R❤️İ FOOTBALL — APP ENGINE
   API-Football → Cloudflare Worker
========================================================= */

const WORKER_URL = "https://rianaliz.akifrusa21.workers.dev";

/* =========================================================
   STATE
========================================================= */

const state = {
  matches: [],
  filteredMatches: [],
  selectedMatch: null,
  selectedDate: new Date(),
  currentPage: "all",
  currentFilter: "all",
  currentView: "cards",
  favorites: JSON.parse(localStorage.getItem("ri_favorites") || "[]"),
  predictionCache: {},
  detailCache: {},
  search: "",
  loading: false
};

/* =========================================================
   DOM
========================================================= */

const $ = (selector) => document.querySelector(selector);

const els = {
  sidebar: $("#sidebar"),
  mobileMenu: $("#mobileMenu"),
  mobileOverlay: $("#mobileOverlay"),

  pageTitle: $("#pageTitle"),
  pageDate: $("#pageDate"),
  selectedDate: $("#selectedDate"),

  globalSearch: $("#globalSearch"),
  largeSearchInput: $("#largeSearchInput"),

  refreshBtn: $("#refreshBtn"),
  retryBtn: $("#retryBtn"),

  prevDay: $("#prevDay"),
  nextDay: $("#nextDay"),
  todayBtn: $("#todayBtn"),

  loadingState: $("#loadingState"),
  errorState: $("#errorState"),
  errorMessage: $("#errorMessage"),
  emptyState: $("#emptyState"),

  matchesContainer: $("#matchesContainer"),
  selectionContainer: $("#selectionContainer"),

  analysisPage: $("#analysisPage"),
  statsPage: $("#statsPage"),
  searchPage: $("#searchPage"),
  favoritesPage: $("#favoritesPage"),
  selectionPage: $("#selectionPage"),

  favoritesContainer: $("#favoritesContainer"),
  favoritesEmpty: $("#favoritesEmpty"),

  totalMatches: $("#totalMatches"),
  analyzedMatches: $("#analyzedMatches"),
  strongPicks: $("#strongPicks"),
  leagueCount: $("#leagueCount"),

  dashboardMatches: $("#dashboardMatches"),
  dashboardLeagues: $("#dashboardLeagues"),
  dashboardLive: $("#dashboardLive"),
  dashboardAnalyzed: $("#dashboardAnalyzed"),

  matchesTitle: $("#matchesTitle"),

  drawerBackdrop: $("#drawerBackdrop"),
  analysisDrawer: $("#analysisDrawer"),
  closeDrawer: $("#closeDrawer"),
  drawerTitle: $("#drawerTitle"),
  drawerContent: $("#drawerContent"),

  toast: $("#toast"),
  toastMessage: $("#toastMessage"),

  apiStatusDot: $("#apiStatusDot"),
  apiStatusText: $("#apiStatusText")
};

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", init);

function init() {
  setupEvents();
  updateDateUI();
  updatePageDate();
  updateApiStatus(false, "API bağlanıyor...");
  loadFootballData();
}

/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      navigate(page);
    });
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach(x => x.classList.remove("active"));

      btn.classList.add("active");

      state.currentFilter = btn.dataset.filter;

      applyFilters();
    });
  });

  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      document
        .querySelectorAll(".view-btn")
        .forEach(x => x.classList.remove("active"));

      btn.classList.add("active");

      state.currentView = btn.dataset.view;

      renderMatches();
    });
  });

  if (els.mobileMenu) {
    els.mobileMenu.addEventListener("click", toggleMobileMenu);
  }

  if (els.mobileOverlay) {
    els.mobileOverlay.addEventListener("click", closeMobileMenu);
  }

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener("click", () => {
      loadFootballData();
    });
  }

  if (els.retryBtn) {
    els.retryBtn.addEventListener("click", () => {
      loadFootballData();
    });
  }

  if (els.prevDay) {
    els.prevDay.addEventListener("click", () => {
      changeDate(-1);
    });
  }

  if (els.nextDay) {
    els.nextDay.addEventListener("click", () => {
      changeDate(1);
    });
  }

  if (els.todayBtn) {
    els.todayBtn.addEventListener("click", () => {
      state.selectedDate = new Date();
      updateDateUI();
      loadFootballData();
    });
  }

  if (els.globalSearch) {
    els.globalSearch.addEventListener("input", e => {
      state.search = e.target.value.toLowerCase().trim();

      if (els.largeSearchInput) {
        els.largeSearchInput.value = e.target.value;
      }

      applyFilters();
    });
  }

  if (els.largeSearchInput) {
    els.largeSearchInput.addEventListener("input", e => {
      state.search = e.target.value.toLowerCase().trim();

      if (els.globalSearch) {
        els.globalSearch.value = e.target.value;
      }

      applyFilters();
    });
  }

  if (els.closeDrawer) {
    els.closeDrawer.addEventListener("click", closeDrawer);
  }

  if (els.drawerBackdrop) {
    els.drawerBackdrop.addEventListener("click", closeDrawer);
  }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeDrawer();
      closeMobileMenu();
    }
  });
}

/* =========================================================
   DATE
========================================================= */

function getDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function formatDateTR(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function updateDateUI() {

  if (els.selectedDate) {
    els.selectedDate.textContent =
      formatDateTR(state.selectedDate);
  }

  updatePageDate();
}

function updatePageDate() {

  if (els.pageDate) {
    els.pageDate.textContent =
      formatDateTR(state.selectedDate);
  }
}

function changeDate(amount) {

  const date = new Date(state.selectedDate);

  date.setDate(date.getDate() + amount);

  state.selectedDate = date;

  updateDateUI();

  loadFootballData();
}

/* =========================================================
   API
========================================================= */

async function api(route, params = {}) {

  const url = new URL(`${WORKER_URL}/${route}`);

  Object.entries(params).forEach(([key, value]) => {

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, value);
    }

  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `API ${response.status} — ${response.statusText}`
    );
  }

  return await response.json();
}

/* =========================================================
   LOAD FIXTURES
========================================================= */

async function loadFootballData() {

  if (state.loading) return;

  state.loading = true;

  showLoading(true);
  hideError();

  try {

    const date = getDateString(state.selectedDate);

    const data = await api("fixtures", {
      date
    });

    if (
      !data ||
      !Array.isArray(data.response)
    ) {
      throw new Error("API geçerli maç verisi döndürmedi.");
    }

    state.matches = data.response.map(normalizeFixture);

    state.filteredMatches = [...state.matches];

    updateApiStatus(true, "API bağlantısı aktif");

    updateStatistics();

    applyFilters();

    showLoading(false);

  } catch (error) {

    console.error("R❤️İ API ERROR:", error);

    state.matches = [];
    state.filteredMatches = [];

    updateApiStatus(false, "API bağlantısı başarısız");

    showLoading(false);

    showError(
      error.message ||
      "Maç verileri alınırken bir hata oluştu."
    );

  } finally {

    state.loading = false;

  }
}

/* =========================================================
   NORMALIZE
========================================================= */

function normalizeFixture(item) {

  const fixture = item.fixture || {};
  const league = item.league || {};
  const teams = item.teams || {};
  const goals = item.goals || {};

  const home = teams.home || {};
  const away = teams.away || {};

  const status = fixture.status || {};

  return {
    id: fixture.id,

    timestamp: fixture.timestamp || 0,

    date: fixture.date || "",

    venue: fixture.venue?.name || "",

    status: status.short || "NS",

    statusLong: status.long || "",

    elapsed: status.elapsed || null,

    league: {
      id: league.id,
      name: league.name || "Bilinmeyen Lig",
      country: league.country || "",
      logo: league.logo || "",
      flag: league.flag || ""
    },

    home: {
      id: home.id,
      name: home.name || "Ev Sahibi",
      logo: home.logo || "",
      winner: home.winner
    },

    away: {
      id: away.id,
      name: away.name || "Deplasman",
      logo: away.logo || "",
      winner: away.winner
    },

    goals: {
      home: goals.home,
      away: goals.away
    }
  };
}

/* =========================================================
   FILTER
========================================================= */

function applyFilters() {

  let matches = [...state.matches];

  if (state.search) {

    matches = matches.filter(match => {

      const text = [
        match.home.name,
        match.away.name,
        match.league.name,
        match.league.country
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(state.search);
    });

  }

  if (state.currentFilter === "live") {

    matches = matches.filter(match =>
      isLive(match)
    );

  }

  if (
    state.currentFilter === "safe" ||
    state.currentFilter === "medium" ||
    state.currentFilter === "risky"
  ) {

    matches = matches.filter(match => {

      const risk = calculateRisk(match);

      return risk.key === state.currentFilter;
    });

  }

  state.filteredMatches = matches;

  renderMatches();
}

/* =========================================================
   RENDER
========================================================= */

function renderMatches() {

  if (!els.matchesContainer) return;

  els.matchesContainer.innerHTML = "";

  if (!state.filteredMatches.length) {

    els.emptyState?.classList.remove("hidden");

    return;

  }

  els.emptyState?.classList.add("hidden");

  state.filteredMatches.forEach(match => {

    const card = createMatchCard(match);

    els.matchesContainer.appendChild(card);

  });

}

/* =========================================================
   MATCH CARD
========================================================= */

function createMatchCard(match) {

  const article = document.createElement("article");

  article.className = "match-card";

  const risk = calculateRisk(match);

  const prediction = getBasicPrediction(match);

  const confidence = prediction.confidence;

  const live = isLive(match);

  const favorite = state.favorites.includes(match.id);

  article.innerHTML = `

    <div class="match-top">

      <div class="league-info">

        ${
          match.league.logo
            ? `<img
                class="league-logo"
                src="${escapeAttr(match.league.logo)}"
                alt=""
              >`
            : ""
        }

        <span>
          ${escapeHTML(match.league.name)}
        </span>

      </div>

      <div class="match-time">

        ${
          live
            ? `<span style="color:#ff6677">
                ● ${match.elapsed || ""}'
              </span>`
            : formatMatchTime(match)
        }

      </div>

    </div>

    <div class="teams">

      <div class="team">

        ${
          match.home.logo
            ? `<img
                src="${escapeAttr(match.home.logo)}"
                alt=""
                loading="lazy"
              >`
            : `<div class="team-placeholder">⚽</div>`
        }

        <div class="team-name">
          ${escapeHTML(match.home.name)}
        </div>

      </div>

      <div class="vs">

        ${
          live || isFinished(match)
            ? formatScore(match)
            : "VS"
        }

      </div>

      <div class="team">

        ${
          match.away.logo
            ? `<img
                src="${escapeAttr(match.away.logo)}"
                alt=""
                loading="lazy"
              >`
            : `<div class="team-placeholder">⚽</div>`
        }

        <div class="team-name">
          ${escapeHTML(match.away.name)}
        </div>

      </div>

    </div>

    <div class="prediction-box">

      <div class="prediction-title">
        R❤️İ ANALİZ MOTORU
      </div>

      <div class="prediction-main">
        ${escapeHTML(prediction.text)}
      </div>

      <div class="confidence-bar">

        <div
          class="confidence-fill"
          style="width:${confidence}%"
        ></div>

      </div>

      <div class="confidence-line">

        <span>Güven seviyesi</span>

        <strong>
          ${confidence}%
        </strong>

      </div>

    </div>

    <div class="card-bottom">

      <div class="market-list">

        ${prediction.markets
          .map(m => `
            <span class="market-chip">
              ${escapeHTML(m)}
            </span>
          `)
          .join("")}

      </div>

      <span class="risk-chip ${risk.key}">
        ${risk.label}
      </span>

    </div>

    <div class="card-actions">

      <button
        class="analysis-btn"
        data-action="analysis"
        data-id="${match.id}"
      >
        ◈ Analiz Et
      </button>

      <button
        class="favorite-btn ${favorite ? "active" : ""}"
        data-action="favorite"
        data-id="${match.id}"
      >
        ${favorite ? "★" : "☆"}
      </button>

    </div>

  `;

  article
    .querySelector('[data-action="analysis"]')
    ?.addEventListener("click", () => {

      openAnalysis(match);

    });

  article
    .querySelector('[data-action="favorite"]')
    ?.addEventListener("click", () => {

      toggleFavorite(match.id);

      renderMatches();

    });

  return article;
}

/* =========================================================
   BASIC PREDICTION
========================================================= */

function getBasicPrediction(match) {

  const home = match.home.winner;
  const away = match.away.winner;

  let text = "Maç Analizi";
  let confidence = 55;

  if (home === true) {

    text = `${match.home.name} Avantajlı`;

    confidence = 68;

  } else if (away === true) {

    text = `${match.away.name} Avantajlı`;

    confidence = 66;

  } else {

    text = "Dengeli Maç";

    confidence = 55;

  }

  const markets = [];

  markets.push("Maç Sonucu");

  if (confidence >= 65) {
    markets.push("KG");
  }

  if (confidence >= 70) {
    markets.push("2.5 Üst");
  }

  return {
    text,
    confidence,
    markets
  };
}

/* =========================================================
   RISK
========================================================= */

function calculateRisk(match) {

  const prediction = getBasicPrediction(match);

  if (prediction.confidence >= 70) {

    return {
      key: "safe",
      label: "DÜŞÜK RİSK"
    };

  }

  if (prediction.confidence >= 60) {

    return {
      key: "medium",
      label: "ORTA RİSK"
    };

  }

  return {
    key: "risky",
    label: "RİSKLİ"
  };
}

/* =========================================================
   ANALYSIS
========================================================= */

async function openAnalysis(match) {

  state.selectedMatch = match;

  els.drawerTitle.textContent =
    `${match.home.name} - ${match.away.name}`;

  els.analysisDrawer.classList.add("open");
  els.drawerBackdrop.classList.add("open");

  els.drawerContent.innerHTML = `
    <div class="drawer-loading">
      <div class="loader"></div>
      <p>Maç verileri analiz ediliyor...</p>
    </div>
  `;

  try {

    const prediction = await getPrediction(match.id);

    renderAnalysis(match, prediction);

  } catch (error) {

    console.error(error);

    renderAnalysis(match, null);

  }
}

/* =========================================================
   PREDICTION API
========================================================= */

async function getPrediction(fixtureId) {

  if (state.predictionCache[fixtureId]) {
    return state.predictionCache[fixtureId];
  }

  const data = await api("predictions", {
    fixture: fixtureId
  });

  const prediction =
    data?.response?.[0] || null;

  state.predictionCache[fixtureId] = prediction;

  return prediction;
}

/* =========================================================
   RENDER ANALYSIS
========================================================= */

function renderAnalysis(match, prediction) {

  const basic = getBasicPrediction(match);

  let winnerText = basic.text;

  let btts = "Veri bekleniyor";
  let over25 = "Veri bekleniyor";

  if (prediction) {

    const p = prediction.predictions || {};

    winnerText =
      p.winner?.name ||
      p.advice ||
      winnerText;

    if (typeof p.btts === "string") {
      btts = p.btts;
    } else if (p.btts?.yes) {
      btts = "Evet";
    }

    if (p.under_over) {
      over25 = p.under_over;
    }

  }

  els.drawerContent.innerHTML = `

    <div class="detail-hero">

      <div class="detail-teams">

        <div class="detail-team">

          ${
            match.home.logo
              ? `<img
                  src="${escapeAttr(match.home.logo)}"
                  alt=""
                >`
              : ""
          }

          <strong>
            ${escapeHTML(match.home.name)}
          </strong>

        </div>

        <div class="detail-score">

          <span>
            ${formatMatchTime(match)}
          </span>

          <strong>
            ${
              isFinished(match) || isLive(match)
                ? formatScore(match)
                : "VS"
            }
          </strong>

        </div>

        <div class="detail-team">

          ${
            match.away.logo
              ? `<img
                  src="${escapeAttr(match.away.logo)}"
                  alt=""
                >`
              : ""
          }

          <strong>
            ${escapeHTML(match.away.name)}
          </strong>

        </div>

      </div>

    </div>

    <div class="analysis-tabs">

      <button class="analysis-tab active">
        Genel
      </button>

      <button class="analysis-tab">
        Form
      </button>

      <button class="analysis-tab">
        H2H
      </button>

      <button class="analysis-tab">
        Gol
      </button>

      <button class="analysis-tab">
        KG
      </button>

      <button class="analysis-tab">
        İY
      </button>

      <button class="analysis-tab">
        2Y
      </button>

      <button class="analysis-tab">
        Kadro
      </button>

      <button class="analysis-tab">
        Sakatlık
      </button>

      <button class="analysis-tab">
        Oran
      </button>

    </div>

    <div class="detail-section">

      <h3>
        🎯 En Güçlü Seçim
      </h3>

      <div class="ai-box">

        <div class="ai-box-title">
          R❤️İ ANALİZ
        </div>

        <p>
          <strong>
            ${escapeHTML(winnerText)}
          </strong>
          <br><br>

          Bu bölümde takım formu, H2H, gol ortalamaları,
          kadro durumu ve API-Football tahmin verileri
          birlikte değerlendirilecektir.
        </p>

      </div>

    </div>

    <div class="detail-section">

      <h3>
        📊 Tahmin Özeti
      </h3>

      <div class="detail-grid">

        <div class="detail-stat">
          <span>Maç Sonucu</span>
          <strong>
            ${escapeHTML(winnerText)}
          </strong>
        </div>

        <div class="detail-stat">
          <span>KG</span>
          <strong>
            ${escapeHTML(btts)}
          </strong>
        </div>

        <div class="detail-stat">
          <span>2.5 Gol</span>
          <strong>
            ${escapeHTML(over25)}
          </strong>
        </div>

        <div class="detail-stat">
          <span>Güven</span>
          <strong>
            ${basic.confidence}%
          </strong>
        </div>

      </div>

    </div>

    <div class="detail-section">

      <h3>
        ⚽ Gol / KG
      </h3>

      <div class="detail-grid">

        <div class="detail-stat">
          <span>Ev Sahibi</span>
          <strong>
            ${escapeHTML(match.home.name)}
          </strong>
        </div>

        <div class="detail-stat">
          <span>Deplasman</span>
          <strong>
            ${escapeHTML(match.away.name)}
          </strong>
        </div>

        <div class="detail-stat">
          <span>KG</span>
          <strong>${escapeHTML(btts)}</strong>
        </div>

        <div class="detail-stat">
          <span>2.5 Üst/Alt</span>
          <strong>${escapeHTML(over25)}</strong>
        </div>

      </div>

    </div>

    <div class="detail-section">

      <h3>
        🧠 Yapay Zekâ
      </h3>

      <div class="ai-box">

        <div class="ai-box-title">
          ✦ R❤️İ AI ANALİZ
        </div>

        <p>
          Yapay zekâ analiz modülü hazırlanıyor.
          API verileri üzerinden form, H2H, gol,
          KG, ilk yarı, ikinci yarı, kadro ve
          sakatlık verileri birleştirilerek
          maç bazlı yorum üretilecek.
        </p>

      </div>

    </div>

    <div class="detail-section">

      <h3>
        ⚠️ Risk Uyarısı
      </h3>

      <p style="
        color:#8da99d;
        font-size:11px;
        line-height:1.7;
      ">
        Hiçbir futbol tahmini kesin sonuç değildir.
        Güven yüzdesi yalnızca mevcut istatistiklerin
        analizinden oluşturulan gösterge niteliğindedir.
      </p>

    </div>

  `;

  els.drawerContent
    .querySelectorAll(".analysis-tab")
    .forEach(tab => {

      tab.addEventListener("click", () => {

        els.drawerContent
          .querySelectorAll(".analysis-tab")
          .forEach(x => x.classList.remove("active"));

        tab.classList.add("active");

        showToast(
          `${tab.textContent.trim()} analizi hazırlanıyor`
        );

      });

    });
}

/* =========================================================
   NAVIGATION
========================================================= */

function navigate(page) {

  state.currentPage = page;

  closeMobileMenu();

  document
    .querySelectorAll(".nav-item")
    .forEach(btn => {

      btn.classList.toggle(
        "active",
        btn.dataset.page === page
      );

    });

  hideAllPages();

  if (page === "all") {

    showMainMatches();

    setPageTitle("Tüm Maçlar");

  }

  else if (page === "search") {

    els.searchPage?.classList.remove("hidden");

    setPageTitle("Maç Ara");

  }

  else if (page === "analysis") {

    els.analysisPage?.classList.remove("hidden");

    setPageTitle("Maç Analizi");

  }

  else if (page === "stats") {

    els.statsPage?.classList.remove("hidden");

    setPageTitle("İstatistikler");

  }

  else if (page === "favorites") {

    renderFavorites();

    els.favoritesPage?.classList.remove("hidden");

    setPageTitle("Favoriler");

  }

  else {

    renderSelectionPage(page);

    els.selectionPage?.classList.remove("hidden");

  }
}

function hideAllPages() {

  els.matchesContainer?.parentElement?.classList.remove("hidden");

  els.analysisPage?.classList.add("hidden");
  els.statsPage?.classList.add("hidden");
  els.searchPage?.classList.add("hidden");
  els.favoritesPage?.classList.add("hidden");
  els.selectionPage?.classList.add("hidden");

}

function showMainMatches() {

  if (els.matchesContainer) {
    els.matchesContainer.parentElement.classList.remove("hidden");
  }

  applyFilters();
}

function setPageTitle(title) {

  if (els.pageTitle) {
    els.pageTitle.textContent = title;
  }
}

/* =========================================================
   SELECTION PAGES
========================================================= */

function renderSelectionPage(page) {

  let title = "Seçimler";
  let description = "Analiz motorunun filtrelediği maçlar.";

  let matches = [...state.matches];

  if (page === "safe") {

    title = "Güvenilir Seçimler";

    description =
      "Daha yüksek güven seviyesine sahip analizler.";

    matches = matches.filter(
      m => calculateRisk(m).key === "safe"
    );

  }

  else if (page === "medium") {

    title = "Orta Riskli";

    description =
      "Dengeli risk ve oran profiline sahip maçlar.";

    matches = matches.filter(
      m => calculateRisk(m).key === "medium"
    );

  }

  else if (page === "risky") {

    title = "Riskli Seçimler";

    description =
      "Daha yüksek risk taşıyan analizler.";

    matches = matches.filter(
      m => calculateRisk(m).key === "risky"
    );

  }

  else if (page === "high") {

    title = "Yüksek Oran Fırsatları";

    description =
      "Daha yüksek oran potansiyeli taşıyan maçlar.";

    matches = matches.filter(
      m => getBasicPrediction(m).confidence < 65
    );

  }

  else if (page === "halves") {

    title = "İY / 2Y KG";

    description =
      "İlk yarı ve ikinci yarı gol pazarları.";

    matches = matches.slice(0, 20);

  }

  const titleEl = $("#selectionTitle");
  const descEl = $("#selectionDescription");

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = description;

  if (!els.selectionContainer) return;

  els.selectionContainer.innerHTML = "";

  if (!matches.length) {

    els.selectionContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Uygun maç bulunamadı</h3>
        <p>Bu kategori için mevcut veri bulunmuyor.</p>
      </div>
    `;

    return;
  }

  matches.forEach(match => {

    els.selectionContainer.appendChild(
      createMatchCard(match)
    );

  });
}

/* =========================================================
   FAVORITES
========================================================= */

function toggleFavorite(id) {

  const index = state.favorites.indexOf(id);

  if (index >= 0) {

    state.favorites.splice(index, 1);

    showToast("Favorilerden çıkarıldı");

  } else {

    state.favorites.push(id);

    showToast("Favorilere eklendi");

  }

  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(state.favorites)
  );
}

function renderFavorites() {

  if (!els.favoritesContainer) return;

  els.favoritesContainer.innerHTML = "";

  const matches = state.matches.filter(
    match => state.favorites.includes(match.id)
  );

  if (!matches.length) {

    els.favoritesEmpty?.classList.remove("hidden");

    return;

  }

  els.favoritesEmpty?.classList.add("hidden");

  matches.forEach(match => {

    els.favoritesContainer.appendChild(
      createMatchCard(match)
    );

  });
}

/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics() {

  const matches = state.matches;

  const leagues = new Set(
    matches.map(m => m.league.id)
  );

  const live = matches.filter(
    isLive
  ).length;

  const analyzed = matches.filter(
    m => getBasicPrediction(m).confidence >= 60
  ).length;

  const strong = matches.filter(
    m => getBasicPrediction(m).confidence >= 70
  ).length;

  if (els.totalMatches)
    els.totalMatches.textContent = matches.length;

  if (els.analyzedMatches)
    els.analyzedMatches.textContent = analyzed;

  if (els.strongPicks)
    els.strongPicks.textContent = strong;

  if (els.leagueCount)
    els.leagueCount.textContent = leagues.size;

  if (els.dashboardMatches)
    els.dashboardMatches.textContent = matches.length;

  if (els.dashboardLeagues)
    els.dashboardLeagues.textContent = leagues.size;

  if (els.dashboardLive)
    els.dashboardLive.textContent = live;

  if (els.dashboardAnalyzed)
    els.dashboardAnalyzed.textContent = analyzed;
}

/* =========================================================
   STATUS
========================================================= */

function updateApiStatus(online, text) {

  if (!els.apiStatusDot) return;

  els.apiStatusText.textContent = text;

  if (online) {

    els.apiStatusDot.style.background = "#35e88b";
    els.apiStatusDot.style.color = "#35e88b";

  } else {

    els.apiStatusDot.style.background = "#ff6677";
    els.apiStatusDot.style.color = "#ff6677";

  }
}

/* =========================================================
   LOADING / ERROR
========================================================= */

function showLoading(show) {

  if (!els.loadingState) return;

  els.loadingState.classList.toggle(
    "hidden",
    !show
  );

  if (show) {

    els.matchesContainer.innerHTML = "";

    els.emptyState?.classList.add("hidden");

  }
}

function showError(message) {

  els.errorState?.classList.remove("hidden");

  if (els.errorMessage) {
    els.errorMessage.textContent = message;
  }
}

function hideError() {

  els.errorState?.classList.add("hidden");

}

/* =========================================================
   DRAWER
========================================================= */

function closeDrawer() {

  els.analysisDrawer?.classList.remove("open");
  els.drawerBackdrop?.classList.remove("open");

}

/* =========================================================
   MOBILE
========================================================= */

function toggleMobileMenu() {

  els.sidebar?.classList.toggle("open");
  els.mobileOverlay?.classList.toggle("open");

}

function closeMobileMenu() {

  els.sidebar?.classList.remove("open");
  els.mobileOverlay?.classList.remove("open");

}

/* =========================================================
   HELPERS
========================================================= */

function isLive(match) {

  return [
    "1H",
    "2H",
    "ET",
    "P",
    "LIVE",
    "BT"
  ].includes(match.status);

}

function isFinished(match) {

  return [
    "FT",
    "AET",
    "PEN"
  ].includes(match.status);

}

function formatScore(match) {

  const home =
    match.goals.home ??
    0;

  const away =
    match.goals.away ??
    0;

  return `${home} - ${away}`;
}

function formatMatchTime(match) {

  if (!match.date) return "--:--";

  const date = new Date(match.date);

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

function escapeAttr(value) {

  return escapeHTML(value)
    .replaceAll("`", "&#096;");

}

/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  if (!els.toast) return;

  els.toastMessage.textContent = message;

  els.toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    els.toast.classList.remove("show");

  }, 2500);

}

/* =========================================================
   END
========================================================= */

console.log(
  "R❤️İ Football Engine hazır."
);
