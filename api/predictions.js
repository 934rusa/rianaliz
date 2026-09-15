export default function predictions(analysis) {
  if (!analysis) return {};

  const result = analysis.result || {};
  const btts = analysis.btts || {};
  const over25 = analysis.over25 || {};

  const markets = {
    match_result: {
      home: result.homeWin ?? 0,
      draw: result.draw ?? 0,
      away: result.awayWin ?? 0
    },

    btts: {
      yes: btts.yes ?? 0,
      no: btts.no ?? 0
    },

    first_half_btts: Math.round((btts.yes ?? 0) * 0.82),

    second_half_btts: Math.round((btts.yes ?? 0) * 0.90),

    over_15: Math.min(95, Math.round((over25.over ?? 0) + 14)),

    over_25: {
      over: over25.over ?? 0,
      under: over25.under ?? 0
    },

    over_35: Math.max(5, Math.round((over25.over ?? 0) * 0.62)),

    first_half_result: {
      home: Math.round((result.homeWin ?? 0) * 0.72),
      draw: Math.round((result.draw ?? 0) * 1.15),
      away: Math.round((result.awayWin ?? 0) * 0.72)
    },

    second_half_result: {
      home: Math.round((result.homeWin ?? 0) * 0.88),
      draw: Math.round((result.draw ?? 0) * 0.85),
      away: Math.round((result.awayWin ?? 0) * 0.88)
    },

    score: analysis.score_prediction || null,

    goal_range: analysis.goal_range || null,

    strongest_pick: analysis.strongest_pick || null,

    confidence: analysis.confidence ?? 0,

    risk: analysis.risk || "Belirsiz"
  };

  return {
    success: true,
    predictions: markets
  };
}
