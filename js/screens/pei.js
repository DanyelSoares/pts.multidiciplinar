import Store from '../core/store.js';
import Patient from '../core/patient.js';
import LocalData from '../core/localData.js';
import Toast from '../core/toast.js';
import Catalog from '../core/catalog.js';
import Config from '../core/config.js';
import { carregarInventario, buscarItemPorId } from '../core/portage.js';
import { derivarObjetivosPEI } from '../core/pei.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';
import { formatarIdadeExtenso, campoOuOmitir as campoOuOmitirBase, marcaInstitucional, RESSALVA_INSTRUMENTO_PORTAGE } from '../core/documentoImpressao.js';

function campoOuOmitir(rotulo, valor) {
  return campoOuOmitirBase(rotulo, valor, 'pei-doc-kv');
}

const PUBLICO_OPCOES = [
  { id: 'pais', label: 'Pais' },
  { id: 'professora', label: 'Professora' },
  { id: 'terapeuta', label: 'Terapeuta' },
  { id: 'cuidador', label: 'Cuidador' },
];

const AMBIENTES_OPCOES = [
  { id: 'domiciliar', label: 'Domiciliar' },
  { id: 'escolar', label: 'Escolar' },
  { id: 'terapeutico', label: 'Terapêutico' },
  { id: 'social', label: 'Social' },
];

let estado = null;

function carregarDocumento(name, patientId) {
  const local = LocalData.getDoc(name, patientId);
  if (local) return Promise.resolve(local);
  return Store.load(name, patientId);
}

function salvar() {
  LocalData.saveDoc('pei', estado.patientId, estado.doc);
  Store.invalidate('pei', estado.patientId);
}

function areaNome(areaId) {
  return estado.inventario.areas.find((a) => a.id === areaId)?.nome || areaId;
}

function frasePadrao(contexto) {
  const publico = contexto.publico.map((id) => PUBLICO_OPCOES.find((p) => p.id === id)?.label || id).join(', ');
  const ambientes = contexto.ambientes.map((id) => AMBIENTES_OPCOES.find((a) => a.id === id)?.label || id).join(', ');
  return `Em ${contexto.ocasioes} ocasiões, diante de ${publico || '—'}, nos ambientes ${ambientes || '—'}, em ${contexto.criterioPercent}% das oportunidades, por ${contexto.diasConsecutivos} dias consecutivos.`;
}

function chipsContexto(campo, opcoes, selecionados, objetivoIndex, grupo) {
  return opcoes
    .map((o) => {
      const marcado = selecionados.includes(o.id);
      return `<label class="pei-chip${marcado ? ' checked' : ''}">
        <input type="checkbox" data-contexto-chip="${campo}" data-grupo="${grupo}" data-index="${objetivoIndex}" value="${o.id}" ${marcado ? 'checked' : ''}>
        ${escapeHtml(o.label)}
      </label>`;
    })
    .join('');
}

function objetivoCard(objetivo, index, grupo) {
  const item = buscarItemPorId(objetivo.itemId);
  const c = objetivo.contexto;
  return `
    <div class="pei-objetivo-card" data-objetivo-index="${index}" data-grupo="${grupo}">
      <div class="pei-objetivo-header">
        <span class="pill info">${escapeHtml(areaNome(objetivo.area))}</span>
        <button type="button" class="btn btn-ghost btn-sm no-print" data-remove-objetivo="${index}" data-grupo="${grupo}"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Objetivo</label>
        <textarea class="search-input" rows="2" data-objetivo-field="descricao" data-grupo="${grupo}" data-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(objetivo.descricao)}</textarea>
      </div>
      ${item ? `<div class="footnote" style="margin:0 0 10px;padding:8px 12px;"><i class="fa-solid fa-circle-info"></i>Item de referência do Portage: ${escapeHtml(item.id)} — ${escapeHtml(item.titulo)}</div>` : ''}
      <div class="pei-contexto-grid">
        <div class="field-group">
          <label>Ocasiões</label>
          <input class="search-input" type="number" min="1" data-contexto-field="ocasioes" data-grupo="${grupo}" data-index="${index}" style="width:100%;padding:0 13px;" value="${c.ocasioes}">
        </div>
        <div class="field-group">
          <label>Critério (%)</label>
          <input class="search-input" type="number" min="1" max="100" data-contexto-field="criterioPercent" data-grupo="${grupo}" data-index="${index}" style="width:100%;padding:0 13px;" value="${c.criterioPercent}">
        </div>
        <div class="field-group">
          <label>Dias consecutivos</label>
          <input class="search-input" type="number" min="1" data-contexto-field="diasConsecutivos" data-grupo="${grupo}" data-index="${index}" style="width:100%;padding:0 13px;" value="${c.diasConsecutivos}">
        </div>
      </div>
      <div class="pei-contexto-grid" style="margin-top:10px;">
        <div class="field-group">
          <label>Público</label>
          <div class="pei-chip-group">${chipsContexto('publico', PUBLICO_OPCOES, c.publico, index, grupo)}</div>
        </div>
        <div class="field-group">
          <label>Ambientes</label>
          <div class="pei-chip-group">${chipsContexto('ambientes', AMBIENTES_OPCOES, c.ambientes, index, grupo)}</div>
        </div>
      </div>
      <div class="pei-frase-contexto"><i class="fa-solid fa-quote-left"></i> ${escapeHtml(frasePadrao(c))}</div>
    </div>`;
}

