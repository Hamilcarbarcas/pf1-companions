// Classes whose levels grant no feats or skill ranks (DESIGN.md §18).
//
// Run from the module root:  node tools/tests/level-grants.test.mjs

import assert from "node:assert/strict";

globalThis.Hooks = { on: () => {}, once: () => {} };

const { adjustFeatCount, adjustSkillRanks } = await import(new URL("../../src/scripts/level-grants.mjs", import.meta.url));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

const cls = ({ hd, feats = false, skills = false, kind = null, perLevel = 0, subType = "base" }) => ({
  hitDice: hd,
  subType,
  system: { subType, skillsPerLevel: perLevel },
  flags: { "pf1-companions": { ...(kind ? { kind } : {}), ...(feats ? { noLevelFeats: true } : {}), ...(skills ? { noLevelSkills: true } : {}) } },
});
const feat = (id, subType = "feat") => ({ id, subType });

// ---- feats

/**
 * PF1's own result: levels = ceil(HD / 2), plus `changes` (pf1-enhanced-links' +1 per
 * class-association feat arrives here as a bonusFeats Change).
 */
function pf1Feats(classes, feats, changes) {
  const total = classes.filter((c) => c.system.subType !== "mythic").reduce((n, c) => n + c.hitDice, 0);
  const levels = Math.ceil(total / 2);
  return {
    max: levels + changes,
    active: feats.filter((f) => f.subType === "feat").length,
    levels,
    changes,
    get missing() {
      return Math.max(0, this.max - this.active);
    },
    get excess() {
      return Math.max(0, this.active - this.max);
    },
  };
}

function runFeats(classes, feats, changes = 0) {
  const total = classes.filter((c) => c.system.subType !== "mythic").reduce((n, c) => n + c.hitDice, 0);
  const actor = { system: { attributes: { hd: { total } } }, itemTypes: { class: classes, feat: feats } };
  return adjustFeatCount(actor, pf1Feats(classes, feats, changes));
}

test("no flagged class: unchanged", () => {
  const r = runFeats([cls({ hd: 4 })], [feat("a"), feat("b")]);
  assert.equal(r.max, 2);
});

test("living shadow 5 (Patrick's sheet): enhanced-links' +2 alone covers Alertness and Dodge", () => {
  const r = runFeats([cls({ hd: 5, feats: true })], [feat("alert"), feat("dodge")], 2);
  assert.equal(r.levels, 0);
  assert.equal(r.max, 2);
  assert.equal(r.missing, 0);
  assert.equal(r.excess, 0);
});

test("unticked living shadow 5: PF1's own count, 3 missing", () => {
  const r = runFeats([cls({ hd: 5 })], [feat("alert"), feat("dodge")], 2);
  assert.equal(r.max, 5);
  assert.equal(r.missing, 3);
});

test("living shadow 8: a hand-added feat is excess", () => {
  const feats = [feat("alert"), feat("dodge"), feat("greater", "companion"), feat("spring"), feat("extra")];
  const r = runFeats([cls({ hd: 8, feats: true })], feats, 3);
  assert.equal(r.max, 3);
  assert.equal(r.excess, 1);
});

test("feats: flagged class beside an ordinary one, only the ordinary HD count", () => {
  const r = runFeats([cls({ hd: 3, feats: true }), cls({ hd: 3 })], [feat("a"), feat("b")]);
  assert.equal(r.levels, 2);
  assert.equal(r.max, 2);
  assert.equal(r.missing, 0);
});

test("feats: mindless left alone", () => {
  const classes = [cls({ hd: 4, feats: true })];
  const actor = { system: { attributes: { hd: { total: 4 } } }, itemTypes: { class: classes, feat: [] } };
  const r = adjustFeatCount(actor, { max: 1, levels: 0, active: 1 });
  assert.equal(r.max, 1);
});

// ---- skill ranks: PF1's _prepareSkills numbers, then the adjustment

const BG = { bgClasses: ["base", "prestige"], bgPerLevel: 2 };
/** astora-mod's house rule: no 1-rank minimum for a class under 1 rank per level. */
const astoraPerLevel = (perLevel, intMod) => (perLevel >= 1 ? Math.max(1, perLevel + intMod) : Math.max(0, perLevel + intMod));

