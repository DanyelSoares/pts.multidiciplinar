import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Router from '../core/router.js';
import Config from '../core/config.js';
import Catalog from '../core/catalog.js';
import LocalData from '../core/localData.js';
import Toast from '../core/toast.js';
import { calcularSerieSessoes } from '../core/abaEngine.js';
import { carregarInventario, buscarItemPorId } from '../core/portage.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';
import { PROGRAM_STATUSES, FREQUENCY_PERIODOS, FREQUENCY_UNIDADES, frequencyDescricao } from '../core/programOptions.js';

function carregarDocumento(name, patientId) {
  const local = LocalData.getDoc(name, patientId);
  if (local) return Promise.resolve(local);
  return Store.load(name, patientId);
}

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

function frequencyLabel(c) {
  return frequencyDescricao({
    quantidade: c.frequencyQuantidade,
    periodo: c.frequencyPeriodo,
    duracao: c.frequencyDuracao,
    unidade: c.frequencyUnidade,
  });
}

function statusLabelFromConfig(c) {
  const status = PROGRAM_STATUSES.find((s) => s.id === c.statusId);
  return status ? status.label : null;
}

const STATUS_PILL_CLASS = {
  not_started: 'muted',
  in_progress: 'info',
  generalized: 'ok',
};

function statusPillClass(c) {
  return STATUS_PILL_CLASS[c.statusId] || 'muted';
}

