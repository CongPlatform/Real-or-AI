import { useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { criarItem } from '../lib/conteudosStorage';
import { agruparComparacoes, lerZipDeComparacoes } from '../lib/zipComparacoes';

const ROTULOS={imagem:'Imagem',texto:'Texto',video:'Vídeo'};
const CENARIOS=['Nenhuma peça é IA (ambas humanas)','Uma peça é IA e outra humana','Ambas são IA'];

// Somente administrador tem permissão para executar as escritas pelas políticas RLS existentes.
export default function ImportarComparacoesZip({ recarregar }) {
  const [itens,setItens]=useState([]);
  const [status,setStatus]=useState({});
  const [selecionando,setSelecionando]=useState(false);
  const [enviando,setEnviando]=useState(false);
  const [avisos,setAvisos]=useState([]);
  // Uma peça-base pode integrar dois pares sem reenviar os bytes do mesmo vídeo.
  const midiasUsadas=useRef(new Map());
  const {grupos,erros}=useMemo(()=>agruparComparacoes(itens),[itens]);
  const pendentes=grupos.filter(g=>!g.erros.length&&status[g.key]?.estado!=='sucesso');

  async function selecionar(evento){
    const arquivos=Array.from(evento.target.files||[]);
    evento.target.value='';
    if(!arquivos.length)return;
    setSelecionando(true);
    const novos=[],warnings=[];
    for(const arquivo of arquivos){
      if(!/\.zip$/i.test(arquivo.name)){warnings.push(`${arquivo.name}: não é ZIP.`);continue;}
      try{novos.push(...await lerZipDeComparacoes(arquivo));}
      catch(e){warnings.push(e.message||`Não foi possível ler ${arquivo.name}.`);}
    }
    setItens(antigos=>{
      const ids=new Set(antigos.map(i=>`${i.origemZip}\0${i.arquivo}`));
      const unicos=novos.filter(i=>!ids.has(`${i.origemZip}\0${i.arquivo}`));
      if(unicos.length!==novos.length)warnings.push('Arquivos repetidos foram ignorados.');
      return [...antigos,...unicos];
    });
    setAvisos(warnings);
    setSelecionando(false);
  }

  function limpar(){setItens([]);setStatus({});setAvisos([]);midiasUsadas.current.clear();}
  async function removerArquivosCriados(ids){
    const {data,error}=await supabase.from('conteudos').select('id,url').in('id',ids);
    if(error) return; // na dúvida, preservar a mídia em vez de quebrar outro par
    const urls=[...new Set((data||[]).map(c=>c.url).filter(Boolean))];
    const paths=[];
    for(const url of urls){
      // Material usado por mais de uma comparação: não excluir o mesmo arquivo
      // de Storage enquanto outra linha de conteúdo ainda faz referência a ele.
      const {data:referencias,error:erroReferencia}=await supabase.from('conteudos')
        .select('id').eq('url',url).not('id','in',`(${ids.join(',')})`).limit(1);
      if(erroReferencia||referencias?.length) continue;
      const match=String(url).match(/\/storage\/v1\/object\/public\/midia\/(.+)$/);
      if(match) paths.push(decodeURIComponent(match[1]));
    }
    if(paths.length) await supabase.storage.from('midia').remove(paths);
  }

  async function criarPeca(g,item,posicao){
    const chave=`${item.origemZip}\0${item.arquivo}`;
    const cache=midiasUsadas.current.get(chave);
    const titulo=`${g.codigo} · ${item.titulo}`;
    if(cache){
      // Registros separados (uma peça pertence a um único par), mas uma URL
      // compartilhada no Storage: evita upload duplicado, especialmente vídeos.
      const {data,error}=await supabase.from('conteudos').insert({
        tipo:g.tipo,titulo,url:cache.url,texto:cache.texto,
        comparacao_id:g.id,posicao,
      }).select('id').single();
      if(error) throw error;
      const {error:erroGabarito}=await supabase.from('gabarito')
        .insert({conteudo_id:data.id,eh_ia:item.ia});
      if(erroGabarito){await supabase.from('conteudos').delete().eq('id',data.id);throw erroGabarito;}
      return;
    }
    const novoId=await criarItem(g.tipo,{arq:item.arq,texto:item.texto,ia:item.ia},
      titulo,{comparacao_id:g.id,posicao});
    const {data,error}=await supabase.from('conteudos').select('url,texto').eq('id',novoId).single();
    if(!error&&data) midiasUsadas.current.set(chave,{url:data.url,texto:data.texto});
  }

  async function cadastrarGrupo(g){
    let id=null;
    try{
      // Chave única por modalidade e código: evita cadastrar C1 duas vezes.
      const {data,error}=await supabase.from('comparacoes')
        .insert({tipo:g.tipo,codigo_importacao:g.codigo,ativo:false})
        .select('id').single();
      if(error)throw error;
      id=data.id;
      for(let n=0;n<2;n++) await criarPeca({...g,id},g.itens[n],n+1);
      // Ativar somente após os dois arquivos e seus gabaritos serem salvos.
      const {error:ativacaoErro}=await supabase.from('comparacoes').update({ativo:true}).eq('id',id);
      if(ativacaoErro)throw ativacaoErro;
      return {estado:'sucesso',mensagem:'Comparação cadastrada e ativa.'};
    }catch(e){
      midiasUsadas.current.clear(); // descarta referências que possam ter sido revertidas
      if(id){
        // Em caso de erro, evitar manter uma comparação com apenas um item.
        try{
          const {data}=await supabase.from('conteudos').select('id').eq('comparacao_id',id);
          if(data?.length)await removerArquivosCriados(data.map(x=>x.id));
          await supabase.from('comparacoes').delete().eq('id',id);
        }catch(err){console.warn('A limpeza da importação parcial falhou:',err);}
      }
      return {estado:'erro',mensagem:e?.code==='23505'
        ? `Já existe uma comparação ${g.codigo} em ${ROTULOS[g.tipo]}. Não foi duplicada.`
        : (e?.message||'Erro ao cadastrar comparação.')};
    }
  }

  async function importar(){
    if(enviando||selecionando||!pendentes.length)return;
    setEnviando(true);setAvisos([]);
    let salvas=0;
    for(const g of pendentes){
      setStatus(s=>({...s,[g.key]:{estado:'enviando',mensagem:'Cadastrando os dois materiais…'}}));
      const r=await cadastrarGrupo(g);
      setStatus(s=>({...s,[g.key]:r}));
      if(r.estado==='sucesso')salvas++;
    }
    if(salvas)await recarregar();
    setEnviando(false);
  }

  return <section className="painel larga importar-comparacoes-zip">
    <div className="comparacao-zip-head"><div><h2>Importar comparações por ZIP</h2>
      <p className="mut">Envie vários arquivos ZIP de uma vez ou em seleções sucessivas. O sistema agrupa <strong>C1-IA</strong> e <strong>C1-REAL</strong> como uma dupla. Com uma variante <strong>C1.1-IA</strong>, cria ainda uma segunda dupla IA × IA. Também aceita duas peças humanas.</p></div></div>
    <details className="comparacao-zip-exemplos"><summary>Como nomear os arquivos e as pastas?</summary>
      <p>Uma peça por arquivo: <code>C1-IA.zip</code> e <code>C1-REAL.zip</code>. Para dois materiais com a mesma origem, utilize <code>C2.1-IA.zip</code> e <code>C2.2-IA.zip</code>, ou <code>C3.1-REAL.zip</code> e <code>C3.2-REAL.zip</code>.</p>
      <p>Também aceita um ZIP contendo pastas <code>C4-IA/</code> e <code>C4-REAL/</code>, cada uma com seu arquivo. Uma pasta <code>C5-IA/</code> com exatamente duas mídias cria um par com ambas IA. Para textos, use arquivos <code>.txt</code> ou <code>.md</code>. Não misture modalidades dentro do mesmo par. Áudios são permitidos apenas no cadastro individual.</p>
      <p><strong>Três arquivos podem virar dois pares:</strong> <code>C11-IA</code> + <code>C11-REAL</code> + <code>C11.1-IA</code> geram <code>C11</code> (IA + humano) e <code>C11.1</code> (IA + IA). A peça <code>C11-IA</code> é utilizada nos dois pares. Para criar humano + humano, acrescente <code>C11.2-REAL</code>. O número após o ponto identifica uma variante; a origem vem de <code>-IA</code> ou <code>-REAL</code>.</p>
    </details>
    <label className="lote-nome" htmlFor="comparacoes-arquivos-zip">Selecione ZIPs de imagens, textos ou vídeos</label>
    <input type="file" id="comparacoes-arquivos-zip" accept=".zip,application/zip" multiple
      disabled={enviando||selecionando} onChange={selecionar}/>
    {selecionando&&<p role="status">Lendo e descompactando ZIPs…</p>}
    {avisos.length>0&&<div className="lote-erros" role="alert"><strong>Avisos de importação</strong><ul>{avisos.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
    {!!itens.length&&<>
      <div className="comparacao-zip-resumo"><b>{grupos.length} grupos identificados</b><span>{grupos.filter(g=>!g.erros.length).length} pares completos</span><span>{grupos.filter(g=>g.erros.length).length} incompletos ou inválidos</span></div>
      <div className="comparacao-zip-grupos">
        {grupos.map(g=><article className="comparacao-zip-grupo" key={g.key}>
          <div className="comparacao-zip-titulo"><strong>{g.codigo} · {ROTULOS[g.tipo]}</strong>
            <span className={'lote-status '+(status[g.key]?.estado||'pendente')}>
              {status[g.key]?.estado==='sucesso'?'Cadastrado':status[g.key]?.estado==='enviando'?'Enviando…':g.erros.length?'Incompleto':`Pronto: ${g.itens.length}/2`}
            </span></div>
          {g.cenario!==null&&<p className="mut"><b>Cenário:</b> {CENARIOS[g.cenario]}{g.derivado ? " · Variante automática" : ""}</p>}
          {g.itens.map((item,n)=><div className="comparacao-zip-peca" key={item.origemZip+':'+item.arquivo}>
            <span>Peça {n+1}: <b>{item.ia?'IA':'Humano'}</b></span>
            <span title={item.arquivo}>{item.titulo} <small>({item.origemZip})</small></span>
          </div>)}
          {g.erros.map((msg,i)=><p key={i} className="erro">{msg}</p>)}
          {status[g.key]?.mensagem&&<p className={status[g.key].estado==='erro'?'erro':'mut'} role="status">{status[g.key].mensagem}</p>}
        </article>)}
      </div>
      <div className="comparacao-zip-acoes">
        <button type="button" className="cta" disabled={enviando||selecionando||!pendentes.length} onClick={importar}>
          {enviando?'Cadastrando comparações…':`Cadastrar ${pendentes.length} comparação(ões)`}
        </button>
        <button type="button" className="link" disabled={enviando||selecionando} onClick={limpar}>Limpar seleção</button>
      </div>
      {!!erros.length&&<p className="erro" role="alert">Os grupos incompletos ou inválidos não serão enviados. Corrija seus nomes ou selecione os ZIPs que faltam.</p>}
    </>}
  </section>;
}
