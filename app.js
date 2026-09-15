/* =========================================================
   R❤️İ FOOTBALL — API ENGINE
   VERCEL API MODE
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE = "";

const CACHE_PREFIX = "rii_football_";
const CACHE_VERSION = "v5";

const CACHE_TTL = {
  fixtures: 10 * 60 * 1000
};

const REQUEST_DELAY = 3000;


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

  lastError: null
};

const inflightRequests = new Map();

let lastRequestTime = 0;


/* =========================================================
   DATE
   ========================================================= */

function getDateString(date) {
  const d = new Date(date);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
  if (value === null || value === undefined) {
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
  return new Promise(resolve => setTimeout(resolve, ms));
}


function getElement(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element) {
      return element;
    }
  }

  return null;
}


function getElements(...selectors) {
  const result = [];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
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

function cacheKey(endpoint, params = {}) {
  const sortedParams = Object.keys(params)
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
    const key = cacheKey(endpoint, params);
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const item = JSON.parse(raw);

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
      Date.now() - item.timestamp;

    if (age > ttl && !allowExpired) {
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
   REQUEST QUEUE
   ========================================================= */

async function waitForRequestSlot() {
  const elapsed =
    Date.now() -
    lastRequestTime;

  if (elapsed < REQUEST_DELAY) {
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
    Aynı istek zaten devam ediyorsa
    ikinci istek gönderme.
  */

  if (
    inflightRequests.has(key)
  ) {
    return inflightRequests.get(key);
  }


  /*
    Önce cache.
  */

  if (!options.forceRefresh) {
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


  const promise =
    (async () => {

      try {

        await waitForRequestSlot();


        /*
          Vercel API endpoint'i.
          Örnek:
          /api/fixtures?date=2026-09-15
        */

        const url =
          new URL(
            `${API_BASE}/api/${endpoint}`,
            window.location.origin
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
          "R❤️İ VERCEL API:",
          url.toString()
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


        if (!response.ok) {

          const message =
            data?.message ||
            data?.error ||
            data?.errors ||
            `HTTP ${response.status}`;

          throw new Error(
            typeof message === "string"
              ? message
              : JSON.stringify(message)
          );
        }


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

    const data =
      await safeApi(
        "fixtures",
        params,
        options
      );


    if (!data) {

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
          "Güncel veri alınamadı. Önbellekteki maçlar gösteriliyor.",
          "warning"
        );

        return state.fixtures;
      }


      showEmptyState(
        "Maç verileri alınamadı."
      );

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

        <h3>
          Bugün için maç bulunamadı
        </h3>

        <p>
          Başka bir tarih veya arama deneyebilirsin.
        </p>
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
   MATCH CARD
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

function openMatchAnalysis(
  match
) {

  state.selectedFixture =
    match;


  openAnalysisDrawer();


  renderAnalysisLoading(
    match
  );


  /*
    Şimdilik ekstra API çağrısı YOK.
    Önce temel maç sistemini çalıştırıyoruz.
  */

  renderBasicAnalysis(
    match
  );
}


/* =========================================================
   BASIC ANALYSIS
   ========================================================= */

function renderBasicAnalysis(
  match
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


  const home =
    match?.teams?.home?.name ||
    "Ev Sahibi";

  const away =
    match?.teams?.away?.name ||
    "Deplasman";


  const league =
    match?.league?.name ||
    "Lig";


  const status =
    match?.fixture?.status?.long ||
    "Bilinmiyor";


  const goalsHome =
    match?.goals?.home;

  const goalsAway =
    match?.goals?.away;


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

      <p>
        ${escapeHTML(league)}
      </p>

    </div>


    <div class="analysis-section">

      <h3>
        📊 Maç Bilgileri
      </h3>

      <div class="analysis-row">

        <span>
          Durum
        </span>

        <strong>
          ${escapeHTML(status)}
        </strong>

      </div>


      ${
        goalsHome !== null &&
        goalsHome !== undefined &&
        goalsAway !== null &&
        goalsAway !== undefined
          ? `
            <div class="analysis-row">

              <span>
                Skor
              </span>

              <strong>
                ${escapeHTML(
                  `${goalsHome} - ${goalsAway}`
                )}
              </strong>

            </div>
          `
          : ""
      }

    </div>


    <div class="analysis-section">

      <h3>
        🔜 Detaylı analiz
      </h3>

      <p>
        Maç verisi başarıyla API'den alındı.
        Detaylı tahmin, H2H, kadro ve istatistik
        modülleri sonraki aşamada bağlanacak.
      </p>

    </div>

  `;
}


/* =========================================================
   ANALYSIS LOADING
   ========================================================= */

function renderAnalysisLoading(
  match
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


  container.innerHTML = `

    <div class="analysis-loading">

      <div class="loading-spinner"></div>

      <p>
        Analiz hazırlanıyor...
      </p>

    </div>

  `;
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

      container.innerHTML = `

        <div class="loading-state">

          <div class="loading-spinner"></div>

          <p>
            Maçlar yükleniyor...
          </p>

        </div>

      `;

    }
  );
}


function hideLoading() {}


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

  state.filteredFixtures =
    [
      ...state.fixtures
    ];


  renderFixtures(
    state.filteredFixtures
  );
}


/* =========================================================
   MANUAL REFRESH
   ========================================================= */

async function manualRefresh() {

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
   GLOBAL ERRORS
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


  setupSearch();

  setupDateButtons();

  setupDrawer();

  setupNavigation();

  setupRefresh();

  startSafeAutoRefresh();


  /*
    SADECE:
    /api/fixtures?date=YYYY-MM-DD
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
