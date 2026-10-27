/**
 * Companions list on a master's Features tab, one row per granting feature. DESIGN.md §8.2
 */

import { KIND_LABELS, MODULE_ID } from "../constants.mjs";
import { grantItems, isWorldActor, readGrant } from "../grants.mjs";
import { cannotPick, companionLevel, getCompanionLinks, link, unlink } from "../links.mjs";
import { pickCompanion } from "./picker.mjs";
import { setAway } from "../master-items.mjs";

const MARKER = "pfcomp-companions";

const t = (key) => game.i18n.localize(key);
const esc = foundry.utils.escapeHTML;

function hpText(actor) {
  const hp = actor.system?.attributes?.hp;
  return hp ? `${hp.value} / ${hp.max}` : "–";
}

function rowMarkup(actor, item, companion, owner) {
  const kind = t(KIND_LABELS[readGrant(item).kind]);
  const feature = `<a class="${MARKER}-feature" data-item-id="${item.id}">${esc(item.name)}</a>`;

  if (!companion) {
    const choose =
      owner && !cannotPick(item)
        ? `<a class="${MARKER}-control" data-pfcomp="choose" data-item-id="${item.id}" data-tooltip="PF1COMP.Grant.Choose">
             <i class="fa-solid fa-hand-pointer"></i></a>`
        : "";
    return `
<li class="${MARKER}-row flexrow" data-item-id="${item.id}">
  <div class="${MARKER}-name"><span class="${MARKER}-empty">${t("PF1COMP.Grant.None")}</span></div>
  <div class="${MARKER}-detail">${feature} · ${kind}</div>
  <div class="${MARKER}-detail ${MARKER}-level"></div>
  <div class="${MARKER}-detail ${MARKER}-hp"></div>
  <div class="${MARKER}-controls">${choose}</div>
</li>`;
  }

  const level = companionLevel(companion)?.level ?? 0;
  const grant = readGrant(item);
  const away =
    owner && grant.kind === "familiar"
      ? `<a class="${MARKER}-control" data-pfcomp="away" data-item-id="${item.id}"
           data-tooltip="${grant.away ? "PF1COMP.Master.MarkBack" : "PF1COMP.Master.MarkAway"}">
           <i class="fa-solid ${grant.away ? "fa-eye-slash" : "fa-eye"}"></i></a>`
      : "";
  const release = owner
    ? `<a class="${MARKER}-control" data-pfcomp="release" data-item-id="${item.id}" data-tooltip="PF1COMP.Master.Release">
         <i class="fa-solid fa-link-slash"></i></a>`
    : "";
  return `
<li class="${MARKER}-row flexrow" data-item-id="${item.id}">
  <div class="${MARKER}-name">
    <a class="${MARKER}-open" data-uuid="${esc(companion.uuid)}">
      <img src="${esc(companion.img)}" alt=""/> ${esc(companion.name)}
    </a>
  </div>
  <div class="${MARKER}-detail">${feature} · ${kind}</div>
  <div class="${MARKER}-detail ${MARKER}-level" data-tooltip="PF1COMP.Master.LevelTip">${level}</div>
  <div class="${MARKER}-detail ${MARKER}-hp" data-tooltip="PF1.HitPoints">${hpText(companion)}</div>
  <div class="${MARKER}-controls">
    <a class="${MARKER}-control" data-pfcomp="pan" data-uuid="${esc(companion.uuid)}" data-tooltip="PF1COMP.Master.Pan">
      <i class="fa-solid fa-crosshairs"></i></a>
    ${away}
    ${release}
  </div>
</li>`;
}

function markup(actor, rows) {
  return `
<ol class="item-list ${MARKER}">
  <li class="item-list-header flexrow">
    <div class="item-name"><h3>${t("PF1COMP.Master.Title")}</h3></div>
    <div class="${MARKER}-detail">${t("PF1COMP.Master.Feature")}</div>
    <div class="${MARKER}-detail ${MARKER}-level">${t("PF1COMP.Master.Level")}</div>
    <div class="${MARKER}-detail ${MARKER}-hp">${t("PF1COMP.Master.HP")}</div>
    <div class="${MARKER}-controls"></div>
  </li>
  ${rows.join("")}
</ol>`;
}

function pan(companion) {
  const token = companion.getActiveTokens(true, false)[0];
  if (!token) return void ui.notifications.warn(game.i18n.format("PF1COMP.Warn.NotOnScene", { name: companion.name }));
  canvas.animatePan({ x: token.center.x, y: token.center.y });
  if (token.isOwner) token.control({ releaseOthers: true });
}

function bind(section, actor) {
  section.addEventListener("click", async (event) => {
    const el = event.target.closest(`[data-pfcomp], .${MARKER}-open, .${MARKER}-feature`);
    if (!el || !section.contains(el)) return;
    event.preventDefault();
    event.stopPropagation();

    const item = el.dataset.itemId ? actor.items.get(el.dataset.itemId) : null;
    try {
      if (el.classList.contains(`${MARKER}-open`)) return void fromUuidSync(el.dataset.uuid)?.sheet?.render(true, { focus: true });
      if (el.classList.contains(`${MARKER}-feature`)) return void item?.sheet?.render(true, { focus: true });
      switch (el.dataset.pfcomp) {
        case "choose": {
          const picked = item ? await pickCompanion(item) : null;
          if (picked) await link(item, picked);
          break;
        }
        case "release":
          if (item) await unlink(item);
          break;
        case "away":
          if (item) await setAway(item, !readGrant(item)?.away);
          break;
        case "pan": {
          const companion = fromUuidSync(el.dataset.uuid);
          if (companion) pan(companion);
          break;
        }
      }
    } catch (err) {
      console.error(`${MODULE_ID} | companions section action failed:`, err);
    }
  });
}

/** renderActorSheetPF handler. Shows only on actors with a granting feature. */
export function inject(sheet, html) {
  const actor = sheet.actor;
  if (!isWorldActor(actor)) return;
  const items = grantItems(actor);
  if (!items.length) return;

  const root = html instanceof jQuery ? html[0] : html;
  const groups = root?.querySelector('.tab[data-tab="feats"] .item-groups-list');
  if (!groups || groups.querySelector(`.${MARKER}`)) return;

  const linked = new Map(getCompanionLinks(actor).map((l) => [l.item.id, l.companion]));
  const owner = actor.isOwner;
  const rows = items.map((item) => rowMarkup(actor, item, linked.get(item.id) ?? null, owner));

  const holder = document.createElement("div");
  holder.innerHTML = markup(actor, rows);
  const section = holder.firstElementChild;
  groups.prepend(section);
  bind(section, actor);
}

export function registerHooks() {
  Hooks.on("renderActorSheetPF", (sheet, html) => {
    try {
      inject(sheet, html);
    } catch (err) {
      console.error(`${MODULE_ID} | companions section failed:`, err);
    }
  });
}
