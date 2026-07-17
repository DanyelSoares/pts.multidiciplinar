import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Config from '../core/config.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

function needCard(n, sourceById, index) {
  const sourceTags = n.sources
    .map((id) => sourceById.get(id))
    .filter(Boolean)
    .map((s) => `<span class="tag-chip">${escapeHtml(s.label)}</span>`)
    .join('');
  return `
    <div class="need-card" data-need-index="${index}">
      <div class="domain-name">${escapeHtml(n.domain)}</div>
      <div class="need-level ${n.level}"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="source-tags">${sourceTags}</div>
      <p class="excerpt">${escapeHtml(n.excerpt)}</p>
      <div class="foot"><span>${escapeHtml(n.priority)}</span><button type="button" class="btn-review-link" data-review="${index}">Revisar</button></div>
    </div>`;
}

function bindDecision(explanation) {
  qsa('#explain-actions button').forEach((btn) => {
    btn.addEventListener('click', () => {
      qs('#explain-actions').style.display = 'none';
      const result = qs('#explain-result');
      const m = explanation.decisions[btn.dataset.decision];
      result.className = `pill ${m.pill}`;
      result.style.display = 'inline-flex';
      result.style.padding = '10px 14px';
      result.innerHTML = `<i class="fa-solid ${m.icon}"></i> ${escapeHtml(m.text)}`;
    });
  });
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [needs, patient, config] = await Promise.all([Store.load('needs', id), Store.load('patient', id), Config.load()]);
  const root = qs('#s-needs');

  if (needs.empty) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-map-location-dot"></i> Mapa de necessidades e potencialidades</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState(needs.reason)}
    `;
    return;
  }

  const sourceById = new Map(config.infoSources.map((s) => [s.id, s]));

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-map-location-dot"></i> Mapa de necessidades e potencialidades</div>
    <div class="screen-desc">Gerado a partir da ${escapeHtml(needs.sourceQuestionnaire)} · ${escapeHtml(patient.id)} · pendente de confirmação profissional em ${needs.pendingConfirmation} domínios</div>

    <div class="needs-grid">${needs.needs.map((n, i) => needCard(n, sourceById, i)).join('')}</div>

    <div class="panel" style="margin-top:18px;" id="explain-panel">
      <div class="panel-header"><h3>${escapeHtml(needs.explanation.title)}</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <p style="font-size:12.5px; color:var(--muted); max-width:640px; line-height:1.6; margin-bottom:14px;">
          ${escapeHtml(needs.explanation.text)}
        </p>
        <div id="explain-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" type="button" data-decision="confirmed">Confirmar</button>
          <button class="btn btn-ghost" type="button" data-decision="review">Solicitar avaliação complementar</button>
          <button class="btn btn-ghost" type="button" data-decision="rejected">Rejeitar com justificativa</button>
        </div>
        <div id="explain-result" style="display:none;margin-top:12px;"></div>
      </div>
    </div>
  `;

  bindDecision(needs.explanation);
  bindReviewLinks();
}

function bindReviewLinks() {
  qsa('[data-review]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = qs(`.need-card[data-need-index="${btn.dataset.review}"]`);
      const panel = qs('#explain-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (card) {
        card.classList.add('need-card-highlight');
        setTimeout(() => card.classList.remove('need-card-highlight'), 1500);
      }
    });
  });
}
