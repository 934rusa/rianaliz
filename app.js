/* =========================================================
   R❤️İ FOOTBALL
   FRONTEND ENGINE
   ========================================================= */

"use strict";


/* =========================================================
   STATE
   ========================================================= */

const state = {

  fixtures: [],

  currentFilter: "all",

  currentLeague: "all",

  search: "",

  favorites:
    JSON.parse(
      localStorage.getItem("ri_favorites") || "[]"
    ),

  analysisCache: new Map(),

  loading: false,

  requestId: 0

};


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);


const dom = {};


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


function init() {

  dom.sidebar =
    $("#sidebar");

  dom.sidebarOverlay =
    $("#sidebarOverlay");

  dom.hamburgerBtn =
    $("#hamburgerBtn");

  dom.closeMenuBtn =
    $("#closeMenuBtn");

  dom.refreshBtn =
    $("#refreshBtn");

  dom.searchInput =
    $("#searchInput");

  dom.clearSearch =
    $("#clearSearch");

  dom.matches =
    $("#matches");

  dom.matchCount =
    $("#matchCount");

  dom.sectionTitle =
    $("#sectionTitle");

  dom.resultInfo =
    $("#resultInfo");

  dom.apiStatus =
    $("#apiStatus");

  dom.sidebarApiStatus =
    $("#sidebarApiStatus");

  dom.leagueMenu =
    $("#leagueMenu");

  dom.dateBox =
    $("#dateBox");

  dom.analysisDrawer =
    $("#analysisDrawer");

  dom.analysisContent =
    $("#analysisContent");

  dom.drawerOverlay =
    $("#drawerOverlay");

  dom.drawerClose =
    $("#drawerClose");


  bindEvents();

  updateDateUI();

  loadFixtures();

}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {

  dom.hamburgerBtn.addEventListener(
    "click",
    openSidebar
  );

  dom.closeMenuBtn.addEventListener(
    "click",
    closeSidebar
  );

  dom.sidebarOverlay.addEventListener(
    "click",
    closeSidebar
  );


  dom.refreshBtn.addEventListener(
    "click",
    () => {
      loadFixtures(true);
    }
  );


  dom.searchInput.addEventListener(
    "input",
    handleSearch
  );


  dom.clearSearch.addEventListener(
    "click",
    clearSearch
  );


  dom.drawerClose.addEventListener(
    "click",
    closeDrawer
  );


  dom.drawerOverlay.addEventListener(
    "click",
    closeDrawer
  );


  $$(".menu-item").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const filter =
            button.dataset.filter;

          applyFilter(filter);

          if (
            window.innerWidth <= 900
          ) {
            closeSidebar();
          }

        }
      );

    }
  );


  window.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape"
      ) {

        closeDrawer();

        closeSidebar();

      }

    }
  );

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {

  dom.sidebar.classList.add("open");

  dom.sidebarOverlay.classList.add("open");

}


function closeSidebar() {

  dom.sidebar.classList.remove("open");

  dom.sidebarOverlay.classList.remove("open");

}


/* =========================================================
   DATE
   ========================================================= */

function getIstanbulDate() {

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    );

  return formatter.format(
    new Date()
  );

}


function updateDateUI() {

  const date =
    getIstanbulDate();

  const parts =
    date.split("-");

  const formatted =
    `${parts[2]}.${parts[1]}.${parts[0]}`;

  dom.dateBox.textContent =
    `📅 ${formatted} — Bugünün Maçları`;

}


/* =========================================================
   LOAD FIXTURES
   ========================================================= */

async function loadFixtures(
  forceRefresh = false
) {

  if (state.loading) {
    return;
  }

  state.loading = true;

  const requestId =
    ++state.requestId;


  setLoadingState(
    true,
    "Maçlar yükleniyor..."
  );


  setApiStatus(
    "● API BAĞLANIYOR...",
    "loading"
  );


  const date =
    getIstanbulDate();


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      12000
    );


  try {

    const url =
      `/api/fixtures?date=${encodeURIComponent(date)}`;

    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: forceRefresh
            ? "no-store"
            : "default",
          signal: controller.signal
        }
      );


    clearTimeout(timeout);


    if (
      requestId !== state.requestId
    ) {
      return;
    }


    if (!response.ok) {

      throw new Error(
        `API HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    const fixtures =
      normalizeFixtures(data);


    state.fixtures =
      fixtures;


    state.analysisCache.clear();


    dom.matchCount.textContent =
      fixtures.length;


    renderLeagueMenu();


    setApiStatus(
      "● API BAĞLI",
      "success"
    );


    if (dom.sidebarApiStatus) {

      dom.sidebarApiStatus.textContent =
        `${fixtures.length} maç alındı`;

    }


    /*
      KRİTİK:
      Önce boş/loading ekranını kaldırıyoruz.
      Sonra maçları parça parça çiziyoruz.
    */

    setLoadingState(
      false
    );


    renderFixturesChunked();


  } catch (error) {

    clearTimeout(timeout);


    console.error(
      "R❤️İ fixtures error:",
      error
    );


    setApiStatus(
      "● API HATASI",
      "error"
    );


    if (
      dom.sidebarApiStatus
    ) {

      dom.sidebarApiStatus.textContent =
        "API bağlantı hatası";

    }


    setLoadingState(
      false
    );


    renderError(
      error
    );


  } finally {

    state.loading = false;

  }

}


/* =========================================================
   NORMALIZE FIXTURES
   ========================================================= */

function normalizeFixtures(data) {

  const raw =
    Array.isArray(data?.response)
      ? data.response
      : [];


  return raw
    .map(
      (item) => {

        const fixture =
          item.fixture || {};

        const league =
          item.league || {};

        const teams =
          item.teams || {};


        return {

          id:
            Number(fixture.id),

          timestamp:
            Number(
              fixture.timestamp || 0
            ),

          date:
            fixture.date || "",

          status:
            fixture.status || {},

          league: {

            id:
              Number(league.id || 0),

            name:
              league.name ||
              "Bilinmeyen Lig",

            country:
              league.country ||
              "International",

            logo:
              league.logo ||
              ""

          },

          home: {

            id:
              Number(
                teams.home?.id || 0
              ),

            name:
              teams.home?.name ||
              "Ev Sahibi",

            logo:
              teams.home?.logo ||
              ""

          },

          away: {

            id:
              Number(
                teams.away?.id || 0
              ),

            name:
              teams.away?.name ||
              "Deplasman",

            logo:
              teams.away?.logo ||
              ""

          },

          goals:
            item.goals || {},

          score:
            item.score || {}

        };

      }
    )
    .filter(
      (match) =>
        match.id &&
        match.home.name &&
        match.away.name
    )
    .sort(
      (a, b) =>
        a.timestamp - b.timestamp
    );

}


/* =========================================================
   API STATUS
   ========================================================= */

function setApiStatus(
  text,
  type
) {

  dom.apiStatus.textContent =
    text;


  if (type === "success") {

    dom.apiStatus.style.color =
      "var(--green)";

  } else if (
    type === "error"
  ) {

    dom.apiStatus.style.color =
      "var(--red)";

  } else {

    dom.apiStatus.style.color =
      "var(--yellow)";

  }

}


/* =========================================================
   LOADING
   ========================================================= */

function setLoadingState(
  loading,
  text = ""
) {

  if (loading) {

    dom.matches.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>${escapeHtml(text)}</p>
      </div>
    `;

    return;

  }

}


