import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Router from '../core/router.js';
import Toast from '../core/toast.js';
import Config from '../core/config.js';
import NewPatientModal from '../core/newPatientModal.js';
import { escapeHtml, qs, qsa } from '../core/dom.js';

let allPatients = [];
let statusById = new Map();
let alertById = new Map();

function kpiCard(kpi) {
  return `
    <div class="stat-card ${kpi.kind}">
      <div class="stat-icon ${kpi.kind}"><i class="fa-solid ${kpi.icon} ${kpi.kind}"></i></div>
      <div class="stat-label">${escapeHtml(kpi.label)}</div>
      <div class="stat-value">${kpi.value}</div>
    </div>`;
}

function alertPill(alertId) {
  if (!alertId) return '—';
  const alert = alertById.get(alertId);
  if (!alert) return '—';
  return `<span class="pill ${alert.kind}">${escapeHtml(alert.label)}</span>`;
}

function actionLabel(p) {
  const status = statusById.get(p.statusId);
  const kind = status ? status.kind : null;
  if (kind === 'warn') return 'Validar';
  if (kind === 'risk') return 'Continuar';
  if (kind === 'info') return 'Revisar';
  return 'Abrir';
}

function patientRow(p) {
  const status = statusById.get(p.statusId);
  return `
    <tr data-id="${escapeHtml(p.id)}">
      <td><a class="id-link" href="#" data-open="${escapeHtml(p.id)}">${escapeHtml(p.id)}</a></td>
      <td><div class="patient-name">${escapeHtml(p.name)}</div><div class="patient-sub">${escapeHtml(p.record)}</div></td>
      <td>${p.supervisor ? escapeHtml(p.supervisor) : '<span class="pill muted">não definido</span>'}</td>
      <td>${escapeHtml(p.version)}</td>
      <td><span class="pill ${status ? status.kind : 'muted'}">${escapeHtml(status ? status.label : '—')}</span></td>
      <td>${escapeHtml(p.nextReview)}</td>
      <td><div class="progress"><span style="width:${p.progress}%"></span></div></td>
      <td>${alertPill(p.alertId)}</td>
      <td><button class="btn btn-ghost btn-sm" data-open="${escapeHtml(p.id)}">${actionLabel(p)}</button></td>
    </tr>`;
}

function renderRows(patients) {
  qs('#patients-tbody').innerHTML = patients.map(patientRow).join('');
  bindRowNavigation();
}

function bindRowNavigation() {
  qsa('[data-open]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      Patient.setCurrentId(el.dataset.open);
      Router.resetAll(['s-dashboard']);
      Router.go('s-goals');
    });
  });
}

function applyFilters() {
  const nameQuery = qs('#filter-name').value.trim().toLowerCase();
  const unit = qs('#filter-unit').value;
  const supervisor = qs('#filter-supervisor').value;
  const status = qs('#filter-status').value;

  const filtered = allPatients.filter((p) => {
    if (nameQuery && !p.name.toLowerCase().includes(nameQuery)) return false;
    if (unit !== 'Todas' && p.unit !== unit) return false;
    if (supervisor !== 'Todos' && p.supervisor !== supervisor) return false;
    if (status !== 'Todas') {
      const s = statusById.get(p.statusId);
      if (!s || s.label !== status) return false;
    }
    return true;
  });

  renderRows(filtered);
}

function resetFilters() {
  qs('#filter-name').value = '';
  qs('#filter-unit').selectedIndex = 0;
  qs('#filter-supervisor').selectedIndex = 0;
  qs('#filter-status').selectedIndex = 0;
  renderRows(allPatients);
}

