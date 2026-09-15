// ============================================================
// R❤️İ FOOTBALL — MAIN APPLICATION
// API-FOOTBALL + STATISTICAL MODEL + OPENAI AI
// ============================================================

"use strict";

// ============================================================
// STATE
// ============================================================

const state = {
  fixtures: [],
  filteredFixtures: [],
  currentFilter: "all",
  currentLeague: "all",
  search: "",
  selectedDate: "",
  favorites: new Set(),
  analysisCache: new Map(),
  loading: false,
  requestId: 0
};

// ============================================================
// FAVORITES
// ============================================================

try {
  const saved =
    JSON.parse(
      localStorage.getItem("ri_favorites") || "[]"
    );

  if (Array.isArray(saved)) {
    state.favorites = new Set(
      saved.map(Number)
    );
  }
} catch {
  state.favorites = new Set();
}

// ============================================================
// DOM HELPER
// ============================================================

function $(...selectors) {
  for (const selector of selectors) {
    try {
      const element =
        document.querySelector(selector);

      if (element) return element;
    } catch {}
  }

  return null;
}

// ============================================================
// DOM
// ============================================================

const dom = {
  date:
    $("#dateInput") ||
    $("#date") ||
    $("#matchDate") ||
    document.querySelector(
      'input[type="date"]'
    ),

  search:
    $("#searchInput") ||
    $("#search") ||
    $("#matchSearch") ||
    document.querySelector(
      'input[type="search"]'
    ),

  matches:
    $("#matchesGrid") ||
    $("#matches") ||
    $("#fixtures") ||
    $("#matchList") ||
    $(".matches-grid") ||
    $(".matches"),

  leagues:
    $("#leagueMenu") ||
    $("#leagueList") ||
    $("#leagues") ||
    $("#league-menu") ||
    $(".league-menu") ||
    $(".league-list"),

  drawer:
    $("#analysisDrawer") ||
    $("#matchDrawer") ||
    $("#analysis-drawer") ||
    $(".analysis-drawer"),

  drawerContent:
    $("#analysisContent") ||
    $("#analysisBody") ||
    $("#analysis-content") ||
    $(".analysis-content"),

  drawerClose:
    $("#analysisClose") ||
    $("#drawerClose") ||
    $("#analysis-close") ||
    $(".analysis-close"),

  loading:
    $("#loading") ||
    $("#globalLoading") ||
    $(".loading")
};

// ============================================================
// INIT
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  init
);

async function init() {
  setupDate();
  setupEvents();
  renderFavoriteCount();

  await loadFixtures();
}

// ============================================================
// DATE
// ============================================================

function getIstanbulDate() {
  try {
    return new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).format(new Date());
  } catch {
    const now = new Date();

    return [
      now.getFullYear(),
      String(
        now.getMonth() + 1
      ).padStart(2, "0"),
      String(
        now.getDate()
      ).padStart(2, "0")
    ].join("-");
  }
}

function setupDate() {
  if (!dom.date) {
    state.selectedDate =
      getIstanbulDate();

    return;
  }

  if (!dom.date.value) {
    dom.date.value =
      getIstanbulDate();
  }

  state.selectedDate =
    dom.date.value;
}

// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  // DATE
  if (dom.date) {
    dom.date.addEventListener(
      "change",
      async () => {
        state.selectedDate =
          dom.date.value ||
          getIstanbulDate();

        await loadFixtures();
      }
    );
  }

  // SEARCH
  if (dom.search) {
    dom.search.addEventListener(
      "input",
      () => {
        state.search =
          String(
            dom.search.value || ""
          )
            .trim()
            .toLowerCase();

        applyFilters();
        renderFixtures();
      }
    );
  }

  // LEAGUE MENU
  if (dom.leagues) {
    dom.leagues.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-league]"
          );

        if (!button) return;

        state.currentLeague =
          button.dataset.league ||
          "all";

        applyFilters();
        renderFixtures();

        dom.leagues
          .querySelectorAll(
            "[data-league]"
          )
          .forEach(item => {
            item.classList.remove(
              "active"
            );
          });

        button.classList.add(
          "active"
        );
      }
    );
  }

  // MATCH CARDS
  if (dom.matches) {
    dom.matches.addEventListener(
      "click",
      event => {

        // FAVORITE
        const favorite =
          event.target.closest(
            "[data-favorite]"
          );

        if (favorite) {
          event.stopPropagation();

          toggleFavorite(
            Number(
              favorite.dataset.favorite
            )
          );

          return;
        }

        // ANALYSIS BUTTON / CARD
        const card =
          event.target.closest(
            "[data-fixture]"
          );

        if (!card) return;

        const fixtureId =
          Number(
            card.dataset.fixture
          );

        const match =
          state.fixtures.find(
            item =>
              Number(item.id) ===
              fixtureId
          );

        if (match) {
          openMatchAnalysis(
            match
          );
        }
      }
    );
  }

  // DRAWER CLOSE
  if (dom.drawerClose) {
    dom.drawerClose.addEventListener(
      "click",
      closeDrawer
    );
  }

  // DRAWER BACKDROP
  if (dom.drawer) {
    dom.drawer.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          dom.drawer
        ) {
          closeDrawer();
        }
      }
    );
  }

  // ESC
  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Escape"
      ) {
        closeDrawer();
      }
    }
  );
}

// ============================================================
// LOAD FIXTURES
// ============================================================

