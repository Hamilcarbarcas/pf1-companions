/**
 * `@master`, `@companion` and `@companions` roll data. DESIGN.md §4.3
 *
 * PF1 fires pf1GetRollData only when it rebuilds an actor's roll data, and caches the object
 * the hook added to, so these keys persist until the actor's next prep.
 */

import { KINDS } from "./constants.mjs";
import { grantItems, readGrant, sumLevels } from "./grants.mjs";
import { companionLevel, getLinks, isBuilt } from "./links.mjs";

/** Actors whose roll data is being built, guarding against a link cycle. */
const building = new Set();

function addMasterData(actor, rollData) {
  const items = grantItems(actor);
  if (!items.length) return;
  const companions = {};
  for (const kind of KINDS) {
    const ofKind = items.filter((i) => readGrant(i).kind === kind);
    if (ofKind.length) companions[kind] = { level: sumLevels(ofKind, rollData) };
  }
  rollData.companions = companions;
}

function addCompanionData(actor, rollData) {
  if (!isBuilt()) return;
  const master = getLinks(actor)[0]?.master;
  if (!master) return;
  if (building.has(master.id)) return;
  const masterData = master.getRollData();
  const info = companionLevel(actor, masterData);
  if (!info) return;
  rollData.master = masterData;
  rollData.companion = { level: info.level, kind: info.kind };
}

function onGetRollData(doc, rollData) {
  if (!(doc instanceof Actor) || building.has(doc.id)) return;
  building.add(doc.id);
  try {
    addMasterData(doc, rollData);
    addCompanionData(doc, rollData);
  } finally {
    building.delete(doc.id);
  }
}

export function registerHooks() {
  Hooks.on("pf1GetRollData", onGetRollData);
}
