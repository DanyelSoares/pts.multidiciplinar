// Self-test do núcleo de cálculo Portage. Roda em Node puro (fora do runtime do browser):
//   node tools/portage-selftest.mjs
import { calcularPontuacaoPortage } from '../js/core/portageScore.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inventario = JSON.parse(readFileSync(path.join(__dirname, '../data/portage/inventario.json'), 'utf-8'));

let falhas = 0;
let total = 0;

function checar(descricao, condicao) {
  total += 1;
  if (condicao) {
    console.log(`  OK  - ${descricao}`);
  } else {
    falhas += 1;
    console.log(`  FALHOU - ${descricao}`);
  }
}

function itensDaArea(areaId) {
  return inventario.itens.filter((i) => i.area === areaId);
}

// Cenário 1: nenhum item adquirido -> todas as idades null, nenhuma 0 espúria.
{
  console.log('\nCenário 1: nenhum item avaliado (aplicação vazia)');
  const aplicacao = { idadeCronologicaMeses: 60, respostas: {} };
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);

  checar('idadeGlobalMeses é null (não 0)', resultado.idadeGlobalMeses === null);
  Object.values(resultado.areas).forEach((r) => {
    checar(`área sem dado: idadeEstimadaMeses é null (não 0)`, r.idadeEstimadaMeses === null);
  });
}

// Cenário 2: todos os itens adquiridos -> idade de cada área = 72 meses (teto do instrumento).
{
  console.log('\nCenário 2: todos os itens adquiridos em todas as áreas');
  const respostas = {};
  inventario.itens.forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });
  const aplicacao = { idadeCronologicaMeses: 72, respostas };
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);

  inventario.areas.forEach((area) => {
    const r = resultado.areas[area.id];
    checar(`${area.nome}: idadeEstimadaMeses = 72`, r.idadeEstimadaMeses === 72);
  });
  checar('idadeGlobalMeses = 72', resultado.idadeGlobalMeses === 72);
}

// Cenário 3: base declarada em 2-3 + acertos parciais na faixa 3-4 -> a base credita as faixas inferiores.
{
  console.log('\nCenário 3: base declarada em 2-3 (socialização) credita faixas 0-1, 1-2 e 2-3 sem marcação manual');
  const itensFaixa34 = itensDaArea('socializacao').filter((i) => i.faixa === '3-4');
  const respostas = {};
  itensFaixa34.forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });

  const aplicacao = {
    idadeCronologicaMeses: 48,
    base: { socializacao: '2-3' },
    respostas,
  };
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);
  const r = resultado.areas.socializacao;

  const totalItensAteBase = itensDaArea('socializacao').filter((i) => ['0-1', '1-2', '2-3'].includes(i.faixa)).length;
  checar('itens das faixas 0-1/1-2/2-3 contam como adquiridos via base (sem marcação manual)', r.adquiridos >= totalItensAteBase);
  checar('idadeEstimadaMeses não é null', r.idadeEstimadaMeses !== null);
}

// Cenário 4: área inteira nao_avaliado -> null e cobertura 0.
{
  console.log('\nCenário 4: área inteira não avaliada');
  const aplicacao = { idadeCronologicaMeses: 60, respostas: {} };
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);
  const r = resultado.areas.motor;

  checar('cobertura = 0', r.cobertura === 0);
  checar('idadeEstimadaMeses é null', r.idadeEstimadaMeses === null);
}

// Cenário 5: o caso real da planilha — 6 acertos de 11 na faixa 5-6 de Socialização, faixas inferiores
// nao_avaliado, sem base declarada. A função NÃO pode devolver 0,55 ano; deve devolver null (cobertura insuficiente).
{
  console.log('\nCenário 5 (caso real da planilha): 6/11 acertos na faixa 5-6, faixas inferiores não avaliadas, sem base');
  const itensFaixa56 = itensDaArea('socializacao').filter((i) => i.faixa === '5-6');
  const respostas = {};
  itensFaixa56.slice(0, 6).forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });
  itensFaixa56.slice(6).forEach((item) => { respostas[item.id] = { status: 'nao_adquirido' }; });

  const aplicacao = { idadeCronologicaMeses: 72, respostas };
  const resultado = calcularPontuacaoPortage(aplicacao, inventario);
  const r = resultado.areas.socializacao;

  checar('idadeEstimadaMeses é null (nunca 0,55 ano / ~6,6 meses)', r.idadeEstimadaMeses === null);
  checar('idadeEstimadaMeses não é 0 nem valor absurdo baixo', r.idadeEstimadaMeses !== 0);
  checar('cobertura geral da área é baixa (a maioria das faixas não avaliada)', r.cobertura < 0.6);
}

// Cenário 6: contagem de itens por área bate com a tabela do inventário (validação de integridade dos dados).
{
  console.log('\nCenário 6: contagem de itens por área confere com os metadados do inventário');
  inventario.areas.forEach((area) => {
    const contagemReal = itensDaArea(area.id).length;
    checar(`${area.nome}: totalItens declarado (${area.totalItens}) == itens reais (${contagemReal})`, area.totalItens === contagemReal);
  });
  const somaDeclarada = inventario.areas.reduce((s, a) => s + a.totalItens, 0);
  checar(`soma total declarada (${somaDeclarada}) == inventario.itens.length (${inventario.itens.length})`, somaDeclarada === inventario.itens.length);
}

console.log(`\n${total - falhas}/${total} verificações passaram.`);
if (falhas > 0) {
  console.error(`${falhas} falha(s).`);
  process.exit(1);
}
