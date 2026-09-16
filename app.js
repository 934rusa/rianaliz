/* =========================================================
   R❤️İ FOOTBALL ANALİZ MERKEZİ
   app.js
   ========================================================= */

const RI_CONFIG = {
  API_BASE: "",
  FIXTURES_API_URL: "/api/fixtures",
  MATCH_API_URL: "/api/match",
  AI_API_URL: "/api/ai",

  REQUEST_TIMEOUT: 20000,

  // Eski hatalı AI sonuçlarını tamamen geçersiz yapar
  AI_CACHE_VERSION: "4",

  FIXTURE_CACHE_KEY: "ri_fixture_cache_v3",
  AI_CACHE_KEY: "ri_ai_analysis_cache_v4",
  FAVORITES_KEY: "ri_favorites_v1"
};


/* =========================================================
   STATE
   ========================================================= */

const state = {
  fixtures: [],
  filteredFixtures: [],
  selectedFixture: null,
  selectedDetails: null,
  selectedAI: null,

  currentFilter: "all",
  searchQuery: "",

  loading: false,
  analysisLoading: false,

  favorites: loadFavorites(),
  fixtureCache: loadFixtureCache(),
  aiCache: loadAICache()
};


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setupUI();
  loadFixtures();
});


/* =========================================================
   UI
   ========================================================= */

function setupUI() {

  const hamburger = $("#hamburgerBtn");
  const closeMenu = $("#closeMenuBtn");
  const overlay = $("#sidebarOverlay");
  const sidebar = $("#sidebar");

  const drawerOverlay = $("#drawerOverlay");
  const drawerClose = $("#drawerClose");

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      sidebar?.classList.add("open");
      overlay?.classList.add("show");
      document.body.classList.add("menu-open");
    });
  }

  if (closeMenu) {
    closeMenu.addEventListener("click", closeSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  if (drawerOverlay) {
    drawerOverlay.addEventListener("click", closeAnalysisDrawer);
  }

  if (drawerClose) {
    drawerClose.addEventListener("click", closeAnalysisDrawer);
  }

  document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {
      closeSidebar();
      closeAnalysisDrawer();
    }

  });


  /* SEARCH */

  const searchInput = $("#searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {

      state.searchQuery = e.target.value.trim().toLowerCase();

      if (state.searchQuery) {
        state.currentFilter = "search";
      }

      renderFixtures();

    });
  }


  /* MENU */

  $$("#sidebar [data-filter]").forEach((item) => {

    item.addEventListener("click", () => {

      const filter = item.dataset.filter;

      state.currentFilter = filter;

      $$("#sidebar [data-filter]").forEach((x) => {
        x.classList.remove("active");
      });

      item.classList.add("active");

      if (filter !== "search") {
        state.searchQuery = "";

        if (searchInput) {
          searchInput.value = "";
        }
      }

      closeSidebar();

      renderFixtures();

    });

  });


  /* REFRESH */

  const refreshBtn = $("#refreshBtn");

  if (refreshBtn) {

    refreshBtn.addEventListener("click", async () => {

      refreshBtn.classList.add("loading");

      await loadFixtures(true);

      refreshBtn.classList.remove("loading");

    });

  }


  /* CLEAR SEARCH */

  const clearSearch = $("#clearSearchBtn");

  if (clearSearch) {

    clearSearch.addEventListener("click", () => {

      state.searchQuery = "";
      state.currentFilter = "all";

      if (searchInput) {
        searchInput.value = "";
      }

      renderFixtures();

    });

  }

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function closeSidebar() {

  $("#sidebar")?.classList.remove("open");
  $("#sidebarOverlay")?.classList.remove("show");

  document.body.classList.remove("menu-open");

}


/* =========================================================
   FIXTURES
   ========================================================= */

