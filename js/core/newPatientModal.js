import LocalData from './localData.js';
import Patient from './patient.js';
import Router from './router.js';
import Toast from './toast.js';
import { escapeHtml, qs, qsa } from './dom.js';

const EMPTY_REASONS = {
  needs: 'Este paciente ainda não possui Mapa de necessidades — conclua a anamnese para gerá-lo.',
  pts: 'Este paciente ainda não possui um PTS — a minuta será gerada após a conclusão da anamnese inicial e do Mapa de necessidades.',
  aba: 'Este paciente ainda não possui Programas ABA — eles são vinculados a objetivos aprovados do PTS, que ainda não existe.',
  team: 'Este paciente ainda não possui equipe definida — nenhum supervisor de caso foi atribuído até a conclusão da anamnese inicial.',
  validation: 'Este paciente ainda não possui versões de PTS para validar — a primeira versão será criada após a conclusão da anamnese inicial.',
};

const FIELDS = [
  { id: 'name', label: 'Nome completo da criança', required: true, placeholder: 'Ex.: João Pedro da Silva' },
  { id: 'record', label: 'Prontuário / carteirinha', required: true, placeholder: 'Ex.: 0000000.00' },
  { id: 'respondent', label: 'Respondente', required: true, placeholder: 'Ex.: mãe (responsável legal)' },
  { id: 'interviewer', label: 'Entrevistador', required: true, placeholder: 'Ex.: Dra. Camila Souza' },
  { id: 'supervisor', label: 'Supervisor do caso (opcional)', required: false, placeholder: 'Ex.: Dr. Bruno Alencar' },
];

let unitOptions = [];

function fieldGroup(field) {
  return `
    <div class="field-group" style="margin-bottom:12px;">
      <label>${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
      <input class="search-input" id="np-${field.id}" placeholder="${escapeHtml(field.placeholder)}" style="width:100%;padding:0 13px;">
    </div>`;
}

function formatNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function readValues() {
  const values = {};
  FIELDS.forEach((f) => { values[f.id] = qs(`#np-${f.id}`).value.trim(); });
  return values;
}

function validate(values) {
  let valid = true;
  FIELDS.forEach((f) => {
    const input = qs(`#np-${f.id}`);
    const invalid = f.required && !values[f.id];
    input.style.borderColor = invalid ? 'var(--danger)' : '';
    if (invalid) valid = false;
  });
  return valid;
}

function createPatient(values) {
  const id = LocalData.nextId();
  const fullId = `#${id}`;
  const unit = qs('#np-unit').value || (unitOptions[0] || 'Mais Saúde — Unidade Poço');

  const patient = {
    id: fullId,
    name: values.name,
    fullName: values.name.toUpperCase(),
    record: values.record,
    unit,
    version: null,
    statusId: 'interview_in_progress',
    validityStart: null,
    validityEnd: null,
    nextReview: '—',
    caseSupervisor: values.supervisor || null,
    respondent: values.respondent,
    interviewer: values.interviewer,
  };

  const anamnese = {
    selectedTemplateIds: [],
    answers: {},
    startedAt: formatNow(),
    currentIndex: 0,
  };

  const dashboardRow = {
    id: fullId,
    name: patient.fullName,
    record: patient.record,
    unit,
    supervisor: values.supervisor || null,
    version: '—',
    statusId: 'interview_in_progress',
    nextReview: '—',
    progress: 0,
    alertId: null,
  };

  return LocalData.createPatient({ patient, anamnese, dashboardRow, emptyReasons: EMPTY_REASONS });
}

function close() {
  const el = qs('#new-patient-modal');
  if (el) el.classList.remove('open');
}

function bindEvents() {
  qsa('.np-cancel-btn').forEach((btn) => btn.addEventListener('click', close));
  qs('#new-patient-modal').addEventListener('click', (e) => {
    if (e.target.id === 'new-patient-modal') close();
  });

  qs('#np-submit').addEventListener('click', () => {
    const values = readValues();
    if (!validate(values)) return;

    const newId = createPatient(values);
    Toast.show('Paciente criado com sucesso — selecione as anamneses a aplicar.', { kind: 'success' });
    close();
    Patient.setCurrentId(newId);
    Router.resetAll();
    Router.go('s-anamnese');
  });
}

function open(units = []) {
  unitOptions = units;
  const el = qs('#new-patient-modal');
  if (!el) return;

  const unitFieldHtml = `
    <div class="field-group" style="margin-bottom:12px;">
      <label>Unidade *</label>
      <select class="select-input" id="np-unit" style="width:100%;">
        ${units.map((u) => `<option>${escapeHtml(u)}</option>`).join('') || '<option>Mais Saúde — Unidade Poço</option>'}
      </select>
    </div>`;

  el.innerHTML = `
    <div class="modal-panel panel">
      <div class="panel-header">
        <h3><i class="fa-solid fa-user-plus"></i> Iniciar novo PTS</h3>
        <button type="button" class="modal-close np-cancel-btn" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="panel-body" style="padding-top:16px;">
        ${fieldGroup(FIELDS[0])}
        ${fieldGroup(FIELDS[1])}
        ${unitFieldHtml}
        ${fieldGroup(FIELDS[2])}
        ${fieldGroup(FIELDS[3])}
        ${fieldGroup(FIELDS[4])}
        <div class="footnote"><i class="fa-solid fa-circle-info"></i>Apenas os dados de identificação são coletados aqui. Diagnóstico, objetivos e equipe são construídos ao longo da anamnese e do PTS.</div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
          <button class="btn btn-ghost np-cancel-btn" type="button">Cancelar</button>
          <button class="btn btn-primary" type="button" id="np-submit"><i class="fa-solid fa-arrow-right"></i> Criar e selecionar anamneses</button>
        </div>
      </div>
    </div>`;

  bindEvents();
  el.classList.add('open');
  qs('#np-name').focus();
}

function init() {
  // container is created in index.html; nothing to pre-render.
}

const NewPatientModal = { init, open, close };

export default NewPatientModal;
