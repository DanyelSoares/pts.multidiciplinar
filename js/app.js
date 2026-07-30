import Router from './core/router.js';
import Patient from './core/patient.js';
import PatientSwitcher from './core/patientSwitcher.js';
import NewPatientModal from './core/newPatientModal.js';
import { qs } from './core/dom.js';
import * as dashboard from './screens/dashboard.js';
import * as patients from './screens/patients.js';
import { initRouterHighlight } from './screens/patients.js';
import * as anamneseAplicacao from './screens/anamneseAplicacao.js';
import * as severidade from './screens/severidade.js';
import * as needs from './screens/needs.js';
import * as portage from './screens/portage.js';
import * as portagePerfil from './screens/portagePerfil.js';
import * as pei from './screens/pei.js';
import * as pts from './screens/pts.js';
import * as aba from './screens/aba.js';
import * as team from './screens/team.js';
import * as validation from './screens/validation.js';
import * as config from './screens/config.js';

function renderDateTime() {
  const el = qs('#header-datetime');
  if (!el) return;
  const now = new Date();
  const formatted = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  el.textContent = `${capitalized} · Painel Mais Saúde`;
}

function bindClearFilters() {
  const btn = qs('#btn-clear-filters');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.search-input').forEach((el) => { el.value = ''; });
    document.querySelectorAll('.select-input').forEach((el) => { el.selectedIndex = 0; });
  });
}

Patient.clearOnBoot();

Router.register('s-dashboard', dashboard);
Router.register('s-patients', patients);
Router.register('s-anamnese', anamneseAplicacao);
Router.register('s-severidade', severidade);
Router.register('s-needs', needs);
Router.register('s-portage', portage);
Router.register('s-portage-perfil', portagePerfil);
Router.register('s-pei', pei);
Router.register('s-goals', pts);
Router.register('s-aba', aba);
Router.register('s-team', team);
Router.register('s-validation', validation);
Router.register('s-config', config);

Router.initTabs();
renderDateTime();
bindClearFilters();
initRouterHighlight();
PatientSwitcher.init();
NewPatientModal.init();

Patient.onPopState(() => {
  Router.resetAll(['s-dashboard', 's-config']);
  Router.go(Router.current() || 's-dashboard');
});

Router.go('s-dashboard');
