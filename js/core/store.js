import LocalData from './localData.js';

const Store = (() => {
  const cache = {};

  function pathFor(name, patientId) {
    return patientId ? `data/patients/${patientId}/${name}.json` : `data/${name}.json`;
  }

  function applyOverride(name, patientId, json) {
    const override = LocalData.getOverride(name, patientId);
    if (!override || !Array.isArray(json.programs)) return json;

    const programs = json.programs.map((program) => {
      const patch = override[program.code];
      return patch ? { ...program, ...patch } : program;
    });
    return { ...json, programs };
  }

  async function load(name, patientId) {
    const key = patientId ? `${patientId}/${name}` : name;
    if (cache[key]) return cache[key];

    let json;
    if (patientId && LocalData.hasPatient(patientId)) {
      json = LocalData.getDoc(name, patientId);
    }

    if (!json) {
      const path = pathFor(name, patientId);
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Falha ao carregar ${path} (${res.status})`);
      json = await res.json();
    }

    if (patientId) json = applyOverride(name, patientId, json);

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

  function invalidate(name, patientId) {
    const key = patientId ? `${patientId}/${name}` : name;
    delete cache[key];
  }

  return { load, loadAll, loadDashboardPatients, invalidate };
})();

export default Store;
