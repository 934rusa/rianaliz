/* =========================================================
   R❤️İ FOOTBALL — APP.JS
   Veri Odaklı Futbol Analiz Merkezi
   API-Football + yerel analiz motoru
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL
   ========================================================= */

const state = {
  fixtures: [],
  filteredFixtures: [],
  analyses: new Map(),
  favorites: new Set(
    JSON.parse(localStorage.getItem("ri_favorites") || "[]")
  ),
  currentFilter: "all",
  search: "",
  loading: false,
  analyzing: false
};

const $ = (selector) => document.querySelector(selector);

const matchesEl = $("#matches");
const searchInput = $("#searchInput");
const matchCountEl = $("#matchCount");
const sectionTitleEl = $("#sectionTitle");
const resultInfoEl = $("#resultInfo");
const apiStatusEl = $("#apiStatus");
const drawerEl = $("#analysisDrawer");

/* =========================================================
   DATE
   ========================================================= */

function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/* =========================================================
   HELPERS
   ========================================================= */

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return `${Math.round(clamp(value))}%`;
}

function probability(value) {
  return clamp(num(value) * 100);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "-";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateString));
  } catch {
    return "-";
  }
}

function getTeamName(team) {
  return team?.name || "Bilinmeyen Takım";
}

function getLogo(team) {
  return team?.logo || "";
}

function saveFavorites() {
  localStorage.setItem(
    "ri_favorites",
    JSON.stringify([...state.favorites])
  );
}

function isFavorite(id) {
  return state.favorites.has(String(id));
}

function toggleFavorite(id, event) {
  if (event) event.stopPropagation();

  const key = String(id);

  if (state.favorites.has(key)) {
    state.favorites.delete(key);
  } else {
    state.favorites.add(key);
  }

  saveFavorites();
  renderFixtures();
}

/* =========================================================
   API
   ========================================================= */

async function fetchJSON(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Geçersiz API cevabı (${response.status})`);
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
   FIXTURES
   ========================================================= */

async function loadFixtures() {
  if (state.loading) return;

  state.loading = true;

  setApiStatus("● API BAĞLANIYOR...", "loading");

  matchesEl.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Maçlar yükleniyor...</p>
    </div>
  `;

  try {
    const date = todayIstanbul();

    const data = await fetchJSON(
      `/api/fixtures?date=${encodeURIComponent(date)}`
    );

    if (!data || !Array.isArray(data.response)) {
      throw new Error("Maç verisi bulunamadı.");
    }

    state.fixtures = data.response
      .filter(Boolean)
      .sort((a, b) => {
        const ta = num(a.fixture?.timestamp);
        const tb = num(b.fixture?.timestamp);
        return ta - tb;
      });

    setApiStatus(
      `● API BAĞLI • ${state.fixtures.length} MAÇ`,
      "online"
    );

    renderFixtures();
  } catch (error) {
    console.error("R❤️İ FIXTURE ERROR:", error);

    setApiStatus("● API HATASI", "error");

    matchesEl.innerHTML = `
      <div class="loading">
        <p>⚠️ Maçlar yüklenemedi.</p>
        <small>${escapeHTML(error.message)}</small>
        <br><br>
        <button class="refresh-btn" onclick="loadFixtures()">Tekrar Dene</button>
      </div>
    `;
  } finally {
    state.loading = false;
  }
}

/* =========================================================
   API STATUS
   ========================================================= */

function setApiStatus(text, type) {
  if (!apiStatusEl) return;

  apiStatusEl.textContent = text;

  apiStatusEl.classList.remove(
    "online",
    "loading",
    "error"
  );

  apiStatusEl.classList.add(type);
}

/* =========================================================
   SEARCH
   ========================================================= */

function matchesSearch(fixture) {
  if (!state.search) return true;

  const query = state.search.toLowerCase();

  const home = getTeamName(fixture.teams?.home).toLowerCase();
  const away = getTeamName(fixture.teams?.away).toLowerCase();
  const league = String(
    fixture.league?.name || ""
  ).toLowerCase();
  const country = String(
    fixture.league?.country || ""
  ).toLowerCase();

  return (
    home.includes(query) ||
    away.includes(query) ||
    league.includes(query) ||
    country.includes(query)
  );
}

/* =========================================================
   QUICK MODEL
   ---------------------------------------------------------
   Fixture listesindeki veri sınırlı olduğu için burada
   yalnızca temel sınıflandırma yapılır.
   Ayrıntılı analiz maç açıldığında /api/match üzerinden yapılır.
   ========================================================= */

function quickFixtureModel(fixture) {
  const home = fixture.teams?.home || {};
  const away = fixture.teams?.away || {};

  const homeRank = num(home.id % 10);
  const awayRank = num(away.id % 10);

  const balance = clamp(
    50 + (homeRank - awayRank) * 2
  );

  const homeWin = clamp(42 + (balance - 50) * 0.5);
  const draw = 27;
  const awayWin = clamp(100 - homeWin - draw);

  const goalsBase = 2.35;

  const over15 = 91;
  const over25 = 53;
  const btts = 51;

  return {
    homeWin,
    draw,
    awayWin,
    over15,
    over25,
    btts,
    firstHalfGoal: 70,
    secondHalfGoal: 76,
    firstHalfBTTS: 24,
    secondHalfBTTS: 29,
    iy2yBTTS: 18,
    goalsBase
  };
}

/* =========================================================
   FILTER
   ========================================================= */

function applyFilter(filter) {
  state.currentFilter = filter;

  document.querySelectorAll(".menu-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.filter === filter
    );
  });

  const titles = {
    all: "Bugünün Maçları",
    search: "Maç Ara",
    analysis: "Maç Analizi",
    reliable: "Güvenilir Seçimler",
    medium: "Orta Riskli",
    risky: "Riskli Seçimler",
    high: "Yüksek Oran Fırsatları",
    iy2y: "İY / 2Y KG",
    "first-half": "1. Yarı Gol Beklenenler",
    "second-half": "2. Yarı Gol Beklenenler",
    score: "Tahmini Skorlar",
    stats: "İstatistikler",
    favorites: "Favoriler"
  };

  if (sectionTitleEl) {
    sectionTitleEl.textContent =
      titles[filter] || "Bugünün Maçları";
  }

  if (filter === "search") {
    if (searchInput) {
      searchInput.focus();
    }
  }

  renderFixtures();
}

/* =========================================================
   FILTER MATCH
   ========================================================= */

function passesFilter(fixture) {
  const filter = state.currentFilter;

  if (filter === "all" || filter === "search") {
    return true;
  }

  if (filter === "favorites") {
    return isFavorite(fixture.fixture?.id);
  }

  const analysis = state.analyses.get(
    String(fixture.fixture?.id)
  );

  /*
   Ayrıntılı analiz henüz yapılmadıysa,
   maç kartında analiz isteği gösterilir.
  */
  if (!analysis) {
    return false;
  }

  const m = analysis.metrics || {};

  if (filter === "reliable") {
    return num(analysis.confidence) >= 70;
  }

  if (filter === "medium") {
    return (
      num(analysis.confidence) >= 60 &&
      num(analysis.confidence) < 70
    );
  }

  if (filter === "risky") {
    return (
      num(analysis.confidence) >= 50 &&
      num(analysis.confidence) < 60
    );
  }

  if (filter === "high") {
    return (
      num(m.bestOdds) >= 2.0 ||
      num(m.longshotProbability) >= 45
    );
  }

  if (filter === "iy2y") {
    return (
      num(m.firstHalfBTTS) >= 40 &&
      num(m.secondHalfBTTS) >= 45
    );
  }

  if (filter === "first-half") {
    return num(m.firstHalfGoal) >= 72;
  }

  if (filter === "second-half") {
    return num(m.secondHalfGoal) >= 75;
  }

  if (filter === "score") {
    return true;
  }

  if (filter === "stats") {
    return true;
  }

  if (filter === "analysis") {
    return true;
  }

  return true;
}

