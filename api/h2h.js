const API_BASE = "https://v3.football.api-sports.io";

export default async function handler(req, res) {
  try {
    const { h2h, last = "10" } = req.query;

    if (!h2h) {
      return res.status(400).json({
        success: false,
        error: "h2h parametresi gerekli. Örnek: 123-456"
      });
    }

    if (!process.env.API_FOOTBALL_KEY) {
      return res.status(500).json({
        success: false,
        error: "API_FOOTBALL_KEY bulunamadı."
      });
    }

    const response = await fetch(
      `${API_BASE}/fixtures/headtohead?h2h=${encodeURIComponent(h2h)}&last=${encodeURIComponent(last)}`,
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
