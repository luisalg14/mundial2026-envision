function bootShader() {
    const canvas = document.getElementById("bgShader");
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 uv = v_uv;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / max(u_resolution.y, 1.0);

        vec3 navy = vec3(0.020, 0.055, 0.120);
        vec3 blue = vec3(0.030, 0.105, 0.230);
        vec3 cyan = vec3(0.000, 0.950, 0.820);

        float vignette = smoothstep(1.25, 0.18, length(p));
        float beamA = smoothstep(0.080, 0.0, abs(p.x + p.y * 0.42 + sin(u_time * 0.32) * 0.22));
        float beamB = smoothstep(0.075, 0.0, abs(p.x - p.y * 0.55 - cos(u_time * 0.24) * 0.28));
        float pulse = 0.55 + 0.45 * sin(u_time * 0.7);
        float fog = noise(uv * 4.2 + vec2(u_time * 0.035, -u_time * 0.025));
        float center = smoothstep(0.76, 0.0, length(p - vec2(0.0, -0.18)));

        vec3 color = mix(navy, blue, uv.y * 0.8);
        color += cyan * (beamA * 0.11 + beamB * 0.08) * pulse;
        color += cyan * center * 0.075;
        color += cyan * fog * 0.035;
        color *= 0.78 + vignette * 0.42;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function makeShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, makeShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, makeShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "a_position");
    const timeUniform = gl.getUniformLocation(program, "u_time");
    const resolutionUniform = gl.getUniformLocation(program, "u_resolution");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    function resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render(time) {
      resize();
      gl.uniform1f(timeUniform, time * 0.001);
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }

    render(0);
  }

  const liveScoreConfig = {
    provider: "Vercel API",
    endpoint: "/api/live-score",
    pollMs: 30000
  };

  const predictionStorageKeys = {
    champion: "mundial2026ChampionPrediction",
    score: "mundial2026ScorePrediction"
  };

  let currentSimMatch = {
    home: "MEX",
    away: "RSA",
    date: "11 jun 2026",
    time: "1:00 p.m. UTC-6",
    group: "Grupo A",
    venue: "Estadio Azteca, Mexico City",
    homeFlag: "https://flagcdn.com/w160/mx.png",
    awayFlag: "https://flagcdn.com/w160/za.png"
  };

  const fallbackFinalResults = [
    {
      home: "México",
      away: "Sudáfrica",
      homeCode: "MEX",
      awayCode: "RSA",
      status: "FT",
      kickoff: "2026-06-11T20:00:00-05:00",
      goals: {
        home: 2,
        away: 0
      }
    }
  ];

  const flagUrls = {
    MEX: "https://flagcdn.com/w40/mx.png",
    RSA: "https://flagcdn.com/w40/za.png"
  };

  const monthIndexes = {
    ene: 0,
    feb: 1,
    mar: 2,
    abr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dic: 11
  };

  function normalizeTimeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\u2212/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseMatchDateTime(dateText, timeText) {
    const dateMatch = normalizeTimeText(dateText).toLowerCase().match(/^(\d{1,2})\s+([a-záéíóúñ]{3})\s+(\d{4})$/i);
    const timeMatch = normalizeTimeText(timeText).toLowerCase().match(/^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?(?:\s*utc([+-]\d{1,2}))?/i);

    if (!dateMatch || !timeMatch) return null;

    const day = Number(dateMatch[1]);
    const month = monthIndexes[dateMatch[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3)];
    const year = Number(dateMatch[3]);
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const meridiem = timeMatch[3];
    const utcOffset = timeMatch[4] ? Number(timeMatch[4]) : -5;

    if (!Number.isInteger(month)) return null;
    if (meridiem === "p" && hour !== 12) hour += 12;
    if (meridiem === "a" && hour === 12) hour = 0;

    return new Date(Date.UTC(year, month, day, hour - utcOffset, minute));
  }

  function getMatchApiDate(match) {
    const dateMatch = normalizeTimeText(match.date).toLowerCase().match(/^(\d{1,2})\s+([a-záéíóúñ]{3})\s+(\d{4})$/i);

    if (!dateMatch) return "2026-06-11";

    const day = String(Number(dateMatch[1])).padStart(2, "0");
    const monthIndex = monthIndexes[dateMatch[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3)];

    if (!Number.isInteger(monthIndex)) return "2026-06-11";

    const month = monthIndex + 1;
    return `${dateMatch[3]}-${String(month).padStart(2, "0")}-${day}`;
  }

  function getScheduledMatches() {
    return Array.from(document.querySelectorAll(".match-list-full .match"))
      .map(readMatchCard)
      .map((match) => ({
        ...match,
        startsAt: parseMatchDateTime(match.date, match.time)
      }))
      .filter((match) => match.startsAt instanceof Date && !Number.isNaN(match.startsAt.getTime()))
      .sort((a, b) => a.startsAt - b.startsAt);
  }

  function getRelevantMatch(matches, now = new Date()) {
    if (!matches.length) return currentSimMatch;

    const finalMatchKeys = new Set(fallbackFinalResults.map((fixture) => `${fixture.homeCode}-${fixture.awayCode}`));
    const currentIndex = matches.findIndex((match, index) => {
      const nextMatch = matches[index + 1];
      const nextStart = nextMatch?.startsAt || new Date(match.startsAt.getTime() + (4 * 60 * 60 * 1000));
      const isFinal = finalMatchKeys.has(`${match.home}-${match.away}`);
      return now >= match.startsAt && now < nextStart && !isFinal;
    });

    if (currentIndex >= 0) return matches[currentIndex];

    return matches.find((match) => match.startsAt > now) || matches[matches.length - 1];
  }

  function refreshCurrentSimulatorMatch() {
    const nextMatch = getRelevantMatch(getScheduledMatches());

    if (`${nextMatch.home}-${nextMatch.away}` === `${currentSimMatch.home}-${currentSimMatch.away}`) return false;

    currentSimMatch = nextMatch;
    renderSimulatorMatch(currentSimMatch);
    restoreScorePrediction();
    return true;
  }

  function getBogotaDate(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
  }

  function fixtureDateToMatchInfo(fixture) {
    const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;

    if (!kickoff || Number.isNaN(kickoff.getTime())) {
      return {
        date: getBogotaDate(),
        time: "Hora por confirmar"
      };
    }

    const date = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(kickoff);
    const time = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      hour: "numeric",
      minute: "2-digit"
    }).format(kickoff);

    return { date, time: `${time} Colombia` };
  }

  function pickFixtureForNow(fixtures, now = new Date()) {
    const liveStatuses = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
    const sortedFixtures = fixtures
      .filter((fixture) => fixture.kickoff)
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const liveFixture = sortedFixtures.find((fixture) => liveStatuses.includes(fixture.status));

    if (liveFixture) return liveFixture;

    return sortedFixtures.find((fixture) => new Date(fixture.kickoff) > now) || sortedFixtures[sortedFixtures.length - 1] || null;
  }

  function getFinalFixtures(fixtures) {
    const finalStatuses = ["FT", "AET", "PEN"];

    return fixtures
      .filter((fixture) => finalStatuses.includes(fixture.status))
      .filter((fixture) => Number.isInteger(fixture.goals?.home) && Number.isInteger(fixture.goals?.away))
      .sort((a, b) => new Date(b.kickoff || 0) - new Date(a.kickoff || 0));
  }

  function formatFixtureTime(fixture) {
    const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;

    if (!kickoff || Number.isNaN(kickoff.getTime())) return "Finalizado";

    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      hour: "numeric",
      minute: "2-digit"
    }).format(kickoff);
  }

  function renderRecentResults(fixtures) {
    const container = document.getElementById("recentResults");

    if (!container) return;

    const finalFixtures = getFinalFixtures(fixtures).slice(0, 3);

    if (!finalFixtures.length) {
      container.innerHTML = `<div class="recent-result-empty">Aún no hay partidos finalizados para mostrar.</div>`;
      return;
    }

    container.innerHTML = finalFixtures.map((fixture) => {
      const homeFlag = flagUrls[fixture.homeCode] || "";
      const awayFlag = flagUrls[fixture.awayCode] || "";

      return `
      <div>
        <div class="recent-result">
          <span class="recent-result-team">${homeFlag ? `<img class="recent-result-flag" alt="" src="${homeFlag}">` : ""}${fixture.home}</span>
          <span class="recent-result-score">${fixture.goals.home} - ${fixture.goals.away}</span>
          <span class="recent-result-team">${fixture.away}${awayFlag ? `<img class="recent-result-flag" alt="" src="${awayFlag}">` : ""}</span>
        </div>
      </div>
    `;
    }).join("");
  }

  function renderRecentResultsFallback(message) {
    const container = document.getElementById("recentResults");

    if (!container) return;

    if (fallbackFinalResults.length) {
      renderRecentResults(fallbackFinalResults);
      return;
    }

    container.innerHTML = `<div class="recent-result-empty">${message}</div>`;
  }

  function renderApiFixture(fixture) {
    const matchInfo = fixtureDateToMatchInfo(fixture);

    currentSimMatch = {
      ...currentSimMatch,
      home: fixture.home || currentSimMatch.home,
      away: fixture.away || currentSimMatch.away,
      date: matchInfo.date,
      time: matchInfo.time,
      group: "Mundial 2026",
      venue: "Sede oficial"
    };
    renderSimulatorMatch(currentSimMatch);
    applyLiveScore(fixture);
  }

  async function syncRealWorldCupDay() {
    const params = new URLSearchParams({
      date: getBogotaDate(),
      mode: "day"
    });
    const response = await fetch(`${liveScoreConfig.endpoint}?${params.toString()}`);

    if (!response.ok) throw new Error("No se pudo consultar el calendario real.");

    const data = await response.json();

    if (!data.ok || data.mode !== "day" || !Array.isArray(data.fixtures) || !data.fixtures.length) return null;

    renderRecentResults(data.fixtures);

    return {
      selected: pickFixtureForNow(data.fixtures),
      fixtures: data.fixtures
    };
  }

  function savePrediction(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("No se pudo guardar la predicción.", error);
    }
  }

  function readPrediction(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (error) {
      return null;
    }
  }

  function updateScore(teamId, delta) {
    const scoreEl = document.getElementById(`score-${teamId}`);
    if (!scoreEl) return;
    const next = Math.max(0, Number(scoreEl.textContent) + delta);
    scoreEl.textContent = next;
    scoreEl.classList.add("pop");
    window.setTimeout(() => scoreEl.classList.remove("pop"), 120);
    updateSimulatorMessage();
  }

  function tickClock() {
    const clock = document.getElementById("clock");
    const now = new Date();
    clock.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  function tickCountdown() {
    const target = new Date("2026-06-11T00:00:00-05:00").getTime();
    const now = Date.now();
    const rawDistance = target - now;
    const distance = Math.max(0, rawDistance);
    const totalSeconds = Math.floor(distance / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const countdown = document.getElementById("countdown");
    const title = countdown?.querySelector(".card-title");
    const subtitle = countdown?.querySelector(".card-sub");
    const liveMessage = document.getElementById("countdownLiveMessage");

    document.getElementById("days").textContent = String(days).padStart(3, "0");
    document.getElementById("hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("mins").textContent = String(mins).padStart(2, "0");
    document.getElementById("secs").textContent = String(secs).padStart(2, "0");

    if (rawDistance <= 0) {
      countdown?.classList.add("is-live");
      activateLiveCountdown();
      if (title) title.textContent = "El Mundial 2026 ya comenzó";
      if (subtitle) subtitle.textContent = "La fiesta del fútbol está en marcha.";
      if (liveMessage) liveMessage.textContent = "Toca una tarjeta y entra directo a la experiencia.";
      return;
    }

    countdown?.classList.remove("is-live");
    restoreCountdownLabels();
    if (title) title.textContent = "Cuenta regresiva";
    if (subtitle) subtitle.textContent = "Faltan para el inicio del Mundial 2026";
    if (liveMessage) liveMessage.textContent = "La emoción está por comenzar.";
  }

  function activateLiveCountdown() {
    const countdown = document.getElementById("countdown");
    const boxes = Array.from(document.querySelectorAll("#countdown .time-box"));
    const liveCards = [
      { value: "ELIGE", label: "Tu equipo", target: ".team-card" },
      { value: "PREDICE", label: "Marcador", target: ".sim-card" },
      { value: "JUEGA", label: "Quiz", target: ".quiz-card" },
      { value: "MIRA", label: "Partidos", target: ".matches-card" }
    ];

    boxes.forEach((box, index) => {
      const card = liveCards[index];
      const number = box.querySelector(".time-num");
      const label = box.querySelector(".time-label");
      if (!card || !number || !label) return;

      number.textContent = card.value;
      label.textContent = card.label;
      box.classList.toggle("is-predice-card", card.value === "PREDICE");
      box.classList.toggle("is-juega-card", card.value === "JUEGA");
      box.setAttribute("role", "button");
      box.setAttribute("tabindex", "0");
      box.setAttribute("aria-label", `Ir a ${card.label}`);

      if (!box.dataset.liveTarget) {
        box.addEventListener("click", () => {
          document.querySelector(box.dataset.liveTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        box.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.querySelector(box.dataset.liveTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
      box.dataset.liveTarget = card.target;
    });

    if (countdown) countdown.dataset.liveReady = "true";
  }

  function restoreCountdownLabels() {
    const labels = ["Días", "Hrs", "Min", "Seg"];
    document.querySelectorAll("#countdown .time-box").forEach((box, index) => {
      const label = box.querySelector(".time-label");
      if (label) label.textContent = labels[index] || "";
      box.classList.remove("is-predice-card");
      box.classList.remove("is-juega-card");
      box.removeAttribute("role");
      box.removeAttribute("tabindex");
      box.removeAttribute("aria-label");
    });
  }

  function updateSimulatorMessage() {
    const home = Number(document.getElementById("score-home")?.textContent || 0);
    const away = Number(document.getElementById("score-away")?.textContent || 0);
    const homeName = document.getElementById("simHomeName")?.textContent || currentSimMatch.home;
    const awayName = document.getElementById("simAwayName")?.textContent || currentSimMatch.away;
    const message = document.getElementById("simulatorMessage");

    if (!message) return;
    if (home > away) {
      message.textContent = `Predicción: ${homeName} gana el partido.`;
    } else if (away > home) {
      message.textContent = `Predicción: ${awayName} gana el partido.`;
    } else {
      message.textContent = "Predicción: empate intenso hasta el final.";
    }
  }

  function initializeLiveSimulator() {
    const matches = getScheduledMatches();
    const saveButton = document.getElementById("saveScorePrediction");

    if (matches.length) {
      currentSimMatch = getRelevantMatch(matches);
      renderSimulatorMatch(currentSimMatch);
    }

    saveButton?.addEventListener("click", () => {
      const homeScore = document.getElementById("score-home")?.textContent || "0";
      const awayScore = document.getElementById("score-away")?.textContent || "0";
      const message = document.getElementById("predictionScoreMessage");
      if (!message) return;
      savePrediction(predictionStorageKeys.score, {
        match: `${currentSimMatch.home}-${currentSimMatch.away}`,
        home: currentSimMatch.home,
        away: currentSimMatch.away,
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        venue: currentSimMatch.venue,
        savedAt: new Date().toISOString(),
        status: "pendiente"
      });
      message.textContent = `Tu marcador quedó listo: ${currentSimMatch.home} ${homeScore} - ${awayScore} ${currentSimMatch.away}.`;
    });

    restoreScorePrediction();
    syncLiveScore();
    window.setInterval(syncLiveScore, liveScoreConfig.pollMs);
  }

  function readMatchCard(match) {
    const date = match.querySelector(".date span")?.textContent.trim() || "";
    const time = match.querySelector(".date small")?.textContent.trim() || "";
    const group = match.querySelector(".date em")?.textContent.trim() || "";
    const venue = match.querySelector(".venue")?.textContent.trim() || "";
    const sides = Array.from(match.querySelectorAll(".side"));
    const home = sides[0]?.querySelector("span")?.textContent.trim() || "MEX";
    const away = sides[1]?.querySelector("span")?.textContent.trim() || "RSA";
    const homeFlag = sides[0]?.querySelector("img")?.src?.replace("/w40/", "/w160/") || "https://flagcdn.com/w160/mx.png";
    const awayFlag = sides[1]?.querySelector("img")?.src?.replace("/w40/", "/w160/") || "https://flagcdn.com/w160/za.png";

    return { home, away, date, time, group, venue, homeFlag, awayFlag };
  }

  function renderSimulatorMatch(match) {
    const homeFlag = document.getElementById("simHomeFlag");
    const awayFlag = document.getElementById("simAwayFlag");
    const homeName = document.getElementById("simHomeName");
    const awayName = document.getElementById("simAwayName");
    const meta = document.getElementById("simMatchMeta");
    const venue = document.getElementById("simVenue");

    if (homeFlag) {
      homeFlag.src = match.homeFlag;
      homeFlag.alt = `Bandera de ${match.home}`;
    }
    if (awayFlag) {
      awayFlag.src = match.awayFlag;
      awayFlag.alt = `Bandera de ${match.away}`;
    }
    if (homeName) homeName.textContent = match.home;
    if (awayName) awayName.textContent = match.away;
    if (meta) meta.textContent = `${match.date} · ${match.time} · ${match.group}`;
    if (venue) venue.textContent = match.venue;
    updateSimulatorMessage();
  }

  function restoreScorePrediction() {
    const prediction = readPrediction(predictionStorageKeys.score);
    const message = document.getElementById("predictionScoreMessage");
    const homeScore = document.getElementById("score-home");
    const awayScore = document.getElementById("score-away");

    if (!prediction || !message) return;

    if (prediction.match !== `${currentSimMatch.home}-${currentSimMatch.away}`) {
      message.textContent = `Tienes una predicción guardada: ${prediction.home} ${prediction.homeScore} - ${prediction.awayScore} ${prediction.away}.`;
      return;
    }

    if (homeScore) homeScore.textContent = prediction.homeScore;
    if (awayScore) awayScore.textContent = prediction.awayScore;
    message.textContent = `Tu predicción guardada: ${prediction.home} ${prediction.homeScore} - ${prediction.awayScore} ${prediction.away}.`;
    updateSimulatorMessage();
  }

  async function syncLiveScore() {
    const status = document.getElementById("liveStatus");

    if (!status) return;

    status.textContent = "Actualizando";

    try {
      const realDay = await syncRealWorldCupDay();
      const realFixture = realDay?.selected;

      if (realFixture) {
        renderApiFixture(realFixture);
        status.textContent = realFixture.status === "FT" ? "Finalizado" : realFixture.elapsed ? `${realFixture.elapsed}'` : "Oficial";
        status.title = "Datos reales del Mundial 2026.";
        return;
      }

      renderRecentResultsFallback("Los resultados recientes aparecerán cuando estén disponibles.");
      refreshCurrentSimulatorMatch();
      const params = new URLSearchParams({
        date: getMatchApiDate(currentSimMatch),
        home: currentSimMatch.home,
        away: currentSimMatch.away
      });
      const response = await fetch(`${liveScoreConfig.endpoint}?${params.toString()}`);

      if (!response.ok) throw new Error("Marcador no disponible en este momento.");

      const data = await response.json();

      if (!data.ok) {
        status.textContent = data.mode === "demo" ? "Predicción activa" : "Por confirmar";
        status.title = data.message || "El marcador en vivo se actualizará cuando esté disponible.";
        return;
      }

      applyLiveScore(data);
      status.textContent = data.status === "FT" ? "Finalizado" : data.elapsed ? `${data.elapsed}'` : "En vivo";
    } catch (error) {
      renderRecentResultsFallback("Los resultados recientes aparecerán cuando estén disponibles.");
      status.textContent = "Por confirmar";
      status.title = "El marcador en vivo se actualizará cuando esté disponible.";
    }
  }

  function applyLiveScore(fixture) {
    const homeScore = document.getElementById("score-home");
    const awayScore = document.getElementById("score-away");
    const homeName = document.getElementById("simHomeName");
    const awayName = document.getElementById("simAwayName");
    const goalsHome = fixture.goals?.home;
    const goalsAway = fixture.goals?.away;

    if (fixture.home && homeName) homeName.textContent = fixture.home;
    if (fixture.away && awayName) awayName.textContent = fixture.away;
    if (Number.isInteger(goalsHome) && homeScore) homeScore.textContent = goalsHome;
    if (Number.isInteger(goalsAway) && awayScore) awayScore.textContent = goalsAway;
    updateSimulatorMessage();
    updateScorePredictionResult(fixture);
  }

  function updateScorePredictionResult(fixture) {
    const prediction = readPrediction(predictionStorageKeys.score);
    const message = document.getElementById("predictionScoreMessage");
    const status = fixture.status || "";
    const finalStatuses = ["FT", "AET", "PEN"];

    if (!prediction || !message || prediction.match !== `${currentSimMatch.home}-${currentSimMatch.away}`) return;
    if (!finalStatuses.includes(status)) {
      message.textContent = `Tu predicción sigue pendiente: ${prediction.home} ${prediction.homeScore} - ${prediction.awayScore} ${prediction.away}.`;
      return;
    }

    const goalsHome = fixture.goals?.home;
    const goalsAway = fixture.goals?.away;
    const didMatch = prediction.homeScore === goalsHome && prediction.awayScore === goalsAway;
    const updatedPrediction = {
      ...prediction,
      status: didMatch ? "acertada" : "no-se-dio",
      realHomeScore: goalsHome,
      realAwayScore: goalsAway,
      checkedAt: new Date().toISOString()
    };

    savePrediction(predictionStorageKeys.score, updatedPrediction);
    message.textContent = didMatch
      ? `Tu predicción se cumplió: ${prediction.home} ${goalsHome} - ${goalsAway} ${prediction.away}.`
      : `Tu predicción no se dio. Resultado final: ${prediction.home} ${goalsHome} - ${goalsAway} ${prediction.away}.`;
  }

  const quizQuestions = [
    {
      question: "¿Dónde será la final del Mundial 2026?",
      options: ["MetLife Stadium, NJ", "Estadio Azteca, CDMX", "SoFi Stadium, LA"],
      correct: "MetLife Stadium, NJ"
    },
    {
      question: "¿Qué países serán sede del Mundial 2026?",
      options: ["Canadá, México y Estados Unidos", "México, Brasil y Estados Unidos", "Canadá, España y México"],
      correct: "Canadá, México y Estados Unidos"
    },
    {
      question: "¿Cuántas selecciones participan en el Mundial 2026?",
      options: ["32", "40", "48"],
      correct: "48"
    },
    {
      question: "¿Cuántos grupos tendrá la fase de grupos?",
      options: ["8 grupos", "12 grupos", "16 grupos"],
      correct: "12 grupos"
    },
    {
      question: "¿Qué partido abre el Mundial 2026?",
      options: ["México vs Sudáfrica", "Estados Unidos vs Paraguay", "Brasil vs Marruecos"],
      correct: "México vs Sudáfrica"
    },
    {
      question: "¿En qué estadio se juega el partido inaugural?",
      options: ["Estadio Azteca", "BMO Field", "MetLife Stadium"],
      correct: "Estadio Azteca"
    },
    {
      question: "¿Cuál es la fecha programada para la final?",
      options: ["19 de julio de 2026", "11 de junio de 2026", "27 de junio de 2026"],
      correct: "19 de julio de 2026"
    },
    {
      question: "¿Cuál de estas selecciones debuta en un Mundial en 2026?",
      options: ["Uzbekistán", "Argentina", "Alemania"],
      correct: "Uzbekistán"
    }
  ];

  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let quizFinished = false;
  let setMatchTeamFilter = () => {};

  const teamCodes = {
    "Alemania": "GER",
    "Arabia Saudita": "KSA",
    "Argelia": "ALG",
    "Argentina": "ARG",
    "Australia": "AUS",
    "Austria": "AUT",
    "Bélgica": "BEL",
    "Bosnia y Herzegovina": "BIH",
    "Brasil": "BRA",
    "Cabo Verde": "CPV",
    "Canadá": "CAN",
    "Colombia": "COL",
    "Corea del Sur": "KOR",
    "Costa de Marfil": "CIV",
    "Croacia": "CRO",
    "Curazao": "CUW",
    "Ecuador": "ECU",
    "Egipto": "EGY",
    "Escocia": "SCO",
    "España": "ESP",
    "Estados Unidos": "USA",
    "Francia": "FRA",
    "Ghana": "GHA",
    "Haití": "HAI",
    "Inglaterra": "ENG",
    "Irak": "IRQ",
    "Irán": "IRN",
    "Japón": "JPN",
    "Jordania": "JOR",
    "Marruecos": "MAR",
    "México": "MEX",
    "Noruega": "NOR",
    "Nueva Zelanda": "NZL",
    "Países Bajos": "NED",
    "Panamá": "PAN",
    "Paraguay": "PAR",
    "Portugal": "POR",
    "Qatar": "QAT",
    "RD Congo": "COD",
    "República Checa": "CZE",
    "Senegal": "SEN",
    "Sudáfrica": "RSA",
    "Suecia": "SWE",
    "Suiza": "SUI",
    "Túnez": "TUN",
    "Turquía": "TUR",
    "Uruguay": "URU",
    "Uzbekistán": "UZB"
  };

  function setupInteractions() {
    document.getElementById("startExperience")?.addEventListener("click", () => {
      document.querySelector(".team-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("viewMatches")?.addEventListener("click", () => {
      document.querySelector(".matches-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const favoriteMessage = document.getElementById("favoriteTeamMessage");
    const teamsGrid = document.getElementById("teamsGrid");
    const toggleTeams = document.getElementById("toggleTeams");

    toggleTeams?.addEventListener("click", () => {
      const isExpanded = teamsGrid.classList.toggle("teams-expanded");
      teamsGrid.classList.toggle("teams-collapsed", !isExpanded);
      toggleTeams.textContent = isExpanded ? "Ver menos selecciones" : "Ver todas las selecciones";
    });

    document.querySelectorAll(".team").forEach((teamButton) => {
      teamButton.addEventListener("click", () => {
        document.querySelectorAll(".team").forEach((button) => button.classList.remove("active"));
        teamButton.classList.add("active");
        favoriteMessage.textContent = `Tu selección favorita es ${teamButton.dataset.team}.`;
        renderFavoriteFixtures(teamButton.dataset.team);
        setMatchTeamFilter(teamButton.dataset.team);
      });
    });

    document.getElementById("savePrediction")?.addEventListener("click", () => {
      const select = document.getElementById("championSelect");
      const message = document.getElementById("predictionMessage");
      const champion = select.value;
      if (!champion) {
        message.textContent = "Primero selecciona una selección.";
        return;
      }

      savePrediction(predictionStorageKeys.champion, {
        champion,
        savedAt: new Date().toISOString(),
        status: "pendiente"
      });
      message.textContent = `Tu predicción quedó lista: ${champion} campeón del Mundial 2026.`;
    });

    setupMatchPagination();
    initializeLiveSimulator();
    initQuiz();
    renderFavoriteFixtures("Colombia");
    restoreChampionPrediction();
  }

  function restoreChampionPrediction() {
    const prediction = readPrediction(predictionStorageKeys.champion);
    const select = document.getElementById("championSelect");
    const message = document.getElementById("predictionMessage");

    if (!prediction || !select || !message) return;

    select.value = prediction.champion;
    message.textContent = `Tu predicción guardada: ${prediction.champion} campeón del Mundial 2026. Estado: pendiente.`;
  }

  function getTeamMatches(teamName, limit = 3) {
    const code = teamCodes[teamName];
    const matches = Array.from(document.querySelectorAll(".match-list-full .match"));

    if (!code) return [];

    return matches
      .filter((match) => {
        const codes = Array.from(match.querySelectorAll(".side span")).map((span) => span.textContent.trim());
        return codes.includes(code);
      })
      .slice(0, limit);
  }

  function renderFavoriteFixtures(teamName) {
    const container = document.getElementById("favoriteFixtures");
    const teamMatches = getTeamMatches(teamName);

    if (!container) return;

    if (!teamMatches.length) {
      container.innerHTML = `<div class="favorite-fixture"><div class="favorite-fixture-main">Aún no hay partidos cargados para ${teamName}.</div></div>`;
      return;
    }

    container.innerHTML = teamMatches.map((match) => {
      const date = match.querySelector(".date span")?.textContent.trim() || "";
      const time = match.querySelector(".date small")?.textContent.trim() || "";
      const group = match.querySelector(".date em")?.textContent.trim() || "";
      const venue = match.querySelector(".venue")?.textContent.trim() || "";
      const sides = Array.from(match.querySelectorAll(".side span")).map((span) => span.textContent.trim());

      return `
        <div class="favorite-fixture">
          <div class="favorite-fixture-meta">${date}<br>${time}<br>${group}</div>
          <div class="favorite-fixture-main">${sides[0]} vs ${sides[1]}<small>${venue}</small></div>
        </div>
      `;
    }).join("");
  }

  function initQuiz() {
    const nextButton = document.getElementById("nextQuiz");
    nextButton?.addEventListener("click", nextQuizQuestion);
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const current = quizQuestions[quizIndex];
    const question = document.getElementById("quizQuestion");
    const choices = document.getElementById("quizChoices");
    const message = document.getElementById("quizMessage");
    const progress = document.getElementById("quizProgress");
    const nextButton = document.getElementById("nextQuiz");

    quizAnswered = false;
    quizFinished = false;
    question.textContent = current.question;
    message.textContent = "";
    progress.textContent = `Pregunta ${quizIndex + 1} / ${quizQuestions.length}`;
    nextButton.textContent = quizIndex === quizQuestions.length - 1 ? "Ver resultado" : "Siguiente pregunta";
    nextButton.disabled = true;

    choices.innerHTML = "";
    current.options.forEach((option) => {
      const button = document.createElement("button");
      button.className = "choice";
      button.type = "button";
      button.textContent = option;
      button.addEventListener("click", () => answerQuiz(button, option));
      choices.appendChild(button);
    });
  }

  function answerQuiz(button, selectedOption) {
    if (quizAnswered) return;

    const current = quizQuestions[quizIndex];
    const message = document.getElementById("quizMessage");
    const nextButton = document.getElementById("nextQuiz");
    quizAnswered = true;

    document.querySelectorAll(".choice").forEach((choice) => {
      choice.classList.remove("correct", "wrong");
      choice.disabled = true;
      if (choice.textContent === current.correct) {
        choice.classList.add("correct");
      }
    });

    if (selectedOption === current.correct) {
      quizScore += 1;
      message.textContent = "Respuesta correcta.";
    } else {
      button.classList.add("wrong");
      message.textContent = `Respuesta incorrecta. La correcta es: ${current.correct}.`;
    }

    nextButton.disabled = false;
  }

  function nextQuizQuestion() {
    if (quizFinished) {
      quizIndex = 0;
      quizScore = 0;
      renderQuizQuestion();
      return;
    }

    if (!quizAnswered) return;

    if (quizIndex < quizQuestions.length - 1) {
      quizIndex += 1;
      renderQuizQuestion();
      return;
    }

    showQuizResult();
  }

  function showQuizResult() {
    const question = document.getElementById("quizQuestion");
    const choices = document.getElementById("quizChoices");
    const message = document.getElementById("quizMessage");
    const progress = document.getElementById("quizProgress");
    const nextButton = document.getElementById("nextQuiz");

    question.textContent = "Resultado del quiz mundialista";
    choices.innerHTML = "";
    message.textContent = `Acertaste ${quizScore} de ${quizQuestions.length} preguntas reales sobre el Mundial 2026.`;
    progress.textContent = "Quiz completado";
    nextButton.textContent = "Reiniciar quiz";
    nextButton.disabled = false;
    quizFinished = true;
  }

  function setupMatchPagination() {
    const matches = Array.from(document.querySelectorAll(".match-list-full .match"));
    const prevButton = document.getElementById("prevMatches");
    const nextButton = document.getElementById("nextMatches");
    const pageLabel = document.getElementById("matchPage");
    const groupFilter = document.getElementById("groupFilter");
    const teamFilter = document.getElementById("teamFilter");
    const filterMessage = document.getElementById("matchFilterMessage");
    const perPage = 6;
    let page = 0;

    if (!matches.length || !prevButton || !nextButton || !pageLabel) return;

    if (teamFilter) {
      Object.keys(teamCodes).sort((a, b) => a.localeCompare(b, "es")).forEach((teamName) => {
        const option = document.createElement("option");
        option.value = teamCodes[teamName];
        option.textContent = teamName;
        teamFilter.appendChild(option);
      });
    }

    function renderPage() {
      const selectedGroup = groupFilter?.value || "";
      const selectedTeam = teamFilter?.value || "";
      const filteredMatches = matches.filter((match) => {
        const group = match.querySelector(".date em")?.textContent.trim() || "";
        const codes = Array.from(match.querySelectorAll(".side span")).map((span) => span.textContent.trim());
        return (!selectedGroup || group === selectedGroup) && (!selectedTeam || codes.includes(selectedTeam));
      });
      const totalPages = Math.max(1, Math.ceil(filteredMatches.length / perPage));
      const start = page * perPage;
      const end = start + perPage;

      matches.forEach((match) => {
        const filteredIndex = filteredMatches.indexOf(match);
        match.classList.toggle("is-hidden", filteredIndex === -1 || filteredIndex < start || filteredIndex >= end);
      });

      pageLabel.textContent = `${page + 1} / ${totalPages}`;
      prevButton.disabled = page === 0;
      nextButton.disabled = page === totalPages - 1;

      if (filterMessage) {
        const teamName = Object.keys(teamCodes).find((name) => teamCodes[name] === selectedTeam);
        const parts = [];
        if (selectedGroup) parts.push(selectedGroup);
        if (teamName) parts.push(teamName);
        const label = filteredMatches.length === 1 ? "partido" : "partidos";
        filterMessage.textContent = parts.length
          ? `Mostrando ${filteredMatches.length} ${label} de ${parts.join(" · ")}.`
          : "Mostrando todos los partidos.";
      }
    }

    function resetAndRender() {
      page = 0;
      renderPage();
    }

    groupFilter?.addEventListener("change", resetAndRender);
    teamFilter?.addEventListener("change", resetAndRender);

    setMatchTeamFilter = (teamName) => {
      if (!teamFilter) return;
      teamFilter.value = teamCodes[teamName] || "";
      resetAndRender();
    };

    prevButton.addEventListener("click", () => {
      page = Math.max(0, page - 1);
      renderPage();
    });

    nextButton.addEventListener("click", () => {
      const selectedGroup = groupFilter?.value || "";
      const selectedTeam = teamFilter?.value || "";
      const filteredCount = matches.filter((match) => {
        const group = match.querySelector(".date em")?.textContent.trim() || "";
        const codes = Array.from(match.querySelectorAll(".side span")).map((span) => span.textContent.trim());
        return (!selectedGroup || group === selectedGroup) && (!selectedTeam || codes.includes(selectedTeam));
      }).length;
      page = Math.min(Math.max(0, Math.ceil(filteredCount / perPage) - 1), page + 1);
      renderPage();
    });

    renderPage();
  }

  function bootBall() {
    const container = document.getElementById("ball3d");
    if (!window.THREE || !container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const group = new THREE.Group();
    const aura = new THREE.Group();

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.85, 48, 48),
      new THREE.MeshPhongMaterial({ color: 0xf0fff8, specular: 0x00f2d1, shininess: 70 })
    );
    group.add(ball);

    for (let i = 0; i < 13; i += 1) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(i % 3 === 0 ? 0.42 : 0.34, 6),
        new THREE.MeshBasicMaterial({ color: 0x06152a })
      );
      const phi = Math.acos(-1 + (2 * i) / 13);
      const theta = Math.sqrt(13 * Math.PI) * phi;
      patch.position.setFromSphericalCoords(1.88, phi, theta);
      patch.lookAt(new THREE.Vector3(0, 0, 0));
      patch.rotateY(Math.PI);
      group.add(patch);
    }

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f2d1,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.012, 8, 96), ringMaterial);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.009, 8, 96), ringMaterial.clone());
    ringA.rotation.x = Math.PI * 0.56;
    ringA.rotation.y = Math.PI * 0.12;
    ringB.rotation.x = Math.PI * 0.42;
    ringB.rotation.z = Math.PI * 0.34;
    ringB.material.opacity = 0.14;
    aura.add(ringA, ringB);

    const particleCount = 90;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 2.45 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x6dfff0,
        size: 0.035,
        transparent: true,
        opacity: 0.52,
        depthWrite: false
      })
    );
    aura.add(particles);

    scene.add(group);
    scene.add(aura);
    scene.add(new THREE.AmbientLight(0xffffff, 0.48));
    const key = new THREE.DirectionalLight(0x00f2d1, 1.5);
    key.position.set(4, 5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.75);
    fill.position.set(-3, -1, 4);
    scene.add(fill);
    camera.position.z = 6.3;

    function resize() {
      const size = container.clientWidth;
      renderer.setSize(size, size);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }

    function animate() {
      group.rotation.y += 0.012;
      group.rotation.x += 0.004;
      aura.rotation.y -= 0.0035;
      aura.rotation.z += 0.002;
      ringA.rotation.z += 0.004;
      ringB.rotation.y -= 0.003;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize);
    resize();
    animate();
  }

  tickClock();
  tickCountdown();
  setupInteractions();
  updateSimulatorMessage();
  window.setInterval(tickClock, 1000);
  window.setInterval(tickCountdown, 1000);
  bootShader();
  bootBall();