function secaoObjetivos(titulo, objetivos, grupo) {
  if (!objetivos.length) return emptyState(`Nenhum objetivo de ${titulo.toLowerCase()} gerado ainda.`);
  return objetivos.map((o, i) => objetivoCard(o, i, grupo)).join('');
}

function ajudaChip(helpType, programaIndex) {
  return `<label class="pei-chip">
    <input type="checkbox" data-ajuda-chip="${escapeHtml(helpType.id)}" data-programa-index="${programaIndex}" ${estado.doc.programas[programaIndex].ajudaHelpTypeIds.includes(helpType.id) ? 'checked' : ''}>
    ${escapeHtml(helpType.label)}
  </label>`;
}

function passosEnsinoHtml(passos, programaIndex) {
  return passos
    .map((passo, i) => `
      <div class="field-group" style="margin-bottom:8px;">
        <label>Passo ${i + 1}</label>
        <input class="search-input" data-passo-index="${i}" data-programa-index="${programaIndex}" style="width:100%;padding:0 13px;" value="${escapeHtml(passo)}">
      </div>`)
    .join('');
}

function manutencaoHtml(manutencao, programaIndex) {
  return manutencao.blocos
    .map((bloco, i) => `
      <div class="pei-manutencao-bloco">
        <div class="field-group">
          <label>Bloco ${i + 1} · vezes/semana</label>
          <input class="search-input" type="number" min="1" data-manutencao-campo="vezesPorSemana" data-bloco-index="${i}" data-programa-index="${programaIndex}" style="width:100%;padding:0 13px;" value="${bloco.vezesPorSemana}">
        </div>
        <div class="field-group">
          <label>Semanas</label>
          <input class="search-input" type="number" min="1" data-manutencao-campo="semanas" data-bloco-index="${i}" data-programa-index="${programaIndex}" style="width:100%;padding:0 13px;" value="${bloco.semanas}">
        </div>
      </div>`)
    .join('');
}

