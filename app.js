// ======================================================
// R❤️İ FOOTBALL — APP.JS
// Futbol Analiz Merkezi
// ======================================================

const API_BASE = "/api";

const state = {
  fixtures: [],
  filteredFixtures: [],
  selectedFixture: null,
  selectedAnalysis: null,
  favorites: JSON.parse(localStorage.getItem("ri_favorites") || "[]"),
  filter: "all",
  search: ""
};

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&quot;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  return `${Math.round(num(value))}%`;
}

function saveFavorites() {
  localStorage.setItem("ri_favorites", JSON.stringify(state.favorites));
}

function isFavorite(id) {
  return state.favorites.includes(String(id));
}

function toggleFavorite(id) {
  id = String(id);

  if (isFavorite(id)) {
    state.favorites = state.favorites.filter(x => x !== id);
  } else {
    state.favorites.push(id);
  }

  saveFavorites();
  renderFixtures();
}

async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );
  }

  return data;
}

// ------------------------------------------------------
// FIXTURES
// ------------------------------------------------------

async function loadFixtures() {
  showLoading();

  try {
    const today = new Date().toISOString().slice(0, 10);

    const data = await getJSON(
      `${API_BASE}/fixtures?date=${today}`
    );

    state.fixtures = Array.isArray(data?.response)
      ? data.response
      : [];

    applyFilters();

  } catch (error) {
    console.error(error);

    showError(
      `Maçlar yüklenemedi: ${esc(error.message)}`
    );
  }
}

// ------------------------------------------------------
// FILTER
// ------------------------------------------------------

function applyFilters() {
  let list = [...state.fixtures];

  const search = state.search.trim().toLowerCase();

  if (search) {
    list = list.filter(match => {
      const home =
        match?.teams?.home?.name?.toLowerCase() || "";

      const away =
        match?.teams?.away?.name?.toLowerCase() || "";

      const league =
        match?.league?.name?.toLowerCase() || "";

      return (
        home.includes(search) ||
        away.includes(search) ||
        league.includes(search)
      );
    });
  }

  if (state.filter === "favorites") {
    list = list.filter(match =>
      isFavorite(match?.fixture?.id)
    );
  }

  state.filteredFixtures = list;

  renderFixtures();
}

// ------------------------------------------------------
// FIXTURE CARD
// ------------------------------------------------------

