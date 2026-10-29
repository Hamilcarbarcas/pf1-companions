/**
 * Master-side items: Familiar Bonus (copied from the familiar's bonus feat, off while the
 * familiar is away) and Alertness (on while the familiar is adjacent), DESIGN.md §7.1, §7.2;
 * Command Companion, one per animal companion granting feature, §16.
 *
 * Desired state is derived from the links; the writer client creates, updates and deletes the
 * items to match. The away flag lives on the granting feature (`grant.away`).
 */

import { GRANT_FLAG, MASTER_BONUS_FLAG, MASTER_ITEM_FLAG, MODULE_ID, TEMPLATES } from "./constants.mjs";
import { grantItems, isWorldActor, readGrant } from "./grants.mjs";
import { getCompanionLinks, getMaster, isBuilt } from "./links.mjs";
import { isWriter } from "./writer.mjs";

/** Fresh per call: Foundry writes into the options object it is given. */
const ownWrite = () => ({ [MODULE_ID]: { own: true } });

const t = (key) => game.i18n.localize(key);

const roleOf = (item) => item.flags?.[MODULE_ID]?.[MASTER_ITEM_FLAG] ?? null;
const keyOf = (role, familiarUuid) => `${role}:${familiarUuid}`;
/** Command items are one per granting feature, the rest one per familiar. */
const keyOfFlag = (flag) => (flag.role === "command" ? `command:${flag.grant}` : keyOf(flag.role, flag.familiar));

/** The familiar's race-supplied bonus feat. §7.2 */
const bonusSource = (familiar) => familiar.items.find((i) => i.flags?.[MODULE_ID]?.[MASTER_BONUS_FLAG]) ?? null;

/** Token rectangles touching or overlapping: within arm's reach. §7.1 */
function touching(a, b, size) {
  const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.width * size, b.x + b.width * size);
  const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.height * size, b.y + b.height * size);
  return gapX <= 0 && gapY <= 0;
}

/** True when both actors have linked tokens adjacent on any scene. */
export function adjacent(a, b) {
  for (const scene of game.scenes) {
    const mine = scene.tokens.filter((tk) => tk.actorLink && tk.actorId === a.id);
    if (!mine.length) continue;
    const theirs = scene.tokens.filter((tk) => tk.actorLink && tk.actorId === b.id);
    for (const x of mine) for (const y of theirs) if (touching(x, y, scene.grid.size)) return true;
  }
  return false;
}

/** Items this master should carry, keyed by role and familiar. */
function wanted(master) {
  const out = new Map();
  for (const { companion: familiar, item: grantItem } of getCompanionLinks(master, "familiar")) {
    const grant = readGrant(grantItem);
    const source = bonusSource(familiar);
    if (source && !out.has(keyOf("bonus", familiar.uuid))) {
      out.set(keyOf("bonus", familiar.uuid), { role: "bonus", familiar, grantItem, source, disabled: !!grant.away });
    }
    if (!out.has(keyOf("alertness", familiar.uuid))) {
      out.set(keyOf("alertness", familiar.uuid), {
        role: "alertness",
        familiar,
        grantItem,
        disabled: !!grant.away || !adjacent(master, familiar),
      });
    }
  }
  // §16: features granting the same companion share one.
  for (const { companion, item: grantItem } of getCompanionLinks(master, "animalCompanion")) {
    const key = `command:${grantItem.id}`;
    const spec = out.get(key) ?? { role: "command", grantItem, companions: [], disabled: false };
    if (!spec.companions.includes(companion)) spec.companions.push(companion);
    out.set(key, spec);
  }
  return out;
}

