import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TIPOS } from '../lib/opcoes';
import { analisarTextosEmLote } from '../lib/textosLote';
import { criarItem } from '../lib/conteudosStorage';
import ImportacaoMidiasEmLote from './ImportacaoMidiasEmLote';
import ImportarAudiosHumanosPorGrupo from './ImportarAudiosHumanosPorGrupo';
import OtimizarImagensExistentes from './OtimizarImagensExistentes';
import RevisarTextosExistentes from './RevisarTextosExistentes';
import NormalizarAudios from './NormalizarAudios';
import ImportarComparacoesZip from './ImportarComparacoesZip';
import ImportarComparacoesTxt from './ImportarComparacoesTxt';
import { consultarInventario, agruparInventario } from '../lib/inventarioComparacoes';

const CEN = ['nenhum é IA', 'um é IA', 'todos são IA'];
const vazio = () => ({ arq: null, texto: '', ia: true });
const aceita = (t) => (t === 'imagem' ? 'image/*' : t === 'audio' ? 'audio/*' : 'video/*');

// O nome interno vem do arquivo original, não do UUID usado no Storage.
// Remove apenas a última extensão, preservando espaços, acentos e outros pontos.
const nomeSemExtensao = (nome) => nome.replace(/\.(png|jpe?g)$/i, '').trim();
const imagemValida = (arquivo) =>
  /\.(png|jpe?g)$/i.test(arquivo.name) &&
  (!arquivo.type || ['image/png', 'image/jpeg'].includes(arquivo.type));

