// Run: npx tsx tests/guideIndex.test.ts
import assert from "node:assert/strict";
import { normalizeGames, orderGuides } from "../src/guideIndex";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (e: any) { console.log("FAIL  " + name + "   -> " + String(e.message).split("\n")[0]); process.exitCode = 1; }
}

const games = [
  { key: "the-witcher-3", game: "The Witcher 3", areas: 60, players: 40 },
  { key: "avowed", game: "Avowed", areas: 12, players: 5 },
  { key: "elden-ring", game: "ELDEN RING", areas: 40, players: 90 },
  { key: "baldur-s-gate-3", game: "Baldur's Gate 3", areas: 59, players: 70 },
  { key: "pokemon", game: "Pokémon Legends", areas: 10, players: 1 },
];
const keys = (l: { key: string }[]) => l.map((g) => g.key);

test("guide index: the website's index and the server's list both read, junk dropped", () => {
  assert.deepEqual(normalizeGames([{ key: "a", game: "A", areas: 3, art: "x.jpg", checked: 3, players: 2, langs: ["en"] }, { nope: 1 }]),
    [{ key: "a", game: "A", areas: 3, art: "x.jpg", checked: 3, players: 2 }]);
  assert.deepEqual(normalizeGames([{ key: "a", game: "A", areas: 3 }]), [{ key: "a", game: "A", areas: 3 }]);
  assert.deepEqual(normalizeGames({ error: "down" }), []);
});

test("guide order: running game, then recently opened (newest first), then A–Z ignoring 'The'", () => {
  assert.deepEqual(keys(orderGuides(games, { current: "elden-ring", recent: ["avowed", "elden-ring", "pokemon"] })),
    ["elden-ring", "avowed", "pokemon", "baldur-s-gate-3", "the-witcher-3"]);
  assert.deepEqual(keys(orderGuides(games)), ["avowed", "baldur-s-gate-3", "elden-ring", "pokemon", "the-witcher-3"]);
});

test("guide order: popular sorts the rest by players, after the running and recent guides", () => {
  assert.deepEqual(keys(orderGuides(games, { current: "avowed", sort: "popular" })), ["avowed", "elden-ring", "baldur-s-gate-3", "the-witcher-3", "pokemon"]);
});

test("guide search: instant, accent- and case-insensitive, keeps the order", () => {
  assert.deepEqual(keys(orderGuides(games, { q: "pokemon" })), ["pokemon"]);
  assert.deepEqual(keys(orderGuides(games, { q: "E", recent: ["the-witcher-3"] })), ["the-witcher-3", "avowed", "baldur-s-gate-3", "elden-ring", "pokemon"]);
});

console.log(`\n${passed} tests passed`);
