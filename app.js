/* =========================================================
   R❤️İ FOOTBALL — API ENGINE
   ULTRA LOW REQUEST MODE
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE = "https://rianali.akifrusa21.workers.dev";

const CACHE_PREFIX = "rii_football_";
const CACHE_VERSION = "v4";

/*
  API-Football ücretsiz planda dakika limiti olduğu için
  istekleri mümkün olduğunca azaltıyoruz.
*/

const CACHE_TTL = {
  fixtures: 10 * 60 * 1000,
  fixture: 30 * 60 * 1000,
  predictions: 30 * 60 * 1000,
  h2h: 60 * 60 * 1000,
  statistics: 30 * 60 * 1000,
  lineups: 30 * 60 * 1000,
  injuries: 30 * 60 * 1000,
  players: 30 * 60 * 1000,
  odds: 30 * 60 * 1000,
  standings: 60 * 60 * 1000,
  team_statistics: 60 * 60 * 1000
};

/*
  API rate-limit görüldüğünde yeni istekleri
  en az 70 saniye durdur.
*/
const RATE_LIMIT_COOLDOWN = 70 * 1000;

/*
  API istekleri arasında minimum 7 saniye.
  10 request/minute sınırına karşı ekstra güvenlik.
*/
const REQUEST_DELAY = 7000;


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

  rateLimitedUntil: 0,

  lastSuccessfulFixtures: null
};


const inflightRequests = new Map();

let lastRequestTime = 0;


/* =========================================================
   DATE
   ========================================================= */

function getDateString(date) {

  const d = new Date(date);

  const year =
    d.getFullYear();

  const month =
    String(d.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(d.getDate())
      .padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}


function getElement(...selectors) {

  for (const selector of selectors) {

    const element =
      document.querySelector(selector);

    if (element) {
      return element;
    }
  }

  return null;
}


function getElements(...selectors) {

  const result = [];

  selectors.forEach(selector => {

    document
      .querySelectorAll(selector)
      .forEach(element => {

        if (!result.includes(element)) {
          result.push(element);
        }

      });

  });

  return result;
}


/* =========================================================
   CACHE
   ========================================================= */

function cacheKey(
  endpoint,
  params = {}
) {

  const sortedParams =
    Object.keys(params)
      .sort()
      .reduce((obj, key) => {

        obj[key] = params[key];

        return obj;

      }, {});

  return (
    `${CACHE_PREFIX}` +
    `${CACHE_VERSION}_` +
    `${endpoint}_` +
    JSON.stringify(sortedParams)
  );
}


function readCache(
  endpoint,
  params = {},
  allowExpired = false
) {

  try {

    const key =
      cacheKey(
        endpoint,
        params
      );

    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const item =
      JSON.parse(raw);

    if (
      !item ||
      !item.timestamp ||
      item.data === undefined
    ) {

      localStorage.removeItem(key);

      return null;
    }


    const ttl =
      CACHE_TTL[endpoint] ||
      10 * 60 * 1000;


    const age =
      Date.now() -
      item.timestamp;


    if (
      age > ttl &&
      !allowExpired
    ) {

      return null;
    }


    return {
      data: item.data,
      timestamp: item.timestamp,
      age,
      expired: age > ttl
    };

  } catch (error) {

    console.warn(
      "Cache okuma hatası:",
      error
    );

    return null;
  }
}


function writeCache(
  endpoint,
  params = {},
  data
) {

  try {

    const key =
      cacheKey(
        endpoint,
        params
      );

    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data
      })
    );

  } catch (error) {

    console.warn(
      "Cache yazma hatası:",
      error
    );
  }
}


/* =========================================================
   RATE LIMIT STORAGE
   ========================================================= */

function saveRateLimit() {

  try {

    localStorage.setItem(
      `${CACHE_PREFIX}rate_limit`,
      String(
        state.rateLimitedUntil
      )
    );

  } catch {}
}


function loadRateLimit() {

  try {

    const value =
      Number(
        localStorage.getItem(
          `${CACHE_PREFIX}rate_limit`
        ) || 0
      );

    if (
      Number.isFinite(value)
    ) {

      state.rateLimitedUntil =
        value;
    }

  } catch {}
}


function isRateLimited() {

  return (
    Date.now() <
    state.rateLimitedUntil
  );
}


function getRemainingCooldown() {

  if (!isRateLimited()) {
    return 0;
  }

  return Math.ceil(
    (
      state.rateLimitedUntil -
      Date.now()
    ) / 1000
  );
}


