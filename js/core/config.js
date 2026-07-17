import Store from './store.js';

let cache = null;

async function load() {
  if (!cache) cache = await Store.load('config');
  return cache;
}

function findIn(list, id) {
  return list.find((entry) => entry.id === id) || null;
}

async function resolveStatus(statusId) {
  const config = await load();
  return findIn(config.patientStatuses, statusId);
}

async function resolveAlert(alertId) {
  if (!alertId) return null;
  const config = await load();
  return findIn(config.alerts, alertId);
}

async function resolveInfoSource(sourceId) {
  const config = await load();
  return findIn(config.infoSources, sourceId);
}

async function resolveAccessLevel(levelId) {
  const config = await load();
  return findIn(config.accessLevels, levelId);
}

const Config = { load, resolveStatus, resolveAlert, resolveInfoSource, resolveAccessLevel };

export default Config;
