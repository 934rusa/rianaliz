const API_BASE = "https://v3.football.api-sports.io";

const ALLOWED_ROUTES = {
  fixtures: "/fixtures",
  fixture: "/fixtures",
  h2h: "/fixtures/headtohead",
  injuries: "/injuries",
  lineups: "/fixtures/lineups",
  players: "/fixtures/players",
  statistics: "/fixtures/statistics",
  odds: "/odds",
  predictions: "/predictions",
  standings: "/standings",
  team_statistics: "/teams/statistics"
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Sadece GET destekleniyor." }, 405);
    }

    if (!env.API_FOOTBALL_KEY) {
      return json({
        error: "API_FOOTBALL_KEY Cloudflare Secret olarak tanımlanmamış."
      }, 500);
    }

    const incoming = new URL(request.url);
    const route = incoming.pathname.replace(/^\/+|\/+$/g, "");

    if (!route) {
      return json({
        name: "R❤️İ Football API",
        status: "online"
      });
    }

    const endpoint = ALLOWED_ROUTES[route];

    if (!endpoint) {
      return json({
        error: "Geçersiz API route.",
        allowed: Object.keys(ALLOWED_ROUTES)
      }, 404);
    }

    const target = new URL(API_BASE + endpoint);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    try {
      const response = await fetch(target.toString(), {
        method: "GET",
        headers: {
          "x-apisports-key": env.API_FOOTBALL_KEY
        }
      });

      const text = await response.text();

      return new Response(text, {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ||
            "application/json; charset=utf-8",
          ...corsHeaders()
        }
      });

    } catch (error) {
      return json({
        error: "API-Football bağlantı hatası.",
        message: error.message
      }, 502);
    }
  }
};
