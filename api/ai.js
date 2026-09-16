export default async function handler(req, res) {
  try {
    /* =====================================================
       METHOD
       ===================================================== */

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Sadece POST destekleniyor."
      });
    }


    /* =====================================================
       OPENAI KEY
       ===================================================== */

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY bulunamadı."
      });
    }


    /* =====================================================
       REQUEST BODY
       ===================================================== */

    const body = req.body || {};

    let incoming =
      body.fixture ||
      body.match ||
      body.data ||
      body;


    if (!incoming) {
      return res.status(400).json({
        success: false,
        error: "Analiz verisi bulunamadı."
      });
    }


    /*
     * Yeni app.js yapısında:
     *
     * body.fixture = {
     *   mode,
     *   fixture,
     *   details,
     *   live_state
     * }
     *
     * Eski yapıda ise doğrudan API-Football verisi gelebilir.
     *
     * İkisini de destekliyoruz.
     */

    const isNewPayload =
      incoming &&
      typeof incoming === "object" &&
      (
        incoming.mode ||
        incoming.details ||
        incoming.live_state
      );


    let mode = "prematch";

    let currentFixture = null;

    let league = null;

    let teams = null;

    let details = {};

    let liveState = null;


    if (isNewPayload) {

      mode =
        incoming.mode ||
        "prematch";

      currentFixture =
        incoming.fixture?.fixture ||
        incoming.fixture ||
        null;

      league =
        incoming.fixture?.league ||
        null;

      teams =
        incoming.fixture?.teams ||
        null;

      details =
        incoming.details ||
        {};

      liveState =
        incoming.live_state ||
        null;

    } else {

      currentFixture =
        incoming.fixture ||
        null;

      league =
        incoming.league ||
        null;

      teams =
        incoming.teams ||
        null;

      details =
        incoming;

      liveState =
        null;

    }


    /* =====================================================
       CURRENT MATCH SCORE TEMİZLEME
       ===================================================== */

    /*
     * Çok önemli:
     *
     * Mevcut maçın skorunu AI'ya pre-match tahmin
     * verisi olarak göndermiyoruz.
     *
     * Ancak historical H2H / son maç verilerindeki
     * skorlar korunuyor.
     */

    const cleanDetails =
      deepClone(details);


    delete cleanDetails.goals;

    delete cleanDetails.score;


    if (cleanDetails.fixture) {

      delete cleanDetails.fixture.goals;

      delete cleanDetails.fixture.score;

    }


    /* =====================================================
       CURRENT FIXTURE
       ===================================================== */

    const cleanCurrentFixture = {

      id:
        currentFixture?.id ||
        null,

      date:
        currentFixture?.date ||
        null,

      timezone:
        currentFixture?.timezone ||
        null,

      referee:
        currentFixture?.referee ||
        null,

      venue:
        currentFixture?.venue ||
        null,

      status: {

        short:
          currentFixture?.status?.short ||
          null,

        long:
          currentFixture?.status?.long ||
          null,

        elapsed:
          currentFixture?.status?.elapsed ??
          null

      }

    };


    /* =====================================================
       AI VERİSİ
       ===================================================== */

    const analysisData = {

      mode,

      fixture: cleanCurrentFixture,

      league,

      teams,

      data: cleanDetails,

      /*
       * Sadece canlı maçta mevcut skor burada bulunabilir.
       *
       * AI'ya ayrıca bunun "canlı durum" olduğu söylenecek.
       */

      live_state:
        mode === "live"
          ? liveState
          : null

    };


    /* =====================================================
       SYSTEM PROMPT
       ===================================================== */

    const systemPrompt = `
Sen R❤️İ Football'un veri tabanlı futbol analiz motorusun.

Görevin, yalnızca sana verilen API-Football verilerini kullanarak
maç başlamadan önce futbol tahmini üretmektir.

TEMEL KURAL:

Bu bir PRE-MATCH analiz sistemidir.

Maç başlamamışsa mevcut maç skoru yoktur ve tahminini
gelecekte oynanacak maç için üretmelisin.

Mevcut maçın final veya canlı skorunu kullanarak
"bu maç zaten böyle bitti" şeklinde tahmin yapma.

Eğer mode = "prematch" ise:

- mevcut maç skoru bulunmamaktadır
- mevcut maçın sonucu bilinmiyor
- geçmiş maç skorları kullanılabilir
- H2H skorları kullanılabilir
- API-Football prediction verileri kullanılabilir
- form verileri kullanılabilir
- standings kullanılabilir
- sakatlık/kadro bilgileri kullanılabilir
- oranlar kullanılabilir

Eğer mode = "live" ise:

- live_state içindeki skorun mevcut canlı skor olduğunu unutma
- final sonucu tahmin edilmiş gibi davranma
- yalnızca mevcut durumdan sonrası için değerlendirme yap

ÇOK ÖNEMLİ:

1. Veride olmayan hiçbir bilgiyi uydurma.
2. Kesinlik veya garanti iddiasında bulunma.
3. "Kesin", "garanti", "banko" gibi ifadeler kullanma.
4. Aynı veri verildiğinde mümkün olduğunca aynı tahmini üret.
5. Tahmini yalnızca verilen istatistiklerle gerekçelendir.
6. Veri yetersizse "Belirsiz" yaz.
7. Türkçe cevap ver.
8. Güven değerini gerçekçi tut.
9. Güven hiçbir zaman 100 olmasın.
10. Bir tahmin sadece geçmişte gerçekleşti diye o tahmini kesin doğru kabul etme.
11. API-Football'un kendi tahminini tek başına gerçek kabul etme.
12. Birden fazla veri kaynağını birlikte değerlendir.

DEĞERLENDİRİLECEK PAZARLAR:

- Maç Sonucu
- KG Var / KG Yok
- 2.5 Üst / 2.5 Alt
- İlk Yarı KG
- İkinci Yarı KG
- İlk Yarı Gol
- İkinci Yarı Gol
- Tahmini Skor

JSON DIŞINDA HİÇBİR ŞEY YAZMA.

SADECE BU FORMATTA JSON ÜRET:

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

guven:

- 0 ile 95 arasında olmalı
- 100 kullanma
- veri yetersizse 0-50 arası kullan
- güçlü istatistiksel destek varsa daha yüksek değer kullan

Tahmin alanında kullanılabilecek örnekler:

Maç sonucu:
"Ev Sahibi Kazanır"
"Beraberlik"
"Deplasman Kazanır"
"Belirsiz"

KG:
"Var"
"Yok"
"Belirsiz"

2.5:
"Üst 2.5"
"Alt 2.5"
"Belirsiz"

İlk/İkinci yarı:
"Var"
"Yok"
"Belirsiz"

Tahmini skor:
"2-1"
"1-1"
"0-1"
vb.

Fakat veri desteklemiyorsa "Belirsiz" kullan.
`;


    /* =====================================================
       USER PROMPT
       ===================================================== */

    const userPrompt = `
Aşağıdaki veriler R❤️İ Football analiz sistemine aittir.

ANALİZ MODU:
${mode}

ÇOK ÖNEMLİ:

Bu verilerde "fixture" bölümü analiz edilen mevcut maçtır.

Eğer mod "prematch" ise bu maç henüz oynanmamıştır.
Bu nedenle bu maçın gelecekteki sonucunu tahmin et.

"data" bölümü içerisinde geçmiş maçlar,
H2H, istatistikler, oranlar, sakatlıklar,
kadrolar ve API-Football tahminleri bulunabilir.

Geçmiş maçların skorlarını mevcut maçın sonucu sanma.

SADECE VERİDEKİ BİLGİLERİ KULLAN.

VERİ:

${JSON.stringify(
  analysisData,
  null,
  2
)}
`;


    /* =====================================================
       OPENAI
       ===================================================== */

    const openAIResponse =
      await fetch(
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

            model:
              "gpt-5.6-luna",

            /*
             * Responses API'ye tek bir metin
             * input gönderiyoruz.
             *
             * Böylece input/content formatından
             * kaynaklanabilecek 400 hatalarını
             * ortadan kaldırıyoruz.
             */

            input:
              systemPrompt +
              "\n\n" +
              userPrompt,

            max_output_tokens:
              2200

          })

        }
      );


    /* =====================================================
       OPENAI RESPONSE
       ===================================================== */

    let data = null;

    const rawResponse =
      await openAIResponse.text();


    try {

      data =
        JSON.parse(
          rawResponse
        );

    } catch {

      data = null;

    }


    /* =====================================================
       OPENAI ERROR
       ===================================================== */

    if (!openAIResponse.ok) {

      console.error(
        "OPENAI HTTP ERROR:",
        openAIResponse.status,
        rawResponse
      );


      return res
        .status(502)
        .json({

          success: false,

          error:
            data?.error?.message ||
            `OpenAI HTTP ${openAIResponse.status}`,

          openai_status:
            openAIResponse.status,

          details:
            data?.error ||
            rawResponse ||
            null

        });

    }


    /* =====================================================
       OUTPUT TEXT
       ===================================================== */

    let text = "";


    if (
      typeof data?.output_text ===
      "string"
    ) {

      text =
        data.output_text.trim();

    }


    /*
     * output_text yoksa output içinden
     * output_text parçalarını bul.
     */

    if (
      !text &&
      Array.isArray(
        data?.output
      )
    ) {

      for (
        const item of
        data.output
      ) {

        if (
          !Array.isArray(
            item?.content
          )
        ) {
          continue;
        }


        for (
          const content of
          item.content
        ) {

          if (
            content?.type ===
              "output_text" &&
            typeof content?.text ===
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


    /* =====================================================
       EMPTY RESPONSE
       ===================================================== */

    if (!text) {

      console.error(
        "OPENAI EMPTY RESPONSE:",
        JSON.stringify(
          data
        )
      );


      return res.status(502).json({

        success: false,

        error:
          "OpenAI boş analiz döndürdü.",

        details:
          data || null

      });

    }


    /* =====================================================
       JSON TEMİZLE
       ===================================================== */

    text =
      cleanJSONText(text);


    /* =====================================================
       PARSE
       ===================================================== */

    let parsed;

    try {

      parsed =
        JSON.parse(text);

    } catch (error) {

      console.error(
        "AI JSON PARSE ERROR:",
        text
      );


      return res.status(502).json({

        success: false,

        error:
          "AI geçerli JSON döndürmedi.",

        raw:
          text

      });

    }


    /* =====================================================
       NORMALIZE
       ===================================================== */

    parsed =
      normalizeAnalysis(
        parsed
      );


    /* =====================================================
       SUCCESS
       ===================================================== */

    return res.status(200).json({

      success: true,

      analysis:
        JSON.stringify(
          parsed
        ),

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
        error?.message ||
        "Bilinmeyen hata"

    });

  }

}


/* =========================================================
   JSON CLEAN
   ========================================================= */

function cleanJSONText(text) {

  let value =
    String(text || "")
      .trim();


  /*
   * ```json
   */

  value =
    value.replace(
      /^```json\s*/i,
      ""
    );


  /*
   * ```
   */

  value =
    value.replace(
      /^```\s*/i,
      ""
    );


  value =
    value.replace(
      /\s*```$/i,
      ""
    );


  value =
    value.trim();


  /*
   * AI bazen JSON'dan önce/sonra
   * kısa açıklama ekleyebilir.
   *
   * İlk { ile son } arasını al.
   */

  const first =
    value.indexOf("{");

  const last =
    value.lastIndexOf("}");


  if (
    first >= 0 &&
    last > first
  ) {

    value =
      value.substring(
        first,
        last + 1
      );

  }


  return value.trim();

}


/* =========================================================
   ANALYSIS NORMALIZER
   ========================================================= */

function normalizeAnalysis(data) {

  const result =
    data &&
    typeof data === "object"
      ? data
      : {};


  result.mac_sonucu =
    normalizeMarket(
      result.mac_sonucu
    );


  result.kg =
    normalizeMarket(
      result.kg
    );


  result.ust_25 =
    normalizeMarket(
      result.ust_25
    );


  result.ilk_yari_kg =
    normalizeMarket(
      result.ilk_yari_kg
    );


  result.ikinci_yari_kg =
    normalizeMarket(
      result.ikinci_yari_kg
    );


  result.ilk_yari_gol =
    normalizeMarket(
      result.ilk_yari_gol
    );


  result.ikinci_yari_gol =
    normalizeMarket(
      result.ikinci_yari_gol
    );


  if (
    !result.tahmini_skor ||
    typeof result.tahmini_skor !==
      "object"
  ) {

    result.tahmini_skor = {

      tahmin:
        "Belirsiz",

      guven:
        0

    };

  } else {

    result.tahmini_skor.guven =
      normalizeConfidence(
        result.tahmini_skor.guven
      );

    result.tahmini_skor.tahmin =
      String(
        result.tahmini_skor.tahmin ||
        "Belirsiz"
      );

  }


  result.genel_degerlendirme =
    String(
      result.genel_degerlendirme ||
      ""
    );


  result.risk =
    normalizeRisk(
      result.risk
    );


  return result;

}


/* =========================================================
   MARKET NORMALIZER
   ========================================================= */

function normalizeMarket(market) {

  if (
    !market ||
    typeof market !== "object"
  ) {

    return {

      tahmin:
        "Belirsiz",

      guven:
        0,

      gerekce:
        ""

    };

  }


  return {

    tahmin:
      String(
        market.tahmin ||
        "Belirsiz"
      ),

    guven:
      normalizeConfidence(
        market.guven
      ),

    gerekce:
      String(
        market.gerekce ||
        ""
      )

  };

}


/* =========================================================
   CONFIDENCE
   ========================================================= */

function normalizeConfidence(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return 0;

  }


  return Math.max(
    0,
    Math.min(
      95,
      Math.round(number)
    )
  );

}


/* =========================================================
   RISK
   ========================================================= */

function normalizeRisk(value) {

  const risk =
    String(
      value || ""
    ).trim();


  if (
    risk === "Düşük" ||
    risk === "Orta" ||
    risk === "Yüksek"
  ) {

    return risk;

  }


  return "Orta";

}


/* =========================================================
   DEEP CLONE
   ========================================================= */

function deepClone(value) {

  try {

    return JSON.parse(
      JSON.stringify(
        value
      )
    );

  } catch {

    return {};

  }

}
