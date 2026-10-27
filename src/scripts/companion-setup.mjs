/**
 * Readies an actor as a companion when it is linked. DESIGN.md §8.1
 *
 * Adds the grant's companion class if missing, offers to remove classes whose HD would
 * double-count, and warns when a species race expects base-10 scores that aren't there.
 */

import { CLASS_FLAG, DEFAULT_CLASS, MODULE_ID } from "./constants.mjs";
import { classKind } from "./grants.mjs";

const t = (key) => game.i18n.localize(key);
const esc = foundry.utils.escapeHTML;
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

/** Classes adding HD a companion class would duplicate: racial HD, or a foreign companion class. */
function conflictingClasses(actor) {
  return actor.itemTypes.class.filter((cls) => {
    if (classKind(cls)) return false;
    return cls.system.subType === "racial" || /companion|familiar/i.test(cls.name);
  });
}

async function offerRemoval(actor, classes) {
  if (!classes.length) return;
  const list = classes.map((c) => `<li>${esc(c.name)}</li>`).join("");
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: t("PF1COMP.Setup.ConflictTitle") },
    content: `<p>${game.i18n.format("PF1COMP.Setup.ConflictBody", { name: esc(actor.name) })}</p><ul>${list}</ul>`,
  });
  if (ok) await actor.deleteEmbeddedDocuments("Item", classes.map((c) => c.id));
}

async function addClass(actor, kind, uuid) {
  const existing = actor.itemTypes.class.find((cls) => classKind(cls) === kind);
  if (existing) {
    // A copy recognized by its source gets the flag, so it reads the same as one this mod added.
    if (!existing.getFlag(MODULE_ID, CLASS_FLAG)) await existing.setFlag(MODULE_ID, CLASS_FLAG, kind);
    return;
  }
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source) {
    if (uuid) ui.notifications.warn(game.i18n.format("PF1COMP.Setup.ClassMissing", { uuid }));
    return;
  }
  const data = game.items.fromCompendium(source, { clearFolder: true });
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.${CLASS_FLAG}`, kind);
  data.system.level = 1;
  await actor.createEmbeddedDocuments("Item", [data]);
}

/** Species races carry ability offsets from 10 (§6); other scores would double them. */
function warnAbilities(actor) {
  const race = actor.race;
  const offsets = (race?.system?.changes ?? []).some((c) => ABILITIES.includes(c.target));
  if (!offsets) return;
  const off = ABILITIES.filter((a) => actor.system.abilities?.[a]?.value !== 10);
  if (off.length) ui.notifications.warn(game.i18n.format("PF1COMP.Setup.AbilitiesNot10", { name: actor.name }));
}

/** Run after the link is written. */
export async function prepareCompanion(actor, grant) {
  await offerRemoval(actor, conflictingClasses(actor));
  await addClass(actor, grant.kind, grant.class || DEFAULT_CLASS[grant.kind]);
  warnAbilities(actor);
}
