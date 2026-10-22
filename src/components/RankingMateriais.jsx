import { useEffect, useMemo, useState } from 'react';
import { analisarMateriais, MODOS_RANKING, ordenarMateriais } from '../lib/analiseMateriais';
import { supabase } from '../lib/supabase';

const pct = n => n == null ? '—' : `${n.toFixed(1).replace('.', ',')}%`;
const TIPO = { imagem:'Imagem', texto:'Texto', audio:'Áudio', video:'Vídeo' };
function baixarCsv(rows){
  const colunas = ['id','nome','tipo','origem','ativo','id_comparacao','avaliacoes','participantes','votos_ia','votos_humano','percentual_ia','percentual_humano','acertos','erros','taxa_erro','humano_confundido_ia','ia_confundida_humano','individual','comparacao'];
  const linha = x => [x.id,x.nome,x.tipo,x.origem_ia?'IA':'Humano',x.ativo,x.comparacao_id||'',x.n,x.participantes,x.ia,x.humano,x.pctIA??'',x.pctHumano??'',x.acertos,x.erros,x.pctErro??'',x.erroHumanoComoIA,x.erroIAComoHumano,x.nIndividual,x.nComparacao];
  const safe = v => {let s=String(v??'');if (/^\s*[=+@\-]/.test(s)) s="'"+s;return `"${s.replaceAll('"','""')}"`;};
  const csv='\ufeff'+[colunas,...rows.map(linha)].map(r=>r.map(safe).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='real_ou_ia_rankings_por_material.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function Votos({x}){
  return <div className="v6-votos" aria-label={`${x.ia} votos IA; ${x.humano} votos humano`}>
    <div className="v6-votos-trilha">
      {x.n>0&&<><span className="ia" style={{width:`${x.pctIA}%`}}/><span className="humano" style={{width:`${x.pctHumano}%`}}/></>}
    </div>
    <div className="v6-votos-legenda"><span><i className="ia"/>IA <b>{x.ia}</b> ({pct(x.pctIA)})</span><span><i className="humano"/>Humano <b>{x.humano}</b> ({pct(x.pctHumano)})</span></div>
  </div>;
}
function Previa({ material, item, carregando, falha }) {
  if (carregando) return <div className="v7-preview-status">Carregando prévia…</div>;
  if (falha) return <div className="v7-preview-status">Prévia indisponível. Verifique a atualização SQL.</div>;
  if (!material) return <div className="v7-preview-status">Sem prévia cadastrada.</div>;
  if (item.tipo === 'texto') {
    const texto = material.texto || '';
    if (!texto) return <div className="v7-preview-status">Texto não encontrado.</div>;
    const curta = texto.length > 230;
    return <div className="v7-preview-texto">
      {curta ? <>
        <p>{texto.slice(0, 230).trimEnd()}…</p>
        <details><summary>Ler texto completo</summary><div className="v7-preview-inteiro">{texto}</div></details>
      </> : <div className="v7-preview-inteiro">{texto}</div>}
    </div>;
  }
  if (!material.url || !/^https:\/\//i.test(material.url))
    return <div className="v7-preview-status">Arquivo não disponível.</div>;
  if (item.tipo === 'imagem') return <div className="v7-preview-imagem">
    <img loading="lazy" decoding="async" src={material.url} alt={`Prévia do material ${item.nome}`} />
    <details><summary>Ampliar imagem</summary><img loading="lazy" src={material.url} alt={`Imagem ampliada: ${item.nome}`} className="v7-preview-ampliada" /></details>
  </div>;
  if (item.tipo === 'audio') return <div className="v7-preview-midia"><span>Ouvir o áudio</span><audio controls preload="none" src={material.url} aria-label={`Reproduzir ${item.nome}`} /></div>;
  if (item.tipo === 'video') return <div className="v7-preview-midia"><video controls preload="none" playsInline src={material.url} aria-label={`Reproduzir ${item.nome}`} /></div>;
  return <div className="v7-preview-status">Tipo não reconhecido.</div>;
}
function Linha({item,modo,pos,material,carregando,erroPrevia}){
  const erro = modo==='falsoPositivo' || modo==='falsoNegativo' || modo==='taxaErro';
  const principal = modo==='ia' ? `${item.ia} votos IA` : modo==='humano' ? `${item.humano} votos humano` :
    modo==='falsoPositivo' ? `${item.erroHumanoComoIA} erros` : modo==='falsoNegativo' ? `${item.erroIAComoHumano} erros` :
    modo==='taxaErro' ? pct(item.pctErro) : `${item.n} avaliações`;
  return <div className="v6-material-linha">
    {pos!=null&&<strong className="v6-ranking-pos">{pos}º</strong>}
    <div className="v7-preview-bloco"><Previa item={item} material={material} carregando={carregando} falha={erroPrevia}/></div>
    <div className="v6-material-detalhes"><div className="v6-material-titulo"><strong title={item.nome}>{item.nome}</strong><span className="v6-tag">{TIPO[item.tipo]||item.tipo}</span><span className="v6-tag">Origem: {item.origem_ia?'IA':'Humano'}</span>{item.comparacao_id&&<span className="v6-tag">Par</span>}</div>
      <div className="v6-material-meta"><span>{item.n} avaliações · {item.participantes} participantes</span><span>{item.nIndividual} individuais · {item.nComparacao} em pares</span><span>Erros: {item.erros}/{item.n} ({pct(item.pctErro)})</span></div>
      <Votos x={item}/>
    </div><strong className={`v6-ranking-valor ${erro?'alerta':''}`}>{principal}</strong>
  </div>;
}
const FILTROS_ORIGEM=[['todos','Todas as origens'],['ia','Só itens de IA'],['humano','Só itens humanos']];
const FILTROS_FONTE=[['todos','Individuais + pares'],['individual','Só questões individuais'],['comparacao','Só comparações']];
export default function RankingMateriais({d, comparacoesDetalhes, comparacoesDisponiveis}){
  const [modo,setModo]=useState('ia');
  const [tipo,setTipo]=useState('todos');
  const [classe,setClasse]=useState('todos');
  const [fonte,setFonte]=useState('todos');
  const [busca,setBusca]=useState('');
  const [minimo,setMinimo]=useState(1);
  const [verTodos,setVerTodos]=useState(false);
  // Apenas o administrador pode buscar URLs/textos; a RPC protege o gabarito e o conteúdo.
  // Carregar apenas quando a aba é montada. Os arquivos de áudio/vídeo não são baixados até reprodução.
  const [previews,setPreviews]=useState(null);
  const [erroPrevia,setErroPrevia]=useState('');
  useEffect(()=>{
    let montado=true;
    supabase.rpc('admin_previews_materiais_v7').then(({data,error})=>{
      if(!montado)return;
      if(error){setErroPrevia(error.message||'Não foi possível carregar prévias.');setPreviews(new Map());return;}
      setPreviews(new Map((Array.isArray(data)?data:[]).map(x=>[String(x.id),x])));
    });
    return ()=>{montado=false;};
  },[]);

  const dados=useMemo(()=>analisarMateriais(d,comparacoesDetalhes,fonte),[d,comparacoesDetalhes,fonte]);
  const filtrados=useMemo(()=>dados.itens.filter(x=>(tipo==='todos'||x.tipo===tipo)&&
    (classe==='todos'||x.origem_ia===(classe==='ia'))&&
    x.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))),[dados.itens,tipo,classe,busca]);
  const ordenados=useMemo(()=>ordenarMateriais(filtrados,modo,minimo),[filtrados,modo,minimo]);
  const regra=MODOS_RANKING[modo];
  const rankings=['ia','humano','falsoPositivo','falsoNegativo'];
  return <div className="v6-materiais">
    <div className="v5-intro"><h2>O que as pessoas estão vendo em cada material?</h2><p>Todos os votos IA e humano por arquivo, independentemente do resultado. Descubra quais conteúdos passaram por IA, quais pareceram humanos e os que causaram mais confusão.</p></div>
    <div className="v5-hero-numeros"><div className="v5-numero"><span className="v5-numero-rotulo">Materiais avaliados</span><strong>{dados.usados}</strong><p>{dados.semVotos} sem avaliações neste recorte</p></div>
      <div className="v5-numero"><span className="v5-numero-rotulo">Votos IA</span><strong>{dados.votosIA}</strong><p>De {dados.votos} classificações por peça</p></div>
      <div className="v5-numero"><span className="v5-numero-rotulo">Humano acusado de IA</span><strong>{dados.erroHumanoComoIA}</strong><p>Falsos positivos</p></div>
      <div className="v5-numero"><span className="v5-numero-rotulo">IA passou por humano</span><strong>{dados.erroIAComoHumano}</strong><p>Falsos negativos</p></div></div>
    {!comparacoesDisponiveis&&<div className="v5-nota">A coleta detalhada dos votos de comparação ainda não está habilitada no Supabase. Até instalar o SQL v6, os rankings usam somente classificações individuais.</div>}
    {comparacoesDisponiveis&&d.rc?.length>0&&dados.respostasComparacao===0&&<div className="v5-nota">Existem respostas a comparações no período, mas nenhum voto por peça neste recorte. Respostas antigas só guardavam o total de acertos do par: não é possível recuperar individualmente em qual item cada pessoa marcou IA.</div>}
    <div className="v6-material-atalhos">{rankings.map(chave=>{
      const top=ordenarMateriais(dados.itens,chave,minimo)[0];
      return <button key={chave} type="button" className={modo===chave?'selecionado':''} onClick={()=>{setModo(chave);setTipo('todos');setClasse('todos');setBusca('');}}>
        <span>{MODOS_RANKING[chave].titulo}</span><strong>{top?top.nome:'Sem registros'}</strong><small>{top?`${MODOS_RANKING[chave].valor(top)} marcações · ${top.n} avaliações`:`Mínimo: ${minimo} avaliações`}</small>
      </button>;
    })}</div>
    <section className="painel v5-painel"><div className="v5-painel-head"><h2>Ranking detalhado</h2><p className="mut">Ordene por quantidade absoluta, taxa de erro ou número de avaliações. O número de votos é exibido sempre junto da porcentagem.</p></div>
      <div className="v6-material-filtros">
        <label>Ordenar por<select value={modo} onChange={e=>setModo(e.target.value)}>{Object.entries(MODOS_RANKING).map(([key,x])=><option key={key} value={key}>{x.titulo}</option>)}</select></label>
        <label>Formato<select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="todos">Todos</option>{Object.entries(TIPO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>Origem verdadeira<select value={classe} onChange={e=>setClasse(e.target.value)}>{FILTROS_ORIGEM.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>Origem do voto<select value={fonte} onChange={e=>setFonte(e.target.value)}>{FILTROS_FONTE.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>Avaliações mínimas<select value={minimo} onChange={e=>setMinimo(Number(e.target.value))}><option value={1}>1 (exploratório)</option><option value={3}>3</option><option value={5}>5 (recomendado)</option><option value={10}>10</option><option value={20}>20</option></select></label>
        <label className="v6-busca">Buscar pelo nome<input type="search" placeholder="Buscar imagem, música, texto..." value={busca} onChange={e=>setBusca(e.target.value)}/></label>
      </div>
      <p className="v6-material-info">{regra.descricao} {minimo<5?'Com menos de cinco avaliações por peça, este ranking é apenas exploratório. ':''} Exibindo <b>{Math.min(ordenados.length,verTodos?ordenados.length:12)}</b> de <b>{ordenados.length}</b> resultados. A taxa por material usa <b>votos / avaliações daquele material</b>, não o total da pesquisa.</p>
      {erroPrevia&&<p className="v5-nota" role="alert">As estatísticas continuam disponíveis, mas as prévias dependem do SQL de atualização: {erroPrevia}</p>}
      {ordenados.length?<div className="v6-material-lista">{(verTodos?ordenados:ordenados.slice(0,12)).map((x,i)=><Linha item={x} modo={modo} pos={i+1} key={x.id} material={previews?.get(String(x.id))} carregando={previews===null} erroPrevia={!!erroPrevia}/>)}</div>:<p className="v5-empty">Nenhum material com votos válidos neste filtro. Confira se existem participantes que concluíram 30 decisões e se os testes estão marcados como piloto no filtro do topo. Também é possível reduzir o mínimo de avaliações.</p>}
      <div className="v6-material-acoes">{ordenados.length>12&&<button type="button" className="v5-btn-sec" onClick={()=>setVerTodos(x=>!x)}>{verTodos?'Mostrar apenas 12':'Mostrar todos os materiais'}</button>}
        <button className="cta" type="button" onClick={()=>baixarCsv(filtrados)}>Exportar todos os materiais filtrados (CSV)</button></div>
    </section>
    <div className="v5-nota"><strong>Como interpretar:</strong> “Mais marcado como IA” pode ser um arquivo realmente artificial e corretamente reconhecido, ou um conteúdo humano confundido com IA. Por isso cada linha mostra a origem verdadeira e os dois tipos de voto. O ranking de erros separa as duas situações. Materiais exibidos poucas vezes podem aparecer no topo por acaso — ajuste o número mínimo de avaliações antes de tirar conclusões. Os cálculos consideram somente sessões válidas no filtro geral de pilotos.</div>
  </div>;
}