/* =========================================================
   RENDER FIXTURES
   ========================================================= */

function renderFixtures() {
  if (!matchesEl) return;

  let fixtures = state.fixtures.filter(matchesSearch);

  const filteredByMenu = fixtures.filter(passesFilter);

  /*
   Arama filtresi dışındaki analiz filtrelerinde henüz
   analiz edilmemiş maçlar için bilgilendirme.
  */
  if (
    state.currentFilter !== "all" &&
    state.currentFilter !== "search" &&
    state.currentFilter !== "favorites" &&
    filteredByMenu.length === 0
  ) {
    matchesEl.innerHTML = `
      <div class="loading">
        <p>📊 Bu kategori için henüz analiz edilmiş maç yok.</p>
        <small>
          Önce istediğin maçın üzerine dokunup ayrıntılı analizi aç.
          Analiz sonucu bu kategorilere otomatik yerleşir.
        </small>
      </div>
    `;

    updateResultInfo(fixtures.length, 0);
    return;
  }

  fixtures = filteredByMenu;

  matchCountEl.textContent = state.fixtures.length;

  updateResultInfo(
    state.fixtures.length,
    fixtures.length
  );

  if (!fixtures.length) {
    matchesEl.innerHTML = `
      <div class="loading">
        <p>🔎 Sonuç bulunamadı.</p>
      </div>
    `;
    return;
  }

  matchesEl.innerHTML = fixtures
    .map(renderMatchCard)
    .join("");
}

/* =========================================================
   RESULT INFO
   ========================================================= */

function updateResultInfo(total, shown) {
  if (!resultInfoEl) return;

  if (state.currentFilter === "all") {
    resultInfoEl.textContent =
      `${shown} maç`;
  } else {
    resultInfoEl.textContent =
      `${shown} / ${total} maç`;
  }
}

/* =========================================================
   MATCH CARD
   ========================================================= */

function renderMatchCard(fixture) {
  const id = fixture.fixture?.id;
  const home = fixture.teams?.home || {};
  const away = fixture.teams?.away || {};
  const league = fixture.league || {};
  const status = fixture.fixture?.status || {};

  const analysis = state.analyses.get(String(id));

  const fav = isFavorite(id);

  const homeLogo = getLogo(home);
  const awayLogo = getLogo(away);

  let scoreText = "VS";
  let statusText = formatDate(fixture.fixture?.date);

  if (
    status.short === "FT" ||
    status.short === "AET" ||
    status.short === "PEN"
  ) {
    scoreText = `${fixture.goals?.home ?? 0} - ${
      fixture.goals?.away ?? 0
    }`;

    statusText = "MAÇ BİTTİ";
  } else if (status.short === "1H" || status.short === "2H") {
    scoreText = `${fixture.goals?.home ?? 0} - ${
      fixture.goals?.away ?? 0
    }`;

    statusText = "🔴 CANLI";
  }

  const recommendation = analysis
    ? `
      <div class="card-recommendation">
        <span>🎯 ŞUNU OYNA</span>
        <strong>${escapeHTML(
          analysis.mainPick?.label || "-"
        )}</strong>
      </div>
    `
    : `
      <div class="card-recommendation pending">
        <span>📊 ANALİZ</span>
        <strong>Detaylı analiz için aç</strong>
      </div>
    `;

  const confidence = analysis
    ? `
      <div class="card-confidence">
        <span>Model güveni</span>
        <strong>${pct(analysis.confidence)}</strong>
      </div>
    `
    : "";

  return `
    <article
      class="match-card"
      onclick="openAnalysis(${Number(id)})"
      data-fixture="${Number(id)}"
    >
      <div class="match-card-top">
        <div class="league-info">
          ${
            league.logo
              ? `<img src="${escapeHTML(league.logo)}" alt="">`
              : "⚽"
          }
          <span>
            ${escapeHTML(league.name || "Lig")}
            ${league.country ? ` • ${escapeHTML(league.country)}` : ""}
          </span>
        </div>

        <button
          class="favorite-btn ${fav ? "active" : ""}"
          onclick="toggleFavorite(${Number(id)}, event)"
          aria-label="Favori"
        >
          ${fav ? "♥" : "♡"}
        </button>
      </div>

      <div class="match-time">
        <span>${escapeHTML(statusText)}</span>
      </div>

      <div class="teams">
        <div class="team home-team">
          ${
            homeLogo
              ? `<img src="${escapeHTML(homeLogo)}" alt="">`
              : `<div class="team-placeholder">⚽</div>`
          }
          <strong>${escapeHTML(getTeamName(home))}</strong>
        </div>

        <div class="match-score">
          <span>${escapeHTML(scoreText)}</span>
        </div>

        <div class="team away-team">
          ${
            awayLogo
              ? `<img src="${escapeHTML(awayLogo)}" alt="">`
              : `<div class="team-placeholder">⚽</div>`
          }
          <strong>${escapeHTML(getTeamName(away))}</strong>
        </div>
      </div>

      ${analysis ? renderCardMarkets(analysis) : ""}

      ${recommendation}

      ${confidence}

      <div class="card-footer">
        <span>📊 Ayrıntılı analiz</span>
        <span>→</span>
      </div>
    </article>
  `;
}

/* =========================================================
   CARD MARKETS
   ========================================================= */

function renderCardMarkets(analysis) {
  const m = analysis.metrics || {};

  return `
    <div class="card-markets">

      <div>
        <span>MS</span>
        <strong>${escapeHTML(
          m.matchResult || "-"
        )}</strong>
      </div>

      <div>
        <span>KG</span>
        <strong>${pct(m.btts)}</strong>
      </div>

      <div>
        <span>İY KG</span>
        <strong>${pct(m.firstHalfBTTS)}</strong>
      </div>

      <div>
        <span>2Y KG</span>
        <strong>${pct(m.secondHalfBTTS)}</strong>
      </div>

      <div>
        <span>SKOR</span>
        <strong>${escapeHTML(
          analysis.predictedScore || "-"
        )}</strong>
      </div>

    </div>
  `;
}

/* =========================================================
   OPEN ANALYSIS
   ========================================================= */

async function openAnalysis(fixtureId) {
  if (!fixtureId) return;

  openDrawerLoading();

  try {
    const key = String(fixtureId);

    let analysis = state.analyses.get(key);

    if (!analysis) {
      const data = await fetchJSON(
        `/api/match?fixture=${encodeURIComponent(fixtureId)}`
      );

      analysis = buildAnalysis(data);

      state.analyses.set(key, analysis);
    }

    renderAnalysisDrawer(analysis);

    /*
     Filtreler analiz sonucu güncellenir.
    */
    if (
      state.currentFilter !== "all" &&
      state.currentFilter !== "search"
    ) {
      renderFixtures();
    }
  } catch (error) {
    console.error("R❤️İ ANALYSIS ERROR:", error);

    drawerEl.innerHTML = `
      <div class="analysis-panel">
        <button class="drawer-close" onclick="closeDrawer()">×</button>
        <div class="loading">
          <p>⚠️ Analiz verileri alınamadı.</p>
          <small>${escapeHTML(error.message)}</small>
        </div>
      </div>
    `;
  }
}