/* =========================================================
   ERROR
   ========================================================= */

function renderError(
  error
) {

  const isTimeout =
    error?.name === "AbortError";


  dom.matches.innerHTML = `
    <div class="empty-state">

      <div class="empty-icon">
        ⚠️
      </div>

      <h3>
        Maçlar yüklenemedi
      </h3>

      <p>
        ${
          isTimeout
            ? "API 12 saniye içinde cevap vermedi."
            : escapeHtml(
                error?.message ||
                "Bilinmeyen API hatası."
              )
        }
      </p>

      <button
        id="retryButton"
        class="refresh-btn"
        style="margin-top:16px"
      >
        ↻ Tekrar Dene
      </button>

    </div>
  `;


  const retry =
    $("#retryButton");

  if (retry) {

    retry.addEventListener(
      "click",
      () => loadFixtures(true)
    );

  }

}


/* =========================================================
   LEAGUE MENU
   ========================================================= */

function renderLeagueMenu() {

  if (!dom.leagueMenu) {
    return;
  }


  const map =
    new Map();


  for (
    const match of state.fixtures
  ) {

    const id =
      String(
        match.league.id ||
        `${match.league.name}-${match.league.country}`
      );


    if (
      !map.has(id)
    ) {

      map.set(
        id,
        match.league
      );

    }

  }


  const leagues =
    Array.from(
      map.values()
    ).sort(
      (a, b) => {

        const country =
          String(a.country)
            .localeCompare(
              String(b.country),
              "tr"
            );

        if (country !== 0) {
          return country;
        }

        return String(a.name)
          .localeCompare(
            String(b.name),
            "tr"
          );

      }
    );


  let html = `

    <button
      class="league-item ${
        state.currentLeague === "all"
          ? "active"
          : ""
      }"
      data-league-id="all"
    >
      <span class="league-logo"
            style="
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:12px;
            ">
        ⚽
      </span>

      <span class="league-info">
        <span class="league-name">
          Tüm Ligler / Turnuvalar
        </span>

        <span class="league-country">
          ${state.fixtures.length} maç
        </span>
      </span>

    </button>

  `;


  for (
    const league of leagues
  ) {

    const leagueId =
      String(league.id);


    const active =
      state.currentLeague === leagueId
        ? "active"
        : "";


    html += `

      <button
        class="league-item ${active}"
        data-league-id="${escapeHtml(leagueId)}"
      >

        ${
          league.logo
            ? `
              <img
                class="league-logo"
                src="${escapeHtml(league.logo)}"
                alt=""
                loading="lazy"
                onerror="this.style.display='none'"
              >
            `
            : `
              <span
                class="league-logo"
                style="
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-size:11px;
                "
              >
                🏆
              </span>
            `
        }

        <span class="league-info">

          <span class="league-name">
            ${escapeHtml(league.name)}
          </span>

          <span class="league-country">
            ${escapeHtml(league.country)}
          </span>

        </span>

      </button>

    `;

  }


  dom.leagueMenu.innerHTML =
    html;


  dom.leagueMenu
    .querySelectorAll(
      ".league-item"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            state.currentLeague =
              button.dataset.leagueId;

            state.currentFilter =
              "all";

            state.search =
              "";

            dom.searchInput.value =
              "";

            updateClearButton();

            updateMenuActive();

            renderLeagueMenu();

            renderFixturesChunked();

            updateSectionTitle();

            if (
              window.innerWidth <= 900
            ) {
              closeSidebar();
            }

          }
        );

      }
    );

}


/* =========================================================
   FILTER
   ========================================================= */

function applyFilter(
  filter
) {

  state.currentFilter =
    filter;


  if (
    filter === "search"
  ) {

    state.currentLeague =
      "all";

    dom.searchInput.focus();

    updateMenuActive();

    updateSectionTitle();

    renderFixturesChunked();

    return;

  }


  if (
    filter !== "all"
  ) {

    state.currentLeague =
      "all";

  }


  updateMenuActive();

  updateSectionTitle();

  renderFixturesChunked();

}


/* =========================================================
   MENU ACTIVE
   ========================================================= */

function updateMenuActive() {

  $$(".menu-item")
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.filter ===
            state.currentFilter
        );

      }
    );

}


/* =========================================================
   SEARCH
   ========================================================= */

let searchTimer = null;


function handleSearch(
  event
) {

  const value =
    event.target.value
      .trim()
      .toLocaleLowerCase(
        "tr-TR"
      );


  state.search =
    value;


  state.currentLeague =
    "all";


  /*
    Arama kutusuna bir şey yazıldığında
    otomatik olarak Maç Ara modu.
  */

  if (value) {

    state.currentFilter =
      "search";

  } else {

    if (
      state.currentFilter ===
      "search"
    ) {

      state.currentFilter =
        "all";

    }

  }


  updateClearButton();

  updateMenuActive();

  renderLeagueMenu();


  clearTimeout(
    searchTimer
  );


  searchTimer =
    setTimeout(
      () => {

        renderFixturesChunked();

        updateSectionTitle();

      },
      100
    );

}


function clearSearch() {

  dom.searchInput.value =
    "";

  state.search =
    "";

  state.currentFilter =
    "all";

  state.currentLeague =
    "all";

  updateClearButton();

  updateMenuActive();

  renderLeagueMenu();

  renderFixturesChunked();

  updateSectionTitle();

}


function updateClearButton() {

  dom.clearSearch.classList.toggle(
    "visible",
    Boolean(state.search)
  );

}


