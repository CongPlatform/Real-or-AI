import assert from 'node:assert/strict';
import { analisarAvancado, resumoParticipantes } from './src/lib/analiseAvancada.js';
import { criarEvolucao, contarDistribuicao } from './src/lib/previsaoPesquisa.js';

function session(i,excluir_analise=false){return {id:'p'+i,finalizado:true,sorteadas:40,individuais_sorteadas:20,comparacoes_sorteadas:20,individuais_respondidas:20,comparacoes_respondidas:20,excluir_analise, inicio:`2026-10-${String(1+i).padStart(2,'0')}T12:00:00Z`,fim:`2026-10-${String(1+i).padStart(2,'0')}T12:10:00Z`,confianca:i%5+1};}
const sessoes=[session(0),session(1),session(2,true)];
const individuais=[];
for(let i=0;i<3;i++)for(let j=0;j<20;j++){
  const origem_ia=j%2===0;
  const acertou=i===0 ? j<14 : i===1 ? j<10 : true;
  individuais.push({participante_id:'p'+i,conteudo_id:`c${j}`,tipo:['imagem','texto','audio','video'][j%4],enquadramento:['ia','humano','neutro'][j%3],origem_ia,resposta_ia:acertou?origem_ia:!origem_ia,acertou,tempo_ms:2000,pedidos_mais:0});
}
const d=analisarAvancado({sessoes,individuais,comparacoes:[],itens:[]});
assert.equal(d.coleta.validas,2);
assert.equal(d.ri.length,40);
assert.equal(d.notas.n,2);
assert.ok(Math.abs(d.notas.media-(100*(14/20+10/20)/2))<0.00001);
assert.equal(d.quad.vv+d.quad.vf+d.quad.fv+d.quad.ff,40);
const pred=criarEvolucao(d.pessoas,{mediaInicial:50,forca:8});
assert.equal(pred.length,3);
assert.equal(pred[0].previsao,50);
assert.equal(pred[2].observada,d.notas.media);
assert.ok(pred[2].previsao>=0&&pred[2].previsao<=100);
assert.equal(contarDistribuicao(d.pessoas).reduce((s,x)=>s+x.quantidade,0),2);
const all=analisarAvancado({sessoes,individuais,comparacoes:[],itens:[]},true);
assert.equal(all.coleta.validas,3);
assert.equal(resumoParticipantes([50,60,70]).media,60);
console.log('OK: sessões válidas, exclusão de pilotos, matriz, métricas por pessoa, projeção e distribuição.');
