export default async function handler(req, res) {
  // =========================================================
  // R❤️İ FOOTBALL — MATCH DATA ENGINE
  // Bir maç için analiz verilerini toplar.
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

  // ---------------------------------------------------------
  // API-Football çağrısı
  // ---------------------------------------------------------

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.errors
          ? JSON.stringify(data.errors)
          : `API HTTP ${response.status}`
      );
    }

    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(JSON.stringify(data.errors));
    }

    return data;
  }

  // ---------------------------------------------------------
  // Güvenli çağrı
  // Bir endpoint hata verirse bütün maç analizi çökmeyecek.
  // ---------------------------------------------------------

  async function safeApi(endpoint, params = {}) {
    try {
      const data = await api(endpoint, params);

      return {
        ok: true,
        data
      };
    } catch (error) {
      return {
        ok: false,
        data: null,
        error: error.message
      };
    }
  }

  try {
    // =======================================================
    // 1 — MAÇ BİLGİSİ
    // =======================================================

    const fixtureData = await safeApi("/fixtures", {
      id: fixture
    });

    // Maç bulunamadıysa devam etmenin anlamı yok.
    if (
      !fixtureData.ok ||
      !fixtureData.data ||
      !fixtureData.data.response ||
      fixtureData.data.response.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error: "Maç bulunamadı.",
        fixture
      });
    }

    const match = fixtureData.data.response[0];

    const homeTeam = match.teams?.home;
    const awayTeam = match.teams?.away;
    const league = match.league;

    const homeId = homeTeam?.id;
    const awayId = awayTeam?.id;

    // =======================================================
    // 2 — SON MAÇLAR
    // =======================================================

    const homeLast = await safeApi("/fixtures", {
      team: homeId,
      last: 10
    });

    const awayLast = await safeApi("/fixtures", {
      team: awayId,
      last: 10
    });

    // =======================================================
    // 3 — H2H
    // =======================================================

    const h2h = await safeApi("/fixtures/headtohead", {
      h2h: `${homeId}-${awayId`,
      last: 10
    });

    // =======================================================
    // 4 — PUAN DURUMU
    // =======================================================

    const standings = await safeApi("/standings", {
      league: league?.id,
      season: league?.season
    });

    // =======================================================
    // 5 — TAKIM İSTATİSTİKLERİ
    // =======================================================

    const homeStats = await safeApi("/teams/statistics", {
      league: league?.id,
      season: league?.season,
      team: homeId
    });

    const awayStats = await safeApi("/teams/statistics", {
      league: league?.id,
      season: league?.season,
      team: awayId
    });

    // =======================================================
    // 6 — KADROLAR
    // =======================================================

    const lineups = await safeApi("/fixtures/lineups", {
      fixture
    });

    // =======================================================
    // 7 — SAKATLIKLAR / CEZALAR
    // =======================================================

    const injuries = await safeApi("/injuries", {
      fixture
    });

    // =======================================================
    // 8 — MAÇ İSTATİSTİKLERİ
    // =======================================================

    const statistics = await safeApi("/fixtures/statistics", {
      fixture
    });

    // =======================================================
    // 9 — ORANLAR
    // =======================================================

    const odds = await safeApi("/odds", {
      fixture
    });

    // =======================================================
    // 10 — API-FOOTBALL TAHMİNİ
    // Bunu bizim AI tahminimiz olarak kullanmayacağız.
    // Sadece yardımcı veri olarak saklıyoruz.
    // =======================================================

    const predictions = await safeApi("/predictions", {
      fixture
    });

    // =======================================================
    // 11 — SONUÇ
    // =======================================================

    const result = {
      success: true,

      generated_at: new Date().toISOString(),

      fixture: {
        id: Number(fixture),
        date: match.fixture?.date,
        timestamp: match.fixture?.timestamp,
        timezone: match.fixture?.timezone,
        status: match.fixture?.status,

        venue: match.fixture?.venue,
        referee: match.fixture?.referee
      },

      league: {
        id: league?.id,
        name: league?.name,
        country: league?.country,
        logo: league?.logo,
        season: league?.season,
        round: league?.round
      },

      teams: {
        home: homeTeam,
        away: awayTeam
      },

      goals: {
        home: match.goals?.home,
        away: match.goals?.away
      },

      halftime: {
        home: match.score?.halftime?.home,
        away: match.score?.halftime?.away
      },

      fulltime: {
        home: match.score?.fulltime?.home,
        away: match.score?.fulltime?.away
      },

      extratime: {
        home: match.score?.extratime?.home,
        away: match.score?.extratime?.away
      },

      penalty: {
        home: match.score?.penalty?.home,
        away: match.score?.penalty?.away
      },

      analysis_data: {

        form: {
          home: homeLast,
          away: awayLast
        },

        h2h,

        standings,

        team_statistics: {
          home: homeStats,
          away: awayStats
        },

        lineups,

        injuries,

        statistics,

        odds,

        api_prediction: predictions
      }
    };

    return res.status(200).json(result);

  } catch (error) {

    console.error("R❤️İ MATCH ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Maç analiz verileri alınırken hata oluştu.",
      message: error.message
    });
  }
}
