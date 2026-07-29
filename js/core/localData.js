const PREFIX = 'pts:v1:';
const PATIENTS_KEY = `${PREFIX}patients`;
const DASHBOARD_EXTRA_KEY = `${PREFIX}dashboardExtra`;
const SEQ_KEY = `${PREFIX}seq`;
const SEQ_START = 12000;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function docKey(name, patientId) {
  return `${PREFIX}doc:${patientId}:${name}`;
}

function overrideKey(name, patientId) {
  return `${PREFIX}overrides:${patientId}:${name}`;
}

function getOverride(name, patientId) {
  return readJSON(overrideKey(name, patientId), null);
}

function saveOverride(name, patientId, data) {
  return writeJSON(overrideKey(name, patientId), data);
}

function listPatientIds() {
  return readJSON(PATIENTS_KEY, []);
}

function hasPatient(id) {
  return listPatientIds().includes(id);
}

function getDoc(name, patientId) {
  return readJSON(docKey(name, patientId), null);
}

function saveDoc(name, patientId, data) {
  return writeJSON(docKey(name, patientId), data);
}

function listDashboardExtra() {
  return readJSON(DASHBOARD_EXTRA_KEY, []);
}

function nextId() {
  const current = readJSON(SEQ_KEY, SEQ_START);
  const next = current + 1;
  writeJSON(SEQ_KEY, next);
  return String(next);
}

function createPatient({ patient, interview, dashboardRow, emptyReasons }) {
  const id = patient.id.replace('#', '');
  const ids = listPatientIds();
  ids.push(id);
  writeJSON(PATIENTS_KEY, ids);

  saveDoc('patient', id, patient);
  saveDoc('interview', id, interview);
  saveDoc('needs', id, { empty: true, reason: emptyReasons.needs });
  saveDoc('pts', id, { empty: true, reason: emptyReasons.pts });
  saveDoc('aba', id, { empty: true, reason: emptyReasons.aba });
  saveDoc('team', id, { empty: true, reason: emptyReasons.team });
  saveDoc('validation', id, { empty: true, reason: emptyReasons.validation });

  const extra = listDashboardExtra();
  extra.push(dashboardRow);
  writeJSON(DASHBOARD_EXTRA_KEY, extra);

  return id;
}

const LocalData = {
  listPatientIds,
  hasPatient,
  getDoc,
  saveDoc,
  getOverride,
  saveOverride,
  listDashboardExtra,
  nextId,
  createPatient,
};

export default LocalData;
