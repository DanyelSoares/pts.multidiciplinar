import Store from '../core/store.js';
import Patient from '../core/patient.js';
import LocalData from '../core/localData.js';
import Config from '../core/config.js';
import { carregarInventario } from '../core/portage.js';
import { calcularPontuacaoPortage } from '../core/portageScore.js';
import { renderizarRadarSVG, renderizarLegenda } from '../core/graficoRadar.js';
import { escapeHtml, qs, emptyState } from '../core/dom.js';
import { formatarIdadeExtenso, campoOuOmitir as campoOuOmitirBase, marcaInstitucional, RESSALVA_INSTRUMENTO_PORTAGE } from '../core/documentoImpressao.js';

const LARGURAS_COLUNAS = ['26%', '13%', '13%', '13%', '17.5%', '17.5%'];
const COLUNAS = ['Faixa etária', 'Adquiridos', 'Emergentes', 'Cobertura', 'Idade estimada', 'Defasagem'];

function campoOuOmitir(rotulo, valor) {
  return campoOuOmitirBase(rotulo, valor, 'portagePerfil-doc-kv');
}

let estado = null;

async function carregarDocumentoPortage(patientId) {
  const local = LocalData.getDoc('portage', patientId);
  if (local) return local;
  return Store.load('portage', patientId);
}

function formatarIdade(meses) {
  if (meses === null || meses === undefined) return '—';
  const anos = Math.floor(meses / 12);
  const restoMeses = Math.round(meses % 12);
  if (anos === 0) return `${restoMeses}m`;
  if (restoMeses === 0) return `${anos}a`;
  return `${anos}a ${restoMeses}m`;
}

function formatarDefasagem(meses) {
  if (meses === null || meses === undefined) return '—';
  const sinal = meses > 0 ? '+' : '';
  return `${sinal}${Math.round(meses)}m`;
}

function resumoCards(inventario, resultado) {
  return inventario.areas
    .map((area) => {
      const r = resultado.areas[area.id];
      const semDado = r.idadeEstimadaMeses === null;
      return `
        <div class="portage-resumo-card">
          <div class="area-nome">${escapeHtml(area.nome)}</div>
          <div class="area-idade${semDado ? ' sem-dado' : ''}">${semDado ? 'Cobertura insuficiente' : formatarIdade(r.idadeEstimadaMeses)}</div>
        </div>`;
    })
    .join('');
}

function colgroupColunas() {
  return `<colgroup>${LARGURAS_COLUNAS.map((w) => `<col style="width:${w};">`).join('')}</colgroup>`;
}

function linhaFaixa(faixa, contagemFaixa) {
  const c = contagemFaixa || { adquiridos: 0, emergentes: 0, avaliados: 0, total: 0 };
  const coberturaFaixa = c.total > 0 ? (c.avaliados / c.total) * 100 : 0;
  return `
    <tr>
      <td class="portage-tabela-faixa">${escapeHtml(faixa.rotulo)}</td>
      <td>${c.adquiridos}/${c.total}</td>
      <td>${c.emergentes}</td>
      <td>${coberturaFaixa.toFixed(0)}%</td>
      <td>—</td>
      <td>—</td>
    </tr>`;
}

function linhaTotalArea(area, r) {
  return `
    <tr class="portage-tabela-total">
      <td>Total aplicado — ${escapeHtml(area.nome)}</td>
      <td>${r.adquiridosAplicados}/${r.totalItensAplicados}</td>
      <td>${r.emergentesAplicados}</td>
      <td>${(r.coberturaAplicada * 100).toFixed(0)}%</td>
      <td>${r.idadeEstimadaMeses === null ? '—' : formatarIdade(r.idadeEstimadaMeses)}</td>
      <td>${formatarDefasagem(r.defasagemMeses)}</td>
    </tr>`;
}

const TOOLTIP_COLUNAS = {
  'Faixa etária': 'Intervalo de idade do Guia Portage ao qual os itens desta linha pertencem.',
  'Adquiridos': 'Itens marcados como "Adquirido" (Sim) sobre o total de itens da linha — inclui itens creditados automaticamente por uma Base (basal) declarada. Na linha de Total, o denominador considera apenas as faixas etárias com ao menos um item avaliado nesta aplicação (faixas nunca tocadas não entram na conta).',
  'Emergentes': 'Itens marcados como "Emergente" (Às vezes) — habilidade em desenvolvimento, ainda não consolidada.',
  'Cobertura': 'Percentual de itens que já receberam alguma resposta (Adquirido, Emergente ou Não adquirido) sobre o total da linha. O restante está "Não avaliado". Na linha de Total, calculada apenas sobre as faixas etárias efetivamente aplicadas.',
  'Idade estimada': 'Idade de desenvolvimento calculada a partir da última faixa consecutiva com cobertura de avaliação e taxa de acerto suficientes. Calculada apenas na linha de Total da área.',
  'Defasagem': 'Diferença entre a idade estimada e a idade cronológica do paciente. Aparece "—" quando a idade cronológica da aplicação não foi informada.',
};

