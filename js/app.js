import Router from './core/router.js';
import Patient from './core/patient.js';
import PatientSwitcher from './core/patientSwitcher.js';
import NewPatientModal from './core/newPatientModal.js';
import { qs } from './core/dom.js';
import * as dashboard from './screens/dashboard.js';
import * as interview from './screens/interview.js';
import * as severidade from './screens/severidade.js';
import * as needs from './screens/needs.js';
import * as pts from './screens/pts.js';
import * as aba from './screens/aba.js';
import * as team from './screens/team.js';
import * as validation from './screens/validation.js';

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

Router.register('s-dashboard', dashboard);
Router.register('s-interview', interview);
Router.register('s-severidade', severidade);
Router.register('s-needs', needs);
Router.register('s-goals', pts);
Router.register('s-aba', aba);
Router.register('s-team', team);
Router.register('s-validation', validation);

Router.initTabs();
renderDateTime();
bindClearFilters();
PatientSwitcher.init();
NewPatientModal.init();

Patient.onPopState(() => {
  Router.resetAll(['s-dashboard']);
  Router.go(Router.current() || 's-dashboard');
});

const hasPatientInUrl = new URLSearchParams(location.search).has('patient');
Router.go(hasPatientInUrl ? 's-goals' : 's-dashboard');
