import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Config from '../core/config.js';
import Catalog from '../core/catalog.js';
import { calcularSeveridade, obterAlertaDominio8, montarShapeLegado } from '../core/severidade.js';
import { renderizarRadarSVG, renderizarLegenda } from '../core/graficoRadar.js';
import { escapeHtml, qs, emptyState } from '../core/dom.js';

let estado = null;

function tabelaDominios(dominiosRadar, resultado) {
  const linhas = dominiosRadar
    .map((d) => {
      const info = resultado.dominios[d.id];
      const abaixoMinimo = info.pontuacao === null && info.respondidas > 0 && info.respondidas < info.minRespostas;
      let valor = '—';
      if (info.pontuacao !== null) valor = `${info.pontuacao.toFixed(0)}%`;
      else if (abaixoMinimo) valor = `Mín. ${info.minRespostas} respostas`;
      return `<tr><td>${escapeHtml(d.name)}</td><td>${valor}</td><td>${info.respondidas}/${info.total}</td></tr>`;
    })
    .join('');
  return `
    <table>
      <thead><tr><th>Domínio</th><th>Severidade</th><th>Perguntas respondidas</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function contextoDominios(interview, dominiosContexto) {
  const blocos = dominiosContexto
    .map((dominio) => {
      const perguntas = interview.questions.filter((q) => q.domain === dominio.id);
      if (!perguntas.length) return '';
      const linhas = perguntas
        .map((q) => {
          let resposta = 'Não respondido';
          if (q.type === 'freq3') {
            const idx = q.frequency?.selected;
            if (idx !== null && idx !== undefined) resposta = q.frequency.options[idx];
          } else if (q.selected !== null && q.selected !== undefined && q.options) {
            resposta = q.options[q.selected];
          }
          return `<div class="kv"><div class="k">${escapeHtml(q.text)}</div><div class="v">${escapeHtml(resposta)}</div></div>`;
        })
        .join('');
      return `
        <div class="panel" style="margin-top:20px;">
          <div class="panel-header"><h3>${escapeHtml(dominio.name)}</h3></div>
          <div class="panel-body" style="padding-top:14px;">
            <div class="kv-grid">${linhas}</div>
          </div>
        </div>`;
    })
    .join('');
  return blocos;
}

function montarCamadas(patient, dominiosRadar, resultado) {
  const valores = dominiosRadar.map((d) => resultado.dominios[d.id].pontuacao);
  const camadas = [{ label: patient.fullName, valores, corVar: 'var(--primary)', preencher: true }];

  const perfilId = qs('#seletor-perfil-referencia')?.value;
  if (perfilId && perfilId !== 'none') {
    const perfil = estado.config.referenceProfiles.find((p) => p.id === perfilId);
    if (perfil) {
      const valoresPerfil = dominiosRadar.map((d) => perfil.values[d.slug] ?? null);
      camadas.push({ label: perfil.label, valores: valoresPerfil, corVar: perfil.colorVar, tracejado: true, preencher: false });
    }
  }

  return camadas;
}

function renderRadarArea() {
  const { patient, dominiosRadar, resultado } = estado;
  const rotulos = dominiosRadar.map((d) => d.name);
  const camadas = montarCamadas(patient, dominiosRadar, resultado);
  const svg = renderizarRadarSVG(camadas, rotulos, { size: 460 });
  const legenda = renderizarLegenda(camadas);

  const perfilSelecionado = qs('#seletor-perfil-referencia')?.value;
  const disclaimer = perfilSelecionado && perfilSelecionado !== 'none'
    ? `<div class="footnote" style="margin-top:14px;"><i class="fa-solid fa-circle-info"></i>${escapeHtml(estado.config.referenceProfilesDisclaimer)}</div>`
    : '';

  qs('#radar-area').innerHTML = `${svg}${legenda}${disclaimer}`;
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [anamneseDoc, patient, config, templates] = await Promise.all([
    Store.load('anamnese', id),
    Store.load('patient', id),
    Config.load(),
    Catalog.listAnamneseTemplates(),
  ]);
  const root = qs('#s-severidade');

  const interview = montarShapeLegado(anamneseDoc, templates);
  const resultado = calcularSeveridade(interview);
  const alertaD8 = obterAlertaDominio8(interview);

  if (!resultado.completo) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-chart-simple"></i> Perfil de Severidade</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState('Complete as anamneses do radar de severidade (8 domínios) para gerar o perfil.')}
    `;
    return;
  }

  const dominiosRadar = interview.domains.filter((d) => d.inRadar);
  const dominiosContexto = interview.domains.filter((d) => d.kind === 'context');
  const dominioAlerta = interview.domains.find((d) => d.kind === 'alert');

  estado = { patient, dominiosRadar, resultado, config };

  const alertaHtml = alertaD8.mostrar
    ? `<div class="alert-card" style="margin-bottom:18px;">
        <div class="title"><i class="fa-solid fa-triangle-exclamation"></i> Alerta clínico — ${escapeHtml(dominioAlerta ? dominioAlerta.name : 'Episódios visuais')}</div>
        ${escapeHtml(alertaD8.texto)}
      </div>`
    : '';

  const opcoesPerfil = config.referenceProfiles
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`)
    .join('');

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-chart-simple"></i> Perfil de Severidade</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)} · gerado a partir das respostas das anamneses aplicadas</div>

    ${alertaHtml}

    <div class="panel">
      <div class="panel-header">
        <h3>Radar de severidade — 8 domínios</h3>
        <div class="field-group" style="min-width:220px;">
          <div class="select-wrap"><i class="fa-solid fa-layer-group"></i>
            <select class="select-input" id="seletor-perfil-referencia">
              <option value="none">Sem perfil comparativo</option>
              ${opcoesPerfil}
            </select>
          </div>
        </div>
      </div>
      <div class="panel-body" style="padding-top:18px;" id="radar-area"></div>
    </div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Pontuação por domínio</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        ${tabelaDominios(dominiosRadar, resultado)}
      </div>
    </div>

    ${contextoDominios(interview, dominiosContexto)}

    <div class="footnote"><i class="fa-solid fa-circle-info"></i>Este perfil é uma leitura quantitativa das respostas das anamneses, apresentada como recomendação pendente de validação profissional — não constitui diagnóstico.</div>
  `;

  renderRadarArea();
  qs('#seletor-perfil-referencia').addEventListener('change', renderRadarArea);
}
