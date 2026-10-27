/**
 * "Companion" feat subtype and its Features-tab section, hidden on actors without one.
 * DESIGN.md §6.1
 *
 * PF1's own `hideEmpty` only applies to combat-tab sections; the Features tab hides empty
 * sections only under the user's "empty" filter, so the empty section and its filter chip are
 * removed at render instead.
 */

import { MODULE_ID, SUBTYPE } from "./constants.mjs";

const t = (key) => game.i18n.localize(key);

function register() {
  pf1.config.featTypes[SUBTYPE] = t("PF1COMP.Subtype.Single");
  pf1.config.featTypesPlurals[SUBTYPE] = t("PF1COMP.Subtype.Plural");
  pf1.config.sheetSections.features[SUBTYPE] = {
    label: t("PF1COMP.Subtype.Plural"),
    filters: [{ type: "feat", subTypes: [SUBTYPE] }],
    interface: { create: true, actions: true, types: true },
    browse: { category: "feats", featType: [SUBTYPE] },
    create: { type: "feat", system: { subType: SUBTYPE } },
    // After class features (1_000).
    sort: 1_500,
  };
}

function hideEmpty(sheet, html) {
  const actor = sheet.actor;
  if (!actor || actor.itemTypes?.feat?.some((i) => i.system.subType === SUBTYPE)) return;
  const root = html instanceof jQuery ? html[0] : html;
  const tab = root?.querySelector('.tab[data-tab="feats"]');
  if (!tab) return;
  tab.querySelector(`.item-list[data-list="${SUBTYPE}"]`)?.remove();
  tab.querySelector(`.filter-rule[data-filter="${SUBTYPE}"]`)?.remove();
}

export function registerHooks() {
  // Labels need translations, and PF1's setup loop must still see the section.
  Hooks.once("i18nInit", () => {
    try {
      register();
    } catch (err) {
      console.error(`${MODULE_ID} | companion subtype failed:`, err);
    }
  });
  Hooks.on("renderActorSheetPF", (sheet, html) => {
    try {
      hideEmpty(sheet, html);
    } catch (err) {
      console.error(`${MODULE_ID} | hiding empty companion section failed:`, err);
    }
  });
}
