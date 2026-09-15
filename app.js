// R❤️İ FOOTBALL — ANALİZ MOTORU v5.0

const matchesEl = document.getElementById("matches");
const matchCountEl = document.getElementById("matchCount");
const sectionTitleEl = document.getElementById("sectionTitle");
const resultInfoEl = document.getElementById("resultInfo");
const searchInput = document.getElementById("searchInput");
const apiStatusEl = document.getElementById("apiStatus");
const drawer = document.getElementById("analysisDrawer");

let allMatches = [];
let currentFilter = "all";
let favorites = JSON.parse(localStorage.getItem("ri_favorites") || "[]");

function turkeyDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul"
  }).format(new Date());
}

async function loadFixtures() {
  try {
    apiStatusEl.textContent = "● API BAĞLANIYOR...";
    matchesEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Maçlar yükleniyor...</p>
      </div>
    `;

    const date = turkeyDate();

    const response = await fetch(
      `/api/fixtures?date=${encodeURIComponent(date)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    allMatches = normalizeFixtures(data);

    apiStatusEl.textContent = "● API BAĞLI";
    matchCountEl.textContent = allMatches.length;

    renderMatches();

  } catch (error) {
    console.error(error);

    apiStatusEl.textContent = "● API HATASI";

    matchesEl.innerHTML = `
      <div class="empty-state">
        <h3>Maçlar yüklenemedi</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function normalizeFixtures(data) {
  let list = [];

  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data?.response)) list = data.response;
  else if (Array.isArray(data?.fixtures)) list = data.fixtures;
  else if (Array.isArray(data?.data)) list = data.data;

  return list
    .map(item => {
      const fixture = item.fixture || item;
      const teams = item.teams || {};

      return {
        id: fixture.id || item.id,

        date: fixture.date || item.date || null,

        status:
          fixture.status ||
          item.status ||
          { short: "NS", long: "Scheduled" },

        venue: fixture.venue || null,

        referee: fixture.referee || null,

        league:
          item.league || {
            id: null,
            name: "Bilinmeyen Lig",
            country: "",
            logo: ""
          },

        home:
          teams.home || {
            id: item.home?.id,
            name: item.home?.name || "Ev Sahibi",
            logo: item.home?.logo || ""
          },

        away:
          teams.away || {
            id: item.away?.id,
            name: item.away?.name || "Deplasman",
            logo: item.away?.logo || ""
          },

        goals: item.goals || {
          home: null,
          away: null
        },

        raw: item
      };
    })
    .filter(x => x.id && x.home?.name && x.away?.name);
}

function renderMatches() {
  const query = (searchInput?.value || "").trim().toLowerCase();

  let list = allMatches.filter(match => {
    const text = `
      ${match.home.name}
      ${match.away.name}
      ${match.league?.name || ""}
      ${match.league?.country || ""}
    `.toLowerCase();

    return !query || text.includes(query);
  });

  list = applyFilter(list);

  resultInfoEl.textContent = `${list.length} maç`;

  if (!list.length) {
    matchesEl.innerHTML = `
      <div class="empty-state">
        <h3>Maç bulunamadı</h3>
        <p>Bu filtreye uygun maç bulunmuyor.</p>
      </div>
    `;
    return;
  }

  matchesEl.innerHTML = list.map(renderMatchCard).join("");
}

function renderMatchCard(match) {
  const time = formatTime(match.date);
  const favorite = favorites.includes(String(match.id));

  return `
    <article class="match-card" onclick="openMatch(${Number(match.id)})">

      <div class="match-card-top">
        <div class="league-info">
          ${
            match.league?.logo
              ? `<img src="${escapeAttr(match.league.logo)}" alt="">`
              : "🏆"
          }
          <span>
            ${escapeHtml(match.league?.country || "")}
            ${match.league?.country ? " • " : ""}
            ${escapeHtml(match.league?.name || "Lig")}
          </span>
        </div>

        <button
          class="favorite-btn"
          onclick="event.stopPropagation(); toggleFavorite('${String(match.id)}')"
        >
          ${favorite ? "❤️" : "♡"}
        </button>
      </div>

      <div class="match-time">
        ${time}
      </div>

      <div class="teams">

        <div class="team">
          ${
            match.home.logo
              ? `<img src="${escapeAttr(match.home.logo)}" alt="">`
              : `<div class="team-placeholder">⚽</div>`
          }
          <strong>${escapeHtml(match.home.name)}</strong>
        </div>

        <div class="vs">VS</div>

        <div class="team">
          ${
            match.away.logo
              ? `<img src="${escapeAttr(match.away.logo)}" alt="">`
              : `<div class="team-placeholder">⚽</div>`
          }
          <strong>${escapeHtml(match.away.name)}</strong>
        </div>

      </div>

      <div class="match-card-footer">
        <span>📊 Analiz için tıkla</span>
        <span>→</span>
      </div>

    </article>
  `;
}

function applyFilter(list) {
  if (currentFilter === "all") return list;

  if (currentFilter === "search") return list;

  if (currentFilter === "favorites") {
    return list.filter(m => favorites.includes(String(m.id)));
  }

  /*
   * Bu kategoriler maç detayındaki gerçek analiz
   * açıldığında hesaplanır. Liste seviyesinde API'ye
   * yüzlerce istek atmamak için burada maçları gizlemiyoruz.
   */
  if (
    [
      "reliable",
      "medium",
      "risky",
      "high",
      "iy2y",
      "first-half",
      "second-half",
      "score",
      "stats",
      "analysis"
    ].includes(currentFilter)
  ) {
    return list;
  }

  return list;
}

function setFilter(filter) {
  currentFilter = filter;

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

  sectionTitleEl.textContent =
    titles[filter] || "Bugünün Maçları";

  document
    .querySelectorAll(".menu-item")
    .forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.filter === filter
      );
    });

  renderMatches();
}

async function openMatch(fixtureId) {
  drawer.innerHTML = `
    <div class="analysis-loading">
      <div class="spinner"></div>
      <h3>Maç analiz ediliyor...</h3>
      <p>Form, H2H, puan durumu, kadro, sakatlıklar ve diğer veriler hesaplanıyor.</p>
    </div>
  `;

  drawer.classList.add("open");

  document.body.classList.add("drawer-open");

  try {
    const response = await fetch(
      `/api/match?fixture=${encodeURIComponent(fixtureId)}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data?.error || `HTTP ${response.status}`
      );
    }

    renderAnalysis(data);

  } catch (error) {
    console.error(error);

    drawer.innerHTML = `
      <div class="analysis-error">
        <button class="close-analysis" onclick="closeDrawer()">×</button>
        <h2>Analiz alınamadı</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function renderAnalysis(data) {
  const home = data.teams?.home || {};
  const away = data.teams?.away || {};

  const decision = calculateDecision(data);

  const homeForm = analyzeForm(
    data.analysis_data?.form?.home || [],
    home.id
  );

  const awayForm = analyzeForm(
    data.analysis_data?.form?.away || [],
    away.id
  );

  const h2h = analyzeH2H(
    data.analysis_data?.h2h || [],
    home.id,
    away.id
  );

  const coverage = calculateCoverage(
    data.data_status || {}
  );

  const favorite = favorites.includes(
    String(data.fixture?.id)
  );

  drawer.innerHTML = `
    <div class="analysis-panel">

      <button class="close-analysis" onclick="closeDrawer()">×</button>

      <div class="analysis-header">

        <div class="analysis-league">
          ${escapeHtml(data.league?.country || "")}
          ${data.league?.country ? " • " : ""}
          ${escapeHtml(data.league?.name || "")}
        </div>

        <div class="analysis-teams">

          <div>
            ${
              home.logo
                ? `<img src="${escapeAttr(home.logo)}" alt="">`
                : "⚽"
            }
            <h2>${escapeHtml(home.name || "Ev Sahibi")}</h2>
          </div>

          <span>VS</span>

          <div>
            ${
              away.logo
                ? `<img src="${escapeAttr(away.logo)}" alt="">`
                : "⚽"
            }
            <h2>${escapeHtml(away.name || "Deplasman")}</h2>
          </div>

        </div>

        <div class="analysis-date">
          ${formatDate(data.fixture?.date)}
        </div>

      </div>

      <section class="play-box">

        <div class="play-label">
          🎯 ANA MODEL SEÇİMİ
        </div>

        <div class="play-title">
          ŞUNU OYNA: ${escapeHtml(decision.market)}
        </div>

        <div class="play-confidence">
          Model olasılığı: <strong>${decision.probability}%</strong>
          &nbsp; • &nbsp;
          Risk: <strong>${escapeHtml(decision.risk)}</strong>
        </div>

        <div class="play-reasons">
          ${decision.reasons
            .map(r => `<div>✓ ${escapeHtml(r)}</div>`)
            .join("")}
        </div>

      </section>

      <section class="analysis-section">

        <h3>🎯 Model Özeti</h3>

        <div class="model-grid">

          <div>
            <span>MS 1</span>
            <strong>${decision.probs.home}%</strong>
          </div>

          <div>
            <span>Beraberlik</span>
            <strong>${decision.probs.draw}%</strong>
          </div>

          <div>
            <span>MS 2</span>
            <strong>${decision.probs.away}%</strong>
          </div>

          <div>
            <span>KG Var</span>
            <strong>${decision.probs.btts}%</strong>
          </div>

          <div>
            <span>2.5 Üst</span>
            <strong>${decision.probs.over25}%</strong>
          </div>

          <div>
            <span>1.5 Üst</span>
            <strong>${decision.probs.over15}%</strong>
          </div>

        </div>

      </section>

      <section class="analysis-section">

        <h3>📈 Form</h3>

        <div class="form-columns">

          <div class="form-team">
            <h4>${escapeHtml(home.name || "Ev")}</h4>

            <p>
              Son maç:
              <strong>${homeForm.wins}G ${homeForm.draws}B ${homeForm.losses}M</strong>
            </p>

            <p>
              Gol:
              <strong>${homeForm.scoredAvg} / ${homeForm.concededAvg}</strong>
            </p>

            <p>
              KG:
              <strong>${homeForm.bttsRate}%</strong>
            </p>
          </div>

          <div class="form-team">
            <h4>${escapeHtml(away.name || "Deplasman")}</h4>

            <p>
              Son maç:
              <strong>${awayForm.wins}G ${awayForm.draws}B ${awayForm.losses}M</strong>
            </p>

            <p>
              Gol:
              <strong>${awayForm.scoredAvg} / ${awayForm.concededAvg}</strong>
            </p>

            <p>
              KG:
              <strong>${awayForm.bttsRate}%</strong>
            </p>
          </div>

        </div>

      </section>

      <section class="analysis-section">

        <h3>⚔️ H2H</h3>

        <p>
          Son ${h2h.total} karşılaşma:
          <strong>
            ${h2h.homeWins} ev sahibi galibiyeti /
            ${h2h.draws} beraberlik /
            ${h2h.awayWins} deplasman galibiyeti
          </strong>
        </p>

      </section>

      <section class="analysis-section">

        <h3>📊 Veri Durumu</h3>

        <div class="data-status">
          ${renderDataStatus(data.data_status || {})}
        </div>

        <p class="coverage">
          Analiz veri kapsamı: <strong>${coverage}%</strong>
        </p>

      </section>

      <section class="analysis-section">

        <h3>🔢 Tahmini Skor</h3>

        <div class="predicted-score">
          ${decision.score}
        </div>

        <p>
          Tahmini toplam gol:
          <strong>${decision.totalGoals}</strong>
        </p>

      </section>

      <div class="analysis-actions">

        <button onclick="toggleFavorite('${String(data.fixture?.id)}')">
          ${favorite ? "❤️ Favoriden Çıkar" : "♡ Favoriye Ekle"}
        </button>

      </div>

    </div>
  `;
}

function calculateDecision(data) {
  const homeId = data.teams?.home?.id;
  const awayId = data.teams?.away?.id;

  const homeForm = analyzeForm(
    data.analysis_data?.form?.home || [],
    homeId
  );

  const awayForm = analyzeForm(
    data.analysis_data?.form?.away || [],
    awayId
  );

  const h2h = analyzeH2H(
    data.analysis_data?.h2h || [],
    homeId,
    awayId
  );

  const apiPrediction =
    data.analysis_data?.api_prediction?.[0] || null;

  const homeXg = clamp(
    homeForm.scoredAvg * 0.62 +
    awayForm.concededAvg * 0.38 +
    0.25,
    0.15,
    4
  );

  const awayXg = clamp(
    awayForm.scoredAvg * 0.62 +
    homeForm.concededAvg * 0.38,
    0.10,
    3.5
  );

  const probs = calculateProbabilities(
    homeXg,
    awayXg,
    homeForm,
    awayForm,
    h2h,
    apiPrediction
  );

  const markets = [
    {
      name: "MS 1",
      probability: probs.home,
      strength:
        probs.home >= 62
          ? 1.15
          : probs.home >= 55
          ? 1
          : 0.75
    },
    {
      name: "MS 2",
      probability: probs.away,
      strength:
        probs.away >= 62
          ? 1.15
          : probs.away >= 55
          ? 1
          : 0.75
    },
    {
      name: "KG VAR",
      probability: probs.btts,
      strength:
        probs.btts >= 62
          ? 1.05
          : 0.8
    },
    {
      name: "2.5 ÜST",
      probability: probs.over25,
      strength:
        probs.over25 >= 65
          ? 1.05
          : 0.8
    },
    {
      name: "1.5 ÜST",
      probability: probs.over15,
      strength: 0.45
    }
  ];

  /*
   * 1.5 üst çok yüksek çıkabildiği için ana seçimde
   * otomatik olarak öne geçmesini engelliyoruz.
   */

  const eligible = markets.filter(m => {
    if (m.name === "MS 1" || m.name === "MS 2") {
      return m.probability >= 54;
    }

    if (m.name === "KG VAR") {
      return m.probability >= 58;
    }

    if (m.name === "2.5 ÜST") {
      return m.probability >= 60;
    }

    return m.probability >= 72;
  });

  let best = eligible.sort(
    (a, b) =>
      b.probability * b.strength -
      a.probability * a.strength
  )[0];

  if (!best) {
    best = markets
      .filter(m => m.name !== "1.5 ÜST")
      .sort((a, b) => b.probability - a.probability)[0];
  }

  const maxProb = best?.probability || 0;

  let risk = "Yüksek";

  if (maxProb >= 72) risk = "Düşük";
  else if (maxProb >= 64) risk = "Orta";
  else if (maxProb >= 56) risk = "Orta-Yüksek";

  const scoreHome = poissonMostLikely(homeXg);
  const scoreAway = poissonMostLikely(awayXg);

  const reasons = [];

  if (homeForm.rating > awayForm.rating + 8) {
    reasons.push(
      `${data.teams?.home?.name || "Ev sahibi"} son formda daha güçlü.`
    );
  } else if (awayForm.rating > homeForm.rating + 8) {
    reasons.push(
      `${data.teams?.away?.name || "Deplasman"} son formda daha güçlü.`
    );
  } else {
    reasons.push("Son form verileri birbirine yakın.");
  }

  if (homeForm.scoredAvg > 1.4) {
    reasons.push("Ev sahibinin son maçlardaki gol üretimi güçlü.");
  }

  if (awayForm.scoredAvg > 1.4) {
    reasons.push("Deplasman ekibinin gol üretimi dikkat çekiyor.");
  }

  if (homeForm.concededAvg > 1.4) {
    reasons.push("Ev sahibinin savunmada gol yeme eğilimi yüksek.");
  }

  if (awayForm.concededAvg > 1.4) {
    reasons.push("Deplasman ekibinin savunmada açık verme eğilimi var.");
  }

  if (h2h.total >= 3) {
    reasons.push(
      `H2H verisinde ${h2h.total} geçmiş karşılaşma değerlendirildi.`
    );
  }

  const coverage = calculateCoverage(
    data.data_status || {}
  );

  if (coverage >= 80) {
    reasons.push("Analizde geniş veri kapsamı mevcut.");
  } else if (coverage >= 50) {
    reasons.push("Analiz orta seviyede veri kapsamıyla oluşturuldu.");
  } else {
    reasons.push("Bazı veri kaynakları mevcut olmadığı için güven düşürüldü.");
  }

  return {
    market: best?.name || "MS 1X2",
    probability: Math.round(maxProb),
    risk,
    reasons: reasons.slice(0, 5),
    score: `${scoreHome}-${scoreAway}`,
    totalGoals: (homeXg + awayXg).toFixed(2),

    probs: {
      home: Math.round(probs.home),
      draw: Math.round(probs.draw),
      away: Math.round(probs.away),
      btts: Math.round(probs.btts),
      over15: Math.round(probs.over15),
      over25: Math.round(probs.over25)
    }
  };
}

function calculateProbabilities(
  homeXg,
  awayXg,
  homeForm,
  awayForm,
  h2h,
  apiPrediction
) {
  const maxGoals = 7;

  let home = 0;
  let draw = 0;
  let away = 0;
  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  const hp = [];
  const ap = [];

  for (let i = 0; i <= maxGoals; i++) {
    hp[i] = poisson(i, homeXg);
    ap[i] = poisson(i, awayXg);
  }

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = hp[h] * ap[a];

      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;

      if (h + a >= 2) over15 += p;
      if (h + a >= 3) over25 += p;
      if (h > 0 && a > 0) btts += p;
    }
  }

  /*
   * Form sinyali
   */
  const formDiff =
    homeForm.rating -
    awayForm.rating;

  home += clamp(formDiff / 100, -0.06, 0.06);
  away -= clamp(formDiff / 100, -0.06, 0.06);

  /*
   * H2H sadece küçük destek olarak kullanılır.
   */
  if (h2h.total >= 4) {
    const h2hDiff =
      (h2h.homeWins - h2h.awayWins) /
      h2h.total;

    home += clamp(h2hDiff * 0.04, -0.04, 0.04);
    away -= clamp(h2hDiff * 0.04, -0.04, 0.04);
  }

  /*
   * API prediction varsa küçük ağırlık.
   */
  const apiWinner =
    apiPrediction?.predictions?.winner?.name;

  if (apiWinner) {
    const homeName =
      apiPrediction?.teams?.home?.name;

    const awayName =
      apiPrediction?.teams?.away?.name;

    if (
      homeName &&
      apiWinner === homeName
    ) {
      home += 0.025;
    }

    if (
      awayName &&
      apiWinner === awayName
    ) {
      away += 0.025;
    }
  }

  const total = home + draw + away;

  home /= total;
  draw /= total;
  away /= total;

  return {
    home: clamp(home * 100, 1, 98),
    draw: clamp(draw * 100, 1, 98),
    away: clamp(away * 100, 1, 98),
    btts: clamp(btts * 100, 1, 99),
    over15: clamp(over15 * 100, 1, 99),
    over25: clamp(over25 * 100, 1, 99)
  };
}

function analyzeForm(fixtures, teamId) {
  const games = Array.isArray(fixtures)
    ? fixtures.slice(0, 15)
    : [];

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let scored = 0;
  let conceded = 0;
  let btts = 0;

  let valid = 0;

  for (const game of games) {
    const homeId = game.teams?.home?.id;
    const awayId = game.teams?.away?.id;

    if (
      homeId !== teamId &&
      awayId !== teamId
    ) continue;

    const hg = game.goals?.home;
    const ag = game.goals?.away;

    if (
      typeof hg !== "number" ||
      typeof ag !== "number"
    ) continue;

    valid++;

    const isHome = homeId === teamId;

    const gf = isHome ? hg : ag;
    const ga = isHome ? ag : hg;

    scored += gf;
    conceded += ga;

    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;

    if (gf > 0 && ga > 0) {
      btts++;
    }
  }

  const scoredAvg =
    valid ? scored / valid : 1;

  const concededAvg =
    valid ? conceded / valid : 1;

  const winRate =
    valid ? wins / valid : 0.33;

  const bttsRate =
    valid ? (btts / valid) * 100 : 50;

  const rating =
    winRate * 65 +
    clamp(scoredAvg / 3, 0, 1) * 20 +
    clamp((2.5 - concededAvg) / 2.5, 0, 1) * 15;

  return {
    total: valid,
    wins,
    draws,
    losses,
    scored,
    conceded,
    scoredAvg: scoredAvg.toFixed(2),
    concededAvg: concededAvg.toFixed(2),
    bttsRate: Math.round(bttsRate),
    rating
  };
}

function analyzeH2H(games, homeId, awayId) {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let total = 0;

  for (const game of games) {
    const hg = game.goals?.home;
    const ag = game.goals?.away;

    if (
      typeof hg !== "number" ||
      typeof ag !== "number"
    ) continue;

    const hId = game.teams?.home?.id;
    const aId = game.teams?.away?.id;

    if (
      !(
        (hId === homeId && aId === awayId) ||
        (hId === awayId && aId === homeId)
      )
    ) continue;

    total++;

    if (hg === ag) {
      draws++;
      continue;
    }

    const winner = hg > ag ? hId : aId;

    if (winner === homeId) homeWins++;
    else if (winner === awayId) awayWins++;
  }

  return {
    total,
    homeWins,
    draws,
    awayWins
  };
}

function calculateCoverage(status) {
  const keys = [
    "fixture",
    "home_form",
    "away_form",
    "h2h",
    "standings",
    "home_statistics",
    "away_statistics",
    "lineups",
    "injuries",
    "statistics",
    "odds",
    "predictions"
  ];

  const available =
    keys.filter(k => status[k]).length;

  return Math.round(
    (available / keys.length) * 100
  );
}

function renderDataStatus(status) {
  const labels = {
    fixture: "Maç",
    home_form: "Ev Form",
    away_form: "Dep Form",
    h2h: "H2H",
    standings: "Puan Durumu",
    home_statistics: "Ev İstatistik",
    away_statistics: "Dep İstatistik",
    lineups: "Kadro",
    injuries: "Sakatlık",
    statistics: "Maç İstatistik",
    odds: "Oran",
    predictions: "API Tahmini"
  };

  return Object.entries(labels)
    .map(([key, label]) => {
      const ok = Boolean(status[key]);

      return `
        <span class="${ok ? "data-ok" : "data-missing"}">
          ${ok ? "✓" : "×"} ${label}
        </span>
      `;
    })
    .join("");
}

function poisson(k, lambda) {
  if (lambda <= 0) {
    return k === 0 ? 1 : 0;
  }

  let result = Math.exp(-lambda);

  for (let i = 1; i <= k; i++) {
    result *= lambda / i;
  }

  return result;
}

function poissonMostLikely(lambda) {
  let best = 0;
  let bestP = 0;

  for (let i = 0; i <= 6; i++) {
    const p = poisson(i, lambda);

    if (p > bestP) {
      bestP = p;
      best = i;
    }
  }

  return best;
}

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

  renderMatches();

  if (drawer.classList.contains("open")) {
    const button = document.querySelector(
      `.favorite-btn`
    );

    if (button) {
      button.textContent =
        favorites.includes(id) ? "❤️" : "♡";
    }
  }
}

function closeDrawer() {
  drawer.classList.remove("open");
  document.body.classList.remove("drawer-open");
}

function closeAnalysis() {
  closeDrawer();
}

function searchMatches() {
  renderMatches();
}

function formatTime(date) {
  if (!date) return "--:--";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(date));
  } catch {
    return "--:--";
  }
}

function formatDate(date) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(date));
  } catch {
    return "";
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document
  .query