/**
 * The budget the companions wrapper receives: PF1's allowance (max(1, per level + Int) per HD,
 * background ranks for base/prestige), with astora's minimum rule applied when `perLevel` is given.
 */
function budget(classes, intMod, bgUsed, useBG, perLevel) {
  const r = { allowed: 0, used: 0, bgAllowed: 0, bgUsed, sentToBG: 0 };
  for (const c of classes) {
    r.allowed += (perLevel ?? ((p, i) => Math.max(1, p + i)))(c.system.skillsPerLevel, intMod) * c.hitDice;
    if (useBG && BG.bgClasses.includes(c.subType)) r.bgAllowed += c.hitDice * BG.bgPerLevel;
  }
  if (useBG && r.bgUsed > r.bgAllowed) {
    r.sentToBG = r.bgUsed - r.bgAllowed;
    r.allowed -= r.sentToBG;
    r.bgAllowed += r.sentToBG;
  }
  return r;
}

function runSkills(classes, { int = 6, bgUsed = 0, useBG = true, perLevel } = {}) {
  const intMod = Math.floor((int - 10) / 2);
  const actor = { system: { abilities: { int: { value: int, mod: intMod } } }, itemTypes: { class: classes } };
  return adjustSkillRanks(actor, budget(classes, intMod, bgUsed, useBG, perLevel), { ...BG, useBG, perLevel });
}

test("familiar 5 (Int 6): PF1's 5 ranks and 10 background ranks go to 0", () => {
  const r = runSkills([cls({ hd: 5, skills: true, kind: "familiar" })]);
  assert.equal(r.allowed, 0);
  assert.equal(r.bgAllowed, 0);
});

test("same familiar under astora's rule: its 0 ranks aren't taken off twice", () => {
  const r = runSkills([cls({ hd: 5, skills: true, kind: "familiar" })], { perLevel: astoraPerLevel });
  assert.equal(r.allowed, 0);
});

test("familiar at Int 14 under astora's rule: the +2 per HD is taken off too", () => {
  const r = runSkills([cls({ hd: 5, skills: true, kind: "familiar" })], { int: 14, perLevel: astoraPerLevel });
  assert.equal(r.allowed, 0);
});

test("animal companion 4 (1/level): keeps its adventure ranks, loses background ranks", () => {
  const r = runSkills([cls({ hd: 4, perLevel: 1, kind: "animalCompanion" })], { int: 2 });
  assert.equal(r.allowed, 4);
  assert.equal(r.bgAllowed, 0);
});

test("ordinary base class keeps PF1's count", () => {
  const r = runSkills([cls({ hd: 5 })]);
  assert.equal(r.allowed, 5);
  assert.equal(r.bgAllowed, 10);
});

test("skills: companion class beside a PC class, only the PC class's ranks", () => {
  const r = runSkills([cls({ hd: 3, skills: true, kind: "familiar" }), cls({ hd: 2, perLevel: 4 })], { int: 10 });
  assert.equal(r.allowed, 8);
  assert.equal(r.bgAllowed, 4);
});

test("background overflow is recomputed after the adjustment", () => {
  // PC class: 2 HD at 4/level (8) and 4 BG; companion class 3 HD; 6 BG ranks used -> 2 sent from adventure.
  const r = runSkills([cls({ hd: 3, skills: true, kind: "familiar" }), cls({ hd: 2, perLevel: 4 })], { int: 10, bgUsed: 6 });
  assert.equal(r.sentToBG, 2);
  assert.equal(r.bgAllowed, 6);
  assert.equal(r.allowed, 6);
});

test("background skills off: only adventure ranks change", () => {
  const r = runSkills([cls({ hd: 5, skills: true, kind: "familiar" })], { useBG: false });
  assert.equal(r.allowed, 0);
  assert.equal(r.bgAllowed, 0);
});

test("feats flag alone leaves skill ranks", () => {
  const r = runSkills([cls({ hd: 5, feats: true })]);
  assert.equal(r.allowed, 5);
});

console.log(`\n${passed} passed`);
