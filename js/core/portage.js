import Store from './store.js';

let inventarioCache = null;
let indiceItensCache = null;
let indicePorAreaFaixaCache = null;

function construirIndices(inventario) {
  const indiceItens = new Map();
  const indicePorAreaFaixa = new Map();

  inventario.itens.forEach((item) => {
    indiceItens.set(item.id, item);

    const chave = `${item.area}/${item.faixa}`;
    if (!indicePorAreaFaixa.has(chave)) indicePorAreaFaixa.set(chave, []);
    indicePorAreaFaixa.get(chave).push(item);
  });

  indicePorAreaFaixa.forEach((itens) => itens.sort((a, b) => a.ordem - b.ordem));

  return { indiceItens, indicePorAreaFaixa };
}

export async function carregarInventario() {
  if (inventarioCache) return inventarioCache;

  const inventario = await Store.load('portage/inventario');
  const { indiceItens, indicePorAreaFaixa } = construirIndices(inventario);

  inventarioCache = inventario;
  indiceItensCache = indiceItens;
  indicePorAreaFaixaCache = indicePorAreaFaixa;

  return inventario;
}

export function buscarItemPorId(id) {
  return indiceItensCache?.get(id) || null;
}

export function itensPorAreaFaixa(areaId, faixaId) {
  return indicePorAreaFaixaCache?.get(`${areaId}/${faixaId}`) || [];
}

export function itensPorArea(inventario, areaId) {
  return inventario.itens.filter((item) => item.area === areaId);
}

export function ordemFaixas(inventario) {
  return inventario.faixas.map((f) => f.id);
}

export function proximaFaixa(inventario, faixaId) {
  const ids = ordemFaixas(inventario);
  const idx = ids.indexOf(faixaId);
  if (idx === -1 || idx === ids.length - 1) return null;
  return ids[idx + 1];
}

export function faixaAnterior(inventario, faixaId) {
  const ids = ordemFaixas(inventario);
  const idx = ids.indexOf(faixaId);
  if (idx <= 0) return null;
  return ids[idx - 1];
}
