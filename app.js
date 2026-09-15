/* =========================================================
   R❤️İ FOOTBALL — API ENGINE
   Rate-limit protected + cache + request deduplication
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE = "https://rianali.akifrusa21.workers.dev";

const CACHE_PREFIX = "rii_football_";
const CACHE_VERSION = "v3";

/*
  Cache süreleri:
  Fixtures: 5 dakika
  Maç detayları: 10 dakika
  H2H: 30 dakika
  Kadro/sakatlık/istatistik: 15 dakika
*/
const CACHE_TTL = {
  fixtures: 5 * 60 * 1000,
  fixture: 10 * 60 * 1000,
  h2h: 30 * 60 * 1000,
  injuries: 15 * 60 * 1000,
  lineups: 15 * 60 * 1000,
  players: 15 * 60 * 1000,
  statistics: 10 * 60 * 1000,
  odds: 5 * 60 * 1000,
  predictions: 15 * 60 * 1000,
  standings: 30 * 60 * 1000,
  team_statistics: 30 * 60 * 1000
};

/*
  API rate-limit durumunda bu süre boyunca
  yeni istek göndermiyoruz.
*/
const RATE_LIMIT_COOLDOWN = 65 * 1000;

/*
  Aynı anda maksimum bir API isteği.
  Böylece sayfa açılırken 10 endpoint birden
  API'ye yüklenmez.
*/
const REQUEST_DELAY = 1200;


/* =========================================================
   STATE
   ========================================================= */

const state = {
  selectedDate: new Date(),
  fixtures: [],
  filteredFixtures: [],
  selectedFixture: null,
  loading: false,
  searchTerm: "",
  activeSection: "all",
  lastError: null,
  rateLimitedUntil: 0
};

const inflightRequests = new Map();

let lastRequestTime = 0;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function getDateString(date) {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function getElement(...selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);

    if (el) return el;
  }

  return null;
}


function getElements(...selectors) {
  const result = [];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!result.includes(el)) {
        result.push(el);
      }
    });
  });

  return result;
}


/* =========================================================
   LOCAL CACHE
   ========================================================= */

function cacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj, key) => {
      obj[key] = params[key];
      return obj;
    }, {});

  return `${CACHE_PREFIX}${CACHE_VERSION}_${endpoint}_${JSON.stringify(sortedParams)}`;
}


function readCache(endpoint, params = {}) {
  try {
    const key = cacheKey(endpoint, params);
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    const item = JSON.parse(raw);

    if (!item || !item.timestamp) {
      localStorage.removeItem(key);
      return null;
    }

    const ttl = CACHE_TTL[endpoint] || 5 * 60 * 1000;

    if (Date.now() - item.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }

    return item.data;

  } catch (error) {
    console.warn("Cache okuma hatası:", error);
    return null;
  }
}


function writeCache(endpoint, params = {}, data) {
  try {
    const key = cacheKey(endpoint, params);

    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data
      })
    );

  } catch (error) {
    console.warn("Cache yazma hatası:", error);
  }
}


/*
  Eski / gereksiz R❤️İ cache kayıtlarını temizle.
  Bunu her sayfa açılışında ağır şekilde yapmıyoruz.
*/
function cleanupOldCache() {
  try {
    const now = Date.now();

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);

      if (!key || !key.startsWith(CACHE_PREFIX)) {
        continue;
      }

      try {
        const item = JSON.parse(localStorage.getItem(key));

        if (
          item &&
          item.timestamp &&
          now - item.timestamp > 60 * 60 * 1000
        ) {
          localStorage.removeItem(key);
        }

      } catch {
        localStorage.removeItem(key);
      }
    }

  } catch (error) {
    console.warn("Cache temizleme hatası:", error);
  }
}


/* =========================================================
   RATE LIMIT
   ========================================================= */

