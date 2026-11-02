// Master-derived companion numbers (DESIGN.md §5.2, §17.1): the familiar default and a class profile.
//
// Run from the module root:  node tools/tests/derived.test.mjs

import assert from "node:assert/strict";

globalThis.Hooks = { on: () => {}, once: () => {} };
globalThis.game = { i18n: { localize: (k) => k, format: (k) => k } };
globalThis.foundry = { utils: { escapeHTML: (s) => s } };
globalThis.pf1 = {
  config: { classSkillBonus: 3 },
  components: { ItemChange: class { constructor(d) { Object.assign(this, d); } } },
};

const { derivedChanges, profileOf, FAMILIAR_PROFILE } = await import(new URL("../../src/scripts/derived.mjs", import.meta.url));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

/** An actor with classes giving these base saves, this BAB, HP, and skill ranks. */
function actor({ saves = {}, bab = 0, hp = 0, skills = {}, classFlags = null, kind = null, classSkills = {} } = {}) {
  const cls = {
    flags: { "pf1-companions": { ...(kind ? { kind } : {}), ...(classFlags ? { derived: classFlags } : {}) } },
    _stats: {},
    system: {
      savingThrows: Object.fromEntries(Object.entries(saves).map(([k, v]) => [k, { base: v }])),
      classSkills,
    },
  };
  return {
    itemTypes: { class: [cls] },
    system: { attributes: { bab: { total: bab }, hp: { max: hp } }, skills },
  };
}

const byTarget = (changes) => Object.fromEntries(changes.map((c) => [c.target, c]));

const master = actor({ saves: { fort: 4, ref: 11, will: 4 }, bab: 10, hp: 81, skills: { per: { rank: 10 }, ste: { rank: 12 } } });

test("familiar default: half HP set, master BAB, best save, master ranks", () => {
  const fam = actor({ kind: "familiar", skills: { per: { rank: 0 }, ste: { rank: 0 } }, classSkills: { per: true } });
  const c = byTarget(derivedChanges(fam, master, profileOf(fam, "familiar"), "familiar"));
  assert.equal(c.mhp.formula, "40");
  assert.equal(c.mhp.operator, "set");
  assert.equal(c.bab.formula, "10");
  assert.equal(c.fort.formula, "4");
  assert.equal(c.ref.formula, "11");
  assert.equal(c.will.formula, "4");
  assert.equal(c["skill.~per"].formula, "13"); // 10 ranks + 3 class skill at 0 own ranks
  assert.equal(c["skill.~ste"].formula, "12");
  assert.equal(c.mhp.flavor, "PF1COMP.Familiar.Flavor");
});

test("familiar baseline wins over a weaker master", () => {
  const weak = actor({ saves: { fort: 1, ref: 0, will: 0 } });
  const fam = actor({ kind: "familiar" });
  const c = byTarget(derivedChanges(fam, weak, FAMILIAR_PROFILE, "familiar"));
  assert.equal(c.fort.formula, "2");
  assert.equal(c.ref.formula, "2");
  assert.equal(c.will, undefined);
});

const LIVING_SHADOW = {
  hp: 0.5,
  bab: true,
  saves: { fort: { offset: 0 }, ref: { offset: 2 }, will: { offset: 1 } },
  skills: false,
};

test("a class profile: Living Shadow saves at master base +0 / +2 / +1, no skills", () => {
  const shadow = actor({ kind: "other", classFlags: LIVING_SHADOW, skills: { per: { rank: 0 } } });
  const profile = profileOf(shadow, "other");
  assert.deepEqual(profile, LIVING_SHADOW);
  const c = byTarget(derivedChanges(shadow, master, profile, "other"));
  assert.equal(c.mhp.formula, "40");
  assert.equal(c.bab.formula, "10");
  assert.equal(c.fort.formula, "4");
  assert.equal(c.ref.formula, "13");
  assert.equal(c.will.formula, "5");
  assert.equal(c["skill.~per"], undefined);
  assert.equal(c.mhp.flavor, "PF1COMP.Derived.Flavor");
});

test("no profile: animal companions and an unflagged other class derive nothing", () => {
  assert.equal(profileOf(actor({ kind: "animalCompanion" }), "animalCompanion"), null);
  assert.equal(profileOf(actor({ kind: "other" }), "other"), null);
});

test("a class profile overrides the familiar default", () => {
  const fam = actor({ kind: "familiar", classFlags: { hp: 0.25 } });
  assert.deepEqual(profileOf(fam, "familiar"), { hp: 0.25 });
});

console.log(`\n${passed} passed`);
