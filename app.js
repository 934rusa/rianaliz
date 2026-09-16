/* =========================================================
   R❤️İ FOOTBALL — FUTBOL ANALİZ MERKEZİ
   app.js
   VERSION 3.1.0
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const RI_CONFIG = {
  API_URL: "/api/fixtures",
  MATCH_API_URL: "/api/match",
  AI_API_URL: "/api/ai",

  REQUEST_TIMEOUT: 15000,

  /* Tarayıcı cache süresi */
  FIXTURE_CACHE_TIME: 10 * 60 * 1000,

  /* Maç analiz cache süresi */
  ANALYSIS_CACHE_TIME: 30 * 60 * 1000,

  APP_NAME: "R❤️İ Football",
  VERSION: "3.1.0"
};


/* =========================================================
   STATE
   ========================================================= */

const state = {

  fixtures: [],
  filteredFixtures: [],

  selectedDate: "",
  selectedLeague: "all",
  selectedFilter: "all",

  searchQuery: "",

  favorites: loadFavorites(),

  loading: false,
  loadingMessage: "",

  requestId: 0,

  selectedFixture: null,

  apiInfo: null,

  analysisCache: {},

  fixtureCache: {},

  lastError: null

};


/* =========================================================
   DOM
   ========================================================= */

let matchesGrid = null;
let loadingElement = null;
let searchInput = null;
let dateInput = null;
let leagueMenu = null;
let filterMenu = null;
let favoriteCount = null;
let emptyState = null;


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


function init() {

  try {

    findElements();

    setupDate();

    setupEvents();

    updateFavoriteCount();

    loadFixtures();

  } catch (error) {

    console.error(
      "[R❤️İ] Başlatma hatası:",
      error
    );

    showApiError(
      error.message ||
      "Site başlatılırken hata oluştu.",
      state.selectedDate
    );

  }

}


/* =========================================================
   DOM FINDER
   ========================================================= */

function findElements() {

  matchesGrid =
    document.querySelector("#matchesGrid") ||
    document.querySelector(".matches-grid") ||
    document.querySelector("#matches") ||
    document.querySelector(".matches") ||
    document.querySelector("#fixtureList") ||
    document.querySelector(".fixture-list");

  searchInput =
    document.querySelector("#searchInput") ||
    document.querySelector("#matchSearch") ||
    document.querySelector('input[type="search"]');

  dateInput =
    document.querySelector("#dateInput") ||
    document.querySelector("#matchDate") ||
    document.querySelector('input[type="date"]');

  leagueMenu =
    document.querySelector("#leagueMenu") ||
    document.querySelector("#leagues") ||
    document.querySelector(".league-menu");

  filterMenu =
    document.querySelector("#filterMenu") ||
    document.querySelector("#filters") ||
    document.querySelector(".filter-menu");

  favoriteCount =
    document.querySelector("#favoriteCount") ||
    document.querySelector(".favorite-count");

}


/* =========================================================
   DATE
   ========================================================= */

function getTodayIstanbul() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Istanbul"
    }
  ).format(new Date());

}


function setupDate() {

  const today =
    getTodayIstanbul();

  if (!dateInput) {

    state.selectedDate =
      today;

    return;

  }

  if (!dateInput.value) {

    dateInput.value =
      today;

  }

  state.selectedDate =
    dateInput.value ||
    today;

}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

  if (dateInput) {

    dateInput.addEventListener(
      "change",
      () => {

        state.selectedDate =
          dateInput.value ||
          getTodayIstanbul();

        state.selectedLeague =
          "all";

        state.selectedFilter =
          "all";

        loadFixtures();

      }
    );

  }


  if (searchInput) {

    searchInput.addEventListener(
      "input",
      () => {

        state.searchQuery =
          searchInput.value
            .trim()
            .toLowerCase();

        applyFilters();

      }
    );

  }


  document.addEventListener(
    "click",
    event => {

      const matchCard =
        event.target.closest(
          "[data-fixture-id]"
        );

      /*
        Favori butonu kartın içinde olduğu için
        önce favoriyi kontrol ediyoruz.
      */

      const favoriteButton =
        event.target.closest(
          "[data-favorite-id]"
        );

      if (favoriteButton) {

        event.stopPropagation();

        const id =
          String(
            favoriteButton.dataset.favoriteId
          );

        toggleFavorite(id);

        return;

      }


      if (matchCard) {

        const id =
          matchCard.dataset.fixtureId;

        if (id) {

          openMatch(id);

        }

        return;

      }


      const leagueButton =
        event.target.closest(
          "[data-league]"
        );

      if (leagueButton) {

        state.selectedLeague =
          leagueButton.dataset.league ||
          "all";

        updateLeagueActive();

        applyFilters();

        return;

      }


      const filterButton =
        event.target.closest(
          "[data-filter]"
        );

      if (filterButton) {

        state.selectedFilter =
          filterButton.dataset.filter ||
          "all";

        applyFilters();

        return;

      }

    }
  );

}


/* =========================================================
   API REQUEST
   ========================================================= */

async function fetchWithTimeout(
  url,
  options = {}
) {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      RI_CONFIG.REQUEST_TIMEOUT
    );

  try {

    const response =
      await fetch(
        url,
        {
          ...options,

          signal:
            controller.signal,

          /*
            no-store YOK.
            Böylece tarayıcı/Vercel cache
            kullanılabilir.
          */
          cache:
            options.cache ||
            "default"
        }
      );

    return response;

  } catch (error) {

    if (
      error?.name ===
      "AbortError"
    ) {

      throw new Error(
        "Sunucu 15 saniye içinde cevap vermedi."
      );

    }

    throw error;

  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   LOCAL CACHE
   ========================================================= */

function getFixtureCacheKey(
  date
) {

  return (
    "ri_fixture_cache_" +
    String(date)
  );

}


function readFixtureCache(
  date
) {

  try {

    const key =
      getFixtureCacheKey(date);

    const raw =
      localStorage.getItem(key);

    if (!raw) {

      return null;

    }

    const cached =
      JSON.parse(raw);

    if (
      !cached ||
      !cached.timestamp ||
      !Array.isArray(cached.data)
    ) {

      localStorage.removeItem(key);

      return null;

    }

    const age =
      Date.now() -
      Number(cached.timestamp);

    if (
      age >
      RI_CONFIG.FIXTURE_CACHE_TIME
    ) {

      /*
        Eski cache'i tamamen silmiyoruz.
        API ulaşılamazsa fallback olarak
        kullanabiliriz.
      */

      return {
        fresh: false,
        data: cached.data,
        timestamp: cached.timestamp
      };

    }

    return {
      fresh: true,
      data: cached.data,
      timestamp: cached.timestamp
    };

  } catch (error) {

    console.warn(
      "[R❤️İ] Cache okunamadı:",
      error
    );

    return null;

  }

}


function saveFixtureCache(
  date,
  data
) {

  try {

    const key =
      getFixtureCacheKey(date);

    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp:
          Date.now(),

        data
      })
    );

  } catch (error) {

    console.warn(
      "[R❤️İ] Cache kaydedilemedi:",
      error
    );

  }

}


