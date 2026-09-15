export default async function handler(req, res) {
  // =========================================================
  // R❤️İ FOOTBALL — MATCH DATA ENGINE
  // =========================================================

  const API_BASE = "https://v3.football.api-sports.io";
  const API_KEY = process.env.API_FOOTBALL_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      error: "API_FOOTBALL_KEY Vercel Environment Variable olarak bulunamadı."
    });
  }

  const fixture = req.query.fixture;

  if (!fixture) {
    return res.status(400).json({
      success: false,
      error: "fixture parametresi gerekli.",
      example: "/api/match?fixture=123456"
    });
  }

  const headers = {
    "x-apisports-key": API_KEY
  };

  async function api(endpoint, params = {}) {
    const url = new URL(API_BASE + endpoint);

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `API geçersiz cevap döndürdü. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.errors
          ? JSON.stringify(data.errors)
          : `API HTTP ${response.status}`
      );
    }

    if (
      data.errors &&
      Object.keys(data.errors).length > 0
    ) {
      throw new Error(JSON.stringify(data.errors));
    }

    return data;
  }

  async function safeApi(endpoint, params = {}) {
    try {
      const data = await api(endpoint, params);

      return {
        ok: true,
        data
      };
    } catch (error) {
      console.error(
        `R❤️İ API ERROR ${endpoint}:`,
        error.message
      );

      return {
        ok: false,
        data: null,
        error: error.message
      };
    }
  }

  try {
    // =======================================================
    // 1 — MAÇ
    // =======================================================

    const fixtureData = await safeApi("/fixtures", {
      id: fixture
    });

    if (
      !fixtureData.ok ||
      !fixtureData.data ||
      !Array.isArray(fixtureData.data.response) ||
      fixtureData.data.response.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error: "Maç bulunamadı.",
        fixture
      });
    }

    const match = fixtureData.data.response[0];

    const homeTeam = match.teams?.home || {};
    const awayTeam = match.teams?.away || {};
    const league = match.league || {};

    const homeId = homeTeam.id;
    const awayId = awayTeam.id;

    // =======================================================
    // 2 — SON 10 MAÇ
    // =======================================================

    const homeLast = homeId
      ? await safeApi("/fixtures", {
          team: homeId,
          last: 10
        })
      : {
          ok: false,
          data: null,
          error: "Home team ID bulunamadı."
        };

    const awayLast = awayId
      ? await safeApi("/fixtures", {
          team: awayId,
          last: 10
        })
      : {
          ok: false,
          data: null,
          error: "Away team ID bulunamadı."
        };

    // =======================================================
    // 3 — H2H
    // =======================================================

    const h2h =
      homeId && awayId
        ? await safeApi("/fixtures/headtohead", {
            h2h: `${homeId}-${awayId}`,
            last: 10
          })
        : {
            ok: false,
            data: null,
            error: "Takım ID'leri bulunamadı."
          };

    // =======================================================
    // 4 — PUAN DURUMU
    // =======================================================

    const standings =
      league.id && league.season
        ? await safeApi("/standings", {
            league: league.id,
            season: league.season
          })
        : {
            ok: false,
            data: null,
            error: "Lig bilgisi bulunamadı."
          };

    // =======================================================
    // 5 — TAKIM İSTATİSTİKLERİ
    // =======================================================

    const homeStats =
      homeId && league.id && league.season
        ? await safeApi("/teams/statistics", {
            league: league.id,
            season: league.season,
            team: homeId
          })
        : {
            ok: false,
            data: null,
            error: "Home takım istatistikleri alınamadı."
          };

    const awayStats =
      awayId && league.id && league.season
        ? await safeApi("/teams/statistics", {
            league: league.id,
            season: league.season,
            team: awayId
          })
        : {
            ok: false,
            data: null,
            error: "Away takım istatistikleri alınamadı."
          };

    // =======================================================
    // 6 — KADROLAR
    // =======================================================

    const lineups = await safeApi("/fixtures/lineups", {
      fixture
    });

    // =======================================================
    // 7 — SAKATLIK / CEZA
    // =======================================================

    const injuries = await safeApi("/injuries", {
      fixture
    });

    // =======================================================
    // 8 — MAÇ İSTATİSTİKLERİ
    // =======================================================

    const statistics = await safeApi(
      "/fixtures/statistics",
      {
        fixture
      }
    );

    // =======================================================
    // 9 — ORANLAR
    // =======================================================

    const odds = await safeApi("/odds", {
      fixture
    });

    // =======================================================
    // 10 — API-FOOTBALL PREDICTION
    // =======================================================

    const predictions = await safeApi(
      "/predictions",
      {
        fixture
      }
    );

    // =======================================================
    // 11 — NORMALİZE SONUÇ
    // =======================================================

    const result = {
      success: true,

      generated_at: new Date().toISOString(),

      fixture: {
        id: Number(fixture),
        date: match.fixture?.date || null,
        timestamp: match.fixture?.timestamp || null,
        timezone: match.fixture?.timezone || null,
        status: match.fixture?.status || null,

        venue: match.fixture?.venue || null,
        referee: match.fixture?.referee || null
      },

      league: {
        id: league.id || null,
        name: league.name || null,
        country: league.country || null,
        logo: league.logo || null,
        season: league.season || null,
        round: league.round || null
      },

      teams: {
        home: homeTeam,
        away: awayTeam
      },

      goals: {
        home: match.goals?.home ?? null,
        away: match.goals?.away ?? null
      },

      halftime: {
        home: match.score?.halftime?.home ?? null,
        away: match.score?.halftime?.away ?? null
      },

      fulltime: {
        home: match.score?.fulltime?.home ?? null,
        away: match.score?.fulltime?.away ?? null
      },

      extratime: {
        home: match.score?.extratime?.home ?? null,
        away: match.score?.extratime?.away ?? null
      },

      penalty: {
        home: match.score?.penalty?.home ?? null,
        away: match.score?.penalty?.away ?? null
      },

      // =====================================================
      // ANALİZ MOTORUNA GİDECEK VERİLER
      // =====================================================

      analysis_data: {

        form: {
          home: homeLast.data?.response || [],
          away: awayLast.data?.response || []
        },

        h2h: h2h.data?.response || [],

        standings:
          standings.data?.response || [],

        team_statistics: {
          home: homeStats.data?.response || [],
          away: awayStats.data?.response || []
        },

        lineups:
          lineups.data?.response || [],

        injuries:
          injuries.data?.response || [],

        statistics:
          statistics.data?.response || [],

        odds:
          odds.data?.response || [],

        api_prediction:
          predictions.data?.response || []
      },

      // =====================================================
      // ENDPOINT DURUMLARI
      // =====================================================

      data_status: {
        fixture: fixtureData.ok,
        home_form: homeLast.ok,
        away_form: awayLast.ok,
        h2h: h2h.ok,
        standings: standings.ok,
        home_statistics: homeStats.ok,
        away_statistics: awayStats.ok,
        lineups: lineups.ok,
        injuries: injuries.ok,
        statistics: statistics.ok,
        odds: odds.ok,
        predictions: predictions.ok
      }
    };

    return res.status(200).json(result);

  } catch (error) {

    console.error(
      "R❤️İ MATCH ENGINE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Maç analiz verileri alınırken hata oluştu.",
      message: error.message
    });
  }
}
