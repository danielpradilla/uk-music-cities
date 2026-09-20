import { GAMES, MusicGame, coordinates, prepareGameData, shuffled, ROUND_SECONDS } from "./games.js?v=329a3fc6b8d3";
import { createProjection, featurePath, WIDTH, HEIGHT, DEFAULT_MAP_ZOOM, DEFAULT_MAP_TRANSFORM } from "./map.js?v=329a3fc6b8d3";
import { assetUrl } from "./data.js?v=329a3fc6b8d3";

const format = new Intl.NumberFormat("en-GB");

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(text, action, className = "") {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function svgElement(tag, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function locationMap(outline, points = [], onPin = null, useExplorerZoom = false) {
  const project = createProjection(outline);
  const svg = svgElement("svg", {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: `game-map${onPin ? " is-picking" : ""}`,
    role: onPin ? "group" : "img",
    "aria-label": onPin
      ? "Place a pin on the UK map. Click or tap to answer. With a keyboard, use arrow keys to move, Shift for fine adjustment, then press Enter."
      : `Formation places: ${points.map((point) => point.label).join("; ")}`,
  });
  const layer = svgElement("g", useExplorerZoom ? { transform: DEFAULT_MAP_TRANSFORM } : {});
  svg.append(layer);
  outline.features.forEach((feature) => layer.append(svgElement("path", {
    class: "uk-outline", d: featurePath(feature, project), "fill-rule": "evenodd",
  })));
  if (points.length === 2) {
    const [a, b] = points.map((point) => project(point.coordinates));
    layer.append(svgElement("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "game-map-line" }));
  }
  points.forEach((point) => {
    if (onPin) return;
    const [x, y] = project(point.coordinates);
    const scale = useExplorerZoom ? DEFAULT_MAP_ZOOM : 1;
    layer.append(svgElement("circle", { cx: x, cy: y, r: 6 / scale, class: `game-map-dot ${point.kind || "answer"}` }));
    const label = svgElement("text", { x: x + 10 / scale, y: y - 10 / scale, class: "game-map-label", style: `font-size:${13 / scale}px` });
    label.textContent = point.label;
    layer.append(label);
  });
  if (onPin) {
    svg.setAttribute("tabindex", "0");
    const scale = useExplorerZoom ? DEFAULT_MAP_ZOOM : 1;
    const pin = svgElement("circle", { r: 7 / scale, class: "game-map-dot guess", visibility: "hidden" });
    layer.append(pin);
    let cursor = project([-2.5, 54]);
    let placed = false;
    const placePin = (point, commit = false) => {
      cursor = [Math.max(0, Math.min(WIDTH, point[0])), Math.max(0, Math.min(HEIGHT, point[1]))];
      pin.setAttribute("cx", cursor[0]);
      pin.setAttribute("cy", cursor[1]);
      pin.setAttribute("visibility", "visible");
      placed = true;
      onPin(project.invert(cursor), commit);
    };
    if (points[0]) placePin(project(points[0].coordinates));
    svg.addEventListener("click", (event) => {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(layer.getScreenCTM().inverse());
      placePin([local.x, local.y], true);
    });
    svg.addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key) && placed) {
        event.preventDefault();
        onPin(project.invert(cursor), true);
        return;
      }
      const step = (event.shiftKey ? 1 : 8) / scale;
      const movement = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (!movement) return;
      event.preventDefault();
      placePin([cursor[0] + movement[0], cursor[1] + movement[1]]);
    });
  }
  return svg;
}