/* =========================================================
   FILTER MATCHES
   ========================================================= */

function getFilteredFixtures() {

  let list =
    state.fixtures;


  /*
    LİG FİLTRESİ
  */

  if (
    state.currentLeague !== "all"
  ) {

    list =
      list.filter(
        (match) =>
          String(
            match.league.id
          ) ===
          String(
            state.currentLeague
          )
      );

  }


  /*
    SEARCH
  */

  if (
    state.search
  ) {

    const query =
      state.search;


    list =
      list.filter(
        (match) => {

          const text =
            [
              match.home.name,
              match.away.name,
              match.league.name,
              match.league.country
            ]
              .join(" ")
              .toLocaleLowerCase(
                "tr-TR"
              );


          return text.includes(
            query
          );

        }
      );

  }


  /*
    ÖZEL FİLTRELER
  */

  switch (
    state.currentFilter
  ) {

    case "favorites":

      list =
        list.filter(
          (match) =>
            state.favorites.includes(
              match.id
            )
        );

      break;


    case "reliable":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.confidence >= 70
            );

          }
        );

      break;


    case "medium":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.confidence >= 55 &&
              analysis.confidence < 70
            );

          }
        );

      break;


    case "risky":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.confidence >= 45 &&
              analysis.confidence < 55
            );

          }
        );

      break;


    case "high":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.confidence < 55
            );

          }
        );

      break;


    case "first-half":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.firstHalfGoalProbability >= 60
            );

          }
        );

      break;


    case "second-half":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.secondHalfGoalProbability >= 60
            );

          }
        );

      break;


    case "iy2y":

      list =
        list.filter(
          (match) => {

            const analysis =
              state.analysisCache.get(
                match.id
              );

            return (
              analysis &&
              analysis.bothHalvesBTTS >= 45
            );

          }
        );

      break;


    case "score":

      list =
        list.filter(
          (match) =>
            state.analysisCache.has(
              match.id
            )
        );

      break;


    case "stats":

      list =
        list.filter(
          (match) =>
            state.analysisCache.has(
              match.id
            )
        );

      break;


    case "analysis":

      list =
        list.filter(
          (match) =>
            state.analysisCache.has(
              match.id
            )
        );

      break;

  }


  return list;

}


/* =========================================================
   SECTION TITLE
   ========================================================= */

function updateSectionTitle() {

  let title =
    "Bugünün Maçları";


  switch (
    state.currentFilter
  ) {

    case "search":
      title =
        state.search
          ? `Arama Sonuçları: ${state.search}`
          : "Maç Ara";
      break;

    case "analysis":
      title =
        "Maç Analizleri";
      break;

    case "reliable":
      title =
        "🟢 Güvenilir Seçimler";
      break;

    case "medium":
      title =
        "🟡 Orta Riskli";
      break;

    case "risky":
      title =
        "🟠 Riskli Seçimler";
      break;

    case "high":
      title =
        "🔥 Yüksek Oran Fırsatları";
      break;

    case "iy2y":
      title =
        "⚡ İY / 2Y KG";
      break;

    case "first-half":
      title =
        "1. Yarı Gol Beklenenler";
      break;

    case "second-half":
      title =
        "2. Yarı Gol Beklenenler";
      break;

    case "score":
      title =
        "🎯 Tahmini Skorlar";
      break;

    case "stats":
      title =
        "📈 İstatistikler";
      break;

    case "favorites":
      title =
        "❤️ Favoriler";
      break;

  }


  if (
    state.currentLeague !== "all"
  ) {

    const match =
      state.fixtures.find(
        (item) =>
          String(
            item.league.id
          ) ===
          String(
            state.currentLeague
          )
      );


    if (match) {

      title =
        match.league.name;

    }

  }


  dom.sectionTitle.textContent =
    title;

}


/* =========================================================
   CHUNKED RENDER
   ========================================================= */

