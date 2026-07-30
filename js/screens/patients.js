import Router from '../core/router.js';
import Store from '../core/store.js';
import Patient from '../core/patient.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

const SECTIONS = [
  { id: 's-severidade', label: 'Perfil de Severidade', icon: 'fa-chart-simple' },
  { id: 's-needs', label: 'Mapa de necessidades', icon: 'fa-map-location-dot' },
  { id: 's-aba', label: 'Programas ABA', icon: 'fa-star-of-life' },
  { id: 's-goals', label: 'PTS & Objetivos', icon: 'fa-bullseye' },
  { id: 's-team', label: 'Equipe', icon: 'fa-people-group' },
  { id: 's-anamnese', label: 'Anamnese', icon: 'fa-clipboard-question' },
  { id: 's-validation', label: 'Validação', icon: 'fa-check-double' },
  { id: 's-portage', label: 'Inventário Portage', icon: 'fa-list-check', breakBefore: true },
  { id: 's-pei', label: 'PEI', icon: 'fa-file-pen' },
  { id: 's-portage-perfil', label: 'Perfil de Desenvolvimento', icon: 'fa-chart-line' },
];

const PATIENT_SECTION_IDS = ['s-patients', ...SECTIONS.map((s) => s.id)];

function hasPatientInUrl() {
  return new URLSearchParams(location.search).has('patient');
}

function switcherButton(section, activeId) {
  const breakEl = section.breakBefore ? '<span class="section-switcher-break"></span>' : '';
  return `${breakEl}<button type="button" class="tab-btn${section.id === activeId ? ' active' : ''}" data-section="${section.id}">
    <i class="fa-solid ${section.icon}"></i> ${escapeHtml(section.label)}
  </button>`;
}

function bindSwitcher() {
  qsa('#patients-section-switcher [data-section]').forEach((el) => {
    el.addEventListener('click', () => {
      Router.go(el.dataset.section);
    });
  });
}

function renderSwitcher(activeId) {
  const el = qs('#patients-section-switcher');
  if (!el) return;
  el.innerHTML = SECTIONS.map((s) => switcherButton(s, activeId)).join('');
  bindSwitcher();
}

function setSwitcherVisible(visible) {
  const el = qs('#patients-section-switcher');
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
}

async function renderWithPatient(root) {
  const patientId = Patient.getCurrentId();
  const patient = await Store.load('patient', patientId);

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-user-group"></i> Pacientes</div>
    <div class="screen-desc">${escapeHtml(patient.fullName)} · ${escapeHtml(patient.id)} — selecione uma seção para visualizar os dados deste paciente</div>

    <div class="section-content">
      ${emptyState('Selecione uma das seções acima para visualizar os dados deste paciente.')}
    </div>
  `;
}

function renderWithoutPatient(root) {
  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-user-group"></i> Pacientes</div>
    <div class="screen-desc">Selecione um paciente para visualizar Anamnese, Perfil de Severidade, Mapa de necessidades, PTS &amp; Objetivos, Programas ABA, Equipe e Validação.</div>
    ${emptyState('Nenhum paciente selecionado — use o seletor de paciente no topo da tela para escolher ou criar um paciente.')}
  `;
}

async function render() {
  const root = qs('#s-patients');
  if (!root) return;
  if (hasPatientInUrl()) {
    await renderWithPatient(root);
  } else {
    renderWithoutPatient(root);
  }
}

export function initRouterHighlight() {
  Router.onChange((screenId) => {
    const isSection = SECTIONS.some((s) => s.id === screenId);
    const belongsToPatients = PATIENT_SECTION_IDS.includes(screenId);
    const patientsBtn = qs('.tab-btn[data-target="s-patients"]');
    if (patientsBtn) patientsBtn.classList.toggle('active', belongsToPatients);

    setSwitcherVisible(belongsToPatients && hasPatientInUrl());
    if (belongsToPatients && hasPatientInUrl()) {
      renderSwitcher(isSection ? screenId : null);
    }

    if (screenId === 's-patients') render();
  });
}

export async function mount() {
  await render();
}
