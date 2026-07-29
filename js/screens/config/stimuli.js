import Catalog from '../../core/catalog.js';
import Toast from '../../core/toast.js';
import ConfirmDialog from '../../core/confirmDialog.js';
import { escapeHtml, qs, qsa } from '../../core/dom.js';
import { parseTagsInput, renderTagChips, matchesSearch } from '../../core/tags.js';

let editingId = null;
let filterAreaId = '';
let searchText = '';

function areaNamesFor(stimulus, areaById) {
  const names = (stimulus.areaIds || []).map((id) => areaById.get(id)?.label).filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

function row(stimulus, areaById) {
  return `
    <tr>
      <td>${escapeHtml(stimulus.label)}</td>
      <td>${escapeHtml(areaNamesFor(stimulus, areaById))}</td>
      <td>${renderTagChips(stimulus.tags)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${stimulus.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete="${stimulus.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
}

function areaOptions(areas, selectedId) {
  return areas.map((a) => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${escapeHtml(a.label)}</option>`).join('');
}

function areaCheckboxes(areas, selectedIds) {
  return areas
    .map((a) => `
      <label style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;text-transform:none;letter-spacing:normal;padding:5px 0;">
        <input type="checkbox" value="${a.id}" data-stimulus-area-checkbox ${selectedIds.includes(a.id) ? 'checked' : ''}> ${escapeHtml(a.label)}
      </label>`)
    .join('');
}

function formHtml(stimulus, areas) {
  const selectedIds = stimulus?.areaIds || [];
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><h3>${stimulus ? 'Editar estímulo' : 'Novo estímulo'}</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="field-group" style="margin-bottom:12px;">
          <label>Nome *</label>
          <input class="search-input" id="stimulus-label" style="width:100%;padding:0 13px;" value="${escapeHtml(stimulus?.label || '')}">
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Áreas * (selecione uma ou mais)</label>
          <div style="border:1.5px solid var(--border);border-radius:10px;padding:6px 13px;max-height:180px;overflow-y:auto;background:var(--panel-soft);">
            ${areaCheckboxes(areas, selectedIds)}
          </div>
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Tags (separadas por vírgula)</label>
          <input class="search-input" id="stimulus-tags" style="width:100%;padding:0 13px;" placeholder="Ex.: TEA, TDAH" value="${escapeHtml((stimulus?.tags || []).join(', '))}">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-ghost btn-sm" type="button" id="stimulus-cancel">Cancelar</button>
          <button class="btn btn-primary btn-sm" type="button" id="stimulus-save">Salvar</button>
        </div>
      </div>
    </div>`;
}

export async function render(container) {
  const [allStimuli, allAreas] = await Promise.all([Catalog.listStimuli(), Catalog.listAreas()]);
  const areaById = new Map(allAreas.map((a) => [a.id, a]));
  const editingStimulus = editingId && editingId !== 'new' ? allStimuli.find((s) => s.id === editingId) : null;

  const filtered = allStimuli
    .filter((s) => !filterAreaId || (s.areaIds || []).includes(filterAreaId))
    .filter((s) => matchesSearch(s, searchText, [s.label]));

  container.innerHTML = `
    ${editingId !== null ? formHtml(editingStimulus, allAreas) : ''}
    <div class="panel">
      <div class="panel-header">
        <h3>Estímulos</h3>
        ${editingId === null ? '<button class="btn btn-primary btn-sm" type="button" id="stimulus-new"><i class="fa-solid fa-plus"></i> Novo estímulo</button>' : ''}
      </div>
      <div class="panel-body" style="padding-top:14px;">
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;">
          <div class="search-wrap" style="max-width:320px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input class="search-input" id="stimulus-search" placeholder="Buscar por nome ou tag..." value="${escapeHtml(searchText)}">
          </div>
          <div class="field-group" style="max-width:280px;">
            <label>Filtrar por área</label>
            <select class="select-input" id="stimulus-filter-area" style="width:100%;">
              <option value="">Todas as áreas</option>
              ${areaOptions(allAreas, filterAreaId)}
            </select>
          </div>
        </div>
        <table>
          <thead><tr><th>Nome</th><th>Áreas</th><th>Tags</th><th></th></tr></thead>
          <tbody>${filtered.map((s) => row(s, areaById)).join('') || '<tr><td colspan="4" style="color:var(--muted);">Nenhum estímulo encontrado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  const searchInput = qs('#stimulus-search', container);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchText = searchInput.value;
      render(container);
    });
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  const filterSelect = qs('#stimulus-filter-area', container);
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      filterAreaId = filterSelect.value;
      render(container);
    });
  }

  const newBtn = qs('#stimulus-new', container);
  if (newBtn) newBtn.addEventListener('click', () => { editingId = 'new'; render(container); });

  const cancelBtn = qs('#stimulus-cancel', container);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { editingId = null; render(container); });

  const saveBtn = qs('#stimulus-save', container);
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const label = qs('#stimulus-label', container).value.trim();
      const areaIds = qsa('[data-stimulus-area-checkbox]', container).filter((cb) => cb.checked).map((cb) => cb.value);
      const tags = parseTagsInput(qs('#stimulus-tags', container).value);
      if (!label || !areaIds.length) {
        Toast.show('Preencha nome e ao menos uma área do estímulo.', { kind: 'warning' });
        return;
      }
      const record = { label, areaIds, tags };
      if (editingStimulus) record.id = editingStimulus.id;
      await Catalog.saveStimulus(record);
      Toast.show('Estímulo salvo com sucesso.', { kind: 'success' });
      editingId = null;
      render(container);
    });
  }

  qsa('[data-edit]', container).forEach((btn) => {
    btn.addEventListener('click', () => { editingId = btn.dataset.edit; render(container); });
  });

  qsa('[data-delete]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.show();
      if (!confirmed) return;
      await Catalog.deleteStimulus(btn.dataset.delete);
      Toast.show('Estímulo excluído.', { kind: 'success' });
      render(container);
    });
  });
}