function programaCard(programa, index) {
  const respostaEsperadaHtml = programa.respostaEsperada
    .map((itemId) => {
      const item = buscarItemPorId(itemId);
      return item ? `<li>${escapeHtml(item.id)} — ${escapeHtml(item.titulo)}</li>` : `<li>${escapeHtml(itemId)}</li>`;
    })
    .join('');

  return `
    <div class="pei-programa-card" data-programa-index="${index}">
      <div class="pei-objetivo-header">
        <div>
          <span class="pill info">${escapeHtml(areaNome(programa.area))}</span>
          <span class="pill muted" style="margin-left:6px;">Origem: PEI · ${escapeHtml(programa.objetivoPeiId)}</span>
        </div>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Nome do programa</label>
        <input class="search-input" data-programa-field="nome" data-programa-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(programa.nome)}">
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Resposta esperada (itens do Portage)</label>
        <ul class="pei-resposta-esperada">${respostaEsperadaHtml}</ul>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Estímulo discriminativo</label>
        <textarea class="search-input" rows="2" data-programa-field="estimuloDiscriminativo" data-programa-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(programa.estimuloDiscriminativo)}</textarea>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Ajudas</label>
        <div class="pei-chip-group">${estado.helpTypes.map((h) => ajudaChip(h, index)).join('')}</div>
      </div>
      <div class="pei-programa-grid">
        <div class="field-group">
          <label>Sistema de esvanecimento</label>
          <input class="search-input" data-programa-field="sistemaEsvanecimento" data-programa-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(programa.sistemaEsvanecimento)}">
        </div>
        <div class="field-group">
          <label>Procedimento de ensino</label>
          <input class="search-input" data-programa-field="procedimentoEnsino" data-programa-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(programa.procedimentoEnsino)}">
        </div>
        <div class="field-group">
          <label>Critério de aquisição (%)</label>
          <input class="search-input" type="number" min="1" max="100" data-programa-field="criterioAquisicaoPercent" data-programa-index="${index}" style="width:100%;padding:0 13px;" value="${programa.criterioAquisicaoPercent}">
        </div>
        <div class="field-group">
          <label>Critério de aquisição (dias)</label>
          <input class="search-input" type="number" min="1" data-programa-field="criterioAquisicaoDias" data-programa-index="${index}" style="width:100%;padding:0 13px;" value="${programa.criterioAquisicaoDias}">
        </div>
      </div>
      <div class="field-group" style="margin:10px 0;">
        <label>Consequência</label>
        <input class="search-input" data-programa-field="consequencia" data-programa-index="${index}" style="width:100%;padding:0 13px;" value="${escapeHtml(programa.consequencia)}">
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Correção de erro</label>
        <textarea class="search-input" rows="2" data-programa-field="correcaoErro" data-programa-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(programa.correcaoErro)}</textarea>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Manutenção de habilidades</label>
        <div class="pei-manutencao-grid">${manutencaoHtml(programa.manutencao, index)}</div>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label>Passos de ensino</label>
        ${passosEnsinoHtml(programa.passosEnsino, index)}
      </div>
      <div class="field-group">
        <label>Generalização</label>
        <textarea class="search-input" rows="2" data-programa-field="generalizacao" data-programa-index="${index}" style="width:100%;padding:10px 13px;">${escapeHtml(programa.generalizacao)}</textarea>
      </div>
    </div>`;
}

function secaoProgramas(programas) {
  if (!programas.length) return emptyState('Nenhum programa de ensino gerado ainda.');
  return programas.map((p, i) => programaCard(p, i)).join('');
}

function docCabecalho() {
  const institution = estado.config?.institution || {};
  const patient = estado.patient;
  const agora = new Date();
  const dataEmissao = agora.toLocaleDateString('pt-BR');

  const marca = marcaInstitucional(institution, 'pei-doc-selo');

  return `
    <div class="pei-doc-header">
      <div class="pei-doc-institution">
        ${marca}
        <div>
          <div class="name">${escapeHtml(institution.name || '')}</div>
          ${institution.address ? `<div>${escapeHtml(institution.address)}</div>` : ''}
          ${institution.phone ? `<div>${escapeHtml(institution.phone)}</div>` : ''}
        </div>
      </div>
      <div class="pei-doc-meta">
        <div><b>Emitido em</b> ${escapeHtml(dataEmissao)}</div>
        ${campoOuOmitir('Prontuário', patient.record)}
        ${campoOuOmitir('Vigência', patient.validityStart && patient.validityEnd ? `${patient.validityStart} a ${patient.validityEnd}` : '')}
        ${campoOuOmitir('Próxima revisão', patient.nextReview && patient.nextReview !== '—' ? patient.nextReview : '')}
      </div>
    </div>
    <div class="pei-doc-title">Plano de Ensino Individualizado (PEI)</div>`;
}

function docIdentificacao() {
  const patient = estado.patient;
  const aplicacoes = estado.portageDoc.aplicacoes || [];
  const aplicacao = aplicacoes[aplicacoes.length - 1];
  const idadeExtenso = aplicacao ? formatarIdadeExtenso(aplicacao.idadeCronologicaMeses) : null;
  const idadeTexto = idadeExtenso && aplicacao.data
    ? `${idadeExtenso}, na avaliação de ${escapeHtml(aplicacao.data)}`
    : (idadeExtenso || '—');

  return `
    <div class="pei-doc-section">
      <h4>Identificação</h4>
      ${campoOuOmitir('Nome', patient.fullName)}
      ${campoOuOmitir('Idade', idadeTexto === '—' ? '' : idadeTexto)}
    </div>`;
}

function docFinalidade() {
  return `
    <div class="pei-doc-section">
      <h4>Finalidade</h4>
      <p>Este documento tem como objetivo registrar os objetivos de ensino e os programas de intervenção planejados para o paciente identificado acima, a partir dos dados de desenvolvimento levantados na avaliação. Os objetivos e programas aqui descritos devem ser revisados periodicamente pela equipe responsável e ajustados conforme a evolução observada.</p>
    </div>`;
}

