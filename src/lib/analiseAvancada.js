// Estatísticas descritivas. Unidade independente para IC: participante, não clique.
export const TIPOS_ANALISE = { imagem: 'Imagens', texto: 'Textos', audio: 'Áudios', video: 'Vídeos' };
export const ENQUADRAMENTOS = { neutro: 'Neutra', ia: 'Pergunta sobre IA', humano: 'Pergunta sobre humano' };
const number = (n) => n == null || n === '' ? NaN : (typeof n === 'number' ? n : Number(n));
export function mediaValida(valores) {
  const a = valores.map(number).filter(Number.isFinite);
  return a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
}
export function mediana(valores) {
  const a = valores.map(number).filter(Number.isFinite).sort((x,y) => x-y);
  if (!a.length) return null;
  return a.length % 2 ? a[(a.length-1)/2] : (a[a.length/2-1] + a[a.length/2])/2;
}
export function resumoParticipantes(valores) {
  const a = valores.map(number).filter(Number.isFinite);
  const n = a.length;
  const media = mediaValida(a);
  const desvio = n >= 2 ? Math.sqrt(a.reduce((s,x)=>s+(x-media)**2,0)/(n-1)) : null;
  const se = n >= 2 ? desvio / Math.sqrt(n) : null;
  // Valores críticos t de Student (bicaudais, 95%). A expansão assintótica anterior
  // subestimava bastante o intervalo com n=2 (gl=1); tabelar gl 1–30 evita isso.
  const tCriticos = [null,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,
    2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,
    2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
  const df=n-1;
  const z=1.95996398454005;
  const tc = df <= 0 ? 0 : (df <= 30 ? tCriticos[df] :
    z + (z**3+z)/(4*df) + (5*z**5+16*z**3+3*z)/(96*df**2) +
    (3*z**7+19*z**5+17*z**3-15*z)/(384*df**3));
  return { n, media, mediana: mediana(a), min: n ? Math.min(...a) : null,
    max: n ? Math.max(...a) : null, desvio, se,
    ic: se === null ? null : [Math.max(0, media-tc*se), Math.min(100, media+tc*se)] };
}
const pct = (certos, n) => n ? 100*certos/n : null;
const sec = (ms) => Number.isFinite(number(ms)) && number(ms) >= 0 ? number(ms)/1000 : null;
const byId = (rows, key = 'participante_id') => {
  const m = new Map();
  for (const row of rows) {
    if (!m.has(row[key])) m.set(row[key], []);
    m.get(row[key]).push(row);
  }
  return m;
};
const averageByPerson = (rows, value) => [...byId(rows).values()].map(a => mediaValida(a.map(value))).filter(Number.isFinite);
const averageCorrectByPerson = (rows) => resumoParticipantes(averageByPerson(rows, r => Number(r.acertou)*100));
export function analisarAvancado(d, incluirPilotos = false) {
  const sessoes = Array.isArray(d?.sessoes) ? d.sessoes : [];
  const individ = Array.isArray(d?.individuais) ? d.individuais : [];
  const comps = Array.isArray(d?.comparacoes) ? d.comparacoes : [];
  const itens = Array.isArray(d?.itens) ? d.itens : [];
  // Consolidação por sessão válida. O protocolo fica registrado com seus denominadores reais.
  const completas = sessoes.filter(s => s.finalizado && Number(s.sorteadas)>0 &&
    Number(s.individuais_respondidas) === Number(s.individuais_sorteadas) &&
    Number(s.comparacoes_respondidas) === Number(s.comparacoes_sorteadas) &&
    Number(s.sorteadas) === Number(s.individuais_sorteadas)+Number(s.comparacoes_sorteadas));
  const validas = completas.filter(s => !s.excluir_analise || incluirPilotos);
  const ids = new Set(validas.map(s=>s.id));
  const ri = individ.filter(r=>ids.has(r.participante_id));
  const rc = comps.filter(r=>ids.has(r.participante_id));
  const grupInd = byId(ri), grupComp = byId(rc);
  const pessoas = validas.map(p => {
    const a = grupInd.get(p.id) || [], c = grupComp.get(p.id) || [];
    const acertos = a.filter(r=>r.acertou).length;
    const acertosPares = c.filter(r=>r.acertou).length;
    return { ...p, acertos, n_ind:a.length, pct_ind:pct(acertos,a.length),
      n_comp:c.length, acertosPares, pct_comp:pct(acertosPares,c.length),
      pct_geral:pct(acertos+acertosPares,a.length+c.length),
      // A estimativa é expressa em decisões TOTAIS (40 para o protocolo atual),
      // nunca somente nas questões individuais da Parte 1.
      estimativa_pct: p.estimativa == null || !(a.length+c.length) ? null : 100*p.estimativa/(a.length+c.length),
      tempo_med_s: mediana([...a,...c].map(r=>sec(r.tempo_ms))),
      duracao_teste_s: p.inicio && p.fim ? (new Date(p.fim) - new Date(p.inicio))/1000 : null };
  });
  const nota = resumoParticipantes(pessoas.map(p=>p.pct_ind));
  const comparacaoExata = averageCorrectByPerson(rc);
  const comparacaoItens = resumoParticipantes(averageByPerson(rc, r => r.n_itens ? (100*r.acertos_itens/r.n_itens):null));
  const relatorioTipo = Object.keys(TIPOS_ANALISE).map(tipo=>{
    const x = ri.filter(r=>r.tipo===tipo);
    const pp = averageCorrectByPerson(x);
    return { tipo, nome:TIPOS_ANALISE[tipo], n:x.length, participantes:pp.n, acerto:pp.media,
      ic:pp.ic, tempo_med_s:mediana(x.map(r=>sec(r.tempo_ms))), ia:x.filter(r=>r.origem_ia).length,
      real:x.filter(r=>r.origem_ia===false).length };
  });
  const quad = { vv:0,vf:0,fv:0,ff:0 };
  for (const r of ri) {
    if (typeof r.origem_ia !== 'boolean' || typeof r.resposta_ia !== 'boolean') continue;
    quad[(r.origem_ia?'v':'f')+(r.resposta_ia?'v':'f')]++;
  }
  const porFrame = Object.keys(ENQUADRAMENTOS).map(fr=>{
    const rr=ri.filter(r=>r.enquadramento===fr);
    const base=averageCorrectByPerson(rr);
    return { chave:fr, nome:ENQUADRAMENTOS[fr], n:rr.length, participantes:base.n, acerto:base.media,
      ic:base.ic, disseIa:pct(rr.filter(r=>r.resposta_ia===true).length, rr.length),
      tempoMed:mediana(rr.map(r=>sec(r.tempo_ms))) };
  });
  const porFrameComp=Object.keys(ENQUADRAMENTOS).map(fr=>{
    const rr=rc.filter(r=>r.enquadramento===fr);
    const base=averageCorrectByPerson(rr);
    return { chave:fr, nome:ENQUADRAMENTOS[fr], n:rr.length, participantes:base.n,
      acerto:base.media, ic:base.ic };
  });
  const fTipo = Object.keys(TIPOS_ANALISE).flatMap(tipo=>Object.keys(ENQUADRAMENTOS).map(fr=>{
    const r=ri.filter(x=>x.tipo===tipo&&x.enquadramento===fr);
    const base=averageCorrectByPerson(r);
    return { tipo, frame:fr, nome:TIPOS_ANALISE[tipo], n:r.length, pessoas:base.n, acerto:base.media, disseIA:pct(r.filter(x=>x.resposta_ia).length,r.length) };
  })).filter(row=>row.n);
  const sonoros = ri.filter(r=>r.tipo==='audio');
  const metrificados = sonoros.filter(r=>number(r.duracao_audio_s)>0 && number(r.trecho_liberado_s)>0);
  const audio = {
    n:sonoros.length, medidos:metrificados.length,
    ouvidoMed:mediana(metrificados.map(r=>number(r.segundos_reproduzidos))),
    limiteMed:mediana(metrificados.map(r=>number(r.trecho_liberado_s))),
    fraçãoMed:mediana(metrificados.map(r=>100*number(r.trecho_liberado_s)/number(r.duracao_audio_s))),
    maisMed:mediaValida(metrificados.map(r=>number(r.pedidos_mais))),
    repeticoesMed:mediaValida(metrificados.map(r=>number(r.repeticoes_audio))),
    etapas:[0,1,2,3,4,5,6,7].map(q=>{
      const rr=metrificados.filter(r=>Math.min(7,Math.max(0,number(r.pedidos_mais)||0))===q);
      return { nome:q===7?'7+':String(q), n:rr.length, acerto:pct(rr.filter(r=>r.acertou).length,rr.length) };
    }),
  };
  const exportItens=itens.filter(x=>!x.comparacao_id).map(item=>{
    const r=ri.filter(a=>a.conteudo_id===item.id);
    return { ...item, n_exibicoes:r.length, acertos:r.filter(a=>a.acertou).length,
      pct_acerto:pct(r.filter(a=>a.acertou).length,r.length),
      marca_ia:pct(r.filter(a=>a.resposta_ia).length,r.length),
      mediana_tempo:mediana(r.map(x=>sec(x.tempo_ms))) };
  });
  const difficult=exportItens.filter(r=>r.n_exibicoes>=5).sort((a,b)=>(a.pct_acerto??101)-(b.pct_acerto??101));
  const days=new Map();
  for (const p of sessoes) {
    const dia=String(p.inicio||'').slice(0,10);
    if (!dia) continue;
    const o=days.get(dia)||{ nome:dia, iniciadas:0, completas:0 };
    o.iniciadas++; if (p.finalizado) o.completas++; days.set(dia,o);
  }
  const perfil = (key, escolhas) => escolhas.map(v=>{
    const grupo=pessoas.filter(p=>String(p[key])===String(v));
    const est=resumoParticipantes(grupo.map(p=>p.pct_ind));
    return { chave:v, nome:`${v}`, n:est.n, acerto:est.media, ic:est.ic };
  }).filter(x=>x.n>0);
  return {
    sessoes, validas, pessoas, ri, rc, itens, completas,
    coleta:{ total:sessoes.length, finalizadas:sessoes.filter(s=>s.finalizado).length,
      validas:validas.length, pilotos:completas.filter(s=>s.excluir_analise).length,
      incompletas:sessoes.filter(s=>!s.finalizado).length,
      foraProtocolo:sessoes.filter(s=>s.finalizado && !completas.includes(s)).length,
      volume:ri.length+rc.length, porDia:[...days.values()].sort((a,b)=>a.nome.localeCompare(b.nome)) },
    notas:nota, comparacaoExata, comparacaoItens,
    tipo:relatorioTipo, quad, porFrame, porFrameComp, fTipo, audio, exportItens, difficult,
    composicao:{ IA:ri.filter(r=>r.origem_ia===true).length, real:ri.filter(r=>r.origem_ia===false).length },
    viesConfianca:resumoParticipantes(pessoas.filter(p=>p.estimativa_pct!=null&&p.pct_geral!=null).map(p=>p.estimativa_pct-p.pct_geral)),
    faixa:perfil('faixa',['Até 17','18–24','25–34','35–44','45–59','60+']),
  };
}
