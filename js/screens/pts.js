import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Toast from '../core/toast.js';
import LocalData from '../core/localData.js';
import { carregarInventario, buscarItemPorId } from '../core/portage.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

function carregarDocumento(name, patientId) {
  const local = LocalData.getDoc(name, patientId);
  if (local) return Promise.resolve(local);
  return Store.load(name, patientId);
}

function kv(k, v) {
  return `<div class="kv"><div class="k">${escapeHtml(k)}</div><div class="v">${v}</div></div>`;
}

function sectionA(pts) {
  const id = pts.identification;
  return `
    <div class="panel">
      <div class="panel-header"><h3>A · Identificação</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="kv-grid">
          ${kv('Paciente', escapeHtml(id.patient))}
          ${kv('Prontuário', escapeHtml(id.record))}
          ${kv('Unidade', escapeHtml(id.unit))}
          ${kv('Versão', escapeHtml(id.version))}
          ${kv('Situação', `<span class="pill info">${escapeHtml(id.status)}</span>`)}
          ${kv('Período de vigência', escapeHtml(id.validity))}
          ${kv('Próxima revisão', escapeHtml(id.nextReview))}
          ${kv('Supervisor do caso', escapeHtml(id.supervisor))}
        </div>
      </div>
    </div>`;
}

function sectionB(pts) {
  const blocks = pts.synthesis
    .map(
      (b) => `<div class="narrative-block"><h5><i class="fa-solid ${b.icon}"></i> ${escapeHtml(b.title)}</h5><p>${escapeHtml(b.text)}</p></div>`
    )
    .join('');
  return `
    <div class="panel">
      <div class="panel-header"><h3>B · Síntese da situação</h3></div>
      <div class="panel-body" style="padding-top:14px;">${blocks}</div>
    </div>`;
}

function sectionC(pts) {
  const rows = pts.diagnosis.rows
    .map((r) => `<tr><td>${escapeHtml(r.domain)}</td><td>${escapeHtml(r.impact)}</td><td>${escapeHtml(r.environments)}</td><td>${escapeHtml(r.source)}</td></tr>`)
    .join('');
  return `
    <div class="panel">
      <div class="panel-header"><h3>C · Diagnóstico situacional e funcional</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <p style="font-size:12.5px;color:var(--muted);line-height:1.6;max-width:720px;margin-bottom:14px;">${escapeHtml(pts.diagnosis.intro)}</p>
        <table>
          <thead><tr><th>Domínio</th><th>Impacto funcional</th><th>Ambientes</th><th>Fonte</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="q-note" style="margin-top:14px;">${escapeHtml(pts.diagnosis.note)}</div>
      </div>
    </div>`;
}

function sectionD(pts) {
  const chips = pts.generalGoals
    .map((g) => `<span class="general-goal-chip"><i class="fa-solid ${g.icon}"></i> ${escapeHtml(g.label)}</span>`)
    .join('');
  return `
    <div class="panel">
      <div class="panel-header"><h3>D · Objetivos gerais</h3></div>
      <div class="panel-body" style="padding-top:14px;">${chips}</div>
    </div>`;
}

function goalCard(g) {
  const progressBlock = g.progress === null ? '' : `
    <div class="goal-progress-row">
      <div class="progress"><span style="width:${g.progress}%"></span></div>
      <span style="font-size:11.5px; color:var(--muted);">${escapeHtml(g.progressNote)}</span>
    </div>`;
  return `
    <div class="goal-card">
      <div class="goal-head">
        <div class="title">${escapeHtml(g.title)}</div>
        <span class="pill ${g.status}">${escapeHtml(g.statusLabel)}</span>
      </div>
      <div class="goal-meta-row">
        <div><b>Domínio:</b> ${escapeHtml(g.domain)}</div>
        <div><b>Responsável:</b> ${escapeHtml(g.responsible)}</div>
        <div><b>Meta:</b> ${escapeHtml(g.goal)}</div>
        <div><b>Prazo:</b> ${escapeHtml(g.deadline)}</div>
      </div>
      ${progressBlock}
    </div>`;
}

function peiObjetivoResumo(objetivo, inventario, area) {
  const item = buscarItemPorId(objetivo.itemId);
  return `
    <div class="kv">
      <div class="k">${escapeHtml(area ? area.nome : objetivo.area)}</div>
      <div class="v">${escapeHtml(objetivo.descricao)}${item ? ` <span class="pill muted" style="margin-left:6px;">${escapeHtml(item.id)}</span>` : ''}</div>
    </div>`;
}

function secaoObjetivosPei(peiDoc, inventario) {
  const longoPrazo = peiDoc.objetivosLongoPrazo || [];
  const curtoMedioPrazo = peiDoc.objetivosCurtoMedioPrazo || [];
  if (!longoPrazo.length && !curtoMedioPrazo.length) return '';

  const areaPorId = (id) => inventario.areas.find((a) => a.id === id);

  const blocoLongoPrazo = longoPrazo.length
    ? `<div class="pts-pei-bloco"><span class="pill info">Longo prazo</span><div class="kv-grid" style="margin-top:10px;">${longoPrazo.map((o) => peiObjetivoResumo(o, inventario, areaPorId(o.area))).join('')}</div></div>`
    : '';

  const blocoCurtoMedioPrazo = curtoMedioPrazo.length
    ? `<div class="pts-pei-bloco" style="margin-top:16px;"><span class="pill warn">Curto e médio prazo</span><div class="kv-grid" style="margin-top:10px;">${curtoMedioPrazo.map((o) => peiObjetivoResumo(o, inventario, areaPorId(o.area))).join('')}</div></div>`
    : '';

  return `
    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Objetivos do PEI</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        ${blocoLongoPrazo}
        ${blocoCurtoMedioPrazo}
        <div class="footnote" style="margin-top:14px;"><i class="fa-solid fa-circle-info"></i>Objetivos derivados do Inventário Portage — edite-os na tela PEI. Esta lista é independente dos objetivos específicos acima, escritos pela equipe.</div>
      </div>
    </div>`;
}

