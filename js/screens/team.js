import Store from '../core/store.js';
import Patient from '../core/patient.js';
import Config from '../core/config.js';
import { escapeHtml, qs, emptyState } from '../core/dom.js';

function teamCard(m) {
  return `
    <div class="team-card">
      <div class="avatar">${escapeHtml(m.initials)}</div>
      <div>
        <div class="name">${escapeHtml(m.name)}</div>
        <div class="role">${escapeHtml(m.role)}</div>
        <div class="obj-count">${escapeHtml(m.note)}</div>
      </div>
    </div>`;
}

function participationPill(p) {
  return `<span class="pill ${p.status}">${escapeHtml(p.label)}</span>`;
}

function matrixRow(r) {
  return `
    <tr>
      <td>${escapeHtml(r.goal)}</td>
      <td>${escapeHtml(r.responsible)}</td>
      <td>${escapeHtml(r.collaborators)}</td>
      <td>${escapeHtml(r.supervisor)}</td>
      <td>${participationPill(r.familyParticipation)}</td>
      <td>${participationPill(r.schoolParticipation)}</td>
      <td><span class="pill ${r.status.status}">${escapeHtml(r.status.label)}</span></td>
    </tr>`;
}

function accessRow(a) {
  return `<span class="pill ${a.kind}"><i class="fa-solid ${a.icon}"></i> ${escapeHtml(a.label)}</span>`;
}

function timelineItem(t) {
  return `<div class="tl-item"><div class="tl-date">${escapeHtml(t.date)}</div><div class="tl-text">${escapeHtml(t.text)}</div></div>`;
}

export async function mount() {
  const id = Patient.getCurrentId();
  const [team, patient, config] = await Promise.all([Store.load('team', id), Store.load('patient', id), Config.load()]);
  const root = qs('#s-team');

  if (team.empty) {
    root.innerHTML = `
      <div class="screen-title"><i class="fa-solid fa-people-group"></i> Equipe interdisciplinar</div>
      <div class="screen-desc">${escapeHtml(patient.id)} · ${escapeHtml(patient.fullName)}</div>
      ${emptyState(team.reason)}
    `;
    return;
  }

  const accessLevelById = new Map(config.accessLevels.map((a) => [a.id, a]));
  const accessLevels = team.accessLevelIds.map((accId) => accessLevelById.get(accId)).filter(Boolean);

  root.innerHTML = `
    <div class="screen-title"><i class="fa-solid fa-people-group"></i> Equipe interdisciplinar</div>
    <div class="screen-desc">${escapeHtml(patient.id)} · profissionais e representantes vinculados ao PTS · supervisor do caso: ${escapeHtml(patient.caseSupervisor)}</div>

    <div class="team-grid">${team.members.map(teamCard).join('')}</div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Matriz de responsabilidades</h3></div>
      <div class="panel-body" style="padding-top:14px;">
        <table>
          <thead>
            <tr><th>Objetivo</th><th>Responsável</th><th>Colaboradores</th><th>Supervisor</th><th>Participação família</th><th>Participação escola</th><th>Situação</th></tr>
          </thead>
          <tbody>${team.responsibilityMatrix.map(matrixRow).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Níveis de acesso ao PTS</h3></div>
      <div class="panel-body" style="padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        ${accessLevels.map(accessRow).join('')}
      </div>
    </div>

    <div class="panel" style="margin-top:20px;">
      <div class="panel-header"><h3>Histórico de mudanças na equipe</h3></div>
      <div class="panel-body" style="padding-top:18px;">
        <div class="timeline">${team.timeline.map(timelineItem).join('')}</div>
      </div>
    </div>
  `;
}
