import assert from 'node:assert/strict';
import { ordenarGrupo } from './src/lib/analiseMateriais.js';
const itens = [
  {nome:'IA acerto',origem_ia:true,n:5,ia:4,humano:1,pctIA:80,pctHumano:20},
  {nome:'Humano confundido',origem_ia:false,n:4,ia:3,humano:1,pctIA:75,pctHumano:25},
  {nome:'Humano acerto',origem_ia:false,n:10,ia:1,humano:9,pctIA:10,pctHumano:90},
  {nome:'IA confundida',origem_ia:true,n:7,ia:2,humano:5,pctIA:28.57,pctHumano:71.43},
  {nome:'IA nunca reconhecida',origem_ia:true,n:2,ia:0,humano:2,pctIA:0,pctHumano:100},
  {nome:'Humano pouco votado',origem_ia:false,n:1,ia:1,humano:0,pctIA:100,pctHumano:0}
];
const cenarios = [
  [true,'ia','IA acerto'],
  [false,'ia','Humano confundido'],
  [false,'humano','Humano acerto'],
  [true,'humano','IA confundida']
];
for (const [verdadeiro,voto,nome] of cenarios) {
  const r=ordenarGrupo(itens,{verdadeiro,voto},'votos',2,'');
  assert.equal(r[0].nome,nome,`Cenário ${verdadeiro} ${voto}`);
  assert.ok(r.every(x=>x.origem_ia===verdadeiro && x[voto]>0 && x.n>=2));
}
assert.equal(ordenarGrupo(itens,{verdadeiro:false,voto:'ia'},'percentual',1,'')[0].nome,'Humano pouco votado');
assert.equal(ordenarGrupo(itens,{verdadeiro:false,voto:'ia'},'percentual',3,'')[0].nome,'Humano confundido');
assert.equal(ordenarGrupo(itens,{verdadeiro:true,voto:'ia'},'votos',1,'nunca').length,0);
console.log('OK: quatro cenários, ordenação por votos/taxa, mínimo de avaliações e busca.');
