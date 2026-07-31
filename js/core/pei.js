import { calcularPontuacaoPortage } from './portageScore.js';

const QUANTIDADE_LONGO_PRAZO_PADRAO = 6;
const QUANTIDADE_CURTO_MEDIO_PADRAO = 6;

const PUBLICO_PADRAO = ['pais', 'professora', 'terapeuta'];
const AMBIENTES_PADRAO = ['domiciliar', 'escolar', 'terapeutico', 'social'];
const CRITERIO_PERCENT_PADRAO = 90;
const DIAS_CONSECUTIVOS_PADRAO = 3;
const OCASIOES_PADRAO = 10;

function ordenarFaixas(inventario) {
  return new Map(inventario.faixas.map((f, i) => [f.id, i]));
}

function statusExplicito(aplicacao, itemId) {
  return aplicacao.respostas?.[itemId]?.status || 'nao_avaliado';
}

function ordenarPorFaixaENumero(itens, ordemFaixaMap) {
  return [...itens].sort((a, b) => {
    const fa = ordemFaixaMap.get(a.faixa) ?? 99;
    const fb = ordemFaixaMap.get(b.faixa) ?? 99;
    if (fa !== fb) return fa - fb;
    return a.numero - b.numero;
  });
}

function faixaIdDaIdade(inventario, idadeMeses) {
  if (idadeMeses === null || idadeMeses === undefined) return null;
  const faixa = inventario.faixas.find((f) => f.fimMeses === idadeMeses);
  return faixa ? faixa.id : null;
}

export function contextoPadrao() {
  return {
    ocasioes: OCASIOES_PADRAO,
    publico: [...PUBLICO_PADRAO],
    ambientes: [...AMBIENTES_PADRAO],
    criterioPercent: CRITERIO_PERCENT_PADRAO,
    diasConsecutivos: DIAS_CONSECUTIVOS_PADRAO,
  };
}

/**
 * Separa, por área, os itens pendentes (emergente/não adquirido/não avaliado) em dois grupos:
 * longo prazo = itens da faixa etária mais avançada com cobertura suficiente (a fronteira atual
 * do desenvolvimento da criança naquela área, calculada por calcularPontuacaoPortage);
 * curto/médio prazo = itens pendentes de faixas anteriores a essa fronteira (reforço de base).
 * Itens de faixas acima da fronteira (ainda não investigadas) não entram em nenhum dos dois grupos.
 */
export function separarObjetivosPorPrazo(aplicacao, inventario) {
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);
  const ordemFaixaMap = ordenarFaixas(inventario);

  const longoPrazo = [];
  const curtoMedioPrazo = [];

  inventario.areas.forEach((area) => {
    const r = resultado.areas[area.id];
    const faixaAtingidaId = faixaIdDaIdade(inventario, r.idadeEstimadaMeses);
    const idxAtingida = faixaAtingidaId ? ordemFaixaMap.get(faixaAtingidaId) : -1;

    const itensArea = ordenarPorFaixaENumero(inventario.itens.filter((i) => i.area === area.id), ordemFaixaMap);

    itensArea.forEach((item) => {
      const status = statusExplicito(aplicacao, item.id);
      if (status === 'adquirido') return;

      const idxItem = ordemFaixaMap.get(item.faixa) ?? 99;

      if (faixaAtingidaId && idxItem === idxAtingida) {
        longoPrazo.push({ item, area, status });
      } else if (faixaAtingidaId && idxItem < idxAtingida && status !== 'nao_avaliado') {
        curtoMedioPrazo.push({ item, area, status });
      }
    });
  });

  return { longoPrazo, curtoMedioPrazo };
}

function idObjetivo(prefixo, indice) {
  return `OBJ-${prefixo}-${String(indice).padStart(4, '0')}`;
}

function montarObjetivo(prefixo, indice, { item, area }) {
  return {
    id: idObjetivo(prefixo, indice),
    area: area.id,
    itemId: item.id,
    descricao: item.titulo,
    contexto: contextoPadrao(),
  };
}

function idPrograma(indice) {
  return `PRG-PEI-${String(indice).padStart(4, '0')}`;
}

/**
 * Deriva um Programa de Ensino por área com pendências, agrupando os itens do Portage
 * envolvidos como "resposta esperada" — reflete a estrutura de programa vista em PEIs reais
 * (estímulo discriminativo, ajudas, esvanecimento, critérios etc.). Campos técnicos ficam
 * vazios/default para a equipe preencher; a "resposta esperada" e os vínculos de rastreabilidade
 * (objetivoPeiId, itemPortageId) já vêm resolvidos a partir dos objetivos derivados.
 */
function derivarProgramaDeArea(indice, area, objetivosDaArea) {
  if (!objetivosDaArea.length) return null;
  const objetivoPrincipal = objetivosDaArea[0];

  return {
    id: idPrograma(indice),
    origem: 'pei',
    objetivoPeiId: objetivoPrincipal.id,
    itemPortageId: objetivoPrincipal.itemId,
    area: area.id,
    nome: `Programa de ${area.nome}`,
    estimuloDiscriminativo: '',
    respostaEsperada: objetivosDaArea.map((o) => o.itemId),
    observacao: '',
    ajudaHelpTypeIds: [],
    sistemaEsvanecimento: '',
    procedimentoEnsino: '',
    criterioAquisicaoPercent: CRITERIO_PERCENT_PADRAO,
    criterioAquisicaoDias: DIAS_CONSECUTIVOS_PADRAO,
    consequencia: '',
    correcaoErro: '',
    manutencao: {
      blocos: [
        { vezesPorSemana: 3, semanas: 8 },
        { vezesPorSemana: 2, semanas: 8 },
        { vezesPorSemana: 1, semanas: 8 },
      ],
    },
    passosEnsino: ['', '', '', ''],
    generalizacao: '',
  };
}

/**
 * Deriva o rascunho completo de PEI a partir de uma aplicação do inventário Portage:
 * objetivos de longo prazo e de curto/médio prazo (ver separarObjetivosPorPrazo), e um
 * Programa de Ensino por área que tenha ao menos um objetivo pendente, referenciando os
 * objetivos e itens Portage de origem para rastreabilidade.
 */
export function derivarObjetivosPEI(aplicacao, inventario, opcoes = {}) {
  const quantidadeLongoPrazo = opcoes.quantidadeLongoPrazo ?? QUANTIDADE_LONGO_PRAZO_PADRAO;
  const quantidadeCurtoMedioPrazo = opcoes.quantidadeCurtoMedioPrazo ?? QUANTIDADE_CURTO_MEDIO_PADRAO;

  const { longoPrazo, curtoMedioPrazo } = separarObjetivosPorPrazo(aplicacao, inventario);

  const objetivosLongoPrazo = longoPrazo
    .slice(0, quantidadeLongoPrazo)
    .map((c, i) => montarObjetivo('LP', i + 1, c));

  const objetivosCurtoMedioPrazo = curtoMedioPrazo
    .slice(0, quantidadeCurtoMedioPrazo)
    .map((c, i) => montarObjetivo('CMP', i + 1, c));

  const todosObjetivos = [...objetivosLongoPrazo, ...objetivosCurtoMedioPrazo];

  const programas = [];
  let contadorPrograma = 1;
  inventario.areas.forEach((area) => {
    const objetivosDaArea = todosObjetivos.filter((o) => o.area === area.id);
    const programa = derivarProgramaDeArea(contadorPrograma, area, objetivosDaArea);
    if (programa) {
      programas.push(programa);
      contadorPrograma += 1;
    }
  });

  return { objetivosLongoPrazo, objetivosCurtoMedioPrazo, programas };
}
