/**
 * Keeps a companion class's level at the effective level, and its HP at the average per HD.
 * DESIGN.md §4.5, §5.1
 *
 * The only database write the engine makes. PF1 then adds or removes class associations on the
 * writing client (`_onLevelChange`), and enhanced-links / astora react to the level change.
 */

import { AVERAGE_HP_KINDS, MODULE_ID } from "./constants.mjs";
import { classKind } from "./grants.mjs";
import { companionLevel } from "./links.mjs";

/** actor id -> tail of its write queue */
const queues = new Map();

/** The active GM writes; with none online, the first active owner by id. */
export function isWriter(actor) {
  const gm = game.users.activeGM;
  if (gm) return gm.isSelf;
  const owners = game.users
    .filter((u) => u.active && actor.testUserPermission(u, "OWNER"))
    .sort((a, b) => a.id.localeCompare(b.id));
  return owners[0]?.isSelf ?? false;
}

/** Hit dice a class has at a level: its customHD formula, else the level. */
export function hitDiceAt(cls, level) {
  const formula = cls.system.customHD;
  if (!formula) return level;
  const roll = pf1.dice.RollPF.safeRollSync(formula, { item: { level } }, MODULE_ID);
  const total = Number(roll?.total);
  return Number.isFinite(total) ? total : level;
}

/** Average HP for a die size over some HD, rounded down once at the end. */
export const averageHp = (die, hd) => Math.floor(((Number(die) + 1) / 2) * hd);

/** The class item of a companion's kind. */
export function kindClass(actor, kind) {
  return actor.itemTypes.class.find((cls) => classKind(cls) === kind) ?? null;
}

async function sync(actor) {
  const info = companionLevel(actor);
  if (!info) return;
  const cls = kindClass(actor, info.kind);
  if (!cls) return;

  // A class can't sit at level 0; EL 0 shows as level 1. §4.2
  const level = Math.max(1, info.level);
  const update = {};
  if (cls.system.level !== level) update["system.level"] = level;
  if (AVERAGE_HP_KINDS.includes(info.kind)) {
    const hp = averageHp(cls.system.hd, hitDiceAt(cls, level));
    if (cls.system.hp !== hp) update["system.hp"] = hp;
  }
  if (Object.keys(update).length) await cls.update(update);
}

/** Queue a sync for each actor this client is the writer for. */
export function scheduleSync(actors) {
  for (const actor of actors) {
    if (!actor || !isWriter(actor)) continue;
    const prev = queues.get(actor.id) ?? Promise.resolve();
    const next = prev
      .then(() => sync(actor))
      .catch((err) => console.error(`${MODULE_ID} | class sync failed for ${actor.name}:`, err));
    queues.set(actor.id, next);
    next.finally(() => {
      if (queues.get(actor.id) === next) queues.delete(actor.id);
    });
  }
}
