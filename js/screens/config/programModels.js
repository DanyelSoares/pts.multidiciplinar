import { PROGRAM_FREQUENCIES, PROGRAM_STATUSES } from '../../core/programOptions.js';

function optionRow(opt) {
  return `<div class="kv"><div class="k">${opt.label}</div><div class="v">${opt.description}</div></div>`;
}

export async function render(container) {
  container.innerHTML = `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><h3>Frequência de aplicação</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px;">Opções fixas disponíveis no campo "Frequência de aplicação" do formulário de programa ABA.</p>
        <div class="kv-grid">${PROGRAM_FREQUENCIES.map(optionRow).join('')}</div>
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