async function loadFixtures(force = false) {

  if (state.loading) return;

  state.loading = true;

  renderLoading();

  const today = getLocalDate();

  try {

    let fixtures = null;

    if (!force) {
      fixtures = getCachedFixtures(today);
    }

    if (!fixtures) {

      const response = await fetchWithTimeout(
        `${RI_CONFIG.FIXTURES_API_URL}?date=${today}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        },
        RI_CONFIG.REQUEST_TIMEOUT
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      fixtures = normalizeFixtures(data);

      saveFixtureCache(today, fixtures);
    }

    state.fixtures = fixtures;

    renderLeagueMenu();
    renderFixtures();

  } catch (error) {

    console.error("Fixtures error:", error);

    renderError(
      "Maçlar yüklenemedi.",
      "API-Football bağlantısını veya günlük API limitini kontrol et."
    );

  } finally {

    state.loading = false;

  }

}


/* =========================================================
   NORMALIZE FIXTURES
   ========================================================= */

function normalizeFixtures(data) {

  let list = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.response)) {
    list = data.response;
  } else if (Array.isArray(data?.fixtures)) {
    list = data.fixtures;
  } else if (Array.isArray(data?.data)) {
    list = data.data;
  }

  return list
    .map(item => {

      const fixture = item.fixture || item;

      const teams = item.teams || {};

      return {
        ...item,

        fixture: {
          ...fixture
        },

        teams: {
          home: {
            ...(teams.home || {})
          },

          away: {
            ...(teams.away || {})
          }
        },

        league: item.league || {},

        goals: item.goals || {
          home: null,
          away: null
        },

        score: item.score || {}
      };

    })
    .filter(item => {
      return item.fixture?.id;
    });

}


/* =========================================================
   LEAGUE MENU
   ========================================================= */

function renderLeagueMenu() {

  const menu = $("#leagueMenu");

  if (!menu) return;

  const leagues = new Map();

  state.fixtures.forEach(match => {

    const league = match.league || {};

    const id = league.id || league.name;

    if (!id) return;

    if (!leagues.has(id)) {

      leagues.set(id, {
        id,
        name: league.name || "Diğer",
        logo: league.logo || ""
      });

    }

  });

  menu.innerHTML = "";

  [...leagues.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .forEach(league => {

      const button = document.createElement("button");

      button.className = "league-menu-item";

      button.innerHTML = `
        ${league.logo
          ? `<img src="${escapeAttr(league.logo)}" alt="" loading="lazy">`
          : `<span class="league-logo-placeholder">⚽</span>`
        }
        <span>${escapeHTML(league.name)}</span>
      `;

      button.addEventListener("click", () => {

        state.currentFilter = `league:${league.id}`;

        closeSidebar();

        renderFixtures();

      });

      menu.appendChild(button);

    });

}


/* =========================================================
   FILTER
   ========================================================= */

function getFilteredFixtures() {

  let matches = [...state.fixtures];

  const filter = state.currentFilter;

  if (filter === "search") {

    if (!state.searchQuery) {
      return matches;
    }

    matches = matches.filter(match => matchSearchMatch(match));

  }

  else if (filter === "reliable") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "reliable"
    );

  }

  else if (filter === "medium") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "medium"
    );

  }

  else if (filter === "high") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "high"
    );

  }

  else if (filter === "high-odds") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "high-odds"
    );

  }

  else if (filter === "iy2ykg") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "iy2ykg"
    );

  }

  else if (filter === "first-half") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "first-half"
    );

  }

  else if (filter === "second-half") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "second-half"
    );

  }

  else if (filter === "score") {

    matches = matches.filter(match =>
      matchPredictionCategory(match) === "score"
    );

  }

  else if (filter === "favorites") {

    matches = matches.filter(match =>
      state.favorites.has(String(match.fixture.id))
    );

  }

  else if (filter.startsWith("league:")) {

    const leagueId = filter.substring(7);

    matches = matches.filter(match => {

      const id = String(
        match.league?.id || match.league?.name || ""
      );

      return id === String(leagueId);

    });

  }

  else if (state.searchQuery) {

    matches = matches.filter(match =>
      matchSearchMatch(match)
    );

  }

  return matches;

}


function matchSearchMatch(match) {

  const q = state.searchQuery;

  const home = match.teams?.home?.name?.toLowerCase() || "";
  const away = match.teams?.away?.name?.toLowerCase() || "";
  const league = match.league?.name?.toLowerCase() || "";

  return (
    home.includes(q) ||
    away.includes(q) ||
    league.includes(q)
  );

}


/* =========================================================
   RENDER MATCHES
   ========================================================= */

function renderFixtures() {

  const container = $("#matches");

  if (!container) return;

  const matches = getFilteredFixtures();

  state.filteredFixtures = matches;

  updateFavoriteCount();

  if (!matches.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Maç bulunamadı</h3>
        <p>Bu kategoride şu anda gösterilecek maç yok.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = "";

  const groups = groupByLeague(matches);

  groups.forEach(group => {

    const section = document.createElement("section");

    section.className = "league-section";

    section.innerHTML = `
      <div class="league-header">
        <div class="league-title">
          ${
            group.logo
              ? `<img src="${escapeAttr(group.logo)}" alt="" loading="lazy">`
              : `<span class="league-logo-placeholder">⚽</span>`
          }

          <div>
            <strong>${escapeHTML(group.name)}</strong>
            <small>${group.matches.length} maç</small>
          </div>
        </div>
      </div>

      <div class="league-matches"></div>
    `;

    const matchesContainer =
      section.querySelector(".league-matches");

    group.matches.forEach(match => {

      matchesContainer.appendChild(
        createMatchCard(match)
      );

    });

    container.appendChild(section);

  });

}


/* =========================================================
   GROUP BY LEAGUE
   ========================================================= */

function groupByLeague(matches) {

  const map = new Map();

  matches.forEach(match => {

    const league = match.league || {};

    const id =
      league.id ||
      league.name ||
      "other";

    if (!map.has(id)) {

      map.set(id, {
        id,
        name: league.name || "Diğer Ligler",
        logo: league.logo || "",
        matches: []
      });

    }

    map.get(id).matches.push(match);

  });

  return [...map.values()];

}


/* =========================================================
   MATCH CARD
   ========================================================= */

function createMatchCard(match) {

  const card = document.createElement("article");

  card.className = "match-card";

  const fixtureId = String(match.fixture.id);

  const home = match.teams?.home || {};
  const away = match.teams?.away || {};

  const status = getStatus(match);

  const isLive = isLiveStatus(status);
  const isFinished = isFinishedStatus(status);

  const homeScore =
    match.goals?.home ??
    match.score?.fulltime?.home ??
    "";

  const awayScore =
    match.goals?.away ??
    match.score?.fulltime?.away ??
    "";

  const favorite =
    state.favorites.has(fixtureId);

  card.innerHTML = `

    <div class="match-card-top">

      <span class="match-time">
        ${formatMatchTime(match)}
      </span>

      <button
        class="favorite-btn ${favorite ? "active" : ""}"
        data-favorite="${fixtureId}"
        aria-label="Favori"
      >
        ${favorite ? "★" : "☆"}
      </button>

    </div>


    <div class="teams-row">

      <div class="team team-home">

        <img
          class="team-logo"
          src="${escapeAttr(getTeamLogo(home))}"
          alt="${escapeAttr(home.name || "")}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <span>${escapeHTML(home.name || "Ev Sahibi")}</span>

      </div>


      <div class="match-center">

        ${
          isFinished || isLive
            ? `
              <strong class="match-score">
                ${homeScore} - ${awayScore}
              </strong>
            `
            : `
              <strong class="match-vs">VS</strong>
            `
        }

        <small class="${isLive ? "live-status" : ""}">
          ${formatStatus(match)}
        </small>

      </div>


      <div class="team team-away">

        <img
          class="team-logo"
          src="${escapeAttr(getTeamLogo(away))}"
          alt="${escapeAttr(away.name || "")}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <span>${escapeHTML(away.name || "Deplasman")}</span>

      </div>

    </div>


    <div class="match-card-bottom">

      <span class="analysis-label">
        ${isFinished ? "Maç Sonucu" : "Analiz Et"}
      </span>

      <span class="analysis-arrow">›</span>

    </div>

  `;


  /* FAVORITE */

  const favoriteBtn =
    card.querySelector("[data-favorite]");

  favoriteBtn?.addEventListener("click", (e) => {

    e.stopPropagation();

    toggleFavorite(fixtureId);

    favoriteBtn.classList.toggle(
      "active",
      state.favorites.has(fixtureId)
    );

    favoriteBtn.textContent =
      state.favorites.has(fixtureId)
        ? "★"
        : "☆";

  });


  /* OPEN ANALYSIS */

  card.addEventListener("click", () => {

    openMatch(match);

  });


  return card;

}


/* =========================================================
   LOGO
   ========================================================= */

const PLACEHOLDER_LOGO =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="96"
         height="96"
         viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="46"
              fill="#151923"
              stroke="#343b4d"
              stroke-width="2"/>
      <text x="48" y="57"
            text-anchor="middle"
            font-size="38">⚽</text>
    </svg>
  `);


function getTeamLogo(team) {

  if (!team) {
    return PLACEHOLDER_LOGO;
  }

  return (
    team.logo ||
    team.image ||
    team.team?.logo ||
    PLACEHOLDER_LOGO
  );

}


/* =========================================================
   OPEN MATCH
   ========================================================= */

async function openMatch(fixture) {

  state.selectedFixture = fixture;
  state.selectedDetails = null;
  state.selectedAI = null;

  openAnalysisDrawer();

  renderAnalysisLoading(fixture);

  try {

    const id = fixture.fixture.id;

    const response = await fetchWithTimeout(
      `${RI_CONFIG.MATCH_API_URL}?id=${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      },
      RI_CONFIG.REQUEST_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const details = await response.json();

    state.selectedDetails = details;

    const status = getStatus(fixture);

    /* MAÇ BİTMİŞSE RETROAKTİF AI TAHMİNİ YOK */

    if (isFinishedStatus(status)) {

      renderFinishedAnalysis(
        fixture,
        details
      );

      return;
    }


    /* AI İÇİN TEMİZ VERİ */

    const aiPayload =
      buildAIPayload(
        fixture,
        details
      );


    renderAnalysisShell(
      fixture,
      aiPayload
    );


    await runAIAnalysis(
      fixture,
      aiPayload
    );


  } catch (error) {

    console.error("Match analysis error:", error);

    renderAnalysisError(
      "Maç analizi alınamadı.",
      error.message
    );

  }

}


/* =========================================================
   AI PAYLOAD
   ========================================================= */

function buildAIPayload(fixture, details) {

  const status = getStatus(fixture);

  const mode =
    isNotStartedStatus(status)
      ? "prematch"
      : isLiveStatus(status)
        ? "live"
        : "unknown";


  /*
   * DETAILS KOPYASI
   * Mevcut maçın score/goals alanlarını temizliyoruz.
   * Tarihsel H2H / son maçlardaki skorlar korunur.
   */

  const safeDetails =
    deepClone(details || {});


  delete safeDetails.goals;
  delete safeDetails.score;


  if (safeDetails.fixture) {

    delete safeDetails.fixture.goals;
    delete safeDetails.fixture.score;

  }


  const currentFixture =
    fixture.fixture || {};


  const cleanFixture = {

    id: currentFixture.id,

    date:
      currentFixture.date ||
      fixture.date ||
      null,

    timezone:
      currentFixture.timezone ||
      null,

    referee:
      currentFixture.referee ||
      null,

    venue:
      currentFixture.venue ||
      null,

    status: {
      short:
        currentFixture.status?.short ||
        status,

      long:
        currentFixture.status?.long ||
        "",

      elapsed:
        currentFixture.status?.elapsed ??
        null
    }

  };


  const liveState =
    mode === "live"
      ? {
          elapsed:
            currentFixture.status?.elapsed ??
            null,

          score: {
            home:
              fixture.goals?.home ??
              null,

            away:
              fixture.goals?.away ??
              null
          }
        }
      : null;


  return {

    mode,

    fixture: {

      fixture: cleanFixture,

      league: fixture.league || null,

      teams: {

        home: {
          id: fixture.teams?.home?.id || null,
          name: fixture.teams?.home?.name || null,
          logo: fixture.teams?.home?.logo || null
        },

        away: {
          id: fixture.teams?.away?.id || null,
          name: fixture.teams?.away?.name || null,
          logo: fixture.teams?.away?.logo || null
        }

      }

    },

    details: safeDetails,

    live_state: liveState

  };

}


/* =========================================================
   AI ANALYSIS
   ========================================================= */

async function runAIAnalysis(
  fixture,
  aiPayload
) {

  const fixtureId =
    String(fixture.fixture.id);


  /* CACHE */

  const cached =
    state.aiCache[fixtureId];


  if (
    cached &&
    cached.version === RI_CONFIG.AI_CACHE_VERSION &&
    cached.mode === aiPayload.mode &&
    cached.analysis
  ) {

    state.selectedAI =
      cached.analysis;

    renderAIResult(
      fixture,
      cached.analysis
    );

    return;

  }


  state.analysisLoading = true;

  renderAILoading();


  try {

    const response =
      await fetchWithTimeout(
        RI_CONFIG.AI_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },

          body: JSON.stringify({

            fixture: aiPayload,

            mode: aiPayload.mode

          })

        },
        RI_CONFIG.REQUEST_TIMEOUT
      );


    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        text || `HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    if (!data.success) {

      throw new Error(
        data.error ||
        "AI analizi alınamadı."
      );

    }


    const analysis =
      data.analysisData ||
      parseAIAnalysis(data.analysis) ||
      data.analysis;


    state.selectedAI =
      analysis;


    /* CACHE */

    state.aiCache[fixtureId] = {

      version:
        RI_CONFIG.AI_CACHE_VERSION,

      mode:
        aiPayload.mode,

      timestamp:
        Date.now(),

      analysis

    };


    saveAICache();


    renderAIResult(
      fixture,
      analysis
    );


  } catch (error) {

    console.error("AI error:", error);

    renderAIError(
      error.message
    );

  } finally {

    state.analysisLoading = false;

  }

}


/* =========================================================
   ANALYSIS DRAWER
   ========================================================= */

function openAnalysisDrawer() {

  $("#analysisDrawer")?.classList.add("open");
  $("#drawerOverlay")?.classList.add("show");

  document.body.classList.add("drawer-open");

}


function closeAnalysisDrawer() {

  $("#analysisDrawer")?.classList.remove("open");
  $("#drawerOverlay")?.classList.remove("show");

  document.body.classList.remove("drawer-open");

}


/* =========================================================
   ANALYSIS HEADER
   ========================================================= */

function renderAnalysisLoading(fixture) {

  const content = $("#analysisContent");

  if (!content) return;

  const home =
    fixture.teams?.home || {};

  const away =
    fixture.teams?.away || {};


  content.innerHTML = `

    <div class="analysis-header">

      <div class="analysis-team">

        <img
          class="analysis-team-logo"
          src="${escapeAttr(getTeamLogo(home))}"
          alt=""
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <strong>
          ${escapeHTML(home.name || "Ev Sahibi")}
        </strong>

      </div>


      <div class="analysis-vs">
        VS
      </div>


      <div class="analysis-team">

        <img
          class="analysis-team-logo"
          src="${escapeAttr(getTeamLogo(away))}"
          alt=""
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <strong>
          ${escapeHTML(away.name || "Deplasman")}
        </strong>

      </div>

    </div>


    <div class="analysis-loading">
      <div class="spinner"></div>
      <span>Maç verileri analiz ediliyor...</span>
    </div>

  `;

}


/* =========================================================
   ANALYSIS SHELL
   ========================================================= */

function renderAnalysisShell(
  fixture,
  aiPayload
) {

  const content =
    $("#analysisContent");

  if (!content) return;


  const home =
    fixture.teams?.home || {};

  const away =
    fixture.teams?.away || {};


  content.innerHTML = `

    <div class="analysis-header">

      <div class="analysis-team">

        <img
          class="analysis-team-logo"
          src="${escapeAttr(getTeamLogo(home))}"
          alt=""
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <strong>
          ${escapeHTML(home.name || "")}
        </strong>

      </div>


      <div class="analysis-vs">
        VS
      </div>


      <div class="analysis-team">

        <img
          class="analysis-team-logo"
          src="${escapeAttr(getTeamLogo(away))}"
          alt=""
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <strong>
          ${escapeHTML(away.name || "")}
        </strong>

      </div>

    </div>


    <div id="aiResultArea">

      <div class="ai-loading-card">
        <div class="spinner"></div>
        <span>AI tahmini hazırlanıyor...</span>
      </div>

    </div>

  `;

}


/* =========================================================
   AI RESULT
   ========================================================= */

function renderAIResult(
  fixture,
  analysis
) {

  const area =
    $("#aiResultArea");

  if (!area) return;


  const data =
    typeof analysis === "string"
      ? parseAIAnalysis(analysis)
      : analysis;


  if (!data || typeof data !== "object") {

    area.innerHTML = `
      <div class="ai-result-card">
        <div class="ai-title">AI Tahmini</div>
        <div class="ai-text">
          ${escapeHTML(String(analysis || ""))}
        </div>
      </div>
    `;

    return;

  }


  const score =
    data.tahmini_skor?.tahmin ||
    data.tahminiSkor ||
    data.score ||
    "—";


  const matchPrediction =
    data.mac_sonucu?.tahmin ||
    data.macSonucu ||
    data.tahmin ||
    "—";


  const confidence =
    normalizeConfidence(
      data.mac_sonucu?.guven ??
      data.guven ??
      0
    );


  const kg =
    data.kg?.tahmin ||
    "—";


  const over25 =
    data.ust_25?.tahmin ||
    data.ust25 ||
    "—";


  const firstHalf =
    data.ilk_yari_kg?.tahmin ||
    "—";


  const secondHalf =
    data.ikinci_yari_kg?.tahmin ||
    "—";


  const firstGoal =
    data.ilk_yari_gol?.tahmin ||
    "—";


  const secondGoal =
    data.ikinci_yari_gol?.tahmin ||
    "—";


  const risk =
    data.risk ||
    "Belirsiz";


  /*
   * SADE TASARIM
   *
   * 1. Tahmini skor
   * 2. Ana tahmin
   * 3. Oynanabilir seçimler
   * 4. Risk
   * 5. Kısa değerlendirme
   */

  area.innerHTML = `

    <div class="prediction-main">

      <div class="prediction-heading">
        TAHMİNİ MAÇ SKORU
      </div>

      <div class="predicted-score">
        ${escapeHTML(score)}
      </div>

    </div>


    <div class="prediction-main-pick">

      <span class="prediction-label">
        TAHMİN
      </span>

      <strong>
        ${escapeHTML(matchPrediction)}
      </strong>

      ${
        confidence > 0
          ? `<small>%${confidence} güven</small>`
          : ""
      }

    </div>


    <div class="playable-card">

      <div class="playable-title">
        OYNANILABİLİR SEÇİMLER
      </div>


      <div class="playable-list">

        ${predictionChip(
          "KG",
          kg
        )}

        ${predictionChip(
          "2.5 GOL",
          over25
        )}

        ${predictionChip(
          "İY KG",
          firstHalf
        )}

        ${predictionChip(
          "2Y KG",
          secondHalf
        )}

        ${predictionChip(
          "İY GOL",
          firstGoal
        )}

        ${predictionChip(
          "2Y GOL",
          secondGoal
        )}

      </div>

    </div>


    <div class="risk-row">

      <span>Risk</span>

      <strong>
        ${escapeHTML(risk)}
      </strong>

    </div>


    ${
      data.genel_degerlendirme
        ? `
          <div class="short-analysis">

            <div class="short-analysis-title">
              KISA ANALİZ
            </div>

            <p>
              ${escapeHTML(
                data.genel_degerlendirme
              )}
            </p>

          </div>
        `
        : ""
    }

  `;

}


/* =========================================================
   PREDICTION CHIP
   ========================================================= */

function predictionChip(
  label,
  value
) {

  if (
    !value ||
    value === "—" ||
    value === "Belirsiz"
  ) {
    return "";
  }


  return `

    <div class="prediction-chip">

      <span>
        ${escapeHTML(label)}
      </span>

      <strong>
        ${escapeHTML(value)}
      </strong>

    </div>

  `;

}


/* =========================================================
   FINISHED MATCH
   ========================================================= */

function renderFinishedAnalysis(
  fixture,
  details
) {

  const content =
    $("#analysisContent");

  if (!content) return;


  const home =
    fixture.teams?.home || {};

  const away =
    fixture.teams?.away || {};


  const homeScore =
    fixture.goals?.home ??
    fixture.score?.fulltime?.home ??
    "—";


  const awayScore =
    fixture.goals?.away ??
    fixture.score?.fulltime?.away ??
    "—";


  content.innerHTML = `

    <div class="analysis-header">

      <div class="analysis-team">

        <img
          class="analysis-team-logo"
          src="${escapeAttr(getTeamLogo(home))}"
          alt=""
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <strong>
          ${escapeHTML(home.name || "")}
        </strong>

      </div>


      <div class="analysis-vs">
        ${homeScore} - ${awayScore}
      </div>


      <div class="analysis-team">

        <img
          class="analysis-team-logo"
          src="${escapeAttr(getTeamLogo(away))}"
          alt=""
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        >

        <strong>
          ${escapeHTML(away.name || "")}
        </strong>

      </div>

    </div>


    <div class="finished-notice">

      <strong>Maç tamamlandı</strong>

      <p>
        Bu maç için geriye dönük tahmin oluşturulmuyor.
        AI yalnızca maç başlamadan önceki veriler üzerinden
        tahmin üretir.
      </p>

    </div>

  `;

}


/* =========================================================
   LOADING / ERROR
   ========================================================= */

function renderLoading() {

  const container = $("#matches");

  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Maçlar yükleniyor...</p>
    </div>
  `;

}


function renderError(title, text) {

  const container = $("#matches");

  if (!container) return;

  container.innerHTML = `

    <div class="error-state">

      <strong>
        ${escapeHTML(title)}
      </strong>

      <p>
        ${escapeHTML(text)}
      </p>

      <button
        onclick="loadFixtures(true)"
        class="retry-btn"
      >
        Tekrar Dene
      </button>

    </div>

  `;

}


function renderAILoading() {

  const area = $("#aiResultArea");

  if (!area) return;

  area.innerHTML = `

    <div class="ai-loading-card">

      <div class="spinner"></div>

      <span>
        Veriler karşılaştırılıyor...
      </span>

    </div>

  `;

}


function renderAIError(error) {

  const area = $("#aiResultArea");

  if (!area) return;

  area.innerHTML = `

    <div class="ai-error-card">

      <strong>
        AI analizi şu anda alınamadı
      </strong>

      <p>
        ${escapeHTML(error || "Bilinmeyen hata")}
      </p>

      <button
        class="retry-ai-btn"
        onclick="RI_RetryAI()"
      >
        Tekrar Analiz Et
      </button>

    </div>

  `;

}


function renderAnalysisError(
  title,
  text
) {

  const content =
    $("#analysisContent");

  if (!content) return;

  content.innerHTML = `

    <div class="analysis-error">

      <strong>
        ${escapeHTML(title)}
      </strong>

      <p>
        ${escapeHTML(text)}
      </p>

    </div>

  `;

}


/* =========================================================
   RETRY AI
   ========================================================= */

window.RI_RetryAI = async function () {

  if (!state.selectedFixture) {
    return;
  }

  const id =
    String(
      state.selectedFixture.fixture.id
    );


  delete state.aiCache[id];

  saveAICache();


  const payload =
    buildAIPayload(
      state.selectedFixture,
      state.selectedDetails || {}
    );


  await runAIAnalysis(
    state.selectedFixture,
    payload
  );

};


/* =========================================================
   STATUS
   ========================================================= */

function getStatus(match) {

  return String(
    match?.fixture?.status?.short ||
    match?.status?.short ||
    ""
  ).toUpperCase();

}


function isNotStartedStatus(status) {

  return [
    "NS",
    "TBD"
  ].includes(status);

}


function isLiveStatus(status) {

  return [
    "1H",
    "HT",
    "2H",
    "ET",
    "P",
    "LIVE"
  ].includes(status);

}


function isFinishedStatus(status) {

  return [
    "FT",
    "AET",
    "PEN"
  ].includes(status);

}


function formatStatus(match) {

  const status =
    getStatus(match);


  if (isLiveStatus(status)) {

    const elapsed =
      match.fixture?.status?.elapsed;

    return elapsed
      ? `${elapsed}' CANLI`
      : "CANLI";

  }


  if (isFinishedStatus(status)) {
    return "MS";
  }


  if (status === "PST") {
    return "ERTELENDİ";
  }


  if (status === "CANC") {
    return "İPTAL";
  }


  return "BAŞLAMADI";

}


/* =========================================================
   TIME
   ========================================================= */

function formatMatchTime(match) {

  const date =
    match.fixture?.date ||
    match.date;

  if (!date) return "--:--";

  const d =
    new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "--:--";
  }

  return d.toLocaleTimeString(
    "tr-TR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function getLocalDate() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


/* =========================================================
   CATEGORY
   ========================================================= */

function matchPredictionCategory() {

  return "medium";

}


/* =========================================================
   FAVORITES
   ========================================================= */

function loadFavorites() {

  try {

    const raw =
      localStorage.getItem(
        RI_CONFIG.FAVORITES_KEY
      );

    if (!raw) {
      return new Set();
    }

    return new Set(
      JSON.parse(raw).map(String)
    );

  } catch {

    return new Set();

  }

}


function saveFavorites() {

  localStorage.setItem(
    RI_CONFIG.FAVORITES_KEY,

    JSON.stringify(
      [...state.favorites]
    )
  );

}


function toggleFavorite(id) {

  id = String(id);

  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }

  saveFavorites();

  updateFavoriteCount();

}


function updateFavoriteCount() {

  const el =
    $("#favoriteCount");

  if (el) {
    el.textContent =
      state.favorites.size;
  }

}


/* =========================================================
   CACHE
   ========================================================= */

function loadFixtureCache() {

  try {

    return JSON.parse(
      localStorage.getItem(
        RI_CONFIG.FIXTURE_CACHE_KEY
      ) || "{}"
    );

  } catch {

    return {};

  }

}


function saveFixtureCache(
  date,
  fixtures
) {

  state.fixtureCache[date] = {

    timestamp:
      Date.now(),

    fixtures

  };


  localStorage.setItem(
    RI_CONFIG.FIXTURE_CACHE_KEY,

    JSON.stringify(
      state.fixtureCache
    )
  );

}


function getCachedFixtures(date) {

  const cached =
    state.fixtureCache[date];

  if (!cached) return null;


  /*
   * 10 dakikalık cache.
   */

  if (
    Date.now() -
    cached.timestamp >
    10 * 60 * 1000
  ) {

    return null;

  }


  return cached.fixtures;

}


function loadAICache() {

  try {

    return JSON.parse(
      localStorage.getItem(
        RI_CONFIG.AI_CACHE_KEY
      ) || "{}"
    );

  } catch {

    return {};

  }

}


function saveAICache() {

  localStorage.setItem(
    RI_CONFIG.AI_CACHE_KEY,

    JSON.stringify(
      state.aiCache
    )
  );

}


/* =========================================================
   FETCH
   ========================================================= */

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 20000
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );


  try {

    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );

  } finally {

    clearTimeout(timer);

  }

}


/* =========================================================
   JSON AI PARSE
   ========================================================= */

function parseAIAnalysis(value) {

  if (!value) return null;

  if (typeof value === "object") {
    return value;
  }

  try {

    return JSON.parse(value);

  } catch {

    /*
     * Markdown JSON temizliği
     */

    const cleaned =
      String(value)
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }

  }

}


/* =========================================================
   HELPERS
   ========================================================= */

function normalizeConfidence(value) {

  const n =
    Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      95,
      Math.round(n)
    )
  );

}


function deepClone(obj) {

  try {
    return JSON.parse(
      JSON.stringify(obj)
    );
  } catch {
    return {};
  }

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

  return escapeHTML(value);

}
