export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Sadece POST destekleniyor."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY bulunamadı."
      });
    }

    const body = req.body || {};

    const fixture = body.fixture || body.match || body.data || body;

    if (!fixture) {
      return res.status(400).json({
        success: false,
        error: "Analiz verisi bulunamadı."
      });
    }


    /*
     * API-Football verisini gereksiz şekilde büyütmemek
     * ve modele daha temiz veri göndermek için özetliyoruz.
     */

    const compact = {
      fixture: fixture.fixture || null,

      league: fixture.league || null,

      teams: fixture.teams || null,

      goals: fixture.goals || null,

      score: fixture.score || null,

      date: fixture.date || null,

      statistics: fixture.statistics || null,

      lineups: fixture.lineups || null,

      injuries: fixture.injuries || null,

      odds: fixture.odds || null,

      predictions: fixture.predictions || null,

      h2h: fixture.h2h || fixture.headToHead || null,

      recent: fixture.recent || null,

      standings: fixture.standings || null
    };


    const systemPrompt = `
Sen R❤️İ Football futbol analiz motorunun yapay zeka analiz katmanısın.

Görevin, sana verilen API-Football verilerini kullanarak
Türkçe ve veri odaklı futbol maçı analizi üretmektir.

KESİNLİK İDDİASI YAPMA.

"Kesin kazanır", "banko", "garanti" gibi ifadeler kullanma.

Veriler yetersizse bunu açıkça belirt.

Analizde mümkün olduğunca şu başlıkları değerlendir:

- Takımların güncel formu
- Son maçlar
- Ev sahibi / deplasman performansı
- Gol ortalamaları
- Karşılıklı gol eğilimi
- İlk yarı gol eğilimi
- İkinci yarı gol eğilimi
- H2H
- Kadro ve eksikler
- Maç istatistikleri
- Oranlar mevcutsa oran hareketleri / piyasa verileri
- API-Football tahminleri mevcutsa bunlar
- Muhtemel maç senaryosu
- Tahmini skor

Sonuçta kullanıcıya kısa ama anlaşılır bir değerlendirme ver.

Yanıt Türkçe olmalı.
`;


    const userPrompt = `
Aşağıdaki API-Football verilerini analiz et.

SADECE VERİLERDEN ÇIKARIM YAP.

Veri:

${JSON.stringify(compact, null, 2)}
`;


    /*
     * OpenAI Responses API
     *
     * ÖNEMLİ:
     * GPT-5.6 Luna için temperature göndermiyoruz.
     */

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body: JSON.stringify({

          model: "gpt-5.6-luna",

          input: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],

          max_output_tokens: 1800

        })
      }
    );


    const data = await response.json();


    if (!response.ok) {

      console.error(
        "OPENAI ERROR:",
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        success: false,

        error:
          data?.error?.message ||
          "OpenAI analiz servisi hata verdi.",

        details:
          data?.error || null
      });
    }


    /*
     * Responses API çıktısını güvenli şekilde al.
     */

    let text = "";


    if (
      typeof data.output_text ===
      "string"
    ) {

      text = data.output_text.trim();

    }


    /*
     * Bazı Responses API cevaplarında
     * output_text yerine output dizisi bulunabilir.
     */

    if (!text && Array.isArray(data.output)) {

      for (const item of data.output) {

        if (!Array.isArray(item.content)) {
          continue;
        }

        for (const content of item.content) {

          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {

            text += content.text;

          }

        }

      }

      text = text.trim();
    }


    if (!text) {

      return res.status(502).json({
        success: false,
        error: "OpenAI boş analiz döndürdü.",
        raw: data
      });

    }


    return res.status(200).json({

      success: true,

      analysis: text,

      model: "gpt-5.6-luna"

    });


  } catch (error) {

    console.error(
      "AI API ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        "AI analiz servisine bağlanılamadı.",

      message:
        error.message

    });

  }
}
