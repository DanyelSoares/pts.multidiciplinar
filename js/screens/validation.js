import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Toast from '../core/toast.js';
import { escapeHtml, qs, qsa, emptyState } from '../core/dom.js';

function versionNode(v, i, total) {
  const line = i < total - 1 ? `<div class="v-line${v.state === 'done' ? ' done' : ''}"></div>` : '';
  return `
    <div class="v-node ${v.state}">
      <div class="v-dot"></div>
      <div class="v-label">${escapeHtml(v.label)}<br>${escapeHtml(v.sub)}</div>
    </div>${line}`;
}

function approvalRow(a) {
  const label = a.approved ? a.approveLabel : a.pendingLabel;
  const pillClass = a.approved ? 'ok' : 'warn';
  return `
    <div class="approval-row" data-approver="${escapeHtml(a.approver)}">
      <div>
        <div class="who">${escapeHtml(a.who)}</div>
        <div class="role">${escapeHtml(a.role)}</div>
      </div>
      <span class="pill ${pillClass}">${escapeHtml(label)}</span>
    </div>`;
}

function diffLine(l) {
  const cls = l.type === 'same' ? '' : ` ${l.type}`;
  return `<div class="diff-line${cls}">${escapeHtml(l.text)}</div>`;
}

function updateApprovalStatus(approvals) {
  const pending = approvals.filter((a) => !a.approved).length;
  const summary = qs('#approval-summary');
  const publishCta = qs('#publish-cta');
  const footnote = qs('#validation-footnote');

  if (pending === 0) {
    summary.className = 'pill ok';
    summary.textContent = 'Todas as aprovações concluídas';
    publishCta.style.display = 'block';
    footnote.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i> Todos os requisitos de publicação foram atendidos. A versão em elaboração está pronta para ser publicada — a versão anterior permanecerá disponível no histórico.';
  } else {
    summary.className = 'pill warn';
    summary.textContent = `${pending} de ${approvals.length} pendentes`;
    publishCta.style.display = 'none';
  }
}

function bindApprovals(approvals) {
  qsa('.approval-row').forEach((row) => {
    row.addEventListener('click', () => {
      const approver = row.dataset.approver;
      const entry = approvals.find((a) => a.approver === approver);
      if (!entry || entry.approved) return;
      entry.approved = true;
      const pill = row.querySelector('.pill');
      pill.className = 'pill ok';
      pill.textContent = entry.approveLabel;
      updateApprovalStatus(approvals);
    });
  });
}

function bindPublish() {
  qs('#btn-publish').addEventListener('click', () => {
    const cta = qs('#publish-cta');
    const dateStr = new Date().toLocaleDateString('pt-BR');
    cta.innerHTML = `<span class="pill ok" style="padding:10px 16px;"><i class="fa-solid fa-circle-check"></i> Versão publicada em ${dateStr}</span>`;
  });
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [validation, patient] = await Promise.all([Store.load('validation', id), Store.load('patient', id)]);
  const root = qs('#s-validation');

  if (validation.empty) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-check-double"></i> Validação &amp; versões</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState(validation.reason)}
    `;
    return;
  }

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-check-double"></i> Validação &amp; versões</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · fluxo de aprovação da versão em elaboração antes da publicação</div>

    <div class="panel">
      <div class="panel-header"><h3>Linha do tempo de versões</h3></div>
      <div class="panel-body" style="padding-top:18px;">
        <div class="version-track">
          ${validation.versionTrack.map((v, i) => versionNode(v, i, validation.versionTrack.length)).join('')}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h3>Aprovações necessárias para publicar</h3>
        <span id="approval-summary" class="pill warn"></span>
      </div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="approval-grid" id="approval-grid">
          ${validation.approvals.map(approvalRow).join('')}
        </div>
        <div id="publish-cta" style="display:none;margin-top:14px;">
          <button class="btn btn-primary" type="button" id="btn-publish"><i class="fa-solid fa-upload"></i> Publicar nova versão</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>Comparativo — ${escapeHtml(validation.diff.from)} → ${escapeHtml(validation.diff.to)}</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <div class="diff-box">
          <div class="diff-col">
            <h5>${escapeHtml(validation.diff.from)}</h5>
            ${validation.diff.fromLines.map(diffLine).join('')}
          </div>
          <div class="diff-col">
            <h5>${escapeHtml(validation.diff.to)}</h5>
            ${validation.diff.toLines.map(diffLine).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="footnote" id="validation-footnote"><i class="fa-solid fa-circle-info"></i>${escapeHtml(validation.publishRequirements)}</div>

    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
      <button class="btn btn-primary-soft" type="button" id="btn-save-draft"><i class="fa-solid fa-floppy-disk"></i> Salvar rascunho</button>
    </div>
  `;

  bindApprovals(validation.approvals);
  bindPublish();
  updateApprovalStatus(validation.approvals);

  qs('#btn-save-draft').addEventListener('click', () => {
    Toast.show('Rascunho salvo (simulado).', { kind: 'success' });
  });
}