/* =========================================================
   LOAD FIXTURES
   ========================================================= */

async function loadFixtures() {

  if (state.loading) {

    return;

  }


  const requestId =
    ++state.requestId;

  state.loading =
    true;

  state.lastError =
    null;


  const date =
    state.selectedDate ||
    getTodayIstanbul();


  /*
    ÖNCE LOCAL CACHE
  */

  const cached =
    readFixtureCache(date);


  if (
    cached?.fresh &&
    Array.isArray(cached.data)
  ) {

    console.log(
      "[R❤️İ] Maçlar local cache'den yüklendi:",
      cached.data.length
    );

    state.fixtures =
      cached.data;

    state.apiInfo = {
      cached: true,
      results:
        cached.data.length
    };

    state.selectedLeague =
      "all";

    state.selectedFilter =
      "all";

    renderLeagueMenu();

    applyFilters();

    state.loading =
      false;

    /*
      Cache geçerliyken API'ye
      hiç istek göndermiyoruz.
    */

    return;

  }


  showLoading(
    "Maçlar yükleniyor..."
  );


  /*
    CACHE KIRMAK YOK
  */

  const url =
    `${RI_CONFIG.API_URL}?date=${encodeURIComponent(
      date
    )}`;


  console.log(
    "[R❤️İ] API isteği:",
    url
  );


  try {

    const response =
      await fetchWithTimeout(
        url,
        {
          method: "GET",

          headers: {
            "Accept":
              "application/json"
          },

          cache:
            "default"
        }
      );


    if (
      requestId !==
      state.requestId
    ) {

      return;

    }


    console.log(
      "[R❤️İ] HTTP:",
      response.status
    );


    const rawText =
      await response.text();


    if (!rawText) {

      throw new Error(
        "Sunucudan boş cevap geldi."
      );

    }


    let data;

    try {

      data =
        JSON.parse(rawText);

    } catch (error) {

      console.error(
        "[R❤️İ] Geçersiz JSON:",
        rawText.substring(
          0,
          500
        )
      );

      throw new Error(
        "Vercel API geçersiz JSON döndürdü."
      );

    }


    console.log(
      "[R❤️İ] API sonuç:",
      data?.results
    );


    state.apiInfo =
      data;


    /*
      API-FOOTBALL HATA KONTROLÜ
    */

    if (
      data?.errors &&
      typeof data.errors ===
        "object" &&
      Object.keys(
        data.errors
      ).length > 0
    ) {

      const messages =
        Object.entries(
          data.errors
        )
          .map(
            ([key, value]) =>
              `${key}: ${value}`
          )
          .join(" | ");


      /*
        Eğer eski cache varsa
        onu kullan.
      */

      if (
        cached?.data &&
        Array.isArray(
          cached.data
        ) &&
        cached.data.length
      ) {

        console.warn(
          "[R❤️İ] API hatalı, eski cache kullanılıyor."
        );

        state.fixtures =
          cached.data;

        renderLeagueMenu();

        applyFilters();

        showCacheWarning(
          messages
        );

        return;

      }


      throw new Error(
        `API-Football: ${messages}`
      );

    }


    /*
      HTTP ERROR
    */

    if (!response.ok) {

      throw new Error(
        data?.message ||
        data?.error ||
        `HTTP ${response.status}`
      );

    }


    /*
      FIXTURE ÇIKAR
    */

    const rawFixtures =
      extractFixtures(data);


    console.log(
      "[R❤️İ] Ham maç:",
      rawFixtures.length
    );


    /*
      NORMALIZE
    */

    const normalized =
      rawFixtures
        .map(
          normalizeFixture
        )
        .filter(Boolean);


    console.log(
      "[R❤️İ] Normalize maç:",
      normalized.length
    );


    state.fixtures =
      normalized;


    /*
      CACHE'E KAYDET
    */

    saveFixtureCache(
      date,
      normalized
    );


    state.fixtureCache[date] = {
      timestamp:
        Date.now(),

      data:
        normalized
    };


    /*
      FILTER RESET
    */

    state.selectedLeague =
      "all";

    state.selectedFilter =
      "all";


    /*
      RENDER
    */

    renderLeagueMenu();

    applyFilters();


    /*
      EMPTY
    */

    if (
      normalized.length ===
      0
    ) {

      showNoFixtures(
        date,
        data
      );

    }


    console.log(
      "[R❤️İ] Maçlar başarıyla yüklendi:",
      normalized.length
    );


  } catch (error) {

    console.error(
      "[R❤️İ] MAÇ API HATASI:",
      error
    );


    state.lastError =
      error?.message ||
      "Bilinmeyen hata";


    /*
      Eski cache varsa
      tamamen boş ekran göstermiyoruz.
    */

    if (
      cached?.data &&
      Array.isArray(
        cached.data
      ) &&
      cached.data.length
    ) {

      state.fixtures =
        cached.data;

      renderLeagueMenu();

      applyFilters();

      showCacheWarning(
        state.lastError
      );

    } else {

      showApiError(
        state.lastError,
        date
      );

    }


  } finally {

    if (
      requestId ===
      state.requestId
    ) {

      state.loading =
        false;

    }

  }

}


/* =========================================================
   EXTRACT FIXTURES
   ========================================================= */

function extractFixtures(
  data
) {

  const candidates = [

    data?.response,

    data?.fixtures,

    data?.matches,

    data?.data?.response,

    data?.data?.fixtures,

    data?.data?.matches,

    data?.result?.response,

    data?.result?.fixtures,

    data?.result?.matches

  ];


  for (
    const candidate
    of candidates
  ) {

    if (
      Array.isArray(candidate)
    ) {

      return candidate;

    }

  }


  return [];

}


/* =========================================================
   NORMALIZE
   ========================================================= */

