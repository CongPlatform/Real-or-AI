import { useEffect, useMemo, useState } from 'react';
import { analisarMateriais, ordenarGrupo } from '../lib/analiseMateriais';
import { supabase } from '../lib/supabase';

const pct = n => n == null ? '—' : `${n.toFixed(1).replace('.', ',')}%`;
const FORMATOS = [
  { id: 'video', nome: 'Vídeos' },
  { id: 'audio', nome: 'Áudios' },
  { id: 'imagem', nome: 'Imagens' },
  { id: 'texto', nome: 'Textos' }
];
// Em cada grupo: quem era de fato o autor e qual resposta os participantes deram.
const GRUPOS = [
  { id: 'iaAcertada', titulo: 'Marcaram IA — e era IA', verdadeiro: true, voto: 'ia', descricao: 'Acertos: os participantes reconheceram que o material foi gerado por IA.', cor: 'acerto' },
  { id: 'humanoConfundido', titulo: 'Marcaram IA — mas era humano', verdadeiro: false, voto: 'ia', descricao: 'Erros: um conteúdo humano foi confundido com inteligência artificial.', cor: 'erro' },
  { id: 'humanoAcertado', titulo: 'Marcaram humano — e era humano', verdadeiro: false, voto: 'humano', descricao: 'Acertos: os participantes reconheceram o conteúdo feito por uma pessoa.', cor: 'acerto' },
  { id: 'iaConfundida', titulo: 'Marcaram humano — mas era IA', verdadeiro: true, voto: 'humano', descricao: 'Erros: um conteúdo artificial foi confundido com uma produção humana.', cor: 'erro' }
];
function baixarCsv(rows) {
  const colunas = ['id','nome','tipo','origem_verdadeira','avaliacoes','participantes','votos_ia','votos_humano','percentual_ia','percentual_humano','acertos','erros','taxa_erro','individuais','comparacoes'];
  const linha = x => [x.id,x.nome,x.tipo,x.origem_ia?'IA':'Humano',x.n,x.participantes,x.ia,x.humano,x.pctIA??'',x.pctHumano??'',x.acertos,x.erros,x.pctErro??'',x.nIndividual,x.nComparacao];
  const seguro = v => { let s = String(v ?? ''); if (/^\s*[=+@\-]/.test(s)) s = "'"+s; return `"${s.replaceAll('"','""')}"`; };
  const csv = '\ufeff'+[colunas,...rows.map(linha)].map(r=>r.map(seguro).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='real_ou_ia_votos_por_material.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function Previa({ material, item, carregando, falha }) {
  if (carregando) return <p className="v8-previa-status">Carregando prévia…</p>;
  if (falha) return <p className="v8-previa-status">Prévia indisponível (SQL v7).</p>;
  if (!material) return <p className="v8-previa-status">Sem prévia.</p>;
  if (item.tipo === 'texto') {
    const texto=material.texto||'';
    if (!texto) return <p className="v8-previa-status">Texto indisponível.</p>;
    return <div className="v8-previa-texto"><div>{texto.length > 170 ? `${texto.slice(0,170).trimEnd()}…` : texto}</div>{texto.length>170&&<details><summary>Ler inteiro</summary><div className="v8-texto-inteiro">{texto}</div></details>}</div>;
  }
  if (!material.url || !/^https:\/\//i.test(material.url)) return <p className="v8-previa-status">Arquivo indisponível.</p>;
  if (item.tipo==='imagem') return <div className="v8-previa-imagem"><img src={material.url} alt={`Imagem ${item.nome}`} loading="lazy" decoding="async"/><details><summary>Ampliar</summary><img className="v8-ampliada" loading="lazy" src={material.url} alt={`Imagem ampliada ${item.nome}`}/></details></div>;
  if (item.tipo==='audio') return <audio className="v8-previa-audio" controls preload="none" src={material.url} aria-label={`Ouvir ${item.nome}`}/>;
  if (item.tipo==='video') return <video className="v8-previa-video" controls preload="none" playsInline src={material.url} aria-label={`Assistir ${item.nome}`}/>;
  return <p className="v8-previa-status">Tipo não reconhecido.</p>;
}
function Votos({item}) {
  return <div className="v8-votos" title={`${item.ia} votos IA; ${item.humano} votos humano`}>
    <div className="v8-votos-faixa" role="img" aria-label={`${item.ia} votos IA e ${item.humano} votos humano`}>
      {item.n>0&&<><span className="ia" style={{width:`${item.pctIA}%`}}/><span className="humano" style={{width:`${item.pctHumano}%`}}/></>}
    </div>
    <div className="v8-votos-valores"><span>IA: {item.ia}</span><span>Humano: {item.humano}</span></div>
  </div>;
}
function Linha({item, grupo, material, carregando, falha, pos}) {
  const votos=grupo.voto==='ia'?item.ia:item.humano;
  const percentual=grupo.voto==='ia'?item.pctIA:item.pctHumano;
  return <article className="v8-item">
    <div className="v8-item-topo"><span className="v8-pos">#{pos}</span><strong title={item.nome}>{item.nome}</strong></div>
    <div className={`v8-item-conteudo ${item.tipo==='imagem'?'':'v8-largura-total'}`}>
      <div className="v8-item-previa"><Previa material={material} item={item} carregando={carregando} falha={falha}/></div>
      <div className="v8-item-dados">
        <p className="v8-votos-principal"><strong>{votos}</strong> {votos===1?'voto':'votos'} como {grupo.voto==='ia'?'IA':'humano'} <span>({pct(percentual)})</span></p>
        <p className="v8-item-sub">De <b>{item.n}</b> avaliações · {item.participantes} participantes</p>
        <Votos item={item}/>
        <details className="v8-conta"><summary>Entender o cálculo</summary>
          <p>{votos} votos como {grupo.voto==='ia'?'IA':'humano'} ÷ {item.n} avaliações × 100 = <b>{pct(percentual)}</b>.</p>
          <p>Origem confirmada: <b>{item.origem_ia?'IA':'humano'}</b>. Essa contagem {grupo.cor==='acerto'?'representa acertos':'representa erros'}.</p>
        </details>
      </div>
    </div>
  </article>;
}
export default function RankingMateriais({d,comparacoesDetalhes,comparacoesDisponiveis}) {
  const [tipo,setTipo]=useState('video');
  const [fonte,setFonte]=useState('todos');
  const [criterio,setCriterio]=useState('votos');
  const [minimo,setMinimo]=useState(1);
  const [busca,setBusca]=useState('');
  const [expandidos,setExpandidos]=useState({});
  const [previews,setPreviews]=useState(null);
  const [erroPrevia,setErroPrevia]=useState('');
  useEffect(()=>{
    let montado=true;
    supabase.rpc('admin_previews_materiais_v7').then(({data,error})=>{
      if(!montado)return;
      if(error){setErroPrevia(error.message||'Falha ao carregar prévias.');setPreviews(new Map());return;}
      setPreviews(new Map((Array.isArray(data)?data:[]).map(x=>[String(x.id),x])));
    });
    return()=>{montado=false;};
  },[]);
  const dados=useMemo(()=>analisarMateriais(d,comparacoesDetalhes,fonte),[d,comparacoesDetalhes,fonte]);
  const itensTipo=useMemo(()=>dados.itens.filter(x=>x.tipo===tipo),[dados.itens,tipo]);
  const avaliados=itensTipo.filter(x=>x.n>0).length;
  const totalVotos=itensTipo.reduce((s,x)=>s+x.n,0);
  const resultados=useMemo(()=>GRUPOS.map(g=>({
    ...g, itens: ordenarGrupo(itensTipo,g,criterio,minimo,busca)
  })),[itensTipo,criterio,minimo,busca]);
  return <div className="v8-materiais">
    <div className="v5-intro"><h2>Como as pessoas classificaram cada material?</h2>
      <p>Selecione uma modalidade para comparar <b>quatro situações</b>: os acertos e os dois tipos de confusão. Cada posição mostra o próprio material, o número de votos e a porcentagem.</p></div>
    <div className="v8-abas-formato" role="group" aria-label="Modalidade de conteúdo">
      {FORMATOS.map(x=>{
        const qtd=dados.itens.filter(i=>i.tipo===x.id&&i.n>0).length;
        return <button key={x.id} type="button" aria-pressed={tipo===x.id} className={tipo===x.id?'ativo':''} onClick={()=>{setTipo(x.id);setExpandidos({});}}>{x.nome}<span>{qtd} avaliados</span></button>;
      })}
    </div>
    <div className="v8-filtro-compacto">
      <label>Ordenar por <select value={criterio} onChange={e=>setCriterio(e.target.value)}><option value="votos">Quantidade de votos</option><option value="percentual">Porcentagem de votos</option></select></label>
      <label>Exibições mínimas <select value={minimo} onChange={e=>setMinimo(Number(e.target.value))}><option value={1}>1 — exploratório</option><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label>
      <label>Origem dos votos <select value={fonte} onChange={e=>setFonte(e.target.value)}><option value="todos">Individuais + comparações</option><option value="individual">Só individuais</option><option value="comparacao">Só comparações</option></select></label>
      <label>Buscar material <input type="search" placeholder="Nome do arquivo..." value={busca} onChange={e=>setBusca(e.target.value)}/></label>
    </div>
    <p className="v8-resumo">Em <b>{FORMATOS.find(f=>f.id===tipo)?.nome.toLowerCase()}</b>: {avaliados} materiais com avaliações, {totalVotos} classificações registradas. {minimo<5?'Com poucas avaliações, o ranking pode mudar muito com cada nova resposta.':''}</p>
    {erroPrevia&&<div className="v5-nota" role="alert">Os números continuam disponíveis, mas as prévias dependem da função SQL v7: {erroPrevia}</div>}
    {!comparacoesDisponiveis&&<div className="v5-nota">O detalhamento das comparações exige o SQL v6. Por enquanto, os resultados completos incluem somente os votos individuais.</div>}
    {comparacoesDisponiveis&&d.rc?.length>0&&dados.respostasComparacao===0&&<div className="v5-nota">Comparações anteriores não registravam o voto de cada peça; por isso elas não entram nesses rankings.</div>}
    <div className="v8-quadrantes">
      {resultados.map(g=>{
        const expandido=!!expandidos[g.id];
        const exibidos=expandido?g.itens:g.itens.slice(0,3);
        return <section key={g.id} className={`v8-grupo ${g.cor}`} aria-label={g.titulo}>
          <div className="v8-grupo-head"><div><h3>{g.titulo}</h3><p>{g.descricao}</p></div><span>{g.itens.length} {g.itens.length===1?'material':'materiais'}</span></div>
          {exibidos.length?<div className="v8-grupo-lista">{exibidos.map((x,i)=><Linha key={x.id} item={x} grupo={g} pos={i+1} material={previews?.get(String(x.id))} carregando={previews===null} falha={!!erroPrevia}/>)}</div>:<p className="v8-sem-registro">Ainda não há materiais com votos suficientes neste grupo e filtro. Isso não significa que ninguém tenha errado ou acertado.</p>}
          {g.itens.length>3&&<button type="button" className="v8-ver-mais" onClick={()=>setExpandidos(s=>({...s,[g.id]:!s[g.id]}))}>{expandido?'Mostrar apenas 3':`Ver os ${g.itens.length} materiais`}</button>}
        </section>;
      })}
    </div>
    <details className="v8-ajuda-geral"><summary>Como interpretar esses rankings?</summary>
      <p>Os primeiros e terceiros grupos mostram <strong>acertos</strong>. Os outros dois mostram <strong>erros</strong>: humanos confundidos com IA ou IA confundida com humano.</p>
      <p><strong>Quantidade</strong> conta os votos recebidos. <strong>Porcentagem</strong> divide os votos pelo número de vezes que aquele material foi avaliado. Um material com 1 voto em 1 avaliação tem 100%, mas ainda há pouca informação sobre ele.</p>
      <p>As comparações antigas podem não conter votos individuais por peça; dados inexistentes não são reconstruídos. O filtro de sessões piloto do topo continua valendo aqui.</p>
    </details>
    <div className="v8-exportar"><button type="button" className="v5-btn-sec" onClick={()=>baixarCsv(itensTipo)}>Exportar dados da modalidade (CSV)</button></div>
  </div>;
}
