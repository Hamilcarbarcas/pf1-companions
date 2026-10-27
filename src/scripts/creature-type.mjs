/**
 * Features that change an actor's creature type while active (Magical Beast). DESIGN.md §5.6
 *
 * PF1 builds creature types from active items' `system.creatureTypes`, a field only race items
 * have, so the swap is applied to the prepared traits after PF1's own derived prep. Derived only.
 */

import { CREATURE_TYPE_FLAG, MODULE_ID } from "./constants.mjs";

function onPrepared(actor) {
  const types = actor.system?.traits?.creatureTypes?.standard;
  if (!(types instanceof Set)) return;
  const items = actor.items.filter((i) => i.isActive && i.flags?.[MODULE_ID]?.[CREATURE_TYPE_FLAG]);
  if (!items.length) return;

  for (const item of items) {
    const { add, remove = [] } = item.flags[MODULE_ID][CREATURE_TYPE_FLAG];
    for (const type of remove) types.delete(type);
    if (add) types.add(add);
  }

  // The flags PF1's _prepareCreatureType derives from the set.
  const traits = actor.system.traits;
  traits.humanoid = types.has("humanoid");
  traits.undead = types.has("undead");
  traits.construct = types.has("construct");
  traits.living = !traits.undead && !traits.construct;
}

export function registerHooks() {
  Hooks.on("pf1PrepareDerivedActorData", (actor) => {
    try {
      onPrepared(actor);
    } catch (err) {
      console.error(`${MODULE_ID} | creature type failed for ${actor?.name}:`, err);
    }
  });
}
