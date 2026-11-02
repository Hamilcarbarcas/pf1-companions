/**
 * Master-derived companion numbers, added as default Changes during the companion's prep.
 * DESIGN.md §5.2 (familiar), §17.1 (profiles)
 *
 * PF1 calls pf1AddDefaultChanges in `_prepareTypeChanges`, after base prep has summed class BAB
 * and before max HP is calculated, so an `mhp` set here applies.
 *
 * Which numbers come from the master is a profile: the companion class's `derived` flag, else the
 * familiar's own (RAW) for kind familiar. Animal companions have none.
 */

import { DERIVED_FLAG, MODULE_ID } from "./constants.mjs";
import { classKind } from "./grants.mjs";
import { companionLevel, isBuilt } from "./links.mjs";

const SAVES = ["fort", "ref", "will"];

/**
 * RAW familiar: half the master's HP, the master's BAB, each base save the better of its own, the
 * familiar baseline (+2 / +2 / +0), and the master's, and the master's skill ranks.
 */
export const FAMILIAR_PROFILE = Object.freeze({
  hp: 0.5,
  bab: true,
  saves: { fort: { offset: 0, floor: 2 }, ref: { offset: 0, floor: 2 }, will: { offset: 0, floor: 0 } },
  skills: true,
});

const t = (key) => game.i18n.localize(key);

/** Set per prep in onDefaultChanges: "Familiar (master)" or "From master". */
let flavor = "";

function make(target, value, { operator = "add", type = "untypedPerm", priority = 0 } = {}) {
  return new pf1.components.ItemChange({ formula: String(value), target, type, operator, priority, flavor });
}

/** The profile in force: the kind class's flag, else the familiar default. Null: nothing derived. */
export function profileOf(actor, kind) {
  const cls = (actor.itemTypes?.class ?? []).find((c) => classKind(c) === kind);
  const flag = cls?.flags?.[MODULE_ID]?.[DERIVED_FLAG];
  if (flag && typeof flag === "object") return flag;
  return kind === "familiar" ? FAMILIAR_PROFILE : null;
}

const classBaseSave = (actor, save) =>
  actor.itemTypes.class.reduce((sum, cls) => sum + (cls.system.savingThrows?.[save]?.base ?? 0), 0);

const isClassSkill = (actor, key) => actor.itemTypes.class.some((cls) => cls.system.classSkills?.[key]);

function hpChanges(master, fraction, out) {
  const max = master.system.attributes?.hp?.max ?? 0;
  // Last, so Con per HD and other adds don't land on top of the set.
  out.push(make("mhp", Math.floor(max * fraction), { operator: "set", type: "untyped", priority: -100 }));
}

function babChanges(actor, master, out) {
  const diff = (master.system.attributes?.bab?.total ?? 0) - (actor.system.attributes?.bab?.total ?? 0);
  if (diff > 0) out.push(make("bab", diff));
}

/** Each listed save: the best of its own class base, the floor, and the master's base + offset. */
function saveChanges(actor, master, saves, out) {
  for (const save of SAVES) {
    const rule = saves[save];
    if (!rule) continue;
    const own = classBaseSave(actor, save);
    const best = Math.max(own, Number(rule.floor) || 0, classBaseSave(master, save) + (Number(rule.offset) || 0));
    if (best > own) out.push(make(save, best - own));
  }
}

/** One skill's change: master's ranks over the companion's, plus the class-skill bonus PF1 skips at 0 ranks. */
function skillChange(target, masterRank, ownRank, classSkill, out) {
  if (!(masterRank > ownRank)) return;
  const bonus = masterRank - ownRank + (ownRank === 0 && classSkill ? pf1.config.classSkillBonus : 0);
  out.push(make(target, bonus, { type: "untyped" }));
}

function skillChanges(actor, master, out) {
  const own = actor.system.skills ?? {};
  for (const [key, skill] of Object.entries(master.system.skills ?? {})) {
    if (!skill || !own[key]) continue;
    const cs = isClassSkill(actor, key);
    // `skill.~key` targets the skill without its sub-skills.
    skillChange(`skill.~${key}`, skill.rank ?? 0, own[key].rank ?? 0, cs, out);
    for (const [sub, subSkill] of Object.entries(skill.subSkills ?? {})) {
      const ownSub = own[key].subSkills?.[sub];
      if (!ownSub) continue;
      skillChange(`skill.${key}.${sub}`, subSkill?.rank ?? 0, ownSub.rank ?? 0, cs, out);
    }
  }
}

function onDefaultChanges(actor, changes) {
  if (!isBuilt() || !(actor instanceof Actor)) return;
  const info = companionLevel(actor);
  if (!info) return;
  const profile = profileOf(actor, info.kind);
  if (!profile) return;
  try {
    changes.push(...derivedChanges(actor, info.master, profile, info.kind));
  } catch (err) {
    console.error(`${MODULE_ID} | derived changes failed for ${actor.name}:`, err);
  }
}

/** The Changes a profile gives this companion from this master. */
export function derivedChanges(actor, master, profile, kind) {
  flavor = t(kind === "familiar" ? "PF1COMP.Familiar.Flavor" : "PF1COMP.Derived.Flavor");
  const out = [];
  if (Number(profile.hp) > 0) hpChanges(master, Number(profile.hp), out);
  if (profile.bab) babChanges(actor, master, out);
  if (profile.saves) saveChanges(actor, master, profile.saves, out);
  if (profile.skills) skillChanges(actor, master, out);
  return out;
}

export function registerHooks() {
  Hooks.on("pf1AddDefaultChanges", onDefaultChanges);
}
