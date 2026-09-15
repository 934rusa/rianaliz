/* =========================================================
   R❤️İ FOOTBALL
   Futbol Analiz Merkezi
   APP.JS v4.0
   ========================================================= */

const API_BASE = "/api";

let allFixtures = [];
let currentFixtures = [];
let favorites = [];

try {
  favorites = JSON.parse(
    localStorage.getItem("ri_favorites") || "[]"
  );

  if (!Array.isArray(favorites)) {
    favorites = [];
  }

  favorites = favorites.map(String);
} catch {
  favorites = [];
}

/* =========================================================
   HELPERS
   ========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, number(value))
  );
}

function pct(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function average(arr) {
  if (!Array.isArray(arr) || !arr.length) {
    return 0;
  }

  return (
    arr.reduce(
      (sum, value) => sum + number(value),
      0
    ) / arr.length
  );
}

/* =========================================================
   TURKEY DATE
   ========================================================= */

function getTurkeyDate() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
}

/* =========================================================
   API
   ========================================================= */

async function api(path) {
  const response = await fetch(
    `${API_BASE}${path}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Sunucudan geçersiz cevap geldi (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `API hatası: ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   NORMALIZE FIXTURE
   ========================================================= */

function normalizeFixture(item) {
  const fixture =
    item?.fixture ||
    item ||
    {};

  const teams =
    item?.teams ||
    fixture?.teams ||
    {};

  const league =
    item?.league ||
    fixture?.league ||
    {};

  return {
    id:
      fixture?.id ??
      item?.id ??
      null,

    date:
      fixture?.date ??
      item?.date ??
      null,

    status:
      fixture?.status?.short ??
      item?.status?.short ??
      fixture?.status ??
      "",

    country:
      league?.country ||
      "Diğer",

    league:
      league?.name ||
      "Lig",

    home:
      teams?.home?.name ||
      item?.home?.name ||
      "Ev Sahibi",

    away:
      teams?.away?.name ||
      item?.away?.name ||
      "Deplasman",

    homeLogo:
      teams?.home?.logo ||
      item?.home?.logo ||
      "",

    awayLogo:
      teams?.away?.logo ||
      item?.away?.logo ||
      "",

    homeId:
      teams?.home?.id ??
      item?.home?.id ??
      null,

    awayId:
      teams?.away?.id ??
      item?.away?.id ??
      null
  };
}

/* =========================================================
   LOAD FIXTURES
   ========================================================= */

async function loadFixtures() {
  const container = $("#matches");

  if (container) {
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Maçlar yükleniyor...</p>
      </div>
    `;
  }

  setApiStatus(
    "● API BAĞLANIYOR...",
    false
  );

  try {
    const today = getTurkeyDate();

    console.log(
      "R❤️İ API tarih:",
      today
    );

    const data = await api(
      `/fixtures?date=${encodeURIComponent(today)}`
    );

    /*
      API-Football normal cevabı:
      {
        response: [...]
      }

      Ancak farklı route yapıları için
      diğer formatları da destekliyoruz.
    */

    let fixtures = [];

    if (Array.isArray(data)) {
      fixtures = data;
    } else if (
      Array.isArray(data?.response)
    ) {
      fixtures = data.response;
    } else if (
      Array.isArray(data?.fixtures)
    ) {
      fixtures = data.fixtures;
    } else if (
      Array.isArray(data?.data)
    ) {
      fixtures = data.data;
    }

    allFixtures = fixtures;
    currentFixtures = fixtures;

    setApiStatus(
      "● API-FOOTBALL BAĞLI",
      true
    );

    updateCount(
      fixtures.length
    );

    renderFixtures(fixtures);

    const resultInfo =
      $("#resultInfo");

    if (resultInfo) {
      resultInfo.textContent =
        fixtures.length
          ? `${fixtures.length} maç`
          : "";
    }

    console.log(
      `R❤️İ: ${fixtures.length} maç yüklendi.`
    );

  } catch (error) {
    console.error(
      "R❤️İ loadFixtures:",
      error
    );

    setApiStatus(
      "● API HATASI",
      false
    );

    updateCount(0);

    if (container) {
      container.innerHTML = `
        <div class="empty">
          ❌ Maçlar alınamadı.
          <br>
          <small>${esc(error.message)}</small>
          <br><br>
          <button
            type="button"
            onclick="loadFixtures()"
          >
            ↻ Tekrar Dene
          </button>
        </div>
      `;
    }
  }
}

/* =========================================================
   API STATUS
   ========================================================= */

function setApiStatus(text, online) {
  const status = $("#apiStatus");

  if (!status) {
    return;
  }

  status.textContent = text;

  status.classList.toggle(
    "online",
    Boolean(online)
  );
}

/* =========================================================
   COUNT
   ========================================================= */

function updateCount(count) {
  const el = $("#matchCount");

  if (el) {
    el.textContent = String(
      number(count)
    );
  }
}

/* =========================================================
   MATCH TIME
   ========================================================= */

function formatMatchTime(dateValue) {
  if (!dateValue) {
    return "--:--";
  }

  try {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return date.toLocaleTimeString(
      "tr-TR",
      {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  } catch {
    return "--:--";
  }
}

/* =========================================================
   MATCH CARDS
   ========================================================= */

function renderFixtures(fixtures) {
  const container = $("#matches");

  if (!container) {
    return;
  }

  currentFixtures =
    Array.isArray(fixtures)
      ? fixtures
      : [];

  updateCount(
    currentFixtures.length
  );

  if (!currentFixtures.length) {
    container.innerHTML = `
      <div class="empty">
        Maç bulunamadı.
      </div>
    `;

    return;
  }

  container.innerHTML =
    currentFixtures
      .map(raw => {
        const match =
          normalizeFixture(raw);

        const id =
          match.id;

        const isFavorite =
          favorites.includes(
            String(id)
          );

        const time =
          formatMatchTime(
            match.date
          );

        return `
          <article
            class="match-card"
            data-id="${esc(id)}"
          >

            <div class="match-league">
              <span>
                ${esc(match.country)}
              </span>

              <strong>
                ${esc(match.league)}
              </strong>
            </div>

            <div class="match-teams">

              <div class="team">

                ${
                  match.homeLogo
                    ? `
                      <img
                        src="${esc(match.homeLogo)}"
                        alt=""
                        loading="lazy"
                        onerror="this.style.display='none'"
                      >
                    `
                    : `
                      <div class="team-logo-placeholder">
                        ⚽
                      </div>
                    `
                }

                <span>
                  ${esc(match.home)}
                </span>

              </div>

              <div class="match-vs">

                <small>
                  ${esc(time)}
                </small>

                <strong>
                  VS
                </strong>

              </div>

              <div class="team">

                ${
                  match.awayLogo
                    ? `
                      <img
                        src="${esc(match.awayLogo)}"
                        alt=""
                        loading="lazy"
                        onerror="this.style.display='none'"
                      >
                    `
                    : `
                      <div class="team-logo-placeholder">
                        ⚽
                      </div>
                    `
                }

                <span>
                  ${esc(match.away)}
                </span>

              </div>

            </div>

            <div class="match-footer">

              <span>
                📊 Detaylı Analiz
              </span>

              <button
                class="favorite-btn ${
                  isFavorite
                    ? "is-favorite"
                    : ""
                }"
                data-favorite="${esc(id)}"
                type="button"
                aria-label="Favori"
              >
                ${
                  isFavorite
                    ? "♥"
                    : "♡"
                }
              </button>

            </div>

          </article>
        `;
      })
      .join("");

  attachMatchEvents();
}

/* =========================================================
   MATCH EVENTS
   ========================================================= */

function attachMatchEvents() {
  document
    .querySelectorAll(".match-card")
    .forEach(card => {
      card.addEventListener(
        "click",
        event => {
          if (
            event.target.closest(
              ".favorite-btn"
            )
          ) {
            return;
          }

          const id =
            card.dataset.id;

          if (id) {
            openMatch(id);
          }
        }
      );
    });

  document
    .querySelectorAll(
      ".favorite-btn"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          toggleFavorite(
            button.dataset.favorite
          );
        }
      );
    });
}

/* =========================================================
   FAVORITES
   ========================================================= */

function toggleFavorite(id) {
  id = String(id);

  if (
    favorites.includes(id)
  ) {
    favorites =
      favorites.filter(
        item => item !== id
      );
  } else {
    favorites.push(id);
  }

  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(favorites)
  );

  renderFixtures(
    currentFixtures
  );
}

/* =========================================================
   OPEN MATCH
   ========================================================= */

async function openMatch(id) {
  const drawer =
    $("#analysisDrawer");

  if (!drawer) {
    console.error(
      "R❤️İ: #analysisDrawer bulunamadı."
    );

    return;
  }

  drawer.classList.add("open");

  document.body.classList.add(
    "drawer-open"
  );

  drawer.innerHTML = `
    <div class="analysis-container">

      <button
        class="close-analysis"
        onclick="closeDrawer()"
        type="button"
      >
        ✕
      </button>

      <div class="analysis-loading">

        <div class="spinner"></div>

        <h2>
          ⚽ Maç analiz ediliyor...
        </h2>

        <p>
          Form, H2H, gol verileri,
          takım istatistikleri,
          kadro ve mevcut veriler
          hesaplanıyor.
        </p>

      </div>

    </div>
  `;

  try {
    const data =
      await api(
        `/match?fixture=${encodeURIComponent(id)}`
      );

    console.log(
      "R❤️İ match data:",
      data
    );

    const analysis =
      calculateDecision(data);

    renderAnalysis(
      data,
      analysis
    );

  } catch (error) {
    console.error(
      "R❤️İ openMatch:",
      error
    );

    drawer.innerHTML = `
      <div class="analysis-container">

        <button
          class="close-analysis"
          onclick="closeDrawer()"
          type="button"
        >
          ✕
        </button>

        <div class="analysis-error">

          <h2>
            ❌ Analiz alınamadı
          </h2>

          <p>
            Maç verileri getirilemedi.
          </p>

          <small>
            ${esc(error.message)}
          </small>

          <br><br>

          <button
            type="button"
            onclick="openMatch('${esc(id)}')"
          >
            ↻ Tekrar Dene
          </button>

        </div>

      </div>
    `;
  }
}

/* =========================================================
   CLOSE DRAWER
   ========================================================= */

function closeDrawer() {
  const drawer =
    $("#analysisDrawer");

  if (!drawer) {
    return;
  }

  drawer.classList.remove("open");

  document.body.classList.remove(
    "drawer-open"
  );
}

function closeAnalysis() {
  closeDrawer();
}

/* =========================================================
   FORM EXTRACTION
   ========================================================= */

function getForm(data, side) {
  const source =
    data?.analysis_data?.form?.[side] ||
    {};

  const played =
    number(
      source.played ??
      source.games ??
      source.matches ??
      0
    );

  const wins =
    number(
      source.wins ??
      source.win ??
      0
    );

  const draws =
    number(
      source.draws ??
      source.draw ??
      0
    );

  const losses =
    number(
      source.losses ??
      source.loss ??
      0
    );

  const avgFor =
    number(
      source.avgFor ??
      source.avg_for ??
      source.goalsFor ??
      source.goals_for ??
      source.scored ??
      0
    );

  const avgAgainst =
    number(
      source.avgAgainst ??
      source.avg_against ??
      source.goalsAgainst ??
      source.goals_against ??
      source.conceded ??
      0
    );

  const btts =
    number(
      source.btts ??
      source.BTTS ??
      source.bttsRate ??
      source.btts_rate ??
      0
    );

  const over25 =
    number(
      source.over25 ??
      source.over_25 ??
      source.over25Rate ??
      source.over_25_rate ??
      0
    );

  return {
    played,
    wins,
    draws,
    losses,
    avgFor,
    avgAgainst,
    btts,
    over25
  };
}

/* =========================================================
   XG
   ========================================================= */

function calculateXG(home, away) {
  let homeXG =
    (
      home.avgFor +
      away.avgAgainst
    ) / 2;

  let awayXG =
    (
      away.avgFor +
      home.avgAgainst
    ) / 2;

  if (
    !Number.isFinite(homeXG) ||
    homeXG <= 0
  ) {
    homeXG = 1.25;
  }

  if (
    !Number.isFinite(awayXG) ||
    awayXG <= 0
  ) {
    awayXG = 1.05;
  }

  homeXG *= 1.08;

  return {
    home: clamp(
      homeXG,
      0.15,
      4.5
    ),

    away: clamp(
      awayXG,
      0.15,
      4.5
    )
  };
}

/* =========================================================
   FACTORIAL
   ========================================================= */

function factorial(n) {
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
   POISSON
   ========================================================= */

function poisson(lambda, k) {
  return (
    Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k)
  );
}

/* =========================================================
   MARKET CALCULATION
   ========================================================= */

function calculateMarkets(
  homeXG,
  awayXG
) {
  const maxGoals = 8;

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  let btts = 0;

  let homeGoal = 0;
  let awayGoal = 0;

  const matrix = [];

  for (
    let home = 0;
    home <= maxGoals;
    home++
  ) {
    matrix[home] = [];

    for (
      let away = 0;
      away <= maxGoals;
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

      matrix[home][away] =
        probability;

      if (home > away) {
        homeWin += probability;
      }

      if (home === away) {
        draw += probability;
      }

      if (home < away) {
        awayWin += probability;
      }

      if (
        home + away >= 2
      ) {
        over15 += probability;
      }

      if (
        home + away >= 3
      ) {
        over25 += probability;
      }

      if (
        home + away >= 4
      ) {
        over35 += probability;
      }

      if (
        home >= 1 &&
        away >= 1
      ) {
        btts += probability;
      }

      if (home >= 1) {
        homeGoal += probability;
      }

      if (away >= 1) {
        awayGoal += probability;
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

    over15:
      over15 * 100,

    over25:
      over25 * 100,

    over35:
      over35 * 100,

    btts:
      btts * 100,

    homeGoal:
      homeGoal * 100,

    awayGoal:
      awayGoal * 100,

    matrix
  };
}

/* =========================================================
   PREDICTED SCORE
   ========================================================= */

function predictedScore(matrix) {
  let bestProbability = -1;
  let bestHome = 0;
  let bestAway = 0;

  if (!Array.isArray(matrix)) {
    return "1-1";
  }

  for (
    let home = 0;
    home < matrix.length;
    home++
  ) {
    if (!Array.isArray(matrix[home])) {
      continue;
    }

    for (
      let away = 0;
      away < matrix[home].length;
      away++
    ) {
      if (
        matrix[home][away] >
        bestProbability
      ) {
        bestProbability =
          matrix[home][away];

        bestHome = home;
        bestAway = away;
      }
    }
  }

  return `${bestHome}-${bestAway}`;
}

/* =========================================================
   API PREDICTION EXTRACTION
   ========================================================= */

function getApiPrediction(data) {
  const prediction =
    data?.analysis_data?.api_prediction;

  if (!prediction) {
    return null;
  }

  return prediction;
}

/* =========================================================
   DECISION ENGINE
   ========================================================= */

function calculateDecision(data) {
  const home =
    getForm(data, "home");

  const away =
    getForm(data, "away");

  const xg =
    calculateXG(
      home,
      away
    );

  const markets =
    calculateMarkets(
      xg.home,
      xg.away
    );

  const homeWinRate =
    home.played > 0
      ? home.wins /
        home.played *
        100
      : 50;

  const awayWinRate =
    away.played > 0
      ? away.wins /
        away.played *
        100
      : 50;

  const homeGoalStrength =
    clamp(
      home.avgFor * 35,
      0,
      100
    );

  const awayGoalStrength =
    clamp(
      away.avgFor * 35,
      0,
      100
    );

  const homeDefenseWeakness =
    clamp(
      home.avgAgainst * 35,
      0,
      100
    );

  const awayDefenseWeakness =
    clamp(
      away.avgAgainst * 35,
      0,
      100
    );

  const candidates = [
    {
      key: "MS1",
      label: "MS 1",
      probability:
        markets.homeWin,

      reliability: 0.86,

      support:
        homeWinRate * 0.55 +
        homeGoalStrength * 0.25 +
        awayDefenseWeakness * 0.20
    },

    {
      key: "MSX",
      label: "MS X",
      probability:
        markets.draw,

      reliability: 0.68,

      support:
        100 -
        Math.abs(
          homeWinRate -
          awayWinRate
        )
    },

    {
      key: "MS2",
      label: "MS 2",
      probability:
        markets.awayWin,

      reliability: 0.84,

      support:
        awayWinRate * 0.55 +
        awayGoalStrength * 0.25 +
        homeDefenseWeakness * 0.20
    },

    {
      key: "KG",
      label: "KG Var",
      probability:
        markets.btts,

      reliability: 0.91,

      support:
        (
          home.btts +
          away.btts
        ) / 2
    },

    {
      key: "O15",
      label: "1.5 Üst",
      probability:
        markets.over15,

      reliability: 0.98,

      support:
        clamp(
          (
            home.avgFor +
            away.avgFor +
            home.avgAgainst +
            away.avgAgainst
          ) * 20,
          0,
          100
        )
    },

    {
      key: "O25",
      label: "2.5 Üst",
      probability:
        markets.over25,

      reliability: 0.90,

      support:
        (
          home.over25 +
          away.over25
        ) / 2
    },

    {
      key: "O35",
      label: "3.5 Üst",
      probability:
        markets.over35,

      reliability: 0.75,

      support:
        (
          home.over25 +
          away.over25
        ) / 2
    }
  ];

  candidates.forEach(
    candidate => {
      candidate.probability =
        clamp(
          candidate.probability,
          0,
          100
        );

      candidate.support =
        clamp(
          candidate.support,
          0,
          100
        );

      candidate.decisionScore =
        candidate.probability * 0.65 +
        candidate.support * 0.20 +
        candidate.reliability *
        100 *
        0.15;
    }
  );

  /*
    Ana seçimde aşırı düşük
    olasılıklı seçenekleri ele.
  */

  const validCandidates =
    candidates.filter(
      candidate =>
        candidate.probability >= 55
    );

  const pool =
    validCandidates.length
      ? validCandidates
      : candidates;

  pool.sort(
    (a, b) =>
      b.decisionScore -
      a.decisionScore
  );

  const best =
    pool[0] ||
    candidates[0];

  const confidence =
    clamp(
      best.probability,
      0,
      99
    );

  let risk;
  let category;

  if (confidence >= 78) {
    risk = "Düşük";
    category =
      "Güvenilir Seçim";
  } else if (confidence >= 68) {
    risk = "Orta";
    category =
      "Orta Riskli";
  } else if (confidence >= 58) {
    risk = "Yüksek";
    category =
      "Riskli Seçim";
  } else {
    risk = "Çok Yüksek";
    category =
      "Yüksek Oran Fırsatı";
  }

  const score =
    predictedScore(
      markets.matrix
    );

  const reasons = [];

  /* -------------------------------------------------------
     MS1
  ------------------------------------------------------- */

  if (best.key === "MS1") {
    if (
      homeWinRate >
      awayWinRate
    ) {
      reasons.push(
        `Ev sahibinin galibiyet oranı daha yüksek (${Math.round(homeWinRate)}% - ${Math.round(awayWinRate)}%).`
      );
    }

    if (
      xg.home >
      xg.away
    ) {
      reasons.push(
        `Model ev sahibini xG açısından önde görüyor (${xg.home.toFixed(2)} - ${xg.away.toFixed(2)}).`
      );
    }

    if (
      awayDefenseWeakness >= 50
    ) {
      reasons.push(
        "Deplasman ekibinin savunma/gol yeme verileri ev sahibi lehine."
      );
    }
  }

  /* -------------------------------------------------------
     MS2
  ------------------------------------------------------- */

  if (best.key === "MS2") {
    if (
      awayWinRate >
      homeWinRate
    ) {
      reasons.push(
        `Deplasman ekibinin galibiyet oranı daha yüksek (${Math.round(awayWinRate)}% - ${Math.round(homeWinRate)}%).`
      );
    }

    if (
      xg.away >
      xg.home
    ) {
      reasons.push(
        `Model deplasman ekibini xG açısından önde görüyor (${xg.away.toFixed(2)} - ${xg.home.toFixed(2)}).`
      );
    }

    if (
      homeDefenseWeakness >= 50
    ) {
      reasons.push(
        "Ev sahibinin gol yeme verileri deplasman seçimini destekliyor."
      );
    }
  }

  /* -------------------------------------------------------
     KG
  ------------------------------------------------------- */

  if (best.key === "KG") {
    reasons.push(
      `Modelin KG Var olasılığı ${Math.round(markets.btts)}%.`
    );

    if (
      homeGoalStrength >= 45 &&
      awayGoalStrength >= 45
    ) {
      reasons.push(
        "Her iki takımın gol üretimi KG Var senaryosunu destekliyor."
      );
    }
  }

  /* -------------------------------------------------------
     OVER 1.5
  ------------------------------------------------------- */

  if (best.key === "O15") {
    reasons.push(
      `Toplam 1.5 Üst model olasılığı ${Math.round(markets.over15)}%.`
    );

    reasons.push(
      "Takımların gol üretimi ve savunma verileri toplam gol senaryosunu destekliyor."
    );
  }

  /* -------------------------------------------------------
     OVER 2.5
  ------------------------------------------------------- */

  if (best.key === "O25") {
    reasons.push(
      `Toplam 2.5 Üst model olasılığı ${Math.round(markets.over25)}%.`
    );

    reasons.push(
      "Gol ortalamaları ve geçmiş 2.5 Üst verileri birlikte değerlendirildi."
    );
  }

  /* -------------------------------------------------------
     OVER 3.5
  ------------------------------------------------------- */

  if (best.key === "O35") {
    reasons.push(
      `Toplam 3.5 Üst model olasılığı ${Math.round(markets.over35)}%.`
    );

    reasons.push(
      "Model yüksek toplam gol senaryosunu değerlendiriyor; risk seviyesi daha yüksektir."
    );
  }

  /* -------------------------------------------------------
     GENERAL
  ------------------------------------------------------- */

  reasons.push(
    `Gol ortalamaları: ${home.avgFor.toFixed(2)} - ${away.avgFor.toFixed(2)}.`
  );

  if (
    xg.home >
    xg.away
  ) {
    reasons.push(
      `Beklenen gol modeli ev sahibini önde gösteriyor (${xg.home.toFixed(2)} - ${xg.away.toFixed(2)}).`
    );
  } else if (
    xg.away >
    xg.home
  ) {
    reasons.push(
      `Beklenen gol modeli deplasmanı önde gösteriyor (${xg.away.toFixed(2)} - ${xg.home.toFixed(2)}).`
    );
  }

  /*
    Aynı sebebin iki kez yazılmasını önle.
  */

  const uniqueReasons =
    [...new Set(reasons)]
      .slice(0, 6);

  const alternatives =
    pool
      .filter(
        candidate =>
          candidate.key !==
          best.key
      )
      .slice(0, 4)
      .map(candidate => {
        let optionRisk;

        if (
          candidate.probability >= 78
        ) {
          optionRisk = "Düşük";
        } else if (
          candidate.probability >= 68
        ) {
          optionRisk = "Orta";
        } else if (
          candidate.probability >= 58
        ) {
          optionRisk = "Yüksek";
        } else {
          optionRisk = "Çok Yüksek";
        }

        return {
          label:
            candidate.label,

          probability:
            candidate.probability,

          risk:
            optionRisk
        };
      });

  return {
    best,
    confidence,
    risk,
    category,
    score,
    xg,
    markets,
    home,
    away,
    reasons:
      uniqueReasons,
    alternatives,
    apiPrediction:
      getApiPrediction(data)
  };
}

/* =========================================================
   RENDER ANALYSIS
   ========================================================= */

function renderAnalysis(
  data,
  analysis
) {
  const drawer =
    $("#analysisDrawer");

  if (!drawer) {
    return;
  }

  const homeName =
    data?.teams?.home?.name ||
    data?.fixture?.teams?.home?.name ||
    "Ev Sahibi";

  const awayName =
    data?.teams?.away?.name ||
    data?.fixture?.teams?.away?.name ||
    "Deplasman";

  const leagueName =
    data?.league?.name ||
    data?.fixture?.league?.name ||
    "";

  const best =
    analysis?.best || {
      label: "Veri yetersiz",
      probability: 0
    };

  drawer.innerHTML = `
    <div class="analysis-container">

      <button
        class="close-analysis"
        onclick="closeDrawer()"
        type="button"
      >
        ✕
      </button>

      <div class="analysis-header">

        <div class="league-title">
          ${esc(leagueName)}
        </div>

        <h1>
          ${esc(homeName)}
          <span>VS</span>
          ${esc(awayName)}
        </h1>

      </div>

      <!-- =========================================
           ŞUNU OYNA
      ========================================== -->

      <section class="play-box">

        <div class="play-label">
          🎯 ŞUNU OYNA
        </div>

        <div class="play-selection">
          ${esc(best.label)}
        </div>

        <div class="play-confidence">
          ${pct(analysis.confidence)}
        </div>

        <div class="play-meta">

          <span>
            ${esc(analysis.category)}
          </span>

          <span>
            Risk: ${esc(analysis.risk)}
          </span>

        </div>

      </section>

      <!-- =========================================
           NEDEN
      ========================================== -->

      <section class="analysis-section">

        <h2>
          🧠 NEDEN BU SEÇİM?
        </h2>

        <div class="reason-list">

          ${
            analysis.reasons
              .map(reason => `
                <div class="reason">
                  <span>✓</span>
                  <p>
                    ${esc(reason)}
                  </p>
                </div>
              `)
              .join("")
          }

        </div>

      </section>

      <!-- =========================================
           SKOR
      ========================================== -->

      <section class="score-box">

        <div>
          <small>
            TAHMİNİ SKOR
          </small>

          <strong>
            ${esc(analysis.score)}
          </strong>
        </div>

        <div>
          <small>
            EV xG
          </small>

          <strong>
            ${number(
              analysis.xg.home
            ).toFixed(2)}
          </strong>
        </div>

        <div>
          <small>
            DEP xG
          </small>

          <strong>
            ${number(
              analysis.xg.away
            ).toFixed(2)}
          </strong>
        </div>

      </section>

      <!-- =========================================
           ALTERNATİFLER
      ========================================== -->

      <section class="analysis-section">

        <h2>
          📌 DİĞER SEÇENEKLER
        </h2>

        <div class="alternative-list">

          ${
            analysis.alternatives.length
              ? analysis.alternatives
                  .map(option => `
                    <div class="alternative">

                      <strong>
                        ${esc(option.label)}
                      </strong>

                      <span>
                        ${pct(
                          option.probability
                        )}
                      </span>

                      <small>
                        ${esc(option.risk)}
                        Risk
                      </small>

                    </div>
                  `)
                  .join("")
              : `
                <div class="empty">
                  Yeterli alternatif veri yok.
                </div>
              `
          }

        </div>

      </section>

      <!-- =========================================
           MODEL
      ========================================== -->

      <section class="analysis-section">

        <h2>
          📊 MODEL OLASILIKLARI
        </h2>

        <div class="market-grid">

          ${marketRow(
            "MS 1",
            analysis.markets.homeWin
          )}

          ${marketRow(
            "MS X",
            analysis.markets.draw
          )}

          ${marketRow(
            "MS 2",
            analysis.markets.awayWin
          )}

          ${marketRow(
            "KG Var",
            analysis.markets.btts
          )}

          ${marketRow(
            "1.5 Üst",
            analysis.markets.over15
          )}

          ${marketRow(
            "2.5 Üst",
            analysis.markets.over25
          )}

          ${marketRow(
            "3.5 Üst",
            analysis.markets.over35
          )}

        </div>

      </section>

      <!-- =========================================
           GOL
      ========================================== -->

      <section class="analysis-section">

        <h2>
          ⚽ GOL OLASILIKLARI
        </h2>

        <div class="market-grid">

          ${marketRow(
            `${homeName} 1+ Gol`,
            analysis.markets.homeGoal
          )}

          ${marketRow(
            `${awayName} 1+ Gol`,
            analysis.markets.awayGoal
          )}

        </div>

      </section>

      <!-- =========================================
           FORM
      ========================================== -->

      <section class="analysis-section">

        <h2>
          📈 FORM VERİSİ
        </h2>

        <div class="form-grid">

          <div class="form-team">

            <h3>
              ${esc(homeName)}
            </h3>

            <p>
              Maç: ${analysis.home.played}
            </p>

            <p>
              Galibiyet: ${analysis.home.wins}
            </p>

            <p>
              Beraberlik: ${analysis.home.draws}
            </p>

            <p>
              Mağlubiyet: ${analysis.home.losses}
            </p>

            <p>
              Gol ort.: ${analysis.home.avgFor.toFixed(2)}
            </p>

            <p>
              Yenen ort.: ${analysis.home.avgAgainst.toFixed(2)}
            </p>

          </div>

          <div class="form-team">

            <h3>
              ${esc(awayName)}
            </h3>

            <p>
              Maç: ${analysis.away.played}
            </p>

            <p>
              Galibiyet: ${analysis.away.wins}
            </p>

            <p>
              Beraberlik: ${analysis.away.draws}
            </p>

            <p>
              Mağlubiyet: ${analysis.away.losses}
            </p>

            <p>
              Gol ort.: ${analysis.away.avgFor.toFixed(2)}
            </p>

            <p>
              Yenen ort.: ${analysis.away.avgAgainst.toFixed(2)}
            </p>

          </div>

        </div>

      </section>

      <!-- =========================================
           DATA STATUS
      ========================================== -->

      ${renderDataStatus(data)}

      <div class="model-note">

        ⚠️ Bu sonuç istatistiksel model
        olasılığıdır. Kesinlik veya garanti
        anlamına gelmez.

      </div>

    </div>
  `;
}

/* =========================================================
   MARKET ROW
   ========================================================= */

function marketRow(
  label,
  value
) {
  return `
    <div class="market-row">

      <span>
        ${esc(label)}
      </span>

      <strong>
        ${pct(value)}
      </strong>

    </div>
  `;
}

/* =========================================================
   DATA STATUS
   ========================================================= */

function renderDataStatus(data) {
  const status =
    data?.data_status;

  if (
    !status ||
    typeof status !== "object"
  ) {
    return "";
  }

  const items = [];

  Object.entries(status)
    .forEach(
      ([key, value]) => {
        const label =
          key
            .replaceAll(
              "_",
              " "
            )
            .toUpperCase();

        items.push(`
          <span>
            ${
              value
                ? "✓"
                : "—"
            }
            ${esc(label)}
          </span>
        `);
      }
    );

  if (!items.length) {
    return "";
  }

  return `
    <section class="analysis-section">

      <h2>
        🔎 KULLANILAN VERİLER
      </h2>

      <div class="data-status">
        ${items.join("")}
      </div>

    </section>
  `;
}

/* =========================================================
   SEARCH
   ========================================================= */

function searchMatches(query) {
  const text =
    String(query || "")
      .trim()
      .toLowerCase();

  if (!text) {
    renderFixtures(
      allFixtures
    );

    setSectionTitle(
      "Bugünün Maçları"
    );

    return;
  }

  const filtered =
    allFixtures.filter(
      raw => {
        const match =
          normalizeFixture(raw);

        return (
          match.home
            .toLowerCase()
            .includes(text) ||

          match.away
            .toLowerCase()
            .includes(text) ||

          match.league
            .toLowerCase()
            .includes(text) ||

          match.country
            .toLowerCase()
            .includes(text)
        );
      }
    );

  setSectionTitle(
    `Arama: ${query}`
  );

  renderFixtures(
    filtered
  );
}

/* =========================================================
   MENU FILTER
   ========================================================= */

function applyFilter(filter) {
  let filtered =
    [...allFixtures];

  let title =
    "Bugünün Maçları";

  switch (filter) {

    case "favorites":
      filtered =
        allFixtures.filter(
          raw => {
            const match =
              normalizeFixture(raw);

            return favorites.includes(
              String(match.id)
            );
          }
        );

      title = "Favoriler";
      break;

    case "search":
      title = "Maç Ara";

      $("#searchInput")?.focus();
      break;

    case "analysis":
      title = "Maç Analizi";
      break;

    case "reliable":
      title =
        "Güvenilir Seçimler";
      break;

    case "medium":
      title = "Orta Riskli";
      break;

    case "risky":
      title =
        "Riskli Seçimler";
      break;

    case "high":
      title =
        "Yüksek Oran Fırsatları";
      break;

    case "iy2y":
      title =
        "İY / 2Y KG";
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
        "Tahmini Skorlar";
      break;

    case "stats":
      title =
        "İstatistikler";
      break;

    case "all":
    default:
      title =
        "Bugünün Maçları";
      break;
  }

  setSectionTitle(title);

  /*
    Arama menüsünde maçları
    gizlemiyoruz.
  */

  if (filter === "search") {
    renderFixtures(
      allFixtures
    );
    return;
  }

  renderFixtures(
    filtered
  );
}

/* =========================================================
   SECTION TITLE
   ========================================================= */

function setSectionTitle(title) {
  const element =
    $("#sectionTitle");

  if (element) {
    element.textContent =
      title;
  }
}

/* =========================================================
   MENU
   ========================================================= */

function setupMenu() {
  document
    .querySelectorAll(
      ".menu-item[data-filter]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".menu-item"
            )
            .forEach(item => {
              item.classList.remove(
                "active"
              );
            });

          button.classList.add(
            "active"
          );

          applyFilter(
            button.dataset.filter
          );
        }
      );

    });
}

/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupMenu();

    const search =
      $("#searchInput");

    if (search) {
      search.addEventListener(
        "input",
        event => {
          searchMatches(
            event.target.value
          );
        }
      );
    }

    const overlay =
      $(".drawer-overlay");

    if (overlay) {
      overlay.addEventListener(
        "click",
        closeDrawer
      );
    }

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

    loadFixtures();
  }
);

/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.loadFixtures =
  loadFixtures;

window.openMatch =
  openMatch;

window.closeDrawer =
  closeDrawer;

window.closeAnalysis =
  closeAnalysis;

window.searchMatches =
  searchMatches;
