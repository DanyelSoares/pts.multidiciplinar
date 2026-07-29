import Catalog from '../../core/catalog.js';
import Toast from '../../core/toast.js';
import ConfirmDialog from '../../core/confirmDialog.js';
import { escapeHtml, qs, qsa } from '../../core/dom.js';
import { parseTagsInput, renderTagChips, matchesSearch } from '../../core/tags.js';

let editingId = null;
let searchText = '';

function row(helpType, index, total) {
  return `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(helpType.label)}</td>
      <td>${renderTagChips(helpType.tags)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" type="button" data-up="${helpType.id}" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-down="${helpType.id}" ${index === total - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${helpType.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete="${helpType.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
}

function formHtml(helpType) {
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><h3>${helpType ? 'Editar tipo de ajuda' : 'Novo tipo de ajuda'}</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="field-group" style="margin-bottom:12px;">
          <label>Nome *</label>
          <input class="search-input" id="help-label" style="width:100%;padding:0 13px;" value="${escapeHtml(helpType?.label || '')}">
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Tags (separadas por vírgula)</label>
          <input class="search-input" id="help-tags" style="width:100%;padding:0 13px;" placeholder="Ex.: TEA, TDAH" value="${escapeHtml((helpType?.tags || []).join(', '))}">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-ghost btn-sm" type="button" id="help-cancel">Cancelar</button>
          <button class="btn btn-primary btn-sm" type="button" id="help-save">Salvar</button>
        </div>
      </div>
    </div>`;
}

async function swapOrder(list, id, direction) {
  const idx = list.findIndex((h) => h.id === id);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];
  const orderA = a.order ?? idx + 1;
  const orderB = b.order ?? swapIdx + 1;
  await Catalog.saveHelpType({ ...a, order: orderB });
  await Catalog.saveHelpType({ ...b, order: orderA });
}

export async function render(container) {
  const list = await Catalog.listHelpTypes();
  const editingHelpType = editingId && editingId !== 'new' ? list.find((h) => h.id === editingId) : null;
  const filteredList = list.filter((h) => matchesSearch(h, searchText, [h.label]));
  const indexById = new Map(list.map((h, i) => [h.id, i]));

  container.innerHTML = `
    ${editingId !== null ? formHtml(editingHelpType) : ''}
    <div class="panel">
      <div class="panel-header">
        <h3>Tipos de ajuda</h3>
        ${editingId === null ? '<button class="btn btn-primary btn-sm" type="button" id="help-new"><i class="fa-solid fa-plus"></i> Novo tipo de ajuda</button>' : ''}
      </div>
      <div class="panel-body" style="padding-top:14px;">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px;">A ordem define a hierarquia de dica usada na configuração dos programas ABA (do menos ao mais intrusivo).</p>
        <div class="search-wrap" style="margin-bottom:14px;max-width:360px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input class="search-input" id="help-search" placeholder="Buscar por nome ou tag..." value="${escapeHtml(searchText)}">
        </div>
        <table>
          <thead><tr><th>#</th><th>Nome</th><th>Tags</th><th></th></tr></thead>
          <tbody>${filteredList.map((h) => row(h, indexById.get(h.id), list.length)).join('') || '<tr><td colspan="4" style="color:var(--muted);">Nenhum tipo de ajuda encontrado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  const searchInput = qs('#help-search', container);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchText = searchInput.value;
      render(container);
    });
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  const newBtn = qs('#help-new', container);
  if (newBtn) newBtn.addEventListener('click', () => { editingId = 'new'; render(container); });

  const cancelBtn = qs('#help-cancel', container);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { editingId = null; render(container); });

  const saveBtn = qs('#help-save', container);
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const label = qs('#help-label', container).value.trim();
      const tags = parseTagsInput(qs('#help-tags', container).value);
      if (!label) {
        Toast.show('Preencha o nome do tipo de ajuda.', { kind: 'warning' });
        return;
      }
      const record = { label, tags };
      if (editingHelpType) {
        record.id = editingHelpType.id;
        record.order = editingHelpType.order;
      } else {
        record.order = list.length + 1;
      }
      await Catalog.saveHelpType(record);
      Toast.show('Tipo de ajuda salvo com sucesso.', { kind: 'success' });
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
      await Catalog.deleteHelpType(btn.dataset.delete);
      Toast.show('Tipo de ajuda excluído.', { kind: 'success' });
      render(container);
    });
  });

  qsa('[data-up]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      await swapOrder(list, btn.dataset.up, -1);
      render(container);
    });
  });

  qsa('[data-down]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      await swapOrder(list, btn.dataset.down, 1);
      render(container);
    });
  });
}
