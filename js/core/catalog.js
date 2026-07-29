import Config from './config.js';
import LocalData from './localData.js';

const CATALOGS = {
  abaAreas: { seedKey: 'abaAreas' },
  abaStimuli: { seedKey: 'abaStimuli' },
  abaHelpTypes: { seedKey: 'abaHelpTypes' },
  anamneseTemplates: { seedKey: 'anamneseTemplates' },
};

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function uniqueId(baseId, existingIds) {
  if (!existingIds.has(baseId)) return baseId;
  let n = 2;
  while (existingIds.has(`${baseId}_${n}`)) n++;
  return `${baseId}_${n}`;
}

async function getSeed(catalogName) {
  const { seedKey } = CATALOGS[catalogName];
  if (!seedKey) return [];
  const config = await Config.load();
  return config[seedKey] || [];
}

async function list(catalogName) {
  const seed = await getSeed(catalogName);
  const localItems = LocalData.getCatalogLocalItems(catalogName);
  const localIds = new Set(localItems.map((item) => item.id));
  const removed = new Set(localItems.filter((item) => item.__removed).map((item) => item.id));

  const merged = [
    ...seed.filter((item) => !localIds.has(item.id) && !removed.has(item.id)),
    ...localItems.filter((item) => !item.__removed),
  ];
  return merged;
}

async function save(catalogName, item) {
  const localItems = LocalData.getCatalogLocalItems(catalogName);
  const seed = await getSeed(catalogName);
  const allIds = new Set([...seed.map((s) => s.id), ...localItems.map((s) => s.id)]);

  let record = { ...item };
  if (!record.id) {
    allIds.delete(undefined);
    record.id = uniqueId(slugify(record.label || record.name || ''), allIds);
  }

  const idx = localItems.findIndex((entry) => entry.id === record.id);
  if (idx >= 0) {
    localItems[idx] = record;
  } else {
    localItems.push(record);
  }
  LocalData.saveCatalogLocalItems(catalogName, localItems);
  return record;
}

function remove(catalogName, id) {
  const localItems = LocalData.getCatalogLocalItems(catalogName);
  const idx = localItems.findIndex((entry) => entry.id === id);
  if (idx >= 0) {
    localItems[idx] = { id, __removed: true };
  } else {
    localItems.push({ id, __removed: true });
  }
  LocalData.saveCatalogLocalItems(catalogName, localItems);
}

const listAreas = () => list('abaAreas');
const saveArea = (area) => save('abaAreas', area);
const deleteArea = (id) => remove('abaAreas', id);

const listStimuli = () => list('abaStimuli');
const saveStimulus = (stimulus) => save('abaStimuli', stimulus);
const deleteStimulus = (id) => remove('abaStimuli', id);

const listHelpTypes = async () => {
  const items = await list('abaHelpTypes');
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};
const saveHelpType = (helpType) => save('abaHelpTypes', helpType);
const deleteHelpType = (id) => remove('abaHelpTypes', id);

const listAnamneseTemplates = () => list('anamneseTemplates');
const saveAnamneseTemplate = (template) => save('anamneseTemplates', template);
const deleteAnamneseTemplate = (id) => remove('anamneseTemplates', id);

const Catalog = {
  listAreas, saveArea, deleteArea,
  listStimuli, saveStimulus, deleteStimulus,
  listHelpTypes, saveHelpType, deleteHelpType,
  listAnamneseTemplates, saveAnamneseTemplate, deleteAnamneseTemplate,
};

export default Catalog;