function normalizeFixture(
  item
) {

  if (!item) {

    return null;

  }


  /*
    API-FOOTBALL
  */

  if (
    item.fixture &&
    item.teams
  ) {

    return {

      id:
        String(
          item.fixture.id
        ),

      date:
        item.fixture.date ||
        "",

      timestamp:
        item.fixture.timestamp ||
        0,

      status:
        item.fixture.status ||
        {},

      venue:
        item.fixture.venue ||
        {},

      referee:
        item.fixture.referee ||
        "",

      timezone:
        item.fixture.timezone ||
        "",


      league: {

        id:
          item.league?.id ||
          "",

        name:
          item.league?.name ||
          "Diğer",

        country:
          item.league?.country ||
          "",

        logo:
          item.league?.logo ||
          "",

        flag:
          item.league?.flag ||
          "",

        round:
          item.league?.round ||
          "",

        season:
          item.league?.season ||
          ""

      },


      home: {

        id:
          item.teams?.home?.id ||
          "",

        name:
          item.teams?.home?.name ||
          "Ev Sahibi",

        logo:
          item.teams?.home?.logo ||
          "",

        winner:
          item.teams?.home?.winner

      },


      away: {

        id:
          item.teams?.away?.id ||
          "",

        name:
          item.teams?.away?.name ||
          "Deplasman",

        logo:
          item.teams?.away?.logo ||
          "",

        winner:
          item.teams?.away?.winner

      },


      goals: {

        home:
          item.goals?.home,

        away:
          item.goals?.away

      },


      raw:
        item

    };

  }


  /*
    GENERIC FORMAT
  */

  const id =
    item.id ||
    item.fixture_id ||
    item.fixture?.id;


  if (!id) {

    return null;

  }


  return {

    id:
      String(id),

    date:
      item.date ||
      item.fixture?.date ||
      "",

    timestamp:
      item.timestamp ||
      item.fixture?.timestamp ||
      0,

    status:
      item.status ||
      item.fixture?.status ||
      {},

    venue:
      item.venue ||
      item.fixture?.venue ||
      {},

    referee:
      item.referee ||
      "",

    timezone:
      item.timezone ||
      "",


    league: {

      id:
        item.league?.id ||
        "",

      name:
        item.league?.name ||
        "Diğer",

      country:
        item.league?.country ||
        "",

      logo:
        item.league?.logo ||
        "",

      flag:
        item.league?.flag ||
        "",

      round:
        item.league?.round ||
        "",

      season:
        item.league?.season ||
        ""

    },


    home: {

      id:
        item.teams?.home?.id ||
        item.home?.id ||
        "",

      name:
        item.teams?.home?.name ||
        item.home?.name ||
        item.homeTeam ||
        "Ev Sahibi",

      logo:
        item.teams?.home?.logo ||
        item.home?.logo ||
        ""

    },


    away: {

      id:
        item.teams?.away?.id ||
        item.away?.id ||
        "",

      name:
        item.teams?.away?.name ||
        item.away?.name ||
        item.awayTeam ||
        "Deplasman",

      logo:
        item.teams?.away?.logo ||
        item.away?.logo ||
        ""

    },


    goals: {

      home:
        item.goals?.home ??
        item.homeScore ??
        null,

      away:
        item.goals?.away ??
        item.awayScore ??
        null

    },


    raw:
      item

  };

}


/* =========================================================
   FILTER
   ========================================================= */

function applyFilters() {

  let fixtures =
    [...state.fixtures];


  /*
    SEARCH
  */

  if (
    state.searchQuery
  ) {

    fixtures =
      fixtures.filter(
        match => {

          const text = [

            match.home?.name,

            match.away?.name,

            match.league?.name,

            match.league?.country

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return text.includes(
            state.searchQuery
          );

        }
      );

  }


  /*
    LEAGUE
  */

  if (
    state.selectedLeague &&
    state.selectedLeague !==
      "all"
  ) {

    fixtures =
      fixtures.filter(
        match => {

          return (
            String(
              match.league?.id
            ) ===
            String(
              state.selectedLeague
            )
          );

        }
      );

  }


  /*
    FILTER
  */

  fixtures =
    fixtures.filter(
      match =>
        matchesFilter(
          match,
          state.selectedFilter
        )
    );


  /*
    SORT
  */

  fixtures.sort(
    sortFixtures
  );


  state.filteredFixtures =
    fixtures;


  renderFixtures(
    fixtures
  );

}


/* =========================================================
   FILTER LOGIC
   ========================================================= */

function matchesFilter(
  match,
  filter
) {

  if (
    !filter ||
    filter === "all"
  ) {

    return true;

  }


  if (
    filter === "favorites"
  ) {

    return state.favorites.has(
      String(match.id)
    );

  }


  if (
    filter === "search"
  ) {

    return true;

  }


  if (
    filter === "live"
  ) {

    return isLive(match);

  }


  if (
    filter === "upcoming"
  ) {

    return !isFinished(
      match
    );

  }


  if (
    filter === "finished"
  ) {

    return isFinished(
      match
    );

  }


  if (
    filter === "banko" ||
    filter === "reliable"
  ) {

    return (
      getRiskLevel(match) ===
      "low"
    );

  }


  if (
    filter === "medium" ||
    filter === "orta"
  ) {

    return (
      getRiskLevel(match) ===
      "medium"
    );

  }


  if (
    filter === "risk" ||
    filter === "high"
  ) {

    return (
      getRiskLevel(match) ===
      "high"
    );

  }


  if (
    filter === "iy2ykg" ||
    filter === "half-btts"
  ) {

    return true;

  }


  if (
    filter === "first-half"
  ) {

    return true;

  }


  if (
    filter === "second-half"
  ) {

    return true;

  }


  if (
    filter === "score"
  ) {

    return true;

  }


  return true;

}


/* =========================================================
   SORT
   ========================================================= */

function sortFixtures(
  a,
  b
) {

  const aTime =
    Number(
      a.timestamp
    ) || 0;

  const bTime =
    Number(
      b.timestamp
    ) || 0;


  return (
    aTime -
    bTime
  );

}


/* =========================================================
   LEAGUE MENU
   ========================================================= */

function renderLeagueMenu() {

  if (!leagueMenu) {

    return;

  }


  const leagues =
    new Map();


  for (
    const match
    of state.fixtures
  ) {

    const league =
      match.league;


    const key =
      String(
        league?.id ||
        league?.name ||
        "other"
      );


    if (
      !leagues.has(key)
    ) {

      leagues.set(
        key,
        {

          id:
            key,

          name:
            league?.name ||
            "Diğer",

          country:
            league?.country ||
            "",

          logo:
            league?.logo ||
            ""

        }
      );

    }

  }


  const sorted =
    [...leagues.values()]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "tr"
          )
      );


  let html = `

    <button
      type="button"
      class="league-button active"
      data-league="all"
    >

      🌐 Tüm Ligler

      <span>
        ${state.fixtures.length}
      </span>

    </button>

  `;


  for (
    const league
    of sorted
  ) {

    const count =
      state.fixtures.filter(
        match =>
          String(
            match.league?.id
          ) ===
          String(
            league.id
          )
      ).length;


    html += `

      <button
        type="button"
        class="league-button"
        data-league="${escapeAttr(
          league.id
        )}"
      >

        ${
          league.logo
            ? `
              <img
                src="${escapeAttr(
                  league.logo
                )}"
                alt=""
                loading="lazy"
              >
            `
            : "⚽"
        }

        <span>
          ${escapeHtml(
            league.name
          )}
        </span>

        <b>
          ${count}
        </b>

      </button>

    `;

  }


  leagueMenu.innerHTML =
    html;


  updateLeagueActive();

}


