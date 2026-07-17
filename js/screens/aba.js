import Store from '../core/store.js';
import Patient from '../core/patient.js';
import { escapeHtml, qs, emptyState } from '../core/dom.js';

function kv(k, v) {
  return `<div class="kv"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`;
}

function chartBars(sessionData) {
  return sessionData
    .map((s) => `
      <div class="chart-bar-col">
        <div class="chart-bar${s.baseline ? ' baseline' : ''}" style="height:${s.value}%"></div>
        <div class="chart-bar-label">${escapeHtml(s.label)}</div>
      </div>`)
    .join('');
}

function activeProgram(p) {
  const helpSteps = p.helpHierarchy
    .map((h) => `<div class="help-step${h.current ? ' current' : ''}"><span class="n">${h.n}</span> ${escapeHtml(h.label)}</div>`)
    .join('');

  return `
    <div class="aba-card">
      <div class="aba-card-head">
        <div>
          <div class="name">${escapeHtml(p.code)} · ${escapeHtml(p.name)}</div>
          <div class="obj-link"><i class="fa-solid fa-link"></i> ${escapeHtml(p.objectiveLink)}</div>
        </div>
        <span class="pill ${p.status}">${escapeHtml(p.statusLabel)}</span>
      </div>
      <div class="kv-grid">
        ${kv('Responsável', p.responsible)}
        ${kv('Supervisor', p.supervisor)}
        ${kv('Ambiente', p.environment)}
        ${kv('Frequência', p.frequency)}
      </div>
      <div class="aba-field" style="margin-top:14px;">
        <div class="k">Definição operacional</div>
        <div class="v">${escapeHtml(p.operationalDefinition)}</div>
      </div>
      <div class="aba-field">
        <div class="k">Estímulo antecedente → resposta esperada</div>
        <div class="v">${escapeHtml(p.antecedentResponse)}</div>
      </div>
      <div class="aba-field">
        <div class="k">Hierarquia de ajuda (da mais para a menos intrusiva)</div>
        <div class="help-hierarchy">${helpSteps}</div>
      </div>
      <div class="aba-field">
        <div class="k">Critério de domínio</div>
        <div class="v">${escapeHtml(p.masteryCriteria)}</div>
      </div>
      <div class="panel-header" style="padding:0;margin:16px 0 10px;border:none;"><h3 style="font-size:12.5px;">Coleta de dados — últimas ${p.sessionData.length} sessões</h3></div>
      <div class="chart-bars">${chartBars(p.sessionData)}</div>
      <div class="chart-legend">
        <span><span class="dot" style="background:var(--border);"></span> Linha de base</span>
        <span><span class="dot" style="background:var(--primary);"></span> % de respostas com ajuda gestual ou independentes</span>
      </div>
    </div>`;
}

function draftProgram(p) {
  return `
    <div class="aba-card">
      <div class="aba-card-head">
        <div>
          <div class="name">${escapeHtml(p.code)} · ${escapeHtml(p.name)}</div>
          <div class="obj-link"><i class="fa-solid fa-link"></i> ${escapeHtml(p.objectiveLink)}</div>
        </div>
        <span class="pill ${p.status}">${escapeHtml(p.statusLabel)}</span>
      </div>
      <div class="kv-grid">
        ${kv('Responsável', p.responsible)}
        ${kv('Supervisor', p.supervisor)}
        ${kv('Ambiente', p.environment)}
        ${kv('Frequência da avaliação', p.frequency)}
      </div>
      <div class="aba-field" style="margin-top:14px;">
        <div class="k">Hipótese de função (preliminar)</div>
        <div class="v">${escapeHtml(p.functionHypothesis)}</div>
      </div>
      <div class="aba-field">
        <div class="k">Habilidades substitutivas propostas</div>
        <div class="v">${escapeHtml(p.substituteSkills)}</div>
      </div>
      <div class="footnote" style="margin:12px 0 0;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--warning);"></i>${escapeHtml(p.warning)}</div>
    </div>`;
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [aba, patient] = await Promise.all([Store.load('aba', id), Store.load('patient', id)]);
  const root = qs('#s-aba');

  if (aba.empty) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState(aba.reason)}
    `;
    return;
  }

  const cards = aba.programs
    .map((p) => (p.helpHierarchy ? activeProgram(p) : draftProgram(p)))
    .join('');

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · componente comportamental vinculado ao PTS v${escapeHtml(patient.version)} · supervisor: Dr. Bruno Alencar</div>

    <div class="footnote" style="margin-bottom:18px;"><i class="fa-solid fa-circle-info"></i>${escapeHtml(aba.notice)}</div>

    ${cards}
  `;
}
