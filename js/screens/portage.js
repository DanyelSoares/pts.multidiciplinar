import Store from '../core/store.js';
import Patient from '../core/patient.js';
import LocalData from '../core/localData.js';
import { carregarInventario } from '../core/portage.js';
import { calcularPontuacaoPortage } from '../core/portageScore.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

const STATUS_BOTOES = [
  { valor: 'adquirido', rotulo: 'S', titulo: 'Adquirido (Sim)' },
  { valor: 'emergente', rotulo: 'E', titulo: 'Emergente (Às vezes)' },
  { valor: 'nao_adquirido', rotulo: 'N', titulo: 'Não adquirido' },
  { valor: 'nao_avaliado', rotulo: 'NA', titulo: 'Não avaliado' },
];

let estado = null;

async function carregarDocumentoPortage(patientId) {
  const local = LocalData.getDoc('portage', patientId);
  if (local) return local;
  return Store.load('portage', patientId);
}

function aplicacaoAtual() {
  if (!estado.doc.aplicacoes.length) {
    estado.doc.aplicacoes.push({
      id: `AV-${String(estado.doc.aplicacoes.length + 1).padStart(4, '0')}`,
      numero: estado.doc.aplicacoes.length + 1,
      data: new Date().toISOString().slice(0, 10),
      aplicador: '',
      idadeCronologicaMeses: null,
      fonte: 'observacao',
      status: 'em_andamento',
      base: {},
      teto: {},
      respostas: {},
    });
  }
  return estado.doc.aplicacoes[estado.aplicacaoIndex];
}

function salvar() {
  LocalData.saveDoc('portage', estado.patientId, estado.doc);
  Store.invalidate('portage', estado.patientId);
}

function coberturaFaixa(area, faixaId) {
  const aplicacao = aplicacaoAtual();
  const resultado = calcularPontuacaoPortage(aplicacao, estado.inventario);
  const c = resultado.areas[area.id].contagemPorFaixa[faixaId];
  if (!c || c.total === 0) return 0;
  return c.avaliados / c.total;
}

function faixaEstaNaBase(area, faixaId) {
  const aplicacao = aplicacaoAtual();
  const baseId = aplicacao.base?.[area.id];
  if (!baseId) return false;
  const idsFaixas = estado.inventario.faixas.map((f) => f.id);
  return idsFaixas.indexOf(faixaId) <= idsFaixas.indexOf(baseId);
}

function areaTabs() {
  return estado.inventario.areas
    .map((area) => `<button type="button" class="tab-btn${area.id === estado.areaId ? ' active' : ''}" data-area="${area.id}">${escapeHtml(area.nome)}</button>`)
    .join('');
}

function faixaTabs(area) {
  return estado.inventario.faixas
    .map((faixa) => {
      const naBase = faixaEstaNaBase(area, faixa.id);
      const classes = [];
      if (faixa.id === estado.faixaId) classes.push('active');
      if (naBase) classes.push('faixa-coberta-base');
      return `<button type="button" class="${classes.join(' ')}" data-faixa="${faixa.id}">${escapeHtml(faixa.rotulo)}${naBase ? ' <i class="fa-solid fa-check"></i>' : ''}</button>`;
    })
    .join('');
}

function basePicker(area) {
  const aplicacao = aplicacaoAtual();
  const baseAtual = aplicacao.base?.[area.id] || '';
  const ultimaFaixaId = estado.inventario.faixas[estado.inventario.faixas.length - 1].id;
  const opcoes = estado.inventario.faixas
    .map((f) => `<option value="${f.id}" ${f.id === baseAtual ? 'selected' : ''}>${escapeHtml(f.rotulo)}</option>`)
    .join('');
  const avisoTudoCoberto = baseAtual === ultimaFaixaId
    ? `<span class="footnote" style="margin:0;padding:6px 10px;color:var(--warning);"><i class="fa-solid fa-triangle-exclamation"></i> Base na última faixa: todos os itens desta área foram pré-marcados como adquiridos. Você ainda pode corrigir um item específico clicando em outro status.</span>`
    : `<span class="footnote" style="margin:0;padding:6px 10px;">Todos os itens das faixas até a base são pré-marcados como adquiridos — clique em um item para corrigi-lo individualmente, se necessário.</span>`;
  return `
    <div class="portage-base-picker">
      <label>Base (basal)</label>
      <select class="select-input" id="portage-base-select" style="min-width:160px;">
        <option value="">Nenhuma declarada</option>
        ${opcoes}
      </select>
      ${avisoTudoCoberto}
    </div>`;
}