function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function mount() {
  const root = qs('#s-dashboard');
  const [patients, dashboard, config] = await Promise.all([Store.loadDashboardPatients(), Store.load('dashboard'), Config.load()]);
  allPatients = patients;
  statusById = new Map(config.patientStatuses.map((s) => [s.id, s]));
  alertById = new Map(config.alerts.map((a) => [a.id, a]));

  const units = uniqueOptions(allPatients.map((p) => p.unit || 'Mais Saúde — Unidade Poço'));
  const supervisors = uniqueOptions(allPatients.map((p) => p.supervisor));
  const statuses = config.patientStatuses.map((s) => s.label);

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-chart-column"></i> Painel de PTS</div>
    <div class="screen-desc">Visão consolidada de todos os Projetos Terapêuticos Singulares — entrevistas, elaboração, validação e revisões pendentes.</div>

    <div class="stat-grid">${dashboard.kpis.map(kpiCard).join('')}</div>

    <div class="filter-bar">
      <div class="filter-bar-header">
        <div class="filter-bar-header-icon"><i class="fa-solid fa-sliders"></i></div>
        <div class="filter-bar-header-title">Filtros do painel</div>
      </div>
      <div class="filter-bar-body">
        <div class="filter-row">
          <div class="field-group" style="flex:1;min-width:220px;">
            <label><i class="fa-solid fa-magnifying-glass"></i> Paciente</label>
            <div class="search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input class="search-input" id="filter-name" placeholder="Buscar pelo nome..."></div>
          </div>
          <div class="field-group">
            <label><i class="fa-solid fa-building"></i> Unidade</label>
            <div class="select-wrap"><i class="fa-solid fa-building"></i><select class="select-input" id="filter-unit"><option>Todas</option>${units.map((u) => `<option>${escapeHtml(u)}</option>`).join('')}</select></div>
          </div>
          <div class="field-group">
            <label><i class="fa-solid fa-user-doctor"></i> Supervisor</label>
            <div class="select-wrap"><i class="fa-solid fa-user-doctor"></i><select class="select-input" id="filter-supervisor"><option>Todos</option>${supervisors.map((c) => `<option>${escapeHtml(c)}</option>`).join('')}</select></div>
          </div>
          <div class="field-group">
            <label><i class="fa-solid fa-flag"></i> Situação</label>
            <div class="select-wrap"><i class="fa-solid fa-flag"></i><select class="select-input" id="filter-status"><option>Todas</option>${statuses.map((s) => `<option>${escapeHtml(s)}</option>`).join('')}</select></div>
          </div>
          <div class="field-group">
            <button class="btn-filter btn-filter-primary" type="button" id="btn-apply-filters"><i class="fa-solid fa-filter"></i> Filtrar</button>
          </div>
          <div class="field-group">
            <button class="btn-filter btn-filter-ghost" type="button" id="btn-reset-filters"><i class="fa-solid fa-rotate-left"></i></button>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h3>Pacientes acompanhados</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" type="button" id="btn-export"><i class="fa-solid fa-file-export"></i> Exportar</button>
          <button class="btn btn-primary btn-sm" type="button" id="btn-new-pts"><i class="fa-solid fa-plus"></i> Iniciar novo PTS</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>ID</th><th>Paciente / Carteirinha</th><th>Supervisor</th><th>Versão</th><th>Situação</th><th>Próx. revisão</th><th>Progresso</th><th>Alertas</th><th></th></tr>
            </thead>
            <tbody id="patients-tbody">${allPatients.map(patientRow).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="footnote"><i class="fa-solid fa-circle-info"></i>Toda sugestão automática exibida neste módulo é apresentada como recomendação pendente de validação profissional — nenhuma decisão clínica é tomada de forma autônoma pelo sistema.</div>
  `;

  bindRowNavigation();

  qs('#btn-apply-filters').addEventListener('click', applyFilters);
  qs('#btn-reset-filters').addEventListener('click', resetFilters);
  qs('#filter-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilters();
  });

  qs('#btn-export').addEventListener('click', () => {
    Toast.show('Exportação simulada — nenhum arquivo real gerado neste protótipo.', { kind: 'info' });
  });
  qs('#btn-new-pts').addEventListener('click', () => {
    NewPatientModal.open(units);
  });
}
