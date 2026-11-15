/**
 * Classes whose levels grant no feats or no skill ranks: familiars, the Living Shadow. DESIGN.md §18
 *
 * Feats: PF1 allows ceil(HD / 2). A class flagged `noLevelFeats` takes its hit dice out of that
 * count. The feats the class grants by level need nothing here: pf1-enhanced-links already adds
 * one bonus feat per class-association feat (Child Items). Wraps ActorPF#getFeatCount, which the
 * actor sheet, the level-up dialog, and Little Helper's warnings all read.
 *
 * Skill ranks: PF1 allows max(1, skills per level + Int) per HD even at 0 per level, plus
 * background ranks for base and prestige classes. Companion classes are typed base but aren't PC
 * classes, so none of them adds background ranks (§18.3); a class flagged `noLevelSkills` adds no
 * adventure ranks either. Wraps ActorSheetPF#_prepareSkills, whose numbers the Skills tab and
 * Little Helper's skill mismatch read. The skill-rank tooltip still lists the class (its total is
 * PF1's own).
 */

import { CLASS_FLAG, MODULE_ID, NO_LEVEL_FEATS_FLAG, NO_LEVEL_SKILLS_FLAG } from "./constants.mjs";
import { classKind } from "./grants.mjs";

const LOG = `${MODULE_ID} | level-grants:`;
const MARKER = "pfc-level-grants";

const flagged = (cls, flag) => !!cls?.flags?.[MODULE_ID]?.[flag];
const flaggedClasses = (actor, flag) =>
  (actor.itemTypes?.class ?? []).filter((c) => c.system?.subType !== "mythic" && flagged(c, flag));

/* -------------------------------------------- */
/*  Feats                                       */
/* -------------------------------------------- */

/**
 * Adjusts PF1's feat count in place for flagged classes.
 * @param {Actor} actor
 * @param {object} result  getFeatCount()'s result; its missing/excess getters read `max`.
 * @returns {object} result
 */
export function adjustFeatCount(actor, result) {
  const classes = flaggedClasses(actor, NO_LEVEL_FEATS_FLAG);
  // PF1 leaves levels at 0 for mindless actors; nothing to take out then.
  if (!classes.length || result.levels <= 0) return result;
  const exempt = classes.reduce((n, c) => n + (c.hitDice ?? 0), 0);
  const total = actor.system?.attributes?.hd?.total ?? 0;
  const levels = Math.ceil(Math.max(0, total - exempt) / 2);
  result.max += levels - result.levels;
  result.levels = levels;
  return result;
}

/* -------------------------------------------- */
/*  Skill ranks                                 */
/* -------------------------------------------- */

/** PF1's ranks per Hit Die for a class: at least 1, whatever the class and Int. */
const pf1PerLevel = (perLevel, intMod) => Math.max(1, perLevel + intMod);

/**
 * Adjusts the sheet's skill rank counts in place for flagged classes.
 * @param {Actor} actor
 * @param {object} ranks  { allowed, used, bgAllowed, bgUsed, sentToBG } from _prepareSkills.
 * @param {object} cfg    { useBG, bgClasses, bgPerLevel, perLevel(skillsPerLevel, intMod) }
 * @returns {object} ranks
 */
export function adjustSkillRanks(actor, ranks, { useBG, bgClasses, bgPerLevel, perLevel = pf1PerLevel }) {
  const classes = (actor.itemTypes?.class ?? []).filter(
    (c) => c.system?.subType !== "mythic" && (flagged(c, NO_LEVEL_SKILLS_FLAG) || (useBG && classKind(c)))
  );
  const int = actor.system?.abilities?.int;
  // Mindless actors get nothing from classes in PF1's count already.
  if (!classes.length || int?.value === null) return ranks;
  const intMod = int?.mod ?? 0;

  // Undo PF1's adventure-to-background transfer; redone below on the adjusted numbers.
  ranks.allowed += ranks.sentToBG;
  ranks.bgAllowed -= ranks.sentToBG;
  ranks.sentToBG = 0;

  for (const cls of classes) {
    const hd = cls.hitDice ?? 0;
    if (!hd) continue;
    if (flagged(cls, NO_LEVEL_SKILLS_FLAG)) ranks.allowed -= perLevel(cls.system?.skillsPerLevel || 0, intMod) * hd;
    if (useBG && bgClasses.includes(cls.subType)) ranks.bgAllowed -= hd * bgPerLevel;
  }

  if (useBG && ranks.bgUsed > ranks.bgAllowed) {
    ranks.sentToBG = ranks.bgUsed - ranks.bgAllowed;
    ranks.allowed -= ranks.sentToBG;
    ranks.bgAllowed += ranks.sentToBG;
  }
  return ranks;
}

