const listeners = new Set();

function normalize(id) {
  return String(id).replace('#', '');
}

function getCurrentId() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('patient');
  return raw ? normalize(raw) : null;
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

function clearOnBoot() {
  const params = new URLSearchParams(location.search);
  if (!params.has('patient')) return;
  params.delete('patient');
  const query = params.toString();
  history.replaceState({}, '', query ? `${location.pathname}?${query}` : location.pathname);
}

const Patient = { getCurrentId, setCurrentId, onPopState, normalize, clearOnBoot };

export default Patient;
