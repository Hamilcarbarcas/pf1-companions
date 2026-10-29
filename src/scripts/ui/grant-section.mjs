/**
 * Companion Grant section on a feat's Advanced tab: kind, effective-level formula, and the
 * choose control. DESIGN.md §4.2, §8.2
 */

import { DEFAULT_CLASS, GRANT_FLAG, KINDS, KIND_LABELS, MODULE_ID } from "../constants.mjs";
import { isWorldActor, readGrant } from "../grants.mjs";
import { getLinks, link, unlink } from "../links.mjs";
import { pickCompanion } from "./picker.mjs";
import { makeCollapsible, setBadge } from "../../common/sheet/collapse.mjs";
import { attachFormulaPreview } from "../../common/sheet/formula-preview.mjs";
import { bindFields } from "../../common/sheet/field-bind.mjs";

const MARKER = "pfcomp-grant";
const ICON = "fa-solid fa-paw";

const t = (key) => game.i18n.localize(key);
const esc = foundry.utils.escapeHTML;

/** The linked companion when the index confirms the link; `missing` when the flag is stale. */
function linkState(item) {
  const grant = readGrant(item);
  if (!grant?.companion) return { companion: null, missing: false };
  const companion = fromUuidSync(grant.companion);
  const confirmed = companion instanceof Actor && getLinks(companion).some((l) => l.item === item);
  return confirmed ? { companion, missing: false } : { companion: null, missing: true };
}

function companionRow(item) {
  const { companion, missing } = linkState(item);
  let current;
  if (companion) {
    current = `<a class="${MARKER}-open" data-uuid="${esc(companion.uuid)}">
      <img src="${esc(companion.img)}" alt=""/> ${esc(companion.name)}</a>`;
  } else {
    current = `<span class="${MARKER}-none">${t(missing ? "PF1COMP.Grant.Missing" : "PF1COMP.Grant.None")}</span>`;
  }
  const clear =
    companion || missing
      ? `<button type="button" data-pfcomp="clear"><i class="fa-solid fa-link-slash"></i> ${t("PF1COMP.Grant.Clear")}</button>`
      : "";

  return `
<div class="form-group ${MARKER}-companion">
  <label>${t("PF1COMP.Grant.Companion")}</label>
  <div class="form-fields">
    ${current}
    <button type="button" data-pfcomp="choose"><i class="fa-solid fa-hand-pointer"></i> ${t("PF1COMP.Grant.Choose")}</button>
    ${clear}
  </div>
</div>
<p class="notes">${t("PF1COMP.Grant.CompanionHint")}</p>`;
}

/** Companion class row: the grant's own class, else the kind's default. §4.2 */
function classRow(grant) {
  const custom = grant?.class ? fromUuidSync(grant.class) : null;
  const fallback = DEFAULT_CLASS[grant?.kind] ? fromUuidSync(DEFAULT_CLASS[grant.kind]) : null;
  let current;
  if (custom) current = `<a class="${MARKER}-class" data-uuid="${esc(grant.class)}">${esc(custom.name)}</a>`;
  else if (grant?.class) current = `<span class="${MARKER}-none">${t("PF1COMP.Grant.Missing")}</span>`;
  else if (fallback) {
    current = `<a class="${MARKER}-class" data-uuid="${esc(DEFAULT_CLASS[grant.kind])}">${esc(fallback.name)}</a>
      <span class="${MARKER}-none">${t("PF1COMP.Grant.Default")}</span>`;
  } else current = `<span class="${MARKER}-none">${t("PF1COMP.Grant.None")}</span>`;
  const clear = grant?.class
    ? `<button type="button" data-pfcomp="clear-class"><i class="fa-solid fa-xmark"></i></button>`
    : "";
  return `
<div class="form-group ${MARKER}-classrow">
  <label>${t("PF1COMP.Grant.Class")}</label>
  <div class="form-fields">${current}${clear}</div>
</div>
<p class="notes">${t("PF1COMP.Grant.ClassHint")}</p>`;
}

function markup(item, grant) {
  const kind = grant?.kind ?? "";
  const options = [`<option value="">${t("PF1COMP.Kind.none")}</option>`]
    .concat(KINDS.map((k) => `<option value="${k}"${k === kind ? " selected" : ""}>${t(KIND_LABELS[k])}</option>`))
    .join("");
  const onActor = isWorldActor(item.parent) && !!kind;

  return `
<div class="${MARKER}">
  <h3 class="form-header ${MARKER}-header">
    <i class="${ICON}"></i> ${t("PF1COMP.Grant.Title")}
  </h3>
  <div class="${MARKER}-body">
    <div class="form-group">
      <label>${t("PF1COMP.Grant.Kind")}</label>
      <div class="form-fields"><select data-field="kind">${options}</select></div>
    </div>
    <div class="form-group">
      <label>${t("PF1COMP.Grant.Level")}</label>
      <div class="form-fields">
        <input type="text" data-field="level" placeholder="@classes.druid.level"/>
        <span class="pfcomp-preview"></span>
      </div>
    </div>
    <p class="notes">${t("PF1COMP.Grant.LevelHint")}</p>
    ${kind ? classRow(grant) : ""}
    ${onActor ? companionRow(item) : ""}
  </div>
</div>`;
}

