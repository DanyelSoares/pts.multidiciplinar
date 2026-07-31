export const FREQUENCY_PERIODOS = [
  { id: 'dia', label: 'dia' },
  { id: 'semana', label: 'semana' },
  { id: 'mes', label: 'mês' },
];

export const FREQUENCY_UNIDADES = [
  { id: 'segundos', label: 'segundos' },
  { id: 'minutos', label: 'minutos' },
  { id: 'horas', label: 'horas' },
];

export function frequencyDescricao({ quantidade, periodo, duracao, unidade }) {
  if (!quantidade || !periodo || !duracao || !unidade) return null;
  const periodoLabel = FREQUENCY_PERIODOS.find((p) => p.id === periodo)?.label || periodo;
  const unidadeLabel = FREQUENCY_UNIDADES.find((u) => u.id === unidade)?.label || unidade;
  return `${quantidade}x ${periodoLabel}, ${duracao} ${unidadeLabel}`;
}

export const PROGRAM_STATUSES = [
  { id: 'not_started', label: 'Não iniciado', description: 'Programa configurado, mas ainda sem aplicação.' },
  { id: 'in_progress', label: 'Em aplicação', description: 'Programa em curso de aplicação com o aprendiz.' },
  { id: 'generalized', label: 'Generalizado', description: 'Habilidade consolidada e generalizada para outros contextos.' },
];