function renderFixtures() {
  const container =
    $("#matches") ||
    $("#fixtures") ||
    $(".matches") ||
    $(".fixture-list");

  if (!container) return;

  if (!state.filteredFixtures.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Maç bulunamadı</h3>
        <p>Arama veya filtreyi değiştirmeyi dene.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.filteredFixtures
    .map(createMatchCard)
    .join("");
}

function createMatchCard(match) {
  const fixtureId = match?.fixture?.id;

  const home = match?.teams?.home || {};
  const away = match?.teams?.away || {};
  const league = match?.league || {};

  const date = match?.fixture?.date
    ? new Date(match.fixture.date)
    : null;

  const time = date
    ? date.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "--:--";

  const favorite = isFavorite(fixtureId);

  const status =
    match?.fixture?.status?.short || "";

  const liveStatuses = [
    "1H",
    "2H",
    "ET",
    "P",
    "LIVE"
  ];

  const live = liveStatuses.includes(status);

  return `
    <article
      class="match-card"
      data-fixture="${esc(fixtureId)}"
      onclick="openMatch(${Number(fixtureId)})"
    >

      <div class="match-top">

        <div class="league-info">
          ${
            league.logo
              ? `<img src="${esc(league.logo)}"
                      class="league-logo"
                      alt="">`
              : ""
          }

          <span>
            ${esc(league.name || "Lig")}
          </span>
        </div>

        <button
          class="favorite-btn ${favorite ? "active" : ""}"
          onclick="event.stopPropagation(); toggleFavorite(${Number(fixtureId)})"
        >
          ${favorite ? "★" : "☆"}
        </button>

      </div>

      <div class="match-time ${live ? "live" : ""}">
        ${live ? "🔴 CANLI" : esc(time)}
      </div>

      <div class="teams">

        <div class="team">
          ${
            home.logo
              ? `<img src="${esc(home.logo)}"
                      class="team-logo"
                      alt="">`
              : `<div class="team-logo placeholder">⚽</div>`
          }

          <strong>${esc(home.name || "Ev Sahibi")}</strong>
        </div>

        <div class="vs">
          <span>VS</span>
        </div>

        <div class="team">
          ${
            away.logo
              ? `<img src="${esc(away.logo)}"
                      class="team-logo"
                      alt="">`
              : `<div class="team-logo placeholder">⚽</div>`
          }

          <strong>${esc(away.name || "Deplasman")}</strong>
        </div>

      </div>

      <div class="match-footer">

        <span class="market-chip">🤖 AI Analiz</span>
        <span class="market-chip">📊 Form</span>
        <span class="market-chip">⚽ KG</span>
        <span class="market-chip">🎯 Skor</span>

      </div>

    </article>
  `;
}

// ------------------------------------------------------
// OPEN MATCH
// ------------------------------------------------------

async function openMatch(fixtureId) {
  if (!fixtureId) return;

  state.selectedFixture = fixtureId;

  openDrawer();

  setDrawerLoading();

  try {
    const data = await getJSON(
      `${API_BASE}/match?fixture=${encodeURIComponent(fixtureId)}`
    );

    state.selectedAnalysis = data;

    renderAnalysis(data);

  } catch (error) {
    console.error(error);

    setDrawerError(
      `Analiz alınamadı: ${esc(error.message)}`
    );
  }
}

// ------------------------------------------------------
// ANALYSIS
// ------------------------------------------------------

function renderAnalysis(data) {
  const fixture = data?.fixture || {};
  const teams = data?.teams || {};

  const home = teams?.home || {};
  const away = teams?.away || {};

  const analysisData =
    data?.analysis_data || {};

  const homeForm =
    getFormSummary(
      analysisData?.home_form,
      home.id
    );

  const awayForm =
    getFormSummary(
      analysisData?.away_form,
      away.id
    );

  const analysis = calculateAnalysis(
    homeForm,
    awayForm,
    data
  );

  state.selectedAnalysis = {
    ...data,
    calculated_analysis: analysis
  };

  const drawer =
    $("#analysisDrawer") ||
    $("#drawer") ||
    $(".analysis-drawer");

  if (!drawer) return;

  drawer.innerHTML = `
    <div class="analysis-header">

      <button
        class="close-btn"
        onclick="closeDrawer()"
      >
        ×
      </button>

      <div class="analysis-league">
        ${esc(data?.league?.name || "")}
      </div>

      <div class="analysis-teams">

        <div>
          ${
            home.logo
              ? `<img src="${esc(home.logo)}"
                      class="analysis-team-logo"
                      alt="">`
              : ""
          }

          <strong>${esc(home.name || "")}</strong>
        </div>

        <span>VS</span>

        <div>
          ${
            away.logo
              ? `<img src="${esc(away.logo)}"
                      class="analysis-team-logo"
                      alt="">`
              : ""
          }

          <strong>${esc(away.name || "")}</strong>
        </div>

      </div>

    </div>

    <div class="analysis-body">

      <section class="strongest-selection">

        <div class="section-label">
          EN GÜÇLÜ SEÇİM
        </div>

        <div class="strongest-pick">
          ${esc(analysis.strongestPick)}
        </div>

        <div class="confidence">
          <div class="confidence-label">
            Model Güveni
            <strong>${pct(analysis.confidence)}</strong>
          </div>

          <div class="confidence-bar">
            <span style="width:${analysis.confidence}%"></span>
          </div>
        </div>

        <div class="risk-badge">
          Risk: ${esc(analysis.risk)}
        </div>

      </section>

      <section class="analysis-section">

        <h3>🎯 Maç Sonucu</h3>

        ${predictionRow(
          "MS 1",
          analysis.result.home,
          home.name
        )}

        ${predictionRow(
          "X",
          analysis.result.draw,
          "Beraberlik"
        )}

        ${predictionRow(
          "MS 2",
          analysis.result.away,
          away.name
        )}

      </section>

      <section class="analysis-section">

        <h3>⚽ Gol Piyasaları</h3>

        ${predictionRow(
          "KG Var",
          analysis.btts.yes
        )}

        ${predictionRow(
          "KG Yok",
          analysis.btts.no
        )}

        ${predictionRow(
          "2.5 Üst",
          analysis.over25.over
        )}

        ${predictionRow(
          "2.5 Alt",
          analysis.over25.under
        )}

        ${predictionRow(
          "1.5 Üst",
          analysis.over15
        )}

        ${predictionRow(
          "3.5 Üst",
          analysis.over35
        )}

      </section>

      <section class="analysis-section">

        <h3>⏱️ Devre Analizi</h3>

        ${predictionRow(
          "İY KG",
          analysis.firstHalfBTTS
        )}

        ${predictionRow(
          "2Y KG",
          analysis.secondHalfBTTS
        )}

        ${predictionRow(
          "İY 1",
          analysis.firstHalfHome
        )}

        ${predictionRow(
          "İY X",
          analysis.firstHalfDraw
        )}

        ${predictionRow(
          "İY 2",
          analysis.firstHalfAway
        )}

      </section>

      <section class="score-box">

        <h3>🎯 Tahmini Skor</h3>

        <div class="predicted-score">
          ${analysis.score.home}
          -
          ${analysis.score.away}
        </div>

        <div class="goal-range">
          Beklenen gol: ${analysis.expectedGoals}
          <br>
          Gol aralığı: ${esc(analysis.goalRange)}
        </div>

      </section>

      <section class="analysis-section">

        <h3>📈 Son Form</h3>

        <div class="form-grid">

          ${formBox(
            home.name,
            homeForm
          )}

          ${formBox(
            away.name,
            awayForm
          )}

        </div>

      </section>

      <section class="analysis-section">

        <h3>🧠 R❤️İ Model Yorumu</h3>

        <p class="ai-comment">
          ${esc(
            generateCommentary(
              home,
              away,
              analysis,
              homeForm,
              awayForm
            )
          )}
        </p>

      </section>

    </div>
  `;

  drawer.classList.add("open");
}

// ------------------------------------------------------
// FORM
// ------------------------------------------------------

function getFormSummary(teamData, teamId) {
  const matches =
    teamData?.last10 ||
    teamData ||
    [];

  if (!Array.isArray(matches)) {
    return emptyForm();
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {
    const hId = match?.teams?.home?.id;
    const aId = match?.teams?.away?.id;

    const hg = num(match?.goals?.home);
    const ag = num(match?.goals?.away);

    if (hId === teamId) {
      goalsFor += hg;
      goalsAgainst += ag;

      if (hg > ag) wins++;
      else if (hg === ag) draws++;
      else losses++;
    }

    if (aId === teamId) {
      goalsFor += ag;
      goalsAgainst += hg;

      if (ag > hg) wins++;
      else if (ag === hg) draws++;
      else losses++;
    }
  }

  const played =
    wins + draws + losses;

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    avgGoalsFor:
      played ? goalsFor / played : 0,
    avgGoalsAgainst:
      played ? goalsAgainst / played : 0,
    points:
      wins * 3 + draws,
    ppg:
      played
        ? (wins * 3 + draws) / played
        : 0
  };
}

function emptyForm() {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    avgGoalsFor: 0,
    avgGoalsAgainst: 0,
    points: 0,
    ppg: 0
  };
}

