/* =========================================================
   R❤️İ FOOTBALL
   app.js
   ========================================================= */

"use strict";

const RI_CONFIG = {
  API_URL: "/api/fixtures",
  MATCH_API_URL: "/api/match",
  AI_API_URL: "/api/ai",

  FIXTURE_CACHE_MINUTES: 10,
  ANALYSIS_CACHE_DAYS: 7,

  REQUEST_TIMEOUT: 20000
};

const state = {
  fixtures: [],
  filteredFixtures: [],
  selectedDate: "",
  selectedLeague: "all",
  selectedFilter: "all",
  searchQuery: "",

  favorites: loadFavorites(),

  selectedFixture: null,

  loading: false,
  requestId: 0,

  analysisCache: loadAnalysisCache(),

  matchDetailsCache: {},

  leagues: [],

  apiInfo: {
    connected: false,
    error: null
  }
};


/* =========================================================
   DOM
   ========================================================= */

const el = {};

function findElements() {
  el.sidebar = document.getElementById("sidebar");
  el.sidebarOverlay = document.getElementById("sidebarOverlay");
  el.closeMenuBtn = document.getElementById("closeMenuBtn");
  el.hamburgerBtn = document.getElementById("hamburgerBtn");

  el.matches = document.getElementById("matches");
  el.searchInput = document.getElementById("searchInput");
  el.clearSearch = document.getElementById("clearSearch");

  el.refreshBtn = document.getElementById("refreshBtn");

  el.matchCount = document.getElementById("matchCount");
  el.sectionTitle = document.getElementById("sectionTitle");
  el.resultInfo = document.getElementById("resultInfo");
  el.dateBox = document.getElementById("dateBox");

  el.apiStatus = document.getElementById("apiStatus");
  el.sidebarApiStatus = document.getElementById("sidebarApiStatus");

  el.leagueMenu = document.getElementById("leagueMenu");

  el.analysisDrawer = document.getElementById("analysisDrawer");
  el.drawerOverlay = document.getElementById("drawerOverlay");
  el.drawerClose = document.getElementById("drawerClose");
  el.analysisContent = document.getElementById("analysisContent");

  el.favoriteCount = document.getElementById("favoriteCount");
}


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  findElements();

  bindEvents();

  state.selectedDate = getIstanbulDate();

  updateDateUI();
  updateFavoriteCount();
  updateApiStatus(false, "BAĞLANIYOR...");

  await loadFixtures();
}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {

  document.addEventListener("click", handleDocumentClick);

  if (el.searchInput) {
    el.searchInput.addEventListener("input", function () {
      state.searchQuery = this.value.trim().toLowerCase();

      if (state.searchQuery) {
        state.selectedFilter = "search";
      } else if (state.selectedFilter === "search") {
        state.selectedFilter = "all";
      }

      renderFixtures();
    });
  }

  if (el.clearSearch) {
    el.clearSearch.addEventListener("click", function () {
      if (el.searchInput) {
        el.searchInput.value = "";
      }

      state.searchQuery = "";

      if (state.selectedFilter === "search") {
        state.selectedFilter = "all";
      }

      renderFixtures();
    });
  }

  if (el.refreshBtn) {
    el.refreshBtn.addEventListener("click", async function () {
      await loadFixtures(true);
    });
  }

  if (el.drawerClose) {
    el.drawerClose.addEventListener("click", closeAnalysis);
  }

  if (el.drawerOverlay) {
    el.drawerOverlay.addEventListener("click", closeAnalysis);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeAnalysis();
      closeSidebar();
    }
  });
}


/* =========================================================
   GLOBAL CLICK HANDLER
   ========================================================= */

async function handleDocumentClick(event) {

  const menuItem = event.target.closest("[data-filter]");

  if (menuItem) {
    event.preventDefault();

    const filter = menuItem.dataset.filter;

    state.selectedFilter = filter || "all";

    document.querySelectorAll(".menu-item").forEach(function (item) {
      item.classList.toggle(
        "active",
        item.dataset.filter === state.selectedFilter
      );
    });

    closeSidebar();

    updateSectionTitle();

    renderFixtures();

    return;
  }


  const leagueItem = event.target.closest("[data-league]");

  if (leagueItem) {
    event.preventDefault();

    state.selectedLeague = leagueItem.dataset.league || "all";

    closeSidebar();

    renderFixtures();

    return;
  }


  const favoriteButton = event.target.closest("[data-favorite-id]");

  if (favoriteButton) {
    event.preventDefault();
    event.stopPropagation();

    const id = String(
      favoriteButton.dataset.favoriteId
    );

    toggleFavorite(id);

    return;
  }


  const matchCard = event.target.closest("[data-fixture-id]");

  if (matchCard) {
    event.preventDefault();

    const fixtureId =
      String(matchCard.dataset.fixtureId);

    await openMatch(fixtureId);

    return;
  }
}


