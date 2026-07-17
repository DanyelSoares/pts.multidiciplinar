import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Toast from '../core/toast.js';
import Config from '../core/config.js';
import { escapeHtml, qs, qsa } from '../core/dom.js';

let data = null;
let index = 0;
let sourceById = new Map();
let observationOpen = false;

function domainNavItem(domain) {
  const doneClass = domain.status === 'done' ? ' done' : '';
  const currentClass = domain.status === 'current' ? ' current' : '';
  return `<div class="d-item${doneClass}${currentClass}" data-domain="${domain.id}"><span>${escapeHtml(domain.name)}</span><span class="dot"></span></div>`;
}

function renderOptionsList(options, selected, name) {
  return `<div class="q-options">${options
    .map(
      (opt, i) => `<div class="q-option${i === selected ? ' selected' : ''}" data-choice="${i}"><span class="radio"></span> ${escapeHtml(opt)}</div>`
    )
    .join('')}</div>`;
}

function renderOptionsGroup(group, groupName, selected) {
  return `<div class="q-options" data-group="${groupName}">${group.options
    .map(
      (opt, i) => `<div class="q-option${i === selected ? ' selected' : ''}" data-group="${groupName}" data-choice="${i}"><span class="radio"></span> ${escapeHtml(opt)}</div>`
    )
    .join('')}</div>`;
}

function renderQuestionBody(q) {
  if (q.type === 'freq3') {
    return `
      <div class="q-freq3-block">
        <div class="q-freq3-label">Frequência</div>
        ${renderOptionsGroup(q.frequency, 'frequency', q.frequency.selected)}
      </div>
      <div class="q-freq3-block">
        <div class="q-freq3-label">Impacto funcional</div>
        ${renderOptionsGroup(q.impact, 'impact', q.impact.selected)}
      </div>
      <div class="q-freq3-block">
        <div class="q-freq3-label">Ambiente de ocorrência</div>
        ${renderOptionsGroup(q.setting, 'setting', q.setting.selected)}
      </div>`;
  }
  if (q.type === 'single' || q.type === 'freq' || q.type === 'help') {
    const options = q.options || q.freq || q.help;
    return renderOptionsList(options, q.selected, q.type);
  }
  if (q.type === 'scale') {
    return `<div class="q-scale">${q.scale
      .map((pt, i) => `<div class="q-scale-pt${i === q.selected ? ' selected' : ''}" data-choice="${i}">${escapeHtml(pt)}</div>`)
      .join('')}</div>`;
  }
  if (q.type === 'yesno') {
    return `<div class="q-yesno">
      <button type="button" class="${q.selected === 'yes' ? 'selected yes' : ''}" data-choice="yes"><i class="fa-solid fa-check"></i> Sim</button>
      <button type="button" class="${q.selected === 'no' ? 'selected no' : ''}" data-choice="no"><i class="fa-solid fa-xmark"></i> Não</button>
    </div>`;
  }
  if (q.type === 'text') {
    return `<textarea class="q-textarea" placeholder="Descreva com suas palavras...">${escapeHtml(q.textValue)}</textarea>`;
  }
  return '';
}

function renderInterviewAlert() {
  const q = data.questions[index];
  const alertBox = qs('#interview-alert');
  if (q.critical) {
    alertBox.style.display = 'block';
    qs('#interview-alert-text').textContent = `Resposta à pergunta (${q.meta}) foi classificada como crítica. Encaminhado para avaliação de gravidade — ver painel lateral.`;
    return;
  }
  if (q.triggersAlert) {
    const show = q.selected === 0;
    alertBox.style.display = show ? 'block' : 'none';
    if (show) qs('#interview-alert-text').textContent = q.alertText;
    return;
  }
  alertBox.style.display = 'none';
}