function activateRateLimit() {

  state.rateLimitedUntil =
    Date.now() +
    RATE_LIMIT_COOLDOWN;

  saveRateLimit();

  console.warn(
    "R❤️İ API rate-limit cooldown aktif."
  );

  showToast(
    "API limiti dolu. Yeni istek geçici olarak durduruldu.",
    "warning"
  );
}


/* =========================================================
   REQUEST QUEUE
   ========================================================= */

async function waitForRequestSlot() {

  const elapsed =
    Date.now() -
    lastRequestTime;


  if (
    elapsed <
    REQUEST_DELAY
  ) {

    await sleep(
      REQUEST_DELAY -
      elapsed
    );
  }


  lastRequestTime =
    Date.now();
}


/* =========================================================
   API
   ========================================================= */

async function api(
  endpoint,
  params = {},
  options = {}
) {

  const key =
    cacheKey(
      endpoint,
      params
    );


  /*
    Aynı istek devam ediyorsa
    ikinci HTTP isteği oluşturma.
  */

  if (
    inflightRequests.has(key)
  ) {

    return inflightRequests.get(key);
  }


  /*
    Önce normal cache.
  */

  if (
    !options.forceRefresh
  ) {

    const cached =
      readCache(
        endpoint,
        params
      );

    if (cached) {

      console.log(
        "R❤️İ CACHE:",
        endpoint
      );

      return cached.data;
    }
  }


  /*
    Rate limit aktifse
    kesinlikle API'ye gitme.
  */

  if (
    isRateLimited()
  ) {

    throw new Error(
      "API_RATE_LIMIT_COOLDOWN"
    );
  }


  const promise =
    (async () => {

      try {

        await waitForRequestSlot();


        /*
          Beklerken rate-limit aktifleşmişse
          tekrar kontrol et.
        */

        if (
          isRateLimited()
        ) {

          throw new Error(
            "API_RATE_LIMIT_COOLDOWN"
          );
        }


        const url =
          new URL(
            `${API_BASE}/${endpoint}`
          );


        Object.entries(params)
          .forEach(
            ([key, value]) => {

              if (
                value !== undefined &&
                value !== null &&
                value !== ""
              ) {

                url.searchParams.set(
                  key,
                  value
                );
              }

            }
          );


        console.log(
          "R❤️İ API REQUEST:",
          endpoint,
          Object.fromEntries(
            url.searchParams.entries()
          )
        );


        const response =
          await fetch(
            url.toString(),
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json"
              },

              cache: "no-store"
            }
          );


        let data;


        try {

          data =
            await response.json();

        } catch {

          throw new Error(
            "API geçerli JSON döndürmedi."
          );
        }


        /*
          API-Football rate-limit.
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


        if (
          !response.ok
        ) {

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
          Başarılı veriyi cache'e yaz.
        */

        writeCache(
          endpoint,
          params,
          data
        );


        return data;

      } finally {

        inflightRequests.delete(
          key
        );
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

async function safeApi(
  endpoint,
  params = {},
  options = {}
) {

  try {

    return await api(
      endpoint,
      params,
      options
    );

  } catch (error) {

    console.warn(
      `R❤️İ API ${endpoint}:`,
      error
    );

    state.lastError =
      error;

    return null;
  }
}


/* =========================================================
   FIXTURES
   ========================================================= */

async function loadFixtures(
  options = {}
) {

  if (
    state.loading &&
    !options.forceRefresh
  ) {

    return state.fixtures;
  }


  state.loading =
    true;

  showLoading();


  const date =
    getDateString(
      state.selectedDate
    );


  const params = {
    date
  };


  try {

    /*
      Rate limit varsa:
      API'ye hiç gitme.
    */

    if (
      isRateLimited()
    ) {

      console.warn(
        "R❤️İ: Rate-limit nedeniyle API çağrısı yapılmadı."
      );


      /*
        Süresi geçmiş olsa bile
        cache varsa göster.
      */

      const stale =
        readCache(
          "fixtures",
          params,
          true
        );


      if (
        stale &&
        Array.isArray(
          stale.data?.response
        )
      ) {

        state.fixtures =
          stale.data.response;

        applyFilters();

        showToast(
          `Önbellekteki maçlar gösteriliyor. API ${getRemainingCooldown()} sn sonra tekrar denenebilir.`,
          "warning"
        );

        return state.fixtures;
      }


      showRateLimitState();

      return [];
    }


    /*
      SADECE 1 FIXTURES İSTEĞİ
    */

    const data =
      await safeApi(
        "fixtures",
        params,
        options
      );


    if (!data) {

      /*
        API başarısız olduysa
        eski cache'i dene.
      */

      const stale =
        readCache(
          "fixtures",
          params,
          true
        );


      if (
        stale &&
        Array.isArray(
          stale.data?.response
        )
      ) {

        state.fixtures =
          stale.data.response;

        applyFilters();

        showToast(
          "Güncel API verisi alınamadı. Önbellekteki veriler gösteriliyor.",
          "warning"
        );

        return state.fixtures;
      }


      if (
        state.lastError?.message ===
        "API_RATE_LIMIT"
      ) {

        showRateLimitState();

      } else if (
        state.lastError?.message ===
        "API_RATE_LIMIT_COOLDOWN"
      ) {

        showRateLimitState();

      } else {

        showEmptyState(
          "Maç verileri alınamadı."
        );
      }


      return [];
    }


    const fixtures =
      Array.isArray(
        data.response
      )
        ? data.response
        : [];


    state.fixtures =
      fixtures;


    state.lastSuccessfulFixtures =
      Date.now();


    applyFilters();


    console.log(
      `R❤️İ: ${fixtures.length} maç yüklendi.`
    );


    return fixtures;

  } finally {

    state.loading =
      false;

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
      .toLocaleLowerCase(
        "tr-TR"
      );


  let fixtures =
    [
      ...state.fixtures
    ];


  if (search) {

    fixtures =
      fixtures.filter(
        match => {

          const home =
            match?.teams?.home?.name ||
            "";

          const away =
            match?.teams?.away?.name ||
            "";

          const league =
            match?.league?.name ||
            "";


          const text =
            `${home} ${away} ${league}`
              .toLocaleLowerCase(
                "tr-TR"
              );


          return text.includes(
            search
          );
        }
      );
  }


  state.filteredFixtures =
    fixtures;


  renderFixtures(
    fixtures
  );
}


/* =========================================================
   MATCH CARDS
   ========================================================= */

function renderFixtures(
  fixtures
) {

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

    console.warn(
      "R❤️İ: Maç container bulunamadı."
    );

    return;
  }


  if (!fixtures.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Bugün için maç bulunamadı</h3>
        <p>Başka bir tarih veya arama deneyebilirsin.</p>
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
                Number(
                  item?.fixture?.id
                ) === id
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

function createMatchCard(
  match,
  index
) {

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
    home.name ||
    "Ev Sahibi";

  const awayName =
    away.name ||
    "Deplasman";


  const homeLogo =
    home.logo || "";

  const awayLogo =
    away.logo || "";


  const date =
    fixture.date
      ? new Date(
          fixture.date
        )
      : null;


  const time =
    date &&
    !Number.isNaN(
      date.getTime()
    )
      ? date.toLocaleTimeString(
          "tr-TR",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )
      : "--:--";


  const leagueName =
    league.name ||
    "Lig";


  const status =
    fixture?.status?.short ||
    "";


  const live =
    [
      "1H",
      "2H",
      "ET",
      "P",
      "LIVE"
    ].includes(
      status
    );


  return `
    <article
      class="match-card"
      data-fixture-id="${escapeHTML(
        fixture.id
      )}"
      data-index="${index}"
    >

      <div class="match-card-top">

        <span class="league-name">
          ${escapeHTML(
            leagueName
          )}
        </span>

        <span class="match-time ${
          live ? "live" : ""
        }">

          ${
            live
              ? "🔴 CANLI"
              : escapeHTML(time)
          }

        </span>

      </div>


      <div class="teams">

        <div class="team">

          ${
            homeLogo
              ? `
                <img
                  src="${escapeHTML(
                    homeLogo
                  )}"
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
            ${escapeHTML(
              homeName
            )}
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
                  src="${escapeHTML(
                    awayLogo
                  )}"
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
            ${escapeHTML(
              awayName
            )}
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

async function openMatchAnalysis(
  match
) {

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
    Maç açılınca sadece 1 prediction isteği.
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
    data?.response?.[0]
      ?.predictions ||
    {};


  const home =
    match?.teams?.home?.name ||
    "Ev Sahibi";


  const away =
    match?.teams?.away?.name ||
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
          ${escapeHTML(
            winner
          )}
        </strong>

      </div>


      ${
        btts !== undefined &&
        btts !== null
          ? `
            <div class="analysis-row">

              <span>
                KG
              </span>

              <strong>
                ${escapeHTML(
                  formatPredictionValue(
                    btts
                  )
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

              <span>
                2.5 Gol
              </span>

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
        ${escapeHTML(
          advice
        )}
      </p>

    </div>


    <div class="analysis-section">

      <h3>
        📊 Detaylı Analiz
      </h3>

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

          loadExtraAnalysis(
            button.dataset
              .analysisAction,
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


  if (!id) {
    return;
  }


  const endpointMap = {

    h2h:
      "h2h",

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


  /*
    Rate-limit varsa hiçbir detay
    endpoint'ine gitme.
  */

  if (
    isRateLimited()
  ) {

    showToast(
      `API limiti aktif. ${getRemainingCooldown()} saniye sonra tekrar deneyebilirsin.`,
      "warning"
    );

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


  if (
    type === "h2h"
  ) {

    const homeId =
      match?.teams?.home?.id;

    const awayId =
      match?.teams?.away?.id;


    if (
      homeId &&
      awayId
    ) {

      params = {

        h2h:
          `${homeId}-${awayId}`,

        last: 10
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


  const old =
    container.querySelector(
      ".extra-analysis-result"
    );


  if (old) {
    old.remove();
  }


  const section =
    document.createElement(
      "div"
    );


  section.className =
    "analysis-section extra-analysis-result";


  const result =
    Array.isArray(
      data?.response
    )
      ? data.response
      : [];


  const titles = {

    h2h:
      "H2H",

    statistics:
      "İstatistikler",

    lineups:
      "Kadrolar",

    injuries:
      "Sakatlıklar"
  };


  const title =
    titles[type] ||
    "Analiz";


  section.innerHTML = `

    <h3>
      ${escapeHTML(title)}
    </h3>

    ${
      result.length
        ? `

          <div class="analysis-result-count">

            ${result.length}
            veri bulundu.

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
   PREDICTION FORMAT
   ========================================================= */

function formatPredictionValue(
  value
) {

  if (
    typeof value ===
    "string"
  ) {

    return value;
  }


  if (
    typeof value ===
    "boolean"
  ) {

    return value
      ? "Evet"
      : "Hayır";
  }


  if (
    value &&
    typeof value ===
    "object"
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

function changeDate(
  days
) {

  const date =
    new Date(
      state.selectedDate
    );


  date.setDate(
    date.getDate() +
    days
  );


  state.selectedDate =
    date;


  /*
    Yeni tarih için yalnızca
    bir fixtures isteği.
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

  const input =
    getElement(
      "#search",
      "#search-input",
      'input[type="search"]',
      ".search-input"
    );


  if (!input) {
    return;
  }


  let timer;


  input.addEventListener(
    "input",
    event => {

      clearTimeout(
        timer
      );


      timer =
        setTimeout(
          () => {

            state.searchTerm =
              event.target.value ||
              "";

            applyFilters();

          },
          200
        );
    }
  );
}


/* =========================================================
   DATE BUTTONS
   ========================================================= */

function setupDateButtons() {

  getElements(
    "[data-date-prev]",
    "#prev-day",
    ".prev-day"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          changeDate(-1)
      );

    }
  );


  getElements(
    "[data-date-next]",
    "#next-day",
    ".next-day"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          changeDate(1)
      );

    }
  );


  getElements(
    "[data-date-today]",
    "#today",
    ".today"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        setToday
      );

    }
  );
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
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        closeAnalysisDrawer
      );

    }
  );
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

            <p>
              Maçlar yükleniyor...
            </p>

          </div>

        `;
      }

    }
  );
}


