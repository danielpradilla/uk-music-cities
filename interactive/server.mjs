import http from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, MusicGame, prepareGameData, ROUND_SECONDS } from "./src/games.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(directory, "dist");
const dbPath = process.env.SCORES_DB || path.join(directory, "../.local-artifacts/music-game-scores.sqlite");
await mkdir(path.dirname(dbPath), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS scores (
    player TEXT NOT NULL, nickname TEXT NOT NULL, mode TEXT NOT NULL, day TEXT NOT NULL,
    score INTEGER NOT NULL, elapsed INTEGER NOT NULL, updated INTEGER NOT NULL,
    PRIMARY KEY(player, mode, day)
  );
  CREATE INDEX IF NOT EXISTS scores_board ON scores(mode, day, score DESC, elapsed ASC);`);
const dashboard = JSON.parse(await readFile(path.join(root, "data/dashboard.json"), "utf8"));
const data = prepareGameData(dashboard);
const runs = new Map();
const LIMITS = Object.fromEntries(Object.entries(ROUND_SECONDS).map(([mode, seconds]) => [mode, seconds * 1000]));
const MODES = new Set(GAMES.map((game) => game.id));
const dailyKey = (date) => `${date}:${data.snapshot}:v1`;

function leaderboard(mode, date, player) {
  const day = dailyKey(date);
  const rows = db.prepare("SELECT player, nickname, score, elapsed, RANK() OVER (ORDER BY score DESC, elapsed ASC) AS rank FROM scores WHERE mode=? AND day=? ORDER BY score DESC, elapsed ASC, updated ASC LIMIT 10").all(mode, day);
  const mine = db.prepare("SELECT score, elapsed, updated FROM scores WHERE player=? AND mode=? AND day=?").get(player, mode, day);
  const total = db.prepare("SELECT count(*) AS n FROM scores WHERE mode=? AND day=?").get(mode, day).n;
  let standing = null;
  if (mine) {
    const ahead = db.prepare("SELECT count(*) AS n FROM scores WHERE mode=? AND day=? AND (score > ? OR (score = ? AND elapsed < ?))")
      .get(mode, day, mine.score, mine.score, mine.elapsed).n;
    const lower = db.prepare("SELECT count(*) AS n FROM scores WHERE mode=? AND day=? AND player != ? AND score < ?").get(mode, day, player, mine.score).n;
    standing = { rank: ahead + 1, score: mine.score, elapsed: mine.elapsed, others: total - 1,
      percentile: total > 1 ? Math.round(100 * lower / (total - 1)) : null };
  }
  return { mode, date, total, standing, rows: rows.map((row) => ({ rank: row.rank, nickname: row.nickname, score: row.score, elapsed: row.elapsed, you: row.player === player })) };
}

function save(run) {
  if (run.saved) return;
  const now = Date.now();
  db.prepare(`INSERT INTO scores(player,nickname,mode,day,score,elapsed,updated) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(player,mode,day) DO UPDATE SET nickname=excluded.nickname, score=excluded.score,
    elapsed=excluded.elapsed, updated=excluded.updated
    WHERE excluded.score > scores.score OR (excluded.score = scores.score AND excluded.elapsed < scores.elapsed)`)
    .run(run.player, run.nickname, run.game.mode, dailyKey(run.game.date), run.game.score, run.elapsed, now);
  run.saved = true;
}

function publicState(run) {
  const game = run.game;
  const round = JSON.parse(JSON.stringify(game.round));
  if (!round.answered) {
    if (game.mode === "mystery") {
      delete round.place;
      round.clues = round.clues.map((band, index) => index < round.revealed ? band : null);
    }
    if (game.mode === "connections") delete round.groups;
    delete round.answer;
    delete round.commonPlace;
    if (game.mode === "odd") delete round.band;
    const redactBand = (band) => band && ({
      id: band.id,
      name: band.name,
      ...(game.mode === "odd" ? { monthlyListeners: band.monthlyListeners } : {}),
    });
    if (round.band) round.band = redactBand(round.band);
    if (game.mode === "odd") round.options = round.options.map(redactBand);
    if (game.mode === "mystery") round.clues = round.clues.map(redactBand);
    if (game.mode === "connections") round.tiles = round.tiles.map(redactBand);
  }
  return {
    id: run.id, version: run.version, serverNow: Date.now(), deadline: run.deadline, limit: LIMITS[game.mode],
    game: { mode: game.mode, daily: game.daily, competitive: true, date: game.date, index: game.index,
      score: game.score, streak: game.streak, bestStreak: game.bestStreak, over: game.over, round },
    board: game.over ? leaderboard(game.mode, game.date, run.player) : null,
  };
}

function finishRound(run) {
  if (run.game.round.answered && !run.roundClosed) {
    run.elapsed += Math.min(LIMITS[run.game.mode], Math.max(0, Date.now() - run.started));
    run.roundClosed = true;
  }
  if (run.game.over) save(run);
}

function respond(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(payload));
}

async function body(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) throw Object.assign(new Error("Send JSON."), { status: 415 });
  let content = "";
  for await (const chunk of request) {
    content += chunk;
    if (Buffer.byteLength(content) > 4096) throw Object.assign(new Error("Request too large."), { status: 413 });
  }
  try { return JSON.parse(content); }
  catch { throw Object.assign(new Error("Invalid JSON."), { status: 400 }); }
}

async function api(request, response, url) {
  // ponytail: a browser cookie identifies a player; add accounts for cross-device identity or serious ranked play.
  let token = /(?:^|;\s*)music_player=([a-f0-9]{48})(?:;|$)/.exec(request.headers.cookie || "")?.[1];
  if (!token) {
    token = randomBytes(24).toString("hex");
    if (request.method === "POST" && url.pathname === "/api/start") response.setHeader("Set-Cookie", `music_player=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${request.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`);
  }
  const player = createHash("sha256").update(token).digest("hex");
  const date = new Date().toISOString().slice(0, 10);
  if (request.method === "GET" && url.pathname.endsWith("/leaderboard")) {
    const mode = url.searchParams.get("mode");
    if (!MODES.has(mode)) return respond(response, 400, { error: "Unknown game." });
    return respond(response, 200, leaderboard(mode, date, player));
  }
  if (request.method !== "POST") return respond(response, 405, { error: "Method not allowed." });
  let sameOrigin = false;
  try { sameOrigin = new URL(request.headers.origin).host === request.headers.host; } catch { /* Reject missing or malformed origins. */ }
  if (!sameOrigin) return respond(response, 403, { error: "Use this game’s own page." });
  const payload = await body(request);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return respond(response, 400, { error: "Invalid request." });
  if (url.pathname.endsWith("/start")) {
    if (!MODES.has(payload.mode)) return respond(response, 400, { error: "Unknown game." });
    const nickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
    if (!/^[\p{L}\p{N} ._'’-]{2,24}$/u.test(nickname)) return respond(response, 400, { error: "Use a nickname of 2–24 letters, numbers, spaces or simple punctuation." });
    const now = Date.now();
    for (const [id, run] of runs) {
      if (now - run.created > 30 * 60 * 1000 || (run.player === player && now - run.created >= 1000)) runs.delete(id);
      else if (run.player === player) return respond(response, 429, { error: "Wait a moment before starting again." });
    }
    if (runs.size >= 1000) return respond(response, 503, { error: "The game server is busy. Try again shortly." });
    const id = randomBytes(24).toString("hex");
    const game = new MusicGame(payload.mode, data, { date, competitive: true });
    const run = { id, game, nickname, player, version: 0, created: now, started: now, deadline: now + LIMITS[game.mode], elapsed: 0, roundClosed: false };
    runs.set(id, run);
    return respond(response, 200, publicState(run));
  }
  if (!url.pathname.endsWith("/action")) return respond(response, 404, { error: "Not found." });
  const run = runs.get(payload.id);
  if (!run || run.player !== player || Date.now() - run.created > 30 * 60 * 1000) return respond(response, 410, { error: "This round has expired. Start a new game." });
  if (!Number.isInteger(payload.version) || payload.version !== run.version) return respond(response, 200, publicState(run));
  if (!["submit", "hint", "next", "timeout", "giveUp"].includes(payload.action)) return respond(response, 400, { error: "Unknown action." });
  const game = run.game;
  const now = Date.now();
  if (!game.round.answered && now >= run.deadline) {
    game.timeout();
  } else if (payload.action === "next") {
    if (game.next()) {
      run.started = now;
      run.deadline = now + LIMITS[game.mode];
      run.roundClosed = false;
    }
  } else if (payload.action === "timeout") {
    // The browser clock can run ahead; only the server deadline ends a round.
  } else {
    const previous = game.score;
    if (payload.action === "submit") game.submit(payload.value);
    else if (payload.action === "hint") game.hint();
    else game.giveUp();
    const earned = game.score - previous;
    if (earned > 0) {
      const bonus = Math.round(earned * 0.5 * Math.min(1, Math.max(0, run.deadline - now) / LIMITS[game.mode]));
      game.score += bonus;
      if (game.round.result) {
        game.round.result.points = earned + bonus;
        game.round.result.speedBonus = bonus;
      } else game.round.message += ` +${earned + bonus} points, including ${bonus} for speed.`;
    }
  }
  finishRound(run);
  run.version += 1;
  return respond(response, 200, publicState(run));
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".svg": "image/svg+xml" };
const base = (process.env.PUBLIC_BASE || "").replace(/\/$/, "");
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return respond(response, 404, { error: "Not found." });
    url.pathname = url.pathname.slice(base.length) || "/";
    if (url.pathname.startsWith("/api/")) return await api(request, response, url);
    if (!["GET", "HEAD"].includes(request.method)) return respond(response, 405, { error: "Method not allowed." });
    const relative = decodeURIComponent(url.pathname);
    if (relative.split("/").some((part) => part.startsWith("."))) return respond(response, 404, { error: "Not found." });
    const file = path.resolve(root, `.${relative === "/" ? "/index.html" : relative}`);
    if (!file.startsWith(`${root}${path.sep}`) || !(await stat(file)).isFile()) return respond(response, 404, { error: "Not found." });
    response.writeHead(200, { "Content-Type": `${MIME[path.extname(file)] || "application/octet-stream"}; charset=utf-8`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).on("error", () => response.destroy()).pipe(response);
  } catch (error) {
    const status = error.status || (error.code === "ENOENT" ? 404 : 500);
    if (status === 500) console.error(error);
    if (!response.headersSent) respond(response, status, { error: status === 500 ? "The score service is unavailable. Please retry." : error.message });
    else response.end();
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 4173), process.env.HOST || "127.0.0.1", () => {
  console.log(`Music games: http://${process.env.HOST || "127.0.0.1"}:${server.address().port}${base}/#games`);
});
