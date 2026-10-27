/**
 * Grant config on a master's feature, and effective level. DESIGN.md §4.2
 */

import { CLASS_FLAG, GRANT_FLAG, KINDS, MODULE_ID } from "./constants.mjs";

/** This mod's companion classes by compendium id, for copies that arrive without the kind flag. */
const SOURCE_KIND = {
  pfcAnimalCompCls: "animalCompanion",
  pfcBondedMountCl: "animalCompanion",
  pfcFamiliarClass: "familiar",
};
const SOURCE_PREFIX = `Compendium.${MODULE_ID}.companion-features.Item.`;

/** A class item's companion kind: its kind flag, else its compendium source in this mod's pack. */
export function classKind(cls) {
  const flag = cls?.flags?.[MODULE_ID]?.[CLASS_FLAG];
  if (flag) return flag;
  const source = cls?._stats?.compendiumSource ?? "";
  return source.startsWith(SOURCE_PREFIX) ? SOURCE_KIND[source.slice(SOURCE_PREFIX.length)] ?? null : null;
}

/** The grant flag on an item, or null when the item grants nothing. */
export function readGrant(item) {
  const grant = item?.flags?.[MODULE_ID]?.[GRANT_FLAG];
  if (!grant || !KINDS.includes(grant.kind)) return null;
  return grant;
}

/** Items on an actor that grant a companion, optionally of one kind. */
export function grantItems(actor, kind) {
  return (actor?.items ?? []).filter((item) => {
    const grant = readGrant(item);
    return grant && (!kind || grant.kind === kind);
  });
}

/** Evaluate a level formula; 0 for blank or broken formulas. */
export function evalLevel(formula, rollData) {
  if (!formula) return 0;
  const roll = pf1.dice.RollPF.safeRollSync(String(formula), rollData, MODULE_ID);
  const total = Number(roll?.total);
  return Number.isFinite(total) ? total : 0;
}

/** Sum of grant levels over items, floored at 0. */
export function sumLevels(items, rollData) {
  const total = items.reduce((sum, item) => sum + evalLevel(readGrant(item)?.level, rollData), 0);
  return Math.max(0, Math.floor(total));
}

/** True for an actor in the world collection (not a token delta or compendium copy). */
export function isWorldActor(actor) {
  return !!actor && !actor.isToken && !actor.pack && game.actors?.get(actor.id) === actor;
}
