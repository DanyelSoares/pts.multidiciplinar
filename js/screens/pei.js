import Store from '../core/store.js';
import Patient from '../core/patient.js';
import LocalData from '../core/localData.js';
import Toast from '../core/toast.js';
import { carregarInventario, buscarItemPorId } from '../core/portage.js';
import { derivarObjetivosPEI } from '../core/pei.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

let estado = null;

async function carregarDocumento(name, patientId) {
  const local = LocalData.getDoc(name, patientId);
  if (local) return local;
  return Store.load(name, patientId);
}

function salvar() {
  LocalData.saveDoc('pei', estado.patientId, estado.doc);
  Store.invalidate('pei', estado.patientId);
}

function areaNome(areaId) {
  return estado.inventario.areas.find((a) => a.id === areaId)?.nome || areaId;
}

function objetivoCard(objetivo, index) {
  const item = buscarItemPorId(objetivo.itemId);
  return `
    <div class="pei-objetivo-card" data-objetivo-index="${index}">
      <div class="pei-objetivo-header">
        <div>
          <span class="pill ${objetivo.prioridade === 'alta' ? 'warn' : 'info'}">${objetivo.prioridade === 'alta' ? 'Prioridade alta' : 'Prioridade média'}</span>
          <span class="pill muted" style="margin-left:6px;">${escapeHtml(areaNome(objetivo.area))}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm pei-no-print" data-remove="${index}"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Objetivo de longo prazo</label>
        <textarea class="search-input" rows="2" data-field="longoPrazo" data-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(objetivo.longoPrazo)}</textarea>
      </div>
      ${item ? `<div class="footnote" style="margin:0 0 10px;padding:8px 12px;"><i class="fa-solid fa-circle-info"></i>Item de referência do Portage: ${escapeHtml(item.id)} — ${escapeHtml(item.titulo)}</div>` : ''}
      <div class="pei-objetivo-grid">
        <div class="field-group">
          <label>Estratégias</label>
          <textarea class="search-input" rows="2" data-field="estrategias" data-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(objetivo.estrategias)}</textarea>
        </div>
        <div class="field-group">
          <label>Materiais</label>
          <textarea class="search-input" rows="2" data-field="materiais" data-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(objetivo.materiais)}</textarea>
        </div>
        <div class="field-group">
          <label>Responsável</label>
          <input class="search-input" data-field="responsavel" data-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(objetivo.responsavel)}">
        </div>
        <div class="field-group">
          <label>Frequência</label>
          <input class="search-input" data-field="frequencia" data-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(objetivo.frequencia)}">
        </div>
        <div class="field-group">
          <label>Critério de atingimento</label>
          <input class="search-input" data-field="criterio" data-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(objetivo.criterio)}">
        </div>
        <div class="field-group">
          <label>Prazo (semanas)</label>
          <input class="search-input" type="number" min="1" data-field="prazoSemanas" data-index="${index}" style="width:100%;padding:0 13px;" value="${objetivo.prazoSemanas ?? ''}">
        </div>
      </div>
    </div>`;
}

function render() {
  const root = qs('#s-pei');
  const objetivos = estado.doc.objetivos || [];

  const listaHtml = objetivos.length
    ? objetivos.map((o, i) => objetivoCard(o, i)).join('')
    : emptyState('Nenhum objetivo gerado ainda. Use "Gerar rascunho a partir da última aplicação" para começar.');

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-file-pen"></i> Plano Educacional Individualizado (PEI)</div>
    <div class="screen-desc">${escapeHtml(estado.patient.id)} · ${escapeHtml(estado.patient.fullName)}</div>

    <div class="pei-no-print" style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" type="button" id="pei-gerar" ${estado.temAplicacao ? '' : 'disabled'}><i class="fa-solid fa-wand-magic-sparkles"></i> Gerar rascunho a partir da última aplicação</button>
      <button class="btn btn-ghost btn-sm" type="button" id="pei-imprimir"><i class="fa-solid fa-print"></i> Imprimir / exportar PEI</button>
    </div>

    ${!estado.temAplicacao ? emptyState('Nenhuma aplicação do Inventário Portage concluída para este paciente ainda. Aplique o inventário antes de gerar o PEI.') : `<div id="pei-lista">${listaHtml}</div>`}

    <div class="footnote"><i class="fa-solid fa-circle-info"></i>Os objetivos abaixo são um rascunho derivado das respostas do Inventário Portage — a critério da equipe, não um plano fechado. Revise, edite e complemente antes de considerar o PEI vigente.</div>
  `;

  bindEvents();
}

function bindEvents() {
  const gerarBtn = qs('#pei-gerar');
  if (gerarBtn) {
    gerarBtn.addEventListener('click', () => {
      const aplicacao = estado.portageDoc.aplicacoes[estado.portageDoc.aplicacoes.length - 1];
      const { objetivos, areasPrioritarias } = derivarObjetivosPEI(aplicacao, estado.inventario);
      estado.doc.objetivos = objetivos;
      estado.doc.areasPrioritarias = areasPrioritarias;
      estado.doc.aplicacaoId = aplicacao.id;
      estado.doc.geradoEm = new Date().toISOString();
      salvar();
      render();
      Toast.show('Rascunho de PEI gerado a partir da última aplicação.', { kind: 'success' });
    });
  }

  const imprimirBtn = qs('#pei-imprimir');
  if (imprimirBtn) imprimirBtn.addEventListener('click', () => window.print());

  qsa('[data-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const index = Number(el.dataset.index);
      const field = el.dataset.field;
      const objetivo = estado.doc.objetivos[index];
      if (!objetivo) return;
      objetivo[field] = field === 'prazoSemanas' ? Number(el.value) || null : el.value;
      salvar();
    });
  });

  qsa('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.remove);
      estado.doc.objetivos.splice(index, 1);
      salvar();
      render();
    });
  });
}

export async function mount() {
  const patientId = Patient.getCurrentId();
  const [doc, portageDoc, patient, inventario] = await Promise.all([
    carregarDocumento('pei', patientId),
    carregarDocumento('portage', patientId),
    Store.load('patient', patientId),
    carregarInventario(),
  ]);

  if (!doc.objetivos) doc.objetivos = [];

  estado = {
    patientId,
    patient,
    inventario,
    doc,
    portageDoc,
    temAplicacao: !!(portageDoc.aplicacoes && portageDoc.aplicacoes.length),
  };

  render();
}