function peiProgramCard(programa, inventario) {
  const { helpTypeById } = estado;
  const area = inventario.areas.find((a) => a.id === programa.area);
  const ajudas = (programa.ajudaHelpTypeIds || [])
    .map((id) => helpTypeById.get(id)?.label)
    .filter(Boolean)
    .join(', ');
  const respostaEsperada = (programa.respostaEsperada || [])
    .map((itemId) => buscarItemPorId(itemId))
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item.id)} — ${escapeHtml(item.titulo)}</li>`)
    .join('');

  return `
    <div class="aba-card">
      <div class="aba-card-head">
        <div>
          <div class="name">${escapeHtml(programa.nome)}</div>
          <div class="obj-link"><i class="fa-solid fa-link"></i> Objetivo PEI: ${escapeHtml(programa.objetivoPeiId)} · Item Portage: ${escapeHtml(programa.itemPortageId)}</div>
        </div>
        <span class="pill info">Origem: PEI</span>
      </div>
      <div class="kv-grid">
        ${area ? kv('Área', area.nome) : ''}
        ${ajudas ? kv('Ajudas', ajudas) : ''}
        ${programa.procedimentoEnsino ? kv('Procedimento de ensino', programa.procedimentoEnsino) : ''}
        ${programa.criterioAquisicaoPercent ? kv('Critério de aquisição', `${programa.criterioAquisicaoPercent}% por ${programa.criterioAquisicaoDias} dias`) : ''}
      </div>
      ${programa.estimuloDiscriminativo ? `
      <div class="aba-field" style="margin-top:14px;">
        <div class="k">Estímulo discriminativo</div>
        <div class="v">${escapeHtml(programa.estimuloDiscriminativo)}</div>
      </div>` : ''}
      ${respostaEsperada ? `
      <div class="aba-field">
        <div class="k">Resposta esperada (itens do Portage)</div>
        <ul class="pei-resposta-esperada">${respostaEsperada}</ul>
      </div>` : ''}
      <div style="margin-top:14px;">
        <button type="button" class="btn btn-ghost btn-sm" data-goto-pei><i class="fa-solid fa-pen-to-square"></i> Editar no PEI</button>
      </div>
    </div>`;
}

function activeProgram(p) {
  const c = p.config;
  const helpSteps = helpHierarchyFromConfig(c || {});
  const series = calcularSerieSessoes(p);
  const displayName = c?.name || p.name;
  const statusLabel = statusLabelFromConfig(c) || '—';
  const freq = frequencyLabel(c) || '—';
  const { areaById } = estado;
  const area = c.areaId ? areaById.get(c.areaId) : null;

  return `
    <div class="aba-card">
      <div class="aba-card-head">
        <div>
          <div class="name">${escapeHtml(p.code)} · ${escapeHtml(displayName)}</div>
          <div class="obj-link"><i class="fa-solid fa-link"></i> ${escapeHtml(p.objectiveLink)}</div>
        </div>
        <span class="pill ${statusPillClass(c)}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="kv-grid">
        ${kv('Responsável', p.responsible)}
        ${kv('Supervisor', p.supervisor)}
        ${kv('Ambiente', p.environment)}
        ${kv('Frequência de aplicação', freq)}
        ${area ? kv('Área', area.label) : ''}
        ${c.helpsCount !== null && c.helpsCount !== undefined ? kv('Quantidade de ajudas', String(c.helpsCount)) : ''}
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
        <div class="v">${p.config ? escapeHtml(p.config.masteryCriteriaNote || `${p.config.masteryCriteriaPercent}% de acerto`) : '—'}</div>
      </div>

      <div class="panel-header" style="padding:0;margin:16px 0 10px;border:none;"><h3 style="font-size:12.5px;">Resultados — últimas ${series.length} sessões</h3></div>
      <div class="chart-bars">${chartBars(series)}</div>
      <div class="chart-legend">
        <span><span class="dot" style="background:var(--border);"></span> Linha de base</span>
        <span><span class="dot" style="background:var(--primary);"></span> % de respostas com ajuda gestual ou independentes</span>
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
  const { stimuli, areas } = estado;
  const c = program.config || { model: 'dtt', promptHierarchyMode: 'most_to_least', helpTypeIds: [], stimulusIds: [], attemptsPerStimulus: 5, masteryCriteriaPercent: 80 };

  const name = c.name ?? program.name;
  const areaId = c.areaId ?? '';
  const frequencyQuantidade = c.frequencyQuantidade ?? 1;
  const frequencyPeriodo = c.frequencyPeriodo ?? 'semana';
  const frequencyDuracao = c.frequencyDuracao ?? 30;
  const frequencyUnidade = c.frequencyUnidade ?? 'minutos';
  const statusId = c.statusId ?? 'not_started';
  const helpsCount = c.helpsCount ?? null;
  const helpsCountRequired = helpsCount !== null;

  const stimulusChecks = stimuli
    .map((s) => {
      const marcado = c.stimulusIds.includes(s.id);
      return `
      <label class="aba-stimulus-check${marcado ? ' checked' : ''}">
        <input type="checkbox" data-cfg-stimulus="${escapeHtml(s.id)}" ${marcado ? 'checked' : ''}>
        ${escapeHtml(s.label)}
      </label>`;
    })
    .join('');

  const areaOptions = areas
    .map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === areaId ? 'selected' : ''}>${escapeHtml(a.label)}</option>`)
    .join('');

  const periodoOptions = FREQUENCY_PERIODOS
    .map((p) => `<option value="${p.id}" ${p.id === frequencyPeriodo ? 'selected' : ''}>${escapeHtml(p.label)}</option>`)
    .join('');

  const unidadeOptions = FREQUENCY_UNIDADES
    .map((u) => `<option value="${u.id}" ${u.id === frequencyUnidade ? 'selected' : ''}>${escapeHtml(u.label)}</option>`)
    .join('');

  const statusOptions = PROGRAM_STATUSES
    .map((s) => `<option value="${s.id}" ${s.id === statusId ? 'selected' : ''}>${escapeHtml(s.label)}</option>`)
    .join('');

  return `
    <div class="panel" style="margin-top:12px;box-shadow:none;border:1px dashed var(--border);">
      <div class="panel-body" style="padding:16px;">
        <div class="filter-row" style="margin-bottom:12px;">
          <div class="field-group" style="flex:1;min-width:220px;">
            <label>Nome do programa</label>
            <input class="search-input" id="cfg-name" value="${escapeHtml(name)}" style="width:100%;padding:0 13px;">
          </div>
          <div class="field-group">
            <label>Área</label>
            <select class="select-input" id="cfg-area">
              <option value="">Não definida</option>
              ${areaOptions}
            </select>
          </div>
        </div>
        <div class="filter-row" style="margin-bottom:12px;">
          <div class="field-group">
            <label>Status do programa</label>
            <select class="select-input" id="cfg-status">
              ${statusOptions}
            </select>
          </div>
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Frequência de aplicação</label>
          <div class="filter-row" style="align-items:flex-end;">
            <div class="field-group">
              <label style="font-size:11px;">Vezes</label>
              <input type="number" min="1" max="15" class="search-input" id="cfg-freq-quantidade" value="${frequencyQuantidade}" style="width:80px;">
            </div>
            <div class="field-group">
              <label style="font-size:11px;">Por</label>
              <select class="select-input" id="cfg-freq-periodo" style="width:120px;">
                ${periodoOptions}
              </select>
            </div>
            <div class="field-group">
              <label style="font-size:11px;">Duração</label>
              <input type="number" min="1" max="60" class="search-input" id="cfg-freq-duracao" value="${frequencyDuracao}" style="width:80px;">
            </div>
            <div class="field-group">
              <label style="font-size:11px;">Unidade</label>
              <select class="select-input" id="cfg-freq-unidade" style="width:120px;">
                ${unidadeOptions}
              </select>
            </div>
          </div>
          <div class="footnote" id="cfg-freq-preview" style="margin:8px 0 0;padding:6px 10px;"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(frequencyDescricao({ quantidade: frequencyQuantidade, periodo: frequencyPeriodo, duracao: frequencyDuracao, unidade: frequencyUnidade }) || '')}</div>
        </div>
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
          <label style="flex-direction:row;align-items:center;gap:8px;">
            <input type="checkbox" id="cfg-helps-count-enabled" ${helpsCountRequired ? 'checked' : ''}> Definir quantidade de ajudas
          </label>
          <input type="number" min="1" max="10" class="search-input" id="cfg-helps-count" value="${helpsCount ?? ''}" style="width:100px;margin-top:6px;" ${helpsCountRequired ? '' : 'disabled'}>
        </div>
        <div class="field-group" style="margin-bottom:12px;">
          <label>Estímulos a apresentar (define o que a tela de evolução oferece para registro)</label>
          <div class="aba-stimulus-checks">
            ${stimulusChecks}
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn btn-primary btn-sm" type="button" id="cfg-save"><i class="fa-solid fa-floppy-disk"></i> Salvar configuração</button>
        </div>
      </div>
    </div>`;
}

function atualizarPreviewFrequencia() {
  const preview = qs('#cfg-freq-preview');
  if (!preview) return;
  const descricao = frequencyDescricao({
    quantidade: parseInt(qs('#cfg-freq-quantidade').value, 10),
    periodo: qs('#cfg-freq-periodo').value,
    duracao: parseInt(qs('#cfg-freq-duracao').value, 10),
    unidade: qs('#cfg-freq-unidade').value,
  });
  preview.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escapeHtml(descricao || '')}`;
}

