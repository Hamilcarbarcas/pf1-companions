/**
 * Choose a companion for a granting feature. DESIGN.md §8.3
 *
 * Search and filters run on the rendered rows, so typing never re-renders the window.
 */

import { DEFAULT_CLASS, KIND_LABELS, MODULE_ID } from "../constants.mjs";
import { readGrant } from "../grants.mjs";
import { eligibility } from "../links.mjs";

const { ApplicationV2 } = foundry.applications.api;

const t = (key) => game.i18n.localize(key);
const esc = foundry.utils.escapeHTML;
const pickerId = (item) => `${MODULE_ID}-picker-${item.id}`;

/** Filter state kept for the session, shared by every picker. */
const filters = { search: "", type: "", folder: "", hideUnavailable: true };

/** Folder ids an actor sits in, its folder and every ancestor. */
function folderChain(actor) {
  const folder = actor.folder;
  if (!folder) return [];
  return [folder, ...folder.ancestors].map((f) => f.id);
}

class CompanionPicker extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["pfcomp-picker"],
    window: { title: "PF1COMP.Picker.Title", resizable: true },
    position: { width: 440, height: "auto" },
    actions: { pick: CompanionPicker.#onPick },
  };

  #resolve;
  #settled = false;

  /** @param {{ item: Item, resolve: (actor: Actor|null) => void }} opts */
  constructor({ item, resolve }) {
    super({ id: pickerId(item) });
    this.grantItem = item;
    this.#resolve = resolve;
  }

  get title() {
    const kind = t(KIND_LABELS[readGrant(this.grantItem)?.kind] ?? "PF1COMP.Kind.none");
    return `${t("PF1COMP.Picker.Title")}: ${kind} (${this.grantItem.parent?.name ?? ""})`;
  }

  #rows() {
    const user = game.user;
    const rows = [];
    for (const actor of game.actors) {
      if (!user.isGM && !actor.isOwner) continue;
      const check = eligibility(this.grantItem, actor);
      if (!check.listed) continue;
      rows.push({ actor, ...check });
    }
    rows.sort((a, b) => a.actor.name.localeCompare(b.actor.name));
    return rows;
  }

  #rowMarkup({ actor, disabled, current }) {
    const classes = ["pfcomp-picker-row"];
    if (disabled) classes.push("pfcomp-disabled");
    if (current) classes.push("pfcomp-current");
    const action = disabled ? "" : ` data-action="pick" data-uuid="${esc(actor.uuid)}"`;
    const note = disabled ?? (current ? t("PF1COMP.Picker.Current") : "");
    const data = [
      `data-name="${esc(actor.name.toLocaleLowerCase())}"`,
      `data-type="${esc(actor.type)}"`,
      `data-folders="${folderChain(actor).join(" ")}"`,
      disabled ? `data-unavailable="1"` : "",
    ].join(" ");
    return `
<li class="${classes.join(" ")}"${action} ${data}>
  <img src="${esc(actor.img)}" alt=""/>
  <span class="pfcomp-picker-name">${esc(actor.name)}</span>
  ${note ? `<span class="pfcomp-picker-note">${esc(note)}</span>` : ""}
</li>`;
  }

  /** Folders holding at least one listed actor, as indented options in sidebar order. */
  #folderOptions(rows) {
    const used = new Set(rows.flatMap((r) => folderChain(r.actor)));
    if (!used.size) return "";
    const options = [];
    // Tree nodes are { folder, children: [node], entries }.
    const walk = (nodes, depth) => {
      for (const node of nodes ?? []) {
        const folder = node.folder;
        if (!folder || !used.has(folder.id)) continue;
        const pad = "  ".repeat(depth);
        const sel = folder.id === filters.folder ? " selected" : "";
        options.push(`<option value="${folder.id}"${sel}>${pad}${esc(folder.name)}</option>`);
        walk(node.children, depth + 1);
      }
    };
    walk(game.actors.tree?.children, 0);
    return options.join("");
  }

  #toolbar(rows) {
    const types = ["character", "npc"].filter((type) => rows.some((r) => r.actor.type === type));
    const typeOptions = types
      .map((type) => {
        const sel = type === filters.type ? " selected" : "";
        return `<option value="${type}"${sel}>${esc(game.i18n.localize(CONFIG.Actor.typeLabels?.[type] ?? type))}</option>`;
      })
      .join("");
    const folders = this.#folderOptions(rows);

    return `
<div class="pfcomp-picker-toolbar">
  <input type="search" class="pfcomp-picker-search" placeholder="${t("PF1COMP.Picker.Search")}"
         value="${esc(filters.search)}" autocomplete="off"/>
  <div class="pfcomp-picker-filters">
    ${types.length > 1 ? `<select data-filter="type"><option value="">${t("PF1COMP.Picker.AllTypes")}</option>${typeOptions}</select>` : ""}
    ${folders ? `<select data-filter="folder"><option value="">${t("PF1COMP.Picker.AllFolders")}</option>${folders}</select>` : ""}
    <label class="checkbox"><input type="checkbox" data-filter="hideUnavailable"${filters.hideUnavailable ? " checked" : ""}/> ${t("PF1COMP.Picker.HideUnavailable")}</label>
  </div>
</div>`;
  }

  async _renderHTML() {
    const rows = this.#rows();
    if (!rows.length) return `<p class="pfcomp-picker-empty">${t("PF1COMP.Picker.Empty")}</p>`;

    const eligible = rows.filter((r) => r.group === "eligible");
    const other = rows.filter((r) => r.group === "other");
    const list = (items) => `<ol class="pfcomp-picker-list">${items.map((r) => this.#rowMarkup(r)).join("")}</ol>`;

    let html = this.#toolbar(rows);
    if (eligible.length) {
      html += `<section class="pfcomp-picker-group"><h4>${t("PF1COMP.Picker.Eligible")}</h4>${list(eligible)}</section>`;
    }
    if (other.length) {
      html += `<section class="pfcomp-picker-group"><h4>${t("PF1COMP.Picker.Other")}</h4>`;
      html += `<p class="pfcomp-picker-hint">${t("PF1COMP.Picker.OtherHint")}</p>${list(other)}</section>`;
    }
    html += `<p class="pfcomp-picker-empty pfcomp-picker-nomatch" hidden>${t("PF1COMP.Picker.NoMatch")}</p>`;
    return html;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    const search = root.querySelector(".pfcomp-picker-search");
    search?.addEventListener("input", () => {
      filters.search = search.value;
      this.#applyFilters();
    });
    for (const el of root.querySelectorAll("[data-filter]")) {
      el.addEventListener("change", () => {
        filters[el.dataset.filter] = el.type === "checkbox" ? el.checked : el.value;
        this.#applyFilters();
      });
    }
    this.#applyFilters();
    search?.focus();
  }

  #applyFilters() {
    const root = this.element;
    const needle = filters.search.trim().toLocaleLowerCase();
    let shown = 0;
    for (const group of root.querySelectorAll(".pfcomp-picker-group")) {
      let groupShown = 0;
      for (const row of group.querySelectorAll(".pfcomp-picker-row")) {
        const visible =
          (!needle || row.dataset.name.includes(needle)) &&
          (!filters.type || row.dataset.type === filters.type) &&
          (!filters.folder || row.dataset.folders.split(" ").includes(filters.folder)) &&
          !(filters.hideUnavailable && row.dataset.unavailable);
        row.hidden = !visible;
        if (visible) groupShown++;
      }
      group.hidden = groupShown === 0;
      shown += groupShown;
    }
    const noMatch = root.querySelector(".pfcomp-picker-nomatch");
    if (noMatch) noMatch.hidden = shown > 0;
  }

  static async #onPick(event, target) {
    const actor = fromUuidSync(target.dataset.uuid);
    if (!actor) return;
    const check = eligibility(this.grantItem, actor);
    if (check.group === "other") {
      // Linking adds the grant's class; say which, since a wrong pick gets it too.
      const grant = readGrant(this.grantItem);
      const uuid = grant?.class || DEFAULT_CLASS[grant?.kind];
      const cls = (uuid && fromUuidSync(uuid)?.name) || t(KIND_LABELS[grant?.kind] ?? "PF1COMP.Kind.none");
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: t("PF1COMP.Picker.ConfirmTitle") },
        content: `<p>${game.i18n.format("PF1COMP.Picker.ConfirmOther", { name: esc(actor.name), class: esc(cls) })}</p>`,
      });
      if (!ok) return;
    }
    this.#finish(actor);
    this.close();
  }

  #finish(actor) {
    if (this.#settled) return;
    this.#settled = true;
    this.#resolve(actor);
  }

  async close(options) {
    this.#finish(null);
    return super.close(options);
  }
}

/** Open the picker for a feature. Resolves the chosen actor, or null. */
export function pickCompanion(item) {
  const open = foundry.applications.instances.get(pickerId(item));
  if (open) {
    open.bringToFront();
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    new CompanionPicker({ item, resolve }).render(true);
  });
}
