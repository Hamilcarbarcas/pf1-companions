/**
 * astora-mod Handle Animal providers: Link's handling rules, the master's animal companions,
 * the Tricks section on a companion, and its bonus trick allowance. DESIGN.md §16
 */

import { LINK_SOURCE, MODULE_ID } from "./constants.mjs";
import { readGrant } from "./grants.mjs";
import { companionLevel, getCompanions, getLinks } from "./links.mjs";

const KIND = "animalCompanion";

/** Link, by compendium source; a copy without one by name and subtype. */
const hasLink = (actor) =>
  (actor?.itemTypes?.feat ?? []).some(
    (i) => i._stats?.compendiumSource === LINK_SOURCE || (i.name === "Link" && i.system?.subType === "companion")
  );

const linkedAs = (animal, master = null) =>
  getLinks(animal).some((l) => readGrant(l.item)?.kind === KIND && (!master || l.master.id === master.id));

function handler(master, animal) {
  if (!master || !linkedAs(animal, master) || !hasLink(animal)) return null;
  return { label: "Link", bonus: 4, handleAction: "free", pushAction: "move", noNonAnimalPenalty: true };
}

/** Bonus Tricks: floor(level / 3) + 1 (§ 15.2). */
function bonusAllowance(animal) {
  const info = companionLevel(animal);
  return info?.kind === KIND ? Math.floor(info.level / 3) + 1 : null;
}

export function registerHooks() {
  Hooks.once("setup", () => {
    const api = game.astoraMod?.handleAnimal;
    if (!api) return console.error(`${MODULE_ID} | astora-mod's Handle Animal is missing; Command Companion is off.`);
    try {
      api.registerHandler(handler);
      api.registerCompanions((master) => getCompanions(master, KIND));
      api.registerTricksShown((actor) => linkedAs(actor));
      api.registerBonusAllowance(bonusAllowance);
    } catch (err) {
      console.error(`${MODULE_ID} | registering with Handle Animal failed:`, err);
    }
  });
}
