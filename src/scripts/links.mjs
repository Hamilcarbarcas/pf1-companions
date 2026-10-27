/**
 * Links between masters and companions. DESIGN.md §4.1, §8
 *
 * Truth is the grant flag on the master's feature. The index is rebuilt from it at `ready`
 * and kept current from item and actor hooks; the companion's mirror flag is a back-pointer
 * only, repaired by the active GM.
 */

import { ACTOR_TYPES, GRANT_FLAG, MIRROR_FLAG, MODULE_ID } from "./constants.mjs";
import { classKind, grantItems, isWorldActor, readGrant, sumLevels } from "./grants.mjs";
import { scheduleReset } from "./refresh.mjs";
import { prepareCompanion } from "./companion-setup.mjs";

/** companion id -> Map(item uuid -> { masterId, itemId }) */
const byCompanion = new Map();
/** item uuid -> companion id */
const byItem = new Map();

let built = false;

/** A feature's link target when the link is valid, else null. */
function linkTarget(item) {
  const grant = readGrant(item);
  const master = item?.parent;
  if (!grant?.companion || !isWorldActor(master)) return null;
  // A copy carried to another actor keeps the old stamp and stays inert. §4.1
  if (grant.master !== master.id) return null;
  const companion = fromUuidSync(grant.companion);
  if (!(companion instanceof Actor) || !isWorldActor(companion) || companion === master) return null;
  return companion;
}

function dropItem(uuid) {
  const companionId = byItem.get(uuid);
  if (!companionId) return null;
  byItem.delete(uuid);
  const entries = byCompanion.get(companionId);
  entries?.delete(uuid);
  if (entries && !entries.size) byCompanion.delete(companionId);
  return companionId;
}

/** Re-index one item. Returns the companion ids whose links changed. */
function indexItem(item) {
  const touched = new Set();
  const old = dropItem(item.uuid);
  if (old) touched.add(old);

  const companion = linkTarget(item);
  if (companion) {
    let entries = byCompanion.get(companion.id);
    if (!entries) byCompanion.set(companion.id, (entries = new Map()));
    entries.set(item.uuid, { masterId: item.parent.id, itemId: item.id });
    byItem.set(item.uuid, companion.id);
    touched.add(companion.id);
  }
  return touched;
}

export function rebuild() {
  byCompanion.clear();
  byItem.clear();
  for (const actor of game.actors) {
    for (const item of grantItems(actor)) indexItem(item);
  }
  built = true;
}

export const isBuilt = () => built;

/** Link entries for a companion: [{ master, item }], items resolved. */
export function getLinks(companion) {
  const entries = byCompanion.get(companion?.id);
  if (!entries) return [];
  const out = [];
  for (const { masterId, itemId } of entries.values()) {
    const master = game.actors.get(masterId);
    const item = master?.items.get(itemId);
    if (item) out.push({ master, item });
  }
  return out;
}

export function getMaster(companion) {
  return getLinks(companion)[0]?.master ?? null;
}

/** Companions of a master: [{ companion, item }], one per linked feature. */
export function getCompanionLinks(master, kind) {
  const out = [];
  for (const item of grantItems(master, kind)) {
    const companionId = byItem.get(item.uuid);
    const companion = companionId ? game.actors.get(companionId) : null;
    if (companion) out.push({ companion, item });
  }
  return out;
}

export function getCompanions(master, kind) {
  return [...new Set(getCompanionLinks(master, kind).map((l) => l.companion))];
}

export function isCompanion(actor) {
  return byCompanion.has(actor?.id);
}

export function isMaster(actor) {
  return grantItems(actor).some((item) => byItem.has(item.uuid));
}

/**
 * A companion's effective level and kind: the master's features of one kind that picked it,
 * summed. §4.2
 */
export function companionLevel(companion, masterRollData) {
  const links = getLinks(companion);
  if (!links.length) return null;
  const { master, item } = links[0];
  const kind = readGrant(item).kind;
  const items = links.filter((l) => l.master === master && readGrant(l.item).kind === kind).map((l) => l.item);
  const rollData = masterRollData ?? master.getRollData();
  return { master, kind, level: sumLevels(items, rollData) };
}

/** True when the actor carries a companion class of this kind. §6 */
export function hasKindClass(actor, kind) {
  return (actor?.itemTypes?.class ?? []).some((cls) => classKind(cls) === kind);
}

/**
 * Whether a feature may pick an actor. §8.3
 *
 * @returns {{ listed: boolean, disabled?: string, group?: "eligible"|"other", current?: boolean }}
 */
export function eligibility(item, actor) {
  const master = item.parent;
  if (!actor || actor === master || !ACTOR_TYPES.includes(actor.type) || !isWorldActor(actor)) {
    return { listed: false };
  }

  const grant = readGrant(item);
  const current = grant?.companion === actor.uuid && byItem.get(item.uuid) === actor.id;
  const group = hasKindClass(actor, grant?.kind) ? "eligible" : "other";

  const other = getLinks(actor).find((l) => l.master !== master || readGrant(l.item).kind !== grant?.kind);
  if (other) {
    const name = other.master === master ? game.i18n.localize("PF1COMP.Picker.OtherKind") : other.master.name;
    return { listed: true, group, current, disabled: game.i18n.format("PF1COMP.Picker.LinkedTo", { name }) };
  }
  // No chains: a master can't be a companion. §4.4
  if (isMaster(actor)) {
    return { listed: true, group, current, disabled: game.i18n.localize("PF1COMP.Picker.HasCompanions") };
  }
  return { listed: true, group, current };
}