async function loadFixtures() {

  if (!state.selectedDate) {
    setupDate();
  }

  const request =
    ++state.requestId;

  state.loading = true;

  showLoading(true);

  if (dom.matches) {
    dom.matches.innerHTML = `
      <div class="loading-box">
        <div class="spinner"></div>
        <strong>⚽ Maçlar yükleniyor...</strong>
        <p>
          ${escapeHtml(
            state.selectedDate
          )}
        </p>
      </div>
    `;
  }

  try {

    const url =
      `/api/fixtures?date=${encodeURIComponent(
        state.selectedDate
      )}`;

    console.log(
      "R❤️İ FIXTURES REQUEST:",
      url
    );

    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Accept":
              "application/json"
          }
        }
      );

    const text =
      await response.text();

    let result = null;

    try {
      result =
        JSON.parse(text);
    } catch {
      throw new Error(
        `API JSON döndürmedi. HTTP ${response.status}`
      );
    }

    if (
      request !==
      state.requestId
    ) {
      return;
    }

    console.log(
      "R❤️İ FIXTURES RESPONSE:",
      result
    );

    if (!response.ok) {
      throw new Error(
        result?.error ||
        result?.message ||
        `Maç API hatası: HTTP ${response.status}`
      );
    }

    // --------------------------------------------------------
    // API-FOOTBALL NORMAL RESPONSE
    // { response: [...] }
    // --------------------------------------------------------

    let raw = [];

    if (
      Array.isArray(
        result?.response
      )
    ) {
      raw =
        result.response;
    }

    // --------------------------------------------------------
    // ALTERNATIVE RESPONSE FORMATS
    // --------------------------------------------------------

    else if (
      Array.isArray(
        result?.fixtures
      )
    ) {
      raw =
        result.fixtures;
    }

    else if (
      Array.isArray(
        result?.matches
      )
    ) {
      raw =
        result.matches;
    }

    else if (
      Array.isArray(
        result?.data
      )
    ) {
      raw =
        result.data;
    }

    else if (
      Array.isArray(
        result?.data?.response
      )
    ) {
      raw =
        result.data.response;
    }

    else if (
      Array.isArray(
        result?.data?.fixtures
      )
    ) {
      raw =
        result.data.fixtures;
    }

    else if (
      Array.isArray(result)
    ) {
      raw =
        result;
    }

    console.log(
      "R❤️İ RAW MATCH COUNT:",
      raw.length
    );

    // --------------------------------------------------------
    // NORMALIZE
    // --------------------------------------------------------

    const normalized =
      raw
        .map(
          normalizeFixture
        )
        .filter(
          match =>
            match &&
            Number(match.id) > 0 &&
            match.home?.name &&
            match.away?.name
        );

    state.fixtures =
      normalized;

    state.filteredFixtures =
      [];

    state.currentLeague =
      "all";

    renderLeagueMenu();

    applyFilters();

    renderFixtures();

    console.log(
      "R❤️İ NORMALIZED MATCH COUNT:",
      state.fixtures.length
    );

  } catch (error) {

    console.error(
      "R❤️İ FIXTURES ERROR:",
      error
    );

    state.fixtures = [];
    state.filteredFixtures = [];

    if (dom.leagues) {
      dom.leagues.innerHTML = "";
    }

    if (dom.matches) {
      dom.matches.innerHTML = `
        <div class="error-box">
          <strong>
            ⚠️ Maçlar yüklenemedi
          </strong>

          <p>
            ${escapeHtml(
              error.message
            )}
          </p>

          <button
            type="button"
            class="analysis-btn"
            onclick="location.reload()"
          >
            Tekrar Dene
          </button>
        </div>
      `;
    }

  } finally {

    state.loading = false;

    showLoading(false);
  }
}

// ============================================================
// NORMALIZE FIXTURE
// ============================================================

function normalizeFixture(item) {

  if (!item) {
    return null;
  }

  const fixture =
    item.fixture || {};

  const teams =
    item.teams || {};

  const league =
    item.league || {};

  // API-FOOTBALL
  const apiHome =
    teams.home || {};

  const apiAway =
    teams.away || {};

  // ALTERNATIVE
  const home =
    apiHome.id
      ? apiHome
      : item.homeTeam ||
        item.home ||
        {};

  const away =
    apiAway.id
      ? apiAway
      : item.awayTeam ||
        item.away ||
        {};

  const id =
    Number(
      fixture.id ||
      item.id ||
      item.fixture_id ||
      0
    );

  if (!id) {
    return null;
  }

  const leagueId =
    Number(
      league.id ||
      item.league_id ||
      0
    );

  const leagueName =
    league.name ||
    item.league_name ||
    "Bilinmeyen Lig";

  const leagueCountry =
    league.country ||
    item.league_country ||
    "";

  return {

    id,

    date:
      fixture.date ||
      item.date ||
      null,

    timestamp:
      fixture.timestamp ||
      item.timestamp ||
      null,

    timezone:
      fixture.timezone ||
      item.timezone ||
      "Europe/Istanbul",

    status:
      fixture.status ||
      item.status ||
      {},

    venue:
      fixture.venue ||
      item.venue ||
      null,

    referee:
      fixture.referee ||
      item.referee ||
      null,

    league: {

      id:
        leagueId,

      name:
        leagueName,

      country:
        leagueCountry,

      logo:
        league.logo ||
        item.league_logo ||
        "",

      season:
        league.season ||
        item.season ||
        null,

      round:
        league.round ||
        item.round ||
        null
    },

    home: {

      id:
        Number(
          home.id ||
          home.team?.id ||
          0
        ),

      name:
        home.name ||
        home.team?.name ||
        "Ev Sahibi",

      logo:
        home.logo ||
        home.team?.logo ||
        "",

      winner:
        home.winner
    },

    away: {

      id:
        Number(
          away.id ||
          away.team?.id ||
          0
        ),

      name:
        away.name ||
        away.team?.name ||
        "Deplasman",

      logo:
        away.logo ||
        away.team?.logo ||
        "",

      winner:
        away.winner
    },

    goals: {

      home:
        item.goals?.home ??
        null,

      away:
        item.goals?.away ??
        null
    }
  };
}

// ============================================================
// LEAGUE MENU
// ============================================================

function renderLeagueMenu() {

  if (!dom.leagues) {
    return;
  }

  const groups =
    new Map();

  for (
    const match of state.fixtures
  ) {

    const league =
      match.league || {};

    const key =
      String(
        league.id ||
        league.name ||
        "unknown"
      );

    if (!groups.has(key)) {

      groups.set(
        key,
        {
          id:
            league.id,

          name:
            league.name ||
            "Bilinmeyen Lig",

          country:
            league.country ||
            "",

          logo:
            league.logo ||
            "",

          count: 0
        }
      );
    }

    groups.get(key).count++;
  }

  const sorted =
    [...groups.values()]
      .sort(
        (a, b) =>
          b.count -
          a.count
      );

  let html = `
    <button
      class="league-item active"
      data-league="all"
      type="button"
    >
      <span>🌍</span>
      <span>Tüm Ligler</span>
      <small>
        ${state.fixtures.length}
      </small>
    </button>
  `;

  for (
    const league of sorted
  ) {

    const key =
      String(
        league.id ||
        league.name
      );

    html += `
      <button
        class="league-item"
        data-league="${escapeAttr(
          key
        )}"
        type="button"
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
            : `
              <span>⚽</span>
            `
        }

        <span>
          ${escapeHtml(
            league.name
          )}
        </span>

        <small>
          ${league.count}
        </small>

      </button>
    `;
  }

  dom.leagues.innerHTML =
    html;
}