function sectionE(pts, extras) {
  const cards = pts.specificGoals.map(goalCard).join('');
  const checklist = pts.goalChecklist
    .map((c) => `<span class="pill ${c.ok ? 'ok' : 'warn'}">${escapeHtml(c.label)}</span>`)
    .join('');
  const objetivosPei = extras ? secaoObjetivosPei(extras.peiDoc, extras.inventario) : '';
  return `
    <div class="panel">
      <div class="panel-header"><h3>E · Objetivos específicos</h3><button class="btn btn-primary btn-sm" type="button" id="btn-new-goal"><i class="fa-solid fa-plus"></i> Novo objetivo</button></div>
      <div class="panel-body" style="padding-top:14px;">${cards}</div>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>Verificador de objetivo mensurável</h3></div>
      <div class="panel-body" style="padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">${checklist}</div>
    </div>
    ${objetivosPei}`;
}

function sectionF(pts) {
  const rows = pts.plans
    .map(
      (p) => `<tr><td>${escapeHtml(p.goal)}</td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(p.responsible)}</td><td>${escapeHtml(p.environments)}</td><td><span class="pill ${p.status}">${escapeHtml(p.statusLabel)}</span></td></tr>`
    )
    .join('');
  return `
    <div class="panel">
      <div class="panel-header"><h3>F · Planos e estratégias vinculados</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <table>
          <thead><tr><th>Objetivo relacionado</th><th>Tipo de plano</th><th>Responsável</th><th>Ambientes</th><th>Situação</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function sectionG(pts) {
  const m = pts.monitoring;
  return `
    <div class="panel">
      <div class="panel-header"><h3>G · Monitoramento</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="kv-grid">
          ${kv('Indicador principal', escapeHtml(m.indicator))}
          ${kv('Forma de coleta', escapeHtml(m.collection))}
          ${kv('Periodicidade de análise', escapeHtml(m.periodicity))}
          ${kv('Próxima análise', escapeHtml(m.nextAnalysis))}
        </div>
      </div>
    </div>`;
}

function sectionH(pts) {
  const rows = pts.approvals
    .map(
      (a) => `<div class="approval-row"><div><div class="who">${escapeHtml(a.who)}</div><div class="role">${escapeHtml(a.role)}</div></div><span class="pill ${a.status}">${escapeHtml(a.statusLabel)}</span></div>`
    )
    .join('');
  return `
    <div class="panel">
      <div class="panel-header"><h3>H · Validações</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="approval-grid">${rows}</div>
        <div class="footnote" style="margin-top:16px;"><i class="fa-solid fa-circle-info"></i>Consulte a aba Validação &amp; versões para acompanhar o fluxo completo de aprovação e publicação desta versão.</div>
      </div>
    </div>`;
}

const SECTION_BUILDERS = { a: sectionA, b: sectionB, c: sectionC, d: sectionD, e: sectionE, f: sectionF, g: sectionG, h: sectionH };
const SECTION_LABELS = {
  a: 'A · Identificação', b: 'B · Síntese da situação', c: 'C · Diagnóstico situacional',
  d: 'D · Objetivos gerais', e: 'E · Objetivos específicos', f: 'F · Planos e estratégias',
  g: 'G · Monitoramento', h: 'H · Validações'
};

function switchSection(sec) {
  qsa('#pts-section-nav button').forEach((b) => b.classList.toggle('active', b.dataset.sec === sec));
  qsa('.pts-section').forEach((s) => s.classList.toggle('active', s.id === `pts-${sec}`));
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [pts, patient, peiDoc, inventario] = await Promise.all([
    Store.load('pts', id),
    Store.load('patient', id),
    carregarDocumento('pei', id),
    carregarInventario(),
  ]);
  const root = qs('#s-goals');

  if (pts.empty) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-bullseye"></i> PTS — minuta e objetivos</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState(pts.reason)}
    `;
    return;
  }

  const extras = { peiDoc, inventario };

  const nav = Object.keys(SECTION_BUILDERS)
    .map((sec) => `<button class="${sec === 'a' ? 'active' : ''}" data-sec="${sec}">${escapeHtml(SECTION_LABELS[sec])}</button>`)
    .join('');

  const sections = Object.keys(SECTION_BUILDERS)
    .map((sec) => `<div class="pts-section${sec === 'a' ? ' active' : ''}" id="pts-${sec}">${SECTION_BUILDERS[sec](pts, extras)}</div>`)
    .join('');

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-bullseye"></i> PTS — minuta e objetivos</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · versão ${escapeHtml(pts.identification.version)} (${escapeHtml(pts.identification.status)}) · supervisor do caso: ${escapeHtml(pts.identification.supervisor)}</div>

    <div class="pts-section-nav" id="pts-section-nav">${nav}</div>
    ${sections}
  `;

  qsa('#pts-section-nav button').forEach((btn) => {
    btn.addEventListener('click', () => switchSection(btn.dataset.sec));
  });

  qs('#btn-new-goal').addEventListener('click', () => {
    Toast.show('Criação de novo objetivo ainda não implementada neste protótipo.', { kind: 'warning' });
  });
}