/* =========================================================
   FIXTURES
   ========================================================= */

async function loadFixtures(force = false) {

  const requestId = ++state.requestId;

  state.loading = true;

  showLoading("Maçlar yükleniyor...");

  const date = state.selectedDate || getIstanbulDate();

  const cacheKey = `ri_fixture_cache_${date}`;

  if (!force) {

    const cached = getJSON(cacheKey);

    if (
      cached &&
      cached.timestamp &&
      Date.now() - cached.timestamp <
        RI_CONFIG.FIXTURE_CACHE_MINUTES * 60 * 1000
    ) {

      state.fixtures =
        normalizeFixtures(cached.data);

      state.loading = false;

      state.apiInfo.connected = true;

      updateApiStatus(true, "● API AKTİF");

      buildLeagues();

      renderLeagueMenu();

      renderFixtures();

      return;
    }
  }


  try {

    const url =
      `${RI_CONFIG.API_URL}?date=${encodeURIComponent(date)}`;

    const response =
      await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        },
        RI_CONFIG.REQUEST_TIMEOUT
      );

    const data = await response.json();


    if (requestId !== state.requestId) {
      return;
    }


    if (!response.ok) {

      const message =
        data?.errors?.requests ||
        data?.error ||
        data?.message ||
        `API HTTP ${response.status}`;

      throw new Error(message);
    }


    if (
      data?.errors &&
      Object.keys(data.errors).length > 0
    ) {

      const requestError =
        data.errors.requests ||
        Object.values(data.errors)[0];

      throw new Error(
        typeof requestError === "string"
          ? requestError
          : "API-Football hata döndürdü."
      );
    }


    const rawFixtures =
      Array.isArray(data?.response)
        ? data.response
        : Array.isArray(data)
          ? data
          : [];


    state.fixtures =
      normalizeFixtures(rawFixtures);


    setJSON(cacheKey, {
      timestamp: Date.now(),
      data: state.fixtures
    });


    state.apiInfo.connected = true;
    state.apiInfo.error = null;

    updateApiStatus(
      true,
      `● API AKTİF · ${state.fixtures.length} MAÇ`
    );


    buildLeagues();
    renderLeagueMenu();
    renderFixtures();

  } catch (error) {

    console.error("FIXTURES ERROR:", error);

    state.apiInfo.connected = false;
    state.apiInfo.error = error.message;

    updateApiStatus(false, "● API HATASI");


    /*
     * Son kayıtlı veriyi kullan.
     */

    const cached =
      getJSON(cacheKey);

    if (cached?.data) {

      state.fixtures =
        normalizeFixtures(cached.data);

      buildLeagues();
      renderLeagueMenu();

      showNotice(
        "Canlı API'ye ulaşılamadı. Son kayıtlı maç verileri gösteriliyor.",
        "warning"
      );

      renderFixtures();

    } else {

      showError(
        "Maçlar alınamadı.",
        error.message
      );
    }

  } finally {

    if (requestId === state.requestId) {
      state.loading = false;
    }
  }
}


/* =========================================================
   NORMALIZE
   ========================================================= */

function normalizeFixtures(list) {

  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map(function (item) {

      const fixture =
        item?.fixture || item;

      const league =
        item?.league || {};

      const teams =
        item?.teams || {};

      const goals =
        item?.goals || {};

      const home =
        teams?.home || {};

      const away =
        teams?.away || {};


      const id =
        fixture?.id ??
        item?.id ??
        null;


      if (!id) {
        return null;
      }


      return {
        ...item,

        fixture: {
          ...fixture,
          id
        },

        league: {
          ...league,
          id: league?.id ?? "unknown",
          name: league?.name || "Lig Bilinmiyor",
          country: league?.country || "",
          logo: league?.logo || ""
        },

        teams: {
          ...teams,

          home: {
            ...home,
            id: home?.id ?? null,
            name: home?.name || "Ev Sahibi",
            logo: home?.logo || "",
            winner: home?.winner ?? null
          },

          away: {
            ...away,
            id: away?.id ?? null,
            name: away?.name || "Deplasman",
            logo: away?.logo || "",
            winner: away?.winner ?? null
          }
        },

        goals: {
          ...goals,
          home: goals?.home ?? null,
          away: goals?.away ?? null
        }
      };

    })
    .filter(Boolean);
}


/* =========================================================
   LEAGUES
   ========================================================= */

function buildLeagues() {

  const map = new Map();

  state.fixtures.forEach(function (fixture) {

    const league =
      fixture.league || {};

    const id =
      String(league.id || "unknown");

    if (!map.has(id)) {

      map.set(id, {
        id,
        name:
          league.name ||
          "Lig Bilinmiyor",

        country:
          league.country ||
          "",

        logo:
          league.logo ||
          "",

        count: 0
      });
    }

    map.get(id).count++;
  });


  state.leagues =
    Array.from(map.values())
      .sort(function (a, b) {

        return a.name.localeCompare(
          b.name,
          "tr"
        );
      });
}


