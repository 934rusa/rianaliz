/* =========================================================
   R❤️İ FOOTBALL
   Futbol Analiz Merkezi
   APP.JS v3.1
   ========================================================= */

const API_BASE = "/api";

let allFixtures = [];
let favorites = JSON.parse(localStorage.getItem("ri_favorites") || "[]");

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function pct(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function average(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`API hatası: ${response.status}`);
  }

  return response.json();
}

/* =========================================================
   FIXTURE NORMALIZER
   ========================================================= */

function normalizeFixture(item) {
  const fixture = item?.fixture || item || {};
  const teams = item?.teams || {};

  return {
    id: fixture.id || item?.id,

    date: fixture.date || item?.date || null,

    status:
      fixture.status?.short ||
      item?.status?.short ||
      "",

    country:
      item?.league?.country ||
      fixture?.league?.country ||
      "Diğer",

    league:
      item?.league?.name ||
      fixture?.league?.name ||
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
      teams?.home?.logo || "",

    awayLogo:
      teams?.away?.logo || ""
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

  setApiStatus("● API BAĞLANIYOR...", false);

  try {

    const data =
      await api("/fixtures?date=today");

    if (Array.isArray(data)) {
      allFixtures = data;
    } else if (Array.isArray(data?.response)) {
      allFixtures = data.response;
    } else if (Array.isArray(data?.fixtures)) {
      allFixtures = data.fixtures;
    } else {
      allFixtures = [];
    }

    setApiStatus("● API-Football BAĞLI", true);

    updateCount(allFixtures.length);

    renderFixtures(allFixtures);

  } catch (error) {

    console.error(error);

    setApiStatus("● API HATASI", false);

    if (container) {
      container.innerHTML = `
        <div class="empty">
          ❌ Maçlar alınamadı.
          <br>
          <small>${esc(error.message)}</small>
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

  if (!status) return;

  status.textContent = text;

  status.classList.toggle("online", !!online);
}

/* =========================================================
   COUNT
   ========================================================= */

function updateCount(count) {

  const el = $("#matchCount");

  if (el) {
    el.textContent = count;
  }
}

/* =========================================================
   MATCH CARDS
   ========================================================= */

function renderFixtures(fixtures) {

  const container = $("#matches");

  if (!container) return;

  updateCount(fixtures.length);

  if (!fixtures.length) {

    container.innerHTML = `
      <div class="empty">
        Maç bulunamadı.
      </div>
    `;

    return;
  }

  container.innerHTML =
    fixtures.map(raw => {

      const match =
        normalizeFixture(raw);

      const isFavorite =
        favorites.includes(String(match.id));

      let time = "";

      if (match.date) {

        const date =
          new Date(match.date);

        time =
          date.toLocaleTimeString(
            "tr-TR",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          );
      }

      return `

        <article
          class="match-card"
          data-id="${esc(match.id)}"
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
                  ? `<img
                      src="${esc(match.homeLogo)}"
                      alt=""
                      loading="lazy"
                    >`
                  : `<div class="team-logo-placeholder">⚽</div>`
              }

              <span>
                ${esc(match.home)}
              </span>

            </div>

            <div class="match-vs">

              <small>${esc(time)}</small>

              <strong>VS</strong>

            </div>

            <div class="team">

              ${
                match.awayLogo
                  ? `<img
                      src="${esc(match.awayLogo)}"
                      alt=""
                      loading="lazy"
                    >`
                  : `<div class="team-logo-placeholder">⚽</div>`
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
              class="favorite-btn ${isFavorite ? "is-favorite" : ""}"
              data-favorite="${esc(match.id)}"
              type="button"
            >
              ${isFavorite ? "♥" : "♡"}
            </button>

          </div>

        </article>

      `;

    }).join("");

  attachMatchEvents();
}

/* =========================================================
   MATCH EVENTS
   ========================================================= */

function attachMatchEvents() {

  document
    .querySelectorAll(".match-card")
    .forEach(card => {

      card.addEventListener("click", event => {

        if (
          event.target.closest(".favorite-btn")
        ) {
          return;
        }

        openMatch(card.dataset.id);
      });
    });

  document
    .querySelectorAll(".favorite-btn")
    .forEach(button => {

      button.addEventListener("click", event => {

        event.stopPropagation();

        toggleFavorite(
          button.dataset.favorite
        );
      });
    });
}

/* =========================================================
   FAVORITES
   ========================================================= */

function toggleFavorite(id) {

  id = String(id);

  if (favorites.includes(id)) {

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

  renderFixtures(allFixtures);
}

/* =========================================================
   OPEN DRAWER
   ========================================================= */

async function openMatch(id) {

  const drawer =
    $("#analysisDrawer");

  if (!drawer) {
    console.error(
      "analysisDrawer bulunamadı."
    );
    return;
  }

  drawer.classList.add("open");
  document.body.classList.add("drawer-open");

  drawer.innerHTML = `

    <div class="analysis-loading">

      <div class="spinner"></div>

      <h2>
        ⚽ Maç analiz ediliyor...
      </h2>

      <p>
        Form, gol verileri, H2H,
        takım istatistikleri ve mevcut
        veriler hesaplanıyor.
      </p>

    </div>

  `;

  try {

    const data =
      await api(
        `/match?fixture=${encodeURIComponent(id)}`
      );

    const analysis =
      calculateDecision(data);

    renderAnalysis(
      data,
      analysis
    );

  } catch (error) {

    console.error(error);

    drawer.innerHTML = `

      <div class="analysis-error">

        <button
          class="close-analysis"
          onclick="closeDrawer()"
          type="button"
        >
          ✕
        </button>

        <h2>
          ❌ Analiz alınamadı
        </h2>

        <p>
          Maç verileri getirilemedi.
        </p>

        <small>
          ${esc(error.message)}
        </small>

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

  if (!drawer) return;

  drawer.classList.remove("open");

  document.body.classList.remove(
    "drawer-open"
  );
}

/* Eski fonksiyon adı için uyumluluk */
function closeAnalysis() {
  closeDrawer();
}

/* =========================================================
   FORM DATA
   ========================================================= */

function getForm(data, side) {

  const form =
    data?.analysis_data?.form?.[side] || {};

  return {

    played:
      Number(form.played || 0),

    wins:
      Number(form.wins || 0),

    draws:
      Number(form.draws || 0),

    losses:
      Number(form.losses || 0),

    avgFor:
      Number(
        form.avgFor ??
        form.avg_for ??
        0
      ),

    avgAgainst:
      Number(
        form.avgAgainst ??
        form.avg_against ??
        0
      ),

    btts:
      Number(form.btts || 0),

    over25:
      Number(
        form.over25 ??
        form.over_25 ??
        0
      )
  };
}

/* =========================================================
   EXPECTED GOALS
   ========================================================= */

function calculateXG(home, away) {

  let homeXG =
    (home.avgFor + away.avgAgainst) / 2;

  let awayXG =
    (away.avgFor + home.avgAgainst) / 2;

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

  /* Ev sahibi avantajı */
  homeXG *= 1.08;

  return {

    home:
      clamp(
        homeXG,
        0.15,
        4.5
      ),

    away:
      clamp(
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
   MARKETS
   ========================================================= */

function calculateMarkets(
  homeXG,
  awayXG
) {

  const maxGoals = 7;

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  let btts = 0;

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
        poisson(homeXG, home) *
        poisson(awayXG, away);

      matrix[home][away] =
        probability;

      if (home > away)
        homeWin += probability;

      if (home === away)
        draw += probability;

      if (home < away)
        awayWin += probability;

      if (home + away >= 2)
        over15 += probability;

      if (home + away >= 3)
        over25 += probability;

      if (home + away >= 4)
        over35 += probability;

      if (
        home >= 1 &&
        away >= 1
      ) {
        btts += probability;
      }
    }
  }

  return {

    homeWin: homeWin * 100,

    draw: draw * 100,

    awayWin: awayWin * 100,

    over15: over15 * 100,

    over25: over25 * 100,

    over35: over35 * 100,

    btts: btts * 100,

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

  for (
    let home = 0;
    home < matrix.length;
    home++
  ) {

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
    home.played
      ? home.wins / home.played * 100
      : 50;

  const awayWinRate =
    away.played
      ? away.wins / away.played * 100
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

  /*
   Her market için model skoru.
   Sadece en yüksek yüzdeyi seçmiyoruz.
  */

  const candidates = [

    {
      key: "MS1",
      label: "MS 1",
      probability: markets.homeWin,
      reliability: 0.86,

      support:
        (
          homeWinRate * 0.55 +
          homeGoalStrength * 0.25 +
          awayDefenseWeakness * 0.20
        )
    },

    {
      key: "MSX",
      label: "MS X",
      probability: markets.draw,
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
      probability: markets.awayWin,
      reliability: 0.84,

      support:
        (
          awayWinRate * 0.55 +
          awayGoalStrength * 0.25 +
          homeDefenseWeakness * 0.20
        )
    },

    {
      key: "KG",
      label: "KG Var",
      probability: markets.btts,
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
      probability: markets.over15,
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
      probability: markets.over25,
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
      probability: markets.over35,
      reliability: 0.75,

      support:
        (
          home.over25 +
          away.over25
        ) / 2
    }

  ];

  /*
   Çok düşük ihtimalli seçenekleri
   ana öneriden çıkar.
  */

  const validCandidates =
    candidates.filter(
      c => c.probability >= 55
    );

  const pool =
    validCandidates.length
      ? validCandidates
      : candidates;

  pool.forEach(candidate => {

    candidate.decisionScore =

      candidate.probability * 0.65 +

      clamp(
        candidate.support,
        0,
        100
      ) * 0.20 +

      candidate.reliability *
      100 *
      0.15;

  });

  pool.sort(
    (a, b) =>
      b.decisionScore -
      a.decisionScore
  );

  const best =
    pool[0];

  let confidence =
    clamp(
      best.probability,
      0,
      99
    );

  let risk;
  let category;

  if (confidence >= 78) {

    risk = "Düşük";
    category = "Güvenilir Seçim";

  } else if (confidence >= 68) {

    risk = "Orta";
    category = "Orta Riskli";

  } else if (confidence >= 58) {

    risk = "Yüksek";
    category = "Riskli Seçim";

  } else {

    risk = "Çok Yüksek";
    category = "Yüksek Oran Fırsatı";
  }

  const score =
    predictedScore(
      markets.matrix
    );

  /* =====================================================
     REASONING
  ===================================================== */

  const reasons = [];

  if (best.key === "MS1") {

    if (homeWinRate > awayWinRate) {

      reasons.push(
        `Ev sahibinin galibiyet oranı daha yüksek (${Math.round(homeWinRate)}% - ${Math.round(awayWinRate)}%).`
      );
    }

    if (xg.home > xg.away) {

      reasons.push(
        `Model ev sahibini xG açısından önde görüyor (${xg.home.toFixed(2)} - ${xg.away.toFixed(2)}).`
      );
    }

    if (awayDefenseWeakness > 50) {

      reasons.push(
        `Deplasman ekibinin gol yeme eğilimi MS 1 seçimini destekliyor.`
      );
    }
  }

  if (best.key === "MS2") {

    if (awayWinRate > homeWinRate) {

      reasons.push(
        `Deplasman ekibinin galibiyet oranı daha yüksek (${Math.round(awayWinRate)}% - ${Math.round(homeWinRate)}%).`
      );
    }

    if (xg.away > xg.home) {

      reasons.push(
        `Model deplasman ekibini xG açısından önde görüyor (${xg.away.toFixed(2)} - ${xg.home.toFixed(2)}).`
      );
    }

    if (homeDefenseWeakness > 50) {

      reasons.push(
        `Ev sahibinin gol yeme eğilimi deplasman seçimini destekliyor.`
      );
    }
  }

  if (best.key === "KG") {

    reasons.push(
      `İki takımın BTTS verileri KG Var seçeneğini destekliyor.`
    );

    reasons.push(
      `Model iki takımın da gol bulma ihtimalini birlikte değerlendiriyor.`
    );
  }

  if (best.key === "O15") {

    reasons.push(
      `Toplam gol modeli 1.5 Üst seçeneğinde yüksek olasılık gösteriyor.`
    );
  }

  if (best.key === "O25") {

    reasons.push(
      `Takımların gol üretimi ve 2.5 üst geçmişi bu seçeneği destekliyor.`
    );
  }

  if (best.key === "O35") {

    reasons.push(
      `Model yüksek toplam gol senaryosunu değerlendiriyor.`
    );
  }

  if (!reasons.length) {

    reasons.push(
      "Mevcut form ve gol verileri birlikte değerlendirilerek seçim oluşturuldu."
    );
  }

  /*
   Form özeti.
  */

  if (
    home.avgFor > 0 ||
    away.avgFor > 0
  ) {

    reasons.push(
      `Ortalama gol verileri: ${home.avgFor.toFixed(2)} - ${away.avgFor.toFixed(2)}.`
    );
  }

  const alternatives =
    pool
      .filter(
        c => c.key !== best.key
      )
      .slice(0, 4)
      .map(c => ({

        label: c.label,

        probability:
          c.probability,

        risk:
          c.probability >= 78
            ? "Düşük"
            : c.probability >= 68
              ? "Orta"
              : c.probability >= 58
                ? "Yüksek"
                : "Çok Yüksek"

      }));

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

    reasons,

    alternatives
  };
}

/* =========================================================
   RENDER ANALYSIS
========================================================= */

function renderAnalysis(data, analysis) {

  const drawer =
    $("#analysisDrawer");

  if (!drawer) return;

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
    analysis.best;

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

          ${analysis.reasons
            .map(reason => `

              <div class="reason">
                <span>✓</span>
                <p>${esc(reason)}</p>
              </div>

            `)
            .join("")}

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
            ${analysis.xg.home.toFixed(2)}
          </strong>

        </div>

        <div>

          <small>
            DEP xG
          </small>

          <strong>
            ${analysis.xg.away.toFixed(2)}
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

          ${analysis.alternatives
            .map(option => `

              <div class="alternative">

                <strong>
                  ${esc(option.label)}
                </strong>

                <span>
                  ${pct(option.probability)}
                </span>

                <small>
                  ${esc(option.risk)} Risk
                </small>

              </div>

            `)
            .join("")}

        </div>

      </section>


      <!-- =========================================
           MODEL
      ========================================== -->

      <section class="analysis-section">

        <h2>
          📊 MODEL
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

        ⚠️ Model sonucu olasılık temellidir.
        Hiçbir maç veya bahis sonucu garanti değildir.

      </div>

    </div>

  `;
}

/* =========================================================
   MARKET ROW
========================================================= */

function marketRow(label, value) {

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

  if (!status) return "";

  const items = [];

  Object.entries(status)
    .forEach(([key, value]) => {

      const label =
        key
          .replaceAll("_", " ")
          .toUpperCase();

      items.push(`

        <span>
          ${value ? "✓" : "—"}
          ${esc(label)}
        </span>

      `);
    });

  if (!items.length) return "";

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

    renderFixtures(allFixtures);

    setSectionTitle(
      "Bugünün Maçları"
    );

    return;
  }

  const filtered =
    allFixtures.filter(raw => {

      const match =
        normalizeFixture(raw);

      return (

        match.home
          .toLowerCase()
          .includes(text)

        ||

        match.away
          .toLowerCase()
          .includes(text)

        ||

        match.league
          .toLowerCase()
          .includes(text)

        ||

        match.country
          .toLowerCase()
          .includes(text)

      );
    });

  setSectionTitle(
    `Arama: ${query}`
  );

  renderFixtures(filtered);
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
        allFixtures.filter(raw => {

          const match =
            normalizeFixture(raw);

          return favorites.includes(
            String(match.id)
          );
        });

      title =
        "Favoriler";

      break;


    case "search":

      $("#searchInput")?.focus();

      title =
        "Maç Ara";

      break;


    case "all":

      title =
        "Bugünün Maçları";

      break;


    case "analysis":

      title =
        "Maç Analizi";

      break;


    case "reliable":

      title =
        "Güvenilir Seçimler";

      break;


    case "medium":

      title =
        "Orta Riskli";

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

  }

  setSectionTitle(title);

  renderFixtures(filtered);
}

/* =========================================================
   SECTION TITLE
========================================================= */

function setSectionTitle(title) {

  const element =
    $("#sectionTitle");

  if (element) {
    element.textContent = title;
  }
}

/* =========================================================
   MENU SETUP
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
            .forEach(item =>
              item.classList.remove(
                "active"
              )
            );

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

    loadFixtures();

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

    /*
      Overlay tıklaması
    */

    const overlay =
      $(".drawer-overlay");

    if (overlay) {

      overlay.addEventListener(
        "click",
        closeDrawer
      );
    }

    /*
      ESC ile kapat
    */

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape"
        ) {
          closeDrawer();
        }

      }
    );

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