function docInstrumentoAvaliacao() {
  const inv = estado.inventario;
  return `
    <div class="pei-doc-section">
      <h4>Instrumento de Avaliação</h4>
      ${campoOuOmitir('Instrumento', inv.instrumento)}
      ${campoOuOmitir('Referência', inv.referencia)}
      ${campoOuOmitir('Escopo', inv.escopo)}
      <p style="margin-top:8px;"><i>${escapeHtml(RESSALVA_INSTRUMENTO_PORTAGE)}</i></p>
    </div>`;
}

function docTabelaObjetivos(titulo, objetivos) {
  if (!objetivos.length) return '';
  const porArea = new Map();
  objetivos.forEach((o) => {
    if (!porArea.has(o.area)) porArea.set(o.area, []);
    porArea.get(o.area).push(o);
  });

  const blocos = [...porArea.entries()]
    .map(([areaId, itens]) => {
      const linhas = itens
        .map((o) => `<tr><td>${escapeHtml(o.descricao)}</td><td>${o.contexto ? escapeHtml(frasePadrao(o.contexto)) : '—'}</td></tr>`)
        .join('');
      return `
        <div class="pei-doc-area-titulo">${escapeHtml(areaNome(areaId))}</div>
        <table class="pei-doc-table">
          <thead><tr><th style="width:55%;">Objetivo</th><th>Contexto</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>`;
    })
    .join('');

  return `
    <div class="pei-doc-section doc-print-block">
      <h4>${escapeHtml(titulo)}</h4>
      ${blocos}
    </div>`;
}

function docPrograma(programa) {
  const respostaEsperada = (programa.respostaEsperada || [])
    .map((itemId) => buscarItemPorId(itemId))
    .filter(Boolean)
    .map((item) => `${item.id} — ${item.titulo}`)
    .join('; ');

  const ajudas = (programa.ajudaHelpTypeIds || [])
    .map((id) => estado.helpTypes.find((h) => h.id === id)?.label)
    .filter(Boolean)
    .join(', ');

  const manutencao = (programa.manutencao?.blocos || [])
    .filter((b) => b.vezesPorSemana && b.semanas)
    .map((b) => `${b.vezesPorSemana}x/semana por ${b.semanas} semanas`)
    .join('; ');

  const passos = (programa.passosEnsino || []).filter((p) => p && p.trim());
  const passosHtml = passos.length ? `<div class="pei-doc-kv"><b>Passos de ensino:</b> ${passos.map((p, i) => `${i + 1}) ${escapeHtml(p)}`).join(' ')}</div>` : '';

  const criterio = programa.criterioAquisicaoPercent && programa.criterioAquisicaoDias
    ? `${programa.criterioAquisicaoPercent}% de acerto por ${programa.criterioAquisicaoDias} dias consecutivos`
    : '';

  return `
    <div class="pei-doc-programa doc-print-block">
      <h5>${escapeHtml(programa.nome)} (${escapeHtml(areaNome(programa.area))})</h5>
      ${campoOuOmitir('Resposta esperada', respostaEsperada)}
      ${campoOuOmitir('Estímulo discriminativo', programa.estimuloDiscriminativo)}
      ${campoOuOmitir('Ajudas', ajudas)}
      ${campoOuOmitir('Sistema de esvanecimento', programa.sistemaEsvanecimento)}
      ${campoOuOmitir('Procedimento de ensino', programa.procedimentoEnsino)}
      ${campoOuOmitir('Critério de aquisição', criterio)}
      ${campoOuOmitir('Consequência', programa.consequencia)}
      ${campoOuOmitir('Correção de erro', programa.correcaoErro)}
      ${campoOuOmitir('Manutenção de habilidades', manutencao)}
      ${passosHtml}
      ${campoOuOmitir('Generalização', programa.generalizacao)}
    </div>`;
}

function docProgramas(programas) {
  if (!programas.length) return '';
  return `
    <div class="pei-doc-section">
      <h4>Programas de Ensino</h4>
      ${programas.map(docPrograma).join('')}
    </div>`;
}

function docAssinatura() {
  const patient = estado.patient;
  if (!patient.caseSupervisor) return '';
  return `
    <div class="pei-doc-signature">
      <div class="linha"></div>
      <div>${escapeHtml(patient.caseSupervisor)}</div>
      ${patient.professionalRegistration ? `<div>${escapeHtml(patient.professionalRegistration)}</div>` : ''}
    </div>`;
}

