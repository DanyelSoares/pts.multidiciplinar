import Catalog from '../../core/catalog.js';
import Toast from '../../core/toast.js';
import ConfirmDialog from '../../core/confirmDialog.js';
import { escapeHtml, qs, qsa } from '../../core/dom.js';
import { renderQuestionBody, bindQuestionInteractions } from '../../core/questionRenderer.js';
import { parseTagsInput, renderTagChips, matchesSearch } from '../../core/tags.js';

const QUESTION_TYPES = [
  { id: 'single', label: 'Escolha única' },
  { id: 'freq3', label: 'Frequência + Impacto + Ambiente' },
  { id: 'yesno', label: 'Sim / Não' },
  { id: 'text', label: 'Texto livre' },
];

const FREQ3_DEFAULTS = {
  frequency: { options: ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre', 'Não foi possível avaliar', 'Não se aplica'], selected: null },
  impact: { options: ['Nenhum', 'Leve', 'Moderado', 'Intenso', 'Não avaliado'], selected: null },
  setting: { options: ['Casa', 'Escola', 'Clínica', 'Comunidade', 'Múltiplos ambientes'], selected: null },
};

let editingId = null;
let draft = null;
let searchText = '';

function newTemplate() {
  return { id: null, name: '', tags: [], categories: [] };
}

function newCategory() {
  return { id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', questions: [] };
}

function newQuestion() {
  return { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: '', type: 'single', options: ['Opção 1', 'Opção 2'], selected: null, textValue: '' };
}

function applyTypeDefaults(q) {
  if (q.type === 'single' && !q.options) q.options = ['Opção 1', 'Opção 2'];
  if (q.type === 'freq3' && !q.frequency) {
    q.frequency = JSON.parse(JSON.stringify(FREQ3_DEFAULTS.frequency));
    q.impact = JSON.parse(JSON.stringify(FREQ3_DEFAULTS.impact));
    q.setting = JSON.parse(JSON.stringify(FREQ3_DEFAULTS.setting));
  }
}

function templateRow(template) {
  const categoryCount = template.categories.length;
  const questionCount = template.categories.reduce((sum, c) => sum + c.questions.length, 0);
  return `
    <tr>
      <td>${escapeHtml(template.name)}</td>
      <td>${renderTagChips(template.tags)}</td>
      <td>${categoryCount}</td>
      <td>${questionCount}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${template.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete="${template.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
}

function previewQuestion(q) {
  return `
    <div class="question-card" style="margin-bottom:10px;padding:14px;">
      <p class="q-text" style="margin-bottom:8px;">${escapeHtml(q.text || '(pergunta sem texto)')}</p>
      ${renderQuestionBody(q)}
    </div>`;
}

function freq3GroupEditor(catId, q, groupName, groupLabel) {
  const group = q[groupName] || FREQ3_DEFAULTS[groupName];
  return `
    <div class="field-group" style="margin-bottom:10px;">
      <label>${groupLabel} — opções (uma por linha)</label>
      <textarea class="q-textarea" data-q-freq3-options="${catId}:${q.id}:${groupName}">${escapeHtml((group.options || []).join('\n'))}</textarea>
    </div>`;
}

function questionEditRow(catId, q, qIndex) {
  const isOptionsType = q.type === 'single';
  const isFreq3 = q.type === 'freq3';
  return `
    <div class="panel" style="margin-bottom:10px;">
      <div class="panel-body" style="padding:14px;">
        <div class="field-group" style="margin-bottom:10px;">
          <label>Pergunta ${qIndex + 1}</label>
          <input class="search-input" style="width:100%;padding:0 13px;" data-q-text="${catId}:${q.id}" value="${escapeHtml(q.text)}">
        </div>
        <div class="field-group" style="margin-bottom:10px;max-width:280px;">
          <label>Tipo</label>
          <select class="select-input" style="width:100%;" data-q-type="${catId}:${q.id}">
            ${QUESTION_TYPES.map((t) => `<option value="${t.id}" ${t.id === q.type ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        ${isOptionsType ? `
          <div class="field-group" style="margin-bottom:10px;">
            <label>Opções (uma por linha)</label>
            <textarea class="q-textarea" data-q-options="${catId}:${q.id}">${escapeHtml((q.options || []).join('\n'))}</textarea>
          </div>` : ''}
        ${isFreq3 ? `
          ${freq3GroupEditor(catId, q, 'frequency', 'Frequência')}
          ${freq3GroupEditor(catId, q, 'impact', 'Impacto funcional')}
          ${freq3GroupEditor(catId, q, 'setting', 'Ambiente de ocorrência')}
        ` : ''}
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm" type="button" data-q-remove="${catId}:${q.id}"><i class="fa-solid fa-trash"></i> Remover pergunta</button>
        </div>
      </div>
    </div>`;
}

function categoryBlock(category, catIndex) {
  return `
    <div class="panel" style="margin-bottom:14px;">
      <div class="panel-header">
        <div class="field-group" style="flex:1;margin-right:12px;">
          <input class="search-input" style="width:100%;padding:0 13px;" placeholder="Nome da categoria" data-cat-name="${category.id}" value="${escapeHtml(category.name)}">
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-cat-remove="${category.id}"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="panel-body" style="padding-top:14px;">
        ${category.questions.map((q, i) => questionEditRow(category.id, q, i)).join('')}
        <button class="btn btn-primary-soft btn-sm" type="button" data-cat-add-question="${category.id}"><i class="fa-solid fa-plus"></i> Adicionar pergunta</button>
      </div>
    </div>`;
}

function editorHtml() {
  return `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><h3>${draft.id ? 'Editar modelo de anamnese' : 'Novo modelo de anamnese'}</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="field-group" style="margin-bottom:14px;">
          <label>Nome do modelo *</label>
          <input class="search-input" id="anamnese-name" style="width:100%;padding:0 13px;" value="${escapeHtml(draft.name)}">
        </div>

        <div class="field-group" style="margin-bottom:14px;">
          <label>Tags (separadas por vírgula)</label>
          <input class="search-input" id="anamnese-tags" style="width:100%;padding:0 13px;" placeholder="Ex.: TEA, TDAH" value="${escapeHtml((draft.tags || []).join(', '))}">
        </div>

        ${draft.categories.map(categoryBlock).join('') || '<p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">Nenhuma categoria ainda.</p>'}

        <button class="btn btn-primary-soft btn-sm" type="button" id="anamnese-add-category" style="margin-bottom:16px;"><i class="fa-solid fa-plus"></i> Adicionar categoria</button>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-ghost btn-sm" type="button" id="anamnese-cancel">Cancelar</button>
          <button class="btn btn-primary btn-sm" type="button" id="anamnese-save">Salvar modelo</button>
        </div>
      </div>
    </div>

    ${draft.categories.some((c) => c.questions.length) ? `
      <div class="panel">
        <div class="panel-header"><h3>Pré-visualização</h3></div>
        <div class="panel-body" style="padding-top:14px;">
          ${draft.categories.map((c) => `
            <h5 style="font-size:12.5px;font-weight:800;margin:14px 0 8px;">${escapeHtml(c.name || '(categoria sem nome)')}</h5>
            ${c.questions.map(previewQuestion).join('')}
          `).join('')}
        </div>
      </div>` : ''}
  `;
}

function bindPreviewInteractions(container) {
  draft.categories.forEach((c) => {
    c.questions.forEach((q) => bindQuestionInteractions(q, container));
  });
}

function bindEditor(container) {
  qs('#anamnese-name', container).addEventListener('input', (e) => { draft.name = e.target.value; });
  qs('#anamnese-tags', container).addEventListener('input', (e) => { draft.tags = parseTagsInput(e.target.value); });

  qs('#anamnese-add-category', container).addEventListener('click', () => {
    draft.categories.push(newCategory());
    renderEditor(container);
  });

  qs('#anamnese-cancel', container).addEventListener('click', () => {
    editingId = null;
    draft = null;
    render(container);
  });

  qs('#anamnese-save', container).addEventListener('click', async () => {
    const name = qs('#anamnese-name', container).value.trim();
    const tags = parseTagsInput(qs('#anamnese-tags', container).value);
    if (!name) {
      Toast.show('Preencha o nome do modelo de anamnese.', { kind: 'warning' });
      return;
    }
    if (!draft.categories.length) {
      Toast.show('Adicione ao menos uma categoria.', { kind: 'warning' });
      return;
    }
    const record = { ...draft, name, tags };
    await Catalog.saveAnamneseTemplate(record);
    Toast.show('Modelo de anamnese salvo com sucesso.', { kind: 'success' });
    editingId = null;
    draft = null;
    render(container);
  });

  qsa('[data-cat-name]', container).forEach((input) => {
    input.addEventListener('input', () => {
      const cat = draft.categories.find((c) => c.id === input.dataset.catName);
      if (cat) cat.name = input.value;
    });
  });

  qsa('[data-cat-remove]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.show();
      if (!confirmed) return;
      draft.categories = draft.categories.filter((c) => c.id !== btn.dataset.catRemove);
      renderEditor(container);
    });
  });

  qsa('[data-cat-add-question]', container).forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = draft.categories.find((c) => c.id === btn.dataset.catAddQuestion);
      if (cat) cat.questions.push(newQuestion());
      renderEditor(container);
    });
  });

  qsa('[data-q-remove]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.show();
      if (!confirmed) return;
      const [catId, qId] = btn.dataset.qRemove.split(':');
      const cat = draft.categories.find((c) => c.id === catId);
      if (cat) cat.questions = cat.questions.filter((q) => q.id !== qId);
      renderEditor(container);
    });
  });

  qsa('[data-q-text]', container).forEach((input) => {
    input.addEventListener('input', () => {
      const [catId, qId] = input.dataset.qText.split(':');
      const cat = draft.categories.find((c) => c.id === catId);
      const q = cat?.questions.find((qq) => qq.id === qId);
      if (q) q.text = input.value;
    });
  });

  qsa('[data-q-type]', container).forEach((select) => {
    select.addEventListener('change', () => {
      const [catId, qId] = select.dataset.qType.split(':');
      const cat = draft.categories.find((c) => c.id === catId);
      const q = cat?.questions.find((qq) => qq.id === qId);
      if (q) {
        q.type = select.value;
        applyTypeDefaults(q);
      }
      renderEditor(container);
    });
  });

  qsa('[data-q-options]', container).forEach((textarea) => {
    textarea.addEventListener('input', () => {
      const [catId, qId] = textarea.dataset.qOptions.split(':');
      const cat = draft.categories.find((c) => c.id === catId);
      const q = cat?.questions.find((qq) => qq.id === qId);
      if (q) q.options = textarea.value.split('\n').map((s) => s.trim()).filter(Boolean);
    });
  });

  qsa('[data-q-freq3-options]', container).forEach((textarea) => {
    textarea.addEventListener('input', () => {
      const [catId, qId, groupName] = textarea.dataset.qFreq3Options.split(':');
      const cat = draft.categories.find((c) => c.id === catId);
      const q = cat?.questions.find((qq) => qq.id === qId);
      if (q && q[groupName]) {
        q[groupName].options = textarea.value.split('\n').map((s) => s.trim()).filter(Boolean);
      }
    });
  });

  bindPreviewInteractions(container);
}

