import assert from 'node:assert/strict';
import { reconhecerMarcador, agruparComparacoes } from './src/lib/zipComparacoes.js';
import { idsEscolhidosComoIA } from './src/lib/respostaComparacao.js';
const item=(nome,tipo='video') => ({...reconhecerMarcador(nome),tipo,origemZip:`${nome}.zip`,arquivo:`${nome}/conteudo.mp4`,titulo:nome});
const testar=(nomes,esperados,tipo='video') => {
  const {grupos,erros}=agruparComparacoes(nomes.map(n=>item(n,tipo)));
  assert.deepEqual(erros,[]);
  assert.deepEqual(grupos.map(g=>[g.codigo,g.cenario]),esperados);
};
testar(['C11.1-IA','C11-IA','C11-REAL'],[['C11',1],['C11.1',2]]);
testar(['C2-IA','C2-REAL'],[['C2',1]]);
testar(['C3.1-IA','C3.2-IA'],[['C3',2]]);
testar(['C4.1-REAL','C4.2-REAL'],[['C4',0]]);
testar(['C5-IA','C5.1-IA'],[['C5',2]]);
testar(['C6-REAL','C6.1-REAL'],[['C6',0]]);
testar(['C7-IA','C7-REAL','C7.1-IA','C7.2-REAL'],[['C7',1],['C7.1',2],['C7.2',0]]);
const dez=[];
for(let i=11;i<=20;i++) dez.push(item(`C${i}.1-IA`),item(`C${i}-IA`),item(`C${i}-REAL`));
const resultado=agruparComparacoes(dez);
assert.equal(resultado.grupos.length,20);
assert.equal(resultado.erros.length,0);
assert.equal(resultado.grupos.filter(g=>g.cenario===2).length,10);
assert.equal(resultado.grupos.filter(g=>g.cenario===1).length,10);
assert.equal(new Set(resultado.grupos.map(g=>g.key)).size,20);
// Mesmo arquivo duas vezes NÃO constitui dois materiais diferentes.
assert.equal(agruparComparacoes([item('C8-IA'),item('C8-IA')]).erros.length,1);
assert.equal(agruparComparacoes([item('C9-IA')]).erros.length,1);
assert.equal(agruparComparacoes([item('C10-IA'),item('C10-REAL'),item('C10.1-IA'),item('C10.1-REAL')]).erros.length,1);
// IA x IA: se perguntamos quais são humanos, a resposta "nenhum" significa os dois IDs de IA.
const itens=[{id:'a'},{id:'b'}];
assert.deepEqual(idsEscolhidosComoIA(itens,'nenhum','humano'),['a','b']);
assert.deepEqual(idsEscolhidosComoIA(itens,'ambos','ia'),['a','b']);
assert.deepEqual(idsEscolhidosComoIA(itens,'nenhum','ia'),[]);
assert.deepEqual(idsEscolhidosComoIA(itens,'ambos','humano'),[]);
assert.deepEqual(idsEscolhidosComoIA(itens,'primeiro','humano'),['b']);
assert.deepEqual(idsEscolhidosComoIA(itens,'segundo','ia'),['b']);
assert.throws(()=>idsEscolhidosComoIA(itens,'qualquer','ia'));
console.log('OK v14: 3 ZIPs => 2 pares, 10 famílias => 20 pares, 4 escolhas, gabarito oculto.');