function bindConfigForm(program) {
  qsa('#cfg-freq-quantidade, #cfg-freq-periodo, #cfg-freq-duracao, #cfg-freq-unidade').forEach((el) => {
    el.addEventListener('input', atualizarPreviewFrequencia);
    el.addEventListener('change', atualizarPreviewFrequencia);
  });

  qsa('[data-cfg-stimulus]').forEach((cb) => {
    cb.addEventListener('change', () => {
      cb.closest('.aba-stimulus-check').classList.toggle('checked', cb.checked);
    });
  });

  const helpsCountEnabled = qs('#cfg-helps-count-enabled');
  const helpsCountInput = qs('#cfg-helps-count');
  helpsCountEnabled.addEventListener('change', () => {
    helpsCountInput.disabled = !helpsCountEnabled.checked;
  });

  qs('#cfg-save').addEventListener('click', () => {
    const stimulusIds = qsa('[data-cfg-stimulus]').filter((cb) => cb.checked).map((cb) => cb.dataset.cfgStimulus);
    if (!stimulusIds.length) {
      Toast.show('Selecione ao menos um estímulo.', { kind: 'warning' });
      return;
    }
    const name = qs('#cfg-name').value.trim();
    if (!name) {
      Toast.show('Preencha o nome do programa.', { kind: 'warning' });
      return;
    }

    const promptMode = qs('#cfg-prompt-mode').value;
    const helpTypeIds = estado.helpTypes
      .map((h) => h.id)
      .sort((a, b) => {
        const ha = estado.helpTypeById.get(a).order;
        const hb = estado.helpTypeById.get(b).order;
        if (promptMode === 'least_to_most') return ha - hb;
        if (promptMode === 'custom') return 0;
        return hb - ha;
      });

    const helpsCount = helpsCountEnabled.checked ? (parseInt(helpsCountInput.value, 10) || 1) : null;

    const newConfig = {
      name,
      areaId: qs('#cfg-area').value || null,
      frequencyQuantidade: parseInt(qs('#cfg-freq-quantidade').value, 10) || 1,
      frequencyPeriodo: qs('#cfg-freq-periodo').value,
      frequencyDuracao: parseInt(qs('#cfg-freq-duracao').value, 10) || 1,
      frequencyUnidade: qs('#cfg-freq-unidade').value,
      statusId: qs('#cfg-status').value,
      model: qs('#cfg-model').value,
      promptHierarchyMode: promptMode,
      helpTypeIds,
      stimulusIds,
      attemptsPerStimulus: parseInt(qs('#cfg-attempts').value, 10) || 1,
      masteryCriteriaPercent: parseInt(qs('#cfg-mastery').value, 10) || 80,
      helpsCount,
    };
    if (program.config?.masteryCriteriaNote) {
      newConfig.masteryCriteriaNote = program.config.masteryCriteriaNote;
    }

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

function bindGotoPei() {
  qsa('[data-goto-pei]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Router.resetAll(['s-dashboard']);
      Router.go('s-pei');
    });
  });
}

