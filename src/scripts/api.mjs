/**
 * Public API: game.modules.get("pf1-companions").api. DESIGN.md §9
 */

import { grantItems, sumLevels } from "./grants.mjs";
import { companionLevel, getCompanions, getLinks, getMaster, link, rebuild, reconcileMirrors, unlink } from "./links.mjs";
import { scheduleAll } from "./master-items.mjs";
import { scheduleReset } from "./refresh.mjs";
import { pickCompanion } from "./ui/picker.mjs";

export const api = {
  /** The master of a companion, or null. */
  getMaster,
  /** Companions of a master, optionally of one kind. */
  getCompanions,
  /** Link entries of a companion: [{ master, item }]. */
  getLinks,
  /** `{ master, kind, level }` for a companion, or null. */
  companionLevel,
  /** A master's effective level for a kind, over all its granting features. */
  getLevel: (master, kind) => sumLevels(grantItems(master, kind), master.getRollData()),
  link,
  unlink,
  pick: pickCompanion,
  /** Rebuild the index, repair mirrors (GM), reset every companion, reconcile master items. */
  async refresh() {
    rebuild();
    await reconcileMirrors();
    scheduleReset(game.actors.filter((a) => getLinks(a).length).map((a) => a.id));
    scheduleAll();
  },
};
