import LocalData from './localData.js';

const Store = (() => {
  const cache = {};

  function pathFor(name, patientId) {
    return patientId ? `data/patients/${patientId}/${name}.json` : `data/${name}.json`;
  }

  async function load(name, patientId) {
    const key = patientId ? `${patientId}/${name}` : name;
    if (cache[key]) return cache[key];

    if (patientId && LocalData.hasPatient(patientId)) {
      const local = LocalData.getDoc(name, patientId);
      if (local) {
        cache[key] = local;
        return local;
      }
    }

    const path = pathFor(name, patientId);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Falha ao carregar ${path} (${res.status})`);
    const json = await res.json();
    cache[key] = json;
    return json;
  }

  async function loadAll(names, patientId) {
    const entries = await Promise.all(names.map(async (n) => [n, await load(n, patientId)]));
    return Object.fromEntries(entries);
  }

  async function loadDashboardPatients() {
    const data = await load('dashboard');
    return [...data.patients, ...LocalData.listDashboardExtra()];
  }

  return { load, loadAll, loadDashboardPatients };
})();

export default Store;