function thComTooltip(rotulo) {
  return `<th title="${escapeHtml(TOOLTIP_COLUNAS[rotulo] || '')}">${escapeHtml(rotulo)}</th>`;
}

function blocoArea(area, inventario, resultado) {
  const r = resultado.areas[area.id];
  const linhasFaixa = inventario.faixas
    .map((faixa) => linhaFaixa(faixa, r.contagemPorFaixa[faixa.id]))
    .join('');
  return `
    <table class="portage-tabela-area">
      ${colgroupColunas()}
      <thead>
        <tr><th colspan="6">${escapeHtml(area.nome)}</th></tr>
        <tr>${COLUNAS.map(thComTooltip).join('')}</tr>
      </thead>
      <tbody>
        ${linhasFaixa}
        ${linhaTotalArea(area, r)}
      </tbody>
    </table>`;
}

function tabelaAreas(inventario, resultado) {
  return inventario.areas.map((area) => blocoArea(area, inventario, resultado)).join('');
}

function percentualPorFaixa(contagemFaixa) {
  if (!contagemFaixa || contagemFaixa.avaliados === 0) return null;
  return ((contagemFaixa.adquiridos + contagemFaixa.emergentes * 0.5) / contagemFaixa.avaliados) * 100;
}

function graficoBarrasArea(area, inventario, resultado) {
  const larguraBarra = 48;
  const gap = 18;
  const altura = 150;
  const margemEsquerda = 20;
  const margemTopo = 24;
  const margemBaixo = 26;
  const largura = margemEsquerda + inventario.faixas.length * (larguraBarra + gap);
  const alturaTotal = margemTopo + altura + margemBaixo;

  const barras = inventario.faixas
    .map((faixa, i) => {
      const c = resultado.areas[area.id].contagemPorFaixa[faixa.id];
      const pct = percentualPorFaixa(c);
      const x = margemEsquerda + i * (larguraBarra + gap);
      const semDado = pct === null;
      const alturaBarra = semDado ? 0 : (pct / 100) * altura;
      const y = margemTopo + (altura - alturaBarra);
      const rotuloValor = semDado ? 'sem dado' : `${pct.toFixed(0)}%`;
      const corBarra = semDado ? 'var(--border)' : 'var(--primary)';
      return `
        <g>
          <rect x="${x}" y="${y}" width="${larguraBarra}" height="${Math.max(alturaBarra, semDado ? 2 : 0)}" fill="${corBarra}" rx="4"/>
          <text x="${x + larguraBarra / 2}" y="${y - 8}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${semDado ? 'var(--muted)' : 'var(--primary)'}">${rotuloValor}</text>
          <text x="${x + larguraBarra / 2}" y="${margemTopo + altura + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">${escapeHtml(faixa.rotulo.replace(' a ', '-').replace(' anos', '').replace(' ano', ''))}</text>
        </g>`;
    })
    .join('');

  return `
    <div class="portage-grafico-area">
      <div class="portage-grafico-titulo">${escapeHtml(area.nome)}</div>
      <svg viewBox="0 0 ${largura} ${alturaTotal}" width="100%" style="display:block;">
        <line x1="${margemEsquerda - 6}" y1="${margemTopo + altura}" x2="${largura}" y2="${margemTopo + altura}" stroke="var(--border)" stroke-width="1"/>
        ${barras}
      </svg>
    </div>`;
}

function graficosPorFaixa(inventario, resultado) {
  return `<div class="portage-graficos-grid">${inventario.areas.map((area) => graficoBarrasArea(area, inventario, resultado)).join('')}</div>`;
}

function areasComDefasagemOrdenadas(inventario, resultado) {
  return inventario.areas
    .map((area) => ({ area, r: resultado.areas[area.id] }))
    .filter(({ r }) => r.defasagemMeses !== null && r.defasagemMeses < 0)
    .sort((a, b) => a.r.defasagemMeses - b.r.defasagemMeses);
}

function zonaIntervencao(inventario, resultado) {
  const areas = areasComDefasagemOrdenadas(inventario, resultado);

  if (!areas.length) {
    return emptyState('Nenhuma área com defasagem identificada a partir dos dados avaliados até o momento.');
  }

  const linhas = areas
    .map(({ area, r }) => `<div class="kv"><div class="k">${escapeHtml(area.nome)}</div><div class="v">${formatarDefasagem(r.defasagemMeses)}</div></div>`)
    .join('');

  return `<div class="kv-grid">${linhas}</div>`;
}

// ── Documento de impressão ──