function northSouthMap(outline, reference, target = null, onChoose = null) {
  const project = createProjection(outline);
  const [pinX, splitY] = project(coordinates(reference));
  const svg = svgElement("svg", {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: `game-map north-south-map${onChoose ? " is-picking" : ""}`,
    role: onChoose ? "group" : "img",
    "aria-label": onChoose
      ? `Map divided at ${reference.originCluster}. Click above the pin for north or below it for south. Keyboard users press Arrow Up for north or Arrow Down for south.`
      : `North and south of ${reference.originCluster}.`,
  });
  const defs = svgElement("defs", {});
  const northClip = svgElement("clipPath", { id: "north-game-clip", clipPathUnits: "userSpaceOnUse" });
  northClip.append(svgElement("rect", { x: 0, y: 0, width: WIDTH, height: splitY }));
  const southClip = svgElement("clipPath", { id: "south-game-clip", clipPathUnits: "userSpaceOnUse" });
  southClip.append(svgElement("rect", { x: 0, y: splitY, width: WIDTH, height: HEIGHT - splitY }));
  defs.append(northClip, southClip);
  svg.append(defs);
  const layer = svgElement("g", { transform: DEFAULT_MAP_TRANSFORM });
  outline.features.forEach((feature) => {
    const attributes = { d: featurePath(feature, project), "fill-rule": "evenodd" };
    layer.append(svgElement("path", { ...attributes, class: "north-south-region north", "clip-path": "url(#north-game-clip)" }));
    layer.append(svgElement("path", { ...attributes, class: "north-south-region south", "clip-path": "url(#south-game-clip)" }));
  });
  layer.append(svgElement("line", { x1: 0, y1: splitY, x2: WIDTH, y2: splitY, class: "north-south-divider" }));
  layer.append(svgElement("circle", { cx: pinX, cy: splitY, r: 6 / DEFAULT_MAP_ZOOM, class: "north-south-pin" }));
  const pinAnchor = pinX > WIDTH / 2 ? "end" : "start";
  const cityLabel = svgElement("text", {
    x: pinX + (pinAnchor === "end" ? -10 : 10) / DEFAULT_MAP_ZOOM, y: splitY - 10 / DEFAULT_MAP_ZOOM,
    class: "game-map-label north-south-city-label", "text-anchor": pinAnchor,
  });
  cityLabel.textContent = `${reference.name} · ${reference.originCluster}`;
  layer.append(cityLabel);
  if (target) {
    const [x, y] = project(coordinates(target));
    layer.append(svgElement("circle", { cx: x, cy: y, r: 6 / DEFAULT_MAP_ZOOM, class: "north-south-target" }));
    const targetAnchor = x > WIDTH / 2 ? "end" : "start";
    const targetLabel = svgElement("text", {
      x: x + (targetAnchor === "end" ? -10 : 10) / DEFAULT_MAP_ZOOM, y: y - 10 / DEFAULT_MAP_ZOOM,
      class: "game-map-label north-south-city-label", "text-anchor": targetAnchor,
    });
    targetLabel.textContent = `${target.name} · ${target.originCluster}`;
    layer.append(targetLabel);
  }
  svg.append(layer);
  const northLabel = svgElement("text", { x: 18, y: 30, class: "north-south-label" });
  northLabel.textContent = "NORTH";
  const southLabel = svgElement("text", { x: 18, y: HEIGHT - 18, class: "north-south-label" });
  southLabel.textContent = "SOUTH";
  svg.append(northLabel, southLabel);
  if (onChoose) {
    svg.setAttribute("tabindex", "0");
    svg.addEventListener("click", (event) => {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(layer.getScreenCTM().inverse());
      onChoose(local.y < splitY ? "north" : "south");
    });
    svg.addEventListener("keydown", (event) => {
      const choice = ["ArrowUp", "n", "N"].includes(event.key) ? "north"
        : ["ArrowDown", "s", "S"].includes(event.key) ? "south" : null;
      if (!choice) return;
      event.preventDefault();
      onChoose(choice);
    });
  }
  return svg;
}

