import { useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { criarItem } from '../lib/conteudosStorage';
import { agruparComparacoes, lerZipDeComparacoes } from '../lib/zipComparacoes';

const ROTULOS={imagem:'Imagem',texto:'Texto',video:'Vídeo',audio:'Áudio'};
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
      // Preserva dados históricos: comparação antiga fica inativa e recebe código de arquivo.
      // Só administradores podem executar este RPC.
      const {error:arquivoErro}=await supabase.rpc('admin_arquivar_grupo_v19',{p_tipo:g.tipo,p_codigo:g.codigo});
      if(arquivoErro)throw arquivoErro;
      const {data,error}=await supabase.from('comparacoes')
        .insert({tipo:g.tipo,codigo_importacao:g.codigo,ativo:false})
        .select('id').single();
      if(error)throw error;
      id=data.id;
      for(let n=0;n<4;n++) await criarPeca({...g,id},g.itens[n],n+1);
      // Ativar somente após os quatro arquivos e seus gabaritos serem salvos.
      const {error:ativacaoErro}=await supabase.from('comparacoes').update({ativo:true}).eq('id',id);
      if(ativacaoErro)throw ativacaoErro;
      return {estado:'sucesso',mensagem:'Grupo com quatro materiais cadastrado e ativo.'};
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
    if(!window.confirm('Substituir os grupos de mesmo código? Os antigos serão desativados e arquivados, sem excluir respostas históricas.'))return;
    setEnviando(true);setAvisos([]);
    let salvas=0;
    for(const g of pendentes){
      setStatus(s=>({...s,[g.key]:{estado:'enviando',mensagem:'Cadastrando os quatro materiais…'}}));
      const r=await cadastrarGrupo(g);
      setStatus(s=>({...s,[g.key]:r}));
      if(r.estado==='sucesso')salvas++;
    }
    if(salvas)await recarregar();
    setEnviando(false);
  }

  return <section className="painel larga importar-comparacoes-zip">
    <div className="comparacao-zip-head"><div><h2>Importar comparações por ZIP</h2>
      <p className="mut">Cada grupo reúne quatro materiais: C1-REAL, C1-IA, C1.1-REAL e C1.1-IA. No teste, quaisquer dois arquivos diferentes do mesmo grupo podem formar uma comparação. Comparações anteriores são arquivadas, sem apagar respostas.</p></div></div>
    <details className="comparacao-zip-exemplos"><summary>Como nomear os arquivos e as pastas?</summary>
      <p>Use os nomes <code>C1-REAL.zip</code>, <code>C1-IA.zip</code>, <code>C1.1-REAL.zip</code> e <code>C1.1-IA.zip</code> (ou nomes equivalentes nos arquivos/pastas internas do ZIP). Os quatro devem ter a mesma modalidade. Aceita imagens e áudios, além de textos e vídeos.</p>
    </details>
    <label className="lote-nome" htmlFor="comparacoes-arquivos-zip">Selecione ZIPs de imagens, áudios, textos ou vídeos</label>
    <input type="file" id="comparacoes-arquivos-zip" accept=".zip,application/zip" multiple
      disabled={enviando||selecionando} onChange={selecionar}/>
    {selecionando&&<p role="status">Lendo e descompactando ZIPs…</p>}
    {avisos.length>0&&<div className="lote-erros" role="alert"><strong>Avisos de importação</strong><ul>{avisos.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
    {!!itens.length&&<>
      <div className="comparacao-zip-resumo"><b>{grupos.length} grupos identificados</b><span>{grupos.filter(g=>!g.erros.length).length} grupos completos</span><span>{grupos.filter(g=>g.erros.length).length} incompletos ou inválidos</span></div>
      <div className="comparacao-zip-grupos">
        {grupos.map(g=><article className="comparacao-zip-grupo" key={g.key}>
          <div className="comparacao-zip-titulo"><strong>{g.codigo} · {ROTULOS[g.tipo]}</strong>
            <span className={'lote-status '+(status[g.key]?.estado||'pendente')}>
              {status[g.key]?.estado==='sucesso'?'Cadastrado':status[g.key]?.estado==='enviando'?'Enviando…':g.erros.length?'Incompleto':`Pronto: ${g.itens.length}/4`}
            </span></div>

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
          {enviando?'Cadastrando comparações…':`Cadastrar ${pendentes.length} grupo(s)`}
        </button>
        <button type="button" className="link" disabled={enviando||selecionando} onClick={limpar}>Limpar seleção</button>
      </div>
      {!!erros.length&&<p className="erro" role="alert">Os grupos incompletos ou inválidos não serão enviados. Corrija seus nomes ou selecione os ZIPs que faltam.</p>}
    </>}
  </section>;
}