function renderLeagueMenu() {

  if (!el.leagueMenu) {
    return;
  }


  let html = `
    <button
      class="league-menu-item ${state.selectedLeague === "all" ? "active" : ""}"
      data-league="all"
    >
      <span>🌐</span>
      <span>Tüm Ligler</span>
      <b>${state.fixtures.length}</b>
    </button>
  `;


  state.leagues.forEach(function (league) {

    html += `
      <button
        class="league-menu-item ${
          state.selectedLeague === String(league.id)
            ? "active"
            : ""
        }"
        data-league="${escapeAttr(league.id)}"
      >
        ${
          league.logo
            ? `<img src="${escapeAttr(league.logo)}" alt="">`
            : `<span>⚽</span>`
        }

        <span>
          ${escapeHTML(league.name)}
          ${
            league.country
              ? `<small>${escapeHTML(league.country)}</small>`
              : ""
          }
        </span>

        <b>${league.count}</b>
      </button>
    `;
  });


  el.leagueMenu.innerHTML = html;
}


/* =========================================================
   FILTER
   ========================================================= */

function getFilteredFixtures() {

  let list =
    Array.isArray(state.fixtures)
      ? [...state.fixtures]
      : [];


  if (state.selectedLeague !== "all") {

    list =
      list.filter(function (fixture) {

        return String(
          fixture?.league?.id
        ) === String(
          state.selectedLeague
        );

      });
  }


  if (state.searchQuery) {

    const q =
      state.searchQuery;

    list =
      list.filter(function (fixture) {

        const home =
          fixture?.teams?.home?.name ||
          "";

        const away =
          fixture?.teams?.away?.name ||
          "";

        const league =
          fixture?.league?.name ||
          "";

        const country =
          fixture?.league?.country ||
          "";

        return (
          home.toLowerCase().includes(q) ||
          away.toLowerCase().includes(q) ||
          league.toLowerCase().includes(q) ||
          country.toLowerCase().includes(q)
        );
      });
  }


  switch (state.selectedFilter) {

    case "reliable":
      list =
        list.filter(isReliableSelection);
      break;


    case "medium":
      list =
        list.filter(isMediumRisk);
      break;


    case "risky":
    case "high":
      list =
        list.filter(isHighRisk);
      break;


    case "high-odds":
      list =
        list.filter(hasHighOddsOpportunity);
      break;


    case "iy2ykg":
    case "iy2y":
      list =
        list.filter(isIy2yKg);
      break;


    case "first-half":
      list =
        list.filter(isFirstHalfGoal);
      break;


    case "second-half":
      list =
        list.filter(isSecondHalfGoal);
      break;


    case "score":
      list =
        list.filter(hasScorePrediction);
      break;


    case "favorites":
      list =
        list.filter(function (fixture) {

          return state.favorites.has(
            String(fixture.fixture.id)
          );

        });
      break;


    case "search":
    case "analysis":
    case "stats":
    case "all":
    default:
      break;
  }


  return list;
}


/* =========================================================
   RENDER FIXTURES
   ========================================================= */

