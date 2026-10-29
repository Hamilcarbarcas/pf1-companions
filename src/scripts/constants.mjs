export const MODULE_ID = "pf1-companions";

/** Grant config and link on a master's feature: flags[MODULE_ID][GRANT_FLAG]. DESIGN.md §4.1, §4.2 */
export const GRANT_FLAG = "grant";

/** Back-pointer on a companion: flags[MODULE_ID][MIRROR_FLAG]. DESIGN.md §4.1 */
export const MIRROR_FLAG = "master";

/** Kind marker on a companion class item: flags[MODULE_ID][CLASS_FLAG]. DESIGN.md §6 */
export const CLASS_FLAG = "kind";

export const KINDS = Object.freeze(["animalCompanion", "familiar"]);

export const KIND_LABELS = Object.freeze({
  animalCompanion: "PF1COMP.Kind.animalCompanion",
  familiar: "PF1COMP.Kind.familiar",
});

/** Actor types that can be masters or companions. */
export const ACTOR_TYPES = Object.freeze(["character", "npc"]);

/** Feat subtype for companion-side features. DESIGN.md §6.1 */
export const SUBTYPE = "companion";

const PACK = "Compendium.pf1-companions.companion-features.Item";

/** Companion class a grant adds when it names none. DESIGN.md §4.2 */
export const DEFAULT_CLASS = Object.freeze({
  animalCompanion: `${PACK}.pfcAnimalCompCls`,
  familiar: `${PACK}.pfcFamiliarClass`,
});

/** Master-side item templates. DESIGN.md §7.2 */
export const TEMPLATES = Object.freeze({
  bonus: `${PACK}.pfcFamiliarBonus`,
  alertness: `${PACK}.pfcAlertnessFam0`,
  command: `${PACK}.pfcCommandCompan`,
});

/** Animal Companion's Link feature: its handling rules apply to the master. DESIGN.md §16 */
export const LINK_SOURCE = `${PACK}.pfcLinkAnimComp0`;

/** On a familiar's race supplement: the bonus its master gets. DESIGN.md §7.2 */
export const MASTER_BONUS_FLAG = "masterBonus";

/** On a master-side item the mod made: { role, familiar, grant }. DESIGN.md §7.2 */
export const MASTER_ITEM_FLAG = "masterItem";

/** On a feature that changes creature type: { add, remove }. DESIGN.md §5.6 */
export const CREATURE_TYPE_FLAG = "creatureType";

/** Kinds whose class HP is written as the average per HD. DESIGN.md §5.1 */
export const AVERAGE_HP_KINDS = Object.freeze(["animalCompanion"]);
