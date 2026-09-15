const API_BASE = "/api";

let fixtures = [];
let filteredFixtures = [];
let selectedFixture = null;
let favorites = JSON.parse(localStorage.getItem("ri_favorites") || "[]");

const state = {
  filter: "all",
  search: ""
};

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadFixtures();
});

/* =========================
   EVENTS
========================= */

function bindEvents() {
  const search = document.getElementById("searchInput");

  if (search) {
    search.addEventListener("input", e => {
      state.search = e.target.value.toLowerCase().trim();
      applyFilters();
    });
  }

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter || "all";

      document
        .querySelectorAll("[data-filter]")
        .forEach(btn => btn.classList.remove("active"));

      button.classList.add("active");

      applyFilters();
    });
  });
}

/* =========================
   LOAD FIXTURES
========================= */

async function loadFixtures() {
  const matches = document.getElementById("matches");

  if (matches) {
    matches.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Maçlar yükleniyor...</p>
      </div>
    `;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const response = await fetch(
      `${API_BASE}/fixtures?date=${today}`
    );

    if (!response.ok) {
      throw new Error("Maç verileri alınamadı.");
    }

    const data = await response.json();

    fixtures = Array.isArray(data.response)
      ? data.response
      : [];

    filteredFixtures = fixtures;

    updateMatchCount();
    applyFilters();

    setApiStatus(true);

  } catch (error) {
    console.error(error);

    if (matches) {
      matches.innerHTML = `
        <div class="empty-state">
          <h3>Maçlar yüklenemedi</h3>
          <p>${escapeHtml(error.message)}</p>
          <button onclick="loadFixtures()">Tekrar Dene</button>
        </div>
      `;
    }

    setApiStatus(false);
  }
}

/* =========================
   FILTERS
========================= */

function applyFilters() {
  let result = [...fixtures];

  if (state.search) {
    result = result.filter(match => {
      const home =
        match.teams?.home?.name?.toLowerCase() || "";

      const away =
        match.teams?.away?.name?.toLowerCase() || "";

      const league =
        match.league?.name?.toLowerCase() || "";

      return (
        home.includes(state.search) ||
        away.includes(state.search) ||
        league.includes(state.search)
      );
    });
  }

  if (state.filter === "favorites") {
    result = result.filter(match =>
      favorites.includes(String(match.fixture.id))
    );
  }

  /*
    Kategoriler için hızlı ön filtre.
    Detaylı analiz maç açıldığında yapılır.
  */

  if (state.filter === "score") {
    result = result.slice(0, 50);
  }

  if (
    state.filter === "first-half" ||
    state.filter === "second-half" ||
    state.filter === "iy2y"
  ) {
    result = result.slice(0, 50);
  }

  filteredFixtures = result;

  renderFixtures();
  updateMatchCount();
}

/* =========================
   RENDER MATCHES
========================= */

function renderFixtures() {
  const container = document.getElementById("matches");

  if (!container) return;

  if (!filteredFixtures.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Maç bulunamadı</h3>
        <p>Arama veya filtre kriterlerini değiştir.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredFixtures
    .map(createMatchCard)
    .join("");
}

/* =========================
   MATCH CARD
========================= */

function createMatchCard(match) {
  const id = match.fixture?.id;

  const home = match.teams?.home;
  const away = match.teams?.away;
  const league = match.league;

  const time = match.fixture?.date
    ? new Date(match.fixture.date).toLocaleTimeString(
        "tr-TR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )
    : "--:--";

  const live =
    ["1H", "2H", "HT", "ET", "P", "LIVE"].includes(
      match.fixture?.status?.short
    );

  const favorite = favorites.includes(String(id));

  return `
    <article class="match-card" onclick="openMatch(${id})">

      <div class="match-top">

        <div class="league-info">
          ${
            league?.logo
              ? `<img src="${league.logo}" alt="">`
              : ""
          }

          <span>
            ${escapeHtml(league?.name || "Lig")}
          </span>
        </div>

        <button
          class="favorite-btn ${favorite ? "active" : ""}"
          onclick="event.stopPropagation(); toggleFavorite(${id})"
        >
          ${favorite ? "♥" : "♡"}
        </button>

      </div>

      <div class="match-time ${live ? "live" : ""}">
        ${live ? "● CANLI" : time}
      </div>

      <div class="teams">

        <div class="team">
          ${
            home?.logo
              ? `<img src="${home.logo}" alt="">`
              : `<div class="team-placeholder">H</div>`
          }

          <strong>
            ${escapeHtml(home?.name || "Ev Sahibi")}
          </strong>
        </div>

        <div class="vs">VS</div>

        <div class="team">
          ${
            away?.logo
              ? `<img src="${away.logo}" alt="">`
              : `<div class="team-placeholder">A</div>`
          }

          <strong>
            ${escapeHtml(away?.name || "Deplasman")}
          </strong>
        </div>

      </div>

      <div class="prediction-preview">

        <span>🎯 Analiz için tıkla</span>

        <span>→</span>

      </div>

    </article>
  `;
}

/* =========================
   OPEN MATCH
========================= */

async function openMatch(fixtureId) {
  const drawer =
    document.getElementById("analysisDrawer");

  if (!drawer) return;

  selectedFixture = fixtures.find(
    f => Number(f.fixture?.id) === Number(fixtureId)
  );

  drawer.classList.add("open");
  document.body.classList.add("drawer-open");

  drawer.innerHTML = `
    <div class="analysis-loading">
      <div class="spinner"></div>
      <h3>R❤️İ analiz yapıyor...</h3>
      <p>
        Form, goller, H2H, istatistikler,
        kadro ve diğer veriler inceleniyor.
      </p>
    </div>
  `;

  try {
    const response = await fetch(
      `${API_BASE}/match?fixture=${fixtureId}`
    );

    if (!response.ok) {
      throw new Error("Maç analizi alınamadı.");
    }

    const data = await response.json();

    const analysis = calculateAnalysis(data);

    renderAnalysis(data, analysis);

  } catch (error) {
    console.error(error);

    drawer.innerHTML = `
      <button class="drawer-close" onclick="closeDrawer()">×</button>

      <div class="empty-state">
        <h3>Analiz alınamadı</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

/* =========================
   ANALYSIS ENGINE
========================= */

function calculateAnalysis(data) {
  const homeForm =
    data.analysis_data?.home_form || [];

  const awayForm =
    data.analysis_data?.away_form || [];

  const h2h =
    data.analysis_data?.h2h || [];

  const homeScores = extractScores(homeForm);
  const awayScores = extractScores(awayForm);

  const homeGF = average(
    homeScores.map(x => x.gf)
  );

  const homeGA = average(
    homeScores.map(x => x.ga)
  );

  const awayGF = average(
    awayScores.map(x => x.gf)
  );

  const awayGA = average(
    awayScores.map(x => x.ga)
  );

  const expectedHome =
    clamp(
      homeGF * 0.65 +
      awayGA * 0.35,
      0.1,
      4
    );

  const expectedAway =
    clamp(
      awayGF * 0.65 +
      homeGA * 0.35,
      0.1,
      4
    );

  const expectedTotal =
    expectedHome + expectedAway;

  const homeWin =
    probabilityHomeWin(
      expectedHome,
      expectedAway
    );

  const awayWin =
    probabilityAwayWin(
      expectedHome,
      expectedAway
    );

  const draw =
    clamp(
      100 - homeWin - awayWin,
      5,
      40
    );

  const btts =
    bttsProbability(
      expectedHome,
      expectedAway
    );

  const over15 =
    overProbability(expectedTotal, 1.5);

  const over25 =
    overProbability(expectedTotal, 2.5);

  const over35 =
    overProbability(expectedTotal, 3.5);

  const firstHalf =
    firstHalfPrediction(
      expectedHome,
      expectedAway
    );

  const secondHalf =
    secondHalfPrediction(
      expectedHome,
      expectedAway
    );

  const score =
    predictScore(
      expectedHome,
      expectedAway
    );

  const confidence =
    calculateConfidence({
      homeWin,
      awayWin,
      draw,
      btts,
      over25
    });

  return {
    expectedHome,
    expectedAway,
    expectedTotal,

    homeWin,
    awayWin,
    draw,

    btts,
    over15,
    over25,
    over35,

    firstHalf,
    secondHalf,

    score,

    goalRange: goalRange(expectedTotal),

    confidence,

    risk:
      confidence >= 75
        ? "Düşük"
        : confidence >= 60
        ? "Orta"
        : confidence >= 45
        ? "Yüksek"
        : "Çok Yüksek"
  };
}

/* =========================
   SCORE
========================= */

function predictScore(home, away) {
  return {
    home: clamp(Math.round(home), 0, 5),
    away: clamp(Math.round(away), 0, 5)
  };
}

/* =========================
   FIRST HALF
========================= */

function firstHalfPrediction(home, away) {
  const h = home * 0.43;
  const a = away * 0.43;

  const total = h + a;

  return {
    homeGoals: h,
    awayGoals: a,
    btts: bttsProbability(h, a),
    over05: overProbability(total, 0.5),
    over15: overProbability(total, 1.5),
    result:
      h > a
        ? "1"
        : a > h
        ? "2"
        : "X",
    score:
      `${Math.round(h)}-${Math.round(a)}`
  };
}

/* =========================
   SECOND HALF
========================= */

function secondHalfPrediction(home, away) {
  const h = home * 0.57;
  const a = away * 0.57;

  const total = h + a;

  return {
    homeGoals: h,
    awayGoals: a,
    btts: bttsProbability(h, a),
    over05: overProbability(total, 0.5),
    over15: overProbability(total, 1.5),
    result:
      h > a
        ? "1"
        : a > h
        ? "2"
        : "X",
    score:
      `${Math.round(h)}-${Math.round(a)}`
  };
}

/* =========================
   RENDER ANALYSIS
========================= */

function renderAnalysis(data, a) {
  const drawer =
    document.getElementById("analysisDrawer");

  const home =
    data.teams?.home?.name || "Ev Sahibi";

  const away =
    data.teams?.away?.name || "Deplasman";

  const league =
    data.league?.name || "";

  const strongest =
    strongestSelection(a);

  drawer.innerHTML = `

    <button
      class="drawer-close"
      onclick="closeDrawer()"
    >
      ×
    </button>

    <div class="analysis-header">

      <small>${escapeHtml(league)}</small>

      <h2>
        ${escapeHtml(home)}
        <span>vs</span>
        ${escapeHtml(away)}
      </h2>

      <div class="analysis-meta">
        R❤️İ Football Analizi
      </div>

    </div>

    <section class="strongest-selection">

      <span>R❤️İ EN GÜÇLÜ SEÇİM</span>

      <h2>
        ${escapeHtml(strongest.name)}
      </h2>

      <div class="confidence">
        <div class="confidence-label">
          Model Güveni
          <strong>${Math.round(strongest.confidence)}%</strong>
        </div>

        <div class="confidence-bar">
          <div style="width:${strongest.confidence}%"></div>
        </div>
      </div>

      <div class="risk">
        Risk: <strong>${a.risk}</strong>
      </div>

    </section>

    <section class="analysis-section">

      <h3>🎯 Tahmini Skor</h3>

      <div class="score-box">
        <strong>
          ${a.score.home} - ${a.score.away}
        </strong>
      </div>

      <div class="market-grid">

        ${market(
          "Maç Sonucu",
          `${Math.round(a.homeWin)}% 1`
        )}

        ${market(
          "Beraberlik",
          `${Math.round(a.draw)}% X`
        )}

        ${market(
          "Deplasman",
          `${Math.round(a.awayWin)}% 2`
        )}

        ${market(
          "KG",
          `${Math.round(a.btts)}% Var`
        )}

        ${market(
          "1.5 Üst",
          `${Math.round(a.over15)}%`
        )}

        ${market(
          "2.5 Üst",
          `${Math.round(a.over25)}%`
        )}

        ${market(
          "3.5 Üst",
          `${Math.round(a.over35)}%`
        )}

        ${market(
          "Gol Aralığı",
          a.goalRange
        )}

      </div>

    </section>

    <section class="analysis-section">

      <h3>⚡ İlk Yarı</h3>

      <div class="market-grid">

        ${market(
          "İY Sonucu",
          a.firstHalf.result
        )}

        ${market(
          "İY Skor",
          a.firstHalf.score
        )}

        ${market(
          "İY KG",
          `${Math.round(a.firstHalf.btts)}%`
        )}

        ${market(
          "İY 0.5 Üst",
          `${Math.round(a.firstHalf.over05)}%`
        )}

        ${market(
          "İY 1.5 Üst",
          `${Math.round(a.firstHalf.over15)}%`
        )}

      </div>

    </section>

    <section class="analysis-section">

      <h3>🔥 İkinci Yarı</h3>

      <div class="market-grid">

        ${market(
          "2Y Sonucu",
          a.secondHalf.result
        )}

        ${market(
          "2Y Skor",
          a.secondHalf.score
        )}

        ${market(
          "2Y KG",
          `${Math.round(a.secondHalf.btts)}%`
        )}

        ${market(
          "2Y 0.5 Üst",
          `${Math.round(a.secondHalf.over05)}%`
        )}

        ${market(
          "2Y 1.5 Üst",
          `${Math.round(a.secondHalf.over15)}%`
        )}

      </div>

    </section>

    <section class="analysis-section">

      <h3>⚽ Beklenen Goller</h3>

      <div class="expected-goals">

        <div>
          <span>${escapeHtml(home)}</span>
          <strong>
            ${a.expectedHome.toFixed(2)}
          </strong>
        </div>

        <div>
          <span>${escapeHtml(away)}</span>
          <strong>
            ${a.expectedAway.toFixed(2)}
          </strong>
        </div>

        <div>
          <span>Toplam</span>
          <strong>
            ${a.expectedTotal.toFixed(2)}
          </strong>
        </div>

      </div>

    </section>

    <section class="analysis-section">

      <h3>📊 Model Özeti</h3>

      <p class="analysis-text">
        Model; son maç formu, gol üretimi,
        gol yeme eğilimi ve mevcut maç verilerini
        birlikte değerlendirerek olasılık üretir.
        Yüzdeler kesin sonuç değil, model tahminidir.
      </p>

    </section>

  `;
}

/* =========================
   STRONGEST PICK
========================= */

function strongestSelection(a) {
  const markets = [
    {
      name: "1.5 Üst",
      confidence: a.over15
    },
    {
      name: "2.5 Üst",
      confidence: a.over25
    },
    {
      name: "KG Var",
      confidence: a.btts
    },
    {
      name: "Ev Sahibi Kazanır",
      confidence: a.homeWin
    },
    {
      name: "Deplasman Kazanır",
      confidence: a.awayWin
    }
  ];

  return markets.reduce(
    (best, current) =>
      current.confidence > best.confidence
        ? current
        : best
  );
}

/* =========================
   HELPERS
========================= */

function extractScores(form) {
  if (!Array.isArray(form)) return [];

  return form
    .map(match => {
      const goals = match.goals || {};

      return {
        gf:
          Number(goals.for) ||
          Number(goals.scored) ||
          0,

        ga:
          Number(goals.against) ||
          Number(goals.conceded) ||
          0
      };
    });
}

function average(values) {
  if (!values.length) return 1.2;

  return (
    values.reduce((a, b) => a + b, 0) /
    values.length
  );
}

function probabilityHomeWin(home, away) {
  const base =
    50 +
    (home - away) * 17;

  return clamp(base, 10, 85);
}

function probabilityAwayWin(home, away) {
  const base =
    50 +
    (away - home) * 17;

  return clamp(base, 10, 85);
}

function bttsProbability(home, away) {
  const probability =
    (1 - Math.exp(-home)) *
    (1 - Math.exp(-away)) *
    100;

  return clamp(probability, 5, 95);
}

function overProbability(total, line) {
  const probability =
    1 -
    Math.exp(
      -Math.max(total - line + 0.5, 0.05)
    );

  return clamp(probability * 100, 5, 95);
}

function goalRange(total) {
  if (total < 1.5) return "0-1";
  if (total < 2.5) return "1-2";
  if (total < 3.5) return "2-3";
  if (total < 4.5) return "3-4";

  return "4+";
}

function calculateConfidence(values) {
  const list = [
    values.homeWin,
    values.awayWin,
    values.draw,
    values.btts,
    values.over25
  ];

  const strongest =
    Math.max(...list);

  return clamp(
    strongest,
    40,
    92
  );
}

function market(title, value) {
  return `
    <div class="market-card">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(Number(value) || 0, min),
    max
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   FAVORITES
========================= */

function toggleFavorite(id) {
  id = String(id);

  if (favorites.includes(id)) {
    favorites = favorites.filter(x => x !== id);
  } else {
    favorites.push(id);
  }

  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(favorites)
  );

  applyFilters();
}

/* =========================
   DRAWER
========================= */

function closeDrawer() {
  const drawer =
    document.getElementById("analysisDrawer");

  if (drawer) {
    drawer.classList.remove("open");
  }

  document.body.classList.remove("drawer-open");
}

/* =========================
   STATUS
========================= */

function setApiStatus(online) {
  const status =
    document.getElementById("apiStatus");

  if (!status) return;

  status.textContent =
    online
      ? "● API ONLINE"
      : "● API HATA";

  status.classList.toggle(
    "offline",
    !online
  );
}

function updateMatchCount() {
  const count =
    document.getElementById("matchCount");

  if (count) {
    count.textContent =
      filteredFixtures.length;
  }
}

/* =========================
   GLOBALS
========================= */

window.openMatch = openMatch;
window.closeDrawer = closeDrawer;
window.toggleFavorite = toggleFavorite;
window.loadFixtures = loadFixtures;
window.applyFilters = applyFilters;