function renderFixtures() {

  state.filteredFixtures =
    getFilteredFixtures();


  if (el.matchCount) {
    el.matchCount.textContent =
      state.filteredFixtures.length;
  }


  updateSectionTitle();


  if (!el.matches) {
    return;
  }


  if (!state.filteredFixtures.length) {

    el.matches.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Maç bulunamadı</h3>
        <p>
          Seçtiğin filtre veya arama kriterine
          uygun maç bulunamadı.
        </p>
      </div>
    `;

    if (el.resultInfo) {
      el.resultInfo.textContent = "0 sonuç";
    }

    return;
  }


  const groups =
    groupByLeague(
      state.filteredFixtures
    );


  let html = "";


  groups.forEach(function (group) {

    html += `
      <section
        class="league-group"
        data-league-group="${escapeAttr(group.id)}"
      >

        <div class="league-group-header">

          <div class="league-group-name">

            ${
              group.logo
                ? `<img src="${escapeAttr(group.logo)}" alt="">`
                : `<span class="league-fallback">⚽</span>`
            }

            <div>
              <strong>
                ${escapeHTML(group.name)}
              </strong>

              ${
                group.country
                  ? `<small>${escapeHTML(group.country)}</small>`
                  : ""
              }
            </div>

          </div>

          <span>
            ${group.fixtures.length} maç
          </span>

        </div>

        <div class="match-grid">
          ${
            group.fixtures
              .map(renderMatchCard)
              .join("")
          }
        </div>

      </section>
    `;
  });


  el.matches.innerHTML = html;


  if (el.resultInfo) {

    el.resultInfo.textContent =
      `${state.filteredFixtures.length} sonuç`;
  }
}


function groupByLeague(list) {

  const map = new Map();


  list.forEach(function (fixture) {

    const league =
      fixture.league || {};

    const id =
      String(league.id || "unknown");


    if (!map.has(id)) {

      map.set(id, {
        id,

        name:
          league.name ||
          "Lig Bilinmiyor",

        country:
          league.country ||
          "",

        logo:
          league.logo ||
          "",

        fixtures: []
      });
    }


    map.get(id).fixtures.push(fixture);
  });


  return Array.from(map.values());
}


/* =========================================================
   MATCH CARD
   ========================================================= */

function renderMatchCard(fixture) {

  const id =
    String(fixture.fixture.id);

  const home =
    fixture.teams?.home || {};

  const away =
    fixture.teams?.away || {};

  const goals =
    fixture.goals || {};

  const time =
    formatMatchTime(
      fixture.fixture?.date
    );

  const status =
    fixture.fixture?.status?.short ||
    "";


  const isFavorite =
    state.favorites.has(id);


  const homeScore =
    goals.home !== null &&
    goals.home !== undefined
      ? goals.home
      : "-";


  const awayScore =
    goals.away !== null &&
    goals.away !== undefined
      ? goals.away
      : "-";


  return `
    <article
      class="match-card"
      data-fixture-id="${escapeAttr(id)}"
    >

      <div class="match-card-top">

        <span class="match-time">
          ${escapeHTML(time)}
        </span>

        <button
          type="button"
          class="favorite-btn ${
            isFavorite ? "active" : ""
          }"
          data-favorite-id="${escapeAttr(id)}"
          aria-label="Favorilere ekle"
        >
          ${isFavorite ? "♥" : "♡"}
        </button>

      </div>


      <div class="teams">

        <div class="team home-team">

          ${
            home.logo
              ? `<img
                   src="${escapeAttr(home.logo)}"
                   alt=""
                   loading="lazy"
                 >`
              : `<div class="team-logo-placeholder">⚽</div>`
          }

          <span>
            ${escapeHTML(home.name || "Ev Sahibi")}
          </span>

        </div>


        <div class="match-score">

          <strong>
            ${homeScore}
            <span>:</span>
            ${awayScore}
          </strong>

          <small>
            ${escapeHTML(status)}
          </small>

        </div>


        <div class="team away-team">

          ${
            away.logo
              ? `<img
                   src="${escapeAttr(away.logo)}"
                   alt=""
                   loading="lazy"
                 >`
              : `<div class="team-logo-placeholder">⚽</div>`
          }

          <span>
            ${escapeHTML(away.name || "Deplasman")}
          </span>

        </div>

      </div>


      <div class="match-card-footer">

        <span>
          ${escapeHTML(
            fixture.league?.name ||
            "Lig"
          )}
        </span>

        <span class="analysis-open">
          Analiz →
        </span>

      </div>

    </article>
  `;
}


/* =========================================================
   MATCH ANALYSIS
   ========================================================= */

async function openMatch(id) {

  const fixture =
    state.fixtures.find(function (item) {

      return String(
        item?.fixture?.id
      ) === String(id);

    });


  if (!fixture) {
    return;
  }


  state.selectedFixture =
    fixture;


  openAnalysisDrawer();


  if (el.analysisContent) {

    el.analysisContent.innerHTML = `
      <div class="analysis-loading">
        <div class="spinner"></div>

        <h3>Maç analizi hazırlanıyor...</h3>

        <p>
          Form, H2H, istatistikler, kadro,
          oranlar ve tahmin verileri kontrol ediliyor.
        </p>
      </div>
    `;
  }


  try {

    let details =
      state.matchDetailsCache[id];


    if (!details) {

      const response =
        await fetchWithTimeout(
          `${RI_CONFIG.MATCH_API_URL}?fixture=${encodeURIComponent(id)}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json"
            }
          },
          RI_CONFIG.REQUEST_TIMEOUT
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data?.error ||
          data?.message ||
          `Maç API HTTP ${response.status}`
        );
      }


      if (
        data?.success === false
      ) {

        throw new Error(
          data.error ||
          "Maç analiz verisi alınamadı."
        );
      }


      details =
        data?.data ||
        data?.response ||
        data;


      state.matchDetailsCache[id] =
        details;
    }


    const analysisData = {
      fixture: fixture,
      ...(details || {})
    };


    renderAnalysisHeader(
      fixture,
      analysisData
    );


    await runAIAnalysis(
      fixture,
      analysisData
    );


  } catch (error) {

    console.error(
      "MATCH ANALYSIS ERROR:",
      error
    );


    if (el.analysisContent) {

      el.analysisContent.innerHTML = `
        <div class="analysis-error">

          <div class="error-icon">⚠️</div>

          <h3>Analiz verisi alınamadı</h3>

          <p>
            ${escapeHTML(
              error.message ||
              "Bilinmeyen hata"
            )}
          </p>

          <button
            type="button"
            class="retry-analysis"
            onclick="window.RI_RetryAnalysis()"
          >
            Tekrar Dene
          </button>

        </div>
      `;
    }
  }
}


