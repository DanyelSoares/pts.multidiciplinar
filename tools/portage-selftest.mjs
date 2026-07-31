// Self-test do núcleo de cálculo Portage. Roda em Node puro (fora do runtime do browser):
//   node tools/portage-selftest.mjs
import { calcularPontuacaoPortage } from '../js/core/portageScore.js';
import { derivarObjetivosPEI, separarObjetivosPorPrazo } from '../js/core/pei.js';
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

// Cenário 7: separação longo prazo vs. curto/médio prazo — longo prazo vem da faixa mais
// avançada com cobertura suficiente; curto/médio prazo vem de pendências em faixas anteriores.
{
  console.log('\nCenário 7: separação de objetivos por prazo (longo prazo vs. curto/médio prazo)');
  const respostas = {};
  // faixa 0-1 com cobertura suficiente (100%): maioria adquirida, 5 pendentes (emergente)
  const itens01 = itensDaArea('cognicao').filter((i) => i.faixa === '0-1');
  itens01.slice(0, 9).forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });
  itens01.slice(9).forEach((item) => { respostas[item.id] = { status: 'emergente' }; });
  // faixa 1-2 (a mais avançada, cobertura suficiente e maioria adquirida): 2 pendentes (não adquirido)
  const itens12 = itensDaArea('cognicao').filter((i) => i.faixa === '1-2');
  itens12.slice(0, 8).forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });
  itens12.slice(8).forEach((item) => { respostas[item.id] = { status: 'nao_adquirido' }; });

  const aplicacao = { idadeCronologicaMeses: 24, respostas };
  const { longoPrazo, curtoMedioPrazo } = separarObjetivosPorPrazo(aplicacao, inventario);

  const longoPrazoCognicao = longoPrazo.filter((c) => c.area.id === 'cognicao');
  const curtoMedioPrazoCognicao = curtoMedioPrazo.filter((c) => c.area.id === 'cognicao');

  checar('longo prazo vem da faixa 1-2 (a mais avançada com cobertura suficiente)', longoPrazoCognicao.length > 0 && longoPrazoCognicao.every((c) => c.item.faixa === '1-2'));
  checar('curto/médio prazo vem da faixa 0-1 (pendências em faixa anterior)', curtoMedioPrazoCognicao.length > 0 && curtoMedioPrazoCognicao.every((c) => c.item.faixa === '0-1'));
  checar('há os 5 itens pendentes de curto/médio prazo (emergentes de 0-1)', curtoMedioPrazoCognicao.length === 5);
}

// Cenário 8: geração de programa só ocorre para áreas com pendências — área totalmente
// adquirida (sem objetivos) não deve gerar programa.
{
  console.log('\nCenário 8: programa de ensino só é gerado para áreas com objetivos pendentes');
  const respostas = {};
  inventario.itens.filter((i) => i.area === 'motor').forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });
  const itensLin01 = itensDaArea('linguagem').filter((i) => i.faixa === '0-1');
  itensLin01.slice(0, 7).forEach((item) => { respostas[item.id] = { status: 'adquirido' }; });
  itensLin01.slice(7).forEach((item) => { respostas[item.id] = { status: 'nao_adquirido' }; });

  const aplicacao = { idadeCronologicaMeses: 12, respostas };
  const { programas } = derivarObjetivosPEI(aplicacao, inventario);

  checar('nenhum programa gerado para "motor" (área sem pendências, tudo adquirido)', !programas.some((p) => p.area === 'motor'));
  checar('ao menos 1 programa gerado para áreas com pendências', programas.length > 0);
}

// Cenário 9: rastreabilidade — todo programa gerado referencia origem/objetivo/item válidos.
{
  console.log('\nCenário 9: rastreabilidade dos programas gerados (origem, objetivoPeiId, itemPortageId)');
  const respostas = {};
  itensDaArea('autocuidados').filter((i) => i.faixa === '0-1').forEach((item) => { respostas[item.id] = { status: 'emergente' }; });

  const aplicacao = { idadeCronologicaMeses: 12, respostas };
  const { objetivosLongoPrazo, objetivosCurtoMedioPrazo, programas } = derivarObjetivosPEI(aplicacao, inventario);
  const todosObjetivosIds = new Set([...objetivosLongoPrazo, ...objetivosCurtoMedioPrazo].map((o) => o.id));
  const todosItensIds = new Set(inventario.itens.map((i) => i.id));

  checar('todo programa tem origem "pei"', programas.every((p) => p.origem === 'pei'));
  checar('todo programa referencia um objetivoPeiId existente', programas.every((p) => todosObjetivosIds.has(p.objetivoPeiId)));
  checar('todo programa referencia um itemPortageId válido do inventário', programas.every((p) => todosItensIds.has(p.itemPortageId)));
}

console.log(`\n${total - falhas}/${total} verificações passaram.`);
if (falhas > 0) {
  console.error(`${falhas} falha(s).`);
  process.exit(1);
}