/** Why a feature can't pick at all, or null. */
export function cannotPick(item) {
  const master = item?.parent;
  if (!readGrant(item)) return "PF1COMP.Warn.NoGrant";
  if (!isWorldActor(master)) return "PF1COMP.Warn.NotWorldActor";
  if (!master.isOwner) return "PF1COMP.Warn.NotOwner";
  if (isCompanion(master)) return "PF1COMP.Warn.CompanionMaster";
  return null;
}

function mirrorFor(master, item, kind) {
  return { actor: master.uuid, item: item.uuid, kind };
}

/** Link a feature to a companion. One operation by a user owning both actors. §8.1 */
export async function link(item, companion) {
  const blocked = cannotPick(item);
  if (blocked) return void ui.notifications.warn(game.i18n.localize(blocked));
  if (!companion?.isOwner) return void ui.notifications.warn(game.i18n.localize("PF1COMP.Warn.NotOwnerCompanion"));

  const check = eligibility(item, companion);
  if (!check.listed || check.disabled) {
    return void ui.notifications.warn(check.disabled ?? game.i18n.localize("PF1COMP.Warn.NotEligible"));
  }

  const master = item.parent;
  const grant = readGrant(item);

  // Re-picking on a feature that held another companion releases that one first.
  if (grant.companion && grant.companion !== companion.uuid) await unlink(item, { quiet: true });

  const update = {
    [`flags.${MODULE_ID}.${MIRROR_FLAG}`]: mirrorFor(master, item, grant.kind),
    "prototypeToken.actorLink": true,
    "prototypeToken.disposition": master.prototypeToken.disposition,
  };
  // A fresh import is owned by nobody; only a GM can change ownership.
  if (game.user.isGM) {
    for (const [userId, level] of Object.entries(master.ownership)) {
      if (userId === "default") continue;
      if (level > (companion.ownership[userId] ?? 0)) update[`ownership.${userId}`] = level;
    }
  }
  await companion.update(update);
  await item.update({
    [`flags.${MODULE_ID}.${GRANT_FLAG}.companion`]: companion.uuid,
    [`flags.${MODULE_ID}.${GRANT_FLAG}.master`]: master.id,
  });
  await prepareCompanion(companion, grant);

  Hooks.callAll(`${MODULE_ID}.linked`, master, companion, item);
}

/** Clear a feature's link and, when nothing else links the companion, its mirror. */
export async function unlink(item, { quiet = false } = {}) {
  const grant = readGrant(item);
  if (!grant?.companion) return;
  const master = item.parent;
  const companion = fromUuidSync(grant.companion);

  await item.update({
    [`flags.${MODULE_ID}.${GRANT_FLAG}.-=companion`]: null,
    [`flags.${MODULE_ID}.${GRANT_FLAG}.-=master`]: null,
  });

  if (companion instanceof Actor && companion.isOwner) await syncMirror(companion);
  if (!quiet) Hooks.callAll(`${MODULE_ID}.released`, master, companion, item);
}

/** Make a companion's mirror flag match the index. Returns true when it wrote. */
async function syncMirror(actor) {
  const links = getLinks(actor);
  const stored = actor.getFlag(MODULE_ID, MIRROR_FLAG);
  if (!links.length) {
    if (!stored) return false;
    await actor.unsetFlag(MODULE_ID, MIRROR_FLAG);
    return true;
  }
  const { master, item } = links[0];
  const want = mirrorFor(master, item, readGrant(item).kind);
  if (stored?.actor === want.actor && stored?.item === want.item && stored?.kind === want.kind) return false;
  await actor.setFlag(MODULE_ID, MIRROR_FLAG, want);
  return true;
}

/** Active GM only: repair every mirror against the index. §4.1 */
export async function reconcileMirrors() {
  if (!game.users.activeGM?.isSelf) return;
  for (const actor of game.actors) {
    if (!actor.getFlag(MODULE_ID, MIRROR_FLAG) && !isCompanion(actor)) continue;
    try {
      await syncMirror(actor);
    } catch (err) {
      console.error(`${MODULE_ID} | mirror repair failed for ${actor.name}:`, err);
    }
  }
}

function onItemChange(item) {
  if (!built || !(item.parent instanceof Actor)) return;
  const known = byItem.has(item.uuid);
  if (!known && !readGrant(item)) return;
  const touched = indexItem(item);
  if (touched.size) scheduleReset([...touched]);
}

function onItemDelete(item) {
  if (!built) return;
  const companionId = dropItem(item.uuid);
  if (companionId) scheduleReset([companionId]);
}

function onActorDelete(actor) {
  if (!built) return;
  byCompanion.delete(actor.id);
  const touched = [];
  for (const [uuid, companionId] of [...byItem]) {
    if (companionId === actor.id || uuid.startsWith(`${actor.uuid}.`)) {
      dropItem(uuid);
      touched.push(companionId);
    }
  }
  scheduleReset(touched.filter((id) => id !== actor.id));
}

export function registerHooks() {
  Hooks.on("createItem", onItemChange);
  Hooks.on("updateItem", onItemChange);
  Hooks.on("deleteItem", onItemDelete);
  Hooks.on("deleteActor", onActorDelete);
}
