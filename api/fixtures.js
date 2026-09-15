export default async function handler(req, res) {
  try {
    const date = req.query.date || "2026-09-15";

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}`,
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "API bağlantı hatası",
      message: error.message
    });
  }
}
