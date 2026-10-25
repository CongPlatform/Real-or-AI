import assert from 'node:assert/strict';
import { analisarMateriais, ordenarMateriais } from './src/lib/analiseMateriais.js';
const dados={
 pessoas:[{id:'valida'}],
 itens:[
  {id:'f1',nome:'Foto real',tipo:'imagem',origem_ia:false,ativo:true},
  {id:'a1',nome:'Audio IA',tipo:'audio',origem_ia:true,ativo:true},
  {id:'c1',nome:'Comparação real',tipo:'texto',origem_ia:false,comparacao_id:'c',ativo:true},
  {id:'c2',nome:'Comparação IA',tipo:'texto',origem_ia:true,comparacao_id:'c',ativo:true},
  {id:'zero',nome:'Não exibido',tipo:'video',origem_ia:false,ativo:true}
 ],
 ri:[
  {participante_id:'valida',conteudo_id:'f1',resposta_ia:true},
  {participante_id:'valida',conteudo_id:'a1',resposta_ia:false},
  {participante_id:'piloto',conteudo_id:'f1',resposta_ia:false}
 ],
 rc:[{participante_id:'valida',comparacao_id:'c'}]
};
const comps=[
 {participante_id:'valida',conteudo_id:'c1',resposta_ia:true},
 {participante_id:'valida',conteudo_id:'c2',resposta_ia:false},
 {participante_id:'piloto',conteudo_id:'c2',resposta_ia:true}
];
let resultado=analisarMateriais(dados,comps);
assert.equal(resultado.votos,4);
assert.equal(resultado.votosIA,2);
assert.equal(resultado.votosHumano,2);
assert.equal(resultado.erroHumanoComoIA,2);
assert.equal(resultado.erroIAComoHumano,2);
assert.equal(resultado.semVotos,1);
assert.equal(resultado.respostasComparacao,2);
assert.equal(ordenarMateriais(resultado.itens,'falsoPositivo',1).length,2); // inclui humano sem avaliações? não, mínimo 1
assert.equal(ordenarMateriais(resultado.itens,'falsoPositivo',1)[0].erroHumanoComoIA,1);
assert.equal(ordenarMateriais(resultado.itens,'falsoNegativo',1).length,2);
assert.equal(ordenarMateriais(resultado.itens,'ia',2).length,0);
resultado=analisarMateriais(dados,comps,'individual');
assert.equal(resultado.votos,2);
assert.equal(resultado.respostasComparacao,0);
resultado=analisarMateriais(dados,comps,'comparacao');
assert.equal(resultado.votos,2);
assert.equal(resultado.respostasComparacao,2);
// Voto que é boolean false deve ser considerado válido e o NULL deve ser ignorado.
dados.ri.push({participante_id:'valida',conteudo_id:'f1',resposta_ia:null});
assert.equal(analisarMateriais(dados,comps).votos,4);
console.log('OK: análise por material, contagens, exclusão de pilotos, filtros e rankings.');
