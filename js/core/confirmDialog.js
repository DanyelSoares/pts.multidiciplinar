import { escapeHtml, qs, qsa } from './dom.js';

let resolvePending = null;

function close(result) {
  const el = qs('#confirm-dialog');
  if (el) el.classList.remove('open');
  if (resolvePending) {
    const resolve = resolvePending;
    resolvePending = null;
    resolve(result);
  }
}

function bindEvents() {
  qsa('.confirm-dialog-no', qs('#confirm-dialog')).forEach((btn) => {
    btn.addEventListener('click', () => close(false));
  });
  qs('#confirm-dialog-yes').addEventListener('click', () => close(true));
  qs('#confirm-dialog').addEventListener('click', (e) => {
    if (e.target.id === 'confirm-dialog') close(false);
  });
}

function show(message = 'O item será excluído e não poderá ser restaurado. Deseja realmente excluir?') {
  const el = qs('#confirm-dialog');
  if (!el) return Promise.resolve(false);

  if (resolvePending) close(false);

  el.innerHTML = `
    <div class="modal-panel panel" style="width:420px;">
      <div class="panel-header">
        <h3><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i> Confirmar exclusão</h3>
        <button type="button" class="modal-close confirm-dialog-no" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="panel-body" style="padding-top:16px;">
        <p style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:20px;">${escapeHtml(message)}</p>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-ghost confirm-dialog-no" type="button">Não</button>
          <button class="btn btn-danger" type="button" id="confirm-dialog-yes">Sim</button>
        </div>
      </div>
    </div>`;

  bindEvents();
  el.classList.add('open');

  return new Promise((resolve) => {
    resolvePending = resolve;
  });
}

const ConfirmDialog = { show };

export default ConfirmDialog;
