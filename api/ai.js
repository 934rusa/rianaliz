export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Sadece POST destekleniyor."
      });
    }

    const data = req.body || {};

    const analysis = data.analysis || {};
    const home = data.home || "Ev sahibi";
    const away = data.away || "Deplasman";

    const strongest = analysis.strongest_pick || "Belirgin seçim yok";
    const confidence = analysis.confidence ?? 0;
    const risk = analysis.risk || "Belirsiz";

    const score = analysis.score_prediction || {};
    const btts = analysis.btts || {};
    const over25 = analysis.over25 || {};

    const commentary =
      `${home} - ${away} karşılaşması için model; ` +
      `MS olasılıkları, gol ortalamaları, KG verileri ve form göstergelerini birlikte değerlendirdi. ` +
      `Modelin öne çıkardığı seçim: ${strongest}. ` +
      `Model güven seviyesi %${confidence}, risk seviyesi ${risk}. ` +
      `Tahmini skor ${score.home ?? "?"}-${score.away ?? "?"}. ` +
      `KG Var olasılığı %${btts.yes ?? 0}, 2.5 Üst olasılığı %${over25.over ?? 0}.`;

    return res.status(200).json({
      success: true,
      ai: {
        commentary,
        strongest_pick: strongest,
        confidence,
        risk
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