function renderQuestion() {
  const q = data.questions[index];
  const stage = qs('#question-stage');
  renderInterviewAlert();

  const tags = q.tags
    .map((id) => sourceById.get(id))
    .filter(Boolean)
    .map((s) => `<span class="tag-chip">${escapeHtml(s.label)}</span>`)
    .join('');

  observationOpen = false;

  stage.innerHTML = `
    <div class="question-card">
      <div class="q-meta">${escapeHtml(q.meta)}</div>
      <p class="q-text">${escapeHtml(q.text)}</p>
      ${renderQuestionBody(q)}
      <div class="source-tags">
        ${tags}
        <button type="button" class="tag-chip tag-chip-action" id="btn-add-observation">+ adicionar observação</button>
      </div>
      <div id="observation-box"></div>
      <div class="q-note">${escapeHtml(q.note)}</div>
    </div>`;

  bindQuestionInteractions(q);
  bindObservation();

  qsa('#domain-nav .d-item').forEach((item) => {
    item.classList.toggle('current', parseInt(item.dataset.domain, 10) === q.domain);
  });

  const pct = Math.round(((index + 1) / data.questions.length) * 100);
  qs('#q-progress-fill').style.width = `${pct}%`;
  qs('#q-progress-text').textContent = `${pct}% (${index + 1} de ${data.questions.length} exibidas nesta demonstração)`;
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

function bindQuestionInteractions(q) {
  if (q.type === 'freq3') {
    ['frequency', 'impact', 'setting'].forEach((groupName) => {
      qsa(`.q-option[data-group="${groupName}"]`).forEach((el) => {
        el.addEventListener('click', () => {
          qsa(`.q-option[data-group="${groupName}"]`).forEach((o) => o.classList.remove('selected'));
          el.classList.add('selected');
          q[groupName].selected = parseInt(el.dataset.choice, 10);
        });
      });
    });
  } else if (q.type === 'single' || q.type === 'freq' || q.type === 'help') {
    qsa('.q-option').forEach((el) => {
      el.addEventListener('click', () => {
        qsa('.q-option').forEach((o) => o.classList.remove('selected'));
        el.classList.add('selected');
        q.selected = parseInt(el.dataset.choice, 10);
        if (q.triggersAlert) {
          renderInterviewAlert();
        }
      });
    });
  } else if (q.type === 'scale') {
    qsa('.q-scale-pt').forEach((el) => {
      el.addEventListener('click', () => {
        qsa('.q-scale-pt').forEach((o) => o.classList.remove('selected'));
        el.classList.add('selected');
        q.selected = parseInt(el.dataset.choice, 10);
      });
    });
  } else if (q.type === 'yesno') {
    qsa('.q-yesno button').forEach((el) => {
      el.addEventListener('click', () => {
        qsa('.q-yesno button').forEach((o) => o.classList.remove('selected', 'yes', 'no'));
        el.classList.add('selected', el.dataset.choice);
        q.selected = el.dataset.choice;
      });
    });
  }
}

function condicaoAtendida(q) {
  if (!q.conditionalOn) return true;
  const referenciada = data.questions.find((other) => other.id === q.conditionalOn.questionId);
  if (!referenciada) return true;
  return referenciada.selected === q.conditionalOn.requiredValue;
}

function next() {
  let nextIndex = index + 1;
  while (nextIndex < data.questions.length && !condicaoAtendida(data.questions[nextIndex])) {
    nextIndex++;
  }
  if (nextIndex < data.questions.length) {
    index = nextIndex;
    renderQuestion();
    window.scrollTo(0, 0);
  }
}

function prev() {
  let prevIndex = index - 1;
  while (prevIndex >= 0 && !condicaoAtendida(data.questions[prevIndex])) {
    prevIndex--;
  }
  if (prevIndex >= 0) {
    index = prevIndex;
    renderQuestion();
    window.scrollTo(0, 0);
  }
}

function jumpToDomain(domainId) {
  const found = data.questions.findIndex((q) => q.domain === domainId);
  if (found >= 0) {
    index = found;
    renderQuestion();
  } else {
    Toast.show('Este domínio ainda não foi alcançado nesta entrevista.', { kind: 'warning' });
  }
}

function pendingAlertBox(pendingAlert) {
  if (!pendingAlert) {
    return `
      <div class="side-box">
        <h4>Alerta pendente</h4>
        <div class="fact">Nenhum alerta de triagem pendente nesta entrevista.</div>
      </div>`;
  }
  return `
    <div class="side-box">
      <h4>Alerta pendente</h4>
      <div class="fact"><b>Origem:</b> ${escapeHtml(pendingAlert.origin)}</div>
      <div class="fact"><b>Gravidade:</b> ${escapeHtml(pendingAlert.severity)}</div>
      <div class="fact"><b>Responsável:</b> ${escapeHtml(pendingAlert.responsible)}</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:6px;" type="button" id="btn-classify-alert">Classificar agora</button>
    </div>`;
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [interview, patient, config] = await Promise.all([Store.load('interview', id), Store.load('patient', id), Config.load()]);
  data = interview;
  sourceById = new Map(config.infoSources.map((s) => [s.id, s]));

  const root = qs('#s-interview');
  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-clipboard-question"></i> Entrevista estruturada</div>
    <div class="screen-desc">${escapeHtml(patient.fullName)} · ${escapeHtml(patient.id)} — respondente: ${escapeHtml(patient.respondent)} · entrevistador: ${escapeHtml(patient.interviewer)}</div>

    <div class="q-progress-bar"><span id="q-progress-fill" style="width:0%"></span></div>

    <div class="interview-layout">
      <div class="domain-nav" id="domain-nav">
        ${interview.domains.map(domainNavItem).join('')}
      </div>

      <div>
        <div class="alert-card" id="interview-alert" style="display:none;">
          <div class="title"><i class="fa-solid fa-triangle-exclamation"></i> Alerta de triagem gerado</div>
          <span id="interview-alert-text"></span>
        </div>

        <div id="question-stage"></div>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-primary-soft" type="button" id="btn-save-draft"><i class="fa-solid fa-floppy-disk"></i> Salvar rascunho</button>
          <button class="btn btn-ghost" type="button" id="btn-prev">Voltar</button>
          <button class="btn btn-primary" type="button" id="btn-next">Próxima pergunta <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>

      <div>
        <div class="side-box">
          <h4>Sobre a aplicação</h4>
          <div class="fact"><b>Questionário:</b> ${escapeHtml(interview.questionnaire)}</div>
          <div class="fact"><b>Iniciada em:</b> ${escapeHtml(interview.startedAt)}</div>
          <div class="fact"><b>Progresso:</b> <span id="q-progress-text"></span></div>
          <div class="fact"><b>Status:</b> em andamento</div>
        </div>
        ${pendingAlertBox(interview.pendingAlert)}
        <div class="side-box">
          <h4>Ações</h4>
          <div class="fact">Aplicar questionário complementar</div>
          <div class="fact">Comparar com aplicação anterior</div>
          <div class="fact">Exportar respostas parciais</div>
        </div>
      </div>
    </div>
  `;

  qs('#btn-next').addEventListener('click', next);
  qs('#btn-prev').addEventListener('click', prev);
  qsa('#domain-nav .d-item').forEach((item) => {
    item.addEventListener('click', () => jumpToDomain(parseInt(item.dataset.domain, 10)));
  });

  qs('#btn-save-draft').addEventListener('click', () => {
    Toast.show('Rascunho salvo (simulado).', { kind: 'success' });
  });

  const classifyBtn = qs('#btn-classify-alert');
  if (classifyBtn) {
    classifyBtn.addEventListener('click', () => {
      Toast.show('Alerta encaminhado para classificação (simulado).', { kind: 'success' });
    });
  }

  index = 0;
  renderQuestion();
}
