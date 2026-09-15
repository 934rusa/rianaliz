// ============================================================
// R❤️İ FOOTBALL — FINAL FRONTEND ENGINE
// ============================================================

const API_BASE = "/api";

let fixtures = [];
let filteredFixtures = [];
let selectedFixture = null;
let currentFilter = "all";
let currentSearch = "";

let favorites =
  JSON.parse(localStorage.getItem("ri_favorites") || "[]");

// ============================================================
// DOM
// ============================================================

const matchesContainer =
  document.getElementById("matchesContainer");

const drawer =
  document.getElementById("analysisDrawer");

const overlay =
  document.getElementById("overlay");

const searchInput =
  document.getElementById("searchInput");

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  setupMenu();

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      e => {
        currentSearch =
          e.target.value.toLowerCase().trim();

        applyFilters();
      }
    );
  }

  loadFixtures();
});

// ============================================================
// MENU
// ============================================================

function setupMenu() {

  document.querySelectorAll("[data-filter]")
    .forEach(button => {

      button.addEventListener("click", () => {

        document
          .querySelectorAll("[data-filter]")
          .forEach(x =>
            x.classList.remove("active")
          );

        button.classList.add("active");

        currentFilter =
          button.dataset.filter;

        applyFilters();
      });
    });
}

// ============================================================
// FIXTURES
// ============================================================