function ImportacaoEmLote({ recarregar }) {
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const atualizar = (id, alteracoes) => setArquivos((atual) =>
    atual.map((item) => item.id === id ? { ...item, ...alteracoes } : item));

  function selecionar(e) {
    const escolhidos = Array.from(e.target.files || []);
    const validos = escolhidos.filter(imagemValida);
    const ignorados = escolhidos.length - validos.length;
    setArquivos(validos.map((arquivo) => ({
      id: crypto.randomUUID(), arquivo, titulo: nomeSemExtensao(arquivo.name),
      ia: true, status: 'pendente', erro: '',
    })));
    setAviso(ignorados
      ? `${ignorados} arquivo(s) ignorado(s): envie somente PNG, JPG ou JPEG.`
      : '');
    // Permite selecionar novamente os mesmos arquivos se necessário.
    e.target.value = '';
  }

  function definirTodos(ia) {
    setArquivos((atual) => atual.map((item) =>
      item.status === 'sucesso' ? item : { ...item, ia }));
  }

  async function importar() {
    if (enviando) return;
    const pendentes = arquivos.filter((item) => item.status !== 'sucesso');
    if (!pendentes.length) return;
    setEnviando(true);
    setAviso('');
    let salvos = 0;
    let falhas = 0;
    try {
      // Sequencial: evita sobrecarregar o Storage e mantém o progresso por arquivo.
      for (const item of pendentes) {
        atualizar(item.id, { status: 'enviando', erro: '' });
        try {
          await criarItem('imagem', { arq: item.arquivo, ia: item.ia },
            item.titulo.trim() || nomeSemExtensao(item.arquivo.name), {});
          atualizar(item.id, { status: 'sucesso', erro: '' });
          salvos += 1;
        } catch (erro) {
          atualizar(item.id, { status: 'erro', erro: erro.message || 'Erro desconhecido.' });
          falhas += 1;
        }
      }
      setAviso(`${salvos} imagem(ns) cadastrada(s).` +
        (falhas ? ` ${falhas} falha(s); é possível tentar de novo apenas as que falharam.` : ''));
      if (salvos) recarregar();
    } finally {
      setEnviando(false);
    }
  }

  const pendentes = arquivos.filter((item) => item.status !== 'sucesso').length;
  const concluidos = arquivos.filter((item) => item.status === 'sucesso').length;
  const todasIA = arquivos.length > 0 && arquivos.every((item) => item.ia);
  const todasReais = arquivos.length > 0 && arquivos.every((item) => !item.ia);

  return (
    <section className="painel">
      <h2>Importar imagens em lote</h2>
      <p className="mut">Selecione várias imagens de uma vez. Cada arquivo será cadastrado como um conteúdo individual e receberá automaticamente o nome antes de .png, .jpg ou .jpeg.</p>
      <div className="form-cont" style={{ marginTop: 12 }}>
        <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple
          aria-label="Selecionar várias imagens PNG ou JPG" disabled={enviando} onChange={selecionar} />
        {arquivos.length > 0 && (
          <>
            <div className="chips">
              <button type="button" className={'chip' + (todasIA ? ' on' : '')}
                disabled={enviando} onClick={() => definirTodos(true)}>Todas são IA</button>
              <button type="button" className={'chip' + (todasReais ? ' on' : '')}
                disabled={enviando} onClick={() => definirTodos(false)}>Todas são reais</button>
            </div>
            <p className="mut">{concluidos} de {arquivos.length} cadastrado(s). Confira o nome e a classificação de cada imagem antes de enviar.</p>
            <div className="lote-lista">
              {arquivos.map((item) => (
                <div className="lote-item" key={item.id}>
                  <p className="lote-original" title={item.arquivo.name}>{item.arquivo.name}</p>
                  <label className="lote-nome">
                    <span>Nome interno</span>
                    <input value={item.titulo} disabled={enviando || item.status === 'sucesso'}
                      onChange={(e) => atualizar(item.id, { titulo: e.target.value })} />
                  </label>
                  <div className="chips">
                    <button type="button" className={'chip' + (item.ia ? ' on' : '')}
                      disabled={enviando || item.status === 'sucesso'}
                      onClick={() => atualizar(item.id, { ia: true })}>IA</button>
                    <button type="button" className={'chip' + (!item.ia ? ' on' : '')}
                      disabled={enviando || item.status === 'sucesso'}
                      onClick={() => atualizar(item.id, { ia: false })}>Real</button>
                    <span className={'lote-status ' + item.status}>
                      {item.status === 'pendente' ? 'Aguardando' :
                        item.status === 'enviando' ? 'Enviando…' :
                        item.status === 'sucesso' ? 'Cadastrada' : 'Falhou'}
                    </span>
                  </div>
                  {item.erro && <p className="erro" role="alert">{item.erro}</p>}
                </div>
              ))}
            </div>
            <button type="button" className="cta" disabled={enviando || !pendentes}
              onClick={importar}>
              {enviando ? `Enviando… ${concluidos}/${arquivos.length}` :
                pendentes ? `Cadastrar ${pendentes} imagem(ns)` : 'Todas cadastradas'}
            </button>
            <button type="button" className="link" disabled={enviando}
              onClick={() => { setArquivos([]); setAviso(''); }}>Limpar lista</button>
          </>
        )}
        {aviso && <p className="mut" role="status">{aviso}</p>}
      </div>
    </section>
  );
}

