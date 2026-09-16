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

    const fixture =
      body.fixture ||
      body.match ||
      body.data ||
      body;

    if (!fixture) {
      return res.status(400).json({
        success: false,
        error: "Analiz verisi bulunamadı."
      });
    }

    /*
     * Modele gereksiz veri göndermemek için
     * API-Football verisini düzenliyoruz.
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

      h2h:
        fixture.h2h ||
        fixture.headToHead ||
        null,

      recent: fixture.recent || null,

      standings: fixture.standings || null
    };


    /*
     * AI'ya aynı formatı zorunlu tutuyoruz.
     *
     * Böylece frontend tahminleri daha kolay
     * okuyabilir ve analizler daha tutarlı olur.
     */

    const systemPrompt = `
Sen R❤️İ Football'un veri tabanlı futbol analiz motorusun.

Görevin:
Sadece sana verilen API-Football verilerini analiz ederek
bir futbol maçı için istatistiksel değerlendirme üretmek.

ÇOK ÖNEMLİ KURALLAR:

1. Veride bulunmayan bilgiyi uydurma.
2. Kesinlik iddiasında bulunma.
3. "Kesin", "garanti", "banko" gibi ifadeler kullanma.
4. Takımların geçmiş performansını, H2H'yi,
   gol verilerini, kadroyu, sakatlıkları,
   oranları ve API tahminlerini birlikte değerlendir.
5. Bir veri yoksa "veri yok" olarak kabul et.
6. Tahmin üretirken mümkün olduğunca verilen
   istatistiklerle gerekçelendir.
7. Aynı veriler verildiğinde aynı sonuca ulaşmaya çalış.
8. Tahminleri gereksiz şekilde değiştirme.
9. Türkçe cevap ver.

Özellikle şu pazarları değerlendir:

- Maç Sonucu
- KG Var / KG Yok
- 2.5 Üst / 2.5 Alt
- İlk Yarı KG
- İkinci Yarı KG
- İlk Yarı Gol
- İkinci Yarı Gol
- Tahmini Skor

ÇIKTIYI SADECE AŞAĞIDAKİ JSON FORMATINDA ÜRET:

{
  "mac_sonucu": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "kg": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "ust_25": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "ilk_yari_kg": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "ikinci_yari_kg": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "ilk_yari_gol": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "ikinci_yari_gol": {
    "tahmin": "",
    "guven": 0,
    "gerekce": ""
  },
  "tahmini_skor": {
    "tahmin": "",
    "guven": 0
  },
  "genel_degerlendirme": "",
  "risk": "Düşük / Orta / Yüksek"
}

guven değeri 0 ile 100 arasında sayı olmalı.

Tahmin seçenekleri veriyle desteklenmiyorsa
tahmin alanına "Belirsiz" yaz.

JSON dışında hiçbir şey yazma.
`;


    const userPrompt = `
Aşağıdaki API-Football verilerini analiz et.

SADECE BU VERİLERİ KULLAN.

Veri:

${JSON.stringify(
  compact,
  null,
  2
)}
`;


    /*
     * OpenAI Responses API
     *
     * temperature KULLANILMIYOR.
     */

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

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

          max_output_tokens: 2200
        })
      }
    );


    const data =
      await response.json();


    if (!response.ok) {

      console.error(
        "OPENAI ERROR:",
        JSON.stringify(data)
      );

      return res.status(
        response.status
      ).json({
        success: false,

        error:
          data?.error?.message ||
          "OpenAI analiz servisi hata verdi.",

        details:
          data?.error || null
      });
    }


    /*
     * Responses API çıktısını al.
     */

    let text = "";


    if (
      typeof data.output_text ===
      "string"
    ) {

      text =
        data.output_text.trim();
    }


    if (
      !text &&
      Array.isArray(data.output)
    ) {

      for (
        const item of data.output
      ) {

        if (
          !Array.isArray(
            item.content
          )
        ) {
          continue;
        }


        for (
          const content of
          item.content
        ) {

          if (
            content.type ===
              "output_text" &&
            typeof content.text ===
              "string"
          ) {

            text +=
              content.text;
          }
        }
      }


      text =
        text.trim();
    }


    if (!text) {

      return res.status(502).json({
        success: false,
        error:
          "OpenAI boş analiz döndürdü."
      });
    }


    /*
     * Markdown ```json ... ``` gelirse temizle.
     */

    text =
      text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();


    /*
     * AI JSON döndürdüyse parse ediyoruz.
     */

    let parsed = null;


    try {

      parsed =
        JSON.parse(text);

    } catch {

      /*
       * JSON parse edilemezse
       * yine de ham analizi kaybetme.
       */

      parsed = {
        genellikle:
          text
      };
    }


    return res.status(200).json({

      success: true,

      analysis:
        typeof parsed === "object"
          ? JSON.stringify(
              parsed
            )
          : String(parsed),

      analysisData:
        parsed,

      model:
        "gpt-5.6-luna",

      cached:
        false
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
