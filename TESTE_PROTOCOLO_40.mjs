import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analisarAvancado } from './src/lib/analiseAvancada.js';
const pl = fs.readFileSync('./src/pages/Participante.jsx','utf8');
const dash = fs.readFileSync('./src/pages/Dashboard.jsx','utf8');
const sql = fs.readFileSync('./supabase/PATCH_PROTOCOLO_V12_40_DECISOES_20_20.sql','utf8');
assert.match(pl,/40<\/strong> decisões/);
assert.match(pl,/totalDecisoes/);
assert.match(dash,/p\.n_ind===20 && p\.n_comp===20/);
assert.match(sql,/v_n_comp := 20/);
assert.match(sql,/v_n_ind := 20/);
assert.match(sql,/v_tot not in \(30,40\)/);
const sess=(id,nInd,nComp)=>({id,finalizado:true,sorteadas:nInd+nComp,
  individuais_sorteadas:nInd,comparacoes_sorteadas:nComp,
  individuais_respondidas:nInd,comparacoes_respondidas:nComp,inicio:'2026-10-25T00:00:00Z'});
const resultado=analisarAvancado({sessoes:[sess('novo',20,20),sess('antigo',24,6)],individuais:[],comparacoes:[],itens:[]});
assert.equal(resultado.coleta.validas,1);
assert.equal(resultado.coleta.foraProtocolo,1);
console.log('OK: protocolo 20+20, 40 decisões, estatísticas oficiais separadas de sessões antigas.');
