const VALOR_FREQUENCIA = { 0: 0, 1: 25, 2: 50, 3: 75, 4: 100 };

const RADAR_META = {
  anamnese_impulsivity: { inRadar: true, order: 0 },
  anamnese_inattention: { inRadar: true, order: 1 },
  anamnese_temporal_blindness: { inRadar: true, order: 2, minRespostas: 4 },
  anamnese_hyperactivity: { inRadar: true, order: 3 },
  anamnese_emotional_dysregulation: { inRadar: true, order: 4 },
  anamnese_task_initiation: { inRadar: true, order: 5 },
  anamnese_hyperfocus: { inRadar: true, order: 6 },
  anamnese_sensory: { inRadar: true, order: 7 },
  anamnese_interacao_social: { kind: 'context' },
  anamnese_pessoa_de_referencia_e_separacao: { kind: 'context' },
  anamnese_episodios_visuais: { kind: 'alert' },
  anamnese_diagnosticos_e_investigacao: { kind: 'context' },
};

const ALERT_META = {
  'anamnese_episodios_visuais:d10q1': {
    alertText: 'Esse achado exige encaminhamento clínico. Não deve ser classificado como característica de TEA ou TDAH sem avaliação médica.',
  },
};

function montarQuestion(templateId, question, answer) {
  const base = { ...question, domain: templateId };
  const alertMeta = ALERT_META[`${templateId}:${question.id}`];
  if (alertMeta) {
    base.triggersAlert = true;
    base.alertText = alertMeta.alertText;
  }
  if (!answer) return base;
  if (question.type === 'single' || question.type === 'yesno') {
    base.selected = answer.selected ?? null;
  } else if (question.type === 'freq3') {
    base.frequency = { ...question.frequency, selected: answer.frequency?.selected ?? null };
    base.impact = { ...question.impact, selected: answer.impact?.selected ?? null };
    base.setting = { ...question.setting, selected: answer.setting?.selected ?? null };
  } else if (question.type === 'text') {
    base.textValue = answer.textValue ?? '';
  }
  return base;
}

export function montarShapeLegado(anamneseDoc, templates) {
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const selectedIds = anamneseDoc.selectedTemplateIds || [];

  const domains = selectedIds
    .map((templateId) => {
      const template = templateById.get(templateId);
      const meta = RADAR_META[templateId];
      if (!template || !meta) return null;
      return {
        id: templateId,
        name: template.name,
        slug: templateId.replace(/^anamnese_/, ''),
        inRadar: !!meta.inRadar,
        kind: meta.kind,
        minRespostas: meta.minRespostas,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (RADAR_META[a.id]?.order ?? 99) - (RADAR_META[b.id]?.order ?? 99));

  const questions = [];
  selectedIds.forEach((templateId) => {
    const template = templateById.get(templateId);
    if (!template) return;
    const templateAnswers = anamneseDoc.answers?.[templateId] || {};
    template.categories.forEach((category) => {
      category.questions.forEach((question) => {
        questions.push(montarQuestion(templateId, question, templateAnswers[question.id]));
      });
    });
  });

  return { domains, questions };
}

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