/* -------------------------------------------- */
/*  Class sheet checkboxes                      */
/* -------------------------------------------- */

const ROWS = [
  { flag: NO_LEVEL_FEATS_FLAG, label: "No Feats from Levels", hint: "Levels in this class grant no feats. Feats the class itself grants stay free." },
  { flag: NO_LEVEL_SKILLS_FLAG, label: "No Skill Ranks from Levels", hint: "Levels in this class grant no skill ranks." },
];

function drawCheckboxes(app, root) {
  const cls = app.item;
  if (cls.system?.subType === "mythic") return;
  // Only companion classes, or one already flagged by hand.
  if (!cls.flags?.[MODULE_ID]?.[CLASS_FLAG] && !ROWS.some((r) => flagged(cls, r.flag))) return;
  const anchor = root.querySelector('input[name="system.customHD"]')?.closest(".form-group");
  if (!anchor || anchor.parentElement.querySelector(`.${MARKER}`)) return;

  // Inserted in reverse so they read in ROWS order after the anchor.
  for (const { flag, label, hint } of [...ROWS].reverse()) {
    const group = document.createElement("div");
    group.className = `form-group ${MARKER}`;
    group.dataset.tooltip = hint;
    // No `name`: kept out of the sheet's form submit.
    group.innerHTML = `
      <label>${label}</label>
      <div class="form-fields">
        <input type="checkbox"${flagged(cls, flag) ? " checked" : ""}${app.isEditable ? "" : " disabled"}>
      </div>`;
    group.querySelector("input").addEventListener("change", (ev) => {
      ev.stopPropagation();
      cls.setFlag(MODULE_ID, flag, ev.currentTarget.checked).catch((err) => console.error(LOG, `saving ${flag} failed`, err));
    });
    anchor.after(group);
  }
}

export function registerHooks() {
  libWrapper.register(
    MODULE_ID,
    "pf1.documents.actor.ActorPF.prototype.getFeatCount",
    function (wrapped, ...args) {
      const result = wrapped(...args);
      try {
        adjustFeatCount(this, result);
      } catch (err) {
        console.error(LOG, `adjusting the feat count failed for ${this?.name}`, err);
      }
      return result;
    },
    "WRAPPER",
  );

  libWrapper.register(
    MODULE_ID,
    "pf1.applications.actor.ActorSheetPF.prototype._prepareSkills",
    function (wrapped, context, ...args) {
      const result = wrapped(context, ...args);
      try {
        if (context?.skillRanks) {
          adjustSkillRanks(this.actor, context.skillRanks, {
            useBG: !!context.useBGSkills,
            bgClasses: pf1.config.backgroundSkillClasses,
            bgPerLevel: pf1.config.backgroundSkillsPerLevel,
            // astora-mod's house rule (no 1-rank minimum for 0-rank classes) has already
            // shaped the budget, so the class's share is taken off by the same rule.
            perLevel: game.modules.get("astora-mod")?.api?.skillRanks?.perLevel ?? pf1PerLevel,
          });
        }
      } catch (err) {
        console.error(LOG, `adjusting skill ranks failed for ${this?.actor?.name}`, err);
      }
      return result;
    },
    "WRAPPER",
  );

  Hooks.on("renderItemSheetPF", (app, html) => {
    if (app.item?.type !== "class") return;
    try {
      drawCheckboxes(app, html?.[0] ?? html);
    } catch (err) {
      console.error(LOG, "class sheet checkboxes failed", err);
    }
  });
}