/* =========================================================
   DRAWER
   ========================================================= */

function openDrawerLoading() {
  if (!drawerEl) return;

  drawerEl.classList.add("open");

  const overlay = $(".drawer-overlay");
  if (overlay) overlay.classList.add("open");

  drawerEl.innerHTML = `
    <div class="analysis-panel">
      <button class="drawer-close" onclick="closeDrawer()">×</button>

      <div class="loading">
        <div class="spinner"></div>
        <p>Maçın tüm verileri analiz ediliyor...</p>
        <small>
          Form • H2H • Puan durumu • İstatistik • Kadro •
          Sakatlık • Oran • Tahmin
        </small>
      </div>
    </div>
  `;
}

function closeDrawer() {
  if (!drawerEl) return;

  drawerEl.classList.remove("open");

  const overlay = $(".drawer-overlay");
  if (overlay) overlay.classList.remove("open");
}

/* =========================================================
   ANALYSIS ENGINE
   ========================================================= */

function buildAnalysis(data) {
  const fixture = data?.fixture || {};
  const teams = data?.teams || {};
  const league = data?.league || {};
  const goals = data?.goals || {};
  const analysisData = data?.analysis_data || {};

  const home = teams.home || {};
  const away = teams.away || {};

  const homeForm = analysisData.form?.home || [];
  const awayForm = analysisData.form?.away || [];

  const h2h = analysisData.h2h || [];

  const standings = analysisData.standings || [];

  const homeStats =
    analysisData.team_statistics?.home || [];

  const awayStats =
    analysisData.team_statistics?.away || [];

  const lineups = analysisData.lineups || [];
  const injuries = analysisData.injuries || [];
  const statistics = analysisData.statistics || [];
  const odds = analysisData.odds || [];
  const apiPrediction =
    analysisData.api_prediction || [];

  const formHome = calculateForm(homeForm, home.id);
  const formAway = calculateForm(awayForm, away.id);

  const h2hMetrics = calculateH2H(
    h2h,
    home.id,
    away.id
  );

  const standingsMetrics = calculateStandings(
    standings,
    home.id,
    away.id
  );

  const teamStatsMetrics = calculateTeamStats(
    homeStats,
    awayStats,
    home.id,
    away.id
  );

  const halfMetrics = calculateHalfMetrics(
    homeForm,
    awayForm,
    homeStats,
    awayStats
  );

  const oddsMetrics = calculateOdds(odds);

  const apiMetrics = calculateApiPrediction(
    apiPrediction
  );

  const strength = calculateStrength({
    formHome,
    formAway,
    h2hMetrics,
    standingsMetrics,
    teamStatsMetrics,
    oddsMetrics,
    apiMetrics
  });

  const expectedGoals = calculateExpectedGoals({
    formHome,
    formAway,
    teamStatsMetrics,
    strength,
    halfMetrics
  });

  const poisson = calculatePoissonMarkets(
    expectedGoals.home,
    expectedGoals.away
  );

  const combined = combineMarkets({
    poisson,
    halfMetrics,
    oddsMetrics,
    apiMetrics,
    h2hMetrics,
    formHome,
    formAway
  });

  const predictedScore = getPredictedScore(
    expectedGoals.home,
    expectedGoals.away
  );

  const mainPick = chooseMainPick({
    combined,
    expectedGoals,
    predictedScore,
    oddsMetrics
  });

  const confidence = calculateConfidence({
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

  const risk = getRisk(confidence);

  return {
    raw: data,

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
      firstHalfGoal: halfMetrics.firstHalfGoal,
      secondHalfGoal: halfMetrics.secondHalfGoal,
      firstHalfBTTS: halfMetrics.firstHalfBTTS,
      secondHalfBTTS: halfMetrics.secondHalfBTTS,
      bestOdds: oddsMetrics.bestOdds,
      longshotProbability: combined.longshotProbability
    },

    predictedScore,
    mainPick,

    confidence,
    risk,

    lineups,
    injuries,
    statistics,

    reasons: generateReasons({
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

    dataStatus: data?.data_status || {}
  };
}

/* =========================================================
   FORM
   ========================================================= */

function calculateForm(matches, teamId) {
  const valid = matches
    .filter((m) => m?.teams)
    .slice(-10);

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsFor = 0;
  let goalsAgainst = 0;

  let firstGoalFor = 0;
  let firstGoalAgainst = 0;

  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  let firstHalfGoals = 0;
  let secondHalfGoals = 0;

  valid.forEach((match) => {
    const isHome =
      num(match.teams?.home?.id) === num(teamId);

    const gf = isHome
      ? num(match.goals?.home)
      : num(match.goals?.away);

    const ga = isHome
      ? num(match.goals?.away)
      : num(match.goals?.home);

    goalsFor += gf;
    goalsAgainst += ga;

    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;

    const total = gf + ga;

    if (total >= 2) over15++;
    if (total >= 3) over25++;

    if (gf > 0 && ga > 0) btts++;

    const htHome = num(
      match.score?.halftime?.home
    );

    const htAway = num(
      match.score?.halftime?.away
    );

    const htFor = isHome ? htHome : htAway;
    const htAgainst = isHome ? htAway : htHome;

    firstHalfGoals += htFor + htAgainst;

    const secondFor = gf - htFor;
    const secondAgainst = ga - htAgainst;

    secondHalfGoals +=
      Math.max(0, secondFor) +
      Math.max(0, secondAgainst);

    const firstGoal =
      match.goals?.home != null ||
      match.goals?.away != null;

    if (firstGoal) {
      if (gf > 0 && ga === 0) firstGoalFor++;
      if (ga > 0 && gf === 0) firstGoalAgainst++;
    }
  });

  const n = valid.length || 1;

  return {
    matches: valid.length,
    wins,
    draws,
    losses,

    winRate: (wins / n) * 100,
    drawRate: (draws / n) * 100,
    lossRate: (losses / n) * 100,

    goalsFor,
    goalsAgainst,

    goalsForAvg: goalsFor / n,
    goalsAgainstAvg: goalsAgainst / n,

    over15: (over15 / n) * 100,
    over25: (over25 / n) * 100,
    btts: (btts / n) * 100,

    firstHalfGoalsAvg: firstHalfGoals / n,
    secondHalfGoalsAvg: secondHalfGoals / n,

    firstGoalForRate: (firstGoalFor / n) * 100,
    firstGoalAgainstRate:
      (firstGoalAgainst / n) * 100
  };
}

/* =========================================================
   H2H
   ========================================================= */

function calculateH2H(matches, homeId, awayId) {
  const valid = matches
    .filter((m) => m?.teams)
    .slice(-10);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  let totalGoals = 0;
  let btts = 0;
  let over25 = 0;

  valid.forEach((m) => {
    const h = num(m.teams?.home?.id);
    const a = num(m.teams?.away?.id);

    const hg = num(m.goals?.home);
    const ag = num(m.goals?.away);

    totalGoals += hg + ag;

    if (hg > 0 && ag > 0) btts++;
    if (hg + ag >= 3) over25++;

    if (h === num(homeId)) {
      if (hg > ag) homeWins++;
      else if (hg === ag) draws++;
      else awayWins++;
    } else {
      if (ag > hg) homeWins++;
      else if (ag === hg) draws++;
      else awayWins++;
    }
  });

  const n = valid.length || 1;

  return {
    matches: valid.length,
    homeWins,
    draws,
    awayWins,

    homeWinRate: (homeWins / n) * 100,
    drawRate: (draws / n) * 100,
    awayWinRate: (awayWins / n) * 100,

    goalsAvg: totalGoals / n,
    btts: (btts / n) * 100,
    over25: (over25 / n) * 100
  };
}

/* =========================================================
   STANDINGS
   ========================================================= */

function calculateStandings(rows, homeId, awayId) {
  let home = null;
  let away = null;

  function search(list) {
    for (const group of list || []) {
      const table = group?.league?.standings || [];

      for (const rowGroup of table) {
        for (const row of rowGroup || []) {
          const id = num(row.team?.id);

          if (id === num(homeId)) home = row;
          if (id === num(awayId)) away = row;
        }
      }
    }
  }

  search(rows);

  return {
    home,
    away,
    homeRank: num(home?.rank, 0),
    awayRank: num(away?.rank, 0),
    homePoints: num(home?.points, 0),
    awayPoints: num(away?.points, 0)
  };
}

/* =========================================================
   TEAM STATISTICS
   ========================================================= */

function calculateTeamStats(
  homeStats,
  awayStats,
  homeId,
  awayId
) {
  const home = extractTeamStats(
    homeStats,
    homeId
  );

  const away = extractTeamStats(
    awayStats,
    awayId
  );

  return {
    home,
    away
  };
}

function extractTeamStats(rows, teamId) {
  let item = null;

  for (const row of rows || []) {
    if (!row) continue;

    if (
      num(row?.team?.id) === num(teamId)
    ) {
      item = row;
      break;
    }

    if (row?.goals || row?.form || row?.fixtures) {
      item = row;
      break;
    }
  }

  if (!item) {
    return {
      matches: 0,
      goalsForAvg: 0,
      goalsAgainstAvg: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      over15: 0,
      over25: 0,
      btts: 0
    };
  }

  const played =
    num(item.fixtures?.played?.total) ||
    num(item.fixtures?.played?.home) +
      num(item.fixtures?.played?.away) ||
    0;

  const goalsFor =
    num(item.goals?.for?.total?.total) ||
    num(item.goals?.for?.total) ||
    0;

  const goalsAgainst =
    num(item.goals?.against?.total?.total) ||
    num(item.goals?.against?.total) ||
    0;

  return {
    matches: played,

    goalsForAvg:
      played > 0 ? goalsFor / played : 0,

    goalsAgainstAvg:
      played > 0 ? goalsAgainst / played : 0,

    wins:
      num(item.fixtures?.wins?.total),

    draws:
      num(item.fixtures?.draws?.total),

    losses:
      num(item.fixtures?.loses?.total),

    over15: extractPercentage(
      item.goals?.for?.minute,
      2
    ),

    over25: 0,

    btts: 0
  };
}

function extractPercentage(obj, fallback) {
  if (!obj || typeof obj !== "object") {
    return 0;
  }

  const values = Object.values(obj)
    .map((v) => {
      if (typeof v === "object") {
        return num(v?.percentage);
      }

      return 0;
    })
    .filter((v) => v > 0);

  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : fallback;
}

/* =========================================================
   HALF ANALYSIS
   ========================================================= */

function calculateHalfMetrics(
  homeForm,
  awayForm,
  homeStats,
  awayStats
) {
  const firstGoalBase =
    (
      homeForm.firstHalfGoalsAvg +
      awayForm.firstHalfGoalsAvg
    ) / 2;

  const secondGoalBase =
    (
      homeForm.secondHalfGoalsAvg +
      awayForm.secondHalfGoalsAvg
    ) / 2;

  const firstHalfGoal = clamp(
    48 +
      firstGoalBase * 16 +
      (homeForm.over15 + awayForm.over15) * 0.08
  );

  const secondHalfGoal = clamp(
    55 +
      secondGoalBase * 14 +
      (homeForm.over25 + awayForm.over25) * 0.07
  );

  /*
   İY KG çok daha zor bir markettir.
   Sadece iki takımın ilk yarıda gol atma eğilimi
   yeterince güçlü ise yükseltilir.
  */
  const firstHalfBTTS = clamp(
    10 +
      Math.min(homeForm.firstHalfGoalsAvg, 2) * 15 +
      Math.min(awayForm.firstHalfGoalsAvg, 2) * 15 +
      Math.min(homeForm.btts, 100) * 0.10 +
      Math.min(awayForm.btts, 100) * 0.10
  );

  const secondHalfBTTS = clamp(
    15 +
      Math.min(homeForm.secondHalfGoalsAvg, 2) * 15 +
      Math.min(awayForm.secondHalfGoalsAvg, 2) * 15 +
      Math.min(homeForm.btts, 100) * 0.12 +
      Math.min(awayForm.btts, 100) * 0.12
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

function calculateOdds(oddsData) {
  let bestOdds = 0;

  const marketOdds = {
    home: 0,
    draw: 0,
    away: 0,
    bttsYes: 0,
    over25: 0
  };

  const rows = Array.isArray(oddsData)
    ? oddsData
    : [];

  rows.forEach((bookmakerGroup) => {
    const bookmakers =
      bookmakerGroup?.bookmakers ||
      [];

    bookmakers.forEach((bookmaker) => {
      const bets = bookmaker?.bets || [];

      bets.forEach((bet) => {
        const name = String(
          bet?.name || ""
        ).toLowerCase();

        const values = bet?.values || [];

        values.forEach((value) => {
          const odd = num(value?.odd);

          if (odd > bestOdds) {
            bestOdds = odd;
          }

          const valueName = String(
            value?.value || ""
          ).toLowerCase();

          if (
            name.includes("match winner") ||
            name.includes("winner")
          ) {
            if (valueName === "home") {
              marketOdds.home = Math.max(
                marketOdds.home,
                odd
              );
            }

            if (valueName === "draw") {
              marketOdds.draw = Math.max(
                marketOdds.draw,
                odd
              );
            }

            if (valueName === "away") {
              marketOdds.away = Math.max(
                marketOdds.away,
                odd
              );
            }
          }

          if (
            name.includes("both teams") ||
            name.includes("both teams to score")
          ) {
            if (
              valueName.includes("yes")
            ) {
              marketOdds.bttsYes =
                Math.max(
                  marketOdds.bttsYes,
                  odd
                );
            }
          }

          if (
            name.includes("over/under") ||
            name.includes("goals over")
          ) {
            if (
              valueName.includes("over 2.5")
            ) {
              marketOdds.over25 =
                Math.max(
                  marketOdds.over25,
                  odd
                );
            }
          }
        });
      });
    });
  });

  return {
    ...marketOdds,
    bestOdds
  };
}

/* =========================================================
   API-FOOTBALL PREDICTION
   ========================================================= */

function calculateApiPrediction(predictions) {
  const item = predictions?.[0];

  const pred = item?.predictions || {};

  const winner =
    pred.winner?.name ||
    pred.winner?.comment ||
    null;

  return {
    winner,
    advice: pred.advice || null,

    home:
      num(
        pred.percent?.home
      ),

    draw:
      num(
        pred.percent?.draw
      ),

    away:
      num(
        pred.percent?.away
      ),

    underOver:
      pred.under_over || null,

    goalsHome:
      pred.goals?.home || null,

    goalsAway:
      pred.goals?.away || null
  };
}

/* =========================================================
   STRENGTH
   ========================================================= */

function calculateStrength({
  formHome,
  formAway,
  h2hMetrics,
  standingsMetrics,
  teamStatsMetrics,
  oddsMetrics,
  apiMetrics
}) {
  const homeFormScore =
    formHome.winRate * 0.55 +
    (100 - formHome.lossRate) * 0.25 +
    clamp(
      formHome.goalsForAvg * 25
    ) * 0.20;

  const awayFormScore =
    formAway.winRate * 0.55 +
    (100 - formAway.lossRate) * 0.25 +
    clamp(
      formAway.goalsForAvg * 25
    ) * 0.20;

  let homeScore = homeFormScore;
  let awayScore = awayFormScore;

  if (
    standingsMetrics.homeRank &&
    standingsMetrics.awayRank
  ) {
    if (
      standingsMetrics.homeRank <
      standingsMetrics.awayRank
    ) {
      homeScore += 7;
    } else if (
      standingsMetrics.awayRank <
      standingsMetrics.homeRank
    ) {
      awayScore += 7;
    }
  }

  if (h2hMetrics.matches > 0) {
    homeScore +=
      h2hMetrics.homeWinRate * 0.08;

    awayScore +=
      h2hMetrics.awayWinRate * 0.08;
  }

  if (apiMetrics.home > 0) {
    homeScore += apiMetrics.home * 0.15;
  }

  if (apiMetrics.away > 0) {
    awayScore += apiMetrics.away * 0.15;
  }

  return {
    home: clamp(homeScore),
    away: clamp(awayScore)
  };
}

/* =========================================================
   EXPECTED GOALS
   ========================================================= */

function calculateExpectedGoals({
  formHome,
  formAway,
  teamStatsMetrics,
  strength,
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
    teamStatsMetrics.home.goalsForAvg > 0
  ) {
    homeAttack =
      homeAttack * 0.65 +
      teamStatsMetrics.home.goalsForAvg * 0.35;
  }

  if (
    teamStatsMetrics.away.goalsForAvg > 0
  ) {
    awayAttack =
      awayAttack * 0.65 +
      teamStatsMetrics.away.goalsForAvg * 0.35;
  }

  if (
    teamStatsMetrics.home.goalsAgainstAvg > 0
  ) {
    homeDefense =
      homeDefense * 0.65 +
      teamStatsMetrics.home.goalsAgainstAvg * 0.35;
  }

  if (
    teamStatsMetrics.away.goalsAgainstAvg > 0
  ) {
    awayDefense =
      awayDefense * 0.65 +
      teamStatsMetrics.away.goalsAgainstAvg * 0.35;
  }

  let homeXG =
    homeAttack * 0.62 +
    awayDefense * 0.38;

  let awayXG =
    awayAttack * 0.62 +
    homeDefense * 0.38;

  /*
   Ev sahibi avantajı.
  */
  homeXG += 0.15;

  /*
   Aşırı uç değerleri engelle.
  */
  homeXG = clamp(homeXG, 0.15, 3.5);
  awayXG = clamp(awayXG, 0.10, 3.2);

  /*
   Yarı gol eğilimi çok güçlüyse küçük düzeltme.
  */
  if (halfMetrics.firstHalfGoal > 78) {
    homeXG += 0.05;
    awayXG += 0.05;
  }

  return {
    home: clamp(homeXG, 0.15, 3.6),
    away: clamp(awayXG, 0.10, 3.4),

    total:
      clamp(homeXG + awayXG, 0.3, 6.5)
  };
}

/* =========================================================
   POISSON
   ========================================================= */

function poissonProbability(lambda, k) {
  if (lambda <= 0) {
    return k === 0 ? 1 : 0;
  }

  let factorial = 1;

  for (let i = 2; i <= k; i++) {
    factorial *= i;
  }

  return (
    Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial
  );
}

function calculatePoissonMarkets(
  homeXG,
  awayXG
) {
  const matrix = [];

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  let btts = 0;

  let firstHomeGoals = 0;
  let firstAwayGoals = 0;

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const ph =
        poissonProbability(homeXG, h);

      const pa =
        poissonProbability(awayXG, a);

      const p = ph * pa;

      matrix.push({
        home: h,
        away: a,
        probability: p
      });

      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;

      const total = h + a;

      if (total >= 2) over15 += p;
      if (total >= 3) over25 += p;
      if (total >= 4) over35 += p;

      if (h > 0 && a > 0) {
        btts += p;
      }
    }
  }

  return {
    matrix,

    homeWin: homeWin * 100,
    draw: draw * 100,
    awayWin: awayWin * 100,

    over15: over15 * 100,
    over25: over25 * 100,
    over35: over35 * 100,

    under15: (1 - over15) * 100,
    under25: (1 - over25) * 100,
    under35: (1 - over35) * 100,

    btts: btts * 100,
    noBtts: (1 - btts) * 100
  };
}

/* =========================================================
   COMBINE MARKETS
   ========================================================= */

function combineMarkets({
  poisson,
  halfMetrics,
  oddsMetrics,
  apiMetrics,
  h2hMetrics,
  formHome,
  formAway
}) {
  let homeWin = poisson.homeWin;
  let draw = poisson.draw;
  let awayWin = poisson.awayWin;

  /*
   API-Football yüzdeleri varsa Poisson ile birleştir.
  */
  if (
    apiMetrics.home > 0 ||
    apiMetrics.away > 0
  ) {
    homeWin =
      homeWin * 0.72 +
      apiMetrics.home * 0.28;

    awayWin =
      awayWin * 0.72 +
      apiMetrics.away * 0.28;

    if (apiMetrics.draw > 0) {
      draw =
        draw * 0.72 +
        apiMetrics.draw * 0.28;
    }
  }

  /*
   H2H çok eski/az veri ise etkisi sınırlı.
  */
  if (h2hMetrics.matches >= 5) {
    homeWin =
      homeWin * 0.92 +
      h2hMetrics.homeWinRate * 0.08;

    awayWin =
      awayWin * 0.92 +
      h2hMetrics.awayWinRate * 0.08;
  }

  /*
   Normalize.
  */
  const total =
    homeWin + draw + awayWin;

  homeWin =
    (homeWin / total) * 100;

  draw =
    (draw / total) * 100;

  awayWin =
    (awayWin / total) * 100;

  /*
   KG.
   Poisson ana kaynak, form/H2H küçük düzeltme.
  */
  let btts = poisson.btts;

  const formBTTS =
    (
      formHome.btts +
      formAway.btts
    ) / 2;

  btts =
    btts * 0.78 +
    formBTTS * 0.22;

  if (h2hMetrics.matches >= 5) {
    btts =
      btts * 0.92 +
      h2hMetrics.btts * 0.08;
  }

  /*
   Yarı marketleri ayrı hesapla.
  */
  const firstHalfGoal =
    halfMetrics.firstHalfGoal;

  const secondHalfGoal =
    halfMetrics.secondHalfGoal;

  const firstHalfBTTS =
    halfMetrics.firstHalfBTTS;

  const secondHalfBTTS =
    halfMetrics.secondHalfBTTS;

  /*
   İY KG + 2Y KG:
   İki yarıda da KG.
  */
  const iy2yBTTS = clamp(
    Math.min(
      firstHalfBTTS,
      secondHalfBTTS
    ) * 0.88
  );

  /*
   İki yarıda en az bir gol.
  */
  const bothHalvesGoal = clamp(
    Math.min(
      firstHalfGoal,
      secondHalfGoal
    ) * 0.96
  );

  /*
   Uzun oran için daha yüksek eşik gerekir.
  */
  const longshotProbability =
    Math.max(
      homeWin,
      awayWin,
      btts,
      firstHalfBTTS,
      secondHalfBTTS
    );

  let matchResult = "X";

  if (homeWin >= awayWin && homeWin >= draw) {
    matchResult = "1";
  } else if (
    awayWin >= homeWin &&
    awayWin >= draw
  ) {
    matchResult = "2";
  }

  return {
    homeWin,
    draw,
    awayWin,

    matchResult,

    btts,
    noBtts: 100 - btts,

    over15: poisson.over15,
    over25: poisson.over25,
    over35: poisson.over35,

    under15: poisson.under15,
    under25: poisson.under25,
    under35: poisson.under35,

    firstHalfGoal,
    secondHalfGoal,

    firstHalfBTTS,
    secondHalfBTTS,

    iy2yBTTS,

    bothHalvesGoal,

    longshotProbability,

    bestOdds:
      oddsMetrics.bestOdds || 0
  };
}

/* =========================================================
   PREDICTED SCORE
   ========================================================= */

function getPredictedScore(homeXG, awayXG) {
  const home = Math.max(
    0,
    Math.min(6, Math.round(homeXG))
  );

  const away = Math.max(
    0,
    Math.min(6, Math.round(awayXG))
  );

  return `${home}-${away}`;
}

/* =========================================================
   MAIN PICK
   ========================================================= */

function chooseMainPick({
  combined,
  expectedGoals,
  predictedScore,
  oddsMetrics
}) {
  const candidates = [];

  /*
   MS1 / MS2
   */
  if (combined.homeWin >= 63) {
    candidates.push({
      type: "MS",
      label: "MS 1",
      probability: combined.homeWin,
      score: combined.homeWin,
      reason: "Ev sahibi galibiyet olasılığı güçlü."
    });
  }

  if (combined.awayWin >= 63) {
    candidates.push({
      type: "MS",
      label: "MS 2",
      probability: combined.awayWin,
      score: combined.awayWin,
      reason: "Deplasman galibiyet olasılığı güçlü."
    });
  }

  /*
   KG
   */
  if (combined.btts >= 64) {
    candidates.push({
      type: "BTTS",
      label: "KG VAR",
      probability: combined.btts,
      score: combined.btts + 1,
      reason:
        "İki takımın da gol bulma eğilimi yüksek."
    });
  }

  /*
   KG YOK
   */
  if (combined.noBtts >= 68) {
    candidates.push({
      type: "BTTS",
      label: "KG YOK",
      probability: combined.noBtts,
      score: combined.noBtts,
      reason:
        "İki takımın birlikte gol bulma ihtimali sınırlı."
    });
  }

  /*
   O2.5
   */
  if (combined.over25 >= 66) {
    candidates.push({
      type: "GOALS",
      label: "2.5 ÜST",
      probability: combined.over25,
      score: combined.over25,
      reason:
        "Model toplam gol beklentisini yüksek buluyor."
    });
  }

  /*
   O1.5 ana seçim olarak ancak çok güçlü değil,
   çünkü doğal olarak yüksek çıkan bir markettir.
  */
  if (
    combined.over15 >= 82 &&
    expectedGoals.total >= 2.15
  ) {
    candidates.push({
      type: "GOALS",
      label: "1.5 ÜST",
      probability: combined.over15,
      score: combined.over15 - 7,
      reason:
        "Toplam gol için güçlü temel var."
    });
  }

  /*
   İY KG
   */
  if (combined.firstHalfBTTS >= 55) {
    candidates.push({
      type: "HALF",
      label: "İY KG VAR",
      probability: combined.firstHalfBTTS,
      score:
        combined.firstHalfBTTS + 2,
      reason:
        "İlk yarıda iki takımın da gol bulma sinyali güçlü."
    });
  }

  /*
   2Y KG
   */
  if (combined.secondHalfBTTS >= 58) {
    candidates.push({
      type: "HALF",
      label: "2Y KG VAR",
      probability: combined.secondHalfBTTS,
      score:
        combined.secondHalfBTTS + 3,
      reason:
        "İkinci yarı karşılıklı gol eğilimi yüksek."
    });
  }

  /*
   İY + 2Y KG
   */
  if (combined.iy2yBTTS >= 48) {
    candidates.push({
      type: "HALVES",
      label: "İY KG + 2Y KG",
      probability: combined.iy2yBTTS,
      score:
        combined.iy2yBTTS + 4,
      reason:
        "Model iki yarıda da karşılıklı gol ihtimalini destekliyor."
    });
  }

  /*
   İki yarıda gol
   */
  if (combined.bothHalvesGoal >= 78) {
    candidates.push({
      type: "HALVES",
      label: "İki Yarıda Gol",
      probability: combined.bothHalvesGoal,
      score:
        combined.bothHalvesGoal - 2,
      reason:
        "Her iki yarıda da gol görülme olasılığı yüksek."
    });
  }

  /*
   Hiçbir market yeterince güçlü değilse
   zorlama seçim yapma.
  */
  if (!candidates.length) {
    return {
      label: "Maç için güçlü seçim yok",
      probability: Math.max(
        combined.homeWin,
        combined.draw,
        combined.awayWin,
        combined.btts,
        combined.over25
      ),
      reason:
        "Model yeterli veri/güven seviyesine ulaşmadı."
    };
  }

  /*
   En yüksek skorlu seçimi al.
  */
  candidates.sort(
    (a, b) => b.score - a.score
  );

  const best = candidates[0];

  /*
   Çok düşük oranlı ve trivial marketlerin
   otomatik olarak öne geçmesini engelle.
  */
  if (
    best.label === "1.5 ÜST" &&
    candidates.length > 1
  ) {
    const alternative =
      candidates.find(
        (x) =>
          x.label !== "1.5 ÜST" &&
          x.probability >= 63
      );

    if (alternative) {
      return {
        label: alternative.label,
        probability: alternative.probability,
        reason: alternative.reason
      };
    }
  }

  return {
    label: best.label,
    probability: best.probability,
    reason: best.reason
  };
}

/* =========================================================
   CONFIDENCE
   ========================================================= */

function calculateConfidence({
  mainPick,
  combined,
  formHome,
  formAway,
  h2hMetrics,
  standingsMetrics,
  teamStatsMetrics,
  lineups,
  injuries
}) {
  let confidence =
    num(mainPick.probability);

  /*
   Veri kalitesi.
  */
  let quality = 0;

  if (formHome.matches >= 5) quality += 8;
  if (formAway.matches >= 5) quality += 8;

  if (h2hMetrics.matches >= 5) quality += 5;

  if (
    standingsMetrics.home ||
    standingsMetrics.away
  ) {
    quality += 5;
  }

  if (
    teamStatsMetrics.home.matches > 0 ||
    teamStatsMetrics.away.matches > 0
  ) {
    quality += 5;
  }

  if (lineups.length) quality += 3;
  if (injuries.length) quality += 2;

  confidence =
    confidence * 0.84 +
    Math.min(quality, 36) * 0.16;

  /*
   Piyasadaki çok yüksek olasılıkları
   direkt %100'e taşımıyoruz.
  */
  return clamp(
    confidence,
    35,
    94
  );
}

/* =========================================================
   RISK
   ========================================================= */

function getRisk(confidence) {
  if (confidence >= 70) {
    return {
      label: "Güvenilir",
      className: "low"
    };
  }

  if (confidence >= 60) {
    return {
      label: "Orta Risk",
      className: "medium"
    };
  }

  if (confidence >= 50) {
    return {
      label: "Riskli",
      className: "risky"
    };
  }

  return {
    label: "Yüksek Risk",
    className: "high"
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
  teamStatsMetrics,
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
      )} maç formu değerlendirildi.`
    );
  }

  if (
    formHome.goalsForAvg >
    formAway.goalsForAvg
  ) {
    reasons.push(
      `${formHome.goalsForAvg.toFixed(
        2
      )} gol/maç ile ev sahibi hücum üretiminde önde.`
    );
  } else if (
    formAway.goalsForAvg >
    formHome.goalsForAvg
  ) {
    reasons.push(
      `${formAway.goalsForAvg.toFixed(
        2
      )} gol/maç ile deplasman hücum üretiminde önde.`
    );
  }

  if (combined.btts >= 65) {
    reasons.push(
      `KG model olasılığı yaklaşık ${pct(
        combined.btts
      )}.`
    );
  }

  if (combined.over25 >= 65) {
    reasons.push(
      `2.5 üst model olasılığı yaklaşık ${pct(
        combined.over25
      )}.`
    );
  }

  if (halfMetrics.firstHalfGoal >= 72) {
    reasons.push(
      `İlk yarıda gol beklentisi yüksek (${pct(
        halfMetrics.firstHalfGoal
      )}).`
    );
  }

  if (halfMetrics.secondHalfGoal >= 75) {
    reasons.push(
      `İkinci yarıda gol beklentisi yüksek (${pct(
        halfMetrics.secondHalfGoal
      )}).`
    );
  }

  if (
    halfMetrics.firstHalfBTTS >= 45 &&
    halfMetrics.secondHalfBTTS >= 50
  ) {
    reasons.push(
      `İY/2Y KG modeli iki yarıda da karşılıklı gol sinyali veriyor.`
    );
  }

  if (h2hMetrics.matches >= 5) {
    reasons.push(
      `${h2hMetrics.matches} H2H karşılaşması modele dahil edildi.`
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

  if (lineups.length) {
    reasons.push(
      "Mevcut kadro verisi analiz edildi."
    );
  }

  if (injuries.length) {
    reasons.push(
      `${injuries.length} sakatlık/eksik kaydı kontrol edildi.`
    );
  }

  reasons.push(
    `Tahmini skor: ${predictedScore}.`
  );

  return reasons.slice(0, 8);
}

/* =========================================================
   ANALYSIS DRAWER HTML
   ========================================================= */

function renderAnalysisDrawer(a) {
  if (!drawerEl) return;

  drawerEl.classList.add("open");

  const overlay = $(".drawer-overlay");
  if (overlay) overlay.classList.add("open");

  const home = a.teams?.home || {};
  const away = a.teams?.away || {};

  const m = a.metrics || {};

  drawerEl.innerHTML = `
    <div class="analysis-panel">

      <button class="drawer-close" onclick="closeDrawer()">×</button>

      <div class="analysis-header">

        <div class="analysis-league">
          ${escapeHTML(
            a.league?.name || "Maç Analizi"
          )}
        </div>

        <div class="analysis-teams">

          <div>
            ${
              home.logo
                ? `<img src="${escapeHTML(
                    home.logo
                  )}" alt="">`
                : "⚽"
            }
            <strong>
              ${escapeHTML(
                getTeamName(home)
              )}
            </strong>
          </div>

          <span>VS</span>

          <div>
            ${
              away.logo
                ? `<img src="${escapeHTML(
                    away.logo
                  )}" alt="">`
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
            formatDate(a.fixture?.date)
          )}
        </div>

      </div>

      <div class="strongest-selection">

        <div class="selection-label">
          🎯 ŞUNU OYNA
        </div>

        <div class="selection-main">
          ${escapeHTML(
            a.mainPick?.label || "-"
          )}
        </div>

        <div class="selection-reason">
          ${escapeHTML(
            a.mainPick?.reason || ""
          )}
        </div>

        <div class="confidence-row">
          <span>Model güveni</span>
          <strong>${pct(
            a.confidence
          )}</strong>
        </div>

        <div class="confidence-bar">
          <span style="width:${clamp(
            a.confidence
          )}%"></span>
        </div>

        <div class="risk ${escapeHTML(
          a.risk?.className || ""
        )}">
          ${escapeHTML(
            a.risk?.label || ""
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
        ⚠️ Model çıktıları istatistiksel tahmindir; garanti değildir.
      </div>

    </div>
  `;
}

/* =========================================================
   EXPECTED GOALS
   ========================================================= */

function renderExpectedGoals(a) {
  return `
    <section class="analysis-section">
      <div class="section-title">
        ⚽ Beklenen Goller
      </div>

      <div class="expected-goals">

        <div>
          <span>${escapeHTML(
            getTeamName(a.teams?.home)
          )}</span>
          <strong>
            ${num(
              a.expectedGoals?.home
            ).toFixed(2)}
          </strong>
        </div>

        <div class="expected-total">
          <span>Toplam</span>
          <strong>
            ${num(
              a.expectedGoals?.total
            ).toFixed(2)}
          </strong>
        </div>

        <div>
          <span>${escapeHTML(
            getTeamName(a.teams?.away)
          )}</span>
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
   RESULT MARKETS
   ========================================================= */

function renderResultMarkets(a) {
  const m = a.metrics || {};

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
   GOAL MARKETS
   ========================================================= */

function renderGoalMarkets(a) {
  const m = a.metrics || {};

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
   HALF MARKETS
   ========================================================= */

function renderHalfMarkets(a) {
  const m = a.metrics || {};

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

function marketBox(label, value) {
  const v = clamp(num(value));

  let cls = "";

  if (v >= 70) cls = "market-high";
  else if (v >= 60) cls = "market-medium";
  else if (v >= 50) cls = "market-risk";
  else cls = "market-low";

  return `
    <div class="market-box ${cls}">
      <span>${escapeHTML(label)}</span>
      <strong>${pct(v)}</strong>
    </div>
  `;
}

/* =========================================================
   SCORE
   ========================================================= */

function renderScoreBox(a) {
  return `
    <section class="analysis-section">

      <div class="section-title">
        🎯 Tahmini Skor
      </div>

      <div class="score-box">
        <strong>
          ${escapeHTML(
            a.predictedScore || "-"
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

function renderFormSection(a) {
  const h = a.formHome || {};
  const aw = a.formAway || {};

  return `
    <section class="analysis-section">

      <div class="section-title">
        📊 Son Form
      </div>

      <div class="form-comparison">

        ${formTeamHTML(
          a.teams?.home,
          h
        )}

        ${formTeamHTML(
          a.teams?.away,
          aw
        )}

      </div>

    </section>
  `;
}

function formTeamHTML(team, f) {
  return `
    <div class="form-team">

      <strong>
        ${escapeHTML(
          getTeamName(team)
        )}
      </strong>

      <div class="form-numbers">
        <span>G ${f.wins}</span>
        <span>B ${f.draws}</span>
        <span>M ${f.losses}</span>
      </div>

      <small>
        ${f.goalsForAvg.toFixed(2)}
        gol atıyor /
        ${f.goalsAgainstAvg.toFixed(2)}
        gol yiyor
      </small>

      <small>
        KG ${pct(f.btts)}
        • 2.5 ÜST ${pct(f.over25)}
      </small>

    </div>
  `;
}

/* =========================================================
   H2H
   ========================================================= */

function renderH2HSection(a) {
  const h = a.h2hMetrics || {};

  return `
    <section class="analysis-section">

      <div class="section-title">
        🤝 H2H
      </div>

      <div class="analysis-text">

        <p>
          Son ${h.matches || 0} karşılaşma:
          ${h.homeWins || 0} ev sahibi galibiyeti,
          ${h.draws || 0} beraberlik,
          ${h.awayWins || 0} deplasman galibiyeti.
        </p>

        <p>
          KG: ${pct(h.btts || 0)}
          •
          2.5 ÜST: ${pct(h.over25 || 0)}
          •
          Ortalama gol:
          ${num(h.goalsAvg).toFixed(2)}
        </p>

      </div>

    </section>
  `;
}

/* =========================================================
   STANDINGS
   ========================================================= */

function renderStandingsSection(a) {
  const s = a.standingsMetrics || {};

  if (!s.homeRank && !s.awayRank) {
    return "";
  }

  return `
    <section class="analysis-section">

      <div class="section-title">
        🏆 Lig Sıralaması
      </div>

      <div class="market-grid">

        <div class="market-box">
          <span>${escapeHTML(
            getTeamName(a.teams?.home)
          )}</span>
          <strong>
            ${s.homeRank || "-"}.
          </strong>
        </div>

        <div class="market-box">
          <span>${escapeHTML(
            getTeamName(a.teams?.away)
          )}</span>
          <strong>
            ${s.awayRank || "-"}.
          </strong>
        </div>

      </div>

    </section>
  `;
}

/* =========================================================
   TEAM STATS
   ========================================================= */

function renderTeamStatsSection(a) {
  const h = a.teamStatsMetrics?.home || {};
  const aw = a.teamStatsMetrics?.away || {};

  return `
    <section class="analysis-section">

      <div class="section-title">
        📈 Takım İstatistikleri
      </div>

      <div class="analysis-text">

        <p>
          <strong>${escapeHTML(
            getTeamName(a.teams?.home)
          )}</strong>:
          ${num(h.goalsForAvg).toFixed(2)}
          gol/maç,
          ${num(h.goalsAgainstAvg).toFixed(2)}
          gol yiyor.
        </p>

        <p>
          <strong>${escapeHTML(
            getTeamName(a.teams?.away)
          )}</strong>:
          ${num(aw.goalsForAvg).toFixed(2)}
          gol/maç,
          ${num(aw.goalsAgainstAvg).toFixed(2)}
          gol yiyor.
        </p>

      </div>

    </section>
  `;
}

/* =========================================================
   SQUAD
   ========================================================= */

function renderSquadSection(a) {
  const injuries = a.injuries || [];
  const lineups = a.lineups || [];

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
              lineups.length
                ? "Mevcut"
                : "Sınırlı / yok"
            }
          </strong>
        </p>

        <p>
          Sakatlık / eksik kaydı:
          <strong>
            ${injuries.length}
          </strong>
        </p>

      </div>

    </section>
  `;
}

/* =========================================================
   REASONS
   ========================================================= */

function renderReasonsSection(a) {
  const reasons = a.reasons || [];

  return `
    <section class="analysis-section">

      <div class="section-title">
        🧠 Analiz Gerekçeleri
      </div>

      <div class="analysis-text">

        ${
          reasons.length
            ? `<ul>
                ${reasons
                  .map(
                    (r) =>
                      `<li>${escapeHTML(
                        r
                      )}</li>`
                  )
                  .join("")}
              </ul>`
            : "<p>Yeterli açıklama üretilemedi.</p>"
        }

      </div>

    </section>
  `;
}

/* =========================================================
   DATA STATUS
   ========================================================= */

function renderDataStatus(a) {
  const s = a.dataStatus || {};

  const items = [
    ["Maç", s.fixture],
    ["Ev sahibi form", s.home_form],
    ["Deplasman form", s.away_form],
    ["H2H", s.h2h],
    ["Puan durumu", s.standings],
    ["Ev sahibi istatistik", s.home_statistics],
    ["Deplasman istatistik", s.away_statistics],
    ["Kadro", s.lineups],
    ["Sakatlık", s.injuries],
    ["Maç istatistikleri", s.statistics],
    ["Oranlar", s.odds],
    ["API prediction", s.predictions]
  ];

  return `
    <section class="analysis-section">

      <div class="section-title">
        🔌 Veri Durumu
      </div>

      <div class="data-status-grid">

        ${items
          .map(
            ([label, ok]) => `
              <div class="data-status-item">
                <span>${escapeHTML(
                  label
                )}</span>
                <strong>
                  ${ok ? "✓" : "—"}
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
          event.target.value || ""
        ).trim();

      if (
        state.currentFilter !==
        "search"
      ) {
        state.currentFilter =
          "search";

        document
          .querySelectorAll(".menu-item")
          .forEach((button) => {
            button.classList.toggle(
              "active",
              button.dataset.filter ===
                "search"
            );
          });

        if (sectionTitleEl) {
          sectionTitleEl.textContent =
            "Maç Ara";
        }
      }

      renderFixtures();
    }
  );
}

/* =========================================================
   MENU EVENTS
   ========================================================= */

document
  .querySelectorAll(".menu-item")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        applyFilter(
          button.dataset.filter
        );
      }
    );
  });

/* =========================================================
   OVERLAY
   ========================================================= */

const overlay = $(".drawer-overlay");

if (overlay) {
  overlay.addEventListener(
    "click",
    closeDrawer
  );
}

/* =========================================================
   ESCAPE
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      closeDrawer();
    }
  }
);

/* =========================================================
   GLOBAL FUNCTIONS
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

document.addEventListener(
  "DOMContentLoaded",
  () => {
    loadFixtures();
  }
);

/*
   Bazı tarayıcılarda script DOMContentLoaded'dan sonra
   çalışırsa yukarıdaki event kaçabilir. Bu nedenle ayrıca
   güvenli başlangıç.
*/
if (
  document.readyState ===
  "interactive" ||
  document.readyState === "complete"
) {
  loadFixtures();
}