function hideLoading() {}


/* =========================================================
   RATE LIMIT SCREEN
   ========================================================= */

function showRateLimitState() {

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


  const seconds =
    getRemainingCooldown();


  container.innerHTML = `

    <div class="empty-state">

      <div class="empty-icon">
        ⏳
      </div>

      <h3>
        API bağlantısı geçici olarak beklemede
      </h3>

      <p>
        API-Football dakika limiti nedeniyle
        yeni istek şu anda gönderilmiyor.
      </p>

      <p>
        Yaklaşık
        <strong>
          ${seconds}
        </strong>
        saniye sonra tekrar deneyebilirsin.
      </p>

      <button
        type="button"
        id="rii-retry-api"
        class="refresh-button"
      >
        Tekrar Dene
      </button>

    </div>

  `;


  const retry =
    document.querySelector(
      "#rii-retry-api"
    );


  if (retry) {

    retry.addEventListener(
      "click",
      () => {

        if (
          isRateLimited()
        ) {

          showToast(
            `Henüz erken. ${getRemainingCooldown()} saniye bekle.`,
            "warning"
          );

          return;
        }


        loadFixtures({
          forceRefresh: true
        });

      }
    );
  }
}


/* =========================================================
   EMPTY
   ========================================================= */

function showEmptyState(
  message
) {

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
      5000
    );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

  getElements(
    "[data-section]",
    ".nav-item",
    ".sidebar-item"
  ).forEach(
    button => {

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
          ).forEach(
            item => {

              item.classList.remove(
                "active"
              );

            }
          );


          button.classList.add(
            "active"
          );


          applySectionFilter(
            section
          );

        }
      );

    }
  );
}


