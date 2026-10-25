import { analisarAvancado, resumoParticipantes } from './src/lib/analiseAvancada.js';
function ok(estado, msg) { if(!estado) throw new Error(msg); }
const s=(id, finalizado=true, piloto=false, respondidas=40)=>({id, finalizado, excluir_analise:piloto,
  sorteadas:40, individuais_sorteadas:20, comparacoes_sorteadas:20, individuais_respondidas:Math.min(respondidas,20), comparacoes_respondidas:Math.max(0,respondidas-20)});
const rows=(pid,n,acertos=0)=>Array.from({length:n},(_,i)=>({participante_id:pid,conteudo_id:`item${i}`,
  tipo:'imagem',origem_ia:i%2===0,resposta_ia:i<acertos ? i%2===0 : i%2!==0,
  acertou:i<acertos, enquadramento:i%2?'ia':'neutro',tempo_ms:8000}));
const d={sessoes:[s('a'),s('b',true,true),s('c',false),s('d',true,false,39)],
  individuais:[...rows('a',20,12),...rows('b',20,20),...rows('d',20,20)],comparacoes:[],itens:[]};
const main=analisarAvancado(d);
ok(main.coleta.validas===1,'Sessões piloto/incompleta devem ser excluídas');
ok(main.notas.media===60,'Média do participante esperada 60%');
ok(main.composicao.IA===10 && main.composicao.real===10,'Exposições balanceadas');
const incluindo=analisarAvancado(d,true);
ok(incluindo.coleta.validas===2 && incluindo.notas.media===80,'Filtro de pilotos');
ok(resumoParticipantes([]).media===null,'Conjunto vazio não é zero');
ok(resumoParticipantes([60]).ic===null,'n=1 não produz IC');
console.log('PASSOU: sessões válidas, pilotos, equilíbrio, média e IC.');