function docRodapeFixo() {
  const agora = new Date().toLocaleDateString('pt-BR');
  return `<div class="pei-doc-footer-fixo">${escapeHtml(estado.patient.fullName)} — PEI emitido em ${escapeHtml(agora)}</div>`;
}

function montarDocumentoImpressao() {
  if (!estado.temAplicacao) return '';
  const doc = estado.doc;

  return `
    <div class="pei-doc">
      ${docCabecalho()}
      ${docIdentificacao()}
      ${docFinalidade()}
      ${docInstrumentoAvaliacao()}
      ${docTabelaObjetivos('Objetivos de Longo Prazo', doc.objetivosLongoPrazo || [])}
      ${docTabelaObjetivos('Objetivos de Curto e Médio Prazo', doc.objetivosCurtoMedioPrazo || [])}
      ${docProgramas(doc.programas || [])}
      ${docAssinatura()}
      ${docRodapeFixo()}
    </div>`;
}

function atualizarDocumentoImpressao() {
  const container = qs('#pei-documento-impressao');
  if (!container || !estado) return;
  container.innerHTML = montarDocumentoImpressao();
}

let beforeprintRegistrado = false;

function garantirListenerImpressao() {
  if (beforeprintRegistrado) return;
  beforeprintRegistrado = true;
  window.addEventListener('beforeprint', atualizarDocumentoImpressao);
}

