import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Toast from '../core/toast.js';
import Catalog from '../core/catalog.js';
import LocalData from '../core/localData.js';
import { escapeHtml, qs, qsa } from '../core/dom.js';
import { renderQuestionBody, bindQuestionInteractions } from '../core/questionRenderer.js';

let estado = null; // { patientId, doc, templates, flatQuestions, templateById }
let observationOpen = false;

function flattenQuestions(selectedTemplateIds, templateById) {
  const flat = [];
  selectedTemplateIds.forEach((templateId) => {
    const template = templateById.get(templateId);
    if (!template) return;
    template.categories.forEach((category) => {
      category.questions.forEach((question) => {
        flat.push({ templateId, templateName: template.name, categoryName: category.name, question });
      });
    });
  });
  return flat;
}

function applyAnswer(entry, answer) {
  const q = entry.question;
  if (!answer) return;
  if (q.type === 'single' || q.type === 'yesno') {
    q.selected = answer.selected ?? null;
  } else if (q.type === 'freq3') {
    q.frequency.selected = answer.frequency?.selected ?? null;
    q.impact.selected = answer.impact?.selected ?? null;
    q.setting.selected = answer.setting?.selected ?? null;
  } else if (q.type === 'text') {
    q.textValue = answer.textValue ?? '';
  }
}

function extractAnswer(q) {
  if (q.type === 'single' || q.type === 'yesno') {
    return { selected: q.selected ?? null };
  }
  if (q.type === 'freq3') {
    return {
      frequency: { selected: q.frequency.selected ?? null },
      impact: { selected: q.impact.selected ?? null },
      setting: { selected: q.setting.selected ?? null },
    };
  }
  if (q.type === 'text') {
    return { textValue: q.textValue ?? '' };
  }
  return null;
}

function persistDoc() {
  const { patientId, doc } = estado;
  LocalData.saveDoc('anamnese', patientId, doc);
  Store.invalidate('anamnese', patientId);
}

// ── Estado 1: seleção de anamneses ──

function templateCheckboxRow(template, checked) {
  const questionCount = template.categories.reduce((sum, c) => sum + c.questions.length, 0);
  return `
    <tr>
      <td>
        <label style="display:flex;align-items:center;gap:9px;font-weight:600;">
          <input type="checkbox" value="${escapeHtml(template.id)}" data-template-checkbox ${checked ? 'checked' : ''}>
          ${escapeHtml(template.name)}
        </label>
      </td>
      <td>${questionCount}</td>
    </tr>`;
}