function renderFixturesChunked() {

  updateSectionTitle();


  const fixtures =
    getFilteredFixtures();


  dom.resultInfo.textContent =
    `${fixtures.length} maç`;


  if (!fixtures.length) {

    dom.matches.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          ${
            state.currentFilter === "favorites"
              ? "❤️"
              : state.search
                ? "🔎"
                : "📭"
          }
        </div>

        <h3>
          ${
            state.search
              ? "Arama sonucu bulunamadı"
              : "Bu bölümde maç bulunamadı"
          }
        </h3>

        <p>
          ${
            state.search
              ? "Takım, lig veya ülke adını farklı yazmayı deneyebilirsin."
              : "Bu kategori için henüz eşleşen analiz verisi yok."
          }
        </p>

      </div>

    `;

    return;

  }


  dom.matches.innerHTML =
    "";


  /*
    Ligleri grupla
  */

  const groups =
    groupByLeague(
      fixtures
    );


  const groupEntries =
    Array.from(
      groups.entries()
    );


  let groupIndex = 0;


  function renderNextGroup() {

    const end =
      Math.min(
        groupIndex + 3,
        groupEntries.length
      );


    const fragment =
      document.createDocumentFragment();


    for (
      ;
      groupIndex < end;
      groupIndex++
    ) {

      const [
        groupKey,
        group
      ] =
        groupEntries[groupIndex];


      fragment.appendChild(
        createLeagueGroup(
          group
        )
      );

    }


    dom.matches.appendChild(
      fragment
    );


    if (
      groupIndex <
      groupEntries.length
    ) {

      requestAnimationFrame(
        renderNextGroup
      );

    }

  }


  requestAnimationFrame(
    renderNextGroup
  );

}


/* =========================================================
   GROUP BY LEAGUE
   ========================================================= */

function groupByLeague(
  fixtures
) {

  const groups =
    new Map();


  for (
    const match of fixtures
  ) {

    const key =
      `${match.league.id}-${match.league.name}`;


    if (
      !groups.has(key)
    ) {

      groups.set(
        key,
        {
          league:
            match.league,

          fixtures: []
        }
      );

    }


    groups
      .get(key)
      .fixtures
      .push(match);

  }


  return groups;

}


/* =========================================================
   CREATE LEAGUE GROUP
   ========================================================= */

function createLeagueGroup(
  group
) {

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "league-group";


  const logo =
    group.league.logo
      ? `
        <img
          class="league-group-logo"
          src="${escapeHtml(group.league.logo)}"
          alt=""
          loading="lazy"
        >
      `
      : `
        <div
          class="league-group-logo"
          style="
            display:flex;
            align-items:center;
            justify-content:center;
          "
        >
          🏆
        </div>
      `;


  wrapper.innerHTML = `

    <div class="league-group-header">

      ${logo}

      <div>

        <div class="league-group-name">
          ${escapeHtml(group.league.name)}
        </div>

      </div>

      <div class="league-group-country">
        ${escapeHtml(group.league.country)}
      </div>

    </div>

    <div class="league-group-grid"></div>

  `;


  const grid =
    wrapper.querySelector(
      ".league-group-grid"
    );


  const fragment =
    document.createDocumentFragment();


  for (
    const match of group.fixtures
  ) {

    fragment.appendChild(
      createMatchCard(
        match
      )
    );

  }


  grid.appendChild(
    fragment
  );


  return wrapper;

}


/* =========================================================
   CREATE MATCH CARD
   ========================================================= */

function createMatchCard(
  match
) {

  const card =
    document.createElement(
      "article"
    );

  card.className =
    "match-card";


  const favorite =
    state.favorites.includes(
      match.id
    );


  const time =
    formatMatchTime(
      match
    );


  const status =
    getStatusText(
      match.status
    );


  const homeLogo =
    match.home.logo ||
    "";


  const awayLogo =
    match.away.logo ||
    "";


  card.innerHTML = `

    <button
      class="favorite-btn ${
        favorite ? "active" : ""
      }"
      data-favorite="${match.id}"
      aria-label="Favori"
    >
      ${favorite ? "♥" : "♡"}
    </button>


    <div class="match-top">

      <span class="match-time">
        ${escapeHtml(time)}
      </span>

      <span class="match-status">
        ${escapeHtml(status)}
      </span>

    </div>


    <div class="teams">

      <div class="team">

        ${
          homeLogo
            ? `
              <img
                src="${escapeHtml(homeLogo)}"
                alt=""
                loading="lazy"
                onerror="this.style.display='none'"
              >
            `
            : `
              <div
                style="
                  width:39px;
                  height:39px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  border-radius:50%;
                  background:rgba(255,255,255,.04);
                "
              >
                ⚽
              </div>
            `
        }

        <div class="team-name">
          ${escapeHtml(match.home.name)}
        </div>

      </div>


      <div class="vs">
        VS
      </div>


      <div class="team">

        ${
          awayLogo
            ? `
              <img
                src="${escapeHtml(awayLogo)}"
                alt=""
                loading="lazy"
                onerror="this.style.display='none'"
              >
            `
            : `
              <div
                style="
                  width:39px;
                  height:39px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  border-radius:50%;
                  background:rgba(255,255,255,.04);
                "
              >
                ⚽
              </div>
            `
        }

        <div class="team-name">
          ${escapeHtml(match.away.name)}
        </div>

      </div>

    </div>


    <div class="match-bottom">

      <span class="match-analysis-label">
        Veri analizi
      </span>

      <span class="play-button">
        ŞUNU OYNA →
      </span>

    </div>

  `;


  /*
    Favori butonu
  */

  const favoriteButton =
    card.querySelector(
      "[data-favorite]"
    );


  favoriteButton.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      toggleFavorite(
        match.id
      );

    }
  );


  /*
    Kart
  */

  card.addEventListener(
    "click",
    () => {

      openMatchAnalysis(
        match
      );

    }
  );


  return card;

}


/* =========================================================
   FAVORITES
   ========================================================= */

function toggleFavorite(
  fixtureId
) {

  const index =
    state.favorites.indexOf(
      fixtureId
    );


  if (index >= 0) {

    state.favorites.splice(
      index,
      1
    );

  } else {

    state.favorites.push(
      fixtureId
    );

  }


  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(
      state.favorites
    )
  );


  renderFixturesChunked();

}


/* =========================================================
   TIME
   ========================================================= */

function formatMatchTime(
  match
) {

  if (
    match.status?.short === "NS" ||
    match.status?.short === "TBD"
  ) {

    if (
      match.date
    ) {

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
          new Date(match.date)
        );

      } catch {}

    }

  }


  if (
    match.status?.elapsed != null
  ) {

    return `${match.status.elapsed}'`;

  }


  return (
    match.status?.short ||
    "—"
  );

}


function getStatusText(
  status
) {

  const short =
    status?.short;


  const map = {

    NS: "Başlamadı",

    TBD: "Belirsiz",

    LIVE: "CANLI",

    HT: "DEVRE",

    FT: "Bitti",

    AET: "Uzatma",

    PEN: "Penaltı",

    PST: "Ertelendi",

    CANC: "İptal",

    ABD: "Durduruldu"

  };


  return (
    map[short] ||
    short ||
    "—"
  );

}


/* =========================================================
   OPEN ANALYSIS
   ========================================================= */