/* =========================================================
   AI ANALYSIS
   ========================================================= */

async function runAIAnalysis(
  fixture,
  analysisData
) {

  const fixtureId =
    String(fixture.fixture.id);


  /*
   * ÖNEMLİ:
   *
   * Aynı fixture için daha önce alınmış
   * AI analizini kullan.
   *
   * Böylece aynı maç tekrar açıldığında
   * yeni ve farklı bir AI cevabı alınmaz.
   */

  const cached =
    getAnalysisFromCache(fixtureId);


  if (cached) {

    renderAIAnalysis(
      cached,
      true
    );

    return;
  }


  appendAIStatus(
    "AI analiz motoru çalışıyor..."
  );


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
            fixture: analysisData
          })
        },
        RI_CONFIG.REQUEST_TIMEOUT
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data?.error ||
        data?.message ||
        `AI HTTP ${response.status}`
      );
    }


    if (data?.success === false) {

      throw new Error(
        data.error ||
        "AI analiz alınamadı."
      );
    }


    const text =
      String(
        data?.analysis ||
        data?.output ||
        data?.text ||
        ""
      ).trim();


    if (!text) {

      throw new Error(
        "AI boş analiz döndürdü."
      );
    }


    /*
     * AI sonucunu kaydet.
     */

    saveAnalysisToCache(
      fixtureId,
      {
        analysis: text,
        model:
          data?.model ||
          "gpt-5.6-luna",
        createdAt: Date.now()
      }
    );


    renderAIAnalysis(
      text,
      false
    );


  } catch (error) {

    console.error(
      "AI ANALYSIS ERROR:",
      error
    );


    appendAIError(
      error.message ||
      "AI analizi şu anda alınamadı."
    );
  }
}


/* =========================================================
   ANALYSIS UI
   ========================================================= */

function renderAnalysisHeader(
  fixture,
  data
) {

  if (!el.analysisContent) {
    return;
  }


  const home =
    fixture.teams?.home?.name ||
    "Ev Sahibi";

  const away =
    fixture.teams?.away?.name ||
    "Deplasman";


  const league =
    fixture.league?.name ||
    "";


  const date =
    formatDateTime(
      fixture.fixture?.date
    );


  el.analysisContent.innerHTML = `

    <div class="analysis-header">

      <div class="analysis-league">
        ${escapeHTML(league)}
      </div>

      <h2>
        ${escapeHTML(home)}
        <span>vs</span>
        ${escapeHTML(away)}
      </h2>

      <div class="analysis-date">
        ${escapeHTML(date)}
      </div>

    </div>


    <div class="analysis-section">

      <div class="analysis-section-title">
        <span>🤖</span>
        <h3>R❤️İ AI Analizi</h3>
      </div>

      <div id="aiAnalysisBox">
        <div class="analysis-loading">
          <div class="spinner"></div>
          <p>AI analiz hazırlanıyor...</p>
        </div>
      </div>

    </div>


    <div
      id="analysisExtra"
      class="analysis-extra"
    >
    </div>
  `;
}