// ------------------------------------------------------
// ANALYSIS ENGINE
// ------------------------------------------------------

function calculateAnalysis(home, away, rawData) {
  let homeWin =
    50 +
    (home.ppg - away.ppg) * 13 +
    (home.avgGoalsFor - away.avgGoalsFor) * 8 +
    (away.avgGoalsAgainst - home.avgGoalsAgainst) * 5;

  let awayWin =
    50 +
    (away.ppg - home.ppg) * 13 +
    (away.avgGoalsFor - home.avgGoalsFor) * 8 +
    (home.avgGoalsAgainst - away.avgGoalsAgainst) * 5;

  let draw =
    42 -
    Math.abs(home.ppg - away.ppg) * 9 -
    Math.abs(
      home.avgGoalsFor -
      away.avgGoalsFor
    ) * 5;

  homeWin = clamp(homeWin);
  awayWin = clamp(awayWin);
  draw = clamp(draw);

  const total =
    homeWin + draw + awayWin;

  const result = {
    home: Math.round(
      homeWin / total * 100
    ),
    draw: Math.round(
      draw / total * 100
    ),
    away: Math.round(
      awayWin / total * 100
    )
  };

  const expectedHome =
    (
      home.avgGoalsFor +
      away.avgGoalsAgainst
    ) / 2;

  const expectedAway =
    (
      away.avgGoalsFor +
      home.avgGoalsAgainst
    ) / 2;

  const expectedGoals =
    expectedHome + expectedAway;

  const bttsBase =
    50 +
    (
      home.avgGoalsFor +
      away.avgGoalsFor +
      home.avgGoalsAgainst +
      away.avgGoalsAgainst
    ) * 9;

  const btts =
    clamp(bttsBase);

  const over25 =
    clamp(
      expectedGoals / 3.2 * 100
    );

  const over15 =
    clamp(
      expectedGoals / 2.0 * 100
    );

  const over35 =
    clamp(
      expectedGoals / 4.2 * 100
    );

  const firstHalfBTTS =
    clamp(btts * 0.78);

  const secondHalfBTTS =
    clamp(btts * 0.91);

  const firstHalfHome =
    clamp(result.home * 0.72);

  const firstHalfDraw =
    clamp(result.draw * 1.12);

  const firstHalfAway =
    clamp(result.away * 0.72);

  const strongestCandidates = [
    ["MS 1", result.home],
    ["KG Var", btts],
    ["2.5 Üst", over25],
    ["MS 2", result.away],
    ["İY KG", firstHalfBTTS],
    ["2Y KG", secondHalfBTTS]
  ];

  strongestCandidates.sort(
    (a, b) => b[1] - a[1]
  );

  const strongestPick =
    strongestCandidates[0][0];

  const confidence =
    clamp(
      strongestCandidates[0][1]
    );

  let risk = "Yüksek";

  if (confidence >= 75) {
    risk = "Düşük";
  } else if (confidence >= 60) {
    risk = "Orta";
  }

  return {
    result,

    btts: {
      yes: Math.round(btts),
      no: Math.round(100 - btts)
    },

    over15: Math.round(over15),

    over25: {
      over: Math.round(over25),
      under: Math.round(100 - over25)
    },

    over35: Math.round(over35),

    firstHalfBTTS:
      Math.round(firstHalfBTTS),

    secondHalfBTTS:
      Math.round(secondHalfBTTS),

    firstHalfHome:
      Math.round(firstHalfHome),

    firstHalfDraw:
      Math.round(firstHalfDraw),

    firstHalfAway:
      Math.round(firstHalfAway),

    score: {
      home: Math.max(
        0,
        Math.round(expectedHome)
      ),
      away: Math.max(
        0,
        Math.round(expectedAway)
      )
    },

    expectedGoals:
      Number(expectedGoals.toFixed(2)),

    goalRange:
      getGoalRange(expectedGoals),

    strongestPick,

    confidence:
      Math.round(confidence),

    risk
  };
}

