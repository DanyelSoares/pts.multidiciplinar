import Store from './store.js';
import Patient from './patient.js';
import Router from './router.js';
import Config from './config.js';
import { escapeHtml, qs, qsa } from './dom.js';

const PATIENT_SCREENS = ['s-interview', 's-severidade', 's-needs', 's-goals', 's-aba', 's-team', 's-validation'];

let allPatients = [];
let statusById = new Map();
let isOpen = false;

function statusPill(p) {
  const status = statusById.get(p.statusId);
  if (!status) return '';
  return `<span class="pill ${status.kind}">${escapeHtml(status.label)}</span>`;
}

function optionRow(p) {
  const active = Patient.normalize(p.id) === Patient.getCurrentId();
  return `
    <div class="patient-switch-option${active ? ' active' : ''}" data-id="${escapeHtml(p.id)}">
      <div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="sub">${escapeHtml(p.id)} · ${escapeHtml(p.supervisor || 'não definido')}</div>
      </div>
      ${statusPill(p)}
    </div>`;
}

function renderPanel(filterText = '') {
  const panel = qs('#patient-switch-panel');
  if (!panel) return;
  const q = filterText.trim().toLowerCase();
  const filtered = q
    ? allPatients.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.supervisor || '').toLowerCase().includes(q))
    : allPatients;

  panel.innerHTML = `
    <div class="search-wrap" style="margin-bottom:10px;">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input class="search-input" id="patient-switch-search" placeholder="Buscar paciente por nome, ID ou supervisor..." value="${escapeHtml(filterText)}">
    </div>
    <div class="patient-switch-list">
      ${filtered.length ? filtered.map(optionRow).join('') : '<div class="patient-switch-empty">Nenhum paciente encontrado.</div>'}
    </div>`;

  const searchInput = qs('#patient-switch-search');
  searchInput.addEventListener('input', () => renderPanel(searchInput.value));
  searchInput.focus();
  searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);

  qsa('.patient-switch-option').forEach((el) => {
    el.addEventListener('click', () => selectPatient(el.dataset.id));
  });
}

function selectPatient(id) {
  const current = Router.current();
  Patient.setCurrentId(id);
  Router.resetAll(['s-dashboard']);
  closePanel();
  Router.go(PATIENT_SCREENS.includes(current) ? current : 's-goals');
}

function openPanel() {
  isOpen = true;
  qs('#patient-switcher').classList.add('open');
  renderPanel('');
  document.addEventListener('click', handleOutsideClick, true);
}

function closePanel() {
  isOpen = false;
  const el = qs('#patient-switcher');
  if (el) el.classList.remove('open');
  document.removeEventListener('click', handleOutsideClick, true);
}

function handleOutsideClick(e) {
  const el = qs('#patient-switcher');
  if (el && !el.contains(e.target)) closePanel();
}

function togglePanel() {
  if (isOpen) closePanel();
  else openPanel();
}

async function renderCurrentLabel() {
  const id = Patient.getCurrentId();
  const patient = allPatients.find((p) => Patient.normalize(p.id) === id);
  const label = qs('#patient-switch-label');
  if (!label) return;
  if (patient) {
    label.innerHTML = `<b>${escapeHtml(patient.name)}</b> <span class="dim">${escapeHtml(patient.id)}</span>`;
  } else {
    label.textContent = `Paciente ${id}`;
  }
}

function setVisible(visible) {
  const el = qs('#patient-switcher');
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
  if (!visible) closePanel();
}

async function refresh() {
  allPatients = await Store.loadDashboardPatients();
}

async function init() {
  const config = await Config.load();
  statusById = new Map(config.patientStatuses.map((s) => [s.id, s]));
  await refresh();

  const el = qs('#patient-switcher');
  if (!el) return;

  el.innerHTML = `
    <button type="button" class="patient-switch-trigger" id="patient-switch-trigger">
      <i class="fa-solid fa-user"></i>
      <span id="patient-switch-label"></span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>
    <div class="patient-switch-panel" id="patient-switch-panel"></div>
  `;

  qs('#patient-switch-trigger').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  renderCurrentLabel();

  Router.onChange((screenId) => {
    setVisible(PATIENT_SCREENS.includes(screenId));
    renderCurrentLabel();
    if (screenId === 's-dashboard') refresh();
  });

  Patient.onPopState(() => renderCurrentLabel());

  setVisible(PATIENT_SCREENS.includes(Router.current()));
}

const PatientSwitcher = { init, refresh };

export default PatientSwitcher;
