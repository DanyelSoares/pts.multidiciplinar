const VALOR_FREQUENCIA = { 0: 0, 1: 25, 2: 50, 3: 75, 4: 100 };

function pontuacaoResposta(pergunta) {
  const idx = pergunta.frequency?.selected;
  if (idx === null || idx === undefined) return null;
  return VALOR_FREQUENCIA[idx] ?? null;
}

export function calcularSeveridade(interviewData) {
  const dominiosRadar = interviewData.domains.filter((d) => d.inRadar);
  const dominios = {};

  dominiosRadar.forEach((d) => {
    const perguntas = interviewData.questions.filter((q) => q.domain === d.id && q.type === 'freq3');
    const pontuacoes = perguntas.map(pontuacaoResposta).filter((v) => v !== null);
    const minRespostas = d.minRespostas || 1;
    const atingeMinimo = pontuacoes.length >= minRespostas;
    dominios[d.id] = {
      pontuacao: atingeMinimo ? pontuacoes.reduce((a, b) => a + b, 0) / pontuacoes.length : null,
      respondidas: pontuacoes.length,
      total: perguntas.length,
      minRespostas,
    };
  });

  const completo = dominiosRadar.every((d) => dominios[d.id].respondidas === dominios[d.id].total && dominios[d.id].total > 0);

  return { dominios, completo };
}

export function resumirImpactoAmbiente(interviewData, domainId) {
  const perguntas = interviewData.questions.filter((q) => q.domain === domainId && q.type === 'freq3');
  const impactos = {};
  const ambientes = {};

  perguntas.forEach((q) => {
    const impactoIdx = q.impact?.selected;
    if (impactoIdx !== null && impactoIdx !== undefined) {
      const label = q.impact.options[impactoIdx];
      impactos[label] = (impactos[label] || 0) + 1;
    }
    const ambienteIdx = q.setting?.selected;
    if (ambienteIdx !== null && ambienteIdx !== undefined) {
      const label = q.setting.options[ambienteIdx];
      ambientes[label] = (ambientes[label] || 0) + 1;
    }
  });

  return { impactos, ambientes };
}

export function obterAlertaDominio8(interviewData) {
  const pergunta = interviewData.questions.find((q) => q.triggersAlert);
  if (!pergunta) return { mostrar: false, texto: '' };
  const mostrar = pergunta.selected === 0;
  return { mostrar, texto: mostrar ? pergunta.alertText : '' };
}
