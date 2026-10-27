/**
 * "Companion of <master>" line at the top of a companion's Summary tab. DESIGN.md §8.4
 *
 * Read from the mirror flag so it renders before the index exists; the level only once it does.
 */

import { KIND_LABELS, MIRROR_FLAG, MODULE_ID } from "../constants.mjs";
import { companionLevel, isBuilt } from "../links.mjs";

const MARKER = "pfcomp-companion-of";

const t = (key) => game.i18n.localize(key);
const esc = foundry.utils.escapeHTML;

export function inject(sheet, html) {
  const actor = sheet.actor;
  const mirror = actor?.getFlag(MODULE_ID, MIRROR_FLAG);
  if (!mirror?.actor) return;

  const root = html instanceof jQuery ? html[0] : html;
  const tab = root?.querySelector('.tab[data-tab="summary"]');
  if (!tab || tab.querySelector(`.${MARKER}`)) return;

  const master = fromUuidSync(mirror.actor);
  const info = isBuilt() ? companionLevel(actor) : null;
  const parts = [
    master
      ? `<a class="${MARKER}-master" data-uuid="${esc(master.uuid)}">${esc(master.name)}</a>`
      : esc(t("PF1COMP.Grant.Missing")),
    esc(t(KIND_LABELS[mirror.kind] ?? "PF1COMP.Kind.none")),
  ];
  if (info) parts.push(game.i18n.format("PF1COMP.Line.Level", { level: info.level }));

  const div = document.createElement("div");
  div.className = MARKER;
  div.innerHTML = `<i class="fa-solid fa-paw"></i> ${t("PF1COMP.Line.CompanionOf")} ${parts.join(" · ")}`;
  tab.prepend(div);

  div.querySelector(`.${MARKER}-master`)?.addEventListener("click", (event) => {
    event.preventDefault();
    fromUuidSync(event.currentTarget.dataset.uuid)?.sheet?.render(true, { focus: true });
  });
}

export function registerHooks() {
  Hooks.on("renderActorSheetPF", (sheet, html) => {
    try {
      inject(sheet, html);
    } catch (err) {
      console.error(`${MODULE_ID} | companion line failed:`, err);
    }
  });
}