function clamp(value, min = 5, max = 95) {
  return Math.max(
    min,
    Math.min(max, Number(value) || 0)
  );
}

function getGoalRange(goals) {
  if (goals < 1.5) return "0-1";
  if (goals < 2.5) return "1-2";
  if (goals < 3.5) return "2-3";
  if (goals < 4.5) return "3-4";
  return "4+";
}

// ------------------------------------------------------
// UI HELPERS
// ------------------------------------------------------

function predictionRow(label, value, sub = "") {
  return `
    <div class="prediction-row">

      <div>
        <strong>${esc(label)}</strong>
        ${
          sub
            ? `<small>${esc(sub)}</small>`
            : ""
        }
      </div>

      <span>${pct(value)}</span>

    </div>
  `;
}

function formBox(name, form) {
  return `
    <div class="form-box">

      <strong>${esc(name || "Takım")}</strong>

      <div class="form-stats">
        <span>O ${form.played}</span>
        <span>G ${form.wins}</span>
        <span>B ${form.draws}</span>
        <span>M ${form.losses}</span>
      </div>

      <div class="form-goals">
        ⚽ ${form.goalsFor}
        -
        ${form.goalsAgainst}
      </div>

      <small>
        Maç başı:
        ${form.avgGoalsFor.toFixed(2)}
        gol
      </small>

    </div>
  `;
}

function generateCommentary(
  home,
  away,
  analysis,
  homeForm,
  awayForm
) {
  const parts = [];

  if (homeForm.ppg > awayForm.ppg) {
    parts.push(
      `${home.name} son form ve puan üretimi açısından önde.`
    );
  } else if (awayForm.ppg > homeForm.ppg) {
    parts.push(
      `${away.name} son form ve puan üretimi açısından önde.`
    );
  } else {
    parts.push(
      "İki takımın form göstergeleri birbirine yakın."
    );
  }

  if (analysis.btts.yes >= 60) {
    parts.push(
      "Gol üretimi verileri KG Var ihtimalini destekliyor."
    );
  }

  if (analysis.over25.over >= 60) {
    parts.push(
      "Toplam gol modeli 2.5 Üst tarafında yoğunlaşıyor."
    );
  }

  parts.push(
    `Modelin öne çıkardığı seçim ${analysis.strongestPick}.`
  );

  parts.push(
    `Model güveni %${analysis.confidence}; bu oran kesinlik değil, mevcut verilerden hesaplanan model güvenidir.`
  );

  return parts.join(" ");
}

