import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Config from '../core/config.js';
import LocalData from '../core/localData.js';
import Toast from '../core/toast.js';
import { calcularSerieSessoes } from '../core/abaEngine.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

let estado = null; // { patientId, config, stimulusById, helpTypeById, areaById }

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

function helpHierarchyFromConfig(config) {
  const { helpTypeById } = estado;
  return (config.helpTypeIds || [])
    .map((id, i) => {
      const ht = helpTypeById.get(id);
      if (!ht) return '';
      return `<div class="help-step${i === 0 ? ' current' : ''}"><span class="n">${i + 1}</span> ${escapeHtml(ht.label)}</div>`;
    })
    .join('');
}

function promptModeLabel(mode) {
  if (mode === 'least_to_most') return 'menos para mais';
  if (mode === 'custom') return 'personalizada';
  return 'mais para menos';
}

function activeProgram(p) {
  const helpSteps = helpHierarchyFromConfig(p.config || {});
  const series = calcularSerieSessoes(p);

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
        <div class="k">Hierarquia de ajuda (${promptModeLabel(p.config?.promptHierarchyMode)})</div>
        <div class="help-hierarchy">${helpSteps}</div>
      </div>
      <div class="aba-field">
        <div class="k">Critério de domínio</div>
        <div class="v">${p.config ? `${escapeHtml(String(p.config.masteryCriteriaPercent))}% de acerto` : '—'}</div>
      </div>

      <div class="panel-header" style="padding:0;margin:16px 0 10px;border:none;"><h3 style="font-size:12.5px;">Resultados — últimas ${series.length} sessões</h3></div>
      <div class="chart-bars">${chartBars(series)}</div>
      <div class="chart-legend">
        <span><span class="dot" style="background:var(--border);"></span> Linha de base</span>
        <span><span class="dot" style="background:var(--primary);"></span> % de respostas corretas</span>
      </div>
      <div class="footnote" style="margin-top:12px;"><i class="fa-solid fa-circle-info"></i>As sessões exibidas acima são registradas na evolução do paciente, no sistema de prontuário. Aqui a configuração define o que aquele registro deve apresentar.</div>

      <div style="margin-top:14px;">
        <button type="button" class="btn btn-ghost btn-sm aba-config-toggle" data-code="${escapeHtml(p.code)}"><i class="fa-solid fa-sliders"></i> Configurar programa</button>
      </div>
      <div class="aba-config-area" id="aba-config-${escapeHtml(p.code)}"></div>
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

// ── Configuração do programa ──

function renderConfigForm(program) {
  const { config: cfg } = estado;
  const c = program.config || { model: 'dtt', promptHierarchyMode: 'most_to_least', helpTypeIds: [], stimulusIds: [], attemptsPerStimulus: 5, masteryCriteriaPercent: 80 };

  const stimulusOptions = cfg.abaStimuli
    .map((s) => `<option value="${escapeHtml(s.id)}" ${c.stimulusIds.includes(s.id) ? 'selected' : ''}>${escapeHtml(s.label)}</option>`)
    .join('');

  return `
    <div class="panel" style="margin-top:12px;box-shadow:none;border:1px dashed var(--border);">
      <div class="panel-body" style="padding:16px;">
        <div class="filter-row" style="margin-bottom:12px;">
          <div class="field-group">
            <label>Modelo</label>
            <select class="select-input" id="cfg-model">
              <option value="dtt" ${c.model === 'dtt' ? 'selected' : ''}>DTT — Tentativas Discretas</option>
              <option value="it" ${c.model === 'it' ? 'selected' : ''}>IT — Incidental</option>
            </select>
          </div>
          <div class="field-group">
            <label>Hierarquia de dica</label>
            <select class="select-input" id="cfg-prompt-mode">
              <option value="most_to_least" ${c.promptHierarchyMode === 'most_to_least' ? 'selected' : ''}>Mais para menos</option>
              <option value="least_to_most" ${c.promptHierarchyMode === 'least_to_most' ? 'selected' : ''}>Menos para mais</option>
              <option value="custom" ${c.promptHierarchyMode === 'custom' ? 'selected' : ''}>Personalizada</option>
            </select>
          </div>
          <div class="field-group">
            <label>Tentativas por estímulo</label>
            <input type="number" min="1" max="20" class="search-input" id="cfg-attempts" value="${c.attemptsPerStimulus}" style="width:100px;">
          </div>
          <div class="field-group">
            <label>Critério de domínio (%)</label>
            <input type="number" min="1" max="100" class="search-input" id="cfg-mastery" value="${c.masteryCriteriaPercent}" style="width:100px;">
          </div>
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Estímulos a apresentar (define o que a tela de evolução oferece para registro)</label>
          <select class="select-input" id="cfg-stimuli" multiple size="5" style="height:auto;padding:8px;">
            ${stimulusOptions}
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn btn-primary btn-sm" type="button" id="cfg-save"><i class="fa-solid fa-floppy-disk"></i> Salvar configuração</button>
        </div>
      </div>
    </div>`;
}

function bindConfigForm(program) {
  qs('#cfg-save').addEventListener('click', () => {
    const stimulusIds = Array.from(qs('#cfg-stimuli').selectedOptions).map((o) => o.value);
    if (!stimulusIds.length) {
      Toast.show('Selecione ao menos um estímulo.', { kind: 'warning' });
      return;
    }
    const promptMode = qs('#cfg-prompt-mode').value;
    const helpTypeIds = estado.config.abaHelpTypes
      .map((h) => h.id)
      .sort((a, b) => {
        const ha = estado.helpTypeById.get(a).order;
        const hb = estado.helpTypeById.get(b).order;
        if (promptMode === 'least_to_most') return ha - hb;
        if (promptMode === 'custom') return 0;
        return hb - ha;
      });

    const newConfig = {
      model: qs('#cfg-model').value,
      promptHierarchyMode: promptMode,
      helpTypeIds,
      stimulusIds,
      attemptsPerStimulus: parseInt(qs('#cfg-attempts').value, 10) || 1,
      masteryCriteriaPercent: parseInt(qs('#cfg-mastery').value, 10) || 80,
    };

    saveOverride(program.code, { config: newConfig });
    Toast.show('Configuração do programa salva.', { kind: 'success' });
    refreshScreen();
  });
}

function saveOverride(programCode, patch) {
  const { patientId } = estado;
  const current = LocalData.getOverride('aba', patientId) || {};
  current[programCode] = { ...(current[programCode] || {}), ...patch };
  LocalData.saveOverride('aba', patientId, current);
  Store.invalidate('aba', patientId);
}

function bindConfigToggles(programs) {
  qsa('.aba-config-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      const program = programs.find((p) => p.code === code);
      if (!program) return;
      const area = qs(`#aba-config-${code}`);
      if (area.innerHTML.trim()) {
        area.innerHTML = '';
        return;
      }
      area.innerHTML = renderConfigForm(program);
      bindConfigForm(program);
    });
  });
}

async function refreshScreen() {
  await mount();
}

export async function mount() {
  const patientId = Patient.getCurrentId();
  const [aba, patient, config] = await Promise.all([Store.load('aba', patientId), Store.load('patient', patientId), Config.load()]);
  const root = qs('#s-aba');

  if (aba.empty) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState(aba.reason)}
    `;
    return;
  }

  estado = {
    patientId,
    config,
    stimulusById: new Map(config.abaStimuli.map((s) => [s.id, s])),
    helpTypeById: new Map(config.abaHelpTypes.map((h) => [h.id, h])),
    areaById: new Map(config.abaAreas.map((a) => [a.id, a])),
  };

  const cards = aba.programs.map((p) => (p.config ? activeProgram(p) : draftProgram(p))).join('');

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · componente comportamental vinculado ao PTS v${escapeHtml(patient.version)} · supervisor: ${escapeHtml(patient.caseSupervisor || 'não definido')}</div>

    <div class="footnote" style="margin-bottom:18px;"><i class="fa-solid fa-circle-info"></i>${escapeHtml(aba.notice)}</div>

    ${cards}
  `;

  bindConfigToggles(aba.programs);
}