function renderSelectionScreen(root, patient) {
  const { templates, doc } = estado;
  const selectedSet = new Set(doc.selectedTemplateIds);

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-clipboard-question"></i> Anamnese</div>
    <div class="screen-desc">${escapeHtml(patient.fullName)} · ${escapeHtml(patient.id)} — selecione as anamneses que serão aplicadas a este aprendiz</div>

    <div class="panel">
      <div class="panel-header"><h3>Modelos de anamnese disponíveis</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        ${templates.length ? `
          <table>
            <thead><tr><th>Modelo</th><th>Perguntas</th></tr></thead>
            <tbody>${templates.map((t) => templateCheckboxRow(t, selectedSet.has(t.id))).join('')}</tbody>
          </table>
        ` : '<p style="font-size:12.5px;color:var(--muted);">Nenhum modelo de anamnese cadastrado em Configurações ainda.</p>'}
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-primary" type="button" id="btn-start-anamnese"><i class="fa-solid fa-play"></i> Iniciar aplicação</button>
        </div>
      </div>
    </div>
  `;

  qs('#btn-start-anamnese').addEventListener('click', () => {
    const selectedIds = qsa('[data-template-checkbox]').filter((cb) => cb.checked).map((cb) => cb.value);
    if (!selectedIds.length) {
      Toast.show('Selecione ao menos uma anamnese.', { kind: 'warning' });
      return;
    }
    estado.doc.selectedTemplateIds = selectedIds;
    estado.doc.currentIndex = 0;
    persistDoc();
    renderScreen();
  });
}

// ── Estado 2: aplicação pergunta-a-pergunta ──

function domainNavItem(templateId, templateName, currentTemplateId) {
  const currentClass = templateId === currentTemplateId ? ' current' : '';
  return `<div class="d-item${currentClass}" data-template="${escapeHtml(templateId)}"><span>${escapeHtml(templateName)}</span><span class="dot"></span></div>`;
}

function bindObservation() {
  qs('#btn-add-observation').addEventListener('click', () => {
    if (observationOpen) return;
    observationOpen = true;
    qs('#observation-box').innerHTML = `
      <textarea class="q-textarea" id="observation-textarea" placeholder="Escreva uma observação sobre esta pergunta..."></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;">
        <button class="btn btn-ghost btn-sm" type="button" id="btn-cancel-observation">Cancelar</button>
        <button class="btn btn-primary btn-sm" type="button" id="btn-save-observation">Salvar observação</button>
      </div>`;
    qs('#observation-textarea').focus();
    qs('#btn-cancel-observation').addEventListener('click', () => {
      observationOpen = false;
      qs('#observation-box').innerHTML = '';
    });
    qs('#btn-save-observation').addEventListener('click', () => {
      observationOpen = false;
      qs('#observation-box').innerHTML = '';
      Toast.show('Observação salva (simulado).', { kind: 'success' });
    });
  });
}

function renderQuestion() {
  const { doc, flatQuestions } = estado;
  const entry = flatQuestions[doc.currentIndex];
  const q = entry.question;
  const stage = qs('#question-stage');

  observationOpen = false;

  stage.innerHTML = `
    <div class="question-card">
      <div class="q-meta">${escapeHtml(entry.templateName)}${entry.categoryName && entry.categoryName !== entry.templateName ? ` · ${escapeHtml(entry.categoryName)}` : ''} · pergunta ${doc.currentIndex + 1} de ${flatQuestions.length}</div>
      <p class="q-text">${escapeHtml(q.text)}</p>
      ${renderQuestionBody(q)}
      <div class="source-tags">
        <button type="button" class="tag-chip tag-chip-action" id="btn-add-observation">+ adicionar observação</button>
      </div>
      <div id="observation-box"></div>
    </div>`;

  bindQuestionInteractions(q, stage);
  bindObservation();

  qsa('#domain-nav .d-item').forEach((item) => {
    item.classList.toggle('current', item.dataset.template === entry.templateId);
  });

  const pct = Math.round(((doc.currentIndex + 1) / flatQuestions.length) * 100);
  qs('#q-progress-fill').style.width = `${pct}%`;
  qs('#q-progress-text').textContent = `${pct}% (${doc.currentIndex + 1} de ${flatQuestions.length})`;
}

function persistAnswerForIndex(index) {
  const { doc, flatQuestions } = estado;
  const entry = flatQuestions[index];
  if (!entry) return;
  const answer = extractAnswer(entry.question);
  if (!answer) return;
  if (!doc.answers[entry.templateId]) doc.answers[entry.templateId] = {};
  doc.answers[entry.templateId][entry.question.id] = answer;
}

function next() {
  const { doc, flatQuestions } = estado;
  persistAnswerForIndex(doc.currentIndex);
  if (doc.currentIndex + 1 < flatQuestions.length) {
    doc.currentIndex += 1;
    persistDoc();
    renderQuestion();
    window.scrollTo(0, 0);
  } else {
    persistDoc();
    Toast.show('Anamnese concluída — todas as perguntas selecionadas foram respondidas.', { kind: 'success' });
  }
}

function prev() {
  const { doc } = estado;
  persistAnswerForIndex(doc.currentIndex);
  if (doc.currentIndex > 0) {
    doc.currentIndex -= 1;
    persistDoc();
    renderQuestion();
    window.scrollTo(0, 0);
  }
}

function jumpToTemplate(templateId) {
  const { doc, flatQuestions } = estado;
  persistAnswerForIndex(doc.currentIndex);
  const found = flatQuestions.findIndex((entry) => entry.templateId === templateId);
  if (found >= 0) {
    doc.currentIndex = found;
    persistDoc();
    renderQuestion();
  }
}

function renderApplicationScreen(root, patient) {
  const { doc, flatQuestions } = estado;

  const templateOrder = [];
  flatQuestions.forEach((entry) => {
    if (!templateOrder.some((t) => t.id === entry.templateId)) {
      templateOrder.push({ id: entry.templateId, name: entry.templateName });
    }
  });

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-clipboard-question"></i> Anamnese</div>
    <div class="screen-desc">${escapeHtml(patient.fullName)} · ${escapeHtml(patient.id)} — respondente: ${escapeHtml(patient.respondent || 'não definido')}</div>

    <div class="q-progress-bar"><span id="q-progress-fill" style="width:0%"></span></div>

    <div class="interview-layout">
      <div class="domain-nav" id="domain-nav">
        ${templateOrder.map((t) => domainNavItem(t.id, t.name, flatQuestions[doc.currentIndex].templateId)).join('')}
      </div>

      <div>
        <div id="question-stage"></div>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-primary-soft" type="button" id="btn-edit-selection"><i class="fa-solid fa-list-check"></i> Editar seleção de anamneses</button>
          <button class="btn btn-ghost" type="button" id="btn-prev">Voltar</button>
          <button class="btn btn-primary" type="button" id="btn-next">Próxima pergunta <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>

      <div>
        <div class="side-box">
          <h4>Sobre a aplicação</h4>
          <div class="fact"><b>Anamneses selecionadas:</b> ${templateOrder.length}</div>
          <div class="fact"><b>Iniciada em:</b> ${escapeHtml(doc.startedAt)}</div>
          <div class="fact"><b>Progresso:</b> <span id="q-progress-text"></span></div>
        </div>
      </div>
    </div>
  `;

  qs('#btn-next').addEventListener('click', next);
  qs('#btn-prev').addEventListener('click', prev);
  qs('#btn-edit-selection').addEventListener('click', () => {
    persistAnswerForIndex(doc.currentIndex);
    persistDoc();
    estado.doc.selectedTemplateIds = [];
    renderScreen();
  });
  qsa('#domain-nav .d-item').forEach((item) => {
    item.addEventListener('click', () => jumpToTemplate(item.dataset.template));
  });

  renderQuestion();
}

