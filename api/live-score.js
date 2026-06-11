const API_ENDPOINT = "https://v3.football.api-sports.io/fixtures";

const aliases = {
  ALG: ["algeria", "argelia"],
  ARG: ["argentina"],
  AUS: ["australia"],
  AUT: ["austria"],
  BEL: ["belgium", "belgica", "bélgica"],
  BIH: ["bosnia", "bosnia and herzegovina", "bosnia y herzegovina"],
  BRA: ["brazil", "brasil"],
  CAN: ["canada", "canadá"],
  CIV: ["ivory coast", "cote d ivoire", "côte d ivoire", "costa de marfil"],
  COD: ["dr congo", "congo dr", "rd congo"],
  COL: ["colombia"],
  CPV: ["cape verde", "cabo verde"],
  CRO: ["croatia", "croacia"],
  CUW: ["curacao", "curaçao"],
  CZE: ["czech republic", "czechia", "rep checa", "republica checa", "república checa"],
  ECU: ["ecuador"],
  EGY: ["egypt", "egipto"],
  ENG: ["england", "inglaterra"],
  ESP: ["spain", "espana", "españa"],
  FRA: ["france", "francia"],
  GER: ["germany", "alemania"],
  GHA: ["ghana"],
  HAI: ["haiti", "haití"],
  IRN: ["iran", "irán"],
  IRQ: ["iraq", "irak"],
  JOR: ["jordan", "jordania"],
  JPN: ["japan", "japon", "japón"],
  KOR: ["south korea", "korea republic", "corea del sur"],
  KSA: ["saudi arabia", "arabia saudita"],
  MAR: ["morocco", "marruecos"],
  MEX: ["mexico", "méxico"],
  NED: ["netherlands", "paises bajos", "países bajos"],
  NOR: ["norway", "noruega"],
  NZL: ["new zealand", "nueva zelanda"],
  PAN: ["panama", "panamá"],
  PAR: ["paraguay"],
  POR: ["portugal"],
  QAT: ["qatar"],
  RSA: ["south africa", "sudafrica", "sudáfrica"],
  SCO: ["scotland", "escocia"],
  SEN: ["senegal"],
  SUI: ["switzerland", "suiza"],
  SWE: ["sweden", "suecia"],
  TUN: ["tunisia", "tunez", "túnez"],
  TUR: ["turkey", "turkiye", "turquía", "turquia"],
  URU: ["uruguay"],
  USA: ["usa", "united states", "estados unidos"],
  UZB: ["uzbekistan", "uzbekistán"]
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getAliases(code) {
  return (aliases[code] || [code]).map(normalize);
}

function teamMatches(teamName, teamAliases) {
  const normalizedTeam = normalize(teamName);
  return teamAliases.some((alias) => normalizedTeam.includes(alias));
}

function findFixture(fixtures, homeCode, awayCode) {
  const homeAliases = getAliases(homeCode);
  const awayAliases = getAliases(awayCode);

  return fixtures.find((fixture) => {
    const home = fixture.teams?.home?.name;
    const away = fixture.teams?.away?.name;
    const directMatch = teamMatches(home, homeAliases) && teamMatches(away, awayAliases);
    const reverseMatch = teamMatches(away, homeAliases) && teamMatches(home, awayAliases);
    return directMatch || reverseMatch;
  });
}

function serializeFixture(fixture) {
  return {
    ok: true,
    mode: "live",
    status: fixture.fixture?.status?.short || "",
    elapsed: fixture.fixture?.status?.elapsed || null,
    kickoff: fixture.fixture?.date || null,
    home: fixture.teams?.home?.name || "",
    away: fixture.teams?.away?.name || "",
    goals: {
      home: fixture.goals?.home,
      away: fixture.goals?.away
    }
  };
}

function serializeFixtures(fixtures) {
  return fixtures.map(serializeFixture);
}

module.exports = async function handler(request, response) {
  const apiKey = process.env.APISPORTS_KEY || process.env.API_FOOTBALL_KEY;
  const date = request.query.date || new Date().toISOString().slice(0, 10);
  const home = request.query.home || "";
  const away = request.query.away || "";
  const mode = request.query.mode || "match";

  response.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

  if (!apiKey) {
    return response.status(200).json({
      ok: false,
      mode: "demo",
      message: "El marcador real se activará cuando configures APISPORTS_KEY o API_FOOTBALL_KEY."
    });
  }

  try {
    const apiResponse = await fetch(`${API_ENDPOINT}?date=${encodeURIComponent(date)}&league=1&season=2026&timezone=America/Bogota`, {
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
    const fixtures = data.response || [];

    if (mode === "day") {
      return response.status(200).json({
        ok: true,
        mode: "day",
        fixtures: serializeFixtures(fixtures)
      });
    }

    const fixture = home && away ? findFixture(fixtures, home, away) : fixtures[0];

    if (!fixture) {
      return response.status(200).json({
        ok: false,
        mode: "empty",
        message: "No hay marcador confirmado para este partido todavía."
      });
    }

    return response.status(200).json(serializeFixture(fixture));
  } catch (error) {
    return response.status(500).json({
      ok: false,
      mode: "error",
      message: error.message
    });
  }
};
