/* =========================================================
   R❤️İ FOOTBALL — APP.JS
   TÜM LİGLER + HAMBURGER + ARAMA + ANALİZ
   ========================================================= */

"use strict";


/* =========================================================
   STATE
   ========================================================= */

const state = {

  fixtures: [],

  filteredFixtures: [],

  analyses: new Map(),

  favorites: new Set(
    JSON.parse(
      localStorage.getItem("ri_favorites") || "[]"
    )
  ),

  currentFilter: "all",

  selectedLeague: null,

  search: "",

  loading: false,

  analyzing: false

};


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const matchesEl =
  $("#matches");

const searchInput =
  $("#searchInput");

const matchCountEl =
  $("#matchCount");

const leagueCountEl =
  $("#leagueCount");

const sectionTitleEl =
  $("#sectionTitle");

const resultInfoEl =
  $("#resultInfo");

const apiStatusEl =
  $("#apiStatus");

const drawerEl =
  $("#analysisDrawer");

const drawerOverlay =
  $("#drawerOverlay");

const sidebar =
  $("#sidebar");

const hamburger =
  $("#hamburger");

const mobileOverlay =
  $("#mobileOverlay");

const leagueMenu =
  $("#leagueMenu");

const refreshBtn =
  $("#refreshBtn");

const clearSearch =
  $("#clearSearch");


/* =========================================================
   DATE
   ========================================================= */

function todayIstanbul() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Europe/Istanbul",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit"
    }
  ).format(
    new Date()
  );

}


/* =========================================================
   HELPERS
   ========================================================= */

function num(
  value,
  fallback = 0
) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


function clamp(
  value,
  min = 0,
  max = 100
) {

  return Math.max(
    min,
    Math.min(max, num(value))
  );

}


function pct(value) {

  return `${Math.round(
    clamp(value)
  )}%`;

}


function probability(value) {

  return clamp(
    num(value) * 100
  );

}


function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function formatDate(
  dateString
) {

  if (!dateString)
    return "-";

  try {

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        timeZone:
          "Europe/Istanbul",

        day:
          "2-digit",

        month:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    ).format(
      new Date(dateString)
    );

  } catch {

    return "-";

  }

}


function getTeamName(
  team
) {

  return (
    team?.name ||
    "Bilinmeyen Takım"
  );

}


function getLogo(
  team
) {

  return team?.logo || "";

}


/* =========================================================
   FAVORITES
   ========================================================= */

function saveFavorites() {

  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(
      [...state.favorites]
    )
  );

}


function isFavorite(id) {

  return state.favorites.has(
    String(id)
  );

}


function toggleFavorite(
  id,
  event
) {

  if (event)
    event.stopPropagation();

  const key =
    String(id);

  if (
    state.favorites.has(key)
  ) {

    state.favorites.delete(
      key
    );

  } else {

    state.favorites.add(
      key
    );

  }

  saveFavorites();

  renderFixtures();

}


/* =========================================================
   API
   ========================================================= */

async function fetchJSON(
  url
) {

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `Geçersiz API cevabı (${response.status})`
    );

  }

  if (!response.ok) {

    throw new Error(
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );

  }

  return data;

}


/* =========================================================
   LOAD FIXTURES
   ========================================================= */