export async function mount() {
  const patientId = Patient.getCurrentId();
  const [aba, patient, config, areas, stimuli, helpTypes, peiDoc, inventario] = await Promise.all([
    Store.load('aba', patientId),
    Store.load('patient', patientId),
    Config.load(),
    Catalog.listAreas(),
    Catalog.listStimuli(),
    Catalog.listHelpTypes(),
    carregarDocumento('pei', patientId),
    carregarInventario(),
  ]);
  const root = qs('#s-aba');

  estado = {
    patientId,
    config,
    areas,
    stimuli,
    helpTypes,
    stimulusById: new Map(stimuli.map((s) => [s.id, s])),
    helpTypeById: new Map(helpTypes.map((h) => [h.id, h])),
    areaById: new Map(areas.map((a) => [a.id, a])),
  };

  const programasPei = peiDoc.programas || [];
  const peiCards = programasPei.map((p) => peiProgramCard(p, inventario)).join('');

  if (aba.empty) {
    if (!programasPei.length) {
      root.innerHTML = `
        <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
        <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
        ${emptyState(aba.reason)}
      `;
      return;
    }

    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${peiCards}
    `;
    bindGotoPei();
    return;
  }

  const cards = aba.programs.map((p) => (p.config ? activeProgram(p) : draftProgram(p))).join('');

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-star-of-life"></i> Programas de intervenção ABA</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · componente comportamental vinculado ao PTS v${escapeHtml(patient.version)} · supervisor: ${escapeHtml(patient.caseSupervisor || 'não definido')}</div>

    <div class="footnote" style="margin-bottom:18px;"><i class="fa-solid fa-circle-info"></i>${escapeHtml(aba.notice)}</div>

    ${cards}
    ${peiCards}
  `;

  bindConfigToggles(aba.programs);
  bindGotoPei();
}
