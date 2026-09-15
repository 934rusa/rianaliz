// R❤️İ Football - Analysis Engine

function avg(arr) {
  const nums = arr.filter(v => typeof v === "number");
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getGoals(match) {
  return {
    scored: Number(match?.goals?.for ?? match?.goals?.scored ?? 0),
    conceded: Number(match?.goals?.against ?? match?.goals?.conceded ?? 0)
  };
}

function formScore(matches, teamId) {
  if (!Array.isArray(matches) || !matches.length) {
    return {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      ppg: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      avgGoalsFor: 0,
      avgGoalsAgainst: 0
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {
    const homeId = match?.teams?.home?.id;
    const awayId = match?.teams?.away?.id;

    const homeGoals = Number(match?.goals?.home ?? 0);
    const awayGoals = Number(match?.goals?.away ?? 0);

    if (homeId === teamId) {
      goalsFor += homeGoals;
      goalsAgainst += awayGoals;

      if (homeGoals > awayGoals) {
        wins++;
        points += 3;
      } else if (homeGoals === awayGoals) {
        draws++;
        points += 1;
      } else {
        losses++;
      }
    }

    if (awayId === teamId) {
      goalsFor += awayGoals;
      goalsAgainst += homeGoals;

      if (awayGoals > homeGoals) {
        wins++;
        points += 3;
      } else if (awayGoals === homeGoals) {
        draws++;
        points += 1;
      } else {
        losses++;
      }
    }
  }

  const played = wins + draws + losses;

  return {
    played,
    wins,
    draws,
    losses,
    points,
    ppg: played ? points / played : 0,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: played ? goalsFor / played : 0,
    avgGoalsAgainst: played ? goalsAgainst / played : 0
  };
}

function calculateBTTS(home, away) {
  const homeAttack = home.avgGoalsFor;
  const awayAttack = away.avgGoalsFor;
  const homeDefense = home.avgGoalsAgainst;
  const awayDefense = away.avgGoalsAgainst;

  let score =
    homeAttack * 22 +
    awayAttack * 22 +
    homeDefense * 16 +
    awayDefense * 16;

  return clamp(score);
}

function calculateOver25(home, away) {
  const expectedGoals =
    (home.avgGoalsFor +
      away.avgGoalsFor +
      home.avgGoalsAgainst +
      away.avgGoalsAgainst) / 2;

  return clamp((expectedGoals / 3.2) * 100);
}

function calculateHomeWin(home, away) {
  let score = 50;

  score += (home.ppg - away.ppg) * 14;
  score += (home.avgGoalsFor - away.avgGoalsFor) * 8;
  score += (away.avgGoalsAgainst - home.avgGoalsAgainst) * 5;

  return clamp(score);
}

function calculateAwayWin(home, away) {
  let score = 50;

  score += (away.ppg - home.ppg) * 14;
  score += (away.avgGoalsFor - home.avgGoalsFor) * 8;
  score += (home.avgGoalsAgainst - away.avgGoalsAgainst) * 5;

  return clamp(score);
}

function calculateDraw(home, away) {
  const ppgDiff = Math.abs(home.ppg - away.ppg);
  const attackDiff = Math.abs(home.avgGoalsFor - away.avgGoalsFor);

  return clamp(45 - ppgDiff * 10 - attackDiff * 6);
}

function goalRange(expectedGoals) {
  if (expectedGoals < 1.5) return "0-1";
  if (expectedGoals < 2.5) return "1-2";
  if (expectedGoals < 3.5) return "2-3";
  if (expectedGoals < 4.5) return "3-4";
  return "4+";
}

function scorePrediction(home, away) {
  const homeExpected =
    (home.avgGoalsFor + away.avgGoalsAgainst) / 2;

  const awayExpected =
    (away.avgGoalsFor + home.avgGoalsAgainst) / 2;

  return {
    home: Math.max(0, Math.round(homeExpected)),
    away: Math.max(0, Math.round(awayExpected)),
    expectedHomeGoals: homeExpected,
    expectedAwayGoals: awayExpected
  };
}

function analyzeTeam(teamData, teamId) {
  const last10 = formScore(teamData?.last10 || [], teamId);
  const last5 = formScore(
    Array.isArray(teamData?.last10)
      ? teamData.last10.slice(0, 5)
      : [],
    teamId
  );

  return {
    last5,
    last10
  };
}

export function analyzeMatch(data) {
  const homeId = data?.teams?.home?.id;
  const awayId = data?.teams?.away?.id;

  const homeAnalysis = analyzeTeam(
    data?.analysis_data?.home_form,
    homeId
  );

  const awayAnalysis = analyzeTeam(
    data?.analysis_data?.away_form,
    awayId
  );

  const home = homeAnalysis.last10;
  const away = awayAnalysis.last10;

  const homeWin = calculateHomeWin(home, away);
  const draw = calculateDraw(home, away);
  const awayWin = calculateAwayWin(home, away);

  const total = homeWin + draw + awayWin;

  const result = {
    homeWin: Math.round((homeWin / total) * 100),
    draw: Math.round((draw / total) * 100),
    awayWin: Math.round((awayWin / total) * 100)
  };

  const btts = calculateBTTS(home, away);
  const over25 = calculateOver25(home, away);

  const score = scorePrediction(home, away);

  const expectedGoals =
    score.expectedHomeGoals +
    score.expectedAwayGoals;

  const confidence = clamp(
    Math.max(
      result.homeWin,
      result.draw,
      result.awayWin,
      btts,
      over25
    )
  );

  let strongestPick = "KG Var";

  if (result.homeWin >= result.awayWin && result.homeWin >= result.draw) {
    strongestPick = "MS 1";
  }

  if (
    result.awayWin > result.homeWin &&
    result.awayWin >= result.draw
  ) {
    strongestPick = "MS 2";
  }

  if (
    btts > Math.max(result.homeWin, result.awayWin, result.draw) &&
    btts >= 60
  ) {
    strongestPick = "KG Var";
  }

  if (
    over25 > Math.max(result.homeWin, result.awayWin, result.draw) &&
    over25 >= 60
  ) {
    strongestPick = "2.5 Üst";
  }

  let risk = "Orta";

  if (confidence >= 75) {
    risk = "Düşük";
  } else if (confidence < 55) {
    risk = "Yüksek";
  }

  return {
    result,
    btts: {
      yes: Math.round(btts),
      no: Math.round(100 - btts)
    },
    over25: {
      over: Math.round(over25),
      under: Math.round(100 - over25)
    },
    score_prediction: {
      home: score.home,
      away: score.away
    },
    expected_goals: Number(expectedGoals.toFixed(2)),
    goal_range: goalRange(expectedGoals),
    strongest_pick: strongestPick,
    confidence: Math.round(confidence),
    risk,
    teams: {
      home: homeAnalysis,
      away: awayAnalysis
    }
  };
}

export default analyzeMatch;