function badgeText(item) {
  const grant = readGrant(item);
  if (!grant) return "";
  return linkState(item).companion?.name ?? t(KIND_LABELS[grant.kind]);
}

async function choose(item) {
  const actor = await pickCompanion(item);
  if (actor) await link(item, actor);
}

async function onDrop(event, item) {
  const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
  if (data?.type !== "Actor") return;
  event.preventDefault();
  event.stopPropagation();
  const actor = await fromUuid(data.uuid);
  if (actor) await link(item, actor);
}

/** A class item dropped on the class row becomes the grant's companion class. */
async function onClassDrop(event, item) {
  const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
  if (data?.type !== "Item") return;
  event.preventDefault();
  event.stopPropagation();
  const cls = await fromUuid(data.uuid);
  if (cls?.type !== "class") return void ui.notifications.warn(t("PF1COMP.Warn.NotClass"));
  await item.update({ [`flags.${MODULE_ID}.${GRANT_FLAG}.class`]: cls.uuid });
}

/** renderItemSheetPF handler. */
export async function inject(sheet, html, options) {
  const root = html instanceof jQuery ? html[0] : html;
  const item = sheet.document;
  if (item?.type !== "feat" || !options?.editable) return;

  const tab = root?.querySelector('.tab[data-tab="advanced"]');
  if (!tab || tab.querySelector(`.${MARKER}`)) return;

  const stored = item.flags?.[MODULE_ID]?.[GRANT_FLAG] ?? {};
  const grant = readGrant(item);

  const holder = document.createElement("div");
  holder.innerHTML = markup(item, grant);
  const section = holder.firstElementChild;
  tab.append(section);

  const levelInput = section.querySelector('[data-field="level"]');
  const refreshPreview = attachFormulaPreview(levelInput, item.getRollData());

  bindFields(section, {
    doc: item,
    base: `flags.${MODULE_ID}.${GRANT_FLAG}`,
    values: { kind: stored.kind ?? "", level: stored.level ?? "" },
    fields: {
      // The companion row depends on the kind and an actor; a re-render shows or hides it.
      kind: { type: "text", onChange: () => sheet.render(false) },
      level: { type: "text", onChange: () => refreshPreview?.() },
    },
  });

  section.querySelector('[data-pfcomp="choose"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    choose(item).catch((err) => console.error(`${MODULE_ID} | choose failed:`, err));
  });
  section.querySelector('[data-pfcomp="clear"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    unlink(item).catch((err) => console.error(`${MODULE_ID} | clear failed:`, err));
  });
  for (const a of section.querySelectorAll(`.${MARKER}-open, .${MARKER}-class`)) {
    a.addEventListener("click", async (event) => {
      event.preventDefault();
      (await fromUuid(event.currentTarget.dataset.uuid))?.sheet?.render(true, { focus: true });
    });
  }
  section.querySelector('[data-pfcomp="clear-class"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    item.update({ [`flags.${MODULE_ID}.${GRANT_FLAG}.-=class`]: null });
  });
  const classRowEl = section.querySelector(`.${MARKER}-classrow`);
  if (classRowEl) {
    classRowEl.addEventListener("dragover", (event) => event.preventDefault());
    classRowEl.addEventListener("drop", (event) =>
      onClassDrop(event, item).catch((err) => console.error(`${MODULE_ID} | class drop failed:`, err))
    );
  }

  const dropZone = section.querySelector(`.${MARKER}-companion`);
  if (dropZone) {
    dropZone.addEventListener("dragover", (event) => event.preventDefault());
    dropZone.addEventListener("drop", (event) =>
      onDrop(event, item).catch((err) => console.error(`${MODULE_ID} | drop failed:`, err))
    );
  }

  makeCollapsible(sheet, section, {
    key: "grant",
    marker: MARKER,
    configured: !!grant,
    badge: "",
    title: t("PF1COMP.Grant.Toggle"),
    niche: true,
  });
  setBadge(section, badgeText(item));
}

export function registerHooks() {
  Hooks.on("renderItemSheetPF", (sheet, html, options) => {
    inject(sheet, html, options).catch((err) => console.error(`${MODULE_ID} | grant section failed:`, err));
  });
}