function saveRateLimit() {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}rate_limit`,
      String(state.rateLimitedUntil)
    );
  } catch {}
}


function loadRateLimit() {
  try {
    const value = Number(
      localStorage.getItem(`${CACHE_PREFIX}rate_limit`) || 0
    );

    if (Number.isFinite(value)) {
      state.rateLimitedUntil = value;
    }
  } catch {}
}


function isRateLimited() {
  return Date.now() < state.rateLimitedUntil;
}


function activateRateLimit() {
  state.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN;

  saveRateLimit();

  console.warn(
    "API rate limit aktif. Yeni istekler geçici olarak durduruldu."
  );

  showToast(
    "API limiti doldu. Yeni istekler geçici olarak durduruldu.",
    "warning"
  );
}


/* =========================================================
   REQUEST QUEUE
   ========================================================= */

async function waitForRequestSlot() {
  const elapsed = Date.now() - lastRequestTime;

  if (elapsed < REQUEST_DELAY) {
    await sleep(REQUEST_DELAY - elapsed);
  }

  lastRequestTime = Date.now();
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function api(endpoint, params = {}, options = {}) {

  /*
    Aynı istek zaten devam ediyorsa yeni HTTP isteği oluşturma.
  */
  const key = cacheKey(endpoint, params);

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }


  /*
    Önce cache.
  */
  if (!options.forceRefresh) {
    const cached = readCache(endpoint, params);

    if (cached !== null) {
      console.log("CACHE:", endpoint, params);
      return cached;
    }
  }


  /*
    Rate limit aktifse API'ye hiç gitme.
  */
  if (isRateLimited()) {
    throw new Error(
      "API_RATE_LIMIT_COOLDOWN"
    );
  }


  const promise = (async () => {

    try {

      await waitForRequestSlot();


      const url = new URL(
        `${API_BASE}/${endpoint}`
      );


      Object.entries(params).forEach(([key, value]) => {

        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          url.searchParams.set(key, value);
        }

      });


      console.log(
        "API REQUEST:",
        endpoint,
        Object.fromEntries(url.searchParams.entries())
      );


      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });


      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "API geçerli JSON döndürmedi."
        );
      }


      /*
        API-Football rate limit.
      */
      const apiError =
        data?.errors?.rateLimit ||
        data?.errors?.rate_limit ||
        data?.errors?.tooManyRequests;


      if (
        response.status === 429 ||
        apiError
      ) {

        activateRateLimit();

        throw new Error(
          "API_RATE_LIMIT"
        );
      }


      if (!response.ok) {

        const message =
          data?.message ||
          data?.errors ||
          `HTTP ${response.status}`;

        throw new Error(
          typeof message === "string"
            ? message
            : JSON.stringify(message)
        );
      }


      /*
        Başarılı response'u cache'e yaz.
      */
      writeCache(
        endpoint,
        params,
        data
      );


      return data;

    } finally {

      inflightRequests.delete(key);

    }

  })();


  inflightRequests.set(
    key,
    promise
  );


  return promise;
}


/* =========================================================
   SAFE API
   ========================================================= */

async function safeApi(endpoint, params = {}, options = {}) {

  try {

    return await api(
      endpoint,
      params,
      options
    );

  } catch (error) {

    console.warn(
      `API ${endpoint} hatası:`,
      error
    );

    state.lastError = error;

    return null;
  }
}


/* =========================================================
   FIXTURES
   ========================================================= */

async function loadFixtures(options = {}) {

  if (state.loading && !options.forceRefresh) {
    return state.fixtures;
  }


  state.loading = true;

  showLoading();


  try {

    const date = getDateString(
      state.selectedDate
    );


    /*
      SADECE 1 API ÇAĞRISI.
    */
    const data = await safeApi(
      "fixtures",
      {
        date
      },
      options
    );


    if (!data) {

      if (
        state.lastError?.message ===
        "API_RATE_LIMIT"
      ) {
        showEmptyState(
          "API istek limiti geçici olarak dolu."
        );
      } else {
        showEmptyState(
          "Maç verileri alınamadı."
        );
      }

      return [];
    }


    const fixtures =
      Array.isArray(data.response)
        ? data.response
        : [];


    state.fixtures = fixtures;

    applyFilters();


    console.log(
      `R❤️İ: ${fixtures.length} maç yüklendi.`
    );


    return fixtures;

  } finally {

    state.loading = false;

    hideLoading();

  }
}


/* =========================================================
   FILTER
   ========================================================= */

function applyFilters() {

  const search =
    state.searchTerm
      .trim()
      .toLocaleLowerCase("tr-TR");


  let fixtures = [
    ...state.fixtures
  ];


  if (search) {

    fixtures = fixtures.filter(match => {

      const home =
        match?.teams?.home?.name || "";

      const away =
        match?.teams?.away?.name || "";

      const league =
        match?.league?.name || "";

      const text =
        `${home} ${away} ${league}`
          .toLocaleLowerCase("tr-TR");

      return text.includes(search);
    });
  }


  state.filteredFixtures =
    fixtures;


  renderFixtures(
    fixtures
  );
}


/* =========================================================
   MATCH CARD
   ========================================================= */

function renderFixtures(fixtures) {

  const container = getElement(
    "#matches",
    "#match-list",
    "#fixtures",
    ".matches",
    ".match-grid",
    ".matches-grid"
  );


  if (!container) {
    console.warn(
      "Maç container'ı bulunamadı."
    );
    return;
  }


  if (!fixtures.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Maç bulunamadı</h3>
        <p>Seçilen tarihte uygun maç verisi yok.</p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    fixtures
      .map(
        (match, index) =>
          createMatchCard(
            match,
            index
          )
      )
      .join("");


  /*
    Kart clickleri.
  */
  container
    .querySelectorAll(
      "[data-fixture-id]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          const id =
            Number(
              card.dataset.fixtureId
            );

          const match =
            state.fixtures.find(
              item =>
                Number(item?.fixture?.id) === id
            );

          if (match) {
            openMatchAnalysis(
              match
            );
          }
        }
      );
    });
}


/* =========================================================
   MATCH CARD HTML
   ========================================================= */

function createMatchCard(match, index) {

  const fixture =
    match?.fixture || {};

  const teams =
    match?.teams || {};

  const league =
    match?.league || {};


  const home =
    teams?.home || {};

  const away =
    teams?.away || {};


  const homeName =
    home.name || "Ev Sahibi";

  const awayName =
    away.name || "Deplasman";


  const homeLogo =
    home.logo || "";

  const awayLogo =
    away.logo || "";


  const date =
    fixture.date
      ? new Date(fixture.date)
      : null;


  const time =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleTimeString(
          "tr-TR",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )
      : "--:--";


  const leagueName =
    league.name || "Lig";


  const status =
    fixture?.status?.short || "";


  const live =
    [
      "1H",
      "2H",
      "ET",
      "P",
      "LIVE"
    ].includes(status);


  return `
    <article
      class="match-card"
      data-fixture-id="${escapeHTML(fixture.id)}"
      data-index="${index}"
    >

      <div class="match-card-top">

        <span class="league-name">
          ${escapeHTML(leagueName)}
        </span>

        <span class="match-time ${live ? "live" : ""}">
          ${live ? "🔴 CANLI" : escapeHTML(time)}
        </span>

      </div>


      <div class="teams">

        <div class="team">

          ${
            homeLogo
              ? `
                <img
                  src="${escapeHTML(homeLogo)}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <div class="team-placeholder">
                  ⚽
                </div>
              `
          }

          <strong>
            ${escapeHTML(homeName)}
          </strong>

        </div>


        <div class="vs">
          VS
        </div>


        <div class="team">

          ${
            awayLogo
              ? `
                <img
                  src="${escapeHTML(awayLogo)}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <div class="team-placeholder">
                  ⚽
                </div>
              `
          }

          <strong>
            ${escapeHTML(awayName)}
          </strong>

        </div>

      </div>


      <div class="match-card-footer">

        <span>
          📊 Analiz
        </span>

        <span>
          Detay →
        </span>

      </div>

    </article>
  `;
}


/* =========================================================
   MATCH ANALYSIS
   ========================================================= */

async function openMatchAnalysis(match) {

  state.selectedFixture =
    match;


  const id =
    Number(
      match?.fixture?.id
    );


  if (!id) {
    return;
  }


  openAnalysisDrawer();


  renderAnalysisLoading(
    match
  );


  /*
    ÖNEMLİ:
    Maç kartlarını oluştururken bu endpointler çağrılmaz.

    Kullanıcı gerçekten bir maça bastığında
    sadece gerekli analiz verileri istenir.
  */


  const predictions =
    await safeApi(
      "predictions",
      {
        fixture: id
      }
    );


  renderPredictionAnalysis(
    match,
    predictions
  );
}


/* =========================================================
   PREDICTIONS
   ========================================================= */

function renderPredictionAnalysis(
  match,
  data
) {

  const container =
    getElement(
      "#analysis-content",
      "#analysis",
      ".analysis-content",
      ".drawer-content"
    );


  if (!container) {
    return;
  }


  const prediction =
    data?.response?.[0]?.predictions ||
    {};


  const teams =
    match?.teams || {};


  const home =
    teams?.home?.name ||
    "Ev Sahibi";


  const away =
    teams?.away?.name ||
    "Deplasman";


  const winner =
    prediction?.winner?.name ||
    "Belirsiz";


  const advice =
    prediction?.advice ||
    "Yeterli veri bulunamadı.";


  const btts =
    prediction?.btts;


  const overUnder =
    prediction?.under_over;


  container.innerHTML = `

    <div class="analysis-header">

      <span class="analysis-label">
        MAÇ ANALİZİ
      </span>

      <h2>
        ${escapeHTML(home)}
        -
        ${escapeHTML(away)}
      </h2>

    </div>


    <div class="analysis-section">

      <h3>🤖 API Tahmini</h3>

      <div class="analysis-main-pick">

        <span>
          Tahmin
        </span>

        <strong>
          ${escapeHTML(winner)}
        </strong>

      </div>


      ${
        btts !== undefined &&
        btts !== null
          ? `
            <div class="analysis-row">
              <span>KG</span>
              <strong>
                ${escapeHTML(
                  formatPredictionValue(btts)
                )}
              </strong>
            </div>
          `
          : ""
      }


      ${
        overUnder
          ? `
            <div class="analysis-row">
              <span>2.5 Gol</span>
              <strong>
                ${escapeHTML(
                  formatPredictionValue(
                    overUnder
                  )
                )}
              </strong>
            </div>
          `
          : ""
      }


      <p class="analysis-advice">
        ${escapeHTML(advice)}
      </p>

    </div>


    <div class="analysis-section">

      <h3>📊 Diğer Analizler</h3>

      <div class="analysis-actions">

        <button
          type="button"
          data-analysis-action="h2h"
        >
          H2H
        </button>

        <button
          type="button"
          data-analysis-action="statistics"
        >
          İstatistik
        </button>

        <button
          type="button"
          data-analysis-action="lineups"
        >
          Kadro
        </button>

        <button
          type="button"
          data-analysis-action="injuries"
        >
          Sakatlık
        </button>

      </div>

    </div>

  `;


  container
    .querySelectorAll(
      "[data-analysis-action]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.analysisAction;

          loadExtraAnalysis(
            action,
            match
          );
        }
      );
    });
}


/* =========================================================
   EXTRA ANALYSIS
   ========================================================= */

async function loadExtraAnalysis(
  type,
  match
) {

  const id =
    Number(
      match?.fixture?.id
    );


  if (!id) return;


  const endpointMap = {

    h2h: "h2h",

    statistics:
      "statistics",

    lineups:
      "lineups",

    injuries:
      "injuries"

  };


  const endpoint =
    endpointMap[type];


  if (!endpoint) {
    return;
  }


  const container =
    getElement(
      "#analysis-content",
      "#analysis",
      ".analysis-content",
      ".drawer-content"
    );


  if (container) {

    const loading =
      document.createElement(
        "div"
      );

    loading.className =
      "analysis-loading";

    loading.textContent =
      "Veriler yükleniyor...";

    container.appendChild(
      loading
    );
  }


  let params = {
    fixture: id
  };


  /*
    H2H API'si fixture yerine
    çoğu kullanımda h2h parametresi ister.
  */
  if (type === "h2h") {

    const homeId =
      match?.teams?.home?.id;

    const awayId =
      match?.teams?.away?.id;


    if (
      homeId &&
      awayId
    ) {

      params = {
        h2h: `${homeId}-${awayId}`,
        last: 10
      };

    } else {

      params = {
        fixture: id
      };

    }
  }


  const data =
    await safeApi(
      endpoint,
      params
    );


  renderExtraAnalysis(
    type,
    data
  );
}


/* =========================================================
   EXTRA ANALYSIS RENDER
   ========================================================= */

function renderExtraAnalysis(
  type,
  data
) {

  const container =
    getElement(
      "#analysis-content",
      "#analysis",
      ".analysis-content",
      ".drawer-content"
    );


  if (!container) {
    return;
  }


  const existing =
    container.querySelector(
      ".extra-analysis-result"
    );


  if (existing) {
    existing.remove();
  }


  const section =
    document.createElement(
      "div"
    );


  section.className =
    "analysis-section extra-analysis-result";


  const result =
    Array.isArray(data?.response)
      ? data.response
      : [];


  let title =
    "Analiz";


  if (type === "h2h") {
    title = "H2H";
  }

  if (type === "statistics") {
    title = "İstatistikler";
  }

  if (type === "lineups") {
    title = "Kadrolar";
  }

  if (type === "injuries") {
    title = "Sakatlıklar";
  }


  section.innerHTML = `

    <h3>
      ${escapeHTML(title)}
    </h3>

    ${
      result.length
        ? `
          <div class="analysis-result-count">
            ${result.length} veri bulundu.
          </div>

          <pre class="analysis-json">
${escapeHTML(
  JSON.stringify(
    result,
    null,
    2
  )
)}
          </pre>
        `
        : `
          <p>
            Bu maç için veri bulunamadı.
          </p>
        `
    }

  `;


  container.appendChild(
    section
  );
}


/* =========================================================
   PREDICTION VALUE
   ========================================================= */

function formatPredictionValue(value) {

  if (
    typeof value === "string"
  ) {
    return value;
  }


  if (
    typeof value === "boolean"
  ) {
    return value
      ? "Evet"
      : "Hayır";
  }


  if (
    value &&
    typeof value === "object"
  ) {

    if (
      value.name
    ) {
      return value.name;
    }


    if (
      value.value
    ) {
      return value.value;
    }


    return JSON.stringify(
      value
    );
  }


  return String(
    value ?? "-"
  );
}


/* =========================================================
   DATE CONTROLS
   ========================================================= */

function changeDate(days) {

  const date =
    new Date(
      state.selectedDate
    );


  date.setDate(
    date.getDate() + days
  );


  state.selectedDate =
    date;


  /*
    Tarih değişince sadece fixtures endpoint'i.
  */
  loadFixtures();
}


function setToday() {

  state.selectedDate =
    new Date();


  loadFixtures();
}


/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {

  const searchInput =
    getElement(
      "#search",
      "#search-input",
      'input[type="search"]',
      ".search-input"
    );


  if (!searchInput) {
    return;
  }


  let timer;


  searchInput.addEventListener(
    "input",
    event => {

      clearTimeout(
        timer
      );


      timer =
        setTimeout(
          () => {

            state.searchTerm =
              event.target.value || "";

            applyFilters();

          },
          250
        );
    }
  );
}


/* =========================================================
   BUTTONS
   ========================================================= */

function setupDateButtons() {

  getElements(
    "[data-date-prev]",
    "#prev-day",
    ".prev-day"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => changeDate(-1)
    );
  });


  getElements(
    "[data-date-next]",
    "#next-day",
    ".next-day"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => changeDate(1)
    );
  });


  getElements(
    "[data-date-today]",
    "#today",
    ".today"
  ).forEach(button => {

    button.addEventListener(
      "click",
      setToday
    );
  });
}


/* =========================================================
   DRAWER
   ========================================================= */

function openAnalysisDrawer() {

  const drawer =
    getElement(
      "#analysis-drawer",
      ".analysis-drawer",
      "#drawer"
    );


  if (!drawer) {
    return;
  }


  drawer.classList.add(
    "open",
    "active"
  );


  document.body.classList.add(
    "drawer-open"
  );
}


function closeAnalysisDrawer() {

  const drawer =
    getElement(
      "#analysis-drawer",
      ".analysis-drawer",
      "#drawer"
    );


  if (!drawer) {
    return;
  }


  drawer.classList.remove(
    "open",
    "active"
  );


  document.body.classList.remove(
    "drawer-open"
  );
}


function setupDrawer() {

  getElements(
    "[data-close-analysis]",
    "#close-analysis",
    ".close-analysis",
    ".drawer-close"
  ).forEach(button => {

    button.addEventListener(
      "click",
      closeAnalysisDrawer
    );
  });
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {

  const containers =
    getElements(
      "#matches",
      "#match-list",
      "#fixtures",
      ".matches",
      ".match-grid",
      ".matches-grid"
    );


  containers.forEach(
    container => {

      if (
        container.children.length === 0
      ) {

        container.innerHTML = `
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Maçlar yükleniyor...</p>
          </div>
        `;
      }

    }
  );
}


function hideLoading() {
  /*
    Kart render işlemi zaten loading ekranını
    değiştirdiği için burada ekstra işlem gerekmez.
  */
}


function renderAnalysisLoading(match) {

  const container =
    getElement(
      "#analysis-content",
      "#analysis",
      ".analysis-content",
      ".drawer-content"
    );


  if (!container) {
    return;
  }


  const home =
    match?.teams?.home?.name ||
    "Ev Sahibi";


  const away =
    match?.teams?.away?.name ||
    "Deplasman";


  container.innerHTML = `

    <div class="analysis-header">

      <span class="analysis-label">
        MAÇ ANALİZİ
      </span>

      <h2>
        ${escapeHTML(home)}
        -
        ${escapeHTML(away)}
      </h2>

    </div>

    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Analiz verileri hazırlanıyor...</p>
    </div>

  `;
}


function showEmptyState(message) {

  const container =
    getElement(
      "#matches",
      "#match-list",
      "#fixtures",
      ".matches",
      ".match-grid",
      ".matches-grid"
    );


  if (!container) {
    return;
  }


  container.innerHTML = `

    <div class="empty-state">

      <div class="empty-icon">
        ⚽
      </div>

      <h3>
        ${escapeHTML(message)}
      </h3>

      <p>
        Daha sonra tekrar deneyebilirsin.
      </p>

    </div>

  `;
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message,
  type = "info"
) {

  let toast =
    document.querySelector(
      "#rii-toast"
    );


  if (!toast) {

    toast =
      document.createElement(
        "div"
      );

    toast.id =
      "rii-toast";

    toast.className =
      "rii-toast";

    document.body.appendChild(
      toast
    );
  }


  toast.className =
    `rii-toast ${type}`;


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toast._timer
  );


  toast._timer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      4000
    );
}


/* =========================================================
   SIDEBAR / NAVIGATION
   ========================================================= */

function setupNavigation() {

  getElements(
    "[data-section]",
    ".nav-item",
    ".sidebar-item"
  ).forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const section =
          button.dataset.section;


        if (!section) {
          return;
        }


        state.activeSection =
          section;


        getElements(
          "[data-section]",
          ".nav-item",
          ".sidebar-item"
        ).forEach(item => {

          item.classList.remove(
            "active"
          );

        });


        button.classList.add(
          "active"
        );


        applySectionFilter(
          section
        );
      }
    );
  });
}


function applySectionFilter(
  section
) {

  /*
    Ana maç listesi üzerinden filtreleme.
    Yeni API isteği yapılmaz.
  */

  let fixtures =
    [...state.fixtures];


  switch (section) {

    case "all":
    case "matches":
    case "all-matches":
      break;


    /*
      Buradaki bölümler şimdilik
      API çağrısı yapmadan ana veriyi gösterir.
      Daha sonra analiz skorlarına göre
      client-side filtre eklenebilir.
    */

    default:
      break;
  }


  state.filteredFixtures =
    fixtures;


  renderFixtures(
    fixtures
  );
}


/* =========================================================
   REFRESH
   ========================================================= */

async function manualRefresh() {

  /*
    Kullanıcı özellikle yenile dediğinde
    cache'i bypass eder.
    
    Fakat rate-limit aktifse yine istek atılmaz.
  */

  if (isRateLimited()) {

    showToast(
      "API limiti nedeniyle yenileme geçici olarak kapalı.",
      "warning"
    );

    return;
  }


  await loadFixtures({
    forceRefresh: true
  });
}


function setupRefresh() {

  getElements(
    "[data-refresh]",
    "#refresh",
    ".refresh-button"
  ).forEach(button => {

    button.addEventListener(
      "click",
      manualRefresh
    );
  });
}


/* =========================================================
   AUTO REFRESH
   ========================================================= */

/*
  Otomatik refresh özellikle kapalı tutuluyor.

  Çünkü:
  - API kotasını tüketebilir
  - Shared IP rate limitine takılabilir
  - Kullanıcı sayfayı açık bırakabilir

  Canlı maç sistemi eklenirken ayrıca
  kontrollü polling yapılabilir.
*/

function startSafeAutoRefresh() {

  /*
    Şimdilik hiçbir şey yapmıyoruz.
  */

  console.log(
    "R❤️İ: Otomatik API refresh kapalı."
  );
}


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  event => {

    console.warn(
      "R❤️İ yakalanmamış Promise hatası:",
      event.reason
    );

    /*
      Hatanın bütün siteyi bozmasını engelle.
    */

    event.preventDefault();
  }
);


window.addEventListener(
  "error",
  event => {

    console.warn(
      "R❤️İ JavaScript hatası:",
      event.error || event.message
    );

  }
);


/* =========================================================
   INIT
   ========================================================= */

async function initApp() {

  console.log(
    "R❤️İ Football başlatılıyor..."
  );


  cleanupOldCache();

  loadRateLimit();


  setupSearch();

  setupDateButtons();

  setupDrawer();

  setupNavigation();

  setupRefresh();

  startSafeAutoRefresh();


  /*
    Uygulama açılırken yalnızca fixtures.
    
    Cache varsa API'ye HİÇ istek gitmez.
  */

  await loadFixtures();


  console.log(
    "R❤️İ Football hazır."
  );
}


/* =========================================================
   DOM READY
   ========================================================= */

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initApp,
    {
      once: true
    }
  );

} else {

  initApp();

}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.RII = {

  state,

  api,

  loadFixtures,

  openMatchAnalysis,

  manualRefresh,

  changeDate,

  setToday,

  clearCache() {

    try {

      for (
        let i = localStorage.length - 1;
        i >= 0;
        i--
      ) {

        const key =
          localStorage.key(i);

        if (
          key &&
          key.startsWith(
            CACHE_PREFIX
          )
        ) {
          localStorage.removeItem(
            key
          );
        }
      }

      showToast(
        "R❤️İ cache temizlendi.",
        "success"
      );

    } catch (error) {

      console.warn(
        "Cache temizlenemedi:",
        error
      );
    }
  }

};
