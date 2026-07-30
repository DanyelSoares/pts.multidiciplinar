import Store from '../core/store.js';
import Patient from '../core/patient.js';
import LocalData from '../core/localData.js';
import { carregarInventario } from '../core/portage.js';
import { calcularPontuacaoPortage } from '../core/portageScore.js';
import { renderizarRadarSVG, renderizarLegenda } from '../core/graficoRadar.js';
import { escapeHtml, qs, emptyState } from '../core/dom.js';

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
      <td>Total — ${escapeHtml(area.nome)}</td>
      <td>${r.adquiridos}/${r.totalItens}</td>
      <td>${r.emergentes}</td>
      <td>${(r.cobertura * 100).toFixed(0)}%</td>
      <td>${r.idadeEstimadaMeses === null ? '—' : formatarIdade(r.idadeEstimadaMeses)}</td>
      <td>${formatarDefasagem(r.defasagemMeses)}</td>
    </tr>`;
}

const TOOLTIP_COLUNAS = {
  'Faixa etária': 'Intervalo de idade do Guia Portage ao qual os itens desta linha pertencem.',
  'Adquiridos': 'Itens marcados como "Adquirido" (Sim) sobre o total de itens da linha — inclui itens creditados automaticamente por uma Base (basal) declarada.',
  'Emergentes': 'Itens marcados como "Emergente" (Às vezes) — habilidade em desenvolvimento, ainda não consolidada.',
  'Cobertura': 'Percentual de itens que já receberam alguma resposta (Adquirido, Emergente ou Não adquirido) sobre o total da linha. O restante está "Não avaliado".',
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
  const colunas = ['Faixa etária', 'Adquiridos', 'Emergentes', 'Cobertura', 'Idade estimada', 'Defasagem'];
  return `
    <table class="portage-tabela-area">
      <thead>
        <tr><th colspan="6">${escapeHtml(area.nome)}</th></tr>
        <tr>${colunas.map(thComTooltip).join('')}</tr>
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
  const larguraBarra = 44;
  const gap = 14;
  const altura = 130;
  const margemEsquerda = 34;
  const margemBaixo = 34;
  const largura = margemEsquerda + inventario.faixas.length * (larguraBarra + gap);
  const alturaTotal = altura + margemBaixo + 10;

  const barras = inventario.faixas
    .map((faixa, i) => {
      const c = resultado.areas[area.id].contagemPorFaixa[faixa.id];
      const pct = percentualPorFaixa(c);
      const x = margemEsquerda + i * (larguraBarra + gap);
      const semDado = pct === null;
      const alturaBarra = semDado ? 0 : (pct / 100) * altura;
      const y = 10 + (altura - alturaBarra);
      const rotuloValor = semDado ? 'sem dado' : `${pct.toFixed(0)}%`;
      const corBarra = semDado ? 'var(--border)' : 'var(--primary)';
      return `
        <g>
          <rect x="${x}" y="${y}" width="${larguraBarra}" height="${Math.max(alturaBarra, semDado ? 2 : 0)}" fill="${corBarra}" rx="4"/>
          <text x="${x + larguraBarra / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${semDado ? 'var(--muted)' : 'var(--primary)'}">${rotuloValor}</text>
          <text x="${x + larguraBarra / 2}" y="${altura + 24}" text-anchor="middle" font-size="10" fill="var(--muted)">${escapeHtml(faixa.rotulo.replace(' a ', '-').replace(' anos', '').replace(' ano', ''))}</text>
        </g>`;
    })
    .join('');

  return `
    <div class="portage-grafico-area">
      <div class="portage-grafico-titulo">${escapeHtml(area.nome)}</div>
      <svg viewBox="0 0 ${largura} ${alturaTotal}" width="100%" style="max-width:${largura}px;">
        <line x1="${margemEsquerda - 6}" y1="${10 + altura}" x2="${largura}" y2="${10 + altura}" stroke="var(--border)" stroke-width="1"/>
        ${barras}
      </svg>
    </div>`;
}

function graficosPorFaixa(inventario, resultado) {
  return `<div class="portage-graficos-grid">${inventario.areas.map((area) => graficoBarrasArea(area, inventario, resultado)).join('')}</div>`;
}

function zonaIntervencao(inventario, resultado) {
  const areasComDefasagem = inventario.areas
    .map((area) => ({ area, r: resultado.areas[area.id] }))
    .filter(({ r }) => r.defasagemMeses !== null && r.defasagemMeses < 0)
    .sort((a, b) => a.r.defasagemMeses - b.r.defasagemMeses);

  if (!areasComDefasagem.length) {
    return emptyState('Nenhuma área com defasagem identificada a partir dos dados avaliados até o momento.');
  }

  const linhas = areasComDefasagem
    .map(({ area, r }) => `<div class="kv"><div class="k">${escapeHtml(area.nome)}</div><div class="v">${formatarDefasagem(r.defasagemMeses)}</div></div>`)
    .join('');

  return `<div class="kv-grid">${linhas}</div>`;
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [doc, patient, inventario] = await Promise.all([
    carregarDocumentoPortage(id),
    Store.load('patient', id),
    carregarInventario(),
  ]);
  const root = qs('#s-portage-perfil');

  const aplicacoes = doc.aplicacoes || [];
  if (!aplicacoes.length) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-chart-line"></i> Perfil de Desenvolvimento</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState('Nenhuma aplicação do Inventário Portage foi registrada ainda. Acesse "Inventário Portage" para iniciar uma aplicação.')}
    `;
    return;
  }

  const aplicacao = aplicacoes[aplicacoes.length - 1];
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);

  const rotulos = inventario.areas.map((a) => (a.id === 'motor' ? 'Motor' : a.nome));
  const valores = inventario.areas.map((a) => resultado.areas[a.id].percentualAdquirido);
  const camadas = [{ label: patient.fullName, valores, corVar: 'var(--primary)', preencher: true }];
  const svg = renderizarRadarSVG(camadas, rotulos, { size: 420 });
  const legenda = renderizarLegenda(camadas);

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-chart-line"></i> Perfil de Desenvolvimento</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)} · aplicação ${escapeHtml(aplicacao.id)} de ${escapeHtml(aplicacao.data || '—')}</div>

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
  `;
}
