// R❤️İ FOOTBALL — ADVANCED ANALYSIS ENGINE

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function avg(values) {
  const valid = values.filter(
    v => typeof v === "number" && Number.isFinite(v)
  );

  if (!valid.length) return 0;

  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function poissonProbability(lambda, goals) {
  if (lambda <= 0) return goals === 0 ? 1 : 0;

  let factorial = 1;

  for (let i = 1; i <= goals; i++) {
    factorial *= i;
  }

  return (
    Math.exp(-lambda) *
    Math.pow(lambda, goals) /
    factorial
  );
}

function extractMatches(formData) {
  if (!formData) return [];

  if (Array.isArray(formData)) {
    return formData;
  }

  if (Array.isArray(formData.response)) {
    return formData.response;
  }

  if (Array.isArray(formData.data?.response)) {
    return formData.data.response;
  }

  return [];
}

function teamResult(match, teamId) {
  const homeId = match?.teams?.home?.id;
  const awayId = match?.teams?.away?.id;

  const homeGoals = match?.goals?.home;
  const awayGoals = match?.goals?.away;

  if (
    homeGoals === null ||
    homeGoals === undefined ||
    awayGoals === null ||
    awayGoals === undefined
  ) {
    return null;
  }

  const isHome = homeId === teamId;

  const gf = isHome ? homeGoals : awayGoals;
  const ga = isHome ? awayGoals : homeGoals;

  if (gf > ga) return "W";
  if (gf === ga) return "D";

  return "L";
}

function teamGoals(match, teamId) {
  const homeId = match?.teams?.home?.id;
  const isHome = homeId === teamId;

  return {
    scored: isHome
      ? match?.goals?.home ?? 0
      : match?.goals?.away ?? 0,

    conceded: isHome
      ? match?.goals?.away ?? 0
      : match?.goals?.home ?? 0
  };
}

function analyzeForm(formData, teamId) {
  const matches = extractMatches(formData)
    .filter(m => m?.teams && m?.goals)
    .slice(0, 15);

  const results = [];
  const scored = [];
  const conceded = [];

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let btts = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  for (const match of matches) {
    const result = teamResult(match, teamId);
    const goals = teamGoals(match, teamId);

    if (result === "W") wins++;
    if (result === "D") draws++;
    if (result === "L") losses++;

    scored.push(goals.scored);
    conceded.push(goals.conceded);

    if (goals.scored > 0 && goals.conceded > 0) {
      btts++;
    }

    const total = goals.scored + goals.conceded;

    if (total > 1.5) over15++;
    if (total > 2.5) over25++;
    if (total > 3.5) over35++;

    results.push(result);
  }

  const count = matches.length || 1;

  return {
    matches: matches.length,

    results,

    wins,
    draws,
    losses,

    winRate: wins / count * 100,
    drawRate: draws / count * 100,
    lossRate: losses / count * 100,

    goalsScored: avg(scored),
    goalsConceded: avg(conceded),

    bttsRate: btts / count * 100,

    over15Rate: over15 / count * 100,
    over25Rate: over25 / count * 100,
    over35Rate: over35 / count * 100
  };
}

function calculateExpectedGoals(homeForm, awayForm) {

  const homeAttack = homeForm.goalsScored || 1.2;
  const homeDefense = homeForm.goalsConceded || 1.2;

  const awayAttack = awayForm.goalsScored || 1.1;
  const awayDefense = awayForm.goalsConceded || 1.2;

  let homeXG =
    (homeAttack * 0.60) +
    (awayDefense * 0.40);

  let awayXG =
    (awayAttack * 0.60) +
    (homeDefense * 0.40);

  // Ev sahibi avantajı
  homeXG *= 1.08;

  return {
    home: Math.max(0.2, homeXG),
    away: Math.max(0.2, awayXG)
  };
}

function calculateScoreProbabilities(homeXG, awayXG) {

  const scores = [];

  for (let home = 0; home <= 6; home++) {

    for (let away = 0; away <= 6; away++) {

      const probability =
        poissonProbability(homeXG, home) *
        poissonProbability(awayXG, away);

      scores.push({
        home,
        away,
        probability
      });
    }
  }

  scores.sort(
    (a, b) => b.probability - a.probability
  );

  return scores;
}

function calculateMarkets(homeXG, awayXG) {

  const scores = calculateScoreProbabilities(
    homeXG,
    awayXG
  );

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let btts = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  let homeGoal = 0;
  let awayGoal = 0;

  let firstHalfGoal = 0;
  let secondHalfGoal = 0;

  for (const score of scores) {

    const p = score.probability;
    const total = score.home + score.away;

    if (score.home > score.away) {
      homeWin += p;
    }

    if (score.home === score.away) {
      draw += p;
    }

    if (score.home < score.away) {
      awayWin += p;
    }

    if (
      score.home > 0 &&
      score.away > 0
    ) {
      btts += p;
    }

    if (total >= 2) {
      over15 += p;
    }

    if (total >= 3) {
      over25 += p;
    }

    if (total >= 4) {
      over35 += p;
    }

    if (score.home >= 1) {
      homeGoal += p;
    }

    if (score.away >= 1) {
      awayGoal += p;
    }
  }

  /*
    İlk yarı yaklaşık toplam golün %44'ü,
    ikinci yarı %56'sı kabul edilir.
  */

  const totalXG = homeXG + awayXG;

  const firstHalfXG = totalXG * 0.44;
  const secondHalfXG = totalXG * 0.56;

  firstHalfGoal =
    1 - Math.exp(-firstHalfXG);

  secondHalfGoal =
    1 - Math.exp(-secondHalfXG);

  return {

    homeWin: clamp(homeWin * 100),
    draw: clamp(draw * 100),
    awayWin: clamp(awayWin * 100),

    btts: clamp(btts * 100),

    over15: clamp(over15 * 100),
    over25: clamp(over25 * 100),
    over35: clamp(over35 * 100),

    homeGoal: clamp(homeGoal * 100),
    awayGoal: clamp(awayGoal * 100),

    firstHalfGoal: clamp(
      firstHalfGoal * 100
    ),

    secondHalfGoal: clamp(
      secondHalfGoal * 100
    )
  };
}

function calculateHalfTime(homeXG, awayXG) {

  const h = homeXG * 0.44;
  const a = awayXG * 0.44;

  const scores = calculateScoreProbabilities(h, a);

  let home = 0;
  let draw = 0;
  let away = 0;

  let btts = 0;

  for (const score of scores) {

    const p = score.probability;

    if (score.home > score.away) {
      home += p;
    }

    if (score.home === score.away) {
      draw += p;
    }

    if (score.home < score.away) {
      away += p;
    }

    if (
      score.home > 0 &&
      score.away > 0
    ) {
      btts += p;
    }
  }

  return {
    homeWin: clamp(home * 100),
    draw: clamp(draw * 100),
    awayWin: clamp(away * 100),
    btts: clamp(btts * 100),

    predictedScore:
      `${scores[0]?.home ?? 0}-${scores[0]?.away ?? 0}`
  };
}

function calculateSecondHalf(
  homeXG,
  awayXG
) {

  const h = homeXG * 0.56;
  const a = awayXG * 0.56;

  const scores = calculateScoreProbabilities(h, a);

  let home = 0;
  let draw = 0;
  let away = 0;

  let btts = 0;

  for (const score of scores) {

    const p = score.probability;

    if (score.home > score.away) {
      home += p;
    }

    if (score.home === score.away) {
      draw += p;
    }

    if (score.home < score.away) {
      away += p;
    }

    if (
      score.home > 0 &&
      score.away > 0
    ) {
      btts += p;
    }
  }

  return {
    homeWin: clamp(home * 100),
    draw: clamp(draw * 100),
    awayWin: clamp(away * 100),
    btts: clamp(btts * 100),

    predictedScore:
      `${scores[0]?.home ?? 0}-${scores[0]?.away ?? 0}`
  };
}

function calculateGoalRange(homeXG, awayXG) {

  const total = homeXG + awayXG;

  if (total < 1.5) {
    return "0-2";
  }

  if (total < 2.5) {
    return "1-3";
  }

  if (total < 3.5) {
    return "2-4";
  }

  if (total < 4.5) {
    return "3-5";
  }

  return "4+";
}

function getRisk(confidence) {

  if (confidence >= 80) {
    return "Düşük";
  }

  if (confidence >= 65) {
    return "Orta";
  }

  if (confidence >= 50) {
    return "Yüksek";
  }

  return "Çok Yüksek";
}

function calculateConfidence(markets) {

  const candidates = [
    {
      name: "MS 1",
      value: markets.homeWin
    },
    {
      name: "MS X",
      value: markets.draw
    },
    {
      name: "MS 2",
      value: markets.awayWin
    },
    {
      name: "KG",
      value: markets.btts
    },
    {
      name: "1.5 Üst",
      value: markets.over15
    },
    {
      name: "2.5 Üst",
      value: markets.over25
    },
    {
      name: "3.5 Üst",
      value: markets.over35
    }
  ];

  candidates.sort(
    (a, b) => b.value - a.value
  );

  const strongest = candidates[0];

  return {
    selection: strongest.name,
    confidence: Number(
      strongest.value.toFixed(1)
    ),
    risk: getRisk(strongest.value)
  };
}

export function analyzeMatch(data) {

  const homeId = data?.teams?.home?.id;
  const awayId = data?.teams?.away?.id;

  const homeForm = analyzeForm(
    data?.analysis_data?.form?.home,
    homeId
  );

  const awayForm = analyzeForm(
    data?.analysis_data?.form?.away,
    awayId
  );

  const expectedGoals =
    calculateExpectedGoals(
      homeForm,
      awayForm
    );

  const markets =
    calculateMarkets(
      expectedGoals.home,
      expectedGoals.away
    );

  const halfTime =
    calculateHalfTime(
      expectedGoals.home,
      expectedGoals.away
    );

  const secondHalf =
    calculateSecondHalf(
      expectedGoals.home,
      expectedGoals.away
    );

  const scoreProbabilities =
    calculateScoreProbabilities(
      expectedGoals.home,
      expectedGoals.away
    );

  const bestScore =
    scoreProbabilities[0] || {
      home: 0,
      away: 0,
      probability: 0
    };

  const confidence =
    calculateConfidence(markets);

  /*
    İki yarıda da KG:
    İlk yarı KG × ikinci yarı KG
    yaklaşık bağımsızlık varsayımıyla.
  */

  const bothHalvesBTTS =
    (
      halfTime.btts *
      secondHalf.btts
    ) / 100;

  const allMarkets = {

    ...markets,

    bothHalvesBTTS:

      Number(
        bothHalvesBTTS.toFixed(1)
      ),

    firstHalfResult: {
      home: halfTime.homeWin,
      draw: halfTime.draw,
      away: halfTime.awayWin
    },

    secondHalfResult: {
      home: secondHalf.homeWin,
      draw: secondHalf.draw,
      away: secondHalf.awayWin
    }
  };

  return {

    home: homeForm,
    away: awayForm,

    expectedGoals: {
      home: Number(
        expectedGoals.home.toFixed(2)
      ),

      away: Number(
        expectedGoals.away.toFixed(2)
      ),

      total: Number(
        (
          expectedGoals.home +
          expectedGoals.away
        ).toFixed(2)
      )
    },

    markets: allMarkets,

    scorePrediction: {
      home: bestScore.home,
      away: bestScore.away,

      probability: Number(
        (
          bestScore.probability * 100
        ).toFixed(1)
      ),

      text:
        `${bestScore.home}-${bestScore.away}`
    },

    firstHalf: {
      ...halfTime
    },

    secondHalf: {
      ...secondHalf
    },

    goalRange:
      calculateGoalRange(
        expectedGoals.home,
        expectedGoals.away
      ),

    strongestSelection:
      confidence.selection,

    confidence:
      confidence.confidence,

    risk:
      confidence.risk,

    modelVersion:
      "R❤️İ Advanced Engine v2.0"
  };
}

export default analyzeMatch;
