/* =========================================================
   R❤️İ FOOTBALL — APP.JS
   Decision Engine v3.0
   ========================================================= */
const API_BASE = "/api";
let allFixtures = [];
let currentMatch = null;
let favorites = JSON.parse(localStorage.getItem("ri_favorites") || "[]");
/* =========================
   HELPERS
========================= */
const $ = (s) => document.querySelector(s);
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function pct(v) {
  return `${Math.round(Number(v) || 0)}%`;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
/* =========================
   API
========================= */
async function api(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return await res.json();
}
/* =========================
   FIXTURES
========================= */
async function loadFixtures() {
  const list = $("#matches");
  if (list) {
    list.innerHTML = `
      <div class="loading">
        ⚽ Maçlar yükleniyor...
      </div>
    `;
  }
  try {
    const data = await api("/fixtures?date=today");
    allFixtures =
      Array.isArray(data)
        ? data
        : data.response || data.fixtures || [];
    renderFixtures(allFixtures);
  } catch (err) {
    console.error(err);
    if (list) {
      list.innerHTML = `
        <div class="empty">
          ❌ Maçlar alınamadı.
        </div>
      `;
    }
  }
}
/* =========================
   FIXTURE NORMALIZER
========================= */
function normalizeFixture(item) {
  const fixture = item.fixture || item;
  const teams = item.teams || {};
  return {
    id:
      fixture.id ||
      item.id,
    date:
      fixture.date ||
      item.date,
    status:
      fixture.status?.short ||
      item.status?.short ||
      "",
    league:
      item.league?.name ||
      fixture.league?.name ||
      "Lig",
    country:
      item.league?.country ||
      "Diğer",
    home:
      teams.home?.name ||
      item.home?.name ||
      "Ev Sahibi",
    away:
      teams.away?.name ||
      item.away?.name ||
      "Deplasman",
    homeLogo:
      teams.home?.logo ||
      "",
    awayLogo:
      teams.away?.logo ||
      ""
  };
}
/* =========================
   FIXTURE CARD
========================= */
function renderFixtures(fixtures) {
  const container = $("#matches");
  if (!container) return;
  if (!fixtures.length) {
    container.innerHTML = `
      <div class="empty">
        Bugün maç bulunamadı.
      </div>
    `;
    return;
  }
  container.innerHTML = fixtures
    .map((raw) => {
      const m = normalizeFixture(raw);
      const fav = favorites.includes(String(m.id));
      return `
        <div class="match-card"
             data-id="${esc(m.id)}">
          <div class="match-league">
            ${esc(m.country)} • ${esc(m.league)}
          </div>
          <div class="match-teams">
            <div class="team">
              ${
                m.homeLogo
                  ? `<img src="${esc(m.homeLogo)}">`
                  : ""
              }
              <span>${esc(m.home)}</span>
            </div>
            <div class="vs">
              VS
            </div>
            <div class="team">
              ${
                m.awayLogo
                  ? `<img src="${esc(m.awayLogo)}">`
                  : ""
              }
              <span>${esc(m.away)}</span>
            </div>
          </div>
          <div class="match-bottom">
            <span>
              ${m.date
                ? new Date(m.date).toLocaleTimeString(
                    "tr-TR",
                    {
                      hour: "2-digit",
                      minute: "2-digit"
                    }
                  )
                : ""}
            </span>
            <button
              class="favorite-btn"
              data-fav="${m.id}">
              ${fav ? "★" : "☆"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
  container.querySelectorAll(".match-card")
    .forEach(card => {
      card.addEventListener("click", (e) => {
        if (
          e.target.closest(".favorite-btn")
        ) {
          return;
        }
        openMatch(card.dataset.id);
      });
    });
  container.querySelectorAll(".favorite-btn")
    .forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.fav);
      });
    });
}
/* =========================
   FAVORITES
========================= */
function toggleFavorite(id) {
  id = String(id);
  if (favorites.includes(id)) {
    favorites =
      favorites.filter(x => x !== id);
  } else {
    favorites.push(id);
  }
  localStorage.setItem(
    "ri_favorites",
    JSON.stringify(favorites)
  );
  renderFixtures(allFixtures);
}
/* =========================
   OPEN MATCH
========================= */
async function openMatch(id) {
  const modal = $("#analysisModal");
  if (!modal) return;
  modal.classList.add("open");
  modal.innerHTML = `
    <div class="analysis-loading">
      <div class="loader">⚽</div>
      <h2>Maç analiz ediliyor...</h2>
      <p>
        Form, goller, H2H ve mevcut istatistikler
        değerlendiriliyor.
      </p>
    </div>
  `;
  try {
    const data =
      await api(`/match?fixture=${encodeURIComponent(id)}`);
    currentMatch = data;
    const analysis =
      calculateDecision(data);
    renderAnalysis(data, analysis);
  } catch (err) {
    console.error(err);
    modal.innerHTML = `
      <div class="analysis-error">
        <h2>❌ Analiz alınamadı</h2>
        <p>Maç verileri şu anda getirilemedi.</p>
        <button onclick="closeAnalysis()">
          Kapat
        </button>
      </div>
    `;
  }
}
/* =========================
   CLOSE
========================= */
function closeAnalysis() {
  const modal = $("#analysisModal");
  if (modal) {
    modal.classList.remove("open");
  }
}
/* =========================================================
   DATA EXTRACTION
========================================================= */
function getForm(data, side) {
  const form =
    data?.analysis_data?.form?.[side];
  if (!form) {
    return {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      avgFor: 0,
      avgAgainst: 0,
      btts: 0,
      over25: 0
    };
  }
  return {
    played: Number(form.played || 0),
    wins: Number(form.wins || 0),
    draws: Number(form.draws || 0),
    losses: Number(form.losses || 0),
    goalsFor:
      Number(
        form.goalsFor ??
        form.goals_for ??
        0
      ),
    goalsAgainst:
      Number(
        form.goalsAgainst ??
        form.goals_against ??
        0
      ),
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
  /*
   Form verisi eksikse minimum model değerleri.
  */
  if (!homeXG || !Number.isFinite(homeXG)) {
    homeXG = 1.25;
  }
  if (!awayXG || !Number.isFinite(awayXG)) {
    awayXG = 1.05;
  }
  /*
   Ev sahibi avantajı.
  */
  homeXG *= 1.08;
  return {
    home: clamp(homeXG, 0.15, 4.5),
    away: clamp(awayXG, 0.15, 4.5)
  };
}
/* =========================================================
   POISSON
========================================================= */
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) {
    r *= i;
  }
  return r;
}
function poisson(lambda, k) {
  return (
    Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k)
  );
}
function poissonMarkets(homeXG, awayXG) {
  const max = 7;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;
  let scoreMatrix = [];
  for (let h = 0; h <= max; h++) {
    scoreMatrix[h] = [];
    for (let a = 0; a <= max; a++) {
      const p =
        poisson(homeXG, h) *
        poisson(awayXG, a);
      scoreMatrix[h][a] = p;
      if (h > a) homeWin += p;
      if (h === a) draw += p;
      if (h < a) awayWin += p;
      if (h + a >= 2) over15 += p;
      if (h + a >= 3) over25 += p;
      if (h + a >= 4) over35 += p;
      if (h >= 1 && a >= 1) {
        btts += p;
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
    scoreMatrix
  };
}
/* =========================================================
   SCORE
========================================================= */
function predictedScore(matrix) {
  let best = {
    h: 0,
    a: 0,
    p: 0
  };
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      if (matrix[h][a] > best.p) {
        best = {
          h,
          a,
          p: matrix[h][a]
        };
      }
    }
  }
  return `${best.h}-${best.a}`;
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
    calculateXG(home, away);
  const markets =
    poissonMarkets(
      xg.home,
      xg.away
    );
  /*
   Form gücü.
  */
  const homeForm =
    home.played
      ? home.wins / home.played
      : 0;
  const awayForm =
    away.played
      ? away.wins / away.played
      : 0;
  /*
   Ev/deplasman uyumu.
  */
  const homeAttack =
    clamp(
      home.avgFor / 2,
      0,
      1
    );
  const awayWeakness =
    clamp(
      away.avgAgainst / 2,
      0,
      1
    );
  const homeAdvantage =
    clamp(
      (
        homeForm * 0.45 +
        homeAttack * 0.30 +
        awayWeakness * 0.25
      ),
      0,
      1
    );
  /*
   Deplasman tarafı.
  */
  const awayAttack =
    clamp(
      away.avgFor / 2,
      0,
      1
    );
  const homeWeakness =
    clamp(
      home.avgAgainst / 2,
      0,
      1
    );
  const awayStrength =
    clamp(
      (
        awayForm * 0.45 +
        awayAttack * 0.30 +
        homeWeakness * 0.25
      ),
      0,
      1
    );
  /*
   Aday marketler.
  */
  const candidates = [
    {
      key: "MS1",
      label: "MS 1",
      probability: markets.homeWin,
      reliability: 0.86,
      support:
        homeAdvantage * 100
    },
    {
      key: "MSX",
      label: "MS X",
      probability: markets.draw,
      reliability: 0.70,
      support:
        50 - Math.abs(
          homeAdvantage -
          awayStrength
        ) * 100
    },
    {
      key: "MS2",
      label: "MS 2",
      probability: markets.awayWin,
      reliability: 0.84,
      support:
        awayStrength * 100
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
      label: "2.5 Alt / 1.5 Üst",
      probability: markets.over15,
      reliability: 0.98,
      support:
        markets.over15
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
        markets.over35
    }
  ];
  /*
   Ham olasılığı doğrudan seçmiyoruz.
   Probability × reliability × data support
   ile karar puanı oluşturuyoruz.
  */
  candidates.forEach(c => {
    const probabilityScore =
      c.probability * 0.65;
    const supportScore =
      clamp(c.support, 0, 100) * 0.20;
    const reliabilityScore =
      c.reliability * 100 * 0.15;
    c.score =
      probabilityScore +
      supportScore +
      reliabilityScore;
  });
  /*
   Çok düşük olasılıklı seçimleri engelle.
  */
  const filtered =
    candidates.filter(c =>
      c.probability >= 55
    );
  const pool =
    filtered.length
      ? filtered
      : candidates;
  pool.sort(
    (a, b) => b.score - a.score
  );
  const best =
    pool[0];
  /*
   Güven = model olasılığı.
  */
  let confidence =
    clamp(
      best.probability,
      0,
      99
    );
  /*
   Risk sınıflandırması.
  */
  let risk;
  let category;
  if (confidence >= 78) {
    risk = "Düşük";
    category = "Banko Kupon";
  } else if (confidence >= 68) {
    risk = "Orta";
    category = "Orta Riskli";
  } else if (confidence >= 58) {
    risk = "Yüksek";
    category = "Yüksek Riskli";
  } else {
    risk = "Çok Yüksek";
    category = "Yüksek Oranlı";
  }
  /*
   Tahmini skor.
  */
  const score =
    predictedScore(
      markets.scoreMatrix
    );
  /*
   Nedenler.
  */
  const reasons = [];
  if (
    best.key === "MS1" &&
    home.wins >= away.wins
  ) {
    reasons.push(
      `Ev sahibinin form galibiyet oranı daha güçlü (${pct(homeForm * 100)}).`
    );
  }
  if (
    best.key === "MS2" &&
    away.wins >= home.wins
  ) {
    reasons.push(
      `Deplasman ekibinin form galibiyet oranı daha güçlü (${pct(awayForm * 100)}).`
    );
  }
  if (
    best.key === "KG" &&
    (
      home.btts >= 50 ||
      away.btts >= 50
    )
  ) {
    reasons.push(
      `Takımların karşılıklı gol geçmişi KG seçeneğini destekliyor.`
    );
  }
  if (
    best.key === "O25" &&
    (
      home.over25 >= 50 ||
      away.over25 >= 50
    )
  ) {
    reasons.push(
      `Son maçlardaki 2.5 üst eğilimi bu seçeneği destekliyor.`
    );
  }
  if (
    best.key === "O15"
  ) {
    reasons.push(
      `Model toplam gol beklentisini yeterli görüyor.`
    );
  }
  if (xg.home > xg.away + 0.35) {
    reasons.push(
      `Beklenen gol modelinde ev sahibi avantajı var (${xg.home.toFixed(2)} - ${xg.away.toFixed(2)} xG).`
    );
  } else if (xg.away > xg.home + 0.35) {
    reasons.push(
      `Beklenen gol modelinde deplasman avantajı var (${xg.home.toFixed(2)} - ${xg.away.toFixed(2)} xG).`
    );
  } else {
    reasons.push(
      `Beklenen gol değerleri birbirine yakın (${xg.home.toFixed(2)} - ${xg.away.toFixed(2)} xG).`
    );
  }
  if (!reasons.length) {
    reasons.push(
      "Model mevcut form ve gol verilerini birlikte değerlendirdi."
    );
  }
  /*
   İkincil seçenekler.
  */
  const alternatives =
    pool
      .filter(c => c.key !== best.key)
      .slice(0, 4)
      .map(c => ({
        label: c.label,
        probability: c.probability,
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
   ANALYSIS UI
========================================================= */
function renderAnalysis(data, a) {
  const modal =
    $("#analysisModal");
  const teams =
    data.teams || {};
  const homeName =
    teams.home?.name ||
    data.fixture?.teams?.home?.name ||
    "Ev Sahibi";
  const awayName =
    teams.away?.name ||
    data.fixture?.teams?.away?.name ||
    "Deplasman";
  const best =
    a.best;
  modal.innerHTML = `
    <div class="analysis-container">
      <button
        class="close-analysis"
        onclick="closeAnalysis()">
        ✕
      </button>
      <div class="analysis-header">
        <div class="league-title">
          ${esc(
            data.league?.name ||
            data.fixture?.league?.name ||
            ""
          )}
        </div>
        <h1>
          ${esc(homeName)}
          <span>VS</span>
          ${esc(awayName)}
        </h1>
      </div>
      <!-- =========================================
           MAIN DECISION
      ========================================== -->
      <section class="play-box">
        <div class="play-label">
          🎯 ŞUNU OYNA
        </div>
        <div class="play-selection">
          ${esc(best.label)}
        </div>
        <div class="play-confidence">
          ${pct(a.confidence)}
        </div>
        <div class="play-meta">
          <span>
            ${esc(a.category)}
          </span>
          <span>
            Risk: ${esc(a.risk)}
          </span>
        </div>
      </section>
      <!-- =========================================
           WHY
      ========================================== -->
      <section class="analysis-section">
        <h2>🧠 NEDEN?</h2>
        <div class="reason-list">
          ${a.reasons
            .map(
              r => `
                <div class="reason">
                  ✓ ${esc(r)}
                </div>
              `
            )
            .join("")}
        </div>
      </section>
      <!-- =========================================
           SCORE
      ========================================== -->
      <section class="score-box">
        <div>
          <small>TAHMİNİ SKOR</small>
          <strong>${esc(a.score)}</strong>
        </div>
        <div>
          <small>EV xG</small>
          <strong>
            ${a.xg.home.toFixed(2)}
          </strong>
        </div>
        <div>
          <small>DEP xG</small>
          <strong>
            ${a.xg.away.toFixed(2)}
          </strong>
        </div>
      </section>
      <!-- =========================================
           ALTERNATIVES
      ========================================== -->
      <section class="analysis-section">
        <h2>📌 DİĞER SEÇENEKLER</h2>
        <div class="alternative-list">
          ${a.alternatives
            .map(
              x => `
                <div class="alternative">
                  <strong>
                    ${esc(x.label)}
                  </strong>
                  <span>
                    ${pct(x.probability)}
                  </span>
                  <small>
                    ${esc(x.risk)} Risk
                  </small>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
      <!-- =========================================
           MARKET TABLE
      ========================================== -->
      <section class="analysis-section">
        <h2>📊 MODEL SONUÇLARI</h2>
        <div class="market-grid">
          ${marketRow(
            "MS 1",
            a.markets.homeWin
          )}
          ${marketRow(
            "MS X",
            a.markets.draw
          )}
          ${marketRow(
            "MS 2",
            a.markets.awayWin
          )}
          ${marketRow(
            "KG Var",
            a.markets.btts
          )}
          ${marketRow(
            "1.5 Üst",
            a.markets.over15
          )}
          ${marketRow(
            "2.5 Üst",
            a.markets.over25
          )}
          ${marketRow(
            "3.5 Üst",
            a.markets.over35
          )}
        </div>
      </section>
      <!-- =========================================
           FORM
      ========================================== -->
      <section class="analysis-section">
        <h2>📈 FORM</h2>
        <div class="form-grid">
          <div class="form-team">
            <h3>${esc(homeName)}</h3>
            <p>
              Maç: ${a.home.played}
            </p>
            <p>
              Galibiyet: ${a.home.wins}
            </p>
            <p>
              Beraberlik: ${a.home.draws}
            </p>
            <p>
              Mağlubiyet: ${a.home.losses}
            </p>
            <p>
              Gol: ${a.home.avgFor.toFixed(2)}
            </p>
            <p>
              Yenen: ${a.home.avgAgainst.toFixed(2)}
            </p>
          </div>
          <div class="form-team">
            <h3>${esc(awayName)}</h3>
            <p>
              Maç: ${a.away.played}
            </p>
            <p>
              Galibiyet: ${a.away.wins}
            </p>
            <p>
              Beraberlik: ${a.away.draws}
            </p>
            <p>
              Mağlubiyet: ${a.away.losses}
            </p>
            <p>
              Gol: ${a.away.avgFor.toFixed(2)}
            </p>
            <p>
              Yenen: ${a.away.avgAgainst.toFixed(2)}
            </p>
          </div>
        </div>
      </section>
      <div class="model-note">
        ⚠️ Bu sonuç istatistiksel model çıktısıdır.
        Hiçbir bahis sonucu garanti değildir.
      </div>
    </div>
  `;
}
/* =========================
   MARKET ROW
========================= */
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
   SEARCH
========================================================= */
function searchMatches(text) {
  const q =
    text
      .toLowerCase()
      .trim();
  if (!q) {
    renderFixtures(allFixtures);
    return;
  }
  const filtered =
    allFixtures.filter(raw => {
      const m =
        normalizeFixture(raw);
      return (
        m.home.toLowerCase().includes(q) ||
        m.away.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q) ||
        m.country.toLowerCase().includes(q)
      );
    });
  renderFixtures(filtered);
}
/* =========================================================
   MENU
========================================================= */
function setupMenu() {
  document
    .querySelectorAll("[data-filter]")
    .forEach(btn => {
      btn.addEventListener(
        "click",
        () => {
          const filter =
            btn.dataset.filter;
          if (filter === "favorites") {
            const filtered =
              allFixtures.filter(raw => {
                const m =
                  normalizeFixture(raw);
                return favorites.includes(
                  String(m.id)
                );
              });
            renderFixtures(filtered);
            return;
          }
          /*
           Diğer analiz kategorileri
           sonraki aşamada gerçek
           server-side tarama ile
           doldurulacak.
          */
          renderFixtures(allFixtures);
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
        e => {
          searchMatches(e.target.value);
        }
      );
    }
    const close =
      $("#analysisModal");
    if (close) {
      close.addEventListener(
        "click",
        e => {
          if (
            e.target === close
          ) {
            closeAnalysis();
          }
        }
      );
    }
  }
);
