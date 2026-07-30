const COBERTURA_MINIMA_PADRAO = 0.6;

function statusDoItem(aplicacao, itemId, faixaId, areaId, faixasAbaixoOuIgualBase) {
  const resposta = aplicacao.respostas?.[itemId];
  if (resposta?.status) return resposta.status;
  if (faixasAbaixoOuIgualBase.has(faixaId)) return 'adquirido';
  return 'nao_avaliado';
}

function conjuntoFaixasNaBaseOuAbaixo(inventario, faixaBaseId) {
  const ids = inventario.faixas.map((f) => f.id);
  const conjunto = new Set();
  if (!faixaBaseId) return conjunto;
  const idxBase = ids.indexOf(faixaBaseId);
  if (idxBase === -1) return conjunto;
  for (let i = 0; i <= idxBase; i++) conjunto.add(ids[i]);
  return conjunto;
}

function conjuntoFaixasAcimaDoTeto(inventario, faixaTetoId) {
  const ids = inventario.faixas.map((f) => f.id);
  const conjunto = new Set();
  if (!faixaTetoId) return conjunto;
  const idxTeto = ids.indexOf(faixaTetoId);
  if (idxTeto === -1) return conjunto;
  for (let i = idxTeto + 1; i < ids.length; i++) conjunto.add(ids[i]);
  return conjunto;
}

function pontosDoStatus(status, escala) {
  const def = escala.find((e) => e.valor === status);
  return def ? def.pontos : null;
}

function calcularFaixaDeAreaAtingida(inventario, area, contagemPorFaixa, coberturaMinima) {
  const faixaIds = inventario.faixas.map((f) => f.id);
  let ultimaFaixaAdquirida = null;

  for (const faixaId of faixaIds) {
    const c = contagemPorFaixa[faixaId];
    if (!c || c.total === 0) continue;
    const coberturaFaixa = c.avaliados / c.total;
    if (coberturaFaixa < coberturaMinima) break;
    const proporcaoAdquirida = (c.adquiridos + c.emergentes * 0.5) / c.avaliados;
    if (proporcaoAdquirida >= 0.5) {
      ultimaFaixaAdquirida = faixaId;
    } else {
      break;
    }
  }

  return ultimaFaixaAdquirida;
}

/**
 * Calcula a pontuação Portage por área, corrigindo os dois defeitos da planilha original:
 * itens nao_avaliado saem do denominador (cobertura por faixa), e a idade de cada área
 * é derivada apenas das faixas com cobertura suficiente — nunca dividida por um total fixo
 * de áreas/faixas que inclui dados não coletados.
 */
export function calcularPontuacaoPortage(aplicacao, inventario, opcoes = {}) {
  const coberturaMinima = opcoes.coberturaMinima ?? COBERTURA_MINIMA_PADRAO;
  const resultadoPorArea = {};

  inventario.areas.forEach((area) => {
    const faixaBaseId = aplicacao.base?.[area.id] || null;
    const faixaTetoId = aplicacao.teto?.[area.id] || null;
    const faixasNaBaseOuAbaixo = conjuntoFaixasNaBaseOuAbaixo(inventario, faixaBaseId);
    const faixasAcimaDoTeto = conjuntoFaixasAcimaDoTeto(inventario, faixaTetoId);

    const itensArea = inventario.itens.filter((i) => i.area === area.id);
    const contagemPorFaixa = {};

    inventario.faixas.forEach((faixa) => {
      contagemPorFaixa[faixa.id] = { adquiridos: 0, emergentes: 0, naoAdquiridos: 0, naoAvaliados: 0, avaliados: 0, total: 0 };
    });

    let adquiridos = 0;
    let emergentes = 0;
    let naoAdquiridos = 0;
    let naoAvaliados = 0;

    itensArea.forEach((item) => {
      let status;
      if (faixasAcimaDoTeto.has(item.faixa)) {
        status = 'nao_adquirido';
      } else {
        status = statusDoItem(aplicacao, item.id, item.faixa, area.id, faixasNaBaseOuAbaixo);
      }

      const c = contagemPorFaixa[item.faixa];
      c.total += 1;

      if (status === 'adquirido') {
        adquiridos += 1;
        c.adquiridos += 1;
        c.avaliados += 1;
      } else if (status === 'emergente') {
        emergentes += 1;
        c.emergentes += 1;
        c.avaliados += 1;
      } else if (status === 'nao_adquirido') {
        naoAdquiridos += 1;
        c.naoAdquiridos += 1;
        c.avaliados += 1;
      } else {
        naoAvaliados += 1;
        c.naoAvaliados += 1;
      }
    });

    const avaliadosTotal = adquiridos + emergentes + naoAdquiridos;
    const coberturaGeral = itensArea.length > 0 ? avaliadosTotal / itensArea.length : 0;

    const faixaAtingida = calcularFaixaDeAreaAtingida(inventario, area, contagemPorFaixa, coberturaMinima);
    const faixaAtingidaInfo = faixaAtingida ? inventario.faixas.find((f) => f.id === faixaAtingida) : null;

    const faixasComCoberturaSuficiente = inventario.faixas.filter((f) => {
      const c = contagemPorFaixa[f.id];
      if (!c || c.total === 0) return false;
      return c.avaliados / c.total >= coberturaMinima;
    });

    const idadeEstimadaMeses = faixasComCoberturaSuficiente.length > 0 && faixaAtingidaInfo
      ? faixaAtingidaInfo.fimMeses
      : null;

    const defasagemMeses = idadeEstimadaMeses !== null && Number.isFinite(aplicacao.idadeCronologicaMeses)
      ? idadeEstimadaMeses - aplicacao.idadeCronologicaMeses
      : null;

    const percentualAdquirido = itensArea.length > 0
      ? ((adquiridos + emergentes * 0.5) / itensArea.length) * 100
      : null;

    resultadoPorArea[area.id] = {
      adquiridos,
      emergentes,
      naoAdquiridos,
      naoAvaliados,
      totalItens: itensArea.length,
      cobertura: coberturaGeral,
      idadeEstimadaMeses,
      defasagemMeses,
      percentualAdquirido,
      contagemPorFaixa,
    };
  });

  const areasComIdade = Object.values(resultadoPorArea).filter((r) => r.idadeEstimadaMeses !== null);
  const idadeGlobalMeses = areasComIdade.length > 0
    ? areasComIdade.reduce((soma, r) => soma + r.idadeEstimadaMeses, 0) / areasComIdade.length
    : null;

  return {
    areas: resultadoPorArea,
    idadeGlobalMeses,
    areasAvaliadas: areasComIdade.length,
    totalAreas: inventario.areas.length,
  };
}

export function pontosPorItem(inventario) {
  return inventario.escala.map((e) => ({ valor: e.valor, rotulo: e.rotulo, pontos: e.pontos }));
}

export { pontosDoStatus };
