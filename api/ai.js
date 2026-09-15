export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "OPENAI_API_KEY bulunamadı."
    });
  }

  try {
    const body = req.body || {};

    const match = body.match || {};
    const data = body.data || {};
    const local = body.local || {};

    // Gereksiz devasa API-Football alanlarını temizle
    const compact = {
      match: {
        id: match.id,
        league: match.league,
        home: match.home,
        away: match.away,
        date: match.date,
        status: match.status
      },

      local_model: {
        expectedHome: local.expectedHome,
        expectedAway: local.expectedAway,
        totalExpected: local.totalExpected,

        ms1: local.ms1,
        draw: local.draw,
        ms2: local.ms2,

        btts: local.btts,
        noBtts: local.noBtts,

        over15: local.over15,
        over25: local.over25,
        over35: local.over35,

        under25: local.under25,
        under35: local.under35,

        firstHalfGoalProbability:
          local.firstHalfGoalProbability,

        secondHalfGoalProbability:
          local.secondHalfGoalProbability,

        firstHalfBTTS:
          local.firstHalfBTTS,

        secondHalfBTTS:
          local.secondHalfBTTS,

        bothHalvesBTTS:
          local.bothHalvesBTTS,

        homeForm:
          local.homeForm,

        awayForm:
          local.awayForm,

        h2hBTTS:
          local.h2hBTTS,

        reasons:
          local.reasons
      },

      api_data: data
    };

    const prompt = `
Sen R❤️İ Football'un yapay zekâ futbol analiz motorusun.

Görevin verilen gerçek maç verilerini analiz ederek futbol bahis piyasaları hakkında
istatistiksel bir değerlendirme üretmek.

KESİNLİKLE veri uydurma.

Veride olmayan:
- sakat oyuncu
- kadro
- oran
- form
- H2H
- istatistik
- gol
- tahmin

oluşturma.

Bir seçim güçlü görünmüyorsa "VERİ YETERSİZ" de.

Özellikle şu piyasaları değerlendir:

1. MS 1
2. MS X
3. MS 2
4. KG Var
5. KG Yok
6. 1.5 ÜST
7. 2.5 ÜST
8. 2.5 ALT
9. 3.5 ÜST
10. 3.5 ALT
11. 1Y Gol
12. 2Y Gol
13. İY KG
14. 2Y KG
15. İY KG + 2Y KG

En sonunda veriler tarafından en fazla desteklenen TEK seçimi
"ŞUNU OYNA" olarak belirt.

Bu bir garanti değildir.

MAÇ VE VERİLER:

${JSON.stringify(compact, null, 2)}
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-luna",

          input: prompt,

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
                    type: "string"
                  },

                  predicted_score: {
                    type: "string"
                  },

                  summary: {
                    type: "string"
                  },

                  markets: {
                    type: "array",

                    items: {
                      type: "object",

                      additionalProperties: false,

                      properties: {

                        name: {
                          type: "string"
                        },

                        probability: {
                          type: "number"
                        },

                        comment: {
                          type: "string"
                        }

                      },

                      required: [
                        "name",
                        "probability",
                        "comment"
                      ]
                    }
                  },

                  first_half: {
                    type: "string"
                  },

                  second_half: {
                    type: "string"
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

    const result =
      await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI error:",
        result
      );

      return res.status(response.status).json({
        ok: false,
        error:
          result?.error?.message ||
          "OpenAI API hatası."
      });
    }

    let outputText =
      result.output_text;

    if (!outputText) {
      const message =
        result.output?.find(
          item => item.type === "message"
        );

      const content =
        message?.content?.find(
          item => item.type === "output_text"
        );

      outputText =
        content?.text;
    }

    if (!outputText) {
      return res.status(502).json({
        ok: false,
        error:
          "OpenAI boş cevap döndürdü."
      });
    }

    const ai =
      JSON.parse(outputText);

    return res.status(200).json({
      ok: true,
      ai
    });

  } catch (error) {

    console.error(
      "R❤️İ AI ERROR:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "AI analiz hatası."
    });
  }
}
