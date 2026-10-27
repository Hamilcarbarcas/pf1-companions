/**
 * pf1-companions entry point. DESIGN.md §12: links, roll data, refresh, sheet UI (phase 1);
 * companion subtype, class sync, companion setup (phase 2); familiars (phase 5).
 */

import { api } from "./api.mjs";
import { MODULE_ID } from "./constants.mjs";
import * as creatureType from "./creature-type.mjs";
import * as familiar from "./familiar.mjs";
import * as links from "./links.mjs";
import * as masterItems from "./master-items.mjs";
import * as refresh from "./refresh.mjs";
import * as rollData from "./roll-data.mjs";
import * as subtype from "./subtype.mjs";
import * as companionLine from "./ui/companion-line.mjs";
import * as grantSection from "./ui/grant-section.mjs";
import * as masterSection from "./ui/master-section.mjs";

Hooks.once("init", () => {
  // Assigned first so a failure below still leaves the API reachable for diagnosis.
  game.modules.get(MODULE_ID).api = api;

  try {
    links.registerHooks();
    refresh.registerHooks();
    rollData.registerHooks();
    subtype.registerHooks();
    familiar.registerHooks();
    creatureType.registerHooks();
    masterItems.registerHooks();
    grantSection.registerHooks();
    masterSection.registerHooks();
    companionLine.registerHooks();
  } catch (err) {
    console.error(`${MODULE_ID} | setup failed:`, err);
  }
});

Hooks.once("ready", async () => {
  try {
    // Prep order at load is arbitrary, so companions re-prepare once their masters exist. §4.4
    await api.refresh();
  } catch (err) {
    console.error(`${MODULE_ID} | ready failed:`, err);
  }
});
