import Catalog from '../../core/catalog.js';
import Toast from '../../core/toast.js';
import ConfirmDialog from '../../core/confirmDialog.js';
import { escapeHtml, qs, qsa } from '../../core/dom.js';
import { parseTagsInput, renderTagChips, matchesSearch } from '../../core/tags.js';

let editingId = null;
let expandedAreaId = null;
let editingStimulusId = null;
let searchText = '';

function row(area, stimulusCountById) {
  const count = stimulusCountById.get(area.id) || 0;
  const expanded = expandedAreaId === area.id;
  return `
    <tr>
      <td>${escapeHtml(area.label)}</td>
      <td>${escapeHtml(area.description || '')}</td>
      <td>${renderTagChips(area.tags)}</td>
      <td>${count > 0
        ? `<button class="btn btn-ghost btn-sm" type="button" data-toggle-stimuli="${area.id}">${count} <i class="fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>`
        : '0'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${area.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete="${area.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
}

function stimulusEditRowHtml(stimulus, areas) {
  const selectedIds = stimulus.areaIds || [];
  const checkboxes = areas
    .map((a) => `
      <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;margin-right:14px;">
        <input type="checkbox" value="${a.id}" data-area-stimulus-area-checkbox ${selectedIds.includes(a.id) ? 'checked' : ''}> ${escapeHtml(a.label)}
      </label>`)
    .join('');
  return `
    <div style="padding:8px 0;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input class="search-input" id="area-stimulus-label" style="flex:1;padding:0 13px;" value="${escapeHtml(stimulus.label)}">
      </div>
      <div style="margin-bottom:8px;">${checkboxes}</div>
      <div style="margin-bottom:8px;">
        <input class="search-input" id="area-stimulus-tags" style="width:100%;padding:0 13px;" placeholder="Tags (separadas por vírgula)" value="${escapeHtml((stimulus.tags || []).join(', '))}">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn btn-ghost btn-sm" type="button" id="area-stimulus-cancel">Cancelar</button>
        <button class="btn btn-primary btn-sm" type="button" id="area-stimulus-save">Salvar</button>
      </div>
    </div>`;
}

function stimulusRowHtml(stimulus, editing) {
  if (editing) return '';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
      <span>${escapeHtml(stimulus.label)}</span>
      <span style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" type="button" data-stimulus-edit="${stimulus.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-stimulus-delete="${stimulus.id}"><i class="fa-solid fa-trash"></i></button>
      </span>
    </div>`;
}

function expandedStimuliRow(area, stimuliForArea, allAreas) {
  const items = stimuliForArea.map((s) => {
    if (editingStimulusId === s.id) return stimulusEditRowHtml(s, allAreas);
    return stimulusRowHtml(s, false);
  }).join('<div style="border-top:1px solid var(--border);"></div>');

  return `
    <tr>
      <td colspan="5" style="background:var(--panel-soft);padding:10px 16px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Estímulos vinculados a "${escapeHtml(area.label)}"</div>
        ${items}
      </td>
    </tr>`;
}

function formHtml(area) {
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><h3>${area ? 'Editar área' : 'Nova área'}</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="field-group" style="margin-bottom:12px;">
          <label>Nome *</label>
          <input class="search-input" id="area-label" style="width:100%;padding:0 13px;" value="${escapeHtml(area?.label || '')}">
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Descrição *</label>
          <textarea class="q-textarea" id="area-description" placeholder="O que distingue esta área de outras...">${escapeHtml(area?.description || '')}</textarea>
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Tags (separadas por vírgula)</label>
          <input class="search-input" id="area-tags" style="width:100%;padding:0 13px;" placeholder="Ex.: TEA, TDAH" value="${escapeHtml((area?.tags || []).join(', '))}">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-ghost btn-sm" type="button" id="area-cancel">Cancelar</button>
          <button class="btn btn-primary btn-sm" type="button" id="area-save">Salvar</button>
        </div>
      </div>
    </div>`;
}

export async function render(container) {
  const [allAreas, allStimuli] = await Promise.all([Catalog.listAreas(), Catalog.listStimuli()]);
  const stimulusCountById = new Map();
  allStimuli.forEach((s) => {
    (s.areaIds || []).forEach((areaId) => {
      stimulusCountById.set(areaId, (stimulusCountById.get(areaId) || 0) + 1);
    });
  });

  const editingArea = editingId ? allAreas.find((a) => a.id === editingId) : null;
  const filteredAreas = allAreas.filter((a) => matchesSearch(a, searchText, [a.label]));

  const bodyRows = filteredAreas.map((a) => {
    const rowHtml = row(a, stimulusCountById);
    if (expandedAreaId !== a.id) return rowHtml;
    const stimuliForArea = allStimuli.filter((s) => (s.areaIds || []).includes(a.id));
    return rowHtml + expandedStimuliRow(a, stimuliForArea, allAreas);
  }).join('');

  container.innerHTML = `
    ${editingId !== null ? formHtml(editingArea) : ''}
    <div class="panel">
      <div class="panel-header">
        <h3>Áreas</h3>
        ${editingId === null ? '<button class="btn btn-primary btn-sm" type="button" id="area-new"><i class="fa-solid fa-plus"></i> Nova área</button>' : ''}
      </div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="search-wrap" style="margin-bottom:14px;max-width:360px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input class="search-input" id="area-search" placeholder="Buscar por nome ou tag..." value="${escapeHtml(searchText)}">
        </div>
        <table>
          <thead><tr><th>Nome</th><th>Descrição</th><th>Tags</th><th>Estímulos vinculados</th><th></th></tr></thead>
          <tbody>${bodyRows || '<tr><td colspan="5" style="color:var(--muted);">Nenhuma área encontrada.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  const searchInput = qs('#area-search', container);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchText = searchInput.value;
      render(container);
    });
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  const newBtn = qs('#area-new', container);
  if (newBtn) newBtn.addEventListener('click', () => { editingId = 'new'; render(container); });

  const cancelBtn = qs('#area-cancel', container);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { editingId = null; render(container); });

  const saveBtn = qs('#area-save', container);
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const label = qs('#area-label', container).value.trim();
      const description = qs('#area-description', container).value.trim();
      const tags = parseTagsInput(qs('#area-tags', container).value);
      if (!label || !description) {
        Toast.show('Preencha nome e descrição da área.', { kind: 'warning' });
        return;
      }
      const record = { label, description, tags };
      if (editingArea) record.id = editingArea.id;
      await Catalog.saveArea(record);
      Toast.show('Área salva com sucesso.', { kind: 'success' });
      editingId = null;
      render(container);
    });
  }

  qsa('[data-edit]', container).forEach((btn) => {
    btn.addEventListener('click', () => { editingId = btn.dataset.edit; render(container); });
  });

  qsa('[data-delete]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delete;
      const linked = stimulusCountById.get(id) || 0;
      if (linked > 0) {
        Toast.show(`Não é possível excluir: ${linked} estímulo(s) vinculado(s) a esta área.`, { kind: 'warning' });
        return;
      }
      const confirmed = await ConfirmDialog.show();
      if (!confirmed) return;
      await Catalog.deleteArea(id);
      Toast.show('Área excluída.', { kind: 'success' });
      render(container);
    });
  });

  qsa('[data-toggle-stimuli]', container).forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleStimuli;
      expandedAreaId = expandedAreaId === id ? null : id;
      editingStimulusId = null;
      render(container);
    });
  });

  qsa('[data-stimulus-edit]', container).forEach((btn) => {
    btn.addEventListener('click', () => {
      editingStimulusId = btn.dataset.stimulusEdit;
      render(container);
    });
  });

  qsa('[data-stimulus-delete]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.show();
      if (!confirmed) return;
      await Catalog.deleteStimulus(btn.dataset.stimulusDelete);
      Toast.show('Estímulo excluído.', { kind: 'success' });
      render(container);
    });
  });

  const stimulusCancelBtn = qs('#area-stimulus-cancel', container);
  if (stimulusCancelBtn) {
    stimulusCancelBtn.addEventListener('click', () => {
      editingStimulusId = null;
      render(container);
    });
  }

  const stimulusSaveBtn = qs('#area-stimulus-save', container);
  if (stimulusSaveBtn) {
    stimulusSaveBtn.addEventListener('click', async () => {
      const label = qs('#area-stimulus-label', container).value.trim();
      const areaIds = qsa('[data-area-stimulus-area-checkbox]', container).filter((cb) => cb.checked).map((cb) => cb.value);
      const tags = parseTagsInput(qs('#area-stimulus-tags', container).value);
      if (!label || !areaIds.length) {
        Toast.show('Preencha nome e ao menos uma área do estímulo.', { kind: 'warning' });
        return;
      }
      await Catalog.saveStimulus({ id: editingStimulusId, label, areaIds, tags });
      Toast.show('Estímulo salvo com sucesso.', { kind: 'success' });
      editingStimulusId = null;
      render(container);
    });
  }
}