async function loadFixtures() {

  setApiStatus("Maçlar yükleniyor...");

  try {

    const today =
      new Date().toISOString().slice(0, 10);

    const response =
      await fetch(
        `${API_BASE}/fixtures?date=${today}`
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!data.response) {
      throw new Error(
        data.error || "Maç verisi bulunamadı."
      );
    }

    fixtures =
      data.response;

    applyFilters();

    setApiStatus(
      `${fixtures.length} maç yüklendi`
    );

  } catch (error) {

    console.error(
      "R❤️İ FIXTURE ERROR:",
      error
    );

    setApiStatus(
      "API bağlantı hatası"
    );

    if (matchesContainer) {
      matchesContainer.innerHTML = `
        <div class="empty-state">
          <h3>Maçlar alınamadı</h3>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }
}

// ============================================================
// FILTER
// ============================================================

function applyFilters() {

  let result =
    [...fixtures];

  // -------------------------
  // SEARCH
  // -------------------------

  if (currentSearch) {

    result =
      result.filter(match => {

        const home =
          match.teams?.home?.name
            ?.toLowerCase() || "";

        const away =
          match.teams?.away?.name
            ?.toLowerCase() || "";

        const league =
          match.league?.name
            ?.toLowerCase() || "";

        return (
          home.includes(currentSearch) ||
          away.includes(currentSearch) ||
          league.includes(currentSearch)
        );
      });
  }

  // -------------------------
  // FAVORITES
  // -------------------------

  if (currentFilter === "favorites") {

    result =
      result.filter(match =>
        favorites.includes(
          Number(match.fixture?.id)
        )
      );
  }

  /*
    Detaylı market filtreleri şu anda
    fixture listesine körlemesine uygulanmıyor.

    Çünkü bunları belirlemek için maç başına
    detaylı API verisi gerekir.

    Böylece 248 maça birden API çağrısı
    yapıp kotayı tüketmiyoruz.
  */

  filteredFixtures =
    result;

  renderFixtures();
}

// ============================================================
// RENDER FIXTURES
// ============================================================

function renderFixtures() {

  if (!matchesContainer) return;

  if (!filteredFixtures.length) {

    matchesContainer.innerHTML = `
      <div class="empty-state">
        <h3>Maç bulunamadı</h3>
        <p>Bu filtre için gösterilecek maç yok.</p>
      </div>
    `;

    updateMatchCount(0);

    return;
  }

  matchesContainer.innerHTML =
    filteredFixtures
      .map(createMatchCard)
      .join("");

  updateMatchCount(
    filteredFixtures.length
  );
}

// ============================================================
// MATCH CARD
// ============================================================

function createMatchCard(match) {

  const fixtureId =
    Number(match.fixture?.id);

  const home =
    match.teams?.home || {};

  const away =
    match.teams?.away || {};

  const league =
    match.league || {};

  const status =
    match.fixture?.status || {};

  const timestamp =
    match.fixture?.timestamp;

  let time = "--:--";

  if (timestamp) {

    time =
      new Date(
        timestamp * 1000
      ).toLocaleTimeString(
        "tr-TR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
  }

  const isLive =
    status.short &&
    [
      "1H",
      "2H",
      "HT",
      "ET",
      "P",
      "LIVE"
    ].includes(status.short);

  const favorite =
    favorites.includes(fixtureId);

  return `
    <article
      class="match-card"
      onclick="openMatch(${fixtureId})"
    >

      <div class="match-league">

        ${
          league.logo
            ? `
              <img
                src="${escapeAttribute(league.logo)}"
                alt=""
                class="league-logo"
              >
            `
            : ""
        }

        <span>
          ${escapeHtml(league.name || "Lig")}
        </span>

        <button
          class="favorite-btn ${favorite ? "active" : ""}"
          onclick="event.stopPropagation(); toggleFavorite(${fixtureId})"
        >
          ${favorite ? "♥" : "♡"}
        </button>

      </div>

      <div class="match-main">

        <div class="team">

          ${
            home.logo
              ? `
                <img
                  src="${escapeAttribute(home.logo)}"
                  alt=""
                  class="team-logo"
                >
              `
              : `<div class="team-logo-placeholder">⚽</div>`
          }

          <strong>
            ${escapeHtml(home.name || "Ev Sahibi")}
          </strong>

        </div>

        <div class="match-time">

          ${
            isLive
              ? `<span class="live-badge">CANLI</span>`
              : `<span>${time}</span>`
          }

          <small>
            ${escapeHtml(
              status.long || "Başlamadı"
            )}
          </small>

        </div>

        <div class="team">

          ${
            away.logo
              ? `
                <img
                  src="${escapeAttribute(away.logo)}"
                  alt=""
                  class="team-logo"
                >
              `
              : `<div class="team-logo-placeholder">⚽</div>`
          }

          <strong>
            ${escapeHtml(away.name || "Deplasman")}
          </strong>

        </div>

      </div>

      <div class="match-footer">
        <span>Detaylı Analiz</span>
        <span>›</span>
      </div>

    </article>
  `;
}

// ============================================================
// OPEN MATCH
// ============================================================

async function openMatch(fixtureId) {

  selectedFixture =
    fixtureId;

  openDrawer();

  setDrawerLoading();

  try {

    const response =
      await fetch(
        `${API_BASE}/match?fixture=${fixtureId}`
      );

    const data =
      await response.json();

    if (!response.ok || !data.success) {

      throw new Error(
        data.error ||
        data.message ||
        "Maç analiz verileri alınamadı."
      );
    }

    /*
      analysis.js Vercel serverless değildir.
      Bu nedenle burada frontend analiz motorunu
      kullanıyoruz.
    */

    const analysis =
      calculateAnalysis(data);

    renderAnalysis(
      data,
      analysis
    );

  } catch (error) {

    console.error(
      "R❤️İ ANALYSIS ERROR:",
      error
    );

    if (drawer) {

      drawer.innerHTML = `
        <button
          class="drawer-close"
          onclick="closeDrawer()"
        >
          ×
        </button>

        <div class="analysis-error">

          <div class="error-icon">⚠️</div>

          <h2>Analiz alınamadı</h2>

          <p>
            ${escapeHtml(
              error.message
            )}
          </p>

          <button
            class="primary-btn"
            onclick="openMatch(${fixtureId})"
          >
            Tekrar Dene
          </button>

        </div>
      `;
    }
  }
}

// ============================================================
// FRONTEND ANALYSIS ENGINE
// ============================================================

function calculateAnalysis(data) {

  const homeId =
    data.teams?.home?.id;

  const awayId =
    data.teams?.away?.id;

  const homeMatches =
    data.analysis_data?.form?.home || [];

  const awayMatches =
    data.analysis_data?.form?.away || [];

  const homeForm =
    analyzeTeamForm(
      homeMatches,
      homeId
    );

  const awayForm =
    analyzeTeamForm(
      awayMatches,
      awayId
    );

  const homeAttack =
    homeForm.goalsScored || 1.2;

  const homeDefense =
    homeForm.goalsConceded || 1.2;

  const awayAttack =
    awayForm.goalsScored || 1.1;

  const awayDefense =
    awayForm.goalsConceded || 1.2;

  let homeXG =
    (
      homeAttack * 0.60 +
      awayDefense * 0.40
    ) * 1.08;

  let awayXG =
    (
      awayAttack * 0.60 +
      homeDefense * 0.40
    );

  homeXG =
    Math.max(
      0.2,
      homeXG
    );

  awayXG =
    Math.max(
      0.2,
      awayXG
    );

  const scores =
    calculateScores(
      homeXG,
      awayXG
    );

  const markets =
    calculateMarkets(
      scores,
      homeXG,
      awayXG
    );

  const firstHalf =
    calculateHalf(
      homeXG * 0.44,
      awayXG * 0.44
    );

  const secondHalf =
    calculateHalf(
      homeXG * 0.56,
      awayXG * 0.56
    );

  const bothHalvesBTTS =
    (
      firstHalf.btts *
      secondHalf.btts
    ) / 100;

  const strongest =
    getStrongestMarket(
      markets
    );

  const risk =
    getRisk(
      strongest.confidence
    );

  return {

    homeForm,
    awayForm,

    expectedGoals: {

      home:
        round(homeXG),

      away:
        round(awayXG),

      total:
        round(
          homeXG + awayXG
        )
    },

    markets: {

      ...markets,

      bothHalvesBTTS:
        round(
          bothHalvesBTTS
        )
    },

    firstHalf,

    secondHalf,

    scorePrediction:
      scores[0],

    goalRange:
      getGoalRange(
        homeXG + awayXG
      ),

    strongestSelection:
      strongest.name,

    confidence:
      round(
        strongest.confidence
      ),

    risk
  };
}

// ============================================================
// FORM
// ============================================================

function analyzeTeamForm(
  matches,
  teamId
) {

  if (!Array.isArray(matches)) {

    return emptyForm();
  }

  const valid =
    matches
      .filter(
        match =>
          match?.teams &&
          match?.goals
      )
      .slice(0, 15);

  if (!valid.length) {

    return emptyForm();
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let goalsScored = [];
  let goalsConceded = [];

  let btts = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  valid.forEach(match => {

    const isHome =
      match.teams.home.id === teamId;

    const gf =
      isHome
        ? match.goals.home
        : match.goals.away;

    const ga =
      isHome
        ? match.goals.away
        : match.goals.home;

    if (
      gf === null ||
      gf === undefined ||
      ga === null ||
      ga === undefined
    ) {
      return;
    }

    goalsScored.push(gf);
    goalsConceded.push(ga);

    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;

    if (
      gf > 0 &&
      ga > 0
    ) {
      btts++;
    }

    const total =
      gf + ga;

    if (total >= 2) over15++;
    if (total >= 3) over25++;
    if (total >= 4) over35++;

  });

  const count =
    Math.max(
      valid.length,
      1
    );

  return {

    matches: valid.length,

    wins,
    draws,
    losses,

    winRate:
      wins / count * 100,

    drawRate:
      draws / count * 100,

    lossRate:
      losses / count * 100,

    goalsScored:
      average(goalsScored),

    goalsConceded:
      average(goalsConceded),

    bttsRate:
      btts / count * 100,

    over15Rate:
      over15 / count * 100,

    over25Rate:
      over25 / count * 100,

    over35Rate:
      over35 / count * 100
  };
}

function emptyForm() {

  return {

    matches: 0,

    wins: 0,
    draws: 0,
    losses: 0,

    winRate: 0,
    drawRate: 0,
    lossRate: 0,

    goalsScored: 1.2,
    goalsConceded: 1.2,

    bttsRate: 0,

    over15Rate: 0,
    over25Rate: 0,
    over35Rate: 0
  };
}

// ============================================================
// SCORE MODEL
// ============================================================

function poisson(
  lambda,
  goals
) {

  let factorial = 1;

  for (
    let i = 1;
    i <= goals;
    i++
  ) {
    factorial *= i;
  }

  return (
    Math.exp(-lambda) *
    Math.pow(lambda, goals) /
    factorial
  );
}

function calculateScores(
  homeXG,
  awayXG
) {

  const scores = [];

  for (
    let home = 0;
    home <= 6;
    home++
  ) {

    for (
      let away = 0;
      away <= 6;
      away++
    ) {

      const probability =
        poisson(
          homeXG,
          home
        ) *
        poisson(
          awayXG,
          away
        );

      scores.push({

        home,
        away,

        probability:
          probability * 100
      });
    }
  }

  return scores.sort(
    (a, b) =>
      b.probability -
      a.probability
  );
}

// ============================================================
// MARKETS
// ============================================================

function calculateMarkets(
  scores,
  homeXG,
  awayXG
) {

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let btts = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  let homeGoal = 0;
  let awayGoal = 0;

  scores.forEach(score => {

    const p =
      score.probability;

    const total =
      score.home +
      score.away;

    if (
      score.home >
      score.away
    ) {
      homeWin += p;
    }

    else if (
      score.home ===
      score.away
    ) {
      draw += p;
    }

    else {
      awayWin += p;
    }

    if (
      score.home > 0 &&
      score.away > 0
    ) {
      btts += p;
    }

    if (total >= 2)
      over15 += p;

    if (total >= 3)
      over25 += p;

    if (total >= 4)
      over35 += p;

    if (score.home >= 1)
      homeGoal += p;

    if (score.away >= 1)
      awayGoal += p;
  });

  return {

    homeWin:
      clamp(homeWin),

    draw:
      clamp(draw),

    awayWin:
      clamp(awayWin),

    btts:
      clamp(btts),

    over15:
      clamp(over15),

    over25:
      clamp(over25),

    over35:
      clamp(over35),

    homeGoal:
      clamp(homeGoal),

    awayGoal:
      clamp(awayGoal)
  };
}

// ============================================================
// HALF
// ============================================================

function calculateHalf(
  homeXG,
  awayXG
) {

  const scores =
    calculateScores(
      homeXG,
      awayXG
    );

  let home = 0;
  let draw = 0;
  let away = 0;
  let btts = 0;

  scores.forEach(score => {

    const p =
      score.probability;

    if (
      score.home >
      score.away
    ) {
      home += p;
    }

    else if (
      score.home ===
      score.away
    ) {
      draw += p;
    }

    else {
      away += p;
    }

    if (
      score.home > 0 &&
      score.away > 0
    ) {
      btts += p;
    }
  });

  return {

    homeWin:
      clamp(home),

    draw:
      clamp(draw),

    awayWin:
      clamp(away),

    btts:
      clamp(btts),

    predictedScore:
      `${scores[0].home}-${scores[0].away}`
  };
}

// ============================================================
// STRONGEST MARKET
// ============================================================

function getStrongestMarket(
  markets
) {

  const options = [

    {
      name: "MS 1",
      confidence:
        markets.homeWin
    },

    {
      name: "MS X",
      confidence:
        markets.draw
    },

    {
      name: "MS 2",
      confidence:
        markets.awayWin
    },

    {
      name: "KG",
      confidence:
        markets.btts
    },

    {
      name: "1.5 Üst",
      confidence:
        markets.over15
    },

    {
      name: "2.5 Üst",
      confidence:
        markets.over25
    },

    {
      name: "3.5 Üst",
      confidence:
        markets.over35
    }
  ];

  return options.sort(
    (a, b) =>
      b.confidence -
      a.confidence
  )[0];
}

// ============================================================
// RISK
// ============================================================

function getRisk(
  confidence
) {

  if (confidence >= 80)
    return "Düşük";

  if (confidence >= 65)
    return "Orta";

  if (confidence >= 50)
    return "Yüksek";

  return "Çok Yüksek";
}

// ============================================================
// GOAL RANGE
// ============================================================

function getGoalRange(
  total
) {

  if (total < 1.5)
    return "0-2";

  if (total < 2.5)
    return "1-3";

  if (total < 3.5)
    return "2-4";

  if (total < 4.5)
    return "3-5";

  return "4+";
}

// ============================================================
// RENDER ANALYSIS
// ============================================================

function renderAnalysis(
  data,
  analysis
) {

  if (!drawer)
    return;

  const home =
    data.teams?.home || {};

  const away =
    data.teams?.away || {};

  const league =
    data.league || {};

  const markets =
    analysis.markets;

  drawer.innerHTML = `

    <button
      class="drawer-close"
      onclick="closeDrawer()"
    >
      ×
    </button>

    <div class="analysis-header">

      <div class="analysis-league">
        ${escapeHtml(
          league.name || "Maç Analizi"
        )}
      </div>

      <div class="analysis-teams">

        <div>

          ${
            home.logo
              ? `<img src="${escapeAttribute(home.logo)}">`
              : ""
          }

          <strong>
            ${escapeHtml(
              home.name || ""
            )}
          </strong>

        </div>

        <span>VS</span>

        <div>

          ${
            away.logo
              ? `<img src="${escapeAttribute(away.logo)}">`
              : ""
          }

          <strong>
            ${escapeHtml(
              away.name || ""
            )}
          </strong>

        </div>

      </div>

    </div>

    <!-- EN MANTIKLI -->

    <section class="analysis-section strongest">

      <h3>🎯 Modelin En Güçlü Seçimi</h3>

      <div class="strongest-pick">

        <strong>
          ${escapeHtml(
            analysis.strongestSelection
          )}
        </strong>

        <span>
          %${analysis.confidence}
        </span>

      </div>

      <div class="confidence-bar">

        <div
          style="width:${analysis.confidence}%"
        ></div>

      </div>

      <p>
        Risk:
        <strong>
          ${escapeHtml(
            analysis.risk
          )}
        </strong>
      </p>

    </section>

    <!-- SKOR -->

    <section class="analysis-section">

      <h3>⚽ Tahmini Maç Skoru</h3>

      <div class="score-prediction">

        ${analysis.scorePrediction.home}
        -
        ${analysis.scorePrediction.away}

      </div>

      <p>
        Model olasılığı:
        %${round(
          analysis.scorePrediction.probability
        )}
      </p>

    </section>

    <!-- XG -->

    <section class="analysis-section">

      <h3>📊 Beklenen Gol</h3>

      <div class="metric-grid">

        <div>
          <span>${escapeHtml(home.name || "Ev")}</span>
          <strong>
            ${analysis.expectedGoals.home}
          </strong>
        </div>

        <div>
          <span>Toplam</span>
          <strong>
            ${analysis.expectedGoals.total}
          </strong>
        </div>

        <div>
          <span>${escapeHtml(away.name || "Dep")}</span>
          <strong>
            ${analysis.expectedGoals.away}
          </strong>
        </div>

      </div>

      <p>
        Tahmini gol aralığı:
        <strong>
          ${analysis.goalRange}
        </strong>
      </p>

    </section>

    <!-- MS -->

    <section class="analysis-section">

      <h3>🏆 Maç Sonucu</h3>

      ${marketRow(
        "MS 1",
        markets.homeWin
      )}

      ${marketRow(
        "MS X",
        markets.draw
      )}

      ${marketRow(
        "MS 2",
        markets.awayWin
      )}

    </section>

    <!-- GOL -->

    <section class="analysis-section">

      <h3>⚽ Gol Piyasaları</h3>

      ${marketRow(
        "KG",
        markets.btts
      )}

      ${marketRow(
        "1.5 Üst",
        markets.over15
      )}

      ${marketRow(
        "2.5 Üst",
        markets.over25
      )}

      ${marketRow(
        "3.5 Üst",
        markets.over35
      )}

      ${marketRow(
        `${home.name || "Ev"} 1+ Gol`,
        markets.homeGoal
      )}

      ${marketRow(
        `${away.name || "Dep"} 1+ Gol`,
        markets.awayGoal
      )}

      ${marketRow(
        "İY KG + 2Y KG",
        markets.bothHalvesBTTS
      )}

    </section>

    <!-- İLK YARI -->

    <section class="analysis-section">

      <h3>1️⃣ İlk Yarı</h3>

      ${marketRow(
        "İY 1",
        analysis.firstHalf.homeWin
      )}

      ${marketRow(
        "İY X",
        analysis.firstHalf.draw
      )}

      ${marketRow(
        "İY 2",
        analysis.firstHalf.awayWin
      )}

      ${marketRow(
        "İY KG",
        analysis.firstHalf.btts
      )}

      <p>
        Tahmini İY skor:
        <strong>
          ${analysis.firstHalf.predictedScore}
        </strong>
      </p>

    </section>

    <!-- İKİNCİ YARI -->

    <section class="analysis-section">

      <h3>2️⃣ İkinci Yarı</h3>

      ${marketRow(
        "2Y 1",
        analysis.secondHalf.homeWin
      )}

      ${marketRow(
        "2Y X",
        analysis.secondHalf.draw
      )}

      ${marketRow(
        "2Y 2",
        analysis.secondHalf.awayWin
      )}

      ${marketRow(
        "2Y KG",
        analysis.secondHalf.btts
      )}

      <p>
        Tahmini 2Y skor:
        <strong>
          ${analysis.secondHalf.predictedScore}
        </strong>
      </p>

    </section>

    <!-- FORM -->

    <section class="analysis-section">

      <h3>📈 Son 15 Maç Formu</h3>

      ${formHTML(
        home.name,
        analysis.homeForm
      )}

      ${formHTML(
        away.name,
        analysis.awayForm
      )}

    </section>

    <!-- VERİ DURUMU -->

    <section class="analysis-section">

      <h3>🔎 Kullanılan Veri Kaynakları</h3>

      <div class="data-status-grid">

        ${statusHTML(
          "Son Maçlar",
          data.data_status?.home_form &&
          data.data_status?.away_form
        )}

        ${statusHTML(
          "H2H",
          data.data_status?.h2h
        )}

        ${statusHTML(
          "Puan Durumu",
          data.data_status?.standings
        )}

        ${statusHTML(
          "Takım İstatistikleri",
          data.data_status?.home_statistics &&
          data.data_status?.away_statistics
        )}

        ${statusHTML(
          "Kadro",
          data.data_status?.lineups
        )}

        ${statusHTML(
          "Sakatlıklar",
          data.data_status?.injuries
        )}

        ${statusHTML(
          "Maç İstatistikleri",
          data.data_status?.statistics
        )}

        ${statusHTML(
          "Oranlar",
          data.data_status?.odds
        )}

        ${statusHTML(
          "API Tahmini",
          data.data_status?.predictions
        )}

      </div>

    </section>

  `;
}

// ============================================================
// HTML HELPERS
// ============================================================

function marketRow(
  name,
  value
) {

  return `
    <div class="market-row">

      <span>
        ${escapeHtml(name)}
      </span>

      <strong>
        %${round(value)}
      </strong>

    </div>
  `;
}

function formHTML(
  name,
  form
) {

  return `

    <div class="form-box">

      <h4>
        ${escapeHtml(name || "")}
      </h4>

      <div class="metric-grid">

        <div>
          <span>Galibiyet</span>
          <strong>
            %${round(form.winRate)}
          </strong>
        </div>

        <div>
          <span>KG</span>
          <strong>
            %${round(form.bttsRate)}
          </strong>
        </div>

        <div>
          <span>Attığı</span>
          <strong>
            ${round(form.goalsScored)}
          </strong>
        </div>

        <div>
          <span>Yediği</span>
          <strong>
            ${round(form.goalsConceded)}
          </strong>
        </div>

      </div>

    </div>
  `;
}

function statusHTML(
  label,
  status
) {

  return `
    <div class="data-status">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${status ? "✓" : "—"}
      </strong>

    </div>
  `;
}

// ============================================================
// DRAWER
// ============================================================

function openDrawer() {

  if (drawer)
    drawer.classList.add("open");

  if (overlay)
    overlay.classList.add("active");

  document.body.classList.add(
    "drawer-open"
  );
}

function closeDrawer() {

  if (drawer)
    drawer.classList.remove("open");

  if (overlay)
    overlay.classList.remove("active");

  document.body.classList.remove(
    "drawer-open"
  );
}

function setDrawerLoading() {

  if (!drawer)
    return;

  drawer.innerHTML = `

    <button
      class="drawer-close"
      onclick="closeDrawer()"
    >
      ×
    </button>

    <div class="analysis-loading">

      <div class="loader"></div>

      <h3>
        Maç analiz ediliyor...
      </h3>

      <p>
        Takım formu, H2H, kadro,
        sakatlıklar ve istatistikler
        toplanıyor.
      </p>

    </div>
  `;
}

// ============================================================
// FAVORITES
// ============================================================

function toggleFavorite(
  fixtureId
) {

  fixtureId =
    Number(fixtureId);

  if (
    favorites.includes(fixtureId)
  ) {

    favorites =
      favorites.filter(
        id => id !== fixtureId
      );

  } else {

    favorites.push(
      fixtureId
    );
  }

  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(favorites)
  );

  applyFilters();
}

// ============================================================
// UI
// ============================================================

function setApiStatus(
  text
) {

  const el =
    document.getElementById(
      "apiStatus"
    );

  if (el)
    el.textContent = text;
}

function updateMatchCount(
  count
) {

  const el =
    document.getElementById(
      "matchCount"
    );

  if (el)
    el.textContent = count;
}

// ============================================================
// UTILITIES
// ============================================================

function average(
  values
) {

  const valid =
    values.filter(
      x =>
        typeof x === "number" &&
        Number.isFinite(x)
    );

  if (!valid.length)
    return 0;

  return (
    valid.reduce(
      (a, b) => a + b,
      0
    ) / valid.length
  );
}

function clamp(
  value,
  min = 0,
  max = 100
) {

  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function round(
  value
) {

  return Number(
    Number(value || 0)
      .toFixed(1)
  );
}

function escapeHtml(
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

function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );
}

// ============================================================
// GLOBALS
// ============================================================

window.openMatch =
  openMatch;

window.closeDrawer =
  closeDrawer;

window.toggleFavorite =
  toggleFavorite;

window.loadFixtures =
  loadFixtures;

window.applyFilters =
  applyFilters;