function perfilDocCabecalho() {
  const institution = estado.config?.institution || {};
  const patient = estado.patient;
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const marca = marcaInstitucional(institution, 'portagePerfil-doc-selo');

  return `
    <div class="portagePerfil-doc-header">
      <div class="portagePerfil-doc-institution">
        ${marca}
        <div>
          <div class="name">${escapeHtml(institution.name || '')}</div>
          ${institution.address ? `<div>${escapeHtml(institution.address)}</div>` : ''}
          ${institution.phone ? `<div>${escapeHtml(institution.phone)}</div>` : ''}
        </div>
      </div>
      <div class="portagePerfil-doc-meta">
        <div><b>Emitido em</b> ${escapeHtml(dataEmissao)}</div>
        ${campoOuOmitir('Prontuário', patient.record)}
      </div>
    </div>
    <div class="portagePerfil-doc-title">Perfil de Desenvolvimento</div>`;
}

function perfilDocIdentificacao() {
  const patient = estado.patient;
  const aplicacao = estado.aplicacao;
  const idadeExtenso = aplicacao ? formatarIdadeExtenso(aplicacao.idadeCronologicaMeses) : null;
  const idadeTexto = idadeExtenso && aplicacao.data
    ? `${idadeExtenso}, na avaliação de ${aplicacao.data}`
    : (idadeExtenso || '');

  return `
    <div class="portagePerfil-doc-section">
      <h4>Identificação</h4>
      ${campoOuOmitir('Nome', patient.fullName)}
      ${campoOuOmitir('Idade', idadeTexto)}
    </div>`;
}

function perfilDocResumo() {
  const { inventario, resultado } = estado;
  const linhas = inventario.areas
    .map((area) => {
      const r = resultado.areas[area.id];
      const idade = r.idadeEstimadaMeses === null ? 'Cobertura insuficiente' : formatarIdade(r.idadeEstimadaMeses);
      return `<div class="portagePerfil-doc-kv"><b>${escapeHtml(area.nome)}:</b> ${escapeHtml(idade)}</div>`;
    })
    .join('');
  return `
    <div class="portagePerfil-doc-section">
      <h4>Resumo por área</h4>
      ${linhas}
    </div>`;
}

function perfilDocRadar() {
  const { inventario, resultado, patient } = estado;
  const rotulos = inventario.areas.map((a) => (a.id === 'motor' ? 'Motor' : a.nome));
  const valores = inventario.areas.map((a) => resultado.areas[a.id].percentualAdquirido);
  const camadas = [{ label: patient.fullName, valores, corVar: 'var(--primary)', preencher: true }];
  const svg = renderizarRadarSVG(camadas, rotulos, { size: 340 });
  const legenda = renderizarLegenda(camadas);
  return `
    <div class="portagePerfil-doc-section doc-print-block">
      <h4>Radar de desenvolvimento</h4>
      ${svg}${legenda}
    </div>`;
}

function perfilDocBlocoArea(area, inventario, resultado) {
  const r = resultado.areas[area.id];
  const linhasFaixa = inventario.faixas
    .map((faixa) => linhaFaixa(faixa, r.contagemPorFaixa[faixa.id]))
    .join('');
  return `
    <div class="doc-print-block">
      <div class="portagePerfil-doc-area-titulo">${escapeHtml(area.nome)}</div>
      <table class="portagePerfil-doc-table">
        ${colgroupColunas()}
        <thead><tr>${COLUNAS.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${linhasFaixa}
          ${linhaTotalArea(area, r)}
        </tbody>
      </table>
    </div>`;
}

function perfilDocTabelaAreas() {
  const { inventario, resultado } = estado;
  const blocos = inventario.areas.map((area) => perfilDocBlocoArea(area, inventario, resultado)).join('');
  return `
    <div class="portagePerfil-doc-section portagePerfil-doc-quebra-antes">
      <h4>Pontuação por área</h4>
      ${blocos}
      <p style="margin-top:8px;"><i>${escapeHtml(RESSALVA_INSTRUMENTO_PORTAGE)}</i></p>
    </div>`;
}

function perfilDocZonaIntervencao() {
  const { inventario, resultado } = estado;
  const areas = areasComDefasagemOrdenadas(inventario, resultado);
  if (!areas.length) return '';

  const linhas = areas
    .map(({ area, r }) => campoOuOmitir(area.nome, formatarDefasagem(r.defasagemMeses)))
    .join('');

  return `
    <div class="portagePerfil-doc-section">
      <h4>Zona de intervenção — áreas com defasagem</h4>
      ${linhas}
    </div>`;
}

function perfilDocRodapeFixo() {
  const agora = new Date().toLocaleDateString('pt-BR');
  return `<div class="portagePerfil-doc-footer-fixo">${escapeHtml(estado.patient.fullName)} — Perfil de Desenvolvimento emitido em ${escapeHtml(agora)}</div>`;
}