// ── Orquestração ──

async function renderScreen() {
  const root = qs('#s-anamnese');
  const patient = await Store.load('patient', estado.patientId);

  if (!estado.doc.selectedTemplateIds.length) {
    renderSelectionScreen(root, patient);
    return;
  }

  estado.flatQuestions = flattenQuestions(estado.doc.selectedTemplateIds, estado.templateById);
  estado.flatQuestions.forEach((entry, i) => {
    const templateAnswers = estado.doc.answers[entry.templateId] || {};
    applyAnswer(entry, templateAnswers[entry.question.id]);
  });

  if (!estado.flatQuestions.length) {
    Toast.show('Os modelos selecionados não têm perguntas cadastradas.', { kind: 'warning' });
    estado.doc.selectedTemplateIds = [];
    renderSelectionScreen(root, patient);
    return;
  }

  if (estado.doc.currentIndex >= estado.flatQuestions.length) {
    estado.doc.currentIndex = estado.flatQuestions.length - 1;
  }

  renderApplicationScreen(root, patient);
}

export async function mount() {
  const patientId = Patient.getCurrentId();
  const [doc, templates] = await Promise.all([
    Store.load('anamnese', patientId),
    Catalog.listAnamneseTemplates(),
  ]);

  estado = {
    patientId,
    doc,
    templates,
    templateById: new Map(templates.map((t) => [t.id, t])),
    flatQuestions: [],
  };

  await renderScreen();
}