// ============================================================
// FILTERS
// ============================================================

function applyFilters() {

  let list =
    [...state.fixtures];

  // LEAGUE
  if (
    state.currentLeague !==
    "all"
  ) {

    list =
      list.filter(
        match => {

          const key =
            String(
              match.league?.id ||
              match.league?.name ||
              ""
            );

          return (
            key ===
            String(
              state.currentLeague
            )
          );
        }
      );
  }

  // SEARCH
  if (state.search) {

    list =
      list.filter(
        match => {

          const text =
            [
              match.home?.name,
              match.away?.name,
              match.league?.name,
              match.league?.country
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return text.includes(
            state.search
          );
        }
      );
  }

  state.filteredFixtures =
    list;
}

// ============================================================
// RENDER FIXTURES
// ============================================================

function renderFixtures() {

  if (!dom.matches) {
    return;
  }

  const list =
    state.filteredFixtures || [];

  // ----------------------------------------------------------
  // ZERO
  // ----------------------------------------------------------

  if (!list.length) {

    if (
      state.fixtures.length ===
      0
    ) {

      dom.matches.innerHTML = `
        <div class="empty-box">

          <div>⚽</div>

          <strong>
            ${escapeHtml(
              state.selectedDate
            )} tarihinde maç bulunamadı
          </strong>

          <p>
            API-Football bu tarih için
            maç döndürmedi.
          </p>

        </div>
      `;

    } else {

      dom.matches.innerHTML = `
        <div class="empty-box">

          <div>🔎</div>

          <strong>
            Filtreye uygun maç bulunamadı
          </strong>

          <p>
            Arama veya lig filtresini
            değiştirip tekrar deneyin.
          </p>

        </div>
      `;
    }

    return;
  }

  // ----------------------------------------------------------
  // GROUP BY LEAGUE
  // ----------------------------------------------------------

  const grouped =
    new Map();

  for (
    const match of list
  ) {

    const key =
      String(
        match.league?.id ||
        match.league?.name ||
        "unknown"
      );

    if (
      !grouped.has(key)
    ) {

      grouped.set(
        key,
        {
          league:
            match.league,

          matches: []
        }
      );
    }

    grouped
      .get(key)
      .matches
      .push(match);
  }

  let html = "";

  for (
    const group of grouped.values()
  ) {

    const league =
      group.league || {};

    html += `
      <section
        class="league-group"
      >

        <div
          class="league-group-header"
        >

          <div>

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
                : `
                  <span>⚽</span>
                `
            }

            <strong>
              ${escapeHtml(
                league.name ||
                "Bilinmeyen Lig"
              )}
            </strong>

            ${
              league.country
                ? `
                  <span>
                    ${escapeHtml(
                      league.country
                    )}
                  </span>
                `
                : ""
            }

          </div>

          <small>
            ${group.matches.length}
            maç
          </small>

        </div>

        <div
          class="fixture-list"
        >

          ${group.matches
            .map(
              renderMatchCard
            )
            .join("")}

        </div>

      </section>
    `;
  }

  dom.matches.innerHTML =
    html;
}

// ============================================================
// MATCH CARD
// ============================================================

function renderMatchCard(
  match
) {

  const favorite =
    state.favorites.has(
      Number(match.id)
    );

  const status =
    match.status || {};

  const shortStatus =
    status.short ||
    "";

  const time =
    formatMatchTime(
      match.date
    );

  const isFinished =
    [
      "FT",
      "AET",
      "PEN"
    ].includes(
      shortStatus
    );

  const scoreAvailable =
    match.goals?.home !==
      null &&
    match.goals?.away !==
      null;

  return `
    <article
      class="match-card"
      data-fixture="${match.id}"
    >

      <div
        class="match-card-top"
      >

        <span
          class="match-time"
        >
          ${escapeHtml(
            time
          )}
        </span>

        <button
          class="favorite-btn ${
            favorite
              ? "active"
              : ""
          }"
          data-favorite="${match.id}"
          type="button"
          aria-label="Favori"
        >
          ${
            favorite
              ? "★"
              : "☆"
          }
        </button>

      </div>

      <div
        class="teams"
      >

        <div
          class="team"
        >

          ${
            match.home.logo
              ? `
                <img
                  src="${escapeAttr(
                    match.home.logo
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : ""
          }

          <strong>
            ${escapeHtml(
              match.home.name
            )}
          </strong>

        </div>

        <div
          class="vs"
        >

          ${
            isFinished &&
            scoreAvailable
              ? `
                <strong>
                  ${match.goals.home}
                  -
                  ${match.goals.away}
                </strong>
              `
              : `
                ${
                  shortStatus
                    ? escapeHtml(
                        shortStatus
                      )
                    : "VS"
                }
              `
          }

        </div>

        <div
          class="team"
        >

          ${
            match.away.logo
              ? `
                <img
                  src="${escapeAttr(
                    match.away.logo
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : ""
          }

          <strong>
            ${escapeHtml(
              match.away.name
            )}
          </strong>

        </div>

      </div>

      <div
        class="match-card-bottom"
      >

        <span>
          ${escapeHtml(
            match.league?.name ||
            ""
          )}
        </span>

        <button
          class="analysis-btn"
          type="button"
        >
          ŞUNU OYNA
        </button>

      </div>

    </article>
  `;
}

// ============================================================
// FAVORITES
// ============================================================

function toggleFavorite(
  id
) {

  if (
    state.favorites.has(id)
  ) {

    state.favorites.delete(id);

  } else {

    state.favorites.add(id);
  }

  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(
      [...state.favorites]
    )
  );

  renderFavoriteCount();
  renderFixtures();
}

function renderFavoriteCount() {

  document
    .querySelectorAll(
      "[data-favorite-count]"
    )
    .forEach(
      element => {
        element.textContent =
          state.favorites.size;
      }
    );
}