function montarDocumentoImpressaoPerfil() {
  if (!estado || !estado.temAplicacao) return '';
  return `
    <div class="portagePerfil-doc">
      ${perfilDocCabecalho()}
      ${perfilDocIdentificacao()}
      ${perfilDocResumo()}
      ${perfilDocRadar()}
      ${perfilDocTabelaAreas()}
      ${perfilDocZonaIntervencao()}
      ${perfilDocRodapeFixo()}
    </div>`;
}

function atualizarDocumentoImpressao() {
  const container = qs('#portagePerfil-documento-impressao');
  if (!container || !estado) return;
  container.innerHTML = montarDocumentoImpressaoPerfil();
}

let beforeprintRegistrado = false;

function garantirListenerImpressao() {
  if (beforeprintRegistrado) return;
  beforeprintRegistrado = true;
  window.addEventListener('beforeprint', atualizarDocumentoImpressao);
}

function bindEvents() {
  const imprimirBtn = qs('#portagePerfil-imprimir');
  if (imprimirBtn) {
    imprimirBtn.addEventListener('click', () => {
      atualizarDocumentoImpressao();
      window.print();
    });
  }
}

function render() {
  const root = qs('#s-portage-perfil');
  const { patient, inventario, resultado, aplicacao, temAplicacao } = estado;

  if (!temAplicacao) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-chart-line"></i> Perfil de Desenvolvimento</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState('Nenhuma aplicação do Inventário Portage foi registrada ainda. Acesse "Inventário Portage" para iniciar uma aplicação.')}
    `;
    return;
  }

  const rotulos = inventario.areas.map((a) => (a.id === 'motor' ? 'Motor' : a.nome));
  const valores = inventario.areas.map((a) => resultado.areas[a.id].percentualAdquirido);
  const camadas = [{ label: patient.fullName, valores, corVar: 'var(--primary)', preencher: true }];
  const svg = renderizarRadarSVG(camadas, rotulos, { size: 420 });
  const legenda = renderizarLegenda(camadas);

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-chart-line"></i> Perfil de Desenvolvimento</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)} · aplicação ${escapeHtml(aplicacao.id)} de ${escapeHtml(aplicacao.data || '—')}</div>

    <div class="no-print" style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
      <button class="btn btn-ghost btn-sm" type="button" id="portagePerfil-imprimir"><i class="fa-solid fa-print"></i> Imprimir / exportar Perfil de Desenvolvimento</button>
    </div>

    <div class="portage-resumo-grid">${resumoCards(inventario, resultado)}</div>

    <div class="panel">
      <div class="panel-header"><h3>Radar de desenvolvimento — 5 áreas</h3></div>
      <div class="panel-body" style="padding-top:18px;">${svg}${legenda}</div>
    </div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Pontuação por área</h3></div>
      <div class="panel-body" style="padding-top:14px;">${tabelaAreas(inventario, resultado)}</div>
    </div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>% de acertos por faixa etária</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        ${graficosPorFaixa(inventario, resultado)}
        <div class="footnote" style="margin-top:14px;"><i class="fa-solid fa-circle-info"></i>Faixas sem cobertura de avaliação suficiente aparecem como "sem dado" — a % de acertos considera apenas os itens efetivamente avaliados naquela faixa (não entra no cálculo o total de itens que ainda não foram respondidos).</div>
      </div>
    </div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Zona de intervenção — áreas com defasagem</h3></div>
      <div class="panel-body" style="padding-top:14px;">${zonaIntervencao(inventario, resultado)}</div>
    </div>

    <div class="footnote"><i class="fa-solid fa-circle-info"></i>O Inventário Portage Operacionalizado é um instrumento referenciado a critério, não normativo. Idades estimadas e defasagens são leituras de apoio ao planejamento pedagógico/terapêutico, calculadas apenas sobre faixas com cobertura de avaliação suficiente — nunca constituem diagnóstico nem substituem avaliação profissional.</div>

    <div id="portagePerfil-documento-impressao" class="doc-print-only"></div>
  `;

  bindEvents();
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [doc, patient, inventario, config] = await Promise.all([
    carregarDocumentoPortage(id),
    Store.load('patient', id),
    carregarInventario(),
    Config.load(),
  ]);

  const aplicacoes = doc.aplicacoes || [];
  const temAplicacao = !!aplicacoes.length;
  const aplicacao = temAplicacao ? aplicacoes[aplicacoes.length - 1] : null;
  const resultado = temAplicacao ? calcularPontuacaoPortage(aplicacao, inventario) : null;

  estado = {
    patientId: id,
    patient,
    inventario,
    config,
    doc,
    aplicacao,
    resultado,
    temAplicacao,
  };

  render();
  garantirListenerImpressao();
}