/** The fields the mod owns on a master item, from a spec. */
function ownedFields(spec) {
  if (spec.role === "command") {
    const [only, ...more] = spec.companions;
    return {
      name: more.length ? t("PF1COMP.Command.Plural") : game.i18n.format("PF1COMP.Command.Name", { name: only.name }),
      // astora's Combat Options section exists only while its engine is on; Miscellaneous otherwise.
      "system.subType": game.astoraMod?.combatOptions?.enabled?.() ? "combatOption" : "misc",
      [`flags.${MODULE_ID}.${MASTER_ITEM_FLAG}`]: {
        role: "command",
        grant: spec.grantItem.id,
        companions: spec.companions.map((c) => c.uuid),
      },
    };
  }
  const fields = {
    "system.disabled": spec.disabled,
    [`flags.${MODULE_ID}.${MASTER_ITEM_FLAG}`]: { role: spec.role, familiar: spec.familiar.uuid, grant: spec.grantItem.id },
  };
  if (spec.role === "bonus") {
    const src = spec.source.toObject().system;
    const species = spec.familiar.race?.name ?? spec.familiar.name;
    fields.name = game.i18n.format("PF1COMP.Familiar.BonusName", { name: species });
    fields["system.changes"] = src.changes ?? [];
    fields["system.contextNotes"] = src.contextNotes ?? [];
  }
  return fields;
}

function differs(item, fields) {
  const update = {};
  for (const [path, value] of Object.entries(fields)) {
    const current = foundry.utils.getProperty(item._source, path);
    if (JSON.stringify(current ?? null) !== JSON.stringify(value ?? null)) update[path] = value;
  }
  return update;
}

async function create(master, spec) {
  const template = await fromUuid(TEMPLATES[spec.role]);
  if (!template) return void console.error(`${MODULE_ID} | missing template ${TEMPLATES[spec.role]}`);
  const data = game.items.fromCompendium(template, { clearFolder: true });
  for (const [path, value] of Object.entries(ownedFields(spec))) foundry.utils.setProperty(data, path, value);
  const [item] = await master.createEmbeddedDocuments("Item", [data], ownWrite());
  // Child of the granting feature, so deleting the feature removes it. §7.2
  if (item && spec.grantItem.isOwner) await spec.grantItem.createItemLink("children", item).catch(() => null);
}

async function reconcile(master) {
  if (!isBuilt() || !isWorldActor(master) || !isWriter(master)) return;
  const want = wanted(master);
  const existing = master.items.filter((i) => roleOf(i));

  const stale = existing.filter((i) => !want.has(keyOfFlag(roleOf(i)))).map((i) => i.id);
  if (stale.length) await master.deleteEmbeddedDocuments("Item", stale, ownWrite());

  for (const [key, spec] of want) {
    const item = existing.find((i) => keyOfFlag(roleOf(i)) === key);
    if (!item) {
      await create(master, spec);
      continue;
    }
    const update = differs(item, ownedFields(spec));
    if (Object.keys(update).length) await item.update(update, ownWrite());
  }
}

/** master id -> tail of its queue */
const queues = new Map();
const pending = new Set();
let timer = null;

/** Queue reconciles for these masters, batched to the next tick. */
export function scheduleMasters(masters) {
  for (const m of masters) if (m?.id) pending.add(m.id);
  if (pending.size && !timer) timer = setTimeout(flush, 0);
}

function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  for (const id of ids) {
    const master = game.actors.get(id);
    if (!master) continue;
    const next = (queues.get(id) ?? Promise.resolve())
      .then(() => reconcile(master))
      .catch((err) => console.error(`${MODULE_ID} | master items failed for ${master.name}:`, err));
    queues.set(id, next);
    next.finally(() => {
      if (queues.get(id) === next) queues.delete(id);
    });
  }
}

/** Every master with a granting feature. */
export function scheduleAll() {
  scheduleMasters(game.actors.filter((a) => grantItems(a).length));
}

/** Set a granting feature's away flag and say so in chat. §7.1 */
export async function setAway(grantItem, away) {
  const grant = readGrant(grantItem);
  if (!grant) return;
  await grantItem.update({ [`flags.${MODULE_ID}.${GRANT_FLAG}.away`]: away });
  const familiar = grant.companion ? fromUuidSync(grant.companion) : null;
  const key = away ? "PF1COMP.Familiar.Away" : "PF1COMP.Familiar.Back";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: grantItem.parent }),
    content: `<p>${game.i18n.format(key, { name: foundry.utils.escapeHTML(familiar?.name ?? "") })}</p>`,
  });
}