export function initGames(container, dashboard, outline) {
  const data = prepareGameData(dashboard);
  const snapshotDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(dashboard.meta.freshness.spotify));
  let game = null;
  let selected = new Set();
  let results = false;
  let runId = null;
  let version = 0;
  let deadline = 0;
  let pausedTimeLeft = 0;
  let board = null;
  let clockTimer;
  let advanceTimer;
  let busy = false;
  let failure = null;
  let nickname = "";
  let generation = 0;
  try { nickname = localStorage.getItem("music-nickname") || ""; } catch { /* Private storage can be unavailable. */ }

  function clearTimers() {
    clearInterval(clockTimer);
    clearTimeout(advanceTimer);
  }

  async function api(action, value = null) {
    const response = await fetch(assetUrl(`/api/${action}`), value === null ? { cache: "no-store", signal: AbortSignal.timeout(8000) } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Competition needs the game server. You can still play practice rounds.");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not reach the score service.");
    return payload;
  }

  function receive(payload) {
    const pendingPin = game?.index === payload.game.index ? game?.round.pendingPin : null;
    game = payload.game;
    if (pendingPin && !game.round.answered) game.round.pendingPin = pendingPin;
    runId = payload.id;
    version = payload.version;
    deadline = performance.now() + payload.deadline - payload.serverNow;
    pausedTimeLeft = game.round.answered ? Math.max(0, payload.deadline - payload.serverNow) : 0;
    board = payload.board;
    failure = null;
  }

  async function perform(action, value) {
    if (busy) return;
    clearTimers();
    busy = true;
    const expectedGeneration = generation;
    if (runId) {
      container.querySelectorAll("button").forEach((control) => { control.disabled = true; });
      try {
        const payload = await api("action", { id: runId, version, action, value });
        if (generation !== expectedGeneration) { busy = false; return; }
        receive(payload);
      } catch (error) {
        if (generation !== expectedGeneration) { busy = false; return; }
        failure = { action, value, message: error.message };
      }
    } else {
      game[action](value);
    }
    busy = false;
    selected.clear();
    render();
  }

  function timers() {
    if (!runId || results || container.hidden || failure) return;
    if (game.round.answered) {
      advanceTimer = setTimeout(() => {
        if (game.over) { results = true; render(); }
        else perform("next");
      }, 1800);
      return;
    }
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      const clock = container.querySelector(".game-clock");
      if (clock) {
        clock.textContent = `${Math.ceil(left / 1000)}s`;
        clock.classList.toggle("is-urgent", left < 4000);
      }
      const bar = container.querySelector(".game-time-bar");
      if (bar) bar.value = left;
      if (left === 0 && !busy) perform("timeout");
    };
    clockTimer = setInterval(tick, 100);
    tick();
  }

  function leaderboard(parent, scores) {
    parent.replaceChildren();
    parent.append(element("h2", "", "Today’s leaderboard"));
    if (!scores.total) {
      parent.append(element("p", "game-subtle", "No scores yet. Finish a competitive game to set the first score."));
      return;
    }
    const standing = scores.standing;
    if (standing) {
      parent.append(element("p", "game-standing", `Your best: #${standing.rank} of ${scores.total} · ${format.format(standing.score)} points`));
      parent.append(element("p", "game-subtle", standing.others
        ? `You scored higher than ${standing.percentile}% of ${standing.others} other ${standing.others === 1 ? "player" : "players"}.`
        : "You’re the first player today. Your score is ready for someone to beat."));
    }
    const table = element("table", "game-leaderboard-table");
    const caption = element("caption", "visually-hidden", `${scores.total} ${scores.total === 1 ? "player" : "players"} · ${scores.date} UTC`);
    const head = element("thead");
    const header = element("tr");
    ["Rank", "Player", "Points", "Time"].forEach((label) => {
      const cell = element("th", "", label); cell.scope = "col"; header.append(cell);
    });
    head.append(header);
    const rows = element("tbody");
    scores.rows.forEach((entry) => {
      const row = element("tr", entry.you ? "is-you" : "");
      [String(entry.rank), `${entry.nickname}${entry.you ? " (you)" : ""}`, format.format(entry.score), `${(entry.elapsed / 1000).toFixed(1)}s`]
        .forEach((value) => row.append(element("td", "", value)));
      rows.append(row);
    });
    table.append(caption, head, rows);
    parent.append(table, element("p", "game-subtle", `${scores.total} ${scores.total === 1 ? "player" : "players"} · Best score per player · Ties use fastest total answering time · Resets at midnight UTC`));
  }

  function lobby(mode) {
    clearTimers();
    generation += 1;
    game = null;
    runId = null;
    failure = null;
    container.replaceChildren();
    container.classList.remove("is-wide-game");
    const definition = GAMES.find((entry) => entry.id === mode);
    const back = element("a", "game-back", "← All games"); back.href = "#games";
    const title = element("h1", "", definition.name); title.tabIndex = -1;
    container.append(back, title, element("p", "game-lead", definition.description));
    const layout = element("div", "game-lobby");
    const form = element("form", "game-guess-form");
    const scope = ["mystery", "connections"].includes(mode) ? "for the puzzle" : "per question";
    form.append(element("h2", "", `${ROUND_SECONDS[mode]} seconds ${scope}`),
      element("p", "game-subtle", "Same daily challenge for everyone. Answer quickly for up to 50% extra points."));
    const label = element("label", "", "Your nickname"); label.htmlFor = "player-nickname";
    const input = element("input"); input.id = "player-nickname"; input.value = nickname;
    input.placeholder = "How should we show your score?"; input.minLength = 2; input.maxLength = 24; input.required = true;
    const actions = element("div", "game-actions");
    const begin = element("button", "game-primary", "Start competing →"); begin.type = "submit";
    actions.append(begin, button("Untimed practice", () => start(mode, false)));
    const error = element("p", "game-message"); error.setAttribute("role", "alert");
    form.append(label, input, element("p", "game-subtle", "Your nickname and best score will appear on the public leaderboard. No account needed."), actions, error);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true; begin.disabled = true; begin.textContent = "Starting…";
      const expectedGeneration = generation;
      try {
        nickname = input.value.trim();
        const payload = await api("start", { mode, nickname });
        if (generation !== expectedGeneration) { busy = false; return; }
        receive(payload);
        try { localStorage.setItem("music-nickname", nickname); } catch { /* Playing does not require localStorage. */ }
        selected.clear(); results = false; busy = false; render();
      } catch (problem) {
        busy = false; begin.disabled = false; begin.textContent = "Start competing →"; error.textContent = problem.message;
      }
    });
    const rankings = element("section", "game-leaderboard");
    rankings.append(element("p", "game-subtle", "Loading today’s scores…"));
    api(`leaderboard?mode=${mode}`).then((scores) => leaderboard(rankings, scores)).catch(() => {
      rankings.replaceChildren(element("h2", "", "Today’s leaderboard"), element("p", "game-subtle", "Scores are unavailable right now. Try again shortly, or play untimed practice."));
    });
    layout.append(form, rankings);
    container.append(layout);
    focusHeading();
  }

  function start(mode, daily = true) {
    generation += 1;
    clearTimers(); runId = null; board = null; failure = null;
    game = new MusicGame(mode, data, { daily });
    selected = new Set();
    results = false;
    render();
  }

  function focusHeading() {
    container.querySelector("h1, h2")?.focus({ preventScroll: true });
  }

  function showMenu() {
    generation += 1;
    clearTimers();
    container.replaceChildren();
    container.classList.remove("is-wide-game");
    const intro = element("header", "game-intro");
    intro.append(element("p", "game-eyebrow", "Three games · Short clocks · Daily leaderboards"));
    const heading = element("h1", "", "Know the band. Find the place.");
    heading.tabIndex = -1;
    intro.append(heading, element("p", "game-lead", "Beat the clock, save your score, and see how you rank against other players."));
    container.append(intro);
    const grid = element("div", "game-menu");
    GAMES.forEach((definition, index) => {
      const card = element("a", "game-card");
      card.href = `#games/${definition.id}`;
      card.append(element("span", "game-card-number", String(index + 1).padStart(2, "0")),
        element("span", "game-eyebrow", `${definition.tag} · ${ROUND_SECONDS[definition.id]}s`), element("h2", "", definition.name),
        element("p", "", definition.description), element("span", "game-card-play", "Play →"));
      grid.append(card);
    });
    container.append(grid, element("p", "game-footnote", `${format.format(data.bands.length)} bands with clear formation places · ${data.places.length} UK cities and towns · No sign-in needed`));
    focusHeading();
  }

  function bandLinks(parent, bands) {
    const list = element("ul", "game-band-links");
    [...new Map(bands.map((band) => [band.id, band])).values()].forEach((band) => {
      const item = element("li");
      const link = element("a", "", `${band.name} ↗`);
      link.href = band.spotifyUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(link);
      list.append(item);
    });
    parent.append(list);
  }

  function submit(value) { perform("submit", value); }

  function hintControls(parent) {
    if (!["hometown", "pin", "boolean"].includes(game.mode)) return;
    const hint = button(game.round.hinted ? "Hint used" : game.competitive ? "Ask for a hint · 40% fewer points" : "Ask for a hint · max 60 points",
      () => perform("hint"), "game-hint");
    hint.disabled = game.round.hinted;
    parent.append(hint);
    if (game.round.hint) parent.append(element("p", "game-hint-copy", game.round.hint));
  }

  function choose(parent, options) {
    const list = element("div", "game-choices");
    options.forEach(([label, value]) => list.append(button(label, () => submit(value), "game-choice")));
    parent.append(list);
  }

  function mystery(parent) {
    const round = game.round;
    parent.append(element("p", "game-prompt", "Which city or town connects these bands?"));
    const clues = element("ol", "game-clues");
    round.clues.slice(0, round.revealed).forEach((band) => clues.append(element("li", "", band.name)));
    parent.append(clues);
    const form = element("form", "game-guess-form");
    const label = element("label", "", "Your city or town");
    label.htmlFor = "city-guess";
    const input = element("input");
    input.id = "city-guess";
    input.name = "place";
    input.placeholder = "Start typing a place…";
    input.autocomplete = "off";
    input.setAttribute("list", "game-places");
    input.setAttribute("aria-describedby", "game-message");
    input.required = true;
    const datalist = element("datalist");
    datalist.id = "game-places";
    data.places.forEach((place) => {
      const option = element("option");
      option.value = place.label;
      datalist.append(option);
    });
    const controls = element("div", "game-actions");
    const guess = element("button", "game-primary", "Guess");
    guess.type = "submit";
    const clue = button("Reveal another band", () => perform("hint"));
    clue.disabled = round.revealed >= round.clues.length;
    controls.append(guess, clue);
    form.append(label, input, datalist, controls);
    form.addEventListener("submit", (event) => { event.preventDefault(); submit(input.value); });
    parent.append(form, element("p", "game-subtle", `${(6 - round.revealed) * 20} base points available${game.competitive ? ", plus a speed bonus" : ""} · Each extra clue or wrong guess costs 20 base points.`));
    if (round.guesses.length) parent.append(element("p", "game-subtle", `Tried: ${round.guesses.join(" · ")}`));
    parent.append(button("Give up and reveal", () => perform("giveUp"), "game-text-button"));
  }

  function connections(parent) {
    const r = game.round;
    parent.append(element("p", "game-prompt", "Find four groups of four bands that formed in the same place."));
    parent.append(element("p", "game-subtle", `${4 - r.mistakes} mistakes remaining · 100 points per group${game.competitive ? " + speed bonus" : ""}`));
    r.solved.forEach((group) => {
      const solved = element("div", "game-solved");
      solved.append(element("strong", "", group.place), element("p", "", group.bands.map((band) => band.name).join(" · ")));
      parent.append(solved);
    });
    const grid = element("div", "game-tiles");
    const label = element("p", "game-subtle", `${selected.size} of 4 selected`);
    label.setAttribute("role", "status");
    const guess = button("Check group", () => submit([...selected]), "game-primary");
    guess.disabled = selected.size !== 4;
    r.tiles.forEach((band) => {
      const tile = button(band.name, () => {
        if (selected.has(band.id)) selected.delete(band.id);
        else if (selected.size < 4) selected.add(band.id);
        tile.setAttribute("aria-pressed", String(selected.has(band.id)));
        label.textContent = `${selected.size} of 4 selected`;
        guess.disabled = selected.size !== 4;
      }, "game-tile");
      tile.setAttribute("aria-pressed", String(selected.has(band.id)));
      grid.append(tile);
    });
    const controls = element("div", "game-actions");
    controls.append(guess, button("Shuffle", () => { r.tiles = shuffled(r.tiles); render(); }),
      button("Clear selection", () => { selected.clear(); render(); }));
    parent.append(grid, label, controls,
      button("Reveal all groups", () => perform("giveUp"), "game-text-button"));
  }

  function pin(parent) {
    const r = game.round;
    const round = element("div", "game-pin-round");
    if (r.answered) {
      const result = element("div", `game-result game-pin-result ${r.result.correct ? "is-correct" : "is-incorrect"}`);
      result.append(element("h2", "", `${r.result.points} points${r.result.speedBonus ? ` · ${r.result.speedBonus} speed` : ""}`),
        element("p", "", r.result.message));
      round.append(result);
    } else round.append(element("h2", "game-band-name", r.band.name));
    parent.append(round);

    let point = r.pendingPin || null;
    const position = element("p", "game-subtle", point ? pinLabel(point) : "No pin placed yet.");
    position.setAttribute("role", "status");
    const points = r.answered ? [
      { coordinates: r.guess, label: "Your pin", kind: "guess" },
      { coordinates: coordinates(r.band), label: r.band.originCluster },
    ] : point ? [{ coordinates: point, label: "Your pin", kind: "guess" }] : [];
    const map = locationMap(outline, points, r.answered ? null : (value, commit) => {
      point = value;
      r.pendingPin = value;
      position.textContent = pinLabel(value);
      if (commit) submit(value);
    }, true);
    parent.append(map);
    if (!r.answered) {
      parent.append(position);
      hintControls(parent);
    } else if (!game.competitive) {
      parent.append(button(game.over ? "See results" : "Next round →", () => {
        if (game.over) { results = true; render(); }
        else perform("next");
      }, "game-primary"));
    }
  }

  function pinLabel([longitude, latitude]) {
    return `Your pin: ${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? "E" : "W"}.`;
  }

  function oddBandOut(parent) {
    const r = game.round;
    const city = r.city || r.commonPlace;
    const place = data.places.find((item) => item.id === city);
    const layout = element("div", "game-odd-layout");
    const mapPanel = element("article", "game-odd-map");
    const mapHeader = element("header", "game-odd-panel-header");
    mapHeader.append(element("p", "game-eyebrow", "Shared formation place"));
    mapHeader.append(element("h2", "game-odd-city", city));
    mapHeader.append(element("p", "game-subtle", "Three bands in this round formed here."));
    mapPanel.append(mapHeader);
    if (place) mapPanel.append(locationMap(outline, [{ coordinates: coordinates(place), label: city }], null, true));

    const chart = element("aside", "game-odd-chart");
    const chartHeader = element("header", "game-odd-panel-header");
    chartHeader.append(element("p", "game-eyebrow", "Odd Band Out"));
    chartHeader.append(element("h2", "", `Which band did not form in ${city}?`));
    chartHeader.append(element("p", "game-subtle", "Click its monthly-listener bar."));
    chart.append(chartHeader);
    const bars = element("div", "game-odd-bars");
    const maximum = Math.max(...r.options.map((band) => band.monthlyListeners || 0), 1);
    const resultBandId = r.answered ? r.choice || r.band.id : null;
    r.options.forEach((band) => {
      const row = button("", () => submit(band.id), "odd-band-bar");
      row.setAttribute("aria-label", `Choose ${band.name}`);
      row.disabled = r.answered;
      if (r.answered && band.id === r.band.id) row.classList.add("is-correct");
      const name = element("span", "odd-band-name", band.name);
      if (band.id === resultBandId) {
        const status = r.result.correct ? "Correct" : r.choice ? "Miss" : "Time’s up";
        const score = r.result.points
          ? ` +${r.result.points} points${r.result.speedBonus ? ` · ${r.result.speedBonus} speed.` : "."}`
          : "";
        const explanation = `${r.band.name} — ${r.band.originCluster}. Others — ${r.commonPlace}.`;
        const result = element("span", "odd-band-result");
        result.append(element("strong", "", status), element("span", "", `${explanation}${score}`));
        row.classList.add("has-result", r.result.correct ? "is-correct" : "is-incorrect");
        row.setAttribute("aria-label", `${status}. ${explanation}${score}`);
        row.append(name, result);
      } else {
        const track = element("span", "odd-band-track");
        const fill = element("span", "odd-band-fill");
        fill.style.width = `${Math.max(3, (band.monthlyListeners / maximum) * 100)}%`;
        track.append(fill);
        row.append(name, track, element("span", "odd-band-value", format.format(band.monthlyListeners)));
      }
      bars.append(row);
    });
    if (r.answered && !game.competitive) {
      bars.append(button(game.over ? "See results" : "Next round →", () => {
        if (game.over) { results = true; render(); }
        else perform("next");
      }, "game-primary"));
    }
    chart.append(bars);
    layout.append(mapPanel, chart);
    parent.append(layout);
  }

  function northSouth(parent) {
    const r = game.round;
    const round = element("div", "game-north-round");
    if (r.answered) {
      const result = element("div", `game-result game-north-result ${r.result.correct ? "is-correct" : "is-incorrect"}`);
      result.append(element("h2", "", r.result.correct ? `Correct · +${r.result.points}` : "Miss"),
        element("p", "", `${r.band.originCluster} is ${r.answer} of ${r.reference.originCluster}.`));
      round.append(result);
    } else {
      round.append(element("p", "game-eyebrow", "Band to place"),
        element("h2", "game-band-name", r.band.name));
    }
    parent.append(round, northSouthMap(outline, r.reference, r.answered ? r.band : null,
      r.answered ? null : (choice) => submit(choice)));
    if (r.answered && !game.competitive) {
      advanceTimer = setTimeout(() => {
        if (game.over) { results = true; render(); }
        else perform("next");
      }, 1800);
    }
  }

  function question(parent) {
    const r = game.round;
    if (game.mode === "mystery") return mystery(parent);
    if (game.mode === "connections") return connections(parent);
    if (game.mode === "pin") return pin(parent);
    if (game.mode === "odd") return oddBandOut(parent);
    if (game.mode === "north") return northSouth(parent);
    if (game.mode === "higher") {
      parent.append(element("p", "game-prompt", "Does the next band have more or fewer monthly listeners?"));
      const comparison = element("div", "game-comparison");
      const reference = element("div");
      reference.append(element("span", "game-eyebrow", "Previous band"), element("h2", "", r.reference.name),
        element("p", "", `${format.format(r.reference.monthlyListeners)} monthly listeners`));
      const target = element("div");
      target.append(element("span", "game-eyebrow", "Next band"), element("h2", "", r.band.name), element("p", "", "?"));
      comparison.append(reference, target);
      parent.append(comparison);
      choose(parent, [["Higher ↑", "higher"], ["Lower ↓", "lower"]]);
      parent.append(element("p", "game-subtle", `${game.competitive ? "100 points + speed bonus" : "100 points"} per correct answer. One wrong answer ends the streak.`));
    } else {
      parent.append(element("p", "game-prompt", game.mode === "boolean" ? "True or false?" : "Where did this band form?"),
        element("h2", "game-band-name", r.band.name));
      if (game.mode === "boolean") {
        parent.append(element("p", "game-claim", `formed in ${r.claim}.`));
        choose(parent, [["True", true], ["False", false]]);
      } else choose(parent, r.options.map((place) => [place, place]));
      hintControls(parent);
    }
  }

  function reveal(parent) {
    const r = game.round;
    if (game.mode === "odd") return oddBandOut(parent);
    if (game.mode === "pin") return pin(parent);
    if (game.mode === "north") return northSouth(parent);
    const result = element("div", `game-result ${r.result.correct ? "is-correct" : "is-incorrect"}`);
    const headline = game.mode === "pin" ? `${r.result.points} points` : r.result.correct ? "That’s it." : "Now you know.";
    result.append(element("h2", "", headline), element("p", "", r.result.message));
    if (game.mode !== "pin" && r.result.points) result.append(element("p", "game-subtle", `+${r.result.points} points`));
    if (r.result.speedBonus) result.append(element("p", "game-subtle", `Includes ${r.result.speedBonus} points for speed.`));
    parent.append(result);
    const next = button(game.over ? "See results" : "Next round →", () => {
      if (game.over) { results = true; render(); }
      else perform("next");
    }, "game-primary");
    parent.append(next);
    if (game.competitive) {
      parent.append(element("p", "game-subtle", game.over ? "Your score is saved. Results appear in a moment." : "Next round starts in 1.8 seconds."));
      if (game.mode === "pin" && r.guess) parent.append(locationMap(outline, [
        { coordinates: r.guess, label: "Your pin", kind: "guess" },
        { coordinates: coordinates(r.band), label: r.band.originCluster },
      ], null, true));
      return;
    }
    if (game.mode === "connections") {
      r.groups.forEach((group) => {
        const section = element("section", "game-solved");
        section.append(element("h3", "", group.place));
        bandLinks(section, group.bands);
        parent.append(section);
      });
    } else {
      const place = game.mode === "mystery" ? r.place : r.band.originCluster;
      const bands = game.mode === "mystery" ? r.clues : game.mode === "odd" ? r.options : [r.band];
      if (game.mode !== "higher") {
        const location = data.places.find((item) => item.id === place);
        const points = location ? [{ coordinates: coordinates(location), label: place }] : [];
        if (r.guess) points.unshift({ coordinates: r.guess, label: "Your pin", kind: "guess" });
        if (game.mode === "north") points.unshift({ coordinates: coordinates(r.reference), label: r.reference.originCluster, kind: "guess" });
        if (points.length) {
          const map = locationMap(outline, points, null, game.mode === "pin");
          map.classList.add("game-answer-map");
          parent.append(map);
        }
      }
      parent.append(element("h3", "game-listen-title", "Keep listening"));
      const neighbours = data.byPlace.get(place)?.filter((band) => !bands.some((member) => member.id === band.id)).slice(0, 3) || [];
      bandLinks(parent, [...bands, ...neighbours]);
    }
  }

  function summary(parent) {
    const streakMode = ["higher", "north"].includes(game.mode);
    const maximum = (game.mode === "connections" ? 400 : game.mode === "mystery" ? 100 : 1000) * (game.competitive ? 1.5 : 1);
    parent.append(element("p", "game-eyebrow", game.competitive ? "Score saved" : "Practice result"), element("h2", "game-summary-score", `${format.format(game.score)}${streakMode ? "" : ` / ${format.format(maximum)}`}`));
    parent.append(element("p", "game-lead", streakMode
      ? `${game.bestStreak} correct ${game.bestStreak === 1 ? "answer" : "answers"} in a row.`
      : game.mode === "mystery" ? `${game.round.place} · ${game.round.revealed} of 5 clues revealed.`
        : game.mode === "connections" ? `${game.round.solved.length} of 4 hometowns found.`
          : `10 rounds played · Best streak: ${game.bestStreak}`));
    const actions = element("div", "game-actions");
    actions.append(button(game.competitive ? "Try to beat your score" : "Compete for a place", () => lobby(game.mode), "game-primary"),
      button("Play untimed practice", () => start(game.mode, false)));
    const menu = element("a", "game-button-link", "Try another game");
    menu.href = "#games";
    actions.append(menu);
    parent.append(actions);
    if (board) {
      const rankings = element("section", "game-leaderboard");
      leaderboard(rankings, board); parent.append(rankings);
    }
    if (game.daily) parent.append(element("p", "game-subtle", "The daily city changes at midnight UTC. Practice gives you a different puzzle each time."));
  }

  function render() {
    clearTimers();
    container.replaceChildren();
    container.classList.toggle("is-wide-game", game.mode === "odd" && !results);
    const definition = GAMES.find((item) => item.id === game.mode);
    const header = element("header", "game-header");
    const intro = element("div");
    const back = element("a", "game-back", "← All games");
    back.href = "#games";
    const title = element("h1", "", definition.name);
    title.tabIndex = -1;
    intro.append(back, title);
    if (game.mode === "pin") intro.append(element("p", "game-header-description",
      `Click the map where the band formed. Closer pins score up to 100 points${game.competitive ? ", plus a speed bonus" : ""}; use arrow keys and Enter with a keyboard.`));
    if (game.mode === "north") intro.append(element("p", "game-header-description",
      "The pin marks the dividing city. Click the darker north or the lighter south; use Arrow Up or Arrow Down with a keyboard."));
    const progress = game.mode === "mystery" ? game.daily ? `Daily · ${game.date} (UTC)` : "Practice"
      : game.mode === "connections" ? `${game.round.solved.length} / 4 groups`
        : ["higher", "north"].includes(game.mode) ? `Streak: ${game.streak}` : `Round ${game.index + 1} / 10`;
    const status = element("div", "game-scoreboard");
    status.append(element("span", "", progress), element("strong", "", `${format.format(game.score)} points`));
    if (!game.competitive) status.append(element("span", "game-subtle", "Untimed practice"));
    if (game.competitive && !results) {
      const timeLeft = game.round.answered ? pausedTimeLeft : Math.max(0, deadline - performance.now());
      const clock = element("strong", "game-clock", `${Math.ceil(timeLeft / 1000)}s`);
      clock.setAttribute("role", "timer");
      clock.setAttribute("aria-label", game.round.answered ? "Time remaining when answered" : "Seconds remaining");
      status.append(clock);
    }
    if (!["mystery", "connections"].includes(game.mode)) {
      status.append(element("span", "game-subtle", ["Headliners", "Familiar faces", "Deep cuts", "For the obsessives"][Math.min(3, Math.floor(game.index / 3))]));
    }
    header.append(intro, status);
    if (game.competitive && !results) {
      const bar = element("progress", "game-time-bar");
      bar.max = ROUND_SECONDS[game.mode] * 1000;
      bar.value = game.round.answered ? pausedTimeLeft : Math.max(0, deadline - performance.now());
      bar.setAttribute("aria-label", "Time remaining in this round");
      container.append(bar);
    }
    const body = element("section", `game-play game-mode-${game.mode}`);
    body.setAttribute("aria-label", `${definition.name} game`);
    const message = element("p", "game-message", game.round.message);
    message.id = "game-message";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    if (results) summary(body);
    else if (game.round.answered) reveal(body);
    else question(body);
    body.append(message);
    if (failure) {
      const warning = element("p", "game-message", `Connection problem: ${failure.message}`);
      warning.setAttribute("role", "alert");
      body.append(warning, button("Retry connection", () => perform(failure.action, failure.value), "game-primary"));
    }
    container.append(header, body, element("p", "game-footnote", game.mode === "higher"
      ? `Global Spotify monthly listeners · Snapshot: ${snapshotDate}. These are frozen figures, not live counts.`
      : "Formation places, including cities and towns. Disputed, broad-region and wider-area assignments are excluded. Map outline: Natural Earth."));
    focusHeading();
    if (game.mode === "mystery" && !game.round.answered && (game.round.revealed > 1 || game.round.message)) {
      container.querySelector("#city-guess")?.focus({ preventScroll: true });
    }
    timers();
  }

  function route() {
    clearTimers();
    generation += 1;
    const playing = /^#games(?:\/|$)/.test(window.location.hash);
    container.hidden = !playing;
    document.querySelector("#explorer-main").hidden = playing;
    document.querySelector(".site-footer").hidden = playing;
    document.querySelector(".skip-link").href = playing ? "#games-main" : "#explorer-main";
    document.querySelector(".skip-link").textContent = playing ? "Skip to game" : "Skip to explorer";
    document.querySelectorAll("#nav-games, #nav-games-mobile").forEach((link) => link.setAttribute("aria-current", playing ? "page" : "false"));
    document.querySelectorAll("#nav-explorer, #nav-explorer-mobile").forEach((link) => link.setAttribute("aria-current", playing ? "false" : "page"));
    if (!playing) return;
    const mode = window.location.hash.split("/")[1];
    if (GAMES.some((definition) => definition.id === mode)) {
      if (game?.mode === mode) render();
      else lobby(mode);
    } else showMenu();
    window.scrollTo({ top: 0 });
  }
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    if (container.hidden) return;
    event.preventDefault();
    container.tabIndex = -1;
    container.focus();
    container.scrollIntoView();
  });
  window.addEventListener("hashchange", route);
  route();
}