// ============================================================
// OPEN MATCH ANALYSIS
// ============================================================

async function openMatchAnalysis(
  match
) {

  openDrawer();

  const fixtureId =
    Number(match.id);

  // CACHE
  const cached =
    state.analysisCache.get(
      fixtureId
    );

  if (
    cached &&
    cached.ai
  ) {

    renderAnalysis(
      match,
      cached
    );

    return;
  }

  if (
    cached &&
    cached.apiData
  ) {

    renderAnalysis(
      match,
      cached
    );

    await runAIAnalysis(
      match,
      cached
    );

    return;
  }

  showAnalysisLoading(
    match
  );

  try {

    const response =
      await fetch(
        `/api/match?fixture=${encodeURIComponent(
          fixtureId
        )}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Accept":
              "application/json"
          }
        }
      );

    const text =
      await response.text();

    let data = null;

    try {
      data =
        JSON.parse(text);
    } catch {
      throw new Error(
        "Maç analiz API'si geçersiz cevap döndürdü."
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        "Maç analiz verileri alınamadı."
      );
    }

    const analysis =
      buildAnalysis(
        match,
        data
      );

    analysis.apiData =
      data?.analysis_data ||
      {};

    analysis.dataStatus =
      data?.data_status ||
      {};

    state.analysisCache.set(
      fixtureId,
      analysis
    );

    renderAnalysis(
      match,
      analysis
    );

    // OPENAI
    await runAIAnalysis(
      match,
      analysis
    );

  } catch (error) {

    console.error(
      "R❤️İ MATCH ANALYSIS ERROR:",
      error
    );

    const fallback =
      buildFallbackAnalysis(
        match
      );

    fallback.apiData = {};
    fallback.dataStatus = {};
    fallback.aiError =
      error.message;

    state.analysisCache.set(
      fixtureId,
      fallback
    );

    renderAnalysis(
      match,
      fallback
    );
  }
}

// ============================================================
// OPENAI
// ============================================================

async function runAIAnalysis(
  match,
  analysis
) {

  try {

    updateAIStatus(
      "🤖 R❤️İ AI verileri değerlendiriyor..."
    );

    const response =
      await fetch(
        "/api/ai",
        {
          method: "POST",

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

                league:
                  match.league,

                teams: {

                  home:
                    match.home,

                  away:
                    match.away
                }
              },

              data:
                analysis.apiData ||
                {},

              local: {

                confidence:
                  analysis.confidence,

                risk:
                  analysis.risk,

                predictedScore:
                  analysis.predictedScore,

                expectedHome:
                  analysis.expectedHome,

                expectedAway:
                  analysis.expectedAway,

                totalExpected:
                  analysis.totalExpected,

                probabilities:
                  analysis.probabilities,

                firstHalfGoalProbability:
                  analysis.firstHalfGoalProbability,

                secondHalfGoalProbability:
                  analysis.secondHalfGoalProbability,

                firstHalfBTTS:
                  analysis.firstHalfBTTS,

                secondHalfBTTS:
                  analysis.secondHalfBTTS,

                bothHalvesBTTS:
                  analysis.bothHalvesBTTS
              }
            })
        }
      );

    const text =
      await response.text();

    let result = null;

    try {
      result =
        JSON.parse(text);
    } catch {
      throw new Error(
        "AI API geçersiz JSON döndürdü."
      );
    }

    if (
      !response.ok ||
      !result?.ok ||
      !result?.ai
    ) {

      throw new Error(
        result?.error ||
        result?.message ||
        `AI analiz hatası: HTTP ${response.status}`
      );
    }

    analysis.ai =
      result.ai;

    analysis.aiConfidence =
      Number(
        result.ai.confidence
      ) || 0;

    analysis.aiEngine =
      result.engine ||
      result.model ||
      "R❤️İ OpenAI Football Engine";

    analysis.aiError =
      null;

    state.analysisCache.set(
      Number(match.id),
      analysis
    );

    renderAnalysis(
      match,
      analysis
    );

  } catch (error) {

    console.error(
      "R❤️İ OPENAI ERROR:",
      error
    );

    analysis.aiError =
      error.message;

    state.analysisCache.set(
      Number(match.id),
      analysis
    );

    renderAnalysis(
      match,
      analysis
    );
  }
}

// ============================================================
// LOCAL ANALYSIS
// ============================================================

function buildAnalysis(
  match,
  data
) {

  const analysisData =
    data?.analysis_data ||
    {};

  const homeForm =
    Array.isArray(
      analysisData?.form?.home
    )
      ? analysisData.form.home
      : [];

  const awayForm =
    Array.isArray(
      analysisData?.form?.away
    )
      ? analysisData.form.away
      : [];

  const h2h =
    Array.isArray(
      analysisData?.h2h
    )
      ? analysisData.h2h
      : [];

  const home =
    calculateTeamForm(
      homeForm,
      match.home.id
    );

  const away =
    calculateTeamForm(
      awayForm,
      match.away.id
    );

  const h2hStats =
    calculateH2H(
      h2h,
      match.home.id,
      match.away.id
    );

  // ----------------------------------------------------------
  // EXPECTED GOALS
  // ----------------------------------------------------------

  let expectedHome =
    1.05 +
    home.attack * 0.75 +
    away.defense * 0.25;

  let expectedAway =
    0.85 +
    away.attack * 0.75 +
    home.defense * 0.25;

  expectedHome +=
    home.formScore *
    0.35;

  expectedAway +=
    away.formScore *
    0.35;

  if (
    h2hStats.matches >= 3
  ) {

    expectedHome +=
      h2hStats.homeGoalsAvg *
      0.12;

    expectedAway +=
      h2hStats.awayGoalsAvg *
      0.12;
  }

  expectedHome =
    clamp(
      expectedHome,
      0.25,
      3.5
    );

  expectedAway =
    clamp(
      expectedAway,
      0.20,
      3.5
    );

  const totalExpected =
    expectedHome +
    expectedAway;

  // ----------------------------------------------------------
  // POISSON
  // ----------------------------------------------------------

  const probabilities = {

    homeWin: 0,
    draw: 0,
    awayWin: 0,

    over15: 0,
    over25: 0,
    over35: 0,

    under15: 0,
    under25: 0,
    under35: 0,

    btts: 0
  };

  let bestScore = {

    home: 0,
    away: 0,
    probability: 0
  };

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

      const probability =
        poisson(
          expectedHome,
          h
        ) *
        poisson(
          expectedAway,
          a
        );

      if (h > a) {
        probabilities.homeWin +=
          probability;
      }

      else if (h === a) {
        probabilities.draw +=
          probability;
      }

      else {
        probabilities.awayWin +=
          probability;
      }

      const total =
        h + a;

      if (
        total >= 2
      ) {
        probabilities.over15 +=
          probability;
      }

      if (
        total >= 3
      ) {
        probabilities.over25 +=
          probability;
      }

      if (
        total >= 4
      ) {
        probabilities.over35 +=
          probability;
      }

      if (
        total < 2
      ) {
        probabilities.under15 +=
          probability;
      }

      if (
        total < 3
      ) {
        probabilities.under25 +=
          probability;
      }

      if (
        total < 4
      ) {
        probabilities.under35 +=
          probability;
      }

      if (
        h >= 1 &&
        a >= 1
      ) {
        probabilities.btts +=
          probability;
      }

      if (
        probability >
        bestScore.probability
      ) {

        bestScore = {

          home: h,

          away: a,

          probability
        };
      }
    }
  }

  Object.keys(
    probabilities
  ).forEach(
    key => {

      probabilities[key] =
        Math.round(
          probabilities[key] *
          100
        );
    }
  );

  // ----------------------------------------------------------
  // HALF ANALYSIS
  // ----------------------------------------------------------

  const firstHalfGoalProbability =
    clamp(
      totalExpected *
      0.48 *
      100,
      15,
      90
    );

  const secondHalfGoalProbability =
    clamp(
      totalExpected *
      0.68 *
      100,
      20,
      95
    );

  const firstHalfBTTS =
    clamp(
      probabilities.btts *
      0.42,
      5,
      75
    );

  const secondHalfBTTS =
    clamp(
      probabilities.btts *
      0.72,
      5,
      85
    );

  const bothHalvesBTTS =
    clamp(
      probabilities.btts *
      0.25,
      2,
      55
    );

  const confidence =
    calculateConfidence({
      probabilities,
      home,
      away,
      h2h:
        h2hStats
    });

  const risk =
    getRiskLabel(
      confidence
    );

  const predictedScore =
    `${bestScore.home}-${bestScore.away}`;

  const reasons = [];

  if (
    probabilities.over25 >=
    65
  ) {
    reasons.push(
      "Model toplam gol beklentisini yüksek görüyor."
    );
  }

  if (
    probabilities.btts >=
    60
  ) {
    reasons.push(
      "İki takımın da gol bulma ihtimali modelde güçlü."
    );
  }

  if (
    probabilities.homeWin >=
    65
  ) {
    reasons.push(
      "Ev sahibi galibiyet olasılığı modelde öne çıkıyor."
    );
  }

  if (
    probabilities.awayWin >=
    65
  ) {
    reasons.push(
      "Deplasman galibiyet olasılığı modelde öne çıkıyor."
    );
  }

  if (
    probabilities.under35 >=
    75
  ) {
    reasons.push(
      "3.5 alt olasılığı modelde güçlü."
    );
  }

  if (
    h2hStats.matches >=
    3
  ) {
    reasons.push(
      `H2H verisinde ${h2hStats.matches} karşılaşma değerlendirildi.`
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Modelde tek bir pazar belirgin şekilde ayrışmıyor."
    );
  }

  return {

    confidence,

    risk:
      risk.label,

    riskClass:
      risk.className,

    predictedScore,

    expectedHome:
      round(
        expectedHome,
        2
      ),

    expectedAway:
      round(
        expectedAway,
        2
      ),

    totalExpected:
      round(
        totalExpected,
        2
      ),

    probabilities,

    firstHalfGoalProbability:
      Math.round(
        firstHalfGoalProbability
      ),

    secondHalfGoalProbability:
      Math.round(
        secondHalfGoalProbability
      ),

    firstHalfBTTS:
      Math.round(
        firstHalfBTTS
      ),

    secondHalfBTTS:
      Math.round(
        secondHalfBTTS
      ),

    bothHalvesBTTS:
      Math.round(
        bothHalvesBTTS
      ),

    reasons,

    h2h:
      h2hStats,

    dataStatus:
      data?.data_status ||
      {}
  };
}

// ============================================================
// TEAM FORM
// ============================================================

function calculateTeamForm(
  fixtures,
  teamId
) {

  if (
    !Array.isArray(fixtures) ||
    !fixtures.length
  ) {

    return {

      attack: 0.5,

      defense: 0.5,

      formScore: 0.5,

      wins: 0,

      draws: 0,

      losses: 0
    };
  }

  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let counted = 0;

  for (
    const fixture of fixtures
  ) {

    const homeId =
      fixture?.teams?.home?.id;

    const awayId =
      fixture?.teams?.away?.id;

    const hg =
      fixture?.goals?.home;

    const ag =
      fixture?.goals?.away;

    if (
      hg == null ||
      ag == null
    ) {
      continue;
    }

    if (
      homeId !== teamId &&
      awayId !== teamId
    ) {
      continue;
    }

    counted++;

    const isHome =
      homeId === teamId;

    const gf =
      isHome
        ? Number(hg)
        : Number(ag);

    const ga =
      isHome
        ? Number(ag)
        : Number(hg);

    goalsFor += gf;
    goalsAgainst += ga;

    if (
      gf > ga
    ) {

      wins++;
      points += 3;

    } else if (
      gf === ga
    ) {

      draws++;
      points += 1;

    } else {

      losses++;
    }
  }

  if (
    !counted
  ) {

    return {

      attack: 0.5,

      defense: 0.5,

      formScore: 0.5,

      wins: 0,

      draws: 0,

      losses: 0
    };
  }

  const avgFor =
    goalsFor /
    counted;

  const avgAgainst =
    goalsAgainst /
    counted;

  return {

    attack:
      clamp(
        avgFor / 2.2,
        0,
        1
      ),

    defense:
      clamp(
        1 -
        avgAgainst / 2.5,
        0,
        1
      ),

    formScore:
      clamp(
        points /
        (counted * 3),
        0,
        1
      ),

    wins,

    draws,

    losses
  };
}

// ============================================================
// H2H
// ============================================================

function calculateH2H(
  fixtures,
  homeId,
  awayId
) {

  let matches = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let btts = 0;

  if (
    !Array.isArray(fixtures)
  ) {

    return {

      matches: 0,

      homeGoalsAvg: 0,

      awayGoalsAvg: 0,

      bttsProbability: 0
    };
  }

  for (
    const fixture of fixtures
  ) {

    const hg =
      fixture?.goals?.home;

    const ag =
      fixture?.goals?.away;

    if (
      hg == null ||
      ag == null
    ) {
      continue;
    }

    const h =
      fixture?.teams?.home?.id;

    const a =
      fixture?.teams?.away?.id;

    const sameMatch =
      (
        h === homeId &&
        a === awayId
      ) ||
      (
        h === awayId &&
        a === homeId
      );

    if (!sameMatch) {
      continue;
    }

    matches++;

    if (
      h === homeId
    ) {

      homeGoals +=
        Number(hg);

      awayGoals +=
        Number(ag);

    } else {

      homeGoals +=
        Number(ag);

      awayGoals +=
        Number(hg);
    }

    if (
      Number(hg) > 0 &&
      Number(ag) > 0
    ) {
      btts++;
    }
  }

  return {

    matches,

    homeGoalsAvg:
      matches
        ? homeGoals /
          matches
        : 0,

    awayGoalsAvg:
      matches
        ? awayGoals /
          matches
        : 0,

    bttsProbability:
      matches
        ? Math.round(
            (
              btts /
              matches
            ) *
            100
          )
        : 0
  };
}

// ============================================================
// CONFIDENCE
// ============================================================

function calculateConfidence({
  probabilities,
  home,
  away,
  h2h
}) {

  const resultMarkets = [

    probabilities.homeWin,

    probabilities.draw,

    probabilities.awayWin
  ];

  const strongest =
    Math.max(
      ...resultMarkets
    );

  const marketStrength =
    Math.max(

      probabilities.over25,

      probabilities.under25,

      probabilities.btts,

      probabilities.over15
    );

  let confidence =
    45;

  confidence +=
    (
      strongest - 33
    ) *
    0.35;

  confidence +=
    (
      marketStrength - 50
    ) *
    0.12;

  confidence +=
    (
      Math.abs(
        home.formScore -
        away.formScore
      ) *
      100
    ) *
    0.10;

  if (
    h2h.matches >= 5
  ) {
    confidence += 3;
  }

  return Math.round(
    clamp(
      confidence,
      35,
      88
    )
  );
}

// ============================================================
// RISK
// ============================================================

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

// ============================================================
// RENDER ANALYSIS
// ============================================================

function renderAnalysis(
  match,
  analysis
) {

  if (
    !dom.drawerContent
  ) {
    return;
  }

  const ai =
    analysis?.ai ||
    null;

  const probabilities =
    analysis?.probabilities ||
    {};

  const aiConfidence =
    Number(
      ai?.confidence
    ) || 0;

  const aiMarkets =
    ai?.markets ||
    {};

  const firstHalf =
    ai?.first_half ||
    {};

  const secondHalf =
    ai?.second_half ||
    {};

  const aiReasons =
    Array.isArray(
      ai?.reasons
    )
      ? ai.reasons
      : [];

  const aiWarnings =
    Array.isArray(
      ai?.warnings
    )
      ? ai.warnings
      : [];

  dom.drawerContent.innerHTML = `

    <div
      class="analysis-header"
    >

      <div
        class="analysis-teams"
      >

        <div>

          ${
            match.home.logo
              ? `
                <img
                  src="${escapeAttr(
                    match.home.logo
                  )}"
                  alt=""
                >
              `
              : ""
          }

          <strong>
            ${escapeHtml(
              match.home.name
            )}
          </strong>

        </div>

        <span>
          VS
        </span>

        <div>

          ${
            match.away.logo
              ? `
                <img
                  src="${escapeAttr(
                    match.away.logo
                  )}"
                  alt=""
                >
              `
              : ""
          }

          <strong>
            ${escapeHtml(
              match.away.name
            )}
          </strong>

        </div>

      </div>

      <div
        class="analysis-league"
      >
        ${escapeHtml(
          match.league?.name ||
          ""
        )}
      </div>

    </div>

    ${
      ai
        ? `

          <section
            class="ai-analysis-panel"
          >

            <div
              class="ai-title"
            >

              <span>
                🤖
              </span>

              <strong>
                R❤️İ AI ANALİZİ
              </strong>

              <span
                class="ai-connected"
              >
                OPENAI BAĞLI
              </span>

            </div>

            <div
              class="ai-pick-box"
            >

              <small>
                🎯 ŞUNU OYNA
              </small>

              <strong>
                ${escapeHtml(
                  ai.pick ||
                  "Seçim üretilemedi"
                )}
              </strong>

            </div>

            <div
              class="ai-grid"
            >

              <div
                class="analysis-stat"
              >

                <span>
                  AI Güven
                </span>

                <strong>
                  ${Math.round(
                    aiConfidence
                  )}%
                </strong>

              </div>

              <div
                class="analysis-stat"
              >

                <span>
                  Risk
                </span>

                <strong>
                  ${escapeHtml(
                    ai.risk ||
                    "-"
                  )}
                </strong>

              </div>

              <div
                class="analysis-stat"
              >

                <span>
                  Tahmini Skor
                </span>

                <strong>
                  ${escapeHtml(
                    ai.predicted_score ||
                    "-"
                  )}
                </strong>

              </div>

            </div>

            <div
              class="ai-summary"
            >

              <h4>
                AI Yorumu
              </h4>

              <p>
                ${escapeHtml(
                  ai.summary ||
                  "AI özeti bulunamadı."
                )}
              </p>

            </div>

            <div
              class="ai-markets"
            >

              <h4>
                📊 AI Pazar Analizi
              </h4>

              ${aiMarketRow(
                "Maç Sonucu",
                aiMarkets.match_result
              )}

              ${aiMarketRow(
                "KG",
                aiMarkets.btts
              )}

              ${aiMarketRow(
                "1.5 Üst",
                aiMarkets.over_15
              )}

              ${aiMarketRow(
                "2.5 Üst",
                aiMarkets.over_25
              )}

              ${aiMarketRow(
                "3.5 Alt",
                aiMarkets.under_35
              )}

            </div>

            <div
              class="half-analysis"
            >

              <h4>
                ⏱️ İY / 2Y KG
              </h4>

              <div
                class="half-row"
              >

                <div>

                  <strong>
                    1. Yarı
                  </strong>

                  <span>
                    Gol:
                    ${
                      Number(
                        firstHalf.goal_probability
                      ) || 0
                    }%
                  </span>

                  <span>
                    KG:
                    ${escapeHtml(
                      firstHalf.btts ||
                      "-"
                    )}
                  </span>

                  <p>
                    ${escapeHtml(
                      firstHalf.recommendation ||
                      "-"
                    )}
                  </p>

                </div>

                <div>

                  <strong>
                    2. Yarı
                  </strong>

                  <span>
                    Gol:
                    ${
                      Number(
                        secondHalf.goal_probability
                      ) || 0
                    }%
                  </span>

                  <span>
                    KG:
                    ${escapeHtml(
                      secondHalf.btts ||
                      "-"
                    )}
                  </span>

                  <p>
                    ${escapeHtml(
                      secondHalf.recommendation ||
                      "-"
                    )}
                  </p>

                </div>

              </div>

            </div>

            ${
              aiReasons.length
                ? `

                  <div
                    class="analysis-reasons"
                  >

                    <h4>
                      🧠 AI Gerekçeleri
                    </h4>

                    <ul>

                      ${aiReasons
                        .map(
                          reason =>
                            `
                              <li>
                                ${escapeHtml(
                                  reason
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
              aiWarnings.length
                ? `

                  <div
                    class="analysis-warnings"
                  >

                    <h4>
                      ⚠️ Dikkat
                    </h4>

                    <ul>

                      ${aiWarnings
                        .map(
                          warning =>
                            `
                              <li>
                                ${escapeHtml(
                                  warning
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

            <div
              class="ai-footer"
            >
              R❤️İ OpenAI Football Engine ·
              ${escapeHtml(
                analysis.aiEngine ||
                "OpenAI"
              )}
            </div>

          </section>
        `
        : `

          <section
            class="ai-analysis-panel ai-loading"
          >

            <div
              class="ai-title"
            >

              <span>
                🤖
              </span>

              <strong>
                R❤️İ AI ANALİZİ
              </strong>

            </div>

            <div
              class="ai-loading-text"
            >
              🤖 OpenAI analiz yapıyor...
            </div>

          </section>
        `
    }

    <!-- LOCAL MODEL -->

    <section
      class="local-analysis-panel"
    >

      <div
        class="section-title"
      >
        📐 R❤️İ İstatistiksel Model
      </div>

      <div
        class="pick-box"
      >

        <small>
          🎯 MODEL SEÇİMİ
        </small>

        <strong>
          ${escapeHtml(
            getLocalPick(
              analysis
            )
          )}
        </strong>

      </div>

      <div
        class="analysis-grid"
      >

        <div
          class="analysis-stat"
        >

          <span>
            Model Güven
          </span>

          <strong>
            ${
              analysis.confidence ||
              0
            }%
          </strong>

        </div>

        <div
          class="analysis-stat"
        >

          <span>
            Risk
          </span>

          <strong>
            ${escapeHtml(
              analysis.risk ||
              "-"
            )}
          </strong>

        </div>

        <div
          class="analysis-stat"
        >

          <span>
            Tahmini Skor
          </span>

          <strong>
            ${escapeHtml(
              analysis.predictedScore ||
              "-"
            )}
          </strong>

        </div>

      </div>

      <div
        class="market-table"
      >

        <h4>
          📊 Model Olasılıkları
        </h4>

        ${marketRow(
          "MS 1",
          probabilities.homeWin
        )}

        ${marketRow(
          "Beraberlik",
          probabilities.draw
        )}

        ${marketRow(
          "MS 2",
          probabilities.awayWin
        )}

        ${marketRow(
          "1.5 Üst",
          probabilities.over15
        )}

        ${marketRow(
          "2.5 Üst",
          probabilities.over25
        )}

        ${marketRow(
          "3.5 Alt",
          probabilities.under35
        )}

        ${marketRow(
          "KG Var",
          probabilities.btts
        )}

      </div>

      <div
        class="half-analysis local-half"
      >

        <h4>
          ⏱️ İY / 2Y
        </h4>

        <div>
          1. Yarı Gol:
          <strong>
            ${
              analysis.firstHalfGoalProbability ||
              0
            }%
          </strong>
        </div>

        <div>
          2. Yarı Gol:
          <strong>
            ${
              analysis.secondHalfGoalProbability ||
              0
            }%
          </strong>
        </div>

        <div>
          1. Yarı KG:
          <strong>
            ${
              analysis.firstHalfBTTS ||
              0
            }%
          </strong>
        </div>

        <div>
          2. Yarı KG:
          <strong>
            ${
              analysis.secondHalfBTTS ||
              0
            }%
          </strong>
        </div>

        <div>
          İY + 2Y KG:
          <strong>
            ${
              analysis.bothHalvesBTTS ||
              0
            }%
          </strong>
        </div>

      </div>

      <div
        class="expected-goals"
      >

        <h4>
          ⚽ Beklenen Goller
        </h4>

        <div>
          ${escapeHtml(
            match.home.name
          )}
          :
          <strong>
            ${
              analysis.expectedHome ??
              "-"
            }
          </strong>
        </div>

        <div>
          ${escapeHtml(
            match.away.name
          )}
          :
          <strong>
            ${
              analysis.expectedAway ??
              "-"
            }
          </strong>
        </div>

        <div>
          Toplam:
          <strong>
            ${
              analysis.totalExpected ??
              "-"
            }
          </strong>
        </div>

      </div>

      <div
        class="analysis-reasons"
      >

        <h4>
          📌 Model Gerekçeleri
        </h4>

        <ul>

          ${
            (
              analysis.reasons ||
              []
            )
              .map(
                reason =>
                  `
                    <li>
                      ${escapeHtml(
                        reason
                      )}
                    </li>
                  `
              )
              .join("")
          }

        </ul>

      </div>

      ${
        analysis.aiError
          ? `

            <div
              class="ai-error-box"
            >

              🤖 AI bağlantısı sırasında
              sorun oluştu:

              <br>

              ${escapeHtml(
                analysis.aiError
              )}

            </div>
          `
          : ""
      }

      <div
        class="analysis-disclaimer"
      >

        İstatistiksel ve yapay zekâ
        destekli analizdir.
        Kesin sonuç garantisi vermez.

      </div>

    </section>
  `;
}

// ============================================================
// AI MARKET ROW
// ============================================================

function aiMarketRow(
  name,
  value
) {

  return `

    <div>

      <span>
        ${escapeHtml(
          name
        )}
      </span>

      <strong>
        ${escapeHtml(
          value ||
          "-"
        )}
      </strong>

    </div>
  `;
}

// ============================================================
// AI STATUS
// ============================================================

function updateAIStatus(
  text
) {

  if (
    !dom.drawerContent
  ) {
    return;
  }

  const element =
    dom.drawerContent.querySelector(
      ".ai-loading-text"
    );

  if (element) {
    element.textContent =
      text;
  }
}

// ============================================================
// LOCAL PICK
// ============================================================

function getLocalPick(
  analysis
) {

  const p =
    analysis?.probabilities ||
    {};

  const options = [

    {
      name: "MS 1",
      value:
        Number(
          p.homeWin
        ) || 0
    },

    {
      name: "MS X",
      value:
        Number(
          p.draw
        ) || 0
    },

    {
      name: "MS 2",
      value:
        Number(
          p.awayWin
        ) || 0
    },

    {
      name: "KG Var",
      value:
        Number(
          p.btts
        ) || 0
    },

    {
      name: "2.5 Üst",
      value:
        Number(
          p.over25
        ) || 0
    },

    {
      name: "3.5 Alt",
      value:
        Number(
          p.under35
        ) || 0
    }
  ];

  options.sort(
    (a, b) =>
      b.value -
      a.value
  );

  return (
    options[0]?.name ||
    "Seçim yok"
  );
}

// ============================================================
// MARKET ROW
// ============================================================

function marketRow(
  name,
  value
) {

  const numeric =
    Number(value);

  return `

    <div
      class="market-row"
    >

      <span>
        ${escapeHtml(
          name
        )}
      </span>

      <strong>
        ${
          Number.isFinite(
            numeric
          )
            ? `${Math.round(
                numeric
              )}%`
            : "-"
        }
      </strong>

    </div>
  `;
}

// ============================================================
// FALLBACK
// ============================================================

function buildFallbackAnalysis(
  match
) {

  return {

    confidence: 35,

    risk:
      "🔴 Yüksek Risk",

    riskClass:
      "high",

    predictedScore:
      "1-1",

    expectedHome:
      1,

    expectedAway:
      1,

    totalExpected:
      2,

    probabilities: {

      homeWin: 35,

      draw: 30,

      awayWin: 35,

      over15: 65,

      over25: 45,

      over35: 22,

      under15: 35,

      under25: 55,

      under35: 78,

      btts: 50
    },

    firstHalfGoalProbability:
      48,

    secondHalfGoalProbability:
      68,

    firstHalfBTTS:
      20,

    secondHalfBTTS:
      36,

    bothHalvesBTTS:
      12,

    reasons: [

      "Yeterli maç verisi alınamadı.",

      "Yerel model güveni düşürüldü."
    ]
  };
}

// ============================================================
// DRAWER
// ============================================================

function openDrawer() {

  if (!dom.drawer) {
    return;
  }

  dom.drawer.classList.add(
    "open"
  );

  document.body.classList.add(
    "drawer-open"
  );
}

function closeDrawer() {

  if (!dom.drawer) {
    return;
  }

  dom.drawer.classList.remove(
    "open"
  );

  document.body.classList.remove(
    "drawer-open"
  );
}

// ============================================================
// ANALYSIS LOADING
// ============================================================

function showAnalysisLoading(
  match
) {

  if (
    !dom.drawerContent
  ) {
    return;
  }

  dom.drawerContent.innerHTML = `

    <div
      class="analysis-loading"
    >

      <div
        class="spinner"
      ></div>

      <h3>
        ${escapeHtml(
          match.home.name
        )}
        -
        ${escapeHtml(
          match.away.name
        )}
      </h3>

      <p>
        📊 API-Football verileri
        toplanıyor...
      </p>

      <p>
        🤖 Ardından R❤️İ AI
        analiz yapacak.
      </p>

    </div>
  `;
}

// ============================================================
// GLOBAL LOADING
// ============================================================

function showLoading(
  visible
) {

  if (!dom.loading) {
    return;
  }

  dom.loading.style.display =
    visible
      ? ""
      : "none";
}

// ============================================================
// POISSON
// ============================================================

function poisson(
  lambda,
  k
) {

  lambda =
    Number(lambda) || 0;

  k =
    Number(k) || 0;

  if (
    lambda <= 0
  ) {

    return k === 0
      ? 1
      : 0;
  }

  return (
    Math.exp(
      -lambda
    ) *
    Math.pow(
      lambda,
      k
    ) /
    factorial(k)
  );
}

// ============================================================
// FACTORIAL
// ============================================================

function factorial(
  n
) {

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

// ============================================================
// CLAMP
// ============================================================

function clamp(
  value,
  min,
  max
) {

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return min;
  }

  return Math.max(
    min,
    Math.min(
      max,
      number
    )
  );
}

// ============================================================
// ROUND
// ============================================================

function round(
  value,
  decimals = 2
) {

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  const multiplier =
    Math.pow(
      10,
      decimals
    );

  return (
    Math.round(
      number *
      multiplier
    ) /
    multiplier
  );
}

// ============================================================
// MATCH TIME
// ============================================================

function formatMatchTime(
  date
) {

  if (!date) {
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
          "2-digit",

        hour12:
          false
      }
    ).format(
      new Date(date)
    );

  } catch {

    return "--:--";
  }
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
  value
) {

  return String(
    value ??
    ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

// ============================================================
// ESCAPE ATTRIBUTE
// ============================================================

function escapeAttr(
  value
) {

  return escapeHtml(
    value
  );
}

// ============================================================
// GLOBAL DEBUG
// ============================================================

window.RI = {

  state,

  reload: loadFixtures,

  analyze:
    openMatchAnalysis
};

console.log(
  "❤️ R❤️İ FOOTBALL APP READY"
);