function itemRow(item, statusExplicito) {
  const statusEfetivo = statusExplicito || 'nao_avaliado';
  const botoes = STATUS_BOTOES
    .map((s) => `<button type="button" class="portage-status-btn${statusEfetivo === s.valor ? ' active' : ''}" data-status="${s.valor}" data-item="${item.id}" title="${escapeHtml(s.titulo)}">${s.rotulo}</button>`)
    .join('');
  return `
    <div class="portage-item-row">
      <div class="portage-item-num">${item.numero}</div>
      <div class="portage-item-titulo">${escapeHtml(item.titulo)}</div>
      <div class="portage-item-status">${botoes}</div>
    </div>`;
}

function avisoFaixaNaBase() {
  return `<div class="portage-base-aviso"><i class="fa-solid fa-circle-info"></i> Faixa coberta pela base declarada — itens não avaliados aqui já contam como adquiridos no cálculo. Marque um status manualmente apenas se quiser registrar uma exceção.</div>`;
}

function listaItens(area) {
  const aplicacao = aplicacaoAtual();
  const itens = estado.inventario.itens.filter((i) => i.area === area.id && i.faixa === estado.faixaId).sort((a, b) => a.ordem - b.ordem);
  const naBase = faixaEstaNaBase(area, estado.faixaId);

  if (!itens.length) return emptyState('Nenhum item cadastrado para esta faixa etária.');

  const aviso = naBase ? avisoFaixaNaBase() : '';
  return aviso + itens.map((item) => itemRow(item, aplicacao.respostas?.[item.id]?.status || null)).join('');
}

function render() {
  const root = qs('#s-portage');
  const area = estado.inventario.areas.find((a) => a.id === estado.areaId);
  const cobertura = coberturaFaixa(area, estado.faixaId);
  const badgeClasse = cobertura >= 0.6 ? 'cobertura-ok' : 'cobertura-baixa';

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-list-check"></i> Inventário Portage</div>
    <div class="screen-desc">${escapeHtml(estado.patient.id)} · ${escapeHtml(estado.patient.fullName)} — aplicação item a item do Guia Portage / IPO</div>

    <div class="portage-area-tabs">${areaTabs()}</div>

    <div class="panel">
      <div class="panel-header">
        <h3>${escapeHtml(area.nome)}</h3>
        <span class="portage-cobertura-badge ${badgeClasse}">Cobertura da faixa: ${(cobertura * 100).toFixed(0)}%</span>
      </div>
      <div class="panel-body" style="padding-top:14px;">
        ${basePicker(area)}
        <div class="portage-faixa-tabs">${faixaTabs(area)}</div>
        <div id="portage-itens">${listaItens(area)}</div>
      </div>
    </div>

    <div class="footnote"><i class="fa-solid fa-circle-info"></i>O Inventário Portage Operacionalizado é um instrumento referenciado a critério — descreve o repertório atual da criança, não um teste normativo. Idades e defasagens exibidas em outras telas são estimativas de apoio ao planejamento, não diagnóstico.</div>
  `;

  bindEvents(area);
}

function bindEvents(area) {
  qsa('.portage-area-tabs [data-area]').forEach((btn) => {
    btn.addEventListener('click', () => {
      estado.areaId = btn.dataset.area;
      estado.faixaId = estado.inventario.faixas[0].id;
      render();
    });
  });

  qsa('.portage-faixa-tabs [data-faixa]').forEach((btn) => {
    btn.addEventListener('click', () => {
      estado.faixaId = btn.dataset.faixa;
      render();
    });
  });

  const baseSelect = qs('#portage-base-select');
  if (baseSelect) {
    baseSelect.addEventListener('change', () => {
      const aplicacao = aplicacaoAtual();
      if (!aplicacao.base) aplicacao.base = {};
      if (baseSelect.value) aplicacao.base[area.id] = baseSelect.value;
      else delete aplicacao.base[area.id];
      salvar();
      render();
    });
  }

  qsa('.portage-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const aplicacao = aplicacaoAtual();
      if (!aplicacao.respostas) aplicacao.respostas = {};
      const itemId = btn.dataset.item;
      const status = btn.dataset.status;
      const respostaExplicita = aplicacao.respostas[itemId]?.status;

      if (respostaExplicita === status) {
        delete aplicacao.respostas[itemId];
      } else {
        aplicacao.respostas[itemId] = { status, obs: aplicacao.respostas[itemId]?.obs || '' };
      }
      salvar();
      render();
    });
  });
}

export async function mount() {
  const patientId = Patient.getCurrentId();
  const [doc, patient, inventario] = await Promise.all([
    carregarDocumentoPortage(patientId),
    Store.load('patient', patientId),
    carregarInventario(),
  ]);

  if (!doc.aplicacoes) doc.aplicacoes = [];

  estado = {
    patientId,
    patient,
    inventario,
    doc,
    aplicacaoIndex: Math.max(0, doc.aplicacoes.length - 1),
    areaId: inventario.areas[0].id,
    faixaId: inventario.faixas[0].id,
  };

  render();
}