function ImportacaoTextosEmLote({ recarregar }) {
  const [entrada, setEntrada] = useState('');
  const [textos, setTextos] = useState([]);
  const [errosAnalise, setErrosAnalise] = useState([]);
  const [analisado, setAnalisado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const atualizar = (id, alteracoes) => setTextos((atual) =>
    atual.map((item) => item.id === id ? { ...item, ...alteracoes } : item));

  const concluidos = textos.filter((item) => item.status === 'sucesso').length;
  const pendentes = textos.filter((item) => item.status !== 'sucesso').length;
  const temSalvos = concluidos > 0;
  const todasIA = textos.length > 0 && textos.every((item) => item.ia === true);
  const todasReais = textos.length > 0 && textos.every((item) => item.ia === false);

  function alterarEntrada(valor) {
    setEntrada(valor);
    setTextos([]);
    setErrosAnalise([]);
    setAnalisado(false);
    setAviso('');
  }

  function analisar() {
    const { itens, erros } = analisarTextosEmLote(entrada);
    setTextos(itens.map((item, i) => ({
      ...item, id: `texto-${item.numero}-${i}`, ia: null, status: 'pendente', erro: '',
    })));
    setErrosAnalise(erros);
    setAnalisado(true);
    setAviso('');
  }

  function definirTodos(ia) {
    setTextos((atual) => atual.map((item) =>
      item.status === 'sucesso' ? item : { ...item, ia }));
  }

  function novaImportacao() {
    setEntrada('');
    setTextos([]);
    setErrosAnalise([]);
    setAnalisado(false);
    setAviso('');
  }

  async function importar() {
    if (enviando || errosAnalise.length) return;
    const aEnviar = textos.filter((item) => item.status !== 'sucesso');
    if (!aEnviar.length || aEnviar.some((item) => !item.texto.trim() || typeof item.ia !== 'boolean')) return;
    setEnviando(true);
    setAviso('');
    let salvos = 0;
    let falhas = 0;
    try {
      // Sequencial: mostra o resultado de cada texto e permite reenviar somente falhas.
      for (const item of aEnviar) {
        atualizar(item.id, { status: 'enviando', erro: '' });
        try {
          await criarItem('texto', { texto: item.texto, ia: item.ia },
            item.titulo.trim() || `Texto #${item.numero}`, {});
          atualizar(item.id, { status: 'sucesso', erro: '' });
          salvos += 1;
        } catch (erro) {
          atualizar(item.id, { status: 'erro', erro: erro.message || 'Erro desconhecido.' });
          falhas += 1;
        }
      }
      setAviso(`${salvos} texto(s) cadastrado(s) nesta tentativa.` +
        (falhas ? ` ${falhas} falha(s). Corrija e tente novamente apenas os que falharam.` : ''));
      if (salvos) recarregar();
    } finally {
      setEnviando(false);
    }
  }

  const textosVazios = textos.some((item) => item.status !== 'sucesso' && !item.texto.trim());
  const semClassificacao = textos.some((item) => item.status !== 'sucesso' && typeof item.ia !== 'boolean');
  const podeEnviar = analisado && textos.length > 0 && !errosAnalise.length && !textosVazios && !semClassificacao && pendentes > 0;

  return (
    <section className="painel larga">
      <h2>Importar textos em lote</h2>
      <p className="mut">Cole vários textos separados por marcadores em linhas próprias, como <code>--- TEXTO #1 ---</code> e <code>--- TEXTO #2 ---</code>. Cada bloco será salvo como um conteúdo de texto individual.</p>
      <div className="form-cont" style={{ marginTop: 12 }}>
        <label className="lote-nome" htmlFor="textos-em-lote">
          <span>Textos para importar (por exemplo, 60 de uma vez)</span>
        </label>
        <textarea id="textos-em-lote" className="textos-colagem" rows="9"
          placeholder={'--- TEXTO #1 ---\nPrimeiro texto aqui.\n\n--- TEXTO #2 ---\nSegundo texto aqui.'}
          value={entrada} disabled={enviando || temSalvos}
          onChange={(e) => alterarEntrada(e.target.value)} />
        {!analisado && (
          <button className="cta" type="button" disabled={!entrada.trim() || enviando}
            onClick={analisar}>Separar e conferir textos</button>
        )}
        {analisado && (
          <>
            <p className="mut" role="status">
              {textos.length} texto(s) identificado(s). {concluidos} cadastrado(s).
              Confira os conteúdos e defina o gabarito (IA ou Real) antes de salvar.
            </p>
            {errosAnalise.length > 0 && (
              <div className="lote-erros" role="alert">
                <b>Corrija a colagem e analise novamente:</b>
                <ul>{errosAnalise.map((erro, i) => <li key={i}>{erro}</li>)}</ul>
              </div>
            )}
            {textos.length > 0 && (
              <>
                <div className="chips">
                  <button type="button" className={'chip' + (todasIA ? ' on' : '')}
                    disabled={enviando || !pendentes} onClick={() => definirTodos(true)}>Todos são IA</button>
                  <button type="button" className={'chip' + (todasReais ? ' on' : '')}
                    disabled={enviando || !pendentes} onClick={() => definirTodos(false)}>Todos são reais</button>
                </div>
                <p className="mut">É possível alternar a classificação individualmente e editar os textos antes do envio. Os itens já cadastrados não serão reenviados.</p>
                {semClassificacao && <p className="aviso" role="status">Defina IA ou Real para cada texto, ou use um dos botões acima para classificar todos.</p>}
                <div className="lote-lista textos-lista">
                  {textos.map((item) => (
                    <div className="lote-item" key={item.id}>
                      <div className="lote-item-topo">
                        <b>Texto #{item.numero}</b>
                        <span className={'lote-status ' + item.status}>
                          {item.status === 'pendente' ? 'Aguardando' :
                            item.status === 'enviando' ? 'Enviando…' :
                            item.status === 'sucesso' ? 'Cadastrado' : 'Falhou'}
                        </span>
                      </div>
                      <label className="lote-nome">
                        <span>Nome interno</span>
                        <input value={item.titulo} disabled={enviando || item.status === 'sucesso'}
                          onChange={(e) => atualizar(item.id, { titulo: e.target.value })} />
                      </label>
                      <p className="texto-previa">{item.texto || '(texto vazio)'}</p>
                      <details className="texto-detalhes">
                        <summary>Conferir ou editar texto completo</summary>
                        <textarea rows="5" value={item.texto}
                          aria-label={`Conteúdo do texto ${item.numero}`}
                          disabled={enviando || item.status === 'sucesso'}
                          onChange={(e) => atualizar(item.id, { texto: e.target.value })} />
                      </details>
                      <div className="chips">
                        <button type="button" className={'chip' + (item.ia === true ? ' on' : '')}
                          disabled={enviando || item.status === 'sucesso'}
                          onClick={() => atualizar(item.id, { ia: true })}>IA</button>
                        <button type="button" className={'chip' + (item.ia === false ? ' on' : '')}
                          disabled={enviando || item.status === 'sucesso'}
                          onClick={() => atualizar(item.id, { ia: false })}>Real</button>
                      </div>
                      {!item.texto.trim() && <p className="erro">O texto não pode ficar vazio.</p>}
                      {item.erro && <p className="erro" role="alert">{item.erro}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <button type="button" className="cta" disabled={enviando || !podeEnviar}
              onClick={importar}>
              {enviando ? `Salvando… ${concluidos}/${textos.length}` :
                pendentes ? `Cadastrar ${pendentes} texto(s)` : 'Todos cadastrados'}
            </button>
          </>
        )}
        <button type="button" className="link" disabled={enviando}
          onClick={novaImportacao}>{temSalvos ? 'Começar outra importação' : 'Limpar e recomeçar'}</button>
        {aviso && <p className="mut" role="status">{aviso}</p>}
      </div>
    </section>
  );
}

function Editor({ it, onChange, tipo, rotulo }) {
  return (
    <div className="editor">
      {rotulo && <h3>{rotulo}</h3>}
      {tipo === 'texto'
        ? <textarea rows="4" placeholder="Cole o texto aqui" value={it.texto} onChange={(e) => onChange({ texto: e.target.value })} />
        : <input type="file" accept={aceita(tipo)} onChange={(e) => onChange({ arq: e.target.files[0] || null })} />}
      <div className="chips">
        <button type="button" className={'chip' + (it.ia ? ' on' : '')} onClick={() => onChange({ ia: true })}>É feito por IA</button>
        <button type="button" className={'chip' + (!it.ia ? ' on' : '')} onClick={() => onChange({ ia: false })}>É real (sem IA)</button>
      </div>
    </div>
  );
}

export default function Conteudos({ lista, comparacoes, recarregar }) {
  const [inventario, setInventario] = useState({ carregando: true, dados: null, erro: '' });
  const consultar = useCallback(async () => {
    setInventario((atual) => ({ ...atual, carregando: true, erro: '' }));
    try {
      const dados = await consultarInventario(supabase);
      setInventario({ carregando: false, dados, erro: '' });
    } catch (e) {
      setInventario({ carregando: false, dados: null, erro: e.message || 'Falha ao consultar inventário.' });
    }
  }, []);
  // Toda entrada na aba Conteúdos força leitura direta das tabelas, sem depender
  // da RPC admin_dados nem de um evento em tempo real de respostas.
  useEffect(() => { void consultar(); }, [consultar]);
  async function atualizarTudo() {
    await Promise.allSettled([recarregar(), consultar()]);
  }
  const leituraOk = Boolean(inventario.dados);
  const listaAtual = inventario.dados?.conteudos || lista;
  const comparacoesAtual = inventario.dados?.comparacoes || comparacoes;
  const [modo, setModo] = useState('indiv');
  const [tipo, setTipo] = useState('imagem');
  const [titulo, setTitulo] = useState('');
  const [itens, setItens] = useState([vazio(), vazio()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [classeExcluir, setClasseExcluir] = useState('todos');
  const [excluindoTextos, setExcluindoTextos] = useState(false);
  const [previaTextos, setPreviaTextos] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [forcarTextos, setForcarTextos] = useState(false);
  const [confirmacaoTextos, setConfirmacaoTextos] = useState('');
  const [resultadoExclusao, setResultadoExclusao] = useState('');
  const fraseObrigatoria = forcarTextos ? 'EXCLUIR TEXTOS E RESPOSTAS' : 'EXCLUIR TEXTOS';

  async function consultarExclusao() {
    setCarregandoPrevia(true); setPreviaTextos(null); setResultadoExclusao('');
    setForcarTextos(false); setConfirmacaoTextos('');
    try {
      const {data,error} = await supabase.rpc('admin_previa_exclusao_textos_v15',{p_classe:classeExcluir});
      if (error) throw error;
      setPreviaTextos(data);
    } catch(e) {
      setResultadoExclusao('Erro ao consultar Supabase: '+(e.message||'Falha inesperada')+'. Execute o SQL v15 primeiro.');
    } finally {setCarregandoPrevia(false);}
  }

  async function excluirTextos() {
    if (!previaTextos || !previaTextos.textos) return;
    if (confirmacaoTextos !== fraseObrigatoria) return;
    if (previaTextos.sessoes_afetadas > 0 && !forcarTextos) return;
    setExcluindoTextos(true); setResultadoExclusao('');
    try {
      const {data,error} = await supabase.rpc('admin_excluir_textos_v15',{
        p_classe:classeExcluir,
        p_confirmacao:confirmacaoTextos,
        p_quantidade_esperada:previaTextos.textos,
        p_forcar:forcarTextos,
      });
      if (error) throw error;
      setResultadoExclusao(`${data.textos_excluidos} texto(s) apagado(s) do Supabase. ${data.respostas_excluidas} respostas vinculadas removidas. ${data.sessoes_afetadas} sessões excluídas da análise oficial.`);
      setPreviaTextos(null); setConfirmacaoTextos(''); setForcarTextos(false);
      await atualizarTudo();
    } catch(e) {
      setResultadoExclusao('Exclusão NÃO concluída: '+(e.message||'Erro inesperado')+'. Nenhuma exclusão parcial é confirmada. Confira a prévia novamente.');
    } finally {setExcluindoTextos(false);}
  }

  const setItem = (k) => (p) => setItens((a) => a.map((x, n) => (n === k ? { ...x, ...p } : x)));
  const n = modo === 'indiv' ? 1 : 2;
  const completo = itens.slice(0, n).every((it) => (tipo === 'texto' ? it.texto.trim() : it.arq));

  async function salvar(e) {
    e.preventDefault();
    if (modo === 'comp' && tipo === 'audio') { setMsg('Áudios não podem ser cadastrados como comparações. O cadastro individual continua disponível.'); return; }
    setBusy(true); setMsg('');
    const form = e.target; let compId = null;
    try {
      if (modo === 'indiv') await criarItem(tipo, itens[0],
        titulo || (tipo === 'imagem' ? nomeSemExtensao(itens[0].arq.name) : null), {});
      else {
        const c = await supabase.from('comparacoes').insert({ tipo }).select('id').single();
        if (c.error) throw c.error;
        compId = c.data.id;
        for (let k = 0; k < 2; k++) await criarItem(tipo, itens[k],
          titulo ? `${titulo}-${k + 1}` : (tipo === 'imagem' ? nomeSemExtensao(itens[k].arq.name) : null),
          { comparacao_id: compId, posicao: k + 1 });
      }
      setItens([vazio(), vazio()]); setTitulo(''); form.reset();
      setMsg('Adicionado.'); await atualizarTudo();
    } catch (err) {
      if (compId) await supabase.from('comparacoes').delete().eq('id', compId);
      setMsg(err.message || 'Erro ao salvar.');
    } finally { setBusy(false); }
  }

  async function apagar(tabela, id) {
    if (!confirm('Apagar? As respostas dadas a isso também serão apagadas.')) return;
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) setMsg(error.message); else await atualizarTudo();
  }

  const inventarioAgrupado = agruparInventario(listaAtual, comparacoesAtual);
  const indiv = inventarioAgrupado.individuais;
  const comps = inventarioAgrupado.comparacoes;

  return (
    <div className="grade">
      <section className="painel">
        <h2>Adicionar</h2>
        <form className="form-cont" onSubmit={salvar}>
          <div className="chips">
            <button type="button" className={'chip' + (modo === 'indiv' ? ' on' : '')} onClick={() => setModo('indiv')}>Individual (parte 1)</button>
            <button type="button" className={'chip' + (modo === 'comp' ? ' on' : '')} onClick={() => { setModo('comp'); if (tipo === 'audio') { setTipo('imagem'); setItens([vazio(), vazio()]); } }}>Comparação (parte 2)</button>
          </div>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setItens([vazio(), vazio()]); }}>
            {Object.entries(TIPOS).filter(([k]) => modo !== 'comp' || k !== 'audio').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {modo === 'comp' && <p className="mut">Comparações aceitam imagens, textos e vídeos. Áudios permanecem somente na modalidade individual.</p>}
          <input placeholder="Nome interno (imagem: automático se vazio)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          {itens.slice(0, n).map((it, k) => (
            <Editor key={tipo + modo + k} it={it} tipo={tipo} onChange={setItem(k)} rotulo={modo === 'comp' ? `Conteúdo ${k + 1}` : null} />
          ))}
          {msg && <p className="mut">{msg}</p>}
          <button className="cta" disabled={busy || !completo}>{busy ? 'Enviando…' : 'Adicionar'}</button>
        </form>
      </section>

      <ImportarComparacoesTxt recarregar={atualizarTudo} />

      <ImportarComparacoesZip recarregar={atualizarTudo} />

      <ImportacaoEmLote recarregar={atualizarTudo} />

      <OtimizarImagensExistentes recarregar={atualizarTudo} />

      <ImportacaoTextosEmLote recarregar={atualizarTudo} />

      <RevisarTextosExistentes recarregar={atualizarTudo} />

      <ImportarAudiosHumanosPorGrupo recarregar={atualizarTudo} />

      <ImportacaoMidiasEmLote tipo="audio" recarregar={atualizarTudo} />

      <NormalizarAudios recarregar={atualizarTudo} />

      <ImportacaoMidiasEmLote tipo="video" recarregar={atualizarTudo} />

      <section className="painel">
        <div className="comparacoes-contagem-cabecalho">
          <h2>Cobertura por tipo</h2>
          <button type="button" className="chip" onClick={atualizarTudo} disabled={inventario.carregando}>
            {inventario.carregando ? 'Consultando…' : 'Atualizar contagens'}
          </button>
        </div>
        {inventario.carregando && <p className="mut" role="status">Conferindo comparações e gabaritos diretamente no Supabase…</p>}
        {inventario.erro && <p className="erro" role="alert">Não foi possível conferir as comparações diretamente. {inventario.erro} Os números de comparação estão indisponíveis até corrigir a leitura.</p>}
        {leituraOk && <p className="mut" role="status">Contagem conferida nas tabelas do Supabase. Inclui comparações ativas e inativas.</p>}
        <div className="rolagem">
          <table>
            <thead><tr><th>Tipo</th><th>Individuais</th><th>Comparações</th></tr></thead>
            <tbody>
              {Object.entries(TIPOS).map(([k, v]) => {
                const i = indiv.filter((c) => c.tipo === k), cc = comps.filter((c) => c.tipo === k);
                const incompletas = cc.filter((c) => !c.completo).length;
                return (
                  <tr key={k}>
                    <td><b>{v}</b></td>
                    <td>{!leituraOk ? '—' : `${i.length} (${i.filter((c) => c.eh_ia === true).length} IA · ${i.filter((c) => c.eh_ia === false).length} real${i.some((c) => c.eh_ia === null) ? ` · ${i.filter((c) => c.eh_ia === null).length} sem gabarito` : ''})`}</td>
                    <td className="cobertura-resumo">{!leituraOk ? '— (aguardando consulta)' : <div className="cobertura-valores">
                      <strong>{cc.length} comparação(ões)</strong>
                      <span>{[0, 1, 2].map((q) => `${cc.filter((c) => c.completo && c.nIA === q).length} ${CEN[q]}`).join(' · ')}</span>
                      <small>{cc.filter((c) => c.ativo).length} ativa(s){incompletas ? ` · ${incompletas} incompleta(s)` : ''}</small>
                    </div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="painel larga" aria-labelledby="titulo-exclusao-textos">
        <h2 id="titulo-exclusao-textos">Excluir textos definitivamente</h2>
        <div className="excluir-textos-lote v15-exclusao">
          <p>Remove os textos <strong>do banco de dados</strong>, incluindo textos individuais e de comparações. Imagens, áudios e vídeos são preservados. A instalação do SQL não exclui nada.</p>
          <label htmlFor="classe-textos-excluir"><strong>Escolha o grupo</strong></label>
          <select id="classe-textos-excluir" value={classeExcluir} disabled={excluindoTextos||carregandoPrevia}
            onChange={e=>{setClasseExcluir(e.target.value);setPreviaTextos(null);setConfirmacaoTextos('');setForcarTextos(false);setResultadoExclusao('');}}>
            <option value="todos">Todos os textos (IA e humanos)</option>
            <option value="ia">Somente textos de IA</option>
            <option value="humano">Somente textos humanos/reais</option>
          </select>
          <button type="button" className="chip v15-previa-botao" onClick={consultarExclusao} disabled={carregandoPrevia||excluindoTextos}>
            {carregandoPrevia?'Consultando o banco…':'1. Consultar quantidade e impacto no Supabase'}
          </button>
          {previaTextos&&<div className="v15-exclusao-previa" aria-live="polite">
            <strong>Prévia confirmada pelo banco</strong>
            <div className="v15-contagens">
              <span><b>{previaTextos.textos}</b> texto(s)</span>
              <span><b>{previaTextos.comparacoes}</b> comparação(ões)</span>
              <span><b>{previaTextos.sessoes_afetadas}</b> sessão(ões) vinculadas</span>
              <span><b>{previaTextos.respostas_individuais+previaTextos.respostas_comparacoes}</b> resposta(s) vinculadas</span>
            </div>
            {previaTextos.textos_restantes_na_mesma_dupla>0&&<p className="mut">Alguns pares mistos perderão uma peça e ficarão desativados; os outros textos não serão apagados.</p>}
            {previaTextos.sessoes_em_andamento>0&&<p className="erro">Atenção: {previaTextos.sessoes_em_andamento} sessão(ões) em andamento serão afetadas. Faça a exclusão antes de abrir a pesquisa ao público.</p>}
            {previaTextos.sessoes_afetadas>0&&<label className="v15-check-destrutivo">
              <input type="checkbox" checked={forcarTextos} onChange={e=>{setForcarTextos(e.target.checked);setConfirmacaoTextos('');}}/>
              <span>Entendo que as respostas/rodadas vinculadas serão excluídas e as sessões afetadas serão marcadas fora da análise oficial. Fiz backup.</span>
            </label>}
            {previaTextos.textos>0&&<>
              <label htmlFor="confirmacao-textos-v15">2. Digite <strong>{fraseObrigatoria}</strong> para confirmar</label>
              <input id="confirmacao-textos-v15" autoComplete="off" spellCheck="false" value={confirmacaoTextos} onChange={e=>setConfirmacaoTextos(e.target.value)} placeholder={fraseObrigatoria}/>
              <button type="button" className="cta v15-botao-perigo" onClick={excluirTextos}
                disabled={excluindoTextos || confirmacaoTextos!==fraseObrigatoria || (previaTextos.sessoes_afetadas>0&&!forcarTextos)}>
                {excluindoTextos?'Excluindo no Supabase…':`Excluir definitivamente ${previaTextos.textos} texto(s)`}
              </button>
            </>}
            {!previaTextos.textos&&<p>Não há textos desse grupo no banco.</p>}
          </div>}
          {resultadoExclusao&&<p role="status" className="v15-resultado-exclusao">{resultadoExclusao}</p>}
          <p className="mut">A exclusão é irreversível. Faça um backup antes. Não é necessário apagar participantes inteiros para remover textos, mas qualquer sessão vinculada deixará de ser válida para o relatório oficial.</p>
        </div>
      </section>

      <section className="painel larga">
        <h2>Individuais ({indiv.length})</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Tipo</th><th>Nome</th><th>Gabarito</th><th /></tr></thead>
            <tbody>
              {indiv.map((c) => (
                <tr key={c.id}>
                  <td>{TIPOS[c.tipo]}</td><td>{c.titulo || '—'}</td>
                  <td><span className={'sel ' + (c.eh_ia === true ? 'ia' : 'real')}>{c.eh_ia === null ? 'Sem gabarito' : c.eh_ia ? 'IA' : 'Real'}</span></td>
                  <td><button className="link" onClick={() => apagar('conteudos', c.id)}>Apagar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 style={{ marginTop: 20 }}>Comparações ({leituraOk ? comps.length : '—'})</h2>
        {leituraOk && comps.length === 0 && <p className="mut">O Supabase retornou zero registros na tabela <code>comparacoes</code>. Se você já importou comparações, confira o resultado da importação e o projeto Supabase conectado. O arquivo <code>supabase/DIAGNOSTICO_V16_2_CONTAGEM_COMPARACOES.sql</code> permite confirmar sem alterar dados.</p>}
        {leituraOk && inventarioAgrupado.orfaos.length > 0 && <p className="erro">Foram encontrados {inventarioAgrupado.orfaos.length} ID(s) de comparação nos conteúdos sem registro correspondente em comparacoes.</p>}
        <div className="rolagem">
          <table>
            <thead><tr><th>Tipo</th><th>Itens</th><th>Gabarito</th><th /></tr></thead>
            <tbody>
              {leituraOk && comps.map((c) => (
                <tr key={c.id}>
                  <td>{TIPOS[c.tipo]}{!c.ativo ? ' (inativa)' : ''}</td>
                  <td>{c.itens.map((x) => x.titulo || '—').join(' | ') || 'Nenhum item vinculado'}</td>
                  <td><span className="sel real">{c.completo ? CEN[c.nIA] : `Incompleta (${c.nItens}/2 itens; ${c.nSemGabarito} sem gabarito)`}</span></td>
                  <td><button className="link" onClick={() => apagar('comparacoes', c.id)}>Apagar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
