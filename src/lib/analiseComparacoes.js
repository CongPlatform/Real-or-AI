// Estatísticas descritivas exclusivamente das comparações de dois materiais.
// As observações de uma pessoa não são independentes; exibir contagens e médias
// de participantes separadamente evita conclusões baseadas em cliques como pessoas.
const NAMES={imagem:'Imagens',audio:'Áudios',texto:'Textos',video:'Vídeos'};
const FRAMES={neutro:'Pergunta neutra',ia:'Pergunta sobre IA',humano:'Pergunta sobre humano'};
export const CENARIOS=[
  {id:0,nome:'Ambas humanas',explicacao:'Nenhuma das duas peças foi gerada por IA'},
  {id:1,nome:'Origens diferentes',explicacao:'Uma foi gerada por IA e a outra por humano'},
  {id:2,nome:'Ambas IA',explicacao:'As duas peças foram geradas por IA'},
];
const divisao=(a,b)=>b?100*a/b:null;
function reduzir(rr){
  const n=rr.length,exatas=rr.filter(r=>r.acertou===true).length;
  const pecas=rr.reduce((a,r)=>a+(Number(r.acertos_itens)||0),0);
  const itens=rr.reduce((a,r)=>a+(Number(r.n_itens)||0),0);
  const participantes=new Map();
  for(const r of rr){
    if(!participantes.has(r.participante_id))participantes.set(r.participante_id,[]);
    participantes.get(r.participante_id).push(r);
  }
  const medias=[...participantes.values()].map(g=>divisao(g.filter(r=>r.acertou).length,g.length));
  return {n,exatas,erros:n-exatas,pecas,itens,porcentagemExata:divisao(exatas,n),
    porcentagemPeca:divisao(pecas,itens),participantes:participantes.size,
    mediaPorParticipante:medias.length?medias.reduce((a,b)=>a+b,0)/medias.length:null};
}
export function analisarComparacoes(rows=[]) {
  const rr=(rows||[]).filter(r=>r && Number.isInteger(Number(r.n_reais_ia)) && Number(r.n_reais_ia)>=0 && Number(r.n_reais_ia)<=2);
  const total=reduzir(rr);
  const cenarios=CENARIOS.map(c=>({ ...c, ...reduzir(rr.filter(r=>Number(r.n_reais_ia)===c.id)) }));
  const tipos=Object.entries(NAMES).map(([tipo,nome])=>({tipo,nome,...reduzir(rr.filter(r=>r.tipo===tipo))}));
  const perguntas=Object.entries(FRAMES).map(([chave,nome])=>({chave,nome,...reduzir(rr.filter(r=>r.enquadramento===chave))}));
  const contagens=CENARIOS.map(c=>{
    const grupo=rr.filter(r=>Number(r.n_reais_ia)===c.id);
    return {nome:c.nome,realIA:c.id,
      marcou0:grupo.filter(r=>Number(r.n_marcados_ia)===0).length,
      marcou1:grupo.filter(r=>Number(r.n_marcados_ia)===1).length,
      marcou2:grupo.filter(r=>Number(r.n_marcados_ia)===2).length,
      n:grupo.length};
  });
  const tempos=rr.map(r=>Number(r.tempo_ms)).filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  const meio=Math.floor(tempos.length/2);
  const tempoMediano=tempos.length?(tempos.length%2?tempos[meio]:(tempos[meio-1]+tempos[meio])/2)/1000:null;
  return {total,cenarios,tipos,perguntas,contagens,tempoMediano};
}