async function loadFixtures() {

  if (state.loading)
    return;

  state.loading =
    true;

  setApiStatus(
    "● API BAĞLANIYOR...",
    "loading"
  );

  matchesEl.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Bugünün tüm ligleri yükleniyor...</p>
    </div>
  `;

  try {

    const date =
      todayIstanbul();

    const data =
      await fetchJSON(
        `/api/fixtures?date=${encodeURIComponent(date)}`
      );

    if (
      !data ||
      !Array.isArray(
        data.response
      )
    ) {

      throw new Error(
        "Maç verisi bulunamadı."
      );

    }

    state.fixtures =
      data.response
        .filter(Boolean)
        .sort(
          (a, b) => {

            const ta =
              num(
                a.fixture?.timestamp
              );

            const tb =
              num(
                b.fixture?.timestamp
              );

            return ta - tb;

          }
        );


    setApiStatus(
      `● API BAĞLI • ${state.fixtures.length} MAÇ`,
      "online"
    );


    buildLeagueMenu();

    renderFixtures();

  } catch (error) {

    console.error(
      "R❤️İ FIXTURE ERROR:",
      error
    );

    setApiStatus(
      "● API HATASI",
      "error"
    );

    matchesEl.innerHTML = `
      <div class="loading">

        <p>
          ⚠️ Maçlar yüklenemedi.
        </p>

        <small>
          ${escapeHTML(
            error.message
          )}
        </small>

        <br><br>

        <button
          class="refresh-btn"
          onclick="loadFixtures()"
        >
          Tekrar Dene
        </button>

      </div>
    `;

  } finally {

    state.loading =
      false;

  }

}


/* =========================================================
   API STATUS
   ========================================================= */

function setApiStatus(
  text,
  type
) {

  if (!apiStatusEl)
    return;

  apiStatusEl.textContent =
    text;

  apiStatusEl.classList.remove(
    "online",
    "loading",
    "error"
  );

  apiStatusEl.classList.add(
    type
  );

}


/* =========================================================
   COUNTRY FLAG
   ========================================================= */

function getCountryFlag(
  country
) {

  const c =
    String(
      country || ""
    ).toLowerCase();

  const flags = {

    england: "🇬🇧",

    "england - premier league":
      "🇬🇧",

    spain: "🇪🇸",

    italy: "🇮🇹",

    germany: "🇩🇪",

    france: "🇫🇷",

    turkey: "🇹🇷",

    türkiye: "🇹🇷",

    netherlands: "🇳🇱",

    portugal: "🇵🇹",

    belgium: "🇧🇪",

    brazil: "🇧🇷",

    argentina: "🇦🇷",

    usa: "🇺🇸",

    "united states":
      "🇺🇸",

    mexico: "🇲🇽",

    scotland: "🏴",

    austria: "🇦🇹",

    switzerland: "🇨🇭",

    denmark: "🇩🇰",

    norway: "🇳🇴",

    sweden: "🇸🇪",

    poland: "🇵🇱",

    greece: "🇬🇷",

    russia: "🇷🇺",

    ukraine: "🇺🇦",

    croatia: "🇭🇷",

    serbia: "🇷🇸",

    romania: "🇷🇴",

    czech republic:
      "🇨🇿",

    "czech republic":
      "🇨🇿",

    europe: "🇪🇺",

    world: "🌎",

    "world cup":
      "🌎"

  };

  return (
    flags[c] ||
    "⚽"
  );

}


/* =========================================================
   BUILD LEAGUE MENU
   ========================================================= */

function buildLeagueMenu() {

  if (!leagueMenu)
    return;

  const leagueMap =
    new Map();


  state.fixtures.forEach(
    (fixture) => {

      const league =
        fixture.league || {};

      const id =
        league.id;

      const name =
        league.name ||
        "Bilinmeyen Lig";

      if (!id)
        return;

      if (!leagueMap.has(id)) {

        leagueMap.set(
          id,
          {
            id,

            name,

            country:
              league.country ||
              "",

            logo:
              league.logo ||
              "",

            count:
              0
          }
        );

      }

      leagueMap.get(id).count++;

    }
  );


  const leagues =
    [...leagueMap.values()]
      .sort(
        (a, b) => {

          const countryCompare =
            String(a.country)
              .localeCompare(
                String(b.country),
                "tr"
              );

          if (
            countryCompare !== 0
          ) {

            return countryCompare;

          }

          return String(a.name)
            .localeCompare(
              String(b.name),
              "tr"
            );

        }
      );


  leagueCountEl.textContent =
    leagues.length;


  if (!leagues.length) {

    leagueMenu.innerHTML = `
      <div class="league-loading">
        Lig bulunamadı.
      </div>
    `;

    return;

  }


  leagueMenu.innerHTML = leagues
    .map(
      (league) => {

        const active =
          state.selectedLeague ===
          league.id
            ? "active"
            : "";

        const flag =
          getCountryFlag(
            league.country
          );

        return `
          <button
            class="league-menu-item ${active}"
            data-league-id="${league.id}"
            data-league-name="${escapeHTML(
              league.name
            )}"
          >

            <span class="league-flag">
              ${flag}
            </span>

            <span class="league-name">
              ${escapeHTML(
                league.name
              )}
            </span>

            <span class="league-count">
              ${league.count}
            </span>

          </button>
        `;

      }
    )
    .join("");


  document
    .querySelectorAll(
      ".league-menu-item"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const leagueId =
              Number(
                button.dataset
                  .leagueId
              );

            selectLeague(
              leagueId
            );

            closeMobileMenu();

          }
        );

      }
    );

}


/* =========================================================
   SELECT LEAGUE
   ========================================================= */

function selectLeague(
  leagueId
) {

  state.selectedLeague =
    Number(leagueId);

  state.currentFilter =
    "league";

  state.search =
    "";

  if (searchInput) {

    searchInput.value =
      "";

  }

  document
    .querySelectorAll(
      ".menu-item"
    )
    .forEach(
      (button) => {

        button.classList.remove(
          "active"
        );

      }
    );


  document
    .querySelectorAll(
      ".league-menu-item"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          Number(
            button.dataset
              .leagueId
          ) ===
            state.selectedLeague
        );

      }
    );


  const selected =
    state.fixtures.find(
      (fixture) =>
        Number(
          fixture.league?.id
        ) ===
        state.selectedLeague
    );


  sectionTitleEl.textContent =
    selected?.league?.name ||
    "Lig";


  renderFixtures();

}


/* =========================================================
   SEARCH
   ========================================================= */

function searchFixtures() {

  const query =
    String(
      state.search || ""
    )
      .trim()
      .toLocaleLowerCase(
        "tr-TR"
      );


  if (!query) {

    return state.fixtures;

  }


  return state.fixtures.filter(
    (fixture) => {

      const home =
        String(
          fixture.teams?.home?.name ||
          ""
        )
          .toLocaleLowerCase(
            "tr-TR"
          );

      const away =
        String(
          fixture.teams?.away?.name ||
          ""
        )
          .toLocaleLowerCase(
            "tr-TR"
          );

      const league =
        String(
          fixture.league?.name ||
          ""
        )
          .toLocaleLowerCase(
            "tr-TR"
          );

      const country =
        String(
          fixture.league?.country ||
          ""
        )
          .toLocaleLowerCase(
            "tr-TR"
          );


      return (
        home.includes(query) ||
        away.includes(query) ||
        league.includes(query) ||
        country.includes(query)
      );

    }
  );

}


/* =========================================================
   MENU FILTER
   ========================================================= */

function applyFilter(
  filter
) {

  state.currentFilter =
    filter;

  state.selectedLeague =
    null;

  document
    .querySelectorAll(
      ".menu-item"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.filter ===
            filter
        );

      }
    );


  document
    .querySelectorAll(
      ".league-menu-item"
    )
    .forEach(
      (button) => {

        button.classList.remove(
          "active"
        );

      }
    );


  const titles = {

    all:
      "Bugünün Maçları",

    search:
      "Maç Ara",

    analysis:
      "Maç Analizi",

    reliable:
      "Güvenilir Seçimler",

    medium:
      "Orta Riskli",

    risky:
      "Riskli Seçimler",

    high:
      "Yüksek Oran Fırsatları",

    iy2y:
      "İY / 2Y KG",

    "first-half":
      "1. Yarı Gol Beklenenler",

    "second-half":
      "2. Yarı Gol Beklenenler",

    score:
      "Tahmini Skorlar",

    stats:
      "İstatistikler",

    favorites:
      "Favoriler"

  };


  sectionTitleEl.textContent =
    titles[filter] ||
    "Bugünün Maçları";


  if (
    filter ===
    "search"
  ) {

    setTimeout(
      () => {

        searchInput?.focus();

      },
      100
    );

  }


  renderFixtures();

}


/* =========================================================
   PASSES FILTER
   ========================================================= */

function passesFilter(
  fixture
) {

  const filter =
    state.currentFilter;


  if (
    filter ===
      "all" ||
    filter ===
      "search"
  ) {

    return true;

  }


  if (
    filter ===
    "league"
  ) {

    return (
      Number(
        fixture.league?.id
      ) ===
      Number(
        state.selectedLeague
      )
    );

  }


  if (
    filter ===
    "favorites"
  ) {

    return isFavorite(
      fixture.fixture?.id
    );

  }


  const analysis =
    state.analyses.get(
      String(
        fixture.fixture?.id
      )
    );


  if (!analysis)
    return false;


  const m =
    analysis.metrics || {};


  if (
    filter ===
    "reliable"
  ) {

    return (
      num(
        analysis.confidence
      ) >= 70
    );

  }


  if (
    filter ===
    "medium"
  ) {

    return (
      num(
        analysis.confidence
      ) >= 60 &&
      num(
        analysis.confidence
      ) < 70
    );

  }


  if (
    filter ===
    "risky"
  ) {

    return (
      num(
        analysis.confidence
      ) >= 50 &&
      num(
        analysis.confidence
      ) < 60
    );

  }


  if (
    filter ===
    "high"
  ) {

    return (
      num(
        m.bestOdds
      ) >= 2 ||
      num(
        m.longshotProbability
      ) >= 45
    );

  }


  if (
    filter ===
    "iy2y"
  ) {

    return (
      num(
        m.firstHalfBTTS
      ) >= 40 &&
      num(
        m.secondHalfBTTS
      ) >= 45
    );

  }


  if (
    filter ===
    "first-half"
  ) {

    return (
      num(
        m.firstHalfGoal
      ) >= 72
    );

  }


  if (
    filter ===
    "second-half"
  ) {

    return (
      num(
        m.secondHalfGoal
      ) >= 75
    );

  }


  if (
    filter ===
      "score" ||
    filter ===
      "stats" ||
    filter ===
      "analysis"
  ) {

    return true;

  }


  return true;

}


/* =========================================================
   RENDER FIXTURES
   ========================================================= */

function renderFixtures() {

  if (!matchesEl)
    return;


  let fixtures =
    searchFixtures();


  fixtures =
    fixtures.filter(
      passesFilter
    );


  matchCountEl.textContent =
    state.fixtures.length;


  if (
    state.currentFilter ===
    "league"
  ) {

    resultInfoEl.textContent =
      `${fixtures.length} maç`;

  } else if (
    state.search
  ) {

    resultInfoEl.textContent =
      `${fixtures.length} maç bulundu`;

  } else {

    resultInfoEl.textContent =
      `${fixtures.length} maç`;

  }


  if (!fixtures.length) {

    matchesEl.innerHTML = `
      <div class="loading">

        <p>
          🔎 Sonuç bulunamadı.
        </p>

        <small>
          ${
            state.currentFilter ===
            "league"
              ? "Bu ligde bugün maç bulunmuyor."
              : "Başka bir takım, lig veya ülke deneyin."
          }
        </small>

      </div>
    `;

    return;

  }


  matchesEl.innerHTML =
    fixtures
      .map(
        renderMatchCard
      )
      .join("");

}


/* =========================================================
   MATCH CARD
   ========================================================= */

function renderMatchCard(
  fixture
) {

  const id =
    fixture.fixture?.id;

  const home =
    fixture.teams?.home || {};

  const away =
    fixture.teams?.away || {};

  const league =
    fixture.league || {};

  const status =
    fixture.fixture?.status || {};


  const analysis =
    state.analyses.get(
      String(id)
    );


  const fav =
    isFavorite(id);


  let scoreText =
    "VS";

  let statusText =
    formatDate(
      fixture.fixture?.date
    );


  if (
    status.short ===
      "FT" ||
    status.short ===
      "AET" ||
    status.short ===
      "PEN"
  ) {

    scoreText =
      `${fixture.goals?.home ?? 0} - ${fixture.goals?.away ?? 0}`;

    statusText =
      "MAÇ BİTTİ";

  } else if (
    status.short ===
      "1H" ||
    status.short ===
      "2H" ||
    status.short ===
      "HT"
  ) {

    scoreText =
      `${fixture.goals?.home ?? 0} - ${fixture.goals?.away ?? 0}`;

    statusText =
      "🔴 CANLI";

  }


  const recommendation =
    analysis
      ? `
        <div class="card-recommendation">

          <span>
            🎯 ŞUNU OYNA
          </span>

          <strong>
            ${escapeHTML(
              analysis.mainPick?.label ||
              "-"
            )}
          </strong>

        </div>
      `
      : `
        <div class="card-recommendation pending">

          <span>
            📊 ANALİZ
          </span>

          <strong>
            Ayrıntılı analiz için aç
          </strong>

        </div>
      `;


  const confidence =
    analysis
      ? `
        <div class="card-confidence">

          <span>
            Model güveni
          </span>

          <strong>
            ${pct(
              analysis.confidence
            )}
          </strong>

        </div>
      `
      : "";


  return `
    <article
      class="match-card"
      onclick="openAnalysis(${Number(id)})"
    >

      <div class="match-card-top">

        <div class="league-info">

          ${
            league.logo
              ? `
                <img
                  src="${escapeHTML(
                    league.logo
                  )}"
                  alt=""
                >
              `
              : "⚽"
          }

          <span>

            ${escapeHTML(
              league.name ||
              "Lig"
            )}

            ${
              league.country
                ? ` • ${escapeHTML(
                    league.country
                  )}`
                : ""
            }

          </span>

        </div>


        <button
          class="favorite-btn ${
            fav
              ? "active"
              : ""
          }"
          onclick="toggleFavorite(
            ${Number(id)},
            event
          )"
          aria-label="Favori"
        >
          ${
            fav
              ? "♥"
              : "♡"
          }
        </button>

      </div>


      <div class="match-time">
        ${escapeHTML(
          statusText
        )}
      </div>


      <div class="teams">

        <div class="team">

          ${
            getLogo(home)
              ? `
                <img
                  src="${escapeHTML(
                    getLogo(home)
                  )}"
                  alt=""
                >
              `
              : `
                <div class="team-placeholder">
                  ⚽
                </div>
              `
          }

          <strong>
            ${escapeHTML(
              getTeamName(home)
            )}
          </strong>

        </div>


        <div class="match-score">

          ${escapeHTML(
            scoreText
          )}

        </div>


        <div class="team">

          ${
            getLogo(away)
              ? `
                <img
                  src="${escapeHTML(
                    getLogo(away)
                  )}"
                  alt=""
                >
              `
              : `
                <div class="team-placeholder">
                  ⚽
                </div>
              `
          }

          <strong>
            ${escapeHTML(
              getTeamName(away)
            )}
          </strong>

        </div>

      </div>


      ${
        analysis
          ? renderCardMarkets(
              analysis
            )
          : ""
      }


      ${recommendation}

      ${confidence}


      <div class="card-footer">

        <span>
          📊 Ayrıntılı analiz
        </span>

        <span>
          →
        </span>

      </div>

    </article>
  `;

}


/* =========================================================
   CARD MARKETS
   ========================================================= */

function renderCardMarkets(
  analysis
) {

  const m =
    analysis.metrics ||
    {};


  return `
    <div class="card-markets">

      <div>
        <span>MS</span>
        <strong>
          ${escapeHTML(
            m.matchResult ||
            "-"
          )}
        </strong>
      </div>

      <div>
        <span>KG</span>
        <strong>
          ${pct(
            m.btts
          )}
        </strong>
      </div>

      <div>
        <span>İY KG</span>
        <strong>
          ${pct(
            m.firstHalfBTTS
          )}
        </strong>
      </div>

      <div>
        <span>2Y KG</span>
        <strong>
          ${pct(
            m.secondHalfBTTS
          )}
        </strong>
      </div>

      <div>
        <span>SKOR</span>
        <strong>
          ${escapeHTML(
            analysis.predictedScore ||
            "-"
          )}
        </strong>
      </div>

    </div>
  `;

}


/* =========================================================
   OPEN ANALYSIS
   ========================================================= */

async function openAnalysis(
  fixtureId
) {

  if (!fixtureId)
    return;


  openDrawerLoading();


  try {

    const key =
      String(fixtureId);


    let analysis =
      state.analyses.get(
        key
      );


    if (!analysis) {

      const data =
        await fetchJSON(
          `/api/match?fixture=${encodeURIComponent(
            fixtureId
          )}`
        );


      analysis =
        buildAnalysis(data);


      state.analyses.set(
        key,
        analysis
      );

    }


    renderAnalysisDrawer(
      analysis
    );


    renderFixtures();

  } catch (error) {

    console.error(
      "R❤️İ ANALYSIS ERROR:",
      error
    );


    drawerEl.innerHTML = `
      <div class="analysis-panel">

        <button
          class="drawer-close"
          onclick="closeDrawer()"
        >
          ×
        </button>

        <div class="loading">

          <p>
            ⚠️ Analiz verileri alınamadı.
          </p>

          <small>
            ${escapeHTML(
              error.message
            )}
          </small>

        </div>

      </div>
    `;

  }

}


/* =========================================================
   DRAWER
   ========================================================= */

function openDrawerLoading() {

  drawerEl.classList.add(
    "open"
  );

  drawerOverlay.classList.add(
    "open"
  );


  drawerEl.innerHTML = `
    <div class="analysis-panel">

      <button
        class="drawer-close"
        onclick="closeDrawer()"
      >
        ×
      </button>

      <div class="loading">

        <div class="spinner"></div>

        <p>
          Maçın tüm verileri analiz ediliyor...
        </p>

        <small>
          Form • H2H • Puan durumu •
          İstatistik • Kadro • Sakatlık •
          Oran • Tahmin
        </small>

      </div>

    </div>
  `;

}


function closeDrawer() {

  drawerEl.classList.remove(
    "open"
  );

  drawerOverlay.classList.remove(
    "open"
  );

}


/* =========================================================
   ANALYSIS ENGINE
   ========================================================= */

function buildAnalysis(
  data
) {

  const fixture =
    data?.fixture ||
    {};

  const teams =
    data?.teams ||
    {};

  const league =
    data?.league ||
    {};

  const goals =
    data?.goals ||
    {};

  const analysisData =
    data?.analysis_data ||
    {};


  const home =
    teams.home ||
    {};

  const away =
    teams.away ||
    {};


  const homeForm =
    analysisData.form?.home ||
    [];

  const awayForm =
    analysisData.form?.away ||
    [];


  const h2h =
    analysisData.h2h ||
    [];


  const standings =
    analysisData.standings ||
    [];


  const homeStats =
    analysisData.team_statistics?.home ||
    [];


  const awayStats =
    analysisData.team_statistics?.away ||
    [];


  const lineups =
    analysisData.lineups ||
    [];


  const injuries =
    analysisData.injuries ||
    [];


  const statistics =
    analysisData.statistics ||
    [];


  const odds =
    analysisData.odds ||
    [];


  const apiPrediction =
    analysisData.api_prediction ||
    [];


  const formHome =
    calculateForm(
      homeForm,
      home.id
    );


  const formAway =
    calculateForm(
      awayForm,
      away.id
    );


  const h2hMetrics =
    calculateH2H(
      h2h,
      home.id,
      away.id
    );


  const standingsMetrics =
    calculateStandings(
      standings,
      home.id,
      away.id
    );


  const teamStatsMetrics =
    calculateTeamStats(
      homeStats,
      awayStats,
      home.id,
      away.id
    );


  const halfMetrics =
    calculateHalfMetrics(
      homeForm,
      awayForm
    );


  const oddsMetrics =
    calculateOdds(
      odds
    );


  const apiMetrics =
    calculateApiPrediction(
      apiPrediction
    );


  const strength =
    calculateStrength({

      formHome,

      formAway,

      h2hMetrics,

      standingsMetrics,

      teamStatsMetrics,

      apiMetrics

    });


  const expectedGoals =
    calculateExpectedGoals({

      formHome,

      formAway,

      teamStatsMetrics,

      strength,

      halfMetrics

    });


  const poisson =
    calculatePoissonMarkets(
      expectedGoals.home,
      expectedGoals.away
    );


  const combined =
    combineMarkets({

      poisson,

      halfMetrics,

      oddsMetrics,

      apiMetrics,

      h2hMetrics,

      formHome,

      formAway

    });


  const predictedScore =
    getPredictedScore(
      expectedGoals.home,
      expectedGoals.away
    );


  const mainPick =
    chooseMainPick({

      combined,

      expectedGoals,

      predictedScore,

      oddsMetrics

    });


  const confidence =
    calculateConfidence({

      mainPick,

      combined,

      formHome,

      formAway,

      h2hMetrics,

      standingsMetrics,

      teamStatsMetrics,

      lineups,

      injuries

    });


  const risk =
    getRisk(
      confidence
    );


  return {

    raw:
      data,

    fixture,

    teams,

    league,

    goals,

    formHome,

    formAway,

    h2hMetrics,

    standingsMetrics,

    teamStatsMetrics,

    halfMetrics,

    oddsMetrics,

    apiMetrics,

    expectedGoals,

    poisson,

    metrics: {

      ...combined,

      firstHalfGoal:
        halfMetrics.firstHalfGoal,

      secondHalfGoal:
        halfMetrics.secondHalfGoal,

      firstHalfBTTS:
        halfMetrics.firstHalfBTTS,

      secondHalfBTTS:
        halfMetrics.secondHalfBTTS,

      bestOdds:
        oddsMetrics.bestOdds

    },

    predictedScore,

    mainPick,

    confidence,

    risk,

    lineups,

    injuries,

    statistics,

    reasons:
      generateReasons({

        formHome,

        formAway,

        h2hMetrics,

        standingsMetrics,

        teamStatsMetrics,

        halfMetrics,

        expectedGoals,

        combined,

        predictedScore,

        lineups,

        injuries

      }),

    dataStatus:
      data?.data_status ||
      {}

  };

}


/* =========================================================
   FORM
   ========================================================= */

function calculateForm(
  matches,
  teamId
) {

  const valid =
    matches
      .filter(
        (m) =>
          m?.teams
      )
      .slice(-10);


  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsFor = 0;
  let goalsAgainst = 0;

  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  let firstHalfGoals = 0;
  let secondHalfGoals = 0;


  valid.forEach(
    (match) => {

      const isHome =
        num(
          match.teams?.home?.id
        ) ===
        num(teamId);


      const gf =
        isHome
          ? num(
              match.goals?.home
            )
          : num(
              match.goals?.away
            );


      const ga =
        isHome
          ? num(
              match.goals?.away
            )
          : num(
              match.goals?.home
            );


      goalsFor +=
        gf;

      goalsAgainst +=
        ga;


      if (gf > ga)
        wins++;

      else if (gf === ga)
        draws++;

      else
        losses++;


      const total =
        gf + ga;


      if (total >= 2)
        over15++;


      if (total >= 3)
        over25++;


      if (
        gf > 0 &&
        ga > 0
      )
        btts++;


      const htHome =
        num(
          match.score?.halftime?.home
        );


      const htAway =
        num(
          match.score?.halftime?.away
        );


      const htFor =
        isHome
          ? htHome
          : htAway;


      const htAgainst =
        isHome
          ? htAway
          : htHome;


      firstHalfGoals +=
        htFor +
        htAgainst;


      const secondFor =
        gf -
        htFor;


      const secondAgainst =
        ga -
        htAgainst;


      secondHalfGoals +=
        Math.max(
          0,
          secondFor
        ) +
        Math.max(
          0,
          secondAgainst
        );

    }
  );


  const n =
    valid.length ||
    1;


  return {

    matches:
      valid.length,

    wins,

    draws,

    losses,

    winRate:
      wins / n * 100,

    drawRate:
      draws / n * 100,

    lossRate:
      losses / n * 100,

    goalsFor,

    goalsAgainst,

    goalsForAvg:
      goalsFor / n,

    goalsAgainstAvg:
      goalsAgainst / n,

    over15:
      over15 / n * 100,

    over25:
      over25 / n * 100,

    btts:
      btts / n * 100,

    firstHalfGoalsAvg:
      firstHalfGoals / n,

    secondHalfGoalsAvg:
      secondHalfGoals / n

  };

}


/* =========================================================
   H2H
   ========================================================= */

function calculateH2H(
  matches,
  homeId,
  awayId
) {

  const valid =
    matches
      .filter(
        (m) =>
          m?.teams
      )
      .slice(-10);


  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  let totalGoals = 0;
  let btts = 0;
  let over25 = 0;


  valid.forEach(
    (m) => {

      const h =
        num(
          m.teams?.home?.id
        );

      const a =
        num(
          m.teams?.away?.id
        );

      const hg =
        num(
          m.goals?.home
        );

      const ag =
        num(
          m.goals?.away
        );


      totalGoals +=
        hg + ag;


      if (
        hg > 0 &&
        ag > 0
      )
        btts++;


      if (
        hg + ag >= 3
      )
        over25++;


      if (
        h ===
        num(homeId)
      ) {

        if (hg > ag)
          homeWins++;

        else if (
          hg === ag
        )
          draws++;

        else
          awayWins++;

      } else {

        if (ag > hg)
          homeWins++;

        else if (
          ag === hg
        )
          draws++;

        else
          awayWins++;

      }

    }
  );


  const n =
    valid.length ||
    1;


  return {

    matches:
      valid.length,

    homeWins,

    draws,

    awayWins,

    homeWinRate:
      homeWins / n * 100,

    drawRate:
      draws / n * 100,

    awayWinRate:
      awayWins / n * 100,

    goalsAvg:
      totalGoals / n,

    btts:
      btts / n * 100,

    over25:
      over25 / n * 100

  };

}


/* =========================================================
   STANDINGS
   ========================================================= */

function calculateStandings(
  rows,
  homeId,
  awayId
) {

  let home = null;
  let away = null;


  for (
    const group
    of rows || []
  ) {

    const tables =
      group?.league?.standings ||
      [];


    for (
      const table
      of tables
    ) {

      for (
        const row
        of table || []
      ) {

        const id =
          num(
            row.team?.id
          );


        if (
          id ===
          num(homeId)
        ) {

          home =
            row;

        }


        if (
          id ===
          num(awayId)
        ) {

          away =
            row;

        }

      }

    }

  }


  return {

    home,

    away,

    homeRank:
      num(
        home?.rank
      ),

    awayRank:
      num(
        away?.rank
      ),

    homePoints:
      num(
        home?.points
      ),

    awayPoints:
      num(
        away?.points
      )

  };

}


/* =========================================================
   TEAM STATS
   ========================================================= */

function calculateTeamStats(
  homeStats,
  awayStats
) {

  return {

    home:
      extractTeamStats(
        homeStats
      ),

    away:
      extractTeamStats(
        awayStats
      )

  };

}


function extractTeamStats(
  rows
) {

  const item =
    Array.isArray(rows)
      ? rows[0]
      : rows;


  if (!item) {

    return {

      matches: 0,

      goalsForAvg: 0,

      goalsAgainstAvg: 0,

      wins: 0,

      draws: 0,

      losses: 0

    };

  }


  const played =
    num(
      item.fixtures?.played?.total
    );


  const goalsFor =
    num(
      item.goals?.for?.total?.total
    );


  const goalsAgainst =
    num(
      item.goals?.against?.total?.total
    );


  return {

    matches:
      played,

    goalsForAvg:
      played
        ? goalsFor / played
        : 0,

    goalsAgainstAvg:
      played
        ? goalsAgainst / played
        : 0,

    wins:
      num(
        item.fixtures?.wins?.total
      ),

    draws:
      num(
        item.fixtures?.draws?.total
      ),

    losses:
      num(
        item.fixtures?.loses?.total
      )

  };

}


/* =========================================================
   HALF METRICS
   ========================================================= */

function calculateHalfMetrics(
  homeForm,
  awayForm
) {

  const firstBase =
    (
      homeForm.firstHalfGoalsAvg +
      awayForm.firstHalfGoalsAvg
    ) / 2;


  const secondBase =
    (
      homeForm.secondHalfGoalsAvg +
      awayForm.secondHalfGoalsAvg
    ) / 2;


  const firstHalfGoal =
    clamp(
      48 +
      firstBase * 16 +
      (
        homeForm.over15 +
        awayForm.over15
      ) * .08
    );


  const secondHalfGoal =
    clamp(
      55 +
      secondBase * 14 +
      (
        homeForm.over25 +
        awayForm.over25
      ) * .07
    );


  const firstHalfBTTS =
    clamp(
      10 +
      Math.min(
        homeForm.firstHalfGoalsAvg,
        2
      ) * 15 +
      Math.min(
        awayForm.firstHalfGoalsAvg,
        2
      ) * 15 +
      (
        homeForm.btts +
        awayForm.btts
      ) * .10
    );


  const secondHalfBTTS =
    clamp(
      15 +
      Math.min(
        homeForm.secondHalfGoalsAvg,
        2
      ) * 15 +
      Math.min(
        awayForm.secondHalfGoalsAvg,
        2
      ) * 15 +
      (
        homeForm.btts +
        awayForm.btts
      ) * .12
    );


  return {

    firstHalfGoal,

    secondHalfGoal,

    firstHalfBTTS,

    secondHalfBTTS

  };

}


/* =========================================================
   ODDS
   ========================================================= */

function calculateOdds(
  oddsData
) {

  let bestOdds =
    0;


  const marketOdds = {

    home: 0,

    draw: 0,

    away: 0,

    bttsYes: 0,

    over25: 0

  };


  (
    Array.isArray(
      oddsData
    )
      ? oddsData
      : []
  ).forEach(
    (group) => {

      (
        group?.bookmakers ||
        []
      ).forEach(
        (bookmaker) => {

          (
            bookmaker?.bets ||
            []
          ).forEach(
            (bet) => {

              (
                bet?.values ||
                []
              ).forEach(
                (value) => {

                  const odd =
                    num(
                      value?.odd
                    );


                  bestOdds =
                    Math.max(
                      bestOdds,
                      odd
                    );


                  const name =
                    String(
                      bet?.name ||
                      ""
                    ).toLowerCase();


                  const valueName =
                    String(
                      value?.value ||
                      ""
                    ).toLowerCase();


                  if (
                    name.includes(
                      "match winner"
                    )
                  ) {

                    if (
                      valueName ===
                      "home"
                    )
                      marketOdds.home =
                        Math.max(
                          marketOdds.home,
                          odd
                        );

                    if (
                      valueName ===
                      "draw"
                    )
                      marketOdds.draw =
                        Math.max(
                          marketOdds.draw,
                          odd
                        );

                    if (
                      valueName ===
                      "away"
                    )
                      marketOdds.away =
                        Math.max(
                          marketOdds.away,
                          odd
                        );

                  }


                  if (
                    name.includes(
                      "both teams"
                    ) &&
                    valueName.includes(
                      "yes"
                    )
                  ) {

                    marketOdds.bttsYes =
                      Math.max(
                        marketOdds.bttsYes,
                        odd
                      );

                  }


                  if (
                    name.includes(
                      "over/under"
                    ) &&
                    valueName.includes(
                      "over 2.5"
                    )
                  ) {

                    marketOdds.over25 =
                      Math.max(
                        marketOdds.over25,
                        odd
                      );

                  }

                }
              );

            }
          );

        }
      );

    }
  );


  return {

    ...marketOdds,

    bestOdds

  };

}


/* =========================================================
   API PREDICTION
   ========================================================= */

function parsePercent(
  value
) {

  if (
    value === null ||
    value === undefined
  )
    return 0;


  const cleaned =
    String(value)
      .replace(
        "%",
        ""
      )
      .replace(
        ",",
        "."
      )
      .trim();


  const n =
    Number(
      cleaned
    );


  return Number.isFinite(n)
    ? n
    : 0;

}


function calculateApiPrediction(
  predictions
) {

  const item =
    predictions?.[0];


  const pred =
    item?.predictions ||
    {};


  return {

    winner:
      pred.winner?.name ||
      pred.winner?.comment ||
      null,

    advice:
      pred.advice ||
      null,

    home:
      parsePercent(
        pred.percent?.home
      ),

    draw:
      parsePercent(
        pred.percent?.draw
      ),

    away:
      parsePercent(
        pred.percent?.away
      ),

    underOver:
      pred.under_over ||
      null,

    goalsHome:
      pred.goals?.home ||
      null,

    goalsAway:
      pred.goals?.away ||
      null

  };

}


/* =========================================================
   STRENGTH
   ========================================================= */

function calculateStrength({
  formHome,
  formAway,
  standingsMetrics,
  h2hMetrics,
  apiMetrics
}) {

  let home =
    formHome.winRate * .55 +
    (
      100 -
      formHome.lossRate
    ) * .25 +
    clamp(
      formHome.goalsForAvg * 25
    ) * .20;


  let away =
    formAway.winRate * .55 +
    (
      100 -
      formAway.lossRate
    ) * .25 +
    clamp(
      formAway.goalsForAvg * 25
    ) * .20;


  if (
    standingsMetrics.homeRank &&
    standingsMetrics.awayRank
  ) {

    if (
      standingsMetrics.homeRank <
      standingsMetrics.awayRank
    )
      home += 7;

    else if (
      standingsMetrics.awayRank <
      standingsMetrics.homeRank
    )
      away += 7;

  }


  if (
    h2hMetrics.matches >= 5
  ) {

    home +=
      h2hMetrics.homeWinRate *
      .08;

    away +=
      h2hMetrics.awayWinRate *
      .08;

  }


  if (
    apiMetrics.home > 0
  )
    home +=
      apiMetrics.home *
      .15;


  if (
    apiMetrics.away > 0
  )
    away +=
      apiMetrics.away *
      .15;


  return {

    home:
      clamp(home),

    away:
      clamp(away)

  };

}


/* =========================================================
   EXPECTED GOALS
   ========================================================= */

function calculateExpectedGoals({
  formHome,
  formAway,
  teamStatsMetrics,
  halfMetrics
}) {

  let homeAttack =
    formHome.goalsForAvg;


  let awayAttack =
    formAway.goalsForAvg;


  let homeDefense =
    formHome.goalsAgainstAvg;


  let awayDefense =
    formAway.goalsAgainstAvg;


  if (
    teamStatsMetrics.home.goalsForAvg
  ) {

    homeAttack =
      homeAttack * .65 +
      teamStatsMetrics.home.goalsForAvg * .35;

  }


  if (
    teamStatsMetrics.away.goalsForAvg
  ) {

    awayAttack =
      awayAttack * .65 +
      teamStatsMetrics.away.goalsForAvg * .35;

  }


  if (
    teamStatsMetrics.home.goalsAgainstAvg
  ) {

    homeDefense =
      homeDefense * .65 +
      teamStatsMetrics.home.goalsAgainstAvg * .35;

  }


  if (
    teamStatsMetrics.away.goalsAgainstAvg
  ) {

    awayDefense =
      awayDefense * .65 +
      teamStatsMetrics.away.goalsAgainstAvg * .35;

  }


  let homeXG =
    homeAttack * .62 +
    awayDefense * .38;


  let awayXG =
    awayAttack * .62 +
    homeDefense * .38;


  homeXG += .15;


  if (
    halfMetrics.firstHalfGoal >= 78
  ) {

    homeXG += .05;
    awayXG += .05;

  }


  return {

    home:
      clamp(
        homeXG,
        .15,
        3.6
      ),

    away:
      clamp(
        awayXG,
        .10,
        3.4
      ),

    total:
      clamp(
        homeXG +
        awayXG,
        .3,
        6.5
      )

  };

}


/* =========================================================
   POISSON
   ========================================================= */

function poissonProbability(
  lambda,
  k
) {

  if (
    lambda <= 0
  )
    return k === 0
      ? 1
      : 0;


  let factorial =
    1;


  for (
    let i = 2;
    i <= k;
    i++
  ) {

    factorial *=
      i;

  }


  return (
    Math.exp(
      -lambda
    ) *
    Math.pow(
      lambda,
      k
    ) /
    factorial
  );

}


function calculatePoissonMarkets(
  homeXG,
  awayXG
) {

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  let btts = 0;


  for (
    let h = 0;
    h <= 8;
    h++
  ) {

    for (
      let a = 0;
      a <= 8;
      a++
    ) {

      const p =
        poissonProbability(
          homeXG,
          h
        ) *
        poissonProbability(
          awayXG,
          a
        );


      if (h > a)
        homeWin += p;

      else if (
        h === a
      )
        draw += p;

      else
        awayWin += p;


      const total =
        h + a;


      if (
        total >= 2
      )
        over15 += p;


      if (
        total >= 3
      )
        over25 += p;


      if (
        total >= 4
      )
        over35 += p;


      if (
        h > 0 &&
        a > 0
      )
        btts += p;

    }

  }


  return {

    homeWin:
      homeWin * 100,

    draw:
      draw * 100,

    awayWin:
      awayWin * 100,

    over15:
      over15 * 100,

    over25:
      over25 * 100,

    over35:
      over35 * 100,

    under15:
      (1 - over15) * 100,

    under25:
      (1 - over25) * 100,

    under35:
      (1 - over35) * 100,

    btts:
      btts * 100,

    noBtts:
      (1 - btts) * 100

  };

}


/* =========================================================
   COMBINE
   ========================================================= */

function combineMarkets({
  poisson,
  halfMetrics,
  apiMetrics,
  h2hMetrics,
  formHome,
  formAway,
  oddsMetrics
}) {

  let homeWin =
    poisson.homeWin;

  let draw =
    poisson.draw;

  let awayWin =
    poisson.awayWin;


  if (
    apiMetrics.home ||
    apiMetrics.away
  ) {

    homeWin =
      homeWin * .72 +
      apiMetrics.home * .28;

    awayWin =
      awayWin * .72 +
      apiMetrics.away * .28;

    if (
      apiMetrics.draw
    ) {

      draw =
        draw * .72 +
        apiMetrics.draw * .28;

    }

  }


  if (
    h2hMetrics.matches >= 5
  ) {

    homeWin =
      homeWin * .92 +
      h2hMetrics.homeWinRate * .08;

    awayWin =
      awayWin * .92 +
      h2hMetrics.awayWinRate * .08;

  }


  const total =
    homeWin +
    draw +
    awayWin;


  homeWin =
    homeWin /
    total *
    100;

  draw =
    draw /
    total *
    100;

  awayWin =
    awayWin /
    total *
    100;


  const formBTTS =
    (
      formHome.btts +
      formAway.btts
    ) / 2;


  let btts =
    poisson.btts * .78 +
    formBTTS * .22;


  if (
    h2hMetrics.matches >= 5
  ) {

    btts =
      btts * .92 +
      h2hMetrics.btts * .08;

  }


  const iy2yBTTS =
    clamp(
      Math.min(
        halfMetrics.firstHalfBTTS,
        halfMetrics.secondHalfBTTS
      ) * .88
    );


  const bothHalvesGoal =
    clamp(
      Math.min(
        halfMetrics.firstHalfGoal,
        halfMetrics.secondHalfGoal
      ) * .96
    );


  const longshotProbability =
    Math.max(
      homeWin,
      awayWin,
      btts,
      halfMetrics.firstHalfBTTS,
      halfMetrics.secondHalfBTTS
    );


  let matchResult =
    "X";


  if (
    homeWin >= awayWin &&
    homeWin >= draw
  )
    matchResult =
      "1";

  else if (
    awayWin >= homeWin &&
    awayWin >= draw
  )
    matchResult =
      "2";


  return {

    homeWin,

    draw,

    awayWin,

    matchResult,

    btts,

    noBtts:
      100 - btts,

    over15:
      poisson.over15,

    over25:
      poisson.over25,

    over35:
      poisson.over35,

    under25:
      poisson.under25,

    under35:
      poisson.under35,

    firstHalfGoal:
      halfMetrics.firstHalfGoal,

    secondHalfGoal:
      halfMetrics.secondHalfGoal,

    firstHalfBTTS:
      halfMetrics.firstHalfBTTS,

    secondHalfBTTS:
      halfMetrics.secondHalfBTTS,

    iy2yBTTS,

    bothHalvesGoal,

    longshotProbability,

    bestOdds:
      oddsMetrics.bestOdds

  };

}


/* =========================================================
   SCORE
   ========================================================= */

function getPredictedScore(
  homeXG,
  awayXG
) {

  return `
    ${Math.max(
      0,
      Math.min(
        6,
        Math.round(
          homeXG
        )
      )
    )}
    -
    ${Math.max(
      0,
      Math.min(
        6,
        Math.round(
          awayXG
        )
      )
    )}
  `.replace(
    /\s+/g,
    ""
  );

}


/* =========================================================
   MAIN PICK
   ========================================================= */

function chooseMainPick({
  combined,
  expectedGoals
}) {

  const candidates = [];


  if (
    combined.homeWin >= 63
  ) {

    candidates.push({

      label:
        "MS 1",

      probability:
        combined.homeWin,

      score:
        combined.homeWin,

      reason:
        "Model ev sahibi galibiyet olasılığını güçlü buluyor."

    });

  }


  if (
    combined.awayWin >= 63
  ) {

    candidates.push({

      label:
        "MS 2",

      probability:
        combined.awayWin,

      score:
        combined.awayWin,

      reason:
        "Model deplasman galibiyet olasılığını güçlü buluyor."

    });

  }


  if (
    combined.btts >= 64
  ) {

    candidates.push({

      label:
        "KG VAR",

      probability:
        combined.btts,

      score:
        combined.btts + 1,

      reason:
        "İki takımın da gol bulma ihtimali yüksek."

    });

  }


  if (
    combined.noBtts >= 68
  ) {

    candidates.push({

      label:
        "KG YOK",

      probability:
        combined.noBtts,

      score:
        combined.noBtts,

      reason:
        "Karşılıklı gol ihtimali sınırlı görünüyor."

    });

  }


  if (
    combined.over25 >= 66
  ) {

    candidates.push({

      label:
        "2.5 ÜST",

      probability:
        combined.over25,

      score:
        combined.over25,

      reason:
        "Model toplam gol beklentisini yüksek buluyor."

    });

  }


  if (
    combined.firstHalfBTTS >= 55
  ) {

    candidates.push({

      label:
        "İY KG VAR",

      probability:
        combined.firstHalfBTTS,

      score:
        combined.firstHalfBTTS + 2,

      reason:
        "İlk yarıda karşılıklı gol sinyali güçlü."

    });

  }


  if (
    combined.secondHalfBTTS >= 58
  ) {

    candidates.push({

      label:
        "2Y KG VAR",

      probability:
        combined.secondHalfBTTS,

      score:
        combined.secondHalfBTTS + 3,

      reason:
        "İkinci yarıda karşılıklı gol sinyali güçlü."

    });

  }


  if (
    combined.iy2yBTTS >= 48
  ) {

    candidates.push({

      label:
        "İY KG + 2Y KG",

      probability:
        combined.iy2yBTTS,

      score:
        combined.iy2yBTTS + 4,

      reason:
        "İki yarıda da karşılıklı gol senaryosu destekleniyor."

    });

  }


  if (
    combined.bothHalvesGoal >= 78
  ) {

    candidates.push({

      label:
        "İki Yarıda Gol",

      probability:
        combined.bothHalvesGoal,

      score:
        combined.bothHalvesGoal - 2,

      reason:
        "Her iki yarıda da gol görülme ihtimali yüksek."

    });

  }


  if (
    combined.over15 >= 82 &&
    expectedGoals.total >= 2.15
  ) {

    candidates.push({

      label:
        "1.5 ÜST",

      probability:
        combined.over15,

      score:
        combined.over15 - 8,

      reason:
        "Toplam gol için güçlü istatistiksel temel var."

    });

  }


  if (!candidates.length) {

    return {

      label:
        "Güçlü seçim yok",

      probability:
        Math.max(
          combined.homeWin,
          combined.draw,
          combined.awayWin,
          combined.btts,
          combined.over25
        ),

      reason:
        "Model mevcut verilerle yeterli güven seviyesine ulaşmadı."

    };

  }


  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );


  const best =
    candidates[0];


  return {

    label:
      best.label,

    probability:
      best.probability,

    reason:
      best.reason

  };

}


/* =========================================================
   CONFIDENCE
   ========================================================= */

function calculateConfidence({
  mainPick,
  formHome,
  formAway,
  h2hMetrics,
  standingsMetrics,
  teamStatsMetrics,
  lineups,
  injuries
}) {

  let confidence =
    num(
      mainPick.probability
    );


  let quality =
    0;


  if (
    formHome.matches >= 5
  )
    quality += 8;


  if (
    formAway.matches >= 5
  )
    quality += 8;


  if (
    h2hMetrics.matches >= 5
  )
    quality += 5;


  if (
    standingsMetrics.home ||
    standingsMetrics.away
  )
    quality += 5;


  if (
    teamStatsMetrics.home.matches ||
    teamStatsMetrics.away.matches
  )
    quality += 5;


  if (
    lineups.length
  )
    quality += 3;


  if (
    injuries.length
  )
    quality += 2;


  confidence =
    confidence * .84 +
    Math.min(
      quality,
      36
    ) * .16;


  return clamp(
    confidence,
    35,
    94
  );

}


/* =========================================================
   RISK
   ========================================================= */

function getRisk(
  confidence
) {

  if (
    confidence >= 70
  ) {

    return {
      label:
        "Güvenilir",
      className:
        "low"
    };

  }


  if (
    confidence >= 60
  ) {

    return {
      label:
        "Orta Risk",
      className:
        "medium"
    };

  }


  if (
    confidence >= 50
  ) {

    return {
      label:
        "Riskli",
      className:
        "risky"
    };

  }


  return {

    label:
      "Yüksek Risk",

    className:
      "high"

  };

}


/* =========================================================
   REASONS
   ========================================================= */

function generateReasons({
  formHome,
  formAway,
  h2hMetrics,
  standingsMetrics,
  halfMetrics,
  expectedGoals,
  combined,
  predictedScore,
  lineups,
  injuries
}) {

  const reasons = [];


  if (
    formHome.matches >= 5 &&
    formAway.matches >= 5
  ) {

    reasons.push(
      `Son ${Math.min(
        formHome.matches,
        formAway.matches
      )} maç formu modele dahil edildi.`
    );

  }


  if (
    formHome.goalsForAvg >
    formAway.goalsForAvg
  ) {

    reasons.push(
      `Ev sahibi ${formHome.goalsForAvg.toFixed(
        2
      )} gol/maç üretiyor.`
    );

  } else {

    reasons.push(
      `Deplasman ${formAway.goalsForAvg.toFixed(
        2
      )} gol/maç üretiyor.`
    );

  }


  if (
    combined.btts >= 65
  ) {

    reasons.push(
      `KG model olasılığı ${pct(
        combined.btts
      )}.`
    );

  }


  if (
    combined.over25 >= 65
  ) {

    reasons.push(
      `2.5 ÜST model olasılığı ${pct(
        combined.over25
      )}.`
    );

  }


  if (
    halfMetrics.firstHalfGoal >= 72
  ) {

    reasons.push(
      `İlk yarıda gol beklentisi ${pct(
        halfMetrics.firstHalfGoal
      )}.`
    );

  }


  if (
    halfMetrics.secondHalfGoal >= 75
  ) {

    reasons.push(
      `İkinci yarıda gol beklentisi ${pct(
        halfMetrics.secondHalfGoal
      )}.`
    );

  }


  if (
    h2hMetrics.matches >= 5
  ) {

    reasons.push(
      `${h2hMetrics.matches} H2H karşılaşması değerlendirildi.`
    );

  }


  if (
    standingsMetrics.homeRank &&
    standingsMetrics.awayRank
  ) {

    reasons.push(
      `Lig sıralaması: ${standingsMetrics.homeRank}. vs ${standingsMetrics.awayRank}.`
    );

  }


  if (
    lineups.length
  ) {

    reasons.push(
      "Mevcut kadro verisi kontrol edildi."
    );

  }


  if (
    injuries.length
  ) {

    reasons.push(
      `${injuries.length} eksik/sakatlık kaydı kontrol edildi.`
    );

  }


  reasons.push(
    `Tahmini skor: ${predictedScore}.`
  );


  return reasons.slice(
    0,
    8
  );

}


/* =========================================================
   ANALYSIS DRAWER RENDER
   ========================================================= */

function renderAnalysisDrawer(
  a
) {

  drawerEl.classList.add(
    "open"
  );

  drawerOverlay.classList.add(
    "open"
  );


  const home =
    a.teams?.home ||
    {};

  const away =
    a.teams?.away ||
    {};


  const m =
    a.metrics ||
    {};


  drawerEl.innerHTML = `

    <div class="analysis-panel">

      <button
        class="drawer-close"
        onclick="closeDrawer()"
      >
        ×
      </button>


      <div class="analysis-header">

        <div class="analysis-league">

          ${escapeHTML(
            a.league?.name ||
            "Maç Analizi"
          )}

        </div>


        <div class="analysis-teams">

          <div>

            ${
              home.logo
                ? `
                  <img
                    src="${escapeHTML(
                      home.logo
                    )}"
                    alt=""
                  >
                `
                : "⚽"
            }

            <strong>
              ${escapeHTML(
                getTeamName(home)
              )}
            </strong>

          </div>


          <span>
            VS
          </span>


          <div>

            ${
              away.logo
                ? `
                  <img
                    src="${escapeHTML(
                      away.logo
                    )}"
                    alt=""
                  >
                `
                : "⚽"
            }

            <strong>
              ${escapeHTML(
                getTeamName(away)
              )}
            </strong>

          </div>

        </div>


        <div class="analysis-date">

          ${escapeHTML(
            formatDate(
              a.fixture?.date
            )
          )}

        </div>

      </div>


      <div class="strongest-selection">

        <div class="selection-label">
          🎯 ŞUNU OYNA
        </div>

        <div class="selection-main">

          ${escapeHTML(
            a.mainPick?.label ||
            "-"
          )}

        </div>

        <div class="selection-reason">

          ${escapeHTML(
            a.mainPick?.reason ||
            ""
          )}

        </div>


        <div class="confidence-row">

          <span>
            Model güveni
          </span>

          <strong>
            ${pct(
              a.confidence
            )}
          </strong>

        </div>


        <div class="confidence-bar">

          <span
            style="width:${clamp(
              a.confidence
            )}%"
          ></span>

        </div>


        <div class="risk ${
          escapeHTML(
            a.risk?.className ||
            ""
          )
        }">

          ${escapeHTML(
            a.risk?.label ||
            ""
          )}

        </div>

      </div>


      ${renderExpectedGoals(a)}

      ${renderResultMarkets(a)}

      ${renderGoalMarkets(a)}

      ${renderHalfMarkets(a)}

      ${renderScoreBox(a)}

      ${renderFormSection(a)}

      ${renderH2HSection(a)}

      ${renderStandingsSection(a)}

      ${renderTeamStatsSection(a)}

      ${renderSquadSection(a)}

      ${renderReasonsSection(a)}

      ${renderDataStatus(a)}


      <div class="analysis-warning">

        ⚠️ Model çıktıları istatistiksel tahmindir;
        garanti değildir.

      </div>

    </div>

  `;

}


/* =========================================================
   EXPECTED GOALS
   ========================================================= */

function renderExpectedGoals(
  a
) {

  return `

    <section class="analysis-section">

      <div class="section-title">
        ⚽ Beklenen Goller
      </div>


      <div class="expected-goals">

        <div>

          <span>
            ${escapeHTML(
              getTeamName(
                a.teams?.home
              )
            )}
          </span>

          <strong>
            ${num(
              a.expectedGoals?.home
            ).toFixed(2)}
          </strong>

        </div>


        <div>

          <span>
            Toplam
          </span>

          <strong>
            ${num(
              a.expectedGoals?.total
            ).toFixed(2)}
          </strong>

        </div>


        <div>

          <span>
            ${escapeHTML(
              getTeamName(
                a.teams?.away
              )
            )}
          </span>

          <strong>
            ${num(
              a.expectedGoals?.away
            ).toFixed(2)}
          </strong>

        </div>

      </div>

    </section>

  `;

}


/* =========================================================
   RESULT
   ========================================================= */

function renderResultMarkets(
  a
) {

  const m =
    a.metrics ||
    {};


  return `

    <section class="analysis-section">

      <div class="section-title">
        🏆 Maç Sonucu
      </div>


      <div class="market-grid">

        ${marketBox(
          "MS 1",
          m.homeWin
        )}

        ${marketBox(
          "X",
          m.draw
        )}

        ${marketBox(
          "MS 2",
          m.awayWin
        )}

      </div>

    </section>

  `;

}


/* =========================================================
   GOALS
   ========================================================= */

function renderGoalMarkets(
  a
) {

  const m =
    a.metrics ||
    {};


  return `

    <section class="analysis-section">

      <div class="section-title">
        ⚽ Gol Piyasaları
      </div>


      <div class="market-grid">

        ${marketBox(
          "KG VAR",
          m.btts
        )}

        ${marketBox(
          "KG YOK",
          m.noBtts
        )}

        ${marketBox(
          "1.5 ÜST",
          m.over15
        )}

        ${marketBox(
          "2.5 ÜST",
          m.over25
        )}

        ${marketBox(
          "3.5 ÜST",
          m.over35
        )}

        ${marketBox(
          "2.5 ALT",
          m.under25
        )}

      </div>

    </section>

  `;

}


/* =========================================================
   HALF
   ========================================================= */

function renderHalfMarkets(
  a
) {

  const m =
    a.metrics ||
    {};


  return `

    <section class="analysis-section">

      <div class="section-title">
        ⚡ İY / 2Y KG Analizi
      </div>


      <div class="market-grid">

        ${marketBox(
          "İY KG VAR",
          m.firstHalfBTTS
        )}

        ${marketBox(
          "2Y KG VAR",
          m.secondHalfBTTS
        )}

        ${marketBox(
          "İY KG + 2Y KG",
          m.iy2yBTTS
        )}

        ${marketBox(
          "1. YARIDA GOL",
          m.firstHalfGoal
        )}

        ${marketBox(
          "2. YARIDA GOL",
          m.secondHalfGoal
        )}

        ${marketBox(
          "İKİ YARIDA GOL",
          m.bothHalvesGoal
        )}

      </div>

    </section>

  `;

}


/* =========================================================
   MARKET BOX
   ========================================================= */

function marketBox(
  label,
  value
) {

  const v =
    clamp(value);


  let cls =
    "market-low";


  if (
    v >= 70
  )
    cls =
      "market-high";

  else if (
    v >= 60
  )
    cls =
      "market-medium";

  else if (
    v >= 50
  )
    cls =
      "market-risk";


  return `

    <div class="market-box ${cls}">

      <span>
        ${escapeHTML(
          label
        )}
      </span>

      <strong>
        ${pct(v)}
      </strong>

    </div>

  `;

}


/* =========================================================
   SCORE
   ========================================================= */

function renderScoreBox(
  a
) {

  return `

    <section class="analysis-section">

      <div class="section-title">
        🎯 Tahmini Skor
      </div>


      <div class="score-box">

        <strong>
          ${escapeHTML(
            a.predictedScore ||
            "-"
          )}
        </strong>

        <span>
          Modelin en olası skor senaryosu
        </span>

      </div>

    </section>

  `;

}


/* =========================================================
   FORM
   ========================================================= */

function renderFormSection(
  a
) {

  return `

    <section class="analysis-section">

      <div class="section-title">
        📊 Son Form
      </div>


      <div class="form-comparison">

        ${formTeamHTML(
          a.teams?.home,
          a.formHome
        )}

        ${formTeamHTML(
          a.teams?.away,
          a.formAway
        )}

      </div>

    </section>

  `;

}


function formTeamHTML(
  team,
  f
) {

  f =
    f ||
    {};


  return `

    <div class="form-team">

      <strong>
        ${escapeHTML(
          getTeamName(team)
        )}
      </strong>


      <div class="form-numbers">

        <span>
          G ${num(f.wins)}
        </span>

        <span>
          B ${num(f.draws)}
        </span>

        <span>
          M ${num(f.losses)}
        </span>

      </div>


      <small>

        ${num(
          f.goalsForAvg
        ).toFixed(2)}
        gol/maç atıyor /

        ${num(
          f.goalsAgainstAvg
        ).toFixed(2)}
        gol/maç yiyor.

      </small>


      <small>

        KG ${pct(
          f.btts
        )}

        • 2.5 ÜST ${pct(
          f.over25
        )}

      </small>

    </div>

  `;

}


/* =========================================================
   H2H
   ========================================================= */

function renderH2HSection(
  a
) {

  const h =
    a.h2hMetrics ||
    {};


  return `

    <section class="analysis-section">

      <div class="section-title">
        🤝 H2H
      </div>


      <div class="analysis-text">

        <p>

          Son ${num(
            h.matches
          )} karşılaşma:

          ${num(
            h.homeWins
          )} ev sahibi galibiyeti,

          ${num(
            h.draws
          )} beraberlik,

          ${num(
            h.awayWins
          )} deplasman galibiyeti.

        </p>


        <p>

          KG:
          ${pct(h.btts)}

          •

          2.5 ÜST:
          ${pct(h.over25)}

          •

          Ortalama gol:
          ${num(
            h.goalsAvg
          ).toFixed(2)}

        </p>

      </div>

    </section>

  `;

}


/* =========================================================
   STANDINGS
   ========================================================= */

function renderStandingsSection(
  a
) {

  const s =
    a.standingsMetrics ||
    {};


  if (
    !s.homeRank &&
    !s.awayRank
  )
    return "";


  return `

    <section class="analysis-section">

      <div class="section-title">
        🏆 Lig Sıralaması
      </div>


      <div class="market-grid">

        ${marketBox(
          getTeamName(
            a.teams?.home
          ),
          s.homeRank
            ? `${s.homeRank}.`
            : "-"
        )}


        ${marketBox(
          getTeamName(
            a.teams?.away
          ),
          s.awayRank
            ? `${s.awayRank}.`
            : "-"
        )}

      </div>

    </section>

  `;

}


/* =========================================================
   TEAM STATS
   ========================================================= */

function renderTeamStatsSection(
  a
) {

  const h =
    a.teamStatsMetrics?.home ||
    {};

  const aw =
    a.teamStatsMetrics?.away ||
    {};


  return `

    <section class="analysis-section">

      <div class="section-title">
        📈 Takım İstatistikleri
      </div>


      <div class="analysis-text">

        <p>

          <strong>
            ${escapeHTML(
              getTeamName(
                a.teams?.home
              )
            )}
          </strong>:

          ${num(
            h.goalsForAvg
          ).toFixed(2)}
          gol/maç,

          ${num(
            h.goalsAgainstAvg
          ).toFixed(2)}
          gol yiyor.

        </p>


        <p>

          <strong>
            ${escapeHTML(
              getTeamName(
                a.teams?.away
              )
            )}
          </strong>:

          ${num(
            aw.goalsForAvg
          ).toFixed(2)}
          gol/maç,

          ${num(
            aw.goalsAgainstAvg
          ).toFixed(2)}
          gol yiyor.

        </p>

      </div>

    </section>

  `;

}


/* =========================================================
   SQUAD
   ========================================================= */

function renderSquadSection(
  a
) {

  return `

    <section class="analysis-section">

      <div class="section-title">
        👥 Kadro / Eksikler
      </div>


      <div class="analysis-text">

        <p>

          Kadro verisi:

          <strong>
            ${
              a.lineups?.length
                ? "Mevcut"
                : "Sınırlı / yok"
            }
          </strong>

        </p>


        <p>

          Sakatlık / eksik kaydı:

          <strong>
            ${a.injuries?.length || 0}
          </strong>

        </p>

      </div>

    </section>

  `;

}


/* =========================================================
   REASONS
   ========================================================= */

function renderReasonsSection(
  a
) {

  return `

    <section class="analysis-section">

      <div class="section-title">
        🧠 Analiz Gerekçeleri
      </div>


      <div class="analysis-text">

        ${
          a.reasons?.length
            ? `
              <ul>

                ${a.reasons
                  .map(
                    (reason) =>
                      `
                        <li>
                          ${escapeHTML(
                            reason
                          )}
                        </li>
                      `
                  )
                  .join("")}

              </ul>
            `
            : `
              <p>
                Yeterli açıklama üretilemedi.
              </p>
            `
        }

      </div>

    </section>

  `;

}


/* =========================================================
   DATA STATUS
   ========================================================= */

function renderDataStatus(
  a
) {

  const s =
    a.dataStatus ||
    {};


  const items = [

    [
      "Maç",
      s.fixture
    ],

    [
      "Ev sahibi form",
      s.home_form
    ],

    [
      "Deplasman form",
      s.away_form
    ],

    [
      "H2H",
      s.h2h
    ],

    [
      "Puan durumu",
      s.standings
    ],

    [
      "Ev sahibi istatistik",
      s.home_statistics
    ],

    [
      "Deplasman istatistik",
      s.away_statistics
    ],

    [
      "Kadro",
      s.lineups
    ],

    [
      "Sakatlık",
      s.injuries
    ],

    [
      "Maç istatistikleri",
      s.statistics
    ],

    [
      "Oranlar",
      s.odds
    ],

    [
      "API prediction",
      s.predictions
    ]

  ];


  return `

    <section class="analysis-section">

      <div class="section-title">
        🔌 Veri Durumu
      </div>


      <div class="data-status-grid">

        ${items
          .map(
            ([label, ok]) =>
              `
                <div class="data-status-item">

                  <span>
                    ${escapeHTML(
                      label
                    )}
                  </span>

                  <strong>
                    ${ok
                      ? "✓"
                      : "—"}
                  </strong>

                </div>
              `
          )
          .join("")}

      </div>

    </section>

  `;

}


/* =========================================================
   SEARCH EVENTS
   ========================================================= */

if (searchInput) {

  searchInput.addEventListener(
    "input",
    (event) => {

      state.search =
        String(
          event.target.value ||
          ""
        ).trim();


      if (
        state.search
      ) {

        state.currentFilter =
          "search";

        state.selectedLeague =
          null;


        document
          .querySelectorAll(
            ".menu-item"
          )
          .forEach(
            (button) => {

              button.classList.toggle(
                "active",
                button.dataset.filter ===
                  "search"
              );

            }
          );


        document
          .querySelectorAll(
            ".league-menu-item"
          )
          .forEach(
            (button) => {

              button.classList.remove(
                "active"
              );

            }
          );


        sectionTitleEl.textContent =
          "Maç Ara";


        clearSearch.style.display =
          "block";

      } else {

        clearSearch.style.display =
          "none";

      }


      renderFixtures();

    }
  );

}


/* =========================================================
   CLEAR SEARCH
   ========================================================= */

if (clearSearch) {

  clearSearch.addEventListener(
    "click",
    () => {

      searchInput.value =
        "";

      state.search =
        "";

      state.currentFilter =
        "all";

      state.selectedLeague =
        null;


      document
        .querySelectorAll(
          ".menu-item"
        )
        .forEach(
          (button) => {

            button.classList.toggle(
              "active",
              button.dataset.filter ===
                "all"
            );

          }
        );


      document
        .querySelectorAll(
          ".league-menu-item"
        )
        .forEach(
          (button) => {

            button.classList.remove(
              "active"
            );

          }
        );


      sectionTitleEl.textContent =
        "Bugünün Maçları";


      clearSearch.style.display =
        "none";


      renderFixtures();

    }
  );

}


/* =========================================================
   MENU EVENTS
   ========================================================= */

document
  .querySelectorAll(
    ".menu-item"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          applyFilter(
            button.dataset.filter
          );

          closeMobileMenu();

        }
      );

    }
  );


/* =========================================================
   HAMBURGER
   ========================================================= */

function openMobileMenu() {

  sidebar.classList.add(
    "mobile-open"
  );

  mobileOverlay.classList.add(
    "active"
  );

  hamburger.classList.add(
    "active"
  );

}


function closeMobileMenu() {

  sidebar.classList.remove(
    "mobile-open"
  );

  mobileOverlay.classList.remove(
    "active"
  );

  hamburger.classList.remove(
    "active"
  );

}


if (hamburger) {

  hamburger.addEventListener(
    "click",
    () => {

      if (
        sidebar.classList.contains(
          "mobile-open"
        )
      ) {

        closeMobileMenu();

      } else {

        openMobileMenu();

      }

    }
  );

}


if (mobileOverlay) {

  mobileOverlay.addEventListener(
    "click",
    closeMobileMenu
  );

}


/* =========================================================
   DRAWER EVENTS
   ========================================================= */

if (drawerOverlay) {

  drawerOverlay.addEventListener(
    "click",
    closeDrawer
  );

}


document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Escape"
    ) {

      closeDrawer();

      closeMobileMenu();

    }

  }
);


/* =========================================================
   REFRESH
   ========================================================= */

if (refreshBtn) {

  refreshBtn.addEventListener(
    "click",
    () => {

      state.analyses.clear();

      loadFixtures();

    }
  );

}


/* =========================================================
   GLOBAL
   ========================================================= */

window.loadFixtures =
  loadFixtures;

window.openAnalysis =
  openAnalysis;

window.closeDrawer =
  closeDrawer;

window.toggleFavorite =
  toggleFavorite;

window.applyFilter =
  applyFilter;


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      loadFixtures();

    },
    {
      once: true
    }
  );

} else {

  loadFixtures();

}