async function openMatchAnalysis(
  match
) {

  openDrawer();

  dom.analysisContent.innerHTML = `

    <div class="loading">

      <div class="spinner"></div>

      <p>
        ${escapeHtml(match.home.name)}
        -
        ${escapeHtml(match.away.name)}
        analiz ediliyor...
      </p>

    </div>

  `;


  /*
    Daha önce çekilmişse tekrar API çağrısı yok.
  */

  if (
    state.analysisCache.has(
      match.id
    )
  ) {

    const cached =
      state.analysisCache.get(
        match.id
      );


    renderAnalysis(
      match,
      cached
    );

    return;

  }


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    );


  try {

    const response =
      await fetch(
        `/api/match?fixture=${encodeURIComponent(match.id)}`,
        {
          signal: controller.signal
        }
      );


    clearTimeout(timeout);


    if (!response.ok) {

      throw new Error(
        `Analiz API HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    const analysis =
      buildAnalysis(
        match,
        data
      );


    state.analysisCache.set(
      match.id,
      analysis
    );


    renderAnalysis(
      match,
      analysis
    );


  } catch (error) {

    clearTimeout(timeout);


    console.error(
      "Analysis error:",
      error
    );


    /*
      API/match başarısız olsa bile
      temel analiz göster.
    */

    const fallback =
      buildAnalysis(
        match,
        null
      );


    state.analysisCache.set(
      match.id,
      fallback
    );


    renderAnalysis(
      match,
      fallback,
      error
    );

  }

}


/* =========================================================
   ANALYSIS ENGINE
   ========================================================= */

function buildAnalysis(
  match,
  apiData
) {

  const root =
    apiData?.analysis_data ||
    apiData?.data?.analysis_data ||
    {};


  const homeStats =
    root.team_statistics?.home ||
    root.team_statistics?.home_team ||
    root.home_statistics ||
    {};


  const awayStats =
    root.team_statistics?.away ||
    root.team_statistics?.away_team ||
    root.away_statistics ||
    {};


  const homeLast =
    root.last_matches?.home ||
    root.home_last_matches ||
    [];


  const awayLast =
    root.last_matches?.away ||
    root.away_last_matches ||
    [];


  const h2h =
    root.h2h ||
    [];


  const odds =
    root.odds ||
    {};


  const apiPrediction =
    root.api_prediction ||
    apiData?.api_prediction ||
    {};


  const homeGoals =
    averageGoals(
      homeLast,
      "home"
    );


  const awayGoals =
    averageGoals(
      awayLast,
      "away"
    );


  const homeConceded =
    averageConceded(
      homeLast,
      "home"
    );


  const awayConceded =
    averageConceded(
      awayLast,
      "away"
    );


  const homeForm =
    formScore(
      homeLast
    );


  const awayForm =
    formScore(
      awayLast
    );


  /*
    Beklenen gol.
    Aşırı şişirmemek için sınırlandırıyoruz.
  */

  let expectedHome =
    weightedExpectedGoals(
      homeGoals,
      awayConceded,
      1.35
    );


  let expectedAway =
    weightedExpectedGoals(
      awayGoals,
      homeConceded,
      1.10
    );


  /*
    Ev avantajı
  */

  expectedHome *=
    1.08;


  /*
    Form etkisi
  */

  const formDifference =
    homeForm -
    awayForm;


  expectedHome +=
    clamp(
      formDifference * 0.12,
      -0.18,
      0.18
    );


  expectedAway +=
    clamp(
      -formDifference * 0.08,
      -0.12,
      0.12
    );


  expectedHome =
    clamp(
      expectedHome,
      0.20,
      3.60
    );


  expectedAway =
    clamp(
      expectedAway,
      0.20,
      3.30
    );


  const totalExpected =
    expectedHome +
    expectedAway;


  const poisson =
    poissonMarkets(
      expectedHome,
      expectedAway
    );


  const h2hBTTS =
    calculateH2HBTTS(
      h2h
    );


  const apiHome =
    extractPercent(
      apiPrediction?.percent?.home ??
      apiPrediction?.home ??
      apiPrediction?.predictions?.home
    );


  const apiDraw =
    extractPercent(
      apiPrediction?.percent?.draw ??
      apiPrediction?.draw
    );


  const apiAway =
    extractPercent(
      apiPrediction?.percent?.away ??
      apiPrediction?.away ??
      apiPrediction?.predictions?.away
    );


  /*
    API Prediction varsa hafif ağırlık.
  */

  const ms1 =
    blendProbability(
      poisson.homeWin,
      apiHome,
      0.20
    );


  const draw =
    blendProbability(
      poisson.draw,
      apiDraw,
      0.20
    );


  const ms2 =
    blendProbability(
      poisson.awayWin,
      apiAway,
      0.20
    );


  /*
    KG
  */

  let btts =
    poisson.btts;


  if (
    h2hBTTS != null
  ) {

    btts =
      btts * 0.82 +
      h2hBTTS * 0.18;

  }


  /*
    Yarı tahmini.
    Ana toplam gole göre hesaplanır.
  */

  const firstHalfExpected =
    totalExpected * 0.43;


  const secondHalfExpected =
    totalExpected * 0.57;


  const firstHalfGoalProbability =
    probabilityAtLeastOne(
      firstHalfExpected
    ) * 100;


  const secondHalfGoalProbability =
    probabilityAtLeastOne(
      secondHalfExpected
    ) * 100;


  const firstHalfBTTS =
    halfBTTSProbability(
      expectedHome * 0.43,
      expectedAway * 0.43
    );


  const secondHalfBTTS =
    halfBTTSProbability(
      expectedHome * 0.57,
      expectedAway * 0.57
    );


  const bothHalvesBTTS =
    firstHalfBTTS *
    secondHalfBTTS /
    100;


  /*
    Ana seçim.
    Basit O1.5'i otomatik banko yapmıyoruz.
  */

  const markets = [

    {
      name: "MS 1",
      probability: ms1,
      priority: 1
    },

    {
      name: "MS X",
      probability: draw,
      priority: 0.6
    },

    {
      name: "MS 2",
      probability: ms2,
      priority: 1
    },

    {
      name: "KG Var",
      probability: btts,
      priority: 1.05
    },

    {
      name: "2.5 ÜST",
      probability:
        poisson.over25,
      priority: 1.05
    },

    {
      name: "2.5 ALT",
      probability:
        poisson.under25,
      priority: 0.95
    },

    {
      name: "1.5 ÜST",
      probability:
        poisson.over15,
      priority: 0.45
    },

    {
      name: "1Y Gol Var",
      probability:
        firstHalfGoalProbability,
      priority: 0.90
    },

    {
      name: "2Y Gol Var",
      probability:
        secondHalfGoalProbability,
      priority: 0.90
    },

    {
      name: "İY KG",
      probability:
        firstHalfBTTS,
      priority: 1.0
    },

    {
      name: "2Y KG",
      probability:
        secondHalfBTTS,
      priority: 1.0
    },

    {
      name: "İY KG + 2Y KG",
      probability:
        bothHalvesBTTS,
      priority: 1.10
    }

  ];


  const eligibleMarkets =
    markets.filter(
      (market) => {

        /*
          Çok düşük olasılıklı seçimleri
          ana öneriye sokma.
        */

        if (
          market.probability < 50
        ) {
          return false;
        }


        /*
          O1.5'in doğal avantajını kır.
        */

        if (
          market.name ===
          "1.5 ÜST" &&
          market.probability < 78
        ) {

          return false;

        }


        return true;

      }
    );


  eligibleMarkets.sort(
    (a, b) => {

      const scoreA =
        a.probability *
        a.priority;

      const scoreB =
        b.probability *
        b.priority;

      return scoreB - scoreA;

    }
  );


  const strongest =
    eligibleMarkets[0] ||
    {
      name: "Veri Yetersiz",
      probability: 0
    };


  const confidence =
    clamp(
      strongest.probability,
      0,
      100
    );


  const risk =
    getRiskLabel(
      confidence
    );


  const score =
    predictedScore(
      expectedHome,
      expectedAway
    );


  const reasons =
    buildReasons(
      match,
      {
        homeGoals,
        awayGoals,
        homeConceded,
        awayConceded,
        homeForm,
        awayForm,
        totalExpected,
        btts,
        firstHalfGoalProbability,
        secondHalfGoalProbability,
        h2hBTTS,
        homeStats,
        awayStats
      },
      strongest
    );


  return {

    expectedHome,

    expectedAway,

    totalExpected,

    confidence,

    risk,

    strongest,

    score,

    ms1,

    draw,

    ms2,

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

    firstHalfGoalProbability,

    secondHalfGoalProbability,

    firstHalfBTTS,

    secondHalfBTTS,

    bothHalvesBTTS,

    homeForm,

    awayForm,

    h2hBTTS,

    reasons,

    apiData,

    dataStatus:
      apiData?.data_status ||
      apiData?.status ||
      {}

  };

}


/* =========================================================
   FORM
   ========================================================= */

function formScore(
  fixtures
) {

  if (
    !Array.isArray(fixtures) ||
    !fixtures.length
  ) {

    return 0;

  }


  let score = 0;

  let count = 0;


  for (
    const item of fixtures.slice(
      0,
      10
    )
  ) {

    const goals =
      item.goals ||
      item.score ||
      {};


    const gf =
      Number(
        item.gf ??
        goals.gf ??
        0
      );


    const ga =
      Number(
        item.ga ??
        goals.ga ??
        0
      );


    if (
      Number.isFinite(gf) &&
      Number.isFinite(ga)
    ) {

      if (gf > ga) {
        score += 3;
      } else if (gf === ga) {
        score += 1;
      }

      count += 3;

    }

  }


  if (!count) {
    return 0;
  }


  return (
    score /
    count
  );

}


/* =========================================================
   GOALS
   ========================================================= */

function averageGoals(
  fixtures,
  side
) {

  if (
    !Array.isArray(fixtures) ||
    !fixtures.length
  ) {

    return 1.20;

  }


  let total = 0;

  let count = 0;


  for (
    const item of fixtures.slice(
      0,
      10
    )
  ) {

    const goals =
      item.goals ||
      item.score ||
      {};


    let value;


    if (
      item.gf != null
    ) {

      value =
        Number(item.gf);

    } else if (
      side === "home"
    ) {

      value =
        Number(
          goals.for ??
          goals.home ??
          0
        );

    } else {

      value =
        Number(
          goals.for ??
          goals.away ??
          0
        );

    }


    if (
      Number.isFinite(value)
    ) {

      total += value;

      count++;

    }

  }


  return count
    ? total / count
    : 1.20;

}


function averageConceded(
  fixtures,
  side
) {

  if (
    !Array.isArray(fixtures) ||
    !fixtures.length
  ) {

    return 1.20;

  }


  let total = 0;

  let count = 0;


  for (
    const item of fixtures.slice(
      0,
      10
    )
  ) {

    const goals =
      item.goals ||
      item.score ||
      {};


    let value;


    if (
      item.ga != null
    ) {

      value =
        Number(item.ga);

    } else if (
      side === "home"
    ) {

      value =
        Number(
          goals.against ??
          goals.away ??
          0
        );

    } else {

      value =
        Number(
          goals.against ??
          goals.home ??
          0
        );

    }


    if (
      Number.isFinite(value)
    ) {

      total += value;

      count++;

    }

  }


  return count
    ? total / count
    : 1.20;

}


/* =========================================================
   EXPECTED GOALS
   ========================================================= */

function weightedExpectedGoals(
  attack,
  defense,
  base
) {

  const value =
    (
      attack * 0.58 +
      defense * 0.42
    );


  return (
    value * 0.78 +
    base * 0.22
  );

}


/* =========================================================
   POISSON
   ========================================================= */

function poissonMarkets(
  lambdaHome,
  lambdaAway
) {

  const maxGoals = 7;


  const homeDist =
    poissonDistribution(
      lambdaHome,
      maxGoals
    );


  const awayDist =
    poissonDistribution(
      lambdaAway,
      maxGoals
    );


  let homeWin = 0;

  let draw = 0;

  let awayWin = 0;

  let under25 = 0;

  let under35 = 0;

  let over15 = 0;

  let over25 = 0;

  let over35 = 0;

  let btts = 0;


  for (
    let h = 0;
    h <= maxGoals;
    h++
  ) {

    for (
      let a = 0;
      a <= maxGoals;
      a++
    ) {

      const probability =
        homeDist[h] *
        awayDist[a];


      if (
        h > a
      ) {
        homeWin += probability;
      }

      if (
        h === a
      ) {
        draw += probability;
      }

      if (
        h < a
      ) {
        awayWin += probability;
      }


      const total =
        h + a;


      if (
        total <= 2
      ) {
        under25 += probability;
      }

      if (
        total <= 3
      ) {
        under35 += probability;
      }

      if (
        total >= 2
      ) {
        over15 += probability;
      }

      if (
        total >= 3
      ) {
        over25 += probability;
      }

      if (
        total >= 4
      ) {
        over35 += probability;
      }


      if (
        h >= 1 &&
        a >= 1
      ) {

        btts += probability;

      }

    }

  }


  return {

    homeWin:
      homeWin * 100,

    draw:
      draw * 100,

    awayWin:
      awayWin * 100,

    under25:
      under25 * 100,

    under35:
      under35 * 100,

    over15:
      over15 * 100,

    over25:
      over25 * 100,

    over35:
      over35 * 100,

    btts:
      btts * 100

  };

}


function poissonDistribution(
  lambda,
  max
) {

  const values = [];

  let total = 0;


  for (
    let k = 0;
    k <= max;
    k++
  ) {

    const probability =
      Math.exp(-lambda) *
      Math.pow(lambda, k) /
      factorial(k);


    values.push(
      probability
    );


    total += probability;

  }


  return values.map(
    (value) =>
      value / total
  );

}


function factorial(
  n
) {

  if (
    n <= 1
  ) {
    return 1;
  }


  let result = 1;


  for (
    let i = 2;
    i <= n;
    i++
  ) {

    result *= i;

  }


  return result;

}


/* =========================================================
   HALF PROBABILITIES
   ========================================================= */

function probabilityAtLeastOne(
  expected
) {

  return (
    1 -
    Math.exp(-expected)
  );

}


function halfBTTSProbability(
  home,
  away
) {

  const homeGoal =
    probabilityAtLeastOne(
      home
    );


  const awayGoal =
    probabilityAtLeastOne(
      away
    );


  return (
    homeGoal *
    awayGoal *
    100
  );

}


/* =========================================================
   H2H
   ========================================================= */

function calculateH2HBTTS(
  h2h
) {

  if (
    !Array.isArray(h2h) ||
    !h2h.length
  ) {

    return null;

  }


  let total = 0;

  let count = 0;


  for (
    const item of h2h.slice(
      0,
      10
    )
  ) {

    const goals =
      item.goals ||
      item.score ||
      {};


    const home =
      Number(
        goals.home ??
        item.home_goals
      );


    const away =
      Number(
        goals.away ??
        item.away_goals
      );


    if (
      Number.isFinite(home) &&
      Number.isFinite(away)
    ) {

      if (
        home >= 1 &&
        away >= 1
      ) {

        total += 100;

      }

      count++;

    }

  }


  return count
    ? total / count
    : null;

}


/* =========================================================
   PREDICTED SCORE
   ========================================================= */

function predictedScore(
  home,
  away
) {

  return {

    home:
      Math.min(
        5,
        Math.max(
          0,
          Math.round(home)
        )
      ),

    away:
      Math.min(
        5,
        Math.max(
          0,
          Math.round(away)
        )
      )

  };

}


/* =========================================================
   REASONS
   ========================================================= */

function buildReasons(
  match,
  data,
  strongest
) {

  const reasons = [];


  if (
    data.homeForm >
    data.awayForm + 0.10
  ) {

    reasons.push(
      `${match.home.name} son maç formunda rakibine göre daha iyi görünüyor.`
    );

  } else if (
    data.awayForm >
    data.homeForm + 0.10
  ) {

    reasons.push(
      `${match.away.name} son maç formunda daha güçlü görünüyor.`
    );

  } else {

    reasons.push(
      "İki takımın son dönem form seviyeleri birbirine yakın."
    );

  }


  if (
    data.totalExpected >= 2.60
  ) {

    reasons.push(
      `Toplam beklenen gol yaklaşık ${data.totalExpected.toFixed(2)} seviyesinde.`
    );

  } else {

    reasons.push(
      `Toplam beklenen gol yaklaşık ${data.totalExpected.toFixed(2)} seviyesinde.`
    );

  }


  if (
    data.btts >= 60
  ) {

    reasons.push(
      `KG Var olasılığı modelde yaklaşık %${Math.round(data.btts)}.`
    );

  }


  if (
    data.firstHalfGoalProbability >= 60
  ) {

    reasons.push(
      `1. yarıda en az bir gol ihtimali yaklaşık %${Math.round(data.firstHalfGoalProbability)}.`
    );

  }


  if (
    data.secondHalfGoalProbability >= 65
  ) {

    reasons.push(
      `2. yarıda en az bir gol ihtimali yaklaşık %${Math.round(data.secondHalfGoalProbability)}.`
    );

  }


  if (
    data.h2hBTTS != null
  ) {

    reasons.push(
      `Son H2H verilerinde KG oranı yaklaşık %${Math.round(data.h2hBTTS)}.`
    );

  }


  reasons.push(
    `Ana model seçimi: ${strongest.name} — yaklaşık %${Math.round(strongest.probability)}.`
  );


  return reasons.slice(
    0,
    6
  );

}


/* =========================================================
   RISK
   ========================================================= */

function getRiskLabel(
  confidence
) {

  if (
    confidence >= 75
  ) {

    return {
      label:
        "🟢 Güvenilir",
      className:
        "reliable"
    };

  }


  if (
    confidence >= 60
  ) {

    return {
      label:
        "🟡 Orta Risk",
      className:
        "medium"
    };

  }


  if (
    confidence >= 50
  ) {

    return {
      label:
        "🟠 Riskli",
      className:
        "risky"
    };

  }


  return {
    label:
      "🔴 Yüksek Risk",
    className:
      "high"
  };

}


/* =========================================================
   RENDER ANALYSIS
   ========================================================= */

function renderAnalysis(
  match,
  analysis,
  error = null
) {

  const score =
    analysis.score;


  const strongest =
    analysis.strongest;


  const risk =
    analysis.risk;


  const confidence =
    Math.round(
      analysis.confidence
    );


  const warning =
    error
      ? `
        <div class="analysis-section"
             style="
               border-color:rgba(255,150,56,.2);
               color:#d8a36e;
             ">
          ⚠️ Detay API'si cevap vermedi.
          Aşağıdaki temel model analizi
          mevcut maç verileriyle oluşturuldu.
        </div>
      `
      : "";


  dom.analysisContent.innerHTML = `

    <div class="analysis-panel">

      ${warning}


      <div class="analysis-header">

        <div class="analysis-league">

          ${escapeHtml(match.league.name)}
          ·
          ${escapeHtml(match.league.country)}

        </div>


        <div class="analysis-teams">

          <div class="analysis-team">

            ${
              match.home.logo
                ? `
                  <img
                    src="${escapeHtml(match.home.logo)}"
                    alt=""
                  >
                `
                : "⚽"
            }

            <div class="analysis-team-name">
              ${escapeHtml(match.home.name)}
            </div>

          </div>


          <div class="analysis-vs">
            VS
          </div>


          <div class="analysis-team">

            ${
              match.away.logo
                ? `
                  <img
                    src="${escapeHtml(match.away.logo)}"
                    alt=""
                  >
                `
                : "⚽"
            }

            <div class="analysis-team-name">
              ${escapeHtml(match.away.name)}
            </div>

          </div>

        </div>

      </div>


      <div class="analysis-section">

        <div class="strongest-selection">

          <div class="label">
            🎯 ŞUNU OYNA
          </div>

          <div class="pick">
            ${escapeHtml(strongest.name)}
          </div>


          <div class="confidence-wrap">

            <div class="confidence-head">

              <span>
                Model güven seviyesi
              </span>

              <strong>
                %${confidence}
              </strong>

            </div>

            <div class="confidence-bar">

              <div
                class="confidence-fill"
                style="
                  width:${confidence}%;
                "
              ></div>

            </div>

          </div>


          <div class="risk">
            ${escapeHtml(risk.label)}
          </div>

        </div>

      </div>


      <div class="analysis-section">

        <h3>
          🎯 Tahmini Skor
        </h3>

        <div class="score-box">
          ${score.home} - ${score.away}
        </div>

      </div>


      <div class="analysis-section">

        <h3>
          📊 Maç Piyasaları
        </h3>

        <div class="market-grid">

          ${marketHtml(
            "MS 1",
            analysis.ms1
          )}

          ${marketHtml(
            "MS X",
            analysis.draw
          )}

          ${marketHtml(
            "MS 2",
            analysis.ms2
          )}

          ${marketHtml(
            "KG Var",
            analysis.btts
          )}

          ${marketHtml(
            "KG Yok",
            analysis.noBtts
          )}

          ${marketHtml(
            "1.5 ÜST",
            analysis.over15
          )}

          ${marketHtml(
            "2.5 ÜST",
            analysis.over25
          )}

          ${marketHtml(
            "3.5 ÜST",
            analysis.over35
          )}

          ${marketHtml(
            "2.5 ALT",
            analysis.under25
          )}

          ${marketHtml(
            "3.5 ALT",
            analysis.under35
          )}

        </div>

      </div>


      <div class="analysis-section">

        <h3>
          ⚡ Yarı Bazlı Analiz
        </h3>

        <div class="market-grid">

          ${marketHtml(
            "1Y Gol",
            analysis.firstHalfGoalProbability
          )}

          ${marketHtml(
            "2Y Gol",
            analysis.secondHalfGoalProbability
          )}

          ${marketHtml(
            "İY KG",
            analysis.firstHalfBTTS
          )}

          ${marketHtml(
            "2Y KG",
            analysis.secondHalfBTTS
          )}

          ${marketHtml(
            "İY KG + 2Y KG",
            analysis.bothHalvesBTTS
          )}

        </div>

      </div>


      <div class="analysis-section">

        <h3>
          📈 Beklenen Goller
        </h3>

        <div class="market-grid">

          ${marketHtml(
            match.home.name,
            analysis.expectedHome,
            true
          )}

          ${marketHtml(
            match.away.name,
            analysis.expectedAway,
            true
          )}

          ${marketHtml(
            "Toplam",
            analysis.totalExpected,
            true
          )}

        </div>

      </div>


      <div class="analysis-section">

        <h3>
          🧠 Analiz Gerekçeleri
        </h3>

        <ul class="analysis-reasons">

          ${
            analysis.reasons
              .map(
                (reason) =>
                  `<li>${escapeHtml(reason)}</li>`
              )
              .join("")
          }

        </ul>

      </div>


      <div class="analysis-section">

        <h3>
          🛰️ Veri Durumu
        </h3>

        <div class="data-status">

          ${dataStatusHtml(
            "Son Form",
            true
          )}

          ${dataStatusHtml(
            "H2H",
            analysis.h2hBTTS != null
          )}

          ${dataStatusHtml(
            "Kadro",
            hasData(
              analysis.apiData,
              "lineups"
            )
          )}

          ${dataStatusHtml(
            "Sakatlık",
            hasData(
              analysis.apiData,
              "injuries"
            )
          )}

          ${dataStatusHtml(
            "İstatistik",
            hasData(
              analysis.apiData,
              "statistics"
            )
          )}

          ${dataStatusHtml(
            "Oran",
            hasData(
              analysis.apiData,
              "odds"
            )
          )}

          ${dataStatusHtml(
            "API Tahmini",
            hasData(
              analysis.apiData,
              "api_prediction"
            )
          )}

        </div>

      </div>


      <div
        style="
          margin-top:15px;
          color:#586f65;
          font-size:8px;
          line-height:1.6;
        "
      >
        R❤️İ model sonuçları istatistiksel analizdir;
        kesin sonuç veya garanti değildir.
      </div>

    </div>

  `;

}


/* =========================================================
   MARKET HTML
   ========================================================= */

function marketHtml(
  name,
  value,
  decimal = false
) {

  if (
    value == null ||
    !Number.isFinite(
      Number(value)
    )
  ) {

    return `

      <div class="market-card">

        <div class="market-name">
          ${escapeHtml(name)}
        </div>

        <strong>
          Veri yok
        </strong>

      </div>

    `;

  }


  const number =
    Number(value);


  const display =
    decimal
      ? number.toFixed(2)
      : `%${Math.round(number)}`;


  return `

    <div class="market-card">

      <div class="market-name">
        ${escapeHtml(name)}
      </div>

      <strong>
        ${display}
      </strong>

      ${
        decimal
          ? ""
          : `
            <div class="percent">
              Olasılık
            </div>
          `
      }

    </div>

  `;

}


/* =========================================================
   DATA STATUS
   ========================================================= */

function dataStatusHtml(
  name,
  available
) {

  return `

    <div class="data-status-item">

      ${available ? "🟢" : "⚪"}

      ${escapeHtml(name)}

    </div>

  `;

}


function hasData(
  data,
  key
) {

  if (!data) {
    return false;
  }


  const root =
    data.analysis_data ||
    data;


  const value =
    root[key];


  if (
    Array.isArray(value)
  ) {

    return value.length > 0;

  }


  return Boolean(
    value &&
    typeof value === "object"
      ? Object.keys(value).length
      : value
  );

}


/* =========================================================
   DRAWER
   ========================================================= */

function openDrawer() {

  dom.analysisDrawer.classList.add(
    "open"
  );

  dom.drawerOverlay.classList.add(
    "open"
  );

  document.body.style.overflow =
    "hidden";

}


function closeDrawer() {

  dom.analysisDrawer.classList.remove(
    "open"
  );

  dom.drawerOverlay.classList.remove(
    "open"
  );

  document.body.style.overflow =
    "";

}


/* =========================================================
   UTILITIES
   ========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.min(
    max,
    Math.max(
      min,
      Number(value) || 0
    )
  );

}


function blendProbability(
  primary,
  secondary,
  weight
) {

  if (
    secondary == null ||
    !Number.isFinite(
      secondary
    )
  ) {

    return primary;

  }


  return (
    primary * (1 - weight) +
    secondary * weight
  );

}


function extractPercent(
  value
) {

  if (
    value == null
  ) {

    return null;

  }


  if (
    typeof value === "number"
  ) {

    return clamp(
      value,
      0,
      100
    );

  }


  const text =
    String(value)
      .replace(
        ",",
        "."
      );


  const match =
    text.match(
      /-?\d+(?:\.\d+)?/
    );


  if (!match) {

    return null;

  }


  return clamp(
    Number(match[0]),
    0,
    100
  );

}


function escapeHtml(
  value
) {

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
