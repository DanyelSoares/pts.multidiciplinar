import { PROGRAM_STATUSES } from '../../core/programOptions.js';

function optionRow(opt) {
  return `<div class="kv"><div class="k">${opt.label}</div><div class="v">${opt.description}</div></div>`;
}

export async function render(container) {
  container.innerHTML = `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><h3>Frequência de aplicação</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <p style="font-size:12px;color:var(--muted);">O campo "Frequência de aplicação" do formulário de programa ABA é composto por 4 valores definidos por programa: quantidade de vezes (1 a 15), período (dia/semana/mês), duração (1 a 60) e unidade de tempo (segundos/minutos/horas). Não há opções fixas para configurar aqui — cada programa define os seus.</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>Status do programa</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px;">Opções fixas disponíveis no campo "Status do programa" do formulário de programa ABA.</p>
        <div class="kv-grid">${PROGRAM_STATUSES.map(optionRow).join('')}</div>
      </div>
    </div>
  `;
}
