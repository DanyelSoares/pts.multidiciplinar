import { qs, qsa } from '../core/dom.js';
import * as areas from './config/areas.js';
import * as stimuli from './config/stimuli.js';
import * as helpTypes from './config/helpTypes.js';
import * as anamneses from './config/anamneses.js';
import * as programModels from './config/programModels.js';

const SECTIONS = [
  { id: 'anamneses', label: 'Anamneses', icon: 'fa-file-waveform', mod: anamneses },
  { id: 'areas', label: 'Áreas', icon: 'fa-layer-group', mod: areas },
  { id: 'stimuli', label: 'Estímulos', icon: 'fa-shapes', mod: stimuli },
  { id: 'helpTypes', label: 'Tipos de ajuda', icon: 'fa-hands-holding-circle', mod: helpTypes },
  { id: 'programModels', label: 'Modelos de programa', icon: 'fa-star-of-life', mod: programModels },
];

let activeSection = 'anamneses';

function switcherButton(section) {
  return `<button type="button" class="tab-btn${section.id === activeSection ? ' active' : ''}" data-section="${section.id}">
    <i class="fa-solid ${section.icon}"></i> ${section.label}
  </button>`;
}

async function renderContent() {
  const content = qs('#config-content');
  if (!content) return;
  const section = SECTIONS.find((s) => s.id === activeSection);
  await section.mod.render(content);
}

function bindSwitcher() {
  qsa('#config-section-switcher [data-section]').forEach((el) => {
    el.addEventListener('click', () => {
      activeSection = el.dataset.section;
      qsa('#config-section-switcher [data-section]').forEach((item) => {
        item.classList.toggle('active', item.dataset.section === activeSection);
      });
      renderContent();
    });
  });
}

export async function mount() {
  const root = qs('#s-config');
  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-gear"></i> Configurações</div>
    <div class="screen-desc">Catálogos e modelos usados nas telas de paciente — áreas, estímulos, tipos de ajuda, anamneses e modelos de programa ABA.</div>

    <nav class="section-switcher" id="config-section-switcher">
      ${SECTIONS.map(switcherButton).join('')}
    </nav>

    <div class="section-content" id="config-content"></div>
  `;

  bindSwitcher();
  await renderContent();
}
