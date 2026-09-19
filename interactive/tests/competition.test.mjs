import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const project = fileURLToPath(new URL("..", import.meta.url));
const dashboard = JSON.parse(await readFile(new URL("../public/data/dashboard.json", import.meta.url), "utf8"));
const byName = new Map(dashboard.bands.map((band) => [band.name, band]));

test("competitive scores are calculated by the server, ranked across players and survive restart", { timeout: 25000 }, async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "music-competition-"));
  let server;
  let base;
  async function launch() {
    server = spawn(process.execPath, ["server.mjs"], {
      cwd: project,
      env: { ...process.env, PORT: "0", HOST: "127.0.0.1", PUBLIC_BASE: "", SCORES_DB: path.join(directory, "scores.sqlite") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    base = await new Promise((resolve, reject) => {
      let output = "";
      server.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolve(match[0]);
      });
      server.stderr.on("data", (chunk) => { output += chunk; });
      server.once("error", reject);
      server.once("exit", (code) => reject(new Error(`Server exited ${code}: ${output}`)));
    });
  }
  async function stop() {
    if (!server || server.exitCode !== null) return;
    const child = server;
    await new Promise((resolve) => { child.once("exit", resolve); child.kill("SIGTERM"); });
  }
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  await launch();
  async function request(player, endpoint, payload = null, origin = base) {
    const response = await fetch(`${base}/api/${endpoint}`, {
      method: payload === null ? "GET" : "POST",
      headers: { Origin: origin, ...(payload === null ? {} : { "Content-Type": "application/json" }), ...(player.cookie ? { Cookie: player.cookie } : {}) },
      ...(payload === null ? {} : { body: JSON.stringify(payload) }),
    });
    if (response.headers.get("set-cookie")) player.cookie = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, value: await response.json() };
  }
  const players = [{}, {}, {}];
  assert.equal((await request(players[0], "leaderboard?mode=north")).value.total, 0);
  async function action(player, state, name, value) {
    const response = await request(player, "action", { id: state.id, version: state.version, action: name, value, score: 99999999 });
    assert.equal(response.status, 200);
    return response.value;
  }
  for (let p = 0; p < players.length; p += 1) {
    let { value: state, status } = await request(players[p], "start", { mode: "north", nickname: `Player ${p + 1}` });
    assert.equal(status, 200);
    assert.equal(state.game.round.answer, undefined);
    assert.equal(state.game.round.band.latitude, undefined);
    assert.equal(state.game.round.band.originCluster, undefined);
    const wins = [3, 0, 1][p];
    for (let i = 0; i <= wins; i += 1) {
      const round = state.game.round;
      const correct = byName.get(round.band.name).latitude > round.reference.latitude ? "north" : "south";
      const previous = state;
      state = await action(players[p], state, "submit", i < wins ? correct : correct === "north" ? "south" : "north");
      const duplicate = await action(players[p], previous, "submit", correct);
      assert.equal(duplicate.game.score, state.game.score, "retries cannot score twice");
      assert.equal(state.game.over, i === wins);
      if (i < wins) state = await action(players[p], state, "next");
    }
    assert.ok(state.game.score <= wins * 150);
    assert.ok(state.game.score >= wins * 100);
    assert.equal(state.board.standing.score, state.game.score);
  }
  const best = (await request(players[0], "leaderboard?mode=north")).value;
  assert.equal(best.total, 3);
  assert.equal(best.standing.rank, 1);
  assert.equal(best.standing.percentile, 100);
  assert.equal(best.standing.others, 2);
  const middle = (await request(players[2], "leaderboard?mode=north")).value;
  assert.equal(middle.standing.rank, 2);
  assert.equal(middle.standing.percentile, 50);
  assert.equal(middle.rows.filter((entry) => entry.you).length, 1);
  const tieDb = new DatabaseSync(path.join(directory, "scores.sqlite"));
  tieDb.exec("INSERT INTO scores SELECT 'tie-fixture', 'Tie fixture', mode, day, score, elapsed, updated FROM scores WHERE nickname='Player 1'");
  const tied = (await request(players[0], "leaderboard?mode=north")).value;
  assert.equal(tied.standing.rank, 1);
  assert.deepEqual(tied.rows.slice(0, 2).map((row) => row.rank), [1, 1]);
  tieDb.exec("DELETE FROM scores WHERE player='tie-fixture'");
  tieDb.close();
  assert.equal((await request({}, "start", { mode: "north", nickname: "Intruder" }, "https://elsewhere.invalid")).status, 403);
  assert.equal((await request({}, "start", { mode: "unknown", nickname: "Player" })).status, 400);
  assert.equal((await request({}, "start", { mode: "north", nickname: "<script>" })).status, 400);
  assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e/.env`)).status, 404);
  const latePlayer = {};
  const late = (await request(latePlayer, "start", { mode: "pin", nickname: "Late player" })).value;
  const earlyTimeout = await action(latePlayer, late, "timeout");
  assert.equal(earlyTimeout.game.round.answered, false);
  await delay(Math.max(0, earlyTimeout.deadline - Date.now()) + 30);
  const expired = await action(latePlayer, earlyTimeout, "submit", [-1, 52]);
  assert.equal(expired.game.round.answered, true);
  assert.equal(expired.game.score, 0);
  assert.match(expired.game.round.result.message, /Time’s up/);
  const alien = await request(players[0], "action", { id: expired.id, version: expired.version, action: "next" });
  assert.equal(alien.status, 410);
  await stop();
  await launch();
  const saved = (await request(players[0], "leaderboard?mode=north")).value;
  assert.equal(saved.standing.score, best.standing.score);
  assert.equal(saved.total, 3);
  assert.equal(saved.standing.percentile, 100);
});
