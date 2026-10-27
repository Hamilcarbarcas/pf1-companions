/**
 * Companions re-prepare when their master does. DESIGN.md §4.4
 *
 * Data flows master -> companion only. Every client resets its own copies; nothing is written.
 */

import { MODULE_ID } from "./constants.mjs";
import { classKind } from "./grants.mjs";
import { getCompanions, getMaster, isBuilt, isCompanion } from "./links.mjs";
import { scheduleSync } from "./writer.mjs";

const pending = new Set();
let timer = null;
let flushing = false;

/** Queue companions for one batched reset on the next tick. */
export function scheduleReset(actorIds) {
  for (const id of actorIds ?? []) if (id) pending.add(id);
  if (pending.size && !timer) timer = setTimeout(flush, 0);
}

function rerender(actor) {
  for (const app of Object.values(actor?.apps ?? {})) {
    if (app.rendered) app.render(false);
  }
}

function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  const done = [];
  // Preps caused by these resets must not queue more resets.
  flushing = true;
  try {
    for (const id of ids) {
      const actor = game.actors.get(id);
      if (!actor) continue;
      try {
        actor.reset();
      } catch (err) {
        console.error(`${MODULE_ID} | reset failed for ${actor.name}:`, err);
      }
      rerender(actor);
      done.push(actor);
    }
  } finally {
    flushing = false;
  }
  // With fresh @master data, bring each companion class to its level. §4.5
  scheduleSync(done.filter((a) => isCompanion(a)));
}

/** A companion class added to or removed from a companion. */
function onClassChange(item) {
  if (!isBuilt() || item.type !== "class" || !classKind(item)) return;
  const actor = item.parent;
  if (actor instanceof Actor && isCompanion(actor)) scheduleReset([actor.id]);
}

function onPrepared(actor) {
  if (flushing || !isBuilt()) return;
  const companions = getCompanions(actor);
  if (companions.length) scheduleReset(companions.map((c) => c.id));
}

/** A companion's HP and name show on the master's sheet. */
function onActorUpdate(actor) {
  if (!isBuilt()) return;
  const master = getMaster(actor);
  if (master) rerender(master);
}

export function registerHooks() {
  Hooks.on("pf1PrepareDerivedActorData", onPrepared);
  Hooks.on("updateActor", onActorUpdate);
  Hooks.on("createItem", onClassChange);
  Hooks.on("deleteItem", onClassChange);
}