/* =========================================================
   LEAGUE ACTIVE
   ========================================================= */

function updateLeagueActive() {

  if (!leagueMenu) {

    return;

  }


  leagueMenu
    .querySelectorAll(
      "[data-league]"
    )
    .forEach(
      button => {

        const value =
          button.dataset.league;


        button.classList.toggle(
          "active",

          value ===
          String(
            state.selectedLeague
          )
        );

      }
    );

}


/* =========================================================
   RENDER
   ========================================================= */

function renderFixtures(
  fixtures
) {

  if (!matchesGrid) {

    console.error(
      "[R❤️İ] matchesGrid bulunamadı."
    );

    return;

  }


  if (!fixtures.length) {

    matchesGrid.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          🔎
        </div>

        <div class="empty-title">
          Maç bulunamadı
        </div>

        <div class="empty-message">
          Seçtiğin filtrelere uygun maç yok.
        </div>

      </div>

    `;

    return;

  }


  const groups =
    new Map();


  for (
    const match
    of fixtures
  ) {

    const leagueId =
      String(
        match.league?.id ||
        "other"
      );


    if (
      !groups.has(
        leagueId
      )
    ) {

      groups.set(
        leagueId,
        {

          league:
            match.league,

          matches:
            []

        }
      );

    }


    groups
      .get(leagueId)
      .matches
      .push(match);

  }


  let html = "";


  for (
    const group
    of groups.values()
  ) {

    html +=
      renderLeagueSection(
        group.league,
        group.matches
      );

  }


  /*
    DOM'u tek seferde güncelle
  */

  matchesGrid.innerHTML =
    html;


  updateLeagueActive();

}


/* =========================================================
   LEAGUE SECTION
   ========================================================= */

function renderLeagueSection(
  league,
  matches
) {

  let html = `

    <section
      class="league-section"
      data-section-league="${escapeAttr(
        league?.id ||
        ""
      )}"
    >

      <div class="league-header">

        <div class="league-title">

          ${
            league?.logo
              ? `
                <img
                  src="${escapeAttr(
                    league.logo
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <span class="league-ball">
                  ⚽
                </span>
              `
          }

          <div>

            <strong>
              ${escapeHtml(
                league?.name ||
                "Diğer"
              )}
            </strong>

            ${
              league?.country
                ? `
                  <small>
                    ${escapeHtml(
                      league.country
                    )}
                  </small>
                `
                : ""
            }

          </div>

        </div>

        <span class="league-match-count">
          ${matches.length} maç
        </span>

      </div>


      <div class="matches-list">

  `;


  for (
    const match
    of matches
  ) {

    html +=
      renderMatchCard(
        match
      );

  }


  html += `

      </div>

    </section>

  `;


  return html;

}


/* =========================================================
   MATCH CARD
   ========================================================= */

function renderMatchCard(
  match
) {

  const favorite =
    state.favorites.has(
      String(match.id)
    );


  const time =
    formatMatchTime(
      match
    );


  const status =
    getStatusText(
      match
    );


  const statusClass =
    getStatusClass(
      match
    );


  const homeLogo =
    match.home?.logo ||
    "";


  const awayLogo =
    match.away?.logo ||
    "";


  const homeName =
    match.home?.name ||
    "Ev Sahibi";


  const awayName =
    match.away?.name ||
    "Deplasman";


  const score =
    getScoreText(
      match
    );


  return `

    <article
      class="match-card ${
        isLive(match)
          ? "is-live"
          : ""
      }"
      data-fixture-id="${escapeAttr(
        match.id
      )}"
    >

      <div class="match-top">

        <span class="match-time">
          ${escapeHtml(
            time
          )}
        </span>

        <span
          class="match-status ${statusClass}"
        >
          ${escapeHtml(
            status
          )}
        </span>

        <button
          type="button"
          class="favorite-button ${
            favorite
              ? "active"
              : ""
          }"
          data-favorite-id="${escapeAttr(
            match.id
          )}"
          aria-label="Favori"
        >
          ${
            favorite
              ? "★"
              : "☆"
          }
        </button>

      </div>


      <div class="teams">

        <div class="team home-team">

          ${
            homeLogo
              ? `
                <img
                  class="team-logo"
                  src="${escapeAttr(
                    homeLogo
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <div class="team-logo-placeholder">
                  ⚽
                </div>
              `
          }

          <span class="team-name">
            ${escapeHtml(
              homeName
            )}
          </span>

        </div>


        <div class="match-center">

          <span class="score">
            ${escapeHtml(
              score
            )}
          </span>

          <span class="vs">
            ${
              isFinished(match)
                ? ""
                : "VS"
            }
          </span>

        </div>


        <div class="team away-team">

          ${
            awayLogo
              ? `
                <img
                  class="team-logo"
                  src="${escapeAttr(
                    awayLogo
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <div class="team-logo-placeholder">
                  ⚽
                </div>
              `
          }

          <span class="team-name">
            ${escapeHtml(
              awayName
            )}
          </span>

        </div>

      </div>


      <div class="match-bottom">

        <span>
          ${escapeHtml(
            match.league?.round ||
            ""
          )}
        </span>

        <span>
          Analiz →
        </span>

      </div>

    </article>

  `;

}


/* =========================================================
   MATCH OPEN
   ========================================================= */

async function openMatch(
  id
) {

  const match =
    state.fixtures.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!match) {

    return;

  }


  state.selectedFixture =
    match;


  const modal =
    document.querySelector(
      "#matchModal"
    ) ||
    document.querySelector(
      ".match-modal"
    );


  if (modal) {

    modal.classList.add(
      "open"
    );

  }


  showAnalysisLoading(
    match
  );


  try {

    const cacheKey =
      String(
        match.id
      );


    let data =
      state.analysisCache[
        cacheKey
      ];


    /*
      ANALİZ CACHE KONTROLÜ
    */

    if (
      data &&
      data.timestamp &&
      data.data
    ) {

      const age =
        Date.now() -
        Number(
          data.timestamp
        );


      if (
        age <=
        RI_CONFIG.ANALYSIS_CACHE_TIME
      ) {

        data =
          data.data;

      } else {

        data =
          null;

      }

    }


    if (!data) {

      const response =
        await fetchWithTimeout(

          `${RI_CONFIG.MATCH_API_URL}?fixture=${encodeURIComponent(
            match.id
          )}`,

          {
            method:
              "GET",

            headers: {
              "Accept":
                "application/json"
            },

            cache:
              "default"
          }

        );


      const text =
        await response.text();


      let json;


      try {

        json =
          JSON.parse(text);

      } catch {

        throw new Error(
          "Maç analiz API'si geçersiz cevap verdi."
        );

      }


      if (!response.ok) {

        throw new Error(
          json?.error ||
          json?.message ||
          `HTTP ${response.status}`
        );

      }


      data =
        json;


      state.analysisCache[
        cacheKey
      ] = {

        timestamp:
          Date.now(),

        data

      };

    }


    renderAnalysis(
      match,
      data
    );


    requestAIAnalysis(
      match,
      data
    );


  } catch (error) {

    console.error(
      "[R❤️İ] Analiz hatası:",
      error
    );


    renderAnalysisError(
      error.message
    );

  }

}


/* =========================================================
   ANALYSIS LOADING
   ========================================================= */

function showAnalysisLoading(
  match
) {

  const container =
    getAnalysisContainer();


  if (!container) {

    return;

  }


  container.innerHTML = `

    <div class="analysis-loading">

      <div class="loading-spinner"></div>

      <h2>
        ${escapeHtml(
          match.home?.name
        )}
        -
        ${escapeHtml(
          match.away?.name
        )}
      </h2>

      <p>
        Maç verileri toplanıyor...
      </p>

      <div class="analysis-progress">
        Form • H2H • İstatistik • Kadro • Oran
      </div>

    </div>

  `;

}


/* =========================================================
   ANALYSIS CONTAINER
   ========================================================= */

function getAnalysisContainer() {

  return (
    document.querySelector(
      "#analysisContent"
    ) ||
    document.querySelector(
      "#matchAnalysis"
    ) ||
    document.querySelector(
      ".analysis-content"
    ) ||
    document.querySelector(
      ".analysis-container"
    )
  );

}


/* =========================================================
   RENDER ANALYSIS
   ========================================================= */

function renderAnalysis(
  match,
  data
) {

  const container =
    getAnalysisContainer();


  if (!container) {

    return;

  }


  const analysisData =
    data?.analysis_data ||
    data?.data ||
    data ||
    {};


  const prediction =
    data?.prediction ||
    analysisData?.prediction ||
    null;


  const status =
    getStatusText(
      match
    );


  container.innerHTML = `

    <div class="analysis-head">

      <div class="analysis-league">

        ${
          match.league?.logo
            ? `
              <img
                src="${escapeAttr(
                  match.league.logo
                )}"
                alt=""
              >
            `
            : ""
        }

        ${escapeHtml(
          match.league?.name ||
          ""
        )}

      </div>


      <h1>

        ${escapeHtml(
          match.home?.name
        )}

        <span>
          VS
        </span>

        ${escapeHtml(
          match.away?.name
        )}

      </h1>


      <div class="analysis-status">
        ${escapeHtml(
          status
        )}
      </div>

    </div>


    <div class="analysis-grid">

      ${renderPredictionBox(
        prediction
      )}

      ${renderFormBox(
        analysisData
      )}

      ${renderH2HBox(
        analysisData
      )}

      ${renderStatisticsBox(
        analysisData
      )}

      ${renderLineupsBox(
        analysisData
      )}

      ${renderInjuriesBox(
        analysisData
      )}

      ${renderOddsBox(
        analysisData
      )}

    </div>


    <div
      id="aiAnalysis"
      class="ai-analysis"
    >

      <div class="ai-loading">

        <div class="loading-spinner"></div>

        <strong>
          R❤️İ AI analiz hazırlanıyor...
        </strong>

      </div>

    </div>

  `;

}


/* =========================================================
   PREDICTION BOX
   ========================================================= */

function renderPredictionBox(
  prediction
) {

  if (!prediction) {

    return `

      <div class="analysis-box">

        <h3>
          🎯 Tahmin
        </h3>

        <p>
          API tahmini bulunamadı.
        </p>

      </div>

    `;

  }


  const winner =
    prediction?.predictions?.winner?.name ||
    prediction?.winner?.name ||
    "-";


  const advice =
    prediction?.predictions?.advice ||
    prediction?.advice ||
    "-";


  return `

    <div class="analysis-box prediction-box">

      <h3>
        🎯 API Tahmini
      </h3>

      <div class="prediction-main">
        ${escapeHtml(
          winner
        )}
      </div>

      <p>
        ${escapeHtml(
          advice
        )}
      </p>

    </div>

  `;

}


/* =========================================================
   FORM BOX
   ========================================================= */

function renderFormBox(
  data
) {

  const home =
    data?.homeLast ||
    data?.home_form ||
    data?.homeForm ||
    [];


  const away =
    data?.awayLast ||
    data?.away_form ||
    data?.awayForm ||
    [];


  return `

    <div class="analysis-box">

      <h3>
        📈 Son Form
      </h3>

      <div class="form-columns">

        <div>

          <strong>
            ${escapeHtml(
              data?.homeTeam?.name ||
              "Ev Sahibi"
            )}
          </strong>

          <p>
            ${escapeHtml(
              summarizeForm(
                home
              )
            )}
          </p>

        </div>


        <div>

          <strong>
            ${escapeHtml(
              data?.awayTeam?.name ||
              "Deplasman"
            )}
          </strong>

          <p>
            ${escapeHtml(
              summarizeForm(
                away
              )
            )}
          </p>

        </div>

      </div>

    </div>

  `;

}


/* =========================================================
   H2H
   ========================================================= */

function renderH2HBox(
  data
) {

  const h2h =
    data?.h2h ||
    data?.headtohead ||
    [];


  const count =
    Array.isArray(h2h)
      ? h2h.length
      : 0;


  return `

    <div class="analysis-box">

      <h3>
        🤝 H2H
      </h3>

      <div class="big-number">
        ${count}
      </div>

      <p>
        Geçmiş karşılaşma verisi
      </p>

    </div>

  `;

}


/* =========================================================
   STATISTICS
   ========================================================= */

function renderStatisticsBox(
  data
) {

  const statistics =
    data?.statistics ||
    data?.stats ||
    null;


  if (!statistics) {

    return `

      <div class="analysis-box">

        <h3>
          📊 İstatistikler
        </h3>

        <p>
          Maç istatistikleri henüz bulunamadı.
        </p>

      </div>

    `;

  }


  return `

    <div class="analysis-box">

      <h3>
        📊 Maç İstatistikleri
      </h3>

      <pre class="stats-preview">${escapeHtml(
        JSON.stringify(
          statistics,
          null,
          2
        ).slice(
          0,
          2000
        )
      )}</pre>

    </div>

  `;

}


/* =========================================================
   LINEUPS
   ========================================================= */

function renderLineupsBox(
  data
) {

  const lineups =
    data?.lineups ||
    [];


  const count =
    Array.isArray(lineups)
      ? lineups.length
      : 0;


  return `

    <div class="analysis-box">

      <h3>
        👥 Kadrolar
      </h3>

      <div class="big-number">
        ${count}
      </div>

      <p>
        Kadro verisi
      </p>

    </div>

  `;

}


/* =========================================================
   INJURIES
   ========================================================= */

function renderInjuriesBox(
  data
) {

  const injuries =
    data?.injuries ||
    [];


  const count =
    Array.isArray(injuries)
      ? injuries.length
      : 0;


  return `

    <div class="analysis-box">

      <h3>
        🏥 Eksikler
      </h3>

      <div class="big-number">
        ${count}
      </div>

      <p>
        Bildirilen sakat/eksik oyuncu
      </p>

    </div>

  `;

}


/* =========================================================
   ODDS
   ========================================================= */

function renderOddsBox(
  data
) {

  const odds =
    data?.odds ||
    [];


  const count =
    Array.isArray(odds)
      ? odds.length
      : (
          odds &&
          typeof odds ===
            "object"
            ? Object.keys(
                odds
              ).length
            : 0
        );


  return `

    <div class="analysis-box">

      <h3>
        💰 Oranlar
      </h3>

      ${
        count
          ? `
            <p>
              Oran verisi mevcut.
            </p>
          `
          : `
            <p>
              Oran verisi bulunamadı.
            </p>
          `
      }

    </div>

  `;

}


/* =========================================================
   AI
   ========================================================= */

async function requestAIAnalysis(
  match,
  data
) {

  const container =
    document.querySelector(
      "#aiAnalysis"
    );


  if (!container) {

    return;

  }


  try {

    const response =
      await fetchWithTimeout(
        RI_CONFIG.AI_API_URL,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              match: {

                id:
                  match.id,

                home:
                  match.home,

                away:
                  match.away,

                league:
                  match.league,

                date:
                  match.date

              },

              data,

              local:
                createLocalAnalysis(
                  match,
                  data
                )

            }),

          cache:
            "default"

        }
      );


    const text =
      await response.text();


    let json;


    try {

      json =
        JSON.parse(text);

    } catch {

      throw new Error(
        "AI API geçersiz cevap verdi."
      );

    }


    if (!response.ok) {

      throw new Error(
        json?.error ||
        json?.message ||
        `HTTP ${response.status}`
      );

    }


    renderAIAnalysis(
      json?.ai ||
      json?.analysis ||
      json
    );


  } catch (error) {

    console.error(
      "[R❤️İ] AI hatası:",
      error
    );


    container.innerHTML = `

      <div class="ai-error">

        <h3>
          🤖 R❤️İ AI
        </h3>

        <p>
          AI analizi şu anda alınamadı.
        </p>

        <small>
          ${escapeHtml(
            error.message
          )}
        </small>

      </div>

    `;

  }

}


/* =========================================================
   AI RENDER
   ========================================================= */

function renderAIAnalysis(
  ai
) {

  const container =
    document.querySelector(
      "#aiAnalysis"
    );


  if (!container) {

    return;

  }


  const pick =
    ai?.pick ||
    ai?.recommendation ||
    "-";


  const confidence =
    ai?.confidence ??
    "-";


  const risk =
    ai?.risk ||
    "-";


  const score =
    ai?.predicted_score ||
    ai?.score ||
    "-";


  const summary =
    ai?.summary ||
    "";


  const markets =
    ai?.markets ||
    {};


  const reasons =
    Array.isArray(
      ai?.reasons
    )
      ? ai.reasons
      : [];


  const warnings =
    Array.isArray(
      ai?.warnings
    )
      ? ai.warnings
      : [];


  container.innerHTML = `

    <div class="ai-card">

      <div class="ai-title">

        <span>
          🤖
        </span>

        <strong>
          R❤️İ AI Analizi
        </strong>

      </div>


      <div class="ai-main-grid">

        <div class="ai-pick">

          <small>
            ÖNERİ
          </small>

          <strong>
            ${escapeHtml(
              pick
            )}
          </strong>

        </div>


        <div>

          <small>
            GÜVEN
          </small>

          <strong>
            ${escapeHtml(
              String(
                confidence
              )
            )}
          </strong>

        </div>


        <div>

          <small>
            RİSK
          </small>

          <strong>
            ${escapeHtml(
              risk
            )}
          </strong>

        </div>


        <div>

          <small>
            TAHMİNİ SKOR
          </small>

          <strong>
            ${escapeHtml(
              score
            )}
          </strong>

        </div>

      </div>


      ${
        summary
          ? `
            <div class="ai-summary">
              ${escapeHtml(
                summary
              )}
            </div>
          `
          : ""
      }


      ${renderMarkets(
        markets
      )}


      ${
        reasons.length
          ? `

            <div class="ai-reasons">

              <h4>
                Nedenler
              </h4>

              <ul>

                ${reasons
                  .map(
                    item =>
                      `
                        <li>
                          ${escapeHtml(
                            item
                          )}
                        </li>
                      `
                  )
                  .join("")}

              </ul>

            </div>

          `
          : ""
      }


      ${
        warnings.length
          ? `

            <div class="ai-warnings">

              <h4>
                ⚠️ Uyarılar
              </h4>

              <ul>

                ${warnings
                  .map(
                    item =>
                      `
                        <li>
                          ${escapeHtml(
                            item
                          )}
                        </li>
                      `
                  )
                  .join("")}

              </ul>

            </div>

          `
          : ""
      }

    </div>

  `;

}


/* =========================================================
   MARKETS
   ========================================================= */

function renderMarkets(
  markets
) {

  if (
    !markets ||
    typeof markets !==
      "object"
  ) {

    return "";

  }


  const labels = {

    match_result:
      "Maç Sonucu",

    btts:
      "KG",

    over_15:
      "1.5 Üst",

    over_25:
      "2.5 Üst",

    under_35:
      "3.5 Alt"

  };


  let html = `

    <div class="markets">

      <h4>
        Piyasalar
      </h4>

      <div class="market-grid">

  `;


  for (
    const [
      key,
      label
    ]
    of Object.entries(
      labels
    )
  ) {

    const value =
      markets[key];


    if (
      value ===
        undefined ||
      value ===
        null
    ) {

      continue;

    }


    html += `

      <div class="market">

        <span>
          ${escapeHtml(
            label
          )}
        </span>

        <strong>
          ${escapeHtml(
            String(value)
          )}
        </strong>

      </div>

    `;

  }


  html += `

      </div>

    </div>

  `;


  return html;

}


/* =========================================================
   LOCAL ANALYSIS
   ========================================================= */

function createLocalAnalysis(
  match,
  data
) {

  const home =
    match.home?.name ||
    "";


  const away =
    match.away?.name ||
    "";


  const homeForm =
    extractResults(
      data?.homeLast ||
      data?.home_form ||
      []
    );


  const awayForm =
    extractResults(
      data?.awayLast ||
      data?.away_form ||
      []
    );


  const homeGoals =
    calculateAverageGoals(
      homeForm,
      "home"
    );


  const awayGoals =
    calculateAverageGoals(
      awayForm,
      "away"
    );


  const expectedHome =
    Math.max(
      0.2,
      homeGoals
    );


  const expectedAway =
    Math.max(
      0.2,
      awayGoals
    );


  return {

    home,

    away,

    expected_home_goals:
      round(
        expectedHome,
        2
      ),

    expected_away_goals:
      round(
        expectedAway,
        2
      ),

    predicted_score:
      `${Math.round(
        expectedHome
      )}-${Math.round(
        expectedAway
      )}`,

    btts_probability:
      round(
        bttsProbability(
          expectedHome,
          expectedAway
        ),
        1
      ),

    over_25_probability:
      round(
        over25Probability(
          expectedHome,
          expectedAway
        ),
        1
      )

  };

}


/* =========================================================
   RESULTS
   ========================================================= */

function extractResults(
  fixtures
) {

  if (
    !Array.isArray(fixtures)
  ) {

    return [];

  }


  return fixtures
    .map(
      item => {

        const goals =
          item.goals ||
          {};


        const home =
          goals.home;

        const away =
          goals.away;


        if (
          typeof home !==
            "number" ||
          typeof away !==
            "number"
        ) {

          return null;

        }


        return {

          home,

          away

        };

      }
    )
    .filter(Boolean);

}


/* =========================================================
   AVERAGE GOALS
   ========================================================= */

function calculateAverageGoals(
  results,
  side
) {

  if (
    !results.length
  ) {

    return 1.2;

  }


  const total =
    results.reduce(
      (
        sum,
        result
      ) => {

        return (
          sum +
          (
            side ===
              "home"
              ? result.home
              : result.away
          )
        );

      },
      0
    );


  return (
    total /
    results.length
  );

}


/* =========================================================
   BTTS
   ========================================================= */

function bttsProbability(
  home,
  away
) {

  const probability =
    (
      1 -
      Math.exp(
        -home
      )
    ) *
    (
      1 -
      Math.exp(
        -away
      )
    );


  return (
    probability *
    100
  );

}


/* =========================================================
   OVER 2.5
   ========================================================= */

function over25Probability(
  home,
  away
) {

  const lambda =
    home +
    away;


  const p0 =
    Math.exp(
      -lambda
    );


  const p1 =
    p0 *
    lambda;


  const p2 =
    p1 *
    lambda /
    2;


  return (
    1 -
    (
      p0 +
      p1 +
      p2
    )
  ) *
  100;

}


/* =========================================================
   RISK
   ========================================================= */

function getRiskLevel(
  match
) {

  const home =
    match.home?.name ||
    "";


  const away =
    match.away?.name ||
    "";


  const text =
    `${home} ${away}`
      .toLowerCase();


  /*
    Bu sadece filtre için
    temel sınıflamadır.
    Gerçek maç analizi AI/API
    tarafında yapılır.
  */

  if (
    text.includes(
      "real madrid"
    ) ||
    text.includes(
      "barcelona"
    ) ||
    text.includes(
      "manchester city"
    ) ||
    text.includes(
      "bayern"
    )
  ) {

    return "low";

  }


  return "medium";

}


/* =========================================================
   STATUS
   ========================================================= */

function getStatusCode(
  match
) {

  return String(
    match.status?.short ||
    match.status?.long ||
    ""
  ).toUpperCase();

}


function isLive(
  match
) {

  const code =
    getStatusCode(
      match
    );


  return [

    "1H",
    "2H",
    "HT",
    "ET",
    "BT",
    "P",
    "LIVE"

  ].includes(code);

}


function isFinished(
  match
) {

  const code =
    getStatusCode(
      match
    );


  return [

    "FT",
    "AET",
    "PEN"

  ].includes(code);

}


function getStatusText(
  match
) {

  const code =
    getStatusCode(
      match
    );


  if (
    code ===
    "HT"
  ) {

    return "İY";

  }


  if (
    isLive(match)
  ) {

    return "CANLI";

  }


  if (
    isFinished(match)
  ) {

    return "MS";

  }


  if (
    code ===
      "PST" ||
    code ===
      "CANC"
  ) {

    return "ERTELENDİ";

  }


  if (
    code ===
      "NS" ||
    code ===
      ""
  ) {

    return formatMatchTime(
      match
    );

  }


  return (
    match.status?.long ||
    code ||
    "PROGRAMLI"
  );

}


function getStatusClass(
  match
) {

  if (
    isLive(match)
  ) {

    return "live";

  }


  if (
    isFinished(match)
  ) {

    return "finished";

  }


  return "scheduled";

}


/* =========================================================
   TIME
   ========================================================= */

function formatMatchTime(
  match
) {

  if (
    !match.date
  ) {

    return "--:--";

  }


  try {

    return new Intl.DateTimeFormat(
      "tr-TR",
      {

        timeZone:
          "Europe/Istanbul",

        hour:
          "2-digit",

        minute:
          "2-digit"

      }
    ).format(
      new Date(
        match.date
      )
    );

  } catch {

    return "--:--";

  }

}


/* =========================================================
   SCORE
   ========================================================= */

function getScoreText(
  match
) {

  const home =
    match.goals?.home;


  const away =
    match.goals?.away;


  if (
    typeof home ===
      "number" &&
    typeof away ===
      "number"
  ) {

    return `${home} - ${away}`;

  }


  return "–";

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
        ? array.map(
            String
          )
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
        [
          ...state.favorites
        ]
      )
    );

  } catch {}

}


function toggleFavorite(
  id
) {

  id =
    String(id);


  if (
    state.favorites.has(id)
  ) {

    state.favorites.delete(
      id
    );

  } else {

    state.favorites.add(
      id
    );

  }


  saveFavorites();

  updateFavoriteCount();

  renderFixtures(
    state.filteredFixtures
  );

}


function updateFavoriteCount() {

  if (
    !favoriteCount
  ) {

    return;

  }


  favoriteCount.textContent =
    String(
      state.favorites.size
    );

}


/* =========================================================
   EMPTY
   ========================================================= */

function showNoFixtures(
  date,
  data
) {

  if (!matchesGrid) {

    return;

  }


  const resultCount =
    data?.results ??
    data?.paging?.total ??
    state.fixtures.length;


  matchesGrid.innerHTML = `

    <div class="empty-state api-empty">

      <div class="empty-icon">
        📅
      </div>

      <div class="empty-title">
        Bu tarih için maç bulunamadı
      </div>

      <div class="empty-message">

        Sorgulanan tarih:
        <strong>
          ${escapeHtml(
            date
          )}
        </strong>

        <br><br>

        API-Football sonuç:
        <strong>
          ${escapeHtml(
            String(
              resultCount
            )
          )}
        </strong>

      </div>

      <button
        type="button"
        class="retry-button"
        onclick="loadFixtures()"
      >
        🔄 Tekrar Dene
      </button>

    </div>

  `;

}


/* =========================================================
   API ERROR
   ========================================================= */

function showApiError(
  error,
  date
) {

  if (!matchesGrid) {

    console.error(
      "[R❤️İ]",
      error
    );

    return;

  }


  const isQuota =
    String(
      error || ""
    )
      .toLowerCase()
      .includes(
        "request limit"
      ) ||
    String(
      error || ""
    )
      .toLowerCase()
      .includes(
        "daily"
      ) ||
    String(
      error || ""
    )
      .toLowerCase()
      .includes(
        "quota"
      );


  matchesGrid.innerHTML = `

    <div class="empty-state api-error-state">

      <div class="empty-icon">
        ${
          isQuota
            ? "⏳"
            : "🚨"
        }
      </div>

      <div class="empty-title">

        ${
          isQuota
            ? "Günlük API kotası doldu"
            : "Maç verisi alınamadı"
        }

      </div>

      <div class="empty-message">

        ${
          isQuota
            ? `
              Veri sağlayıcının günlük
              istek limiti dolmuş.
              Daha önce kaydedilmiş maç
              verisi varsa kullanılacaktır.
            `
            : `
              ${escapeHtml(
                error
              )}
            `
        }

        <br><br>

        Sorgulanan tarih:
        <strong>
          ${escapeHtml(
            date
          )}
        </strong>

      </div>


      <button
        type="button"
        class="retry-button"
        onclick="loadFixtures()"
      >
        🔄 Tekrar Dene
      </button>

    </div>

  `;

}


/* =========================================================
   CACHE WARNING
   ========================================================= */

function showCacheWarning(
  message
) {

  if (!matchesGrid) {

    return;

  }


  const existing =
    document.querySelector(
      "#riCacheWarning"
    );


  if (existing) {

    existing.remove();

  }


  const warning =
    document.createElement(
      "div"
    );


  warning.id =
    "riCacheWarning";


  warning.className =
    "ri-cache-warning";


  warning.innerHTML = `

    <span>
      ⚡
    </span>

    <span>
      Güncel API verisine ulaşılamadı.
      Son kaydedilen maç verileri gösteriliyor.
    </span>

  `;


  if (
    matchesGrid.parentNode
  ) {

    matchesGrid.parentNode.insertBefore(
      warning,
      matchesGrid
    );

  }


  console.warn(
    "[R❤️İ] Cache fallback:",
    message
  );

}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(
  message
) {

  if (!matchesGrid) {

    return;

  }


  state.loadingMessage =
    message;


  matchesGrid.innerHTML = `

    <div class="loading-state">

      <div class="loading-spinner"></div>

      <div class="loading-title">
        ${escapeHtml(
          message
        )}
      </div>

      <div class="loading-subtitle">
        Maç verileri kontrol ediliyor...
      </div>

    </div>

  `;

}


/* =========================================================
   ANALYSIS ERROR
   ========================================================= */

function renderAnalysisError(
  message
) {

  const container =
    getAnalysisContainer();


  if (!container) {

    return;

  }


  container.innerHTML = `

    <div class="analysis-error">

      <div>
        ⚠️
      </div>

      <h2>
        Analiz alınamadı
      </h2>

      <p>
        ${escapeHtml(
          message
        )}
      </p>

    </div>

  `;

}


/* =========================================================
   FORM SUMMARY
   ========================================================= */

function summarizeForm(
  fixtures
) {

  if (
    !Array.isArray(fixtures)
  ) {

    return "Veri yok";

  }


  const results =
    extractResults(
      fixtures
    );


  if (
    !results.length
  ) {

    return "Veri yok";

  }


  let wins = 0;
  let draws = 0;
  let losses = 0;


  for (
    const result
    of results
  ) {

    if (
      result.home >
      result.away
    ) {

      wins++;

    } else if (
      result.home ===
      result.away
    ) {

      draws++;

    } else {

      losses++;

    }

  }


  return `${wins}G ${draws}B ${losses}M`;

}


/* =========================================================
   UTILS
   ========================================================= */

function round(
  value,
  digits = 2
) {

  const multiplier =
    Math.pow(
      10,
      digits
    );


  return Math.round(
    value *
    multiplier
  ) /
  multiplier;

}


function escapeHtml(
  value
) {

  return String(
    value ??
    ""
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


function escapeAttr(
  value
) {

  return escapeHtml(
    value
  );

}


/* =========================================================
   GLOBALS
   ========================================================= */

window.loadFixtures =
  loadFixtures;

window.openMatch =
  openMatch;

window.toggleFavorite =
  toggleFavorite;


/* =========================================================
   R❤️İ READY
   ========================================================= */

console.log(
  `%cR❤️İ Football v${RI_CONFIG.VERSION} hazır.`,
  "font-weight:bold;font-size:16px"
);
