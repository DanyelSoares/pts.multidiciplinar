export function calcularProgressoSessao(session) {
  const total = session.attempts.length;
  const corretas = session.attempts.filter((a) => a.correct).length;
  return {
    totalTentativas: total,
    corretas,
    percentAcerto: total > 0 ? (corretas / total) * 100 : 0,
  };
}

export function calcularSerieSessoes(program) {
  const sessions = program.sessions || [];
  return sessions.map((session, i) => {
    const progresso = calcularProgressoSessao(session);
    return {
      label: `S${i + 1}`,
      value: Math.round(progresso.percentAcerto),
      baseline: !!session.baseline,
    };
  });
}

export function totalAplicacoesBloco(config) {
  return (config.stimulusIds?.length || 0) * (config.attemptsPerStimulus || 0);
}

export function montarSequenciaTentativas(config) {
  const sequencia = [];
  (config.stimulusIds || []).forEach((stimulusId) => {
    for (let i = 0; i < (config.attemptsPerStimulus || 0); i++) {
      sequencia.push({ stimulusId });
    }
  });
  return sequencia;
}

export function tentativasRestantes(session, config) {
  const total = totalAplicacoesBloco(config);
  const feitas = session ? session.attempts.length : 0;
  return Math.max(0, total - feitas);
}

export function criarNovaSessao() {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    id: `sess-${Date.now()}`,
    date: `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`,
    baseline: false,
    attempts: [],
  };
}
