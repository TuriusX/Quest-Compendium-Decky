// Run: npx tsx tests/running.test.ts
import assert from "node:assert/strict";
import { cleanShortcutName, followGame, runningFrom, swapConversation } from "../src/running";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (e: any) { console.log("FAIL  " + name + "   -> " + String(e.message).split("\n")[0]); process.exitCode = 1; }
}

const steamGame = { name: "ELDEN RING", appId: 1245620, shortcut: false };
const shortcut = (name: string) => ({ name, appId: 3123456789, shortcut: true });

test("a Steam game: its name and app", () => {
  assert.deepEqual(runningFrom(steamGame, null), { name: "ELDEN RING", appId: 1245620, key: "steam:1245620" });
});

test("a Steam ROM Manager shortcut: its name without the tags, not the shortcut's id", () => {
  assert.equal(cleanShortcutName("Metroid Prime (GC)"), "Metroid Prime");
  assert.equal(cleanShortcutName("The Legend of Zelda: Breath of the Wild [Ryujinx]"), "The Legend of Zelda: Breath of the Wild");
  assert.equal(cleanShortcutName("Persona 5 Royal"), "Persona 5 Royal");
  assert.deepEqual(runningFrom(shortcut("Metroid Prime (GC)"), null), { name: "Metroid Prime", appId: 0, key: "name:metroidprime" });
});

test("an emulator's or frontend's own shortcut: its game from the backend, else nothing (not \"RetroArch\")", () => {
  assert.equal(runningFrom(shortcut("RetroArch"), null), null);
  assert.equal(runningFrom(shortcut("ES-DE"), {}), null);
  assert.equal(runningFrom(shortcut("EmulationStation-DE"), null), null);
  assert.deepEqual(runningFrom(shortcut("ES-DE"), { emulator: "Dolphin", name: "Metroid Prime", key: "kaaa" }), { name: "Metroid Prime", appId: 0, key: "name:metroidprime" });
});

test("a file with no name: \"Which game is this?\" (nothing goes to questions as its game); \"Not a game\": nothing", () => {
  const g = runningFrom(shortcut("RetroArch"), { emulator: "RetroArch", name: null, key: "kbbb", ask: true });
  assert.deepEqual(g?.ask, { key: "kbbb", emulator: "RetroArch" });
  assert.equal(runningFrom(shortcut("RetroArch"), { emulator: "RetroArch", name: null, key: "kbbb", notGame: true }), null);
});

test("following the game: switch to it, stay (with Switch) when switching is off and there are questions", () => {
  assert.equal(followGame("steam:1", null, { auto: true, hasHistory: true }), "switch");
  assert.equal(followGame("steam:1", "steam:1", { auto: true, hasHistory: true }), "none");
  assert.equal(followGame("steam:1", "name:x", { auto: false, hasHistory: true }), "offer");
  assert.equal(followGame("steam:1", "name:x", { auto: false, hasHistory: false }), "switch", "nothing asked yet: nothing to keep");
  assert.equal(followGame(undefined, "name:x", { auto: true, hasHistory: true }), "none", "waiting for Which game is this?");
});

test("each game's conversation comes back when it starts again; at most 8 kept", () => {
  const saved = new Map<string, string[]>();
  assert.equal(swapConversation(saved, "steam:1", ["a", "b"], "name:x"), undefined, "a new game: a new conversation");
  assert.deepEqual(swapConversation(saved, "name:x", ["c"], "steam:1"), ["a", "b"], "back to the first: its conversation");
  assert.deepEqual(swapConversation(saved, "steam:1", ["a", "b", "d"], "name:x"), ["c"]);
  assert.equal(swapConversation(saved, "name:x", [], null), undefined, "an empty one isn't kept");
  assert.equal(saved.has("name:x"), false);
  for (let i = 0; i < 12; i++) swapConversation(saved, `g${i}`, ["q"], `g${i + 1}`);
  assert.ok(saved.size <= 8);
  assert.equal(saved.has("steam:1"), false, "the oldest went first");
});

console.log(`\n${passed} passed`);
