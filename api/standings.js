const API_BASE = "https://v3.football.api-sports.io";

export default async function handler(req, res) {
  try {
    const { league, season } = req.query;

    if (!league || !season) {
      return res.status(400).json({
        success: false,
        error: "league ve season parametreleri gerekli."
      });
    }

    const response = await fetch(
      `${API_BASE}/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    const data = await response.json();

    return res.status(response.status).json({
      success: response.ok,
      ...data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