function render() {
  const root = qs('#s-pei');
  const doc = estado.doc;

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-file-pen"></i> Plano de Ensino Individualizado (PEI)</div>
    <div class="screen-desc">${escapeHtml(estado.patient.id)} · ${escapeHtml(estado.patient.fullName)}</div>

    <div class="no-print" style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" type="button" id="pei-gerar" ${estado.temAplicacao ? '' : 'disabled'}><i class="fa-solid fa-wand-magic-sparkles"></i> Gerar rascunho a partir da última aplicação</button>
      <button class="btn btn-ghost btn-sm" type="button" id="pei-imprimir"><i class="fa-solid fa-print"></i> Imprimir / exportar PEI</button>
    </div>

    ${!estado.temAplicacao ? emptyState('Nenhuma aplicação do Inventário Portage concluída para este paciente ainda. Aplique o inventário antes de gerar o PEI.') : `
      <div class="panel">
        <div class="panel-header"><h3>Objetivos de longo prazo</h3></div>
        <div class="panel-body" style="padding-top:14px;">${secaoObjetivos('longo prazo', doc.objetivosLongoPrazo || [], 'lp')}</div>
      </div>

      <div class="panel" style="margin-top:20px;">
        <div class="panel-header"><h3>Objetivos de curto e médio prazo</h3></div>
        <div class="panel-body" style="padding-top:14px;">${secaoObjetivos('curto e médio prazo', doc.objetivosCurtoMedioPrazo || [], 'cmp')}</div>
      </div>

      <div class="panel" style="margin-top:20px;">
        <div class="panel-header"><h3>Programas de ensino</h3></div>
        <div class="panel-body" style="padding-top:14px;">${secaoProgramas(doc.programas || [])}</div>
      </div>
    `}

    <div class="footnote"><i class="fa-solid fa-circle-info"></i>Os objetivos e programas abaixo são um rascunho derivado das respostas do Inventário Portage — a critério da equipe, não um plano fechado. Revise, edite e complemente antes de considerar o PEI vigente.</div>

    <div id="pei-documento-impressao" class="doc-print-only"></div>
  `;

  bindEvents();
}

function grupoObjetivos(grupo) {
  return grupo === 'lp' ? estado.doc.objetivosLongoPrazo : estado.doc.objetivosCurtoMedioPrazo;
}

function bindEvents() {
  const gerarBtn = qs('#pei-gerar');
  if (gerarBtn) {
    gerarBtn.addEventListener('click', () => {
      const aplicacao = estado.portageDoc.aplicacoes[estado.portageDoc.aplicacoes.length - 1];
      const { objetivosLongoPrazo, objetivosCurtoMedioPrazo, programas } = derivarObjetivosPEI(aplicacao, estado.inventario);
      estado.doc.objetivosLongoPrazo = objetivosLongoPrazo;
      estado.doc.objetivosCurtoMedioPrazo = objetivosCurtoMedioPrazo;
      estado.doc.programas = programas;
      estado.doc.aplicacaoId = aplicacao.id;
      estado.doc.geradoEm = new Date().toISOString();
      salvar();
      render();
      Toast.show('Rascunho de PEI gerado a partir da última aplicação.', { kind: 'success' });
    });
  }

  const imprimirBtn = qs('#pei-imprimir');
  if (imprimirBtn) {
    imprimirBtn.addEventListener('click', () => {
      atualizarDocumentoImpressao();
      window.print();
    });
  }

  qsa('[data-objetivo-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const grupo = grupoObjetivos(el.dataset.grupo);
      const objetivo = grupo[Number(el.dataset.index)];
      if (!objetivo) return;
      objetivo[el.dataset.objetivoField] = el.value;
      salvar();
    });
  });

  qsa('[data-contexto-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const grupo = grupoObjetivos(el.dataset.grupo);
      const objetivo = grupo[Number(el.dataset.index)];
      if (!objetivo) return;
      objetivo.contexto[el.dataset.contextoField] = Number(el.value) || 0;
      salvar();
      render();
    });
  });

  qsa('[data-contexto-chip]').forEach((el) => {
    el.addEventListener('change', () => {
      const grupo = grupoObjetivos(el.dataset.grupo);
      const objetivo = grupo[Number(el.dataset.index)];
      if (!objetivo) return;
      const campo = el.dataset.contextoChip;
      const lista = objetivo.contexto[campo];
      if (el.checked) {
        if (!lista.includes(el.value)) lista.push(el.value);
      } else {
        objetivo.contexto[campo] = lista.filter((v) => v !== el.value);
      }
      salvar();
      render();
    });
  });

  qsa('[data-remove-objetivo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grupo = grupoObjetivos(btn.dataset.grupo);
      grupo.splice(Number(btn.dataset.removeObjetivo), 1);
      salvar();
      render();
    });
  });

  qsa('[data-programa-field]').forEach((el) => {
    el.addEventListener('input', () => {
      const programa = estado.doc.programas[Number(el.dataset.programaIndex)];
      if (!programa) return;
      const field = el.dataset.programaField;
      const numerico = ['criterioAquisicaoPercent', 'criterioAquisicaoDias'].includes(field);
      programa[field] = numerico ? Number(el.value) || 0 : el.value;
      salvar();
    });
  });

  qsa('[data-ajuda-chip]').forEach((el) => {
    el.addEventListener('change', () => {
      const programa = estado.doc.programas[Number(el.dataset.programaIndex)];
      if (!programa) return;
      const id = el.dataset.ajudaChip;
      if (el.checked) {
        if (!programa.ajudaHelpTypeIds.includes(id)) programa.ajudaHelpTypeIds.push(id);
      } else {
        programa.ajudaHelpTypeIds = programa.ajudaHelpTypeIds.filter((v) => v !== id);
      }
      salvar();
    });
  });

  qsa('[data-passo-index]').forEach((el) => {
    el.addEventListener('input', () => {
      const programa = estado.doc.programas[Number(el.dataset.programaIndex)];
      if (!programa) return;
      programa.passosEnsino[Number(el.dataset.passoIndex)] = el.value;
      salvar();
    });
  });

  qsa('[data-manutencao-campo]').forEach((el) => {
    el.addEventListener('input', () => {
      const programa = estado.doc.programas[Number(el.dataset.programaIndex)];
      if (!programa) return;
      const bloco = programa.manutencao.blocos[Number(el.dataset.blocoIndex)];
      if (!bloco) return;
      bloco[el.dataset.manutencaoCampo] = Number(el.value) || 0;
      salvar();
    });
  });
}

export async function mount() {
  const patientId = Patient.getCurrentId();
  const [doc, portageDoc, patient, inventario, helpTypes, config] = await Promise.all([
    carregarDocumento('pei', patientId),
    carregarDocumento('portage', patientId),
    Store.load('patient', patientId),
    carregarInventario(),
    Catalog.listHelpTypes(),
    Config.load(),
  ]);

  if (!doc.objetivosLongoPrazo) doc.objetivosLongoPrazo = [];
  if (!doc.objetivosCurtoMedioPrazo) doc.objetivosCurtoMedioPrazo = [];
  if (!doc.programas) doc.programas = [];

  estado = {
    patientId,
    patient,
    inventario,
    doc,
    portageDoc,
    helpTypes,
    config,
    temAplicacao: !!(portageDoc.aplicacoes && portageDoc.aplicacoes.length),
  };

  render();
  garantirListenerImpressao();
}
