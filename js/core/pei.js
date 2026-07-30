const MINIMO_OBJETIVOS_POR_AREA = 2;
const PADRAO_OBJETIVOS_POR_AREA = 3;

function ordenarFaixas(inventario) {
  const mapa = new Map(inventario.faixas.map((f, i) => [f.id, i]));
  return mapa;
}

function candidatosDaArea(aplicacao, inventario, areaId, ordemFaixaMap) {
  const itensArea = inventario.itens.filter((i) => i.area === areaId);

  const comStatus = itensArea.map((item) => {
    const resposta = aplicacao.respostas?.[item.id];
    return { item, status: resposta?.status || 'nao_avaliado' };
  });

  const emergentes = comStatus.filter((c) => c.status === 'emergente');
  const naoAdquiridos = comStatus.filter((c) => c.status === 'nao_adquirido');

  const ordenar = (lista) =>
    lista.sort((a, b) => {
      const fa = ordemFaixaMap.get(a.item.faixa) ?? 99;
      const fb = ordemFaixaMap.get(b.item.faixa) ?? 99;
      if (fa !== fb) return fa - fb;
      return a.item.numero - b.item.numero;
    });

  ordenar(emergentes);
  ordenar(naoAdquiridos);

  return [...emergentes, ...naoAdquiridos];
}

function idObjetivo(indice) {
  return `OBJ-${String(indice).padStart(4, '0')}`;
}

/**
 * Deriva um rascunho de objetivos de PEI a partir de uma aplicação do inventário Portage.
 * Itens emergentes têm prioridade sobre não-adquiridos (mais próximos de serem atingidos);
 * dentro de cada grupo, a ordem segue área -> faixa -> número, refletindo a progressão do
 * instrumento. O objetivo derivado é um rascunho: os campos de plano (estratégias, materiais,
 * responsável, frequência) ficam vazios para preenchimento pela equipe.
 */
export function derivarObjetivosPEI(aplicacao, inventario, opcoes = {}) {
  const minimoPorArea = opcoes.minimoPorArea ?? MINIMO_OBJETIVOS_POR_AREA;
  const quantidadePorArea = Math.max(minimoPorArea, opcoes.quantidadePorArea ?? PADRAO_OBJETIVOS_POR_AREA);
  const ordemFaixaMap = ordenarFaixas(inventario);

  const objetivos = [];
  let contador = 1;

  inventario.areas.forEach((area) => {
    const candidatos = candidatosDaArea(aplicacao, inventario, area.id, ordemFaixaMap);
    const selecionados = candidatos.slice(0, quantidadePorArea);

    selecionados.forEach(({ item, status }) => {
      objetivos.push({
        id: idObjetivo(contador),
        area: area.id,
        itemId: item.id,
        prioridade: status === 'emergente' ? 'alta' : 'media',
        longoPrazo: item.titulo,
        condicao: '',
        resposta: '',
        criterio: '',
        estrategias: '',
        materiais: '',
        responsavel: '',
        frequencia: '',
        prazoSemanas: 8,
        statusObjetivo: 'nao_iniciado',
        reavaliarEm: '',
      });
      contador += 1;
    });
  });

  const areasPrioritarias = inventario.areas
    .map((area) => {
      const candidatos = candidatosDaArea(aplicacao, inventario, area.id, ordemFaixaMap);
      return { areaId: area.id, pendencias: candidatos.length };
    })
    .filter((a) => a.pendencias > 0)
    .sort((a, b) => b.pendencias - a.pendencias)
    .map((a) => a.areaId);

  return { objetivos, areasPrioritarias };
}
