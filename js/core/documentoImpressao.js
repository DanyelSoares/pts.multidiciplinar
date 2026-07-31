import { escapeHtml } from './dom.js';

export const RESSALVA_INSTRUMENTO_PORTAGE = 'O instrumento utilizado é referenciado a critério, não normativo: a posição obtida indica o repertório curricular observado, não constitui diagnóstico nem comparação com padrões populacionais. Este plano é uma ferramenta de planejamento pedagógico/terapêutico e não substitui avaliação diagnóstica formal.';

export function formatarIdadeExtenso(meses) {
  if (meses === null || meses === undefined || !Number.isFinite(meses)) return null;
  const anos = Math.floor(meses / 12);
  const restoMeses = Math.round(meses % 12);
  const parteAnos = anos > 0 ? `${anos} ano${anos !== 1 ? 's' : ''}` : '';
  const parteMeses = restoMeses > 0 ? `${restoMeses} ${restoMeses !== 1 ? 'meses' : 'mês'}` : '';
  if (parteAnos && parteMeses) return `${parteAnos} e ${parteMeses}`;
  return parteAnos || parteMeses || '0 mês';
}

export function campoOuOmitir(rotulo, valor, classe = 'doc-kv') {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor).trim();
  if (!texto) return '';
  return `<div class="${classe}"><b>${escapeHtml(rotulo)}:</b> ${escapeHtml(texto)}</div>`;
}

export function marcaInstitucional(institution, classe) {
  if (institution.logoUrl) return `<img src="${escapeHtml(institution.logoUrl)}" alt="">`;
  return `<div class="${classe}"><span class="plus">+m</span><span class="sub">SAÚDE</span></div>`;
}
