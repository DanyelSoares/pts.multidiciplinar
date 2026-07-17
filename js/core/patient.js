const DEFAULT_ID = '09981';
const listeners = new Set();

function normalize(id) {
  return String(id).replace('#', '');
}

function getCurrentId() {
  const params = new URLSearchParams(location.search);
  return normalize(params.get('patient') || DEFAULT_ID);
}

function setCurrentId(id) {
  const normalized = normalize(id);
  const params = new URLSearchParams(location.search);
  params.set('patient', normalized);
  history.pushState({ patient: normalized }, '', `${location.pathname}?${params.toString()}`);
}

function onPopState(callback) {
  listeners.add(callback);
}

window.addEventListener('popstate', () => {
  listeners.forEach((cb) => cb(getCurrentId()));
});

const Patient = { getCurrentId, setCurrentId, onPopState, normalize };

export default Patient;