function renderEditor(container) {
  container.innerHTML = editorHtml();
  bindEditor(container);
}

export async function render(container) {
  if (editingId !== null) {
    if (!draft) draft = newTemplate();
    renderEditor(container);
    return;
  }

  const templates = await Catalog.listAnamneseTemplates();
  const filteredTemplates = templates.filter((t) => matchesSearch(t, searchText, [t.name]));

  container.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>Anamneses</h3>
        <button class="btn btn-primary btn-sm" type="button" id="anamnese-new"><i class="fa-solid fa-plus"></i> Novo modelo</button>
      </div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="search-wrap" style="margin-bottom:14px;max-width:360px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input class="search-input" id="anamnese-search" placeholder="Buscar por nome ou tag..." value="${escapeHtml(searchText)}">
        </div>
        <table>
          <thead><tr><th>Nome</th><th>Tags</th><th>Categorias</th><th>Perguntas</th><th></th></tr></thead>
          <tbody>${filteredTemplates.map(templateRow).join('') || '<tr><td colspan="5" style="color:var(--muted);">Nenhum modelo de anamnese encontrado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  const searchInput = qs('#anamnese-search', container);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchText = searchInput.value;
      render(container);
    });
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  qs('#anamnese-new', container).addEventListener('click', () => {
    editingId = 'new';
    draft = newTemplate();
    render(container);
  });

  qsa('[data-edit]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const templateList = await Catalog.listAnamneseTemplates();
      const found = templateList.find((t) => t.id === btn.dataset.edit);
      editingId = btn.dataset.edit;
      draft = found ? JSON.parse(JSON.stringify(found)) : newTemplate();
      render(container);
    });
  });

  qsa('[data-delete]', container).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.show();
      if (!confirmed) return;
      await Catalog.deleteAnamneseTemplate(btn.dataset.delete);
      Toast.show('Modelo de anamnese excluído.', { kind: 'success' });
      render(container);
    });
  });
}