/** Command Companion's use is astora-mod's Handle Animal prompt with its companions. §16 */
function openCommand(item, role) {
  const handleAnimal = game.astoraMod?.handleAnimal;
  if (!handleAnimal) return void ui.notifications.warn(t("PF1COMP.Command.NoEngine"));
  handleAnimal
    .prompt(item.parent, { animals: role.companions ?? [], source: item })
    .catch((err) => console.error(`${MODULE_ID} | Command Companion failed:`, err));
}

/** pf1-new-script-hooks: stop before PF1's use dialog opens. */
function onPreAttackDialog(actionUse) {
  const item = actionUse?.item;
  const role = item ? roleOf(item) : null;
  if (role?.role !== "command") return;
  actionUse.shared.reject = true;
  openCommand(item, role);
}

/** The presence action on Familiar Bonus: toggle away instead of a normal use. Command
 *  Companion without pf1-new-script-hooks lands here after PF1's dialog. */
function onPreActionUse(actionUse) {
  const item = actionUse?.item;
  const role = item ? roleOf(item) : null;
  if (role?.role === "command") {
    openCommand(item, role);
    return false;
  }
  if (role?.role !== "bonus") return;
  const grantItem = item.parent?.items.get(role.grant);
  if (grantItem) setAway(grantItem, !readGrant(grantItem)?.away).catch((err) => console.error(`${MODULE_ID} | presence toggle failed:`, err));
  return false;
}

/** Still backed by a live link: the granting feature exists and still picks that familiar. */
function stillLinked(item) {
  const role = roleOf(item);
  const grantItem = item.parent?.items.get(role?.grant);
  if (role?.role === "command") return !!grantItem && !!readGrant(grantItem)?.companion;
  return !!grantItem && readGrant(grantItem)?.companion === role.familiar;
}

function onPreDelete(item, options) {
  if (!roleOf(item) || options?.[MODULE_ID]?.own || !stillLinked(item)) return;
  ui.notifications.warn(t("PF1COMP.Familiar.NoDelete"));
  return false;
}

/** Disabling Familiar Bonus by hand marks the familiar away; enabling marks it back. */
function onItemUpdate(item, changed, options, userId) {
  if (userId !== game.user.id || options?.[MODULE_ID]?.own) return;
  const role = roleOf(item);
  if (role?.role === "bonus" && foundry.utils.hasProperty(changed, "system.disabled")) {
    const grantItem = item.parent?.items.get(role.grant);
    if (grantItem && !!readGrant(grantItem)?.away !== changed.system.disabled) {
      grantItem.update({ [`flags.${MODULE_ID}.${GRANT_FLAG}.away`]: changed.system.disabled });
    }
    return;
  }
  onItemChanged(item);
}

/** Grant features, a familiar's bonus feat, and companion links all feed the desired state. */
function onItemChanged(item) {
  if (!isBuilt()) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;
  if (readGrant(item)) scheduleMasters([actor]);
  if (item.flags?.[MODULE_ID]?.[MASTER_BONUS_FLAG]) scheduleMasters([getMaster(actor)]);
}

/** Token moves change adjacency for masters and their familiars. */
function onTokenChange(token, changed) {
  if (!isBuilt() || !token.actorLink || !token.actor) return;
  if (changed && !["x", "y", "width", "height"].some((k) => k in changed)) return;
  const actor = token.actor;
  scheduleMasters([actor, getMaster(actor)].filter((a) => a && grantItems(a, "familiar").length));
}

export function registerHooks() {
  Hooks.on("pf1PreAttackDialog", onPreAttackDialog);
  Hooks.on("pf1PreActionUse", onPreActionUse);
  Hooks.on("preDeleteItem", onPreDelete);
  Hooks.on("updateItem", onItemUpdate);
  Hooks.on("createItem", onItemChanged);
  Hooks.on("deleteItem", onItemChanged);
  Hooks.on("createToken", (token) => onTokenChange(token));
  Hooks.on("updateToken", (token, changed) => onTokenChange(token, changed));
  Hooks.on("deleteToken", (token) => onTokenChange(token));
}