function applySectionFilter(
  section
) {

  /*
    Şimdilik API çağrısı yok.
  */

  const fixtures =
    [
      ...state.fixtures
    ];


  state.filteredFixtures =
    fixtures;


  renderFixtures(
    fixtures
  );
}


/* =========================================================
   MANUAL REFRESH
   ========================================================= */

async function manualRefresh() {

  if (
    isRateLimited()
  ) {

    showToast(
      `API limiti aktif. ${getRemainingCooldown()} saniye bekle.`,
      "warning"
    );

    return;
  }


  /*
    Force refresh yalnızca kullanıcı
    özellikle butona basarsa çalışır.
  */

  await loadFixtures({
    forceRefresh: true
  });
}


/* =========================================================
   REFRESH BUTTON
   ========================================================= */

function setupRefresh() {

  getElements(
    "[data-refresh]",
    "#refresh",
    ".refresh-button"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        manualRefresh
      );

    }
  );
}


/* =========================================================
   AUTO REFRESH
   ========================================================= */

function startSafeAutoRefresh() {

  /*
    KAPALI.

    Sayfa açık kaldığı sürece
    API'ye otomatik istek gönderilmez.
  */

  console.log(
    "R❤️İ: Otomatik API yenileme KAPALI."
  );
}


/* =========================================================
   CACHE CLEANUP
   ========================================================= */

