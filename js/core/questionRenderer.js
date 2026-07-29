import { escapeHtml, qsa } from './dom.js';

export function renderOptionsList(options, selected, name) {
  return `<div class="q-options">${options
    .map(
      (opt, i) => `<div class="q-option${i === selected ? ' selected' : ''}" data-choice="${i}"><span class="radio"></span> ${escapeHtml(opt)}</div>`
    )
    .join('')}</div>`;
}

export function renderOptionsGroup(group, groupName, selected) {
  return `<div class="q-options" data-group="${groupName}">${group.options
    .map(
      (opt, i) => `<div class="q-option${i === selected ? ' selected' : ''}" data-group="${groupName}" data-choice="${i}"><span class="radio"></span> ${escapeHtml(opt)}</div>`
    )
    .join('')}</div>`;
}

export function renderQuestionBody(q) {
  if (q.type === 'single') {
    return renderOptionsList(q.options, q.selected, q.type);
  }
  if (q.type === 'freq3') {
    return `
      <div class="q-freq3-block">
        <div class="q-freq3-label">Frequência</div>
        ${renderOptionsGroup(q.frequency, 'frequency', q.frequency.selected)}
      </div>
      <div class="q-freq3-block">
        <div class="q-freq3-label">Impacto funcional</div>
        ${renderOptionsGroup(q.impact, 'impact', q.impact.selected)}
      </div>
      <div class="q-freq3-block">
        <div class="q-freq3-label">Ambiente de ocorrência</div>
        ${renderOptionsGroup(q.setting, 'setting', q.setting.selected)}
      </div>`;
  }
  if (q.type === 'yesno') {
    return `<div class="q-yesno">
      <button type="button" class="${q.selected === 'yes' ? 'selected yes' : ''}" data-choice="yes"><i class="fa-solid fa-check"></i> Sim</button>
      <button type="button" class="${q.selected === 'no' ? 'selected no' : ''}" data-choice="no"><i class="fa-solid fa-xmark"></i> Não</button>
    </div>`;
  }
  if (q.type === 'text') {
    return `<textarea class="q-textarea" placeholder="Descreva com suas palavras...">${escapeHtml(q.textValue || '')}</textarea>`;
  }
  return '';
}

export function bindQuestionInteractions(q, root) {
  if (q.type === 'single') {
    qsa('.q-option', root).forEach((el) => {
      el.addEventListener('click', () => {
        qsa('.q-option', root).forEach((o) => o.classList.remove('selected'));
        el.classList.add('selected');
        q.selected = parseInt(el.dataset.choice, 10);
      });
    });
  } else if (q.type === 'freq3') {
    ['frequency', 'impact', 'setting'].forEach((groupName) => {
      qsa(`.q-option[data-group="${groupName}"]`, root).forEach((el) => {
        el.addEventListener('click', () => {
          qsa(`.q-option[data-group="${groupName}"]`, root).forEach((o) => o.classList.remove('selected'));
          el.classList.add('selected');
          q[groupName].selected = parseInt(el.dataset.choice, 10);
        });
      });
    });
  } else if (q.type === 'yesno') {
    qsa('.q-yesno button', root).forEach((el) => {
      el.addEventListener('click', () => {
        qsa('.q-yesno button', root).forEach((o) => o.classList.remove('selected', 'yes', 'no'));
        el.classList.add('selected', el.dataset.choice);
        q.selected = el.dataset.choice;
      });
    });
  }
}
