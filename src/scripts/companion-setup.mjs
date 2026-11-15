/**
 * Readies an actor as a companion when it is linked. DESIGN.md §8.1
 *
 * Adds the grant's companion class if missing, offers to remove classes whose HD would
 * double-count, blanks the scores a species has none of (§17.3), and warns when a species race
 * expects base-10 scores that aren't there.
 */

import { CLASS_FLAG, DEFAULT_CLASS, MODULE_ID, NO_LEVEL_FEATS_FLAG, NO_LEVEL_SKILLS_FLAG, SPECIES_FLAG } from "./constants.mjs";
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

/** Scores the species has none of, such as an incorporeal undead's Str and Con. §17.3 */
const noAbilities = (race) => (race?.flags?.[MODULE_ID]?.[SPECIES_FLAG]?.noAbilities ?? []).filter((a) => ABILITIES.includes(a));

/** Blank those scores on the actor (PF1 reads a null score as "none"). */
async function clearAbilities(actor) {
  const update = {};
  for (const a of noAbilities(actor.race)) {
    if (actor.system.abilities?.[a]?.value !== null) update[`system.abilities.${a}.value`] = null;
  }
  if (Object.keys(update).length) await actor.update(update);
}

/** Species races carry ability offsets from 10 (§6); other scores would double them. */
function warnAbilities(actor) {
  const race = actor.race;
  const offsets = (race?.system?.changes ?? []).some((c) => ABILITIES.includes(c.target));
  if (!offsets) return;
  const none = noAbilities(race);
  const off = ABILITIES.filter((a) => !none.includes(a) && actor.system.abilities?.[a]?.value !== 10);
  if (off.length) ui.notifications.warn(game.i18n.format("PF1COMP.Setup.AbilitiesNot10", { name: actor.name }));
}

const LH_ID = "koboldworks-pf1-little-helper";

/**
 * Little Helper's new-actor guide reads a companion's base-10 scores and empty inventory as an
 * unfinished build. Ticks the guide's per-actor "ready" override, unless someone set it by hand.
 */
async function markGuideReady(actor) {
  if (!game.modules.get(LH_ID)?.active) return;
  if (actor.getFlag(LH_ID, "overrides")?.ready !== undefined) return;
  await actor.setFlag(LH_ID, "overrides.ready", true);
}

const LEVEL_GRANT_FLAGS = [NO_LEVEL_FEATS_FLAG, NO_LEVEL_SKILLS_FLAG];

/**
 * A companion class copied before its compendium class got No Feats / No Skill Ranks from Levels
 * takes them now. Only flags the actor's class has no value for, so a box unticked by hand stays
 * unticked. §18
 */
async function adoptLevelGrantFlags(actor, sources) {
  for (const cls of actor.itemTypes.class) {
    if (!classKind(cls)) continue;
    const own = cls.flags?.[MODULE_ID] ?? {};
    const unset = LEVEL_GRANT_FLAGS.filter((f) => own[f] === undefined);
    if (!unset.length) continue;
    const uuid = cls._stats?.compendiumSource;
    if (!uuid?.startsWith("Compendium.")) continue;
    if (!sources.has(uuid)) sources.set(uuid, (await fromUuid(uuid))?.flags?.[MODULE_ID] ?? {});
    const update = {};
    for (const f of unset) if (sources.get(uuid)[f]) update[`flags.${MODULE_ID}.${f}`] = true;
    if (Object.keys(update).length) await cls.update(update);
  }
}

/** Load-time upkeep for a linked companion (active GM). `sources` caches compendium lookups across actors. */
export async function upkeepCompanion(actor, sources = new Map()) {
  await markGuideReady(actor);
  await adoptLevelGrantFlags(actor, sources);
}

/** Run after the link is written. */
export async function prepareCompanion(actor, grant) {
  await offerRemoval(actor, conflictingClasses(actor));
  const uuid = grant.class || DEFAULT_CLASS[grant.kind];
  // `other` has no default class: the grant has to name one.
  if (!uuid) ui.notifications.warn(t("PF1COMP.Setup.NoClass"));
  await addClass(actor, grant.kind, uuid);
  await clearAbilities(actor);
  warnAbilities(actor);
  await upkeepCompanion(actor);
}