function cleanupOldCache() {

  try {

    const now =
      Date.now();


    for (
      let i =
        localStorage.length - 1;
      i >= 0;
      i--
    ) {

      const key =
        localStorage.key(i);


      if (
        !key ||
        !key.startsWith(
          CACHE_PREFIX
        )
      ) {
        continue;
      }


      /*
        Rate limit kaydını silme.
      */

      if (
        key ===
        `${CACHE_PREFIX}rate_limit`
      ) {
        continue;
      }


      try {

        const item =
          JSON.parse(
            localStorage.getItem(
              key
            )
          );


        if (
          item &&
          item.timestamp &&
          now -
            item.timestamp >
            24 * 60 * 60 * 1000
        ) {

          localStorage.removeItem(
            key
          );
        }

      } catch {

        localStorage.removeItem(
          key
        );
      }
    }

  } catch (error) {

    console.warn(
      "Cache temizleme hatası:",
      error
    );
  }
}


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  event => {

    console.warn(
      "R❤️İ Promise hatası:",
      event.reason
    );

    event.preventDefault();
  }
);


window.addEventListener(
  "error",
  event => {

    console.warn(
      "R❤️İ JavaScript hatası:",
      event.error ||
      event.message
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
    SADECE 1 endpoint:
    fixtures?date=YYYY-MM-DD
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
  document.readyState ===
  "loading"
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
   GLOBAL RII API
   ========================================================= */

window.RII = {

  state,

  api,

  loadFixtures,

  openMatchAnalysis,

  manualRefresh,

  changeDate,

  setToday,

  getRateLimitSeconds() {

    return getRemainingCooldown();
  },


  isRateLimited() {

    return isRateLimited();
  },


  clearCache() {

    try {

      for (
        let i =
          localStorage.length - 1;
        i >= 0;
        i--
      ) {

        const key =
          localStorage.key(i);


        if (
          key &&
          key.startsWith(
            CACHE_PREFIX
          ) &&
          key !==
            `${CACHE_PREFIX}rate_limit`
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
