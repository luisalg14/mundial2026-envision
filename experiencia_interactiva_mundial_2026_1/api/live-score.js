const API_ENDPOINT = "https://v3.football.api-sports.io/fixtures";

const aliases = {
  ARG: ["argentina"],
  BRA: ["brazil", "brasil"],
  CAN: ["canada", "canadá"],
  COL: ["colombia"],
  ENG: ["england", "inglaterra"],
  FRA: ["france", "francia"],
  GER: ["germany", "alemania"],
  MEX: ["mexico", "méxico"],
  POR: ["portugal"],
  RSA: ["south africa", "sudáfrica"],
  USA: ["usa", "united states", "estados unidos"]
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getAliases(code) {
  return (aliases[code] || [code]).map(normalize);
}

function findFixture(fixtures, homeCode, awayCode) {
  const homeAliases = getAliases(homeCode);
  const awayAliases = getAliases(awayCode);

  return fixtures.find((fixture) => {
    const home = normalize(fixture.teams?.home?.name);
    const away = normalize(fixture.teams?.away?.name);
    return (
      homeAliases.some((alias) => home.includes(alias)) ||
      awayAliases.some((alias) => away.includes(alias))
    );
  });
}

module.exports = async function handler(request, response) {
  const apiKey = process.env.APISPORTS_KEY || process.env.API_FOOTBALL_KEY;
  const date = request.query.date || "2026-06-11";
  const home = request.query.home || "MEX";
  const away = request.query.away || "RSA";

  response.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

  if (!apiKey) {
    return response.status(200).json({
      ok: false,
      mode: "demo",
      message: "El marcador en vivo se activará cuando esté disponible."
    });
  }

  try {
    const apiResponse = await fetch(`${API_ENDPOINT}?date=${encodeURIComponent(date)}`, {
      headers: { "x-apisports-key": apiKey }
    });

    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({
        ok: false,
        mode: "error",
        message: "El marcador no está disponible en este momento."
      });
    }

    const data = await apiResponse.json();
    const fixture = findFixture(data.response || [], home, away);

    if (!fixture) {
      return response.status(200).json({
        ok: false,
        mode: "empty",
        message: "El marcador de este partido aún está por confirmar."
      });
    }

    return response.status(200).json({
      ok: true,
      mode: "live",
      status: fixture.fixture?.status?.short || "",
      elapsed: fixture.fixture?.status?.elapsed || null,
      home: fixture.teams?.home?.name || home,
      away: fixture.teams?.away?.name || away,
      goals: {
        home: fixture.goals?.home,
        away: fixture.goals?.away
      }
    });
  } catch (error) {
    return response.status(500).json({
      ok: false,
      mode: "error",
      message: error.message
    });
  }
};
