// ============================================================
// R❤️İ FOOTBALL — OPENAI AI ANALYSIS ENGINE
// Vercel Serverless Function
// ============================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Sadece POST isteği kabul edilir."
    });
  }

  const API_KEY = process.env.OPENAI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "OPENAI_API_KEY Vercel Environment Variables içinde bulunamadı."
    });
  }

  try {
    const body = req.body || {};

    const match = body.match || {};
    const data = body.data || {};
    const local = body.local || {};

    const home =
      match?.teams?.home?.name ||
      match?.home?.name ||
      "Ev Sahibi";

    const away =
      match?.teams?.away?.name ||
      match?.away?.name ||
      "Deplasman";

    const league =
      match?.league?.name ||
      "Bilinmeyen Lig";

    // --------------------------------------------------------
    // AI'YA GÖNDERİLECEK VERİYİ KÜÇÜLT
    // --------------------------------------------------------

    const analysisData = {
      form: {
        home: Array.isArray(data?.form?.home)
          ? data.form.home.slice(0, 10)
          : [],
        away: Array.isArray(data?.form?.away)
          ? data.form.away.slice(0, 10)
          : []
      },

      h2h: Array.isArray(data?.h2h)
        ? data.h2h.slice(0, 10)
        : [],

      standings: Array.isArray(data?.standings)
        ? data.standings
        : [],

      team_statistics: {
        home: Array.isArray(data?.team_statistics?.home)
          ? data.team_statistics.home
          : [],

        away: Array.isArray(data?.team_statistics?.away)
          ? data.team_statistics.away
          : []
      },

      lineups: Array.isArray(data?.lineups)
        ? data.lineups.slice(0, 20)
        : [],

      injuries: Array.isArray(data?.injuries)
        ? data.injuries.slice(0, 30)
        : [],

      statistics: Array.isArray(data?.statistics)
        ? data.statistics
        : [],

      odds: Array.isArray(data?.odds)
        ? data.odds
        : [],

      api_prediction: Array.isArray(data?.api_prediction)
        ? data.api_prediction
        : []
    };

    // --------------------------------------------------------
    // LOCAL MODEL
    // --------------------------------------------------------

    const localModel = {
      confidence: local?.confidence ?? null,
      risk: local?.risk ?? null,
      predictedScore: local?.predictedScore ?? null,

      expectedHome: local?.expectedHome ?? null,
      expectedAway: local?.expectedAway ?? null,
      totalExpected: local?.totalExpected ?? null,

      probabilities: local?.probabilities || {},
      firstHalfGoalProbability:
        local?.firstHalfGoalProbability ?? null,

      secondHalfGoalProbability:
        local?.secondHalfGoalProbability ?? null,

      firstHalfBTTS:
        local?.firstHalfBTTS ?? null,

      secondHalfBTTS:
        local?.secondHalfBTTS ?? null,

      bothHalvesBTTS:
        local?.bothHalvesBTTS ?? null
    };

    // --------------------------------------------------------
    // OPENAI PROMPT
    // --------------------------------------------------------

    const prompt = `
Sen R❤️İ Football için çalışan profesyonel bir futbol analiz motorusun.

AMAÇ:
Verilen gerçek futbol verilerini analiz ederek maç için dengeli,
istatistiksel ve veri odaklı bir değerlendirme üret.

MAÇ:
${home} vs ${away}

LİG:
${league}

ÇOK ÖNEMLİ KURALLAR:

1. Kesinlik iddiasında bulunma.
2. "Kesin tutar", "banko kesin", "%100" gibi ifadeler kullanma.
3. Sadece verilen verilere dayan.
4. Veri yetersizse bunu warnings alanında belirt.
5. Takım isimlerini karıştırma.
6. Ev sahibi/deplasman ayrımını koru.
7. Son maç formunu dikkate al.
8. H2H verisini dikkate al.
9. Puan durumunu dikkate al.
10. Takım istatistiklerini dikkate al.
11. Sakatlıkları ve kadroları dikkate al.
12. Oranları analiz ederken oranı tek başına gerekçe yapma.
13. API-Football tahminini bağımsız gerçek kabul etme.
14. Local model sonucunu kontrol et; gerektiğinde ondan farklı sonuç üret.
15. Gereksiz bahis üretme.
16. En mantıklı tek ana seçimi "pick" alanına yaz.
17. KG, Üst/Alt, maç sonucu ve ilk/ikinci yarı seçeneklerini ayrı değerlendir.
18. İlk yarı ve ikinci yarı analizini özellikle yap.
19. Tahmini skor üret.
20. Risk seviyesini gerçek veri gücüne göre belirle.

RİSK:
- 75-100: Güvenilir
- 60-74: Orta Risk
- 50-59: Riskli
- 0-49: Yüksek Risk

GÖNDERİLEN VERİLER:

LOCAL MODEL:
${JSON.stringify(localModel)}

API-FOOTBALL ANALİZ VERİLERİ:
${JSON.stringify(analysisData)}

Şimdi bütün verileri birlikte değerlendir.
`;

    // --------------------------------------------------------
    // OPENAI RESPONSES API
    // --------------------------------------------------------

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-luna",

          input: prompt,

          temperature: 0.2,

          text: {
            format: {
              type: "json_schema",

              name: "ri_football_analysis",

              strict: true,

              schema: {
                type: "object",

                additionalProperties: false,

                properties: {
                  pick: {
                    type: "string"
                  },

                  confidence: {
                    type: "number"
                  },

                  risk: {
                    type: "string",
                    enum: [
                      "Güvenilir",
                      "Orta Risk",
                      "Riskli",
                      "Yüksek Risk"
                    ]
                  },

                  predicted_score: {
                    type: "string"
                  },

                  summary: {
                    type: "string"
                  },

                  markets: {
                    type: "object",
                    additionalProperties: false,

                    properties: {
                      match_result: {
                        type: "string"
                      },

                      btts: {
                        type: "string"
                      },

                      over_15: {
                        type: "string"
                      },

                      over_25: {
                        type: "string"
                      },

                      under_35: {
                        type: "string"
                      }
                    },

                    required: [
                      "match_result",
                      "btts",
                      "over_15",
                      "over_25",
                      "under_35"
                    ]
                  },

                  first_half: {
                    type: "object",
                    additionalProperties: false,

                    properties: {
                      goal_probability: {
                        type: "number"
                      },

                      btts: {
                        type: "string"
                      },

                      recommendation: {
                        type: "string"
                      }
                    },

                    required: [
                      "goal_probability",
                      "btts",
                      "recommendation"
                    ]
                  },

                  second_half: {
                    type: "object",
                    additionalProperties: false,

                    properties: {
                      goal_probability: {
                        type: "number"
                      },

                      btts: {
                        type: "string"
                      },

                      recommendation: {
                        type: "string"
                      }
                    },

                    required: [
                      "goal_probability",
                      "btts",
                      "recommendation"
                    ]
                  },

                  reasons: {
                    type: "array",
                    items: {
                      type: "string"
                    }
                  },

                  warnings: {
                    type: "array",
                    items: {
                      type: "string"
                    }
                  }
                },

                required: [
                  "pick",
                  "confidence",
                  "risk",
                  "predicted_score",
                  "summary",
                  "markets",
                  "first_half",
                  "second_half",
                  "reasons",
                  "warnings"
                ]
              }
            }
          }
        })
      }
    );

    const rawText = await response.text();

    let result;

    try {
      result = JSON.parse(rawText);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "OpenAI geçersiz JSON cevabı döndürdü.",
        raw: rawText.slice(0, 1000)
      });
    }

    if (!response.ok) {
      console.error(
        "R❤️İ OPENAI ERROR:",
        result
      );

      return res.status(response.status).json({
        ok: false,
        error:
          result?.error?.message ||
          "OpenAI API isteği başarısız oldu."
      });
    }

    // --------------------------------------------------------
    // RESPONSES API ÇIKTISINI AL
    // --------------------------------------------------------

    let outputText = result?.output_text || "";

    if (!outputText && Array.isArray(result?.output)) {
      for (const item of result.output) {
        if (!Array.isArray(item?.content)) continue;

        for (const content of item.content) {
          if (
            content?.type === "output_text" &&
            typeof content?.text === "string"
          ) {
            outputText += content.text;
          }
        }
      }
    }

    if (!outputText) {
      return res.status(500).json({
        ok: false,
        error: "OpenAI analiz sonucu boş döndü."
      });
    }

    let ai;

    try {
      ai = JSON.parse(outputText);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "OpenAI analiz JSON'u parse edilemedi.",
        raw: outputText.slice(0, 1500)
      });
    }

    // --------------------------------------------------------
    // NORMALİZE ET
    // --------------------------------------------------------

    ai.confidence = Math.max(
      0,
      Math.min(
        100,
        Number(ai.confidence) || 0
      )
    );

    if (
      !Array.isArray(ai.reasons)
    ) {
      ai.reasons = [];
    }

    if (
      !Array.isArray(ai.warnings)
    ) {
      ai.warnings = [];
    }

    return res.status(200).json({
      ok: true,

      engine: "R❤️İ OpenAI Football Engine",

      model: "gpt-5.6-luna",

      generated_at:
        new Date().toISOString(),

      ai
    });

  } catch (error) {
    console.error(
      "R❤️İ AI ENGINE ERROR:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "AI analiz motorunda bilinmeyen hata oluştu."
    });
  }
}
