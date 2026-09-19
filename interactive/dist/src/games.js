import { normalizeSearch } from "./search.js?v=a7aca63ae0da";

export const ROUND_SECONDS = { pin: 18, odd: 12, north: 8 };

export const GAMES = [
  { id: "pin", name: "Pin the Band", tag: "10 rounds", description: "Put their hometown on the map. Every kilometre counts." },
  { id: "odd", name: "Odd Band Out", tag: "10 rounds", description: "Three bands share a hometown. Find the one that doesn’t." },
  { id: "north", name: "North or South?", tag: "Streak", description: "Follow the bands across Britain, one hometown at a time." },
];

export const coordinates = (place) => [place.longitude, place.latitude];

export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const radians = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * radians / 2) ** 2
    + Math.cos(lat1 * radians) * Math.cos(lat2 * radians)
    * Math.sin((lon2 - lon1) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function dailyRandom(seed) {
  let value = 2166136261;
  for (const letter of seed) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function prepareGameData(dashboard) {
  const bands = dashboard.bands.filter((band) => band.gameEligible === true
    && band.locationStatus === "uk" && band.placeType === "locality"
    && band.originCluster && Number.isFinite(band.latitude) && Number.isFinite(band.longitude));
  // ponytail: followers approximate familiarity; use observed answer rates when play data exists.
  const popular = (a, b) => b.followers - a.followers || a.id.localeCompare(b.id);
  bands.sort(popular);
  const byPlace = new Map();
  for (const band of bands) {
    if (!byPlace.has(band.originCluster)) byPlace.set(band.originCluster, []);
    byPlace.get(band.originCluster).push(band);
  }
  return {
    bands,
    allBands: dashboard.bands.filter((band) => Number.isFinite(band.monthlyListeners)
      && band.monthlyListeners >= 0).sort(popular),
    byPlace,
    places: dashboard.places.filter((place) => byPlace.has(place.id))
      .sort((a, b) => a.label.localeCompare(b.label, "en")),
    snapshot: dashboard.meta.snapshotId,
  };
}

export class MusicGame {
  constructor(mode, data, { random = Math.random, date = new Date().toISOString().slice(0, 10), daily = true, competitive = false } = {}) {
    if (!GAMES.some((game) => game.id === mode)) throw new Error("Unknown game");
    this.mode = mode;
    this.data = data;
    this.daily = mode === "mystery" && daily;
    this.date = date;
    this.competitive = competitive;
    this.random = competitive ? dailyRandom(`competitive-v1:${mode}:${data.snapshot}:${date}`)
      : this.daily ? dailyRandom(`mystery-v1:${data.snapshot}:${date}`) : random;
    this.index = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.used = new Set();
    this.over = false;
    this.round = this.createRound();
  }

  pick(items) { return items[Math.floor(this.random() * items.length)]; }

  band(pool = this.data.bands) {
    const level = Math.min(this.index, 9);
    const start = Math.floor(pool.length * (level / 10) ** 1.5);
    const end = Math.max(start + 1, Math.floor(pool.length * ((level + 1) / 10) ** 1.5));
    const available = pool.filter((band) => !this.used.has(band.id));
    const tier = pool.slice(start, end).filter((band) => !this.used.has(band.id));
    const band = this.pick(tier.length ? tier : available);
    if (!band) throw new Error("No bands remain for this game");
    this.used.add(band.id);
    return band;
  }

  otherPlaces(band) {
    const candidates = this.data.places.filter((place) => place.id !== band.originCluster
      && (!place.fuaCode || !band.fuaCode || place.fuaCode !== band.fuaCode)
      && distanceKm(coordinates(place), coordinates(band)) > 30);
    candidates.sort(this.index >= 5
      ? (a, b) => distanceKm(coordinates(a), coordinates(band)) - distanceKm(coordinates(b), coordinates(band))
      : (a, b) => this.data.byPlace.get(b.id).length - this.data.byPlace.get(a.id).length);
    return shuffled(candidates.slice(0, this.index >= 5 ? 12 : 30), this.random);
  }

  createRound() {
    const round = { answered: false, hinted: false, message: "", result: null };
    const groups = [...this.data.byPlace.entries()];
    if (this.mode === "connections") {
      round.groups = shuffled(groups.filter(([, bands]) => bands.length >= 4), this.random).slice(0, 4)
        .map(([place, bands]) => ({ place, bands: shuffled(bands.slice(0, 12), this.random).slice(0, 4) }));
      round.tiles = shuffled(round.groups.flatMap((group) => group.bands), this.random);
      round.solved = [];
      round.mistakes = 0;
      round.attempts = new Set();
    } else if (this.mode === "mystery") {
      const [place, bands] = this.pick(groups.filter(([, members]) => members.length >= 5));
      round.place = place;
      round.clues = [...shuffled(bands.slice(1, 15), this.random).slice(0, 4), bands[0]]
        .sort((a, b) => a.followers - b.followers);
      round.revealed = 1;
      round.guesses = [];
    } else if (this.mode === "odd") {
      const eligible = this.data.bands.filter((band) => this.data.byPlace.get(band.originCluster).length >= 3);
      const anchor = this.band(eligible);
      round.commonPlace = anchor.originCluster;
      round.city = anchor.originCluster;
      const companions = shuffled(this.data.byPlace.get(anchor.originCluster)
        .filter((band) => band.id !== anchor.id), this.random).slice(0, 2);
      round.band = this.band(this.data.bands.filter((band) => band.originCluster !== anchor.originCluster
        && distanceKm(coordinates(band), coordinates(anchor)) > 30));
      round.options = shuffled([anchor, ...companions, round.band], this.random);
      round.options.forEach((band) => this.used.add(band.id));
    } else if (this.mode === "higher" || this.mode === "north") {
      const pool = this.mode === "higher" ? this.data.allBands : this.data.bands;
      round.reference = this.round?.band || this.band(pool);
      const candidates = pool.filter((band) => this.mode === "higher"
        ? band.monthlyListeners !== round.reference.monthlyListeners
        : Math.abs(band.latitude - round.reference.latitude) > 0.05);
      round.band = this.band(candidates);
      round.answer = this.mode === "higher"
        ? (round.band.monthlyListeners > round.reference.monthlyListeners ? "higher" : "lower")
        : (round.band.latitude > round.reference.latitude ? "north" : "south");
    } else {
      round.band = this.band();
      const others = this.otherPlaces(round.band);
      round.options = shuffled([round.band.originCluster, ...others.slice(0, 4).map((place) => place.id)], this.random);
      if (this.mode === "boolean") {
        round.claim = this.random() < 0.5 ? round.band.originCluster : others[0].id;
      }
    }
    return round;
  }

  hint() {
    const round = this.round;
    if (round.answered || this.over) return false;
    if (this.mode === "mystery") {
      if (round.revealed >= round.clues.length) return false;
      round.revealed += 1;
      round.message = "Another band revealed.";
      return true;
    }
    if (round.hinted || !["hometown", "pin", "boolean"].includes(this.mode)) return false;
    round.hinted = true;
    const neighbour = this.data.byPlace.get(round.band.originCluster)
      .find((band) => band.id !== round.band.id && band.followers > round.band.followers);
    if (neighbour) {
      round.hint = `${neighbour.name} formed in the same place.`;
    } else if (this.mode === "hometown") {
      const removed = round.options.filter((place) => place !== round.band.originCluster).slice(0, 2);
      round.options = round.options.filter((place) => !removed.includes(place));
      round.hint = "Two wrong answers removed.";
    } else {
      round.hint = `The place starts with “${round.band.originCluster[0]}”.`;
    }
    return true;
  }

  finish(correct, points, message) {
    this.round.answered = true;
    this.round.result = { correct, points, message };
    this.score += points;
    this.streak = correct ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (["mystery", "connections"].includes(this.mode)) this.over = true;
    else if (["higher", "north"].includes(this.mode)) {
      const pool = this.mode === "higher" ? this.data.allBands : this.data.bands;
      this.over = !correct || !pool.some((band) => !this.used.has(band.id) && (this.mode === "higher"
        ? band.monthlyListeners !== this.round.band.monthlyListeners
        : Math.abs(band.latitude - this.round.band.latitude) > 0.05));
    } else this.over = this.index >= 9;
  }

  submit(value) {
    const r = this.round;
    if (r.answered || this.over) return false;
    r.message = "";
    if (this.mode === "mystery") {
      const place = this.data.places.find((item) => normalizeSearch(item.label) === normalizeSearch(String(value)));
      if (!place) { r.message = "Choose a city or town from the suggestions."; return false; }
      if (r.guesses.includes(place.id)) { r.message = "You’ve already tried that place."; return false; }
      r.guesses.push(place.id);
      if (place.id === r.place) this.finish(true, (6 - r.revealed) * 20, `${r.place} connects all five bands.`);
      else if (r.revealed === r.clues.length) this.finish(false, 0, `The place was ${r.place}.`);
      else { r.revealed += 1; r.message = `${place.label} isn’t the place. Here’s another band.`; }
      return true;
    }
    if (this.mode === "connections") {
      if (!Array.isArray(value) || new Set(value).size !== 4 || value.length !== 4
          || value.some((id) => !r.tiles.some((band) => band.id === id))) {
        r.message = "Select four remaining bands."; return false;
      }
      const key = [...value].sort().join(",");
      if (r.attempts.has(key)) { r.message = "You’ve already tried that group."; return false; }
      r.attempts.add(key);
      const group = r.groups.find((item) => item.bands.every((band) => value.includes(band.id)));
      if (group) {
        r.solved.push(group);
        r.tiles = r.tiles.filter((band) => !value.includes(band.id));
        this.score += 100;
        r.message = `Correct: ${group.place}.`;
      } else {
        r.mistakes += 1;
        const close = r.groups.some((item) => item.bands.filter((band) => value.includes(band.id)).length === 3);
        r.message = close ? "One band away. Try another combination." : "Those bands don’t share a hometown.";
      }
      if (r.solved.length === 4 || r.mistakes === 4) this.finish(r.solved.length === 4, 0,
        r.solved.length === 4 ? "All four hometowns found." : "Four misses. Here are the hometowns.");
      return true;
    }
    let correct;
    let message = `${r.band.name} formed in ${r.band.originCluster}.`;
    let points = r.hinted ? 60 : 100;
    if (this.mode === "pin") {
      if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)
          || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90) return false;
      r.guess = value;
      r.distance = distanceKm(value, coordinates(r.band));
      points = Math.round(Math.max(0, 100 * (1 - r.distance / 500)) * (r.hinted ? 0.6 : 1));
      correct = r.distance <= 50;
      message = `${Math.round(r.distance)} km from ${r.band.originCluster}. ${r.band.name} formed here.`;
    } else if (this.mode === "hometown") {
      if (!r.options.includes(value)) return false;
      correct = value === r.band.originCluster;
    } else if (this.mode === "boolean") {
      if (typeof value !== "boolean") return false;
      correct = value === (r.claim === r.band.originCluster);
    } else if (this.mode === "odd") {
      if (!r.options.some((band) => band.id === value)) return false;
      r.choice = value;
      correct = value === r.band.id;
      message += ` The other three formed in ${r.commonPlace}.`;
    } else {
      if (!(this.mode === "higher" ? ["higher", "lower"] : ["north", "south"]).includes(value)) return false;
      correct = value === r.answer;
      message = this.mode === "higher"
        ? `${r.band.name}: ${r.band.monthlyListeners.toLocaleString("en-GB")} monthly listeners. ${r.reference.name}: ${r.reference.monthlyListeners.toLocaleString("en-GB")}.`
        : `${r.band.name} (${r.band.originCluster}) formed ${r.answer} of ${r.reference.name} (${r.reference.originCluster}).`;
    }
    this.finish(correct, this.mode === "pin" ? points : correct ? points : 0, message);
    return true;
  }

  giveUp() {
    if (this.round.answered || this.over) return;
    this.finish(false, 0, this.mode === "mystery" ? `The place was ${this.round.place}.` : "Here are the four hometowns.");
    this.over = true;
  }

  timeout() {
    if (this.round.answered || this.over) return false;
    const r = this.round;
    if (this.mode === "connections" || this.mode === "mystery") this.giveUp();
    else this.finish(false, 0, `Time’s up. ${r.band.name} formed in ${r.band.originCluster}.`);
    if (this.mode === "higher") r.result.message = `Time’s up. ${r.band.name}: ${r.band.monthlyListeners.toLocaleString("en-GB")} monthly listeners. The answer was ${r.answer}.`;
    if (this.mode === "odd") r.result.message += ` The other three formed in ${r.commonPlace}.`;
    if (this.mode === "north") r.result.message += ` That is ${r.answer} of ${r.reference.originCluster}.`;
    return true;
  }

  next() {
    if (!this.round.answered || this.over) return false;
    this.index += 1;
    this.round = this.createRound();
    return true;
  }
}