function appendAIStatus(message) {

  const box =
    document.getElementById(
      "aiAnalysisBox"
    );


  if (!box) {
    return;
  }


  box.innerHTML = `
    <div class="analysis-loading">
      <div class="spinner"></div>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}


function renderAIAnalysis(
  text,
  fromCache
) {

  const box =
    document.getElementById(
      "aiAnalysisBox"
    );


  if (!box) {
    return;
  }


  box.innerHTML = `
    <div class="ai-analysis">

      <div class="ai-analysis-meta">

        <span>
          🤖 R❤️İ AI
        </span>

        ${
          fromCache
            ? `<span class="cached-badge">
                 Kayıtlı analiz
               </span>`
            : `<span class="fresh-badge">
                 Yeni analiz
               </span>`
        }

      </div>


      <div class="ai-analysis-text">
        ${formatAnalysisText(text)}
      </div>

    </div>
  `;


  const extra =
    document.getElementById(
      "analysisExtra"
    );


  if (extra && state.selectedFixture) {

    extra.innerHTML = `
      <div class="analysis-info-box">
        <strong>Not:</strong>
        Bu maç için AI analiz sonucu
        ${
          fromCache
            ? "daha önce kaydedildi ve tekrar kullanılıyor."
            : "oluşturuldu ve aynı maç için kaydedildi."
        }
      </div>
    `;
  }
}


function appendAIError(message) {

  const box =
    document.getElementById(
      "aiAnalysisBox"
    );


  if (!box) {
    return;
  }


  box.innerHTML = `
    <div class="analysis-error">

      <div class="error-icon">⚠️</div>

      <h3>AI analizi şu anda alınamadı</h3>

      <p>
        ${escapeHTML(message)}
      </p>

      <button
        type="button"
        class="retry-analysis"
        onclick="window.RI_RetryAI()"
      >
        AI Analizini Tekrar Dene
      </button>

    </div>
  `;
}


/* =========================================================
   RETRY
   ========================================================= */

window.RI_RetryAnalysis = async function () {

  if (!state.selectedFixture) {
    return;
  }


  const id =
    String(
      state.selectedFixture.fixture.id
    );


  delete state.matchDetailsCache[id];

  await openMatch(id);
};


window.RI_RetryAI = async function () {

  if (!state.selectedFixture) {
    return;
  }


  const id =
    String(
      state.selectedFixture.fixture.id
    );


  /*
   * Sadece AI cache'i temizlenir.
   * Maç verisi tekrar çekilmez.
   */

  delete state.analysisCache[id];

  saveAnalysisCache();


  const details =
    state.matchDetailsCache[id] ||
    {};


  const analysisData = {
    fixture: state.selectedFixture,
    ...(details || {})
  };


  await runAIAnalysis(
    state.selectedFixture,
    analysisData
  );
};


/* =========================================================
   DRAWER
   ========================================================= */

function openAnalysisDrawer() {

  if (el.analysisDrawer) {

    el.analysisDrawer.classList.add(
      "open"
    );

    el.analysisDrawer.classList.add(
      "active"
    );
  }


  if (el.drawerOverlay) {

    el.drawerOverlay.classList.add(
      "open"
    );

    el.drawerOverlay.classList.add(
      "active"
    );
  }


  document.body.classList.add(
    "analysis-open"
  );
}


function closeAnalysis() {

  if (el.analysisDrawer) {

    el.analysisDrawer.classList.remove(
      "open"
    );

    el.analysisDrawer.classList.remove(
      "active"
    );
  }


  if (el.drawerOverlay) {

    el.drawerOverlay.classList.remove(
      "open"
    );

    el.drawerOverlay.classList.remove(
      "active"
    );
  }


  document.body.classList.remove(
    "analysis-open"
  );
}


/* =========================================================
   SIDEBAR
   ========================================================= */

window.RI_OpenMenu = function () {

  if (el.sidebar) {

    el.sidebar.classList.add(
      "open"
    );

    el.sidebar.classList.add(
      "active"
    );
  }


  if (el.sidebarOverlay) {

    el.sidebarOverlay.classList.add(
      "open"
    );

    el.sidebarOverlay.classList.add(
      "active"
    );
  }


  document.body.classList.add(
    "menu-open"
  );
};


window.RI_CloseMenu = function () {
  closeSidebar();
};


function closeSidebar() {

  if (el.sidebar) {

    el.sidebar.classList.remove(
      "open"
    );

    el.sidebar.classList.remove(
      "active"
    );
  }


  if (el.sidebarOverlay) {

    el.sidebarOverlay.classList.remove(
      "open"
    );

    el.sidebarOverlay.classList.remove(
      "active"
    );
  }


  document.body.classList.remove(
    "menu-open"
  );
}


/* =========================================================
   FAVORITES
   ========================================================= */

function loadFavorites() {

  try {

    const raw =
      localStorage.getItem(
        "ri_favorites"
      );

    const array =
      raw
        ? JSON.parse(raw)
        : [];

    return new Set(
      Array.isArray(array)
        ? array.map(String)
        : []
    );

  } catch {

    return new Set();
  }
}


function saveFavorites() {

  try {

    localStorage.setItem(
      "ri_favorites",
      JSON.stringify(
        Array.from(
          state.favorites
        )
      )
    );

  } catch (error) {

    console.warn(
      "Favorites save error:",
      error
    );
  }
}


function toggleFavorite(id) {

  id = String(id);


  if (
    state.favorites.has(id)
  ) {

    state.favorites.delete(id);

  } else {

    state.favorites.add(id);
  }


  saveFavorites();

  updateFavoriteCount();

  renderFixtures();
}


function updateFavoriteCount() {

  if (el.favoriteCount) {

    el.favoriteCount.textContent =
      state.favorites.size;
  }
}


/* =========================================================
   AI CACHE
   ========================================================= */

function loadAnalysisCache() {

  try {

    const raw =
      localStorage.getItem(
        "ri_ai_analysis_cache"
      );


    if (!raw) {
      return {};
    }


    const parsed =
      JSON.parse(raw);


    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return {};
    }


    return parsed;

  } catch {

    return {};
  }
}


function saveAnalysisCache() {

  try {

    localStorage.setItem(
      "ri_ai_analysis_cache",
      JSON.stringify(
        state.analysisCache
      )
    );

  } catch (error) {

    console.warn(
      "AI cache save error:",
      error
    );
  }
}


function getAnalysisFromCache(
  fixtureId
) {

  const item =
    state.analysisCache[
      String(fixtureId)
    ];


  if (!item) {
    return null;
  }


  const maxAge =
    RI_CONFIG.ANALYSIS_CACHE_DAYS *
    24 *
    60 *
    60 *
    1000;


  if (
    !item.createdAt ||
    Date.now() - item.createdAt >
      maxAge
  ) {

    delete state.analysisCache[
      String(fixtureId)
    ];

    saveAnalysisCache();

    return null;
  }


  return item.analysis || null;
}


function saveAnalysisToCache(
  fixtureId,
  result
) {

  state.analysisCache[
    String(fixtureId)
  ] = result;


  saveAnalysisCache();
}


/* =========================================================
   SELECTION HELPERS
   ========================================================= */

function isReliableSelection(
  fixture
) {

  const prediction =
    fixture?.predictions;


  if (!prediction) {
    return false;
  }


  const percent =
    getPredictionPercent(
      prediction
    );


  return percent >= 70;
}


function isMediumRisk(
  fixture
) {

  const prediction =
    fixture?.predictions;


  if (!prediction) {
    return false;
  }


  const percent =
    getPredictionPercent(
      prediction
    );


  return percent >= 55 &&
    percent < 70;
}


function isHighRisk(
  fixture
) {

  const prediction =
    fixture?.predictions;


  if (!prediction) {
    return false;
  }


  const percent =
    getPredictionPercent(
      prediction
    );


  return percent > 0 &&
    percent < 55;
}


function getPredictionPercent(
  prediction
) {

  const percent =
    prediction?.percentages ||
    prediction?.percentage ||
    {};


  const values =
    [
      percent.home,
      percent.away,
      percent.draw
    ]
      .map(parsePercent)
      .filter(function (v) {
        return Number.isFinite(v);
      });


  if (!values.length) {
    return 0;
  }


  return Math.max(...values);
}


function parsePercent(value) {

  if (
    typeof value === "number"
  ) {
    return value;
  }


  if (
    typeof value !== "string"
  ) {
    return NaN;
  }


  return parseFloat(
    value.replace("%", "")
  );
}


function hasHighOddsOpportunity(
  fixture
) {

  const odds =
    fixture?.odds;


  if (!odds) {
    return false;
  }


  const values =
    extractOdds(odds);


  return values.some(function (value) {
    return value >= 2.00;
  });
}


function extractOdds(
  odds
) {

  const result = [];


  try {

    const bookmakers =
      odds?.bookmakers ||
      [];


    bookmakers.forEach(function (
      bookmaker
    ) {

      (
        bookmaker?.bets ||
        []
      ).forEach(function (bet) {

        (
          bet?.values ||
          []
        ).forEach(function (value) {

          const odd =
            parseFloat(
              value?.odd
            );

          if (
            Number.isFinite(odd)
          ) {
            result.push(odd);
          }
        });
      });
    });

  } catch {
    return result;
  }


  return result;
}


function isIy2yKg(
  fixture
) {

  const predictions =
    fixture?.predictions;


  const advice =
    String(
      predictions?.advice ||
      ""
    ).toLowerCase();


  const all =
    JSON.stringify(
      fixture
    ).toLowerCase();


  return (
    advice.includes("both") ||
    advice.includes("btts") ||
    advice.includes("kg") ||
    all.includes("both teams to score")
  );
}


function isFirstHalfGoal(
  fixture
) {

  const text =
    JSON.stringify(
      fixture
    ).toLowerCase();


  return (
    text.includes("first half") ||
    text.includes("1st half") ||
    text.includes("1. yarı") ||
    text.includes("first_half")
  );
}


function isSecondHalfGoal(
  fixture
) {

  const text =
    JSON.stringify(
      fixture
    ).toLowerCase();


  return (
    text.includes("second half") ||
    text.includes("2nd half") ||
    text.includes("2. yarı") ||
    text.includes("second_half")
  );
}


function hasScorePrediction(
  fixture
) {

  const prediction =
    fixture?.predictions;


  return Boolean(
    prediction?.score ||
    prediction?.goals ||
    prediction?.under_over
  );
}


/* =========================================================
   UI
   ========================================================= */

function updateSectionTitle() {

  if (!el.sectionTitle) {
    return;
  }


  const titles = {
    all: "Bugünün Maçları",
    search: "Maç Ara",
    analysis: "Maç Analizi",
    reliable: "Güvenilir Seçimler",
    medium: "Orta Riskli",
    risky: "Riskli Seçimler",
    high: "Yüksek Oran Fırsatları",
    "high-odds": "Yüksek Oran Fırsatları",
    iy2ykg: "İY / 2Y KG",
    iy2y: "İY / 2Y KG",
    "first-half": "1. Yarı Gol Beklenenler",
    "second-half": "2. Yarı Gol Beklenenler",
    score: "Tahmini Skorlar",
    stats: "İstatistikler",
    favorites: "Favoriler"
  };


  el.sectionTitle.textContent =
    titles[
      state.selectedFilter
    ] ||
    "Bugünün Maçları";
}


function updateDateUI() {

  if (!el.dateBox) {
    return;
  }


  el.dateBox.textContent =
    `📅 ${formatDate(
      state.selectedDate
    )}`;
}


function updateApiStatus(
  connected,
  text
) {

  if (el.apiStatus) {

    el.apiStatus.textContent =
      text;

    el.apiStatus.classList.toggle(
      "online",
      connected
    );

    el.apiStatus.classList.toggle(
      "offline",
      !connected
    );
  }


  if (el.sidebarApiStatus) {

    el.sidebarApiStatus.textContent =
      connected
        ? "API bağlantısı aktif"
        : "API bağlantısı kontrol ediliyor";

  }
}


function showLoading(
  message
) {

  if (!el.matches) {
    return;
  }


  el.matches.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}


function showError(
  title,
  message
) {

  if (!el.matches) {
    return;
  }


  el.matches.innerHTML = `
    <div class="empty-state error-state">

      <div class="empty-icon">⚠️</div>

      <h3>
        ${escapeHTML(title)}
      </h3>

      <p>
        ${escapeHTML(message || "")}
      </p>

      <button
        type="button"
        class="retry-analysis"
        onclick="location.reload()"
      >
        Tekrar Dene
      </button>

    </div>
  `;
}


function showNotice(
  message,
  type = "info"
) {

  console.info(
    `[${type}]`,
    message
  );
}


/* =========================================================
   FETCH
   ========================================================= */

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 15000
) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      function () {
        controller.abort();
      },
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
   DATE / TIME
   ========================================================= */

function getIstanbulDate() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Europe/Istanbul"
    }
  ).format(
    new Date()
  );
}


function formatDate(
  dateString
) {

  if (!dateString) {
    return "";
  }


  try {

    const date =
      new Date(
        `${dateString}T12:00:00+03:00`
      );


    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone:
          "Europe/Istanbul"
      }
    ).format(date);

  } catch {

    return dateString;
  }
}


function formatMatchTime(
  dateString
) {

  if (!dateString) {
    return "--:--";
  }


  try {

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone:
          "Europe/Istanbul"
      }
    ).format(
      new Date(dateString)
    );

  } catch {

    return "--:--";
  }
}


function formatDateTime(
  dateString
) {

  if (!dateString) {
    return "";
  }


  try {

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone:
          "Europe/Istanbul"
      }
    ).format(
      new Date(dateString)
    );

  } catch {

    return dateString;
  }
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function getJSON(
  key
) {

  try {

    const raw =
      localStorage.getItem(key);

    return raw
      ? JSON.parse(raw)
      : null;

  } catch {

    return null;
  }
}


function setJSON(
  key,
  value
) {

  try {

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

  } catch (error) {

    console.warn(
      "LocalStorage error:",
      error
    );
  }
}


/* =========================================================
   TEXT
   ========================================================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttr(
  value
) {

  return escapeHTML(value);
}


function formatAnalysisText(
  text
) {

  const escaped =
    escapeHTML(text);


  return escaped
    .replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    )
    .replace(
      /^###\s?(.*?)$/gm,
      "<h4>$1</h4>"
    )
    .replace(
      /^##\s?(.*?)$/gm,
      "<h3>$1</h3>"
    )
    .replace(
      /\n/g,
      "<br>"
    );
}


/* =========================================================
   PUBLIC DEBUG
   ========================================================= */

window.RI_APP = {
  state,
  reload: function () {
    return loadFixtures(true);
  },

  clearAICache: function () {

    state.analysisCache = {};

    saveAnalysisCache();

    console.log(
      "R❤️İ AI analiz cache temizlendi."
    );
  },

  clearFixtureCache: function () {

    Object.keys(
      localStorage
    )
      .filter(function (key) {
        return key.startsWith(
          "ri_fixture_cache_"
        );
      })
      .forEach(function (key) {
        localStorage.removeItem(key);
      });

    console.log(
      "R❤️İ fixture cache temizlendi."
    );
  }
};