// ------------------------------------------------------
// DRAWER
// ------------------------------------------------------

function openDrawer() {
  const drawer =
    $("#analysisDrawer") ||
    $("#drawer") ||
    $(".analysis-drawer");

  if (!drawer) return;

  drawer.classList.add("open");

  document.body.classList.add(
    "drawer-open"
  );
}

function closeDrawer() {
  const drawer =
    $("#analysisDrawer") ||
    $("#drawer") ||
    $(".analysis-drawer");

  if (!drawer) return;

  drawer.classList.remove("open");

  document.body.classList.remove(
    "drawer-open"
  );
}

function setDrawerLoading() {
  const drawer =
    $("#analysisDrawer") ||
    $("#drawer") ||
    $(".analysis-drawer");

  if (!drawer) return;

  drawer.innerHTML = `
    <div class="analysis-loading">

      <div class="loader"></div>

      <h3>Maç analiz ediliyor...</h3>

      <p>
        Form, H2H, istatistik, kadro,
        sakatlık ve oran verileri hazırlanıyor.
      </p>

    </div>
  `;
}

function setDrawerError(message) {
  const drawer =
    $("#analysisDrawer") ||
    $("#drawer") ||
    $(".analysis-drawer");

  if (!drawer) return;

  drawer.innerHTML = `
    <div class="analysis-error">

      <button
        class="close-btn"
        onclick="closeDrawer()"
      >
        ×
      </button>

      <div class="error-icon">⚠️</div>

      <h3>Analiz alınamadı</h3>

      <p>${message}</p>

    </div>
  `;
}

function showLoading() {
  const container =
    $("#matches") ||
    $("#fixtures") ||
    $(".matches") ||
    $(".fixture-list");

  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="loader"></div>
      <p>Bugünün maçları yükleniyor...</p>
    </div>
  `;
}

function showError(message) {
  const container =
    $("#matches") ||
    $("#fixtures") ||
    $(".matches") ||
    $(".fixture-list");

  if (!container) return;

  container.innerHTML = `
    <div class="error-state">
      <div>⚠️</div>
      <p>${message}</p>

      <button onclick="loadFixtures()">
        Tekrar Dene
      </button>
    </div>
  `;
}

// ------------------------------------------------------
// SEARCH
// ------------------------------------------------------

function setupSearch() {
  const inputs = document.querySelectorAll(
    'input[type="search"], .search-input, #searchInput'
  );

  inputs.forEach(input => {
    input.addEventListener(
      "input",
      event => {
        state.search =
          event.target.value || "";

        applyFilters();
      }
    );
  });
}

// ------------------------------------------------------
// NAVIGATION
// ------------------------------------------------------

function setupNavigation() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-filter]"
        );

      if (!button) return;

      event.preventDefault();

      state.filter =
        button.dataset.filter || "all";

      document
        .querySelectorAll(
          "[data-filter]"
        )
        .forEach(item => {
          item.classList.remove("active");
        });

      button.classList.add("active");

      applyFilters();
    }
  );
}

// ------------------------------------------------------
// ESC / OUTSIDE CLICK
// ------------------------------------------------------

function setupDrawerEvents() {
  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    }
  );

  document.addEventListener(
    "click",
    event => {
      const drawer =
        $("#analysisDrawer") ||
        $("#drawer");

      if (!drawer) return;

      if (
        drawer.classList.contains("open") &&
        event.target === drawer
      ) {
        closeDrawer();
      }
    }
  );
}

// ------------------------------------------------------
// INIT
// ------------------------------------------------------

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupSearch();
    setupNavigation();
    setupDrawerEvents();

    loadFixtures();

  }
);

// ------------------------------------------------------
// GLOBALS
// ------------------------------------------------------

window.openMatch = openMatch;
window.closeDrawer = closeDrawer;
window.toggleFavorite = toggleFavorite;
window.loadFixtures = loadFixtures;
window.applyFilters = applyFilters;
