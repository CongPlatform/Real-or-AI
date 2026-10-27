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
      // O novo grupo permanece INATIVO até a conclusão de todo o lote.
      const {data,error}=await supabase.from('comparacoes')
        .insert({tipo:g.tipo,codigo_importacao:null,ativo:false})
        .select('id').single();
      if(error)throw error;
      id=data.id;
      for(let n=0;n<g.itens.length;n++) await criarPeca({...g,id},g.itens[n],n+1);
      return {estado:'preparado',id,mensagem:`${g.itens.length} materiais enviados, aguardando ativação do lote.`};
    }catch(e){
      midiasUsadas.current.clear();
      if(id){
        try{
          const {data}=await supabase.from('conteudos').select('id').eq('comparacao_id',id);
          if(data?.length)await removerArquivosCriados(data.map(x=>x.id));
          await supabase.from('comparacoes').delete().eq('id',id);
        }catch(err){console.warn('Falha ao reverter o grupo:',err);}
      }
      return {estado:'erro',mensagem:e?.message||'Erro ao cadastrar comparação.'};
    }
  }

  async function importar(){
    if(enviando||selecionando||!pendentes.length||erros.length)return;
    const tipos=[...new Set(pendentes.map(g=>g.tipo))];
    const confirmar=`SUBSTITUIR ${tipos.map(t=>ROTULOS[t].toUpperCase()).join(' E ')}`;
    if(window.prompt(`A substituição será feita por MODALIDADE: todos os grupos de comparação ativos de ${tipos.join(' e ')} serão arquivados, mesmo que tenham outros códigos. As questões individuais e os registros históricos serão preservados.\n\nDigite: ${confirmar}`)!==confirmar)return;
    setEnviando(true);setAvisos([]);
    const preparados=[]; let falhou=false;
    try{
      for(const g of pendentes){
        setStatus(s=>({...s,[g.key]:{estado:'enviando',mensagem:'Enviando os materiais…'}}));
        const r=await cadastrarGrupo(g);
        setStatus(s=>({...s,[g.key]:r}));
        if(r.estado==='preparado')preparados.push({tipo:g.tipo,codigo:g.codigo,id:r.id,chave:g.key});
        else falhou=true;
      }
      if(falhou){
        setAvisos(['Houve uma falha de envio. Os grupos antigos continuam ativos. Nenhuma substituição foi executada. Os grupos preparados permanecerão inativos até uma nova importação.']);
        return;
      }
      const {error}=await supabase.rpc('admin_substituir_modalidades_comparacao_v20',{
        p_tipos:tipos,p_novos:preparados.map(({tipo,codigo,id})=>({tipo,codigo,id}))
      });
      if(error)throw error;
      for(const g of preparados)setStatus(s=>({...s,[g.chave]:{estado:'sucesso',mensagem:'Grupo ativado na nova coleção.'}}));
      await recarregar();
    }catch(e){
      setAvisos([`Falha na ativação: ${e.message||e}. Os grupos anteriores permanecem ativos; confira se aplicou os SQLs v19, v20 e v22 (liberação de áudio).`]);
    }finally{setEnviando(false);}
  }

  return <section className="painel larga importar-comparacoes-zip">
    <div className="comparacao-zip-head"><div><h2>Importar comparações por ZIP</h2>
      <p className="mut">Grupos de imagem: quatro materiais como C1-REAL, C1-IA, C1.1-REAL e C1.1-IA. Grupos de áudio podem ser importados com dois materiais e completados depois. Para ativar comparações de áudio, aplique também a migração SQL v22. No teste, quaisquer dois arquivos diferentes do mesmo grupo podem formar uma comparação. Ao concluir um lote, os grupos anteriores da MESMA MODALIDADE são arquivados, sem apagar respostas ou conteúdos individuais.</p></div></div>
    <details className="comparacao-zip-exemplos"><summary>Como nomear os arquivos e as pastas?</summary>
      <p>Use os nomes <code>C1-REAL.zip</code>, <code>C1-IA.zip</code>, <code>C1.1-REAL.zip</code> e <code>C1.1-IA.zip</code> (ou nomes equivalentes nos arquivos/pastas internas do ZIP). Aceita variantes C2.2, C3.3, C10.10 e espaços como C8 -  IA. Os arquivos de um grupo devem ter a mesma modalidade. Aceita imagens e áudios, além de textos e vídeos.</p>
    </details>
    <label className="lote-nome" htmlFor="comparacoes-arquivos-zip">Selecione ZIPs de imagens, áudios, textos ou vídeos</label>
    <input type="file" id="comparacoes-arquivos-zip" accept=".zip,application/zip" multiple
      disabled={enviando||selecionando} onChange={selecionar}/>
    {selecionando&&<p role="status">Lendo e descompactando ZIPs…</p>}
    {avisos.length>0&&<div className="lote-erros" role="alert"><strong>Avisos de importação</strong><ul>{avisos.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
    {!!itens.length&&<>
      <div className="comparacao-zip-resumo"><b>{grupos.length} grupos identificados</b><span>{grupos.filter(g=>!g.erros.length).length} grupos prontos</span><span>{grupos.filter(g=>g.erros.length).length} incompletos ou inválidos</span></div>
      <div className="comparacao-zip-grupos">
        {grupos.map(g=><article className="comparacao-zip-grupo" key={g.key}>
          <div className="comparacao-zip-titulo"><strong>{g.codigo} · {ROTULOS[g.tipo]}</strong>
            <span className={'lote-status '+(status[g.key]?.estado||'pendente')}>
              {status[g.key]?.estado==='sucesso'?'Ativado':status[g.key]?.estado==='preparado'?'Preparado':status[g.key]?.estado==='enviando'?'Enviando…':g.erros.length?'Incompleto':`Pronto: ${g.itens.length} materiais`}
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
        <button type="button" className="cta" disabled={enviando||selecionando||!pendentes.length||!!erros.length} onClick={importar}>
          {enviando?'Cadastrando comparações…':`Substituir comparações (${pendentes.length} grupos)`}
        </button>
        <button type="button" className="link" disabled={enviando||selecionando} onClick={limpar}>Limpar seleção</button>
      </div>
      {!!erros.length&&<p className="erro" role="alert">Grupos inválidos impedem a substituição do lote. Corrija seus nomes ou selecione os ZIPs que faltam.</p>}
    </>}
  </section>;
}
