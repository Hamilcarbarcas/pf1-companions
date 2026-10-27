/**
 * Master-derived familiar numbers, added as default Changes during the familiar's prep.
 * DESIGN.md §5.2
 *
 * PF1 calls pf1AddDefaultChanges in `_prepareTypeChanges`, after base prep has summed class BAB
 * and before max HP is calculated, so an `mhp` set here applies.
 */

import { MODULE_ID } from "./constants.mjs";
import { companionLevel, isBuilt } from "./links.mjs";

/** RAW familiar base saves when its own are worse. */
const BASELINE = { fort: 2, ref: 2, will: 0 };

const t = (key) => game.i18n.localize(key);

function make(target, value, { operator = "add", type = "untypedPerm", priority = 0 } = {}) {
  return new pf1.components.ItemChange({
    formula: String(value),
    target,
    type,
    operator,
    priority,
    flavor: t("PF1COMP.Familiar.Flavor"),
  });
}

const classBaseSave = (actor, save) =>
  actor.itemTypes.class.reduce((sum, cls) => sum + (cls.system.savingThrows?.[save]?.base ?? 0), 0);

const isClassSkill = (actor, key) => actor.itemTypes.class.some((cls) => cls.system.classSkills?.[key]);

function hpChanges(master, out) {
  const max = master.system.attributes?.hp?.max ?? 0;
  // Last, so Con per HD and other adds don't land on top of the set.
  out.push(make("mhp", Math.floor(max / 2), { operator: "set", type: "untyped", priority: -100 }));
}

function babChanges(actor, master, out) {
  const diff = (master.system.attributes?.bab?.total ?? 0) - (actor.system.attributes?.bab?.total ?? 0);
  if (diff > 0) out.push(make("bab", diff));
}

function saveChanges(actor, master, out) {
  for (const save of Object.keys(BASELINE)) {
    const own = classBaseSave(actor, save);
    const best = Math.max(own, BASELINE[save], classBaseSave(master, save));
    if (best > own) out.push(make(save, best - own));
  }
}

/** One skill's change: master's ranks over the familiar's, plus the class-skill bonus PF1 skips at 0 ranks. */
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
  if (info?.kind !== "familiar") return;
  const master = info.master;
  try {
    hpChanges(master, changes);
    babChanges(actor, master, changes);
    saveChanges(actor, master, changes);
    skillChanges(actor, master, changes);
  } catch (err) {
    console.error(`${MODULE_ID} | familiar changes failed for ${actor.name}:`, err);
  }
}

export function registerHooks() {
  Hooks.on("pf1AddDefaultChanges", onDefaultChanges);
}
