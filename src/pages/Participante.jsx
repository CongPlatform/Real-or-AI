import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { gerarStoryResultado, nomeArquivoStories, baixarBlob, compartilharImagem } from '../lib/storyResultado';
import { FAIXAS, GENEROS, ESCOLARIDADES, FREQ, USOS, TIPOS } from '../lib/opcoes';
import SwipeCard from '../components/SwipeCard';
import Midia from '../components/Midia';
import { idsEscolhidosComoIA } from '../lib/respostaComparacao';
import { prepararImagensDaSessao, anteciparProximasImagens } from '../lib/precarregarMidias';
import { prepararProximoAudio } from '../lib/precarregarAudios';

const LS = 'realia_v3';
const ler = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const salvar = (d) => { try { localStorage.setItem(LS, JSON.stringify({ ...ler(), ...d })); } catch { /* ignora */ } };
// Quando o Admin limpa os participantes, o ID salvo neste navegador deixa de existir.
// Limpa APENAS a identificação local; não interfere nos arquivos ou em outros participantes.
const limparSessaoLocal = () => { try { localStorage.removeItem(LS); } catch { /* ignora */ } };
const sessaoLocalInvalida = (erro) => {
  const mensagem = String(erro?.message || erro || '').toLowerCase();
  return mensagem.includes('participante não encontrado ou teste já finalizado')
    || mensagem.includes('participante nao encontrado ou teste ja finalizado')
    || mensagem.includes('participante inválido')
    || mensagem.includes('participante invalido');
};

const PERGUNTAS = [
  { k: 'faixa', t: 'Qual a sua idade?', op: FAIXAS },
  { k: 'genero', t: 'Qual o seu gênero?', op: GENEROS },
  { k: 'esc', t: 'Qual a sua escolaridade?', d: 'Marque o nível em que você está agora (cursando) ou o maior que você já concluiu.', op: ESCOLARIDADES },
  { k: 'freq', t: 'Com que frequência você usa IA?', op: FREQ },
  { k: 'usos', t: 'Você usa IA para quê?', d: 'Você pode marcar mais de uma opção.', op: USOS, multi: true },
  { k: 'conf', t: 'Quão bem você acha que reconhece conteúdo feito por IA?', d: '1 = nada, 5 = muito bem', op: [1, 2, 3, 4, 5] },
];

function Chips({ valor, onChange, opcoes, multi }) {
  const on = (o) => (multi ? valor.includes(o) : valor === o);
  const clicar = (o) => {
    if (!multi) return onChange(o);
    if (o === 'Nenhum') return onChange(on(o) ? [] : ['Nenhum']);
    const sem = valor.filter((v) => v !== 'Nenhum');
    onChange(sem.includes(o) ? sem.filter((v) => v !== o) : [...sem, o]);
  };
  return (
    <div className="chips grande">
      {opcoes.map((o) => (
        <button type="button" key={o} className={'chip' + (on(o) ? ' on' : '')} onClick={() => clicar(o)}>{o}</button>
      ))}
    </div>
  );
}

function Wizard({ onFim, busy, erro, configuracoes }) {
  const [modo,setModo]=useState(null);
  const disponiveis=configuracoes.filter(c=>c.ativo);
  const [i, setI] = useState(-1);
  const [r, setR] = useState({ faixa: '', genero: '', esc: '', freq: '', usos: [], conf: 0 });

  if (i < 0) {
    const selecionado = disponiveis.find(c => c.modo === modo);
    return (
      <main className="tela centro largo inicio-tela v24-home">
        <section className="cartao hero inicio-cartao v24-landing">
          <div className="v24-topbar">
            <span className="v24-brand"><img className="v24-site-icon" src="/favicon-512.png" alt="Ícone oficial Real ou IA?" width="40" height="40" /> REAL OU IA?</span>
            <span className="v24-research">PESQUISA ESCOLAR <span>•</span> MATEMÁTICA AVANÇADA</span>
          </div>
          <div className="v24-hero-main">
            <div className="v24-copy">
              <span className="v24-overline"><span className="v23-dot"/> VOCÊ CONFIA NOS SEUS OLHOS?</span>
              <h1>Real <span>ou IA?</span></h1>
              <p className="v24-lead">Nem tudo é o que parece.<br/><strong>Você consegue descobrir a diferença?</strong></p>
              <p className="v24-desc">Explore imagens, textos, vídeos e áudios. Decida o que foi criado por uma pessoa e o que veio da inteligência artificial.</p>
              <div className="v24-stats"><span><b>04</b> tipos de conteúdo</span><span><b>02</b> formas de jogar</span><span><b>100%</b> anônimo</span></div>
            </div>
            <div className="v24-poster" aria-hidden="true">
              <div className="v24-noise"/>
              <span className="v24-poster-label">QUEM CRIOU?</span>
              <div className="v24-poster-faces"><div className="v24-human"><span>◉</span><strong>HUMANO</strong></div><span className="v24-poster-versus">VS</span><div className="v24-ai"><span>✦</span><strong>IA</strong></div></div>
              <span className="v24-poster-foot">OLHE DE NOVO ↗</span>
            </div>
          </div>
          <div className="v24-choose" id="escolha-do-teste">
            <div className="v24-choose-head"><div><span className="v24-section-kicker">PASSO 01</span><h2>Escolha seu desafio</h2><p>O objetivo é o mesmo. Você escolhe até onde quer ir.</p></div><span className="v24-arrow" aria-hidden="true">↘</span></div>
            <div className="v24-options">{disponiveis.map(c => {
              const curto = c.modo !== 'completo';
              return <button key={c.modo} type="button" aria-pressed={modo === c.modo} className={'v24-option '+(curto?'v24-short ':'v24-full ')+(modo === c.modo ? 'v24-selected' : '')} onClick={() => setModo(c.modo)}>
                <span className="v24-option-top"><span className="v24-option-tag">{curto?'RÁPIDO E DIRETO':'EXPERIÊNCIA COMPLETA'}</span><span className="v24-radio">{modo === c.modo?'✓':''}</span></span>
                <span className="v24-option-row"><strong>{c.individuais+c.comparacoes}</strong><span>questões</span></span>
                <span className="v24-option-name">{curto?'Teste reduzido':'Teste completo'}</span>
                <span className="v24-option-detail">{c.individuais} individuais <span>+</span> {c.comparacoes} comparações</span>
                <span className="v24-option-bottom">{modo === c.modo?'Selecionado ✓':'Escolher este desafio ↗'}</span>
              </button>;
            })}</div>
            <button type="button" className="cta v24-start" disabled={!selecionado || busy} onClick={() => setI(0)}>{selecionado ? `Começar teste de ${selecionado.individuais+selecionado.comparacoes} questões`:'Selecione um desafio para começar'} <span aria-hidden="true">→</span></button>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <p className="v24-micro"><span>◇</span> Primeiro, seis perguntas rápidas sobre você. Nenhum dado pessoal de identificação é solicitado.</p>
          </div>
          <details className="v24-how"><summary>O que conta como conteúdo de IA? <span>＋</span></summary><p>Consideramos a origem do <strong>conteúdo final</strong>. Um vídeo com roteiro humano, mas imagens geradas por inteligência artificial, por exemplo, é classificado como IA. O mesmo critério vale para áudios, textos e imagens.</p></details>
          <div className="v24-footer"><span>REAL OU IA? · UMA PESQUISA SOBRE PERCEPÇÃO</span><span>CRIADO PARA FAZER VOCÊ QUESTIONAR O ÓBVIO.</span></div>
        </section>
      </main>
    );
  }

  const p = PERGUNTAS[i];
  const ultima = i === PERGUNTAS.length - 1;
  const val = r[p.k];
  const ok = p.multi ? val.length > 0 : !!val;
  const escolher = (v) => {
    setR((x) => ({ ...x, [p.k]: v }));
    if (!p.multi && !ultima) setTimeout(() => setI((n) => (n === i ? i + 1 : n)), 220);
  };

  return (
    <div className="tela centro largo">
      <div className="cartao">
        <div className="passo">
          <div className="barra"><i style={{ width: `${((i + 1) / PERGUNTAS.length) * 100}%` }} /></div>
          <span>{i + 1}/{PERGUNTAS.length}</span>
        </div>
        <h2 className="pergunta">{p.t}</h2>
        {p.d && <p className={p.multi ? 'aviso' : 'mut'}>{p.d}</p>}
        <Chips valor={val} onChange={escolher} opcoes={p.op} multi={p.multi} />
        {erro && <p className="erro">{erro}</p>}
        <div className="nav">
          <button className="link" onClick={() => setI(i - 1)}>Voltar</button>
          {(p.multi || ultima) && (
            <button className="cta" disabled={!ok || busy} onClick={() => (ultima ? onFim({...r,modo}) : setI(i + 1))}>
              {ultima ? (busy ? 'Carregando…' : 'Ir para o teste') : 'Continuar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ParteIntro({ titulo, texto, onOk }) {
  return (
    <div className="tela centro largo">
      <div className="cartao">
        <h2 className="pergunta">{titulo}</h2>
        {titulo.includes('Parte 2') && <div className="v23-alerta" role="note"><span className="v23-alerta-icone" aria-hidden="true">!</span><div><strong>ATENÇÃO: LEIA A PERGUNTA ANTES DE RESPONDER!</strong><p>Uma questão pode pedir quais conteúdos são de <b>IA</b> e outra pode pedir quais foram feitos por <b>humanos</b>. Sua resposta precisa seguir exatamente o que o enunciado solicita. Pode ser nenhum, somente um ou ambos!</p></div></div>}
        {texto.map((t, k) => <p key={k} className="mut">{t}</p>)}
        <button className="cta" onClick={onOk}>Continuar</button>
      </div>
    </div>
  );
}

async function adicionarGanhosDeAudio(roteiro) {
  const ids = [...new Set(roteiro.flatMap(r => r.kind === 'individual' ?
    (r.tipo === 'audio' ? [r.id] : []) :
    (r.conteudos || []).filter(c => c.tipo === 'audio').map(c => c.id)))];
  if (!ids.length) return roteiro;
  const { data, error } = await supabase.from('conteudos').select('id,audio_gain_db').in('id', ids);
  if (error) { console.warn('Ganho dos áudios indisponível:', error.message); return roteiro; }
  const ganhos = new Map((data || []).map(r => [r.id, Number(r.audio_gain_db) || 0]));
  return roteiro.map(r => r.kind === 'individual' ? { ...r, audio_gain_db: ganhos.get(r.id) || 0 } :
    { ...r, conteudos: (r.conteudos || []).map(c => ({ ...c, audio_gain_db: ganhos.get(c.id) || 0 })) });
}

const NOMES = { imagem: 'imagem', texto: 'texto', audio: 'áudio', video: 'vídeo' };
const NOMES_PLURAL = { imagem: 'imagens', texto: 'textos', audio: 'áudios', video: 'vídeos' };

// A resposta armazenada continua sendo booleano 'é IA?', qualquer que seja o enunciado.
// Mostrar Sim/Não apenas quando a própria pergunta é fechada.
function rotulosDaPergunta(enquadramento) {
  if (enquadramento === 'ia') return { ia: 'Sim', humano: 'Não' };
  if (enquadramento === 'humano') return { ia: 'Não', humano: 'Sim' };
  return { ia: 'IA', humano: 'Humano' };
}

function enunciado(individual, origem, tipo) {
  const nome = NOMES[tipo] || 'conteúdo';
  const plu = NOMES_PLURAL[tipo] || 'conteúdos';
  if (individual) {
    if (origem === 'ia') return `Este ${nome} foi gerado por inteligência artificial?`;
    if (origem === 'humano') return `Este ${nome} foi produzido por uma pessoa?`;
    return `Qual é a origem deste ${nome}?`;
  }
  if (origem === 'ia') return `Quais destes ${plu} foram feitos por IA?`;
  if (origem === 'humano') return `Quais destes ${plu} foram produzidos por pessoas?`;
  return `Classifique cada um destes ${plu} de acordo com sua origem.`;
}

function Comparar({ rodada, n, total, onConfirm, busy, erro }) {
  const [escolha, setEscolha] = useState(null);
  const t0 = useRef(performance.now());
  const itens = rodada.conteudos;
  // O enunciado determina qual origem se pede; o RPC SEMPRE recebe IDs marcados IA.
  const buscandoHumanos = rodada.enquadramento === 'humano';
  const alvo = buscandoHumanos ? 'produzidos por humanos' : 'feitos por IA';
  const nome = NOMES_PLURAL[rodada.tipo] || 'conteúdos';
  const feminino = rodada.tipo === 'imagem';
  const destes = feminino ? 'destas' : 'destes';
  const pergunta = buscandoHumanos
    ? `Quais ${destes} ${nome} foram ${feminino ? 'produzidas' : 'produzidos'} por pessoas?`
    : `Quais ${destes} ${nome} foram ${feminino ? 'geradas' : 'gerados'} por IA?`;
  const escolhas = [
    { valor: 'nenhum', titulo: 'Nenhum dos dois', indices: [] },
    { valor: 'primeiro', titulo: 'Somente o conteúdo 1', indices: [0] },
    { valor: 'segundo', titulo: 'Somente o conteúdo 2', indices: [1] },
    { valor: 'ambos', titulo: 'Ambos os conteúdos', indices: [0,1] },
  ];
  function confirmar() {
    if (escolha === null) return;
    const idsIA = idsEscolhidosComoIA(itens, escolha, rodada.enquadramento);
    onConfirm(idsIA, Math.round(performance.now() - t0.current));
  }
  return (
    <div className="comp">
      <header className="topo">
        <div className="barra"><i style={{ width: `${(n / total) * 100}%` }} /></div>
        <span>{n + 1}/{total}</span>
      </header>
      <div className="bloco-pergunta">
        <span className="bloco-pergunta-etiqueta">PARTE 2 DE 2 · COMPARE E DECIDA</span>
        <h2 className="enunciado-teste">{pergunta}</h2>
      </div>
      <p className="mut">Escolha quantos conteúdos correspondem à pergunta. Pode ser nenhum, apenas um ou ambos.</p>
      <div className="comp-grade">
        {itens.map((c, k) => (
          <div className="comp-item" key={c.id}>
            <span className="tag">Conteúdo {k + 1}</span>
            <div className="conteudo"><Midia item={c} /></div>
          </div>
        ))}
      </div>
      <div className="comp-escolhas" role="group" aria-label={`Escolha quais ${nome} são ${alvo}`}>
        {escolhas.map(op => (
          <button type="button" key={op.valor} disabled={busy}
            className={'comp-escolha' + (escolha === op.valor ? ' on' : '')}
            aria-pressed={escolha === op.valor} onClick={() => setEscolha(op.valor)}>
            {op.titulo}
          </button>
        ))}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="cta" disabled={escolha === null || busy} onClick={confirmar}>
        {busy ? 'Salvando…' : 'Confirmar comparação'}
      </button>
    </div>
  );
}

function ResultadoDetalhado({ pid, onVoltar }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    supabase.rpc('resultado_detalhado_v10', { p_participante: pid }).then(({ data, error }) => {
      if (!ativo) return;
      if (error) setErro('Não foi possível recuperar o relatório: ' + error.message);
      else setItens(Array.isArray(data) ? data : []);
    });
    return () => { ativo = false; };
  }, [pid]);
  const textoOrigem = (v) => v ? 'IA' : 'Humano';
  return <div className="tela largo detalhe-tela">
    <div className="cartao">
      <button type="button" className="link" onClick={onVoltar}>← Voltar ao resultado</button>
      <h1 style={{fontSize:'clamp(2rem,6vw,3rem)'}}>Suas respostas</h1>
      <p className="mut">Revise o que você marcou e a origem verdadeira de cada conteúdo. Este relatório só fica disponível após a conclusão.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {!itens && !erro && <p>Carregando suas respostas…</p>}
      {itens?.length === 0 && <p>Nenhuma resposta detalhada disponível.</p>}
      <div className="detalhe-lista">
      {itens?.map((it, n) => <article className="detalhe-item" key={`${it.id}-${n}`}>
        <div className="detalhe-topo"><strong>{n+1}. {TIPOS[it.tipo] || it.tipo}</strong>
          <b className={it.acertou ? 'detalhe-acerto' : 'detalhe-erro'}>{it.acertou ? '✓ Acertou' : '✕ Errou'}</b></div>
        {it.tipo === 'imagem' && it.url && <img className="m-img" loading="lazy" src={it.url} alt="Imagem avaliada" />}
        {it.tipo === 'texto' && <p className="m-texto">{it.texto}</p>}
        {it.tipo === 'audio' && it.url && <audio controls preload="none" src={it.url} />}
        {it.tipo === 'video' && it.url && <video controls preload="none" playsInline src={it.url} />}
        <div className="detalhe-respostas"><span>Sua resposta: <b>{textoOrigem(it.resposta_ia)}</b></span>
          <span>Origem correta: <b>{textoOrigem(it.eh_ia)}</b></span></div>
        {it.comparacao && <small>Item de comparação</small>}
      </article>)}
      </div>
    </div>
  </div>;
}

function Fim({ pid, total }) {
  const [res, setRes] = useState(ler().resultado || null);
  const [est, setEst] = useState(Math.round(total / 2));
  const [busy, setBusy] = useState(false);
  const [detalhado, setDetalhado] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [menuAlternativo, setMenuAlternativo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [gerandoStory, setGerandoStory] = useState(false);
  const [erroStory, setErroStory] = useState('');
  const chaveCompartilhamento = `realia_resultado_compartilhado_v16_${pid || 'sem_id'}`;
  const [liberado, setLiberado] = useState(() => {
    try { return Boolean(pid && localStorage.getItem(`realia_resultado_compartilhado_v16_${pid}`) === '1'); }
    catch { return false; }
  });

  function liberarResultado() {
    setLiberado(true);
    try { localStorage.setItem(chaveCompartilhamento, '1'); } catch { /* navegador sem storage */ }
  }

  function compartilhar() {
    // Chamada síncrona no clique para preservar a ativação de usuário.
    // A pontuação só aparece depois de ENCERRADA a janela de compartilhamento.
    const url = window.location.origin + window.location.pathname;
    const dados = { title: 'Real ou IA?', text: 'Eu participei do Real ou IA? Você consegue identificar quais conteúdos foram feitos por inteligência artificial? Faça o teste também!', url };
    setShareMsg('');
    if (typeof navigator.share === 'function') {
      setCompartilhando(true);
      try {
        Promise.resolve(navigator.share(dados)).then(() => {
          liberarResultado();
        }).catch(e => {
          if (e?.name === 'AbortError') {
            // Fechar a janela (inclusive sem escolher um aplicativo) conclui esta etapa.
            liberarResultado();
          } else {
            setShareMsg('Seu navegador não abriu o compartilhamento. Escolha uma das opções abaixo.');
            setMenuAlternativo(true);
          }
        }).finally(() => setCompartilhando(false));
      } catch {
        setCompartilhando(false);
        setShareMsg('Escolha uma opção de compartilhamento.');
        setMenuAlternativo(true);
      }
      return;
    }
    setMenuAlternativo(true);
  }

  function fecharMenuAlternativo() {
    setMenuAlternativo(false);
    liberarResultado();
  }

  async function copiarLink() {
    const url = window.location.origin + window.location.pathname;
    try { await navigator.clipboard.writeText(url); setShareMsg('Link copiado!'); }
    catch { setShareMsg(`Copie o link: ${url}`); }
  }

  async function ver() {
    setBusy(true);
    const { data, error } = await supabase.rpc('finalizar_participante_v3', { p_participante: pid, p_estimativa: est });
    setBusy(false);
    if (error) return alert('Não foi possível enviar. Tente de novo.');
    // Resultado, estimativa e denominadores vêm da mesma resposta do servidor.
    const r = { ...data, estimativa: data?.estimativa ?? est };
    salvar({ resultado: r, concluido: true, estimativa: r.estimativa, nDecisoes: Number(r.total || 0) + Number(r.comp?.total || 0) });
    setRes(r);
  }

  if (!res) {
    return <div className="tela centro largo"><div className="cartao">
      <h2 className="pergunta">Última pergunta</h2>
      <p className="mut">Considerando todas as {total} decisões (classificações individuais e comparações), quantas você acha que acertou? Cada comparação conta como um acerto somente quando as duas peças estão corretas.</p>
      <div className="estima"><b>{est}</b><span>de {total}</span></div>
      <input type="range" min="0" max={total} value={est} onChange={e=>setEst(+e.target.value)}/>
      <button className="cta" disabled={busy} onClick={ver}>{busy?'Enviando…':'Concluir minha participação'}</button>
    </div></div>;
  }

  if (!liberado) return <div className="tela centro largo"><div className="cartao v16-share-porta">
    <span className="v16-share-etiqueta">TESTE CONCLUÍDO</span>
    <div className="v16-share-simbolo" aria-hidden="true">✓</div>
    <h1>Você chegou ao final!</h1>
    <p>Compartilhe o desafio com um amigo e descubra quantas respostas você acertou, inclusive em cada comparação.</p>
    <button className="cta" type="button" onClick={compartilhar} disabled={compartilhando}>{compartilhando ? 'Aguardando fechar o compartilhamento…' : 'Compartilhar e ver meus resultados'}</button>
    {menuAlternativo && <div className="v18-share-menu" role="dialog" aria-label="Opções de compartilhamento">
      <h2>Compartilhe o desafio</h2>
      <a href={`https://wa.me/?text=${encodeURIComponent('Eu fiz o teste Real ou IA? Faça também: '+window.location.origin+window.location.pathname)}`} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
      <button type="button" onClick={copiarLink}>Copiar link da pesquisa</button>
      {shareMsg && <p className="mut" role="status">{shareMsg}</p>}
      <button type="button" className="cta" onClick={fecharMenuAlternativo}>Fechar compartilhamento e ver resultados</button>
    </div>}
    <span className="v16-share-caption">Seu teste já foi salvo. Os resultados aparecerão depois que as opções de compartilhamento forem fechadas.</span>
  </div></div>;

  const acertosInd = Number(res.acertos) || 0;
  const totalInd = Number(res.total) || 0;
  const acertosComp = Number(res.comp?.acertos) || 0;
  const totalComp = Number(res.comp?.total) || 0;
  const acertosGerais = acertosInd + acertosComp;
  const totalGeral = totalInd + totalComp;
  const pct = Math.round((100 * acertosGerais) / Math.max(totalGeral, 1));
  // Estimativa só é exibida quando tem origem na mesma sessão e base validada.
  // Resultados antigos sem metadados suficientes não recebem estimativas de outras sessões.
  const estimativaBaseSalva = Number(res.base_decisoes ?? totalGeral);
  const estimativaOriginal = res.estimativa;
  const estimativaSalva = estimativaOriginal != null && estimativaOriginal !== '' && Number.isInteger(Number(estimativaOriginal))
    && estimativaBaseSalva === totalGeral && Number(estimativaOriginal) >= 0 && Number(estimativaOriginal) <= totalGeral
    ? Number(estimativaOriginal) : null;
  const contagemDivergente = res.rodadas_sorteadas != null && Number(res.rodadas_sorteadas) !== totalGeral;
  async function imagemStories(compartilharArquivo = false) {
    setGerandoStory(true); setErroStory('');
    try {
      const valores = {
        acertosGerais, totalGeral,
        acertosInd, totalInd,
        acertosComp, totalComp,
        estimativa: estimativaSalva,
        estimativaBase: estimativaBaseSalva,
        porTipo: res.por_tipo || {},
        url: 'real-ou-ia.cong.com.br',
      };
      const { blob } = await gerarStoryResultado(valores);
      const nome = nomeArquivoStories(valores);
      if (compartilharArquivo) {
        const sucesso = await compartilharImagem(blob, nome);
        if (!sucesso) { baixarBlob(blob, nome); setErroStory('A imagem foi baixada. Abra o Instagram e adicione-a ao seu Story.'); }
      } else baixarBlob(blob, nome);
    } catch(e) {
      setErroStory('Não foi possível gerar a imagem neste navegador. Tente atualizar a página.');
    } finally { setGerandoStory(false); }
  }
  if (detalhado) return <ResultadoDetalhado pid={pid} onVoltar={() => setDetalhado(false)} />;
  const url = window.location.origin + window.location.pathname;
  return <div className="tela centro largo"><div className="cartao">
    <h2 className="pergunta">Seu resultado</h2>
    {contagemDivergente && <p className="erro" role="alert">Atenção: o banco registra {res.rodadas_sorteadas} decisões sorteadas, mas só {totalGeral} respostas foram contabilizadas. A pontuação precisa ser conferida antes do compartilhamento.</p>}
    <div className="resultado"><b>{pct}%</b><span>Total: {acertosGerais} acertos em {totalGeral} decisões{totalComp>0?' (Parte 1 + Parte 2)':''}</span></div>
    {estimativaSalva === null && <p className="mut">Estimativa anterior indisponível: não foi possível confirmar que pertence a esta sessão.</p>}
    <div className={'v23-resultados-partes'+(totalComp===0?' v23-resultados-partes-uma':'' )}>
      <div className="v23-result-parte"><span>PARTE 1 · INDIVIDUAIS</span><strong>{totalInd ? Math.round(100*acertosInd/totalInd) : 0}%</strong><p>{acertosInd} acertos de {totalInd} questões</p></div>
      {totalComp > 0 && <div className="v23-result-parte"><span>PARTE 2 · COMPARAÇÕES</span><strong>{Math.round(100*acertosComp/Math.max(totalComp,1))}%</strong><p>{acertosComp} acertos de {totalComp} comparações</p></div>}
    </div>
    <div className="tipos">{Object.entries(res.por_tipo || {}).map(([t,v]) => <div key={t} className="linha-tipo">
      <span>{TIPOS[t] || t}</span><div className="barra"><i style={{width:`${v.total ? 100*v.acertos/v.total : 0}%`}}/></div><em>{v.acertos}/{v.total}</em>
    </div>)}</div>
    {res.comp?.total > 0 && <p className="mut">Parte 2: você acertou as duas peças em {res.comp.acertos} de {res.comp.total} comparações.</p>}
    <div className="v23-stories"><div><strong>Seu resultado merece um Story!</strong><p>Crie uma imagem vertical 1080 × 1920 com seus acertos nas duas partes e convide seus amigos a participar.</p></div><div className="v23-stories-acoes"><button type="button" className="cta" disabled={gerandoStory || contagemDivergente} onClick={()=>imagemStories(false)}>{gerandoStory?'Gerando imagem…':'↓ Baixar imagem para Stories'}</button><button type="button" className="v16-share-sec" disabled={gerandoStory || contagemDivergente} onClick={()=>imagemStories(true)}>Compartilhar imagem</button></div>{erroStory && <p role="status">{erroStory}</p>}</div>
    <div className="detalhe-acoes">
      <button type="button" className="cta" onClick={() => setDetalhado(true)}>Ver minhas respostas detalhadas</button>
      <button type="button" className="v16-share-sec" onClick={compartilhar}>Compartilhar novamente</button>
    </div>
    <div className="v16-share-alternativas">
      <a href={`https://wa.me/?text=${encodeURIComponent('Eu fiz o teste Real ou IA? Faça também: '+url)}`} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a>
      <button type="button" onClick={copiarLink}>Copiar link</button>
    </div>
    {shareMsg && <p role="status" className="mut">{shareMsg}</p>}
  </div></div>;
}

export default function Participante() {
  const [etapa, setEtapa] = useState('carregando');
  const [pid, setPid] = useState(null);
  const [fila, setFila] = useState([]);
  const [i, setI] = useState(0);
  const [comps, setComps] = useState([]);
  const [j, setJ] = useState(0);
  const [total, setTotal] = useState(0);
  const [jaRespondidas, setJaRespondidas] = useState(0);
  const [totalDecisoes, setTotalDecisoes] = useState(40);
  const [configuracoes,setConfiguracoes]=useState([]);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  function instalarRoteiro(roteiro, comIntro = false) {
    const individuais = roteiro.filter((r) => r.kind === 'individual');
    const comparacoes = roteiro.filter((r) => r.kind === 'comparacao');
    const pendentes = individuais.filter((r) => !r.respondida);
    const paresPendentes = comparacoes.filter((r) => !r.respondida);
    if (roteiro.length < 1) throw new Error('O banco não conseguiu recuperar um roteiro válido.');
    // Roteiros de 30 decisões iniciados antes da atualização permanecem íntegros.
    // Novas sessões usam 40 decisões, com 20 individuais e 20 comparações.
    setTotalDecisoes(roteiro.length);
    setTotal(individuais.length);
    setJaRespondidas(roteiro.filter((r) => r.respondida).length);
    salvar({ nIndividuais: individuais.length, nDecisoes: roteiro.length });
    setFila(pendentes);
    setComps(paresPendentes);
    // O roteiro só é conhecido depois do sorteio no servidor.
    // Começa a baixar as imagens dessa sessão antes de abrir a primeira pergunta.
    prepararImagensDaSessao(pendentes, paresPendentes);
    prepararProximoAudio(pendentes, 0);
    setI(0); setJ(0);
    setEtapa(pendentes.length ? (comIntro ? 'p1_intro' : 'p1') :
      paresPendentes.length ? (comIntro ? 'p2_intro' : 'p2') : 'fim');
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      const configs=await supabase.rpc('configuracoes_teste_v19');
      if(ativo && !configs.error)setConfiguracoes(configs.data||[]);
      const s = ler();
      try {
        if (s.concluido) {
          if (ativo) { setPid(s.pid || null); setEtapa('fim'); }
          return;
        }
        if (s.pid) {
          const { data, error } = await supabase.rpc('obter_teste_v3', { p_participante: s.pid });
          if (error) throw error;
          const roteiro = await adicionarGanhosDeAudio(data);
          if (!ativo) return;
          setPid(s.pid);
          instalarRoteiro(roteiro);
          return;
        }
      } catch (e) {
        if (!ativo) return;
        if (sessaoLocalInvalida(e)) {
          // O banco foi limpo: não pedir ao usuário que mexa no DevTools.
          limparSessaoLocal();
          setPid(null);
          setErro('');
        } else {
          setErro('Não foi possível retomar o teste. Confira sua conexão e tente novamente.');
        }
      }
      if (ativo) setEtapa('intro');
    })();
    return () => { ativo = false; };
  }, []);

  // Ao avançar, dá prioridade às próximas imagens ainda não visitadas.
  useEffect(() => {
    if (etapa === 'p1') {
      anteciparProximasImagens(fila, comps, i + 1);
      prepararProximoAudio(fila, i + 1);
    }
  }, [etapa, fila, comps, i]);

  async function iniciar(f) {
    setBusy(true); setErro('');
    try {
      async function cadastrar() {
        const { data, error } = await supabase.rpc('registrar_participante', {
          p_faixa: f.faixa, p_genero: f.genero || null, p_escolaridade: f.esc,
          p_freq: f.freq, p_usos: f.usos, p_confianca: f.conf,
        });
        if (error) throw error;
        salvar({ pid: data, concluido: false, resultado: null, estimativa: null, nDecisoes: null, nIndividuais: null });
        return data;
      }
      const tinhaSessaoLocal = !!ler().pid;
      let participante = ler().pid || await cadastrar();
      const selecionarModo=await supabase.rpc('selecionar_modo_v19',{p_participante:participante,p_modo:f.modo});
      if(selecionarModo.error)throw selecionarModo.error;
      let resposta = await supabase.rpc('obter_teste_v3', { p_participante: participante });
      // Uma limpeza entre a abertura da página e o clique em "Começar"
      // também pode invalidar o ID. Tentar UMA vez com novo participante.
      if (resposta.error && tinhaSessaoLocal && sessaoLocalInvalida(resposta.error)) {
        limparSessaoLocal();
        participante = await cadastrar();
        resposta = await supabase.rpc('obter_teste_v3', { p_participante: participante });
      }
      if (resposta.error) throw resposta.error;
      salvar({ pid: participante, concluido: false, resultado: null, estimativa: null, nDecisoes: null, nIndividuais: null });
      setPid(participante);
      instalarRoteiro(await adicionarGanhosDeAudio(resposta.data), true);
    } catch (e) {
      setErro(e.message || 'Erro ao iniciar. Verifique o SQL e a quantidade de conteúdos cadastrados.');
    } finally { setBusy(false); }
  }

  async function decidir(c, ia, ms, met = {}) {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('enviar_resposta_v4', {
      p_participante: pid, p_conteudo: c.id, p_resposta_ia: ia, p_tempo_ms: ms,
      p_segundos_reproduzidos: met.segundosReproduzidos || 0,
      p_pedidos_mais: met.pedidosMais || 0,
      p_duracao_audio_s: met.duracaoAudioS || 0,
      p_trecho_liberado_s: met.trechoLiberadoS || 0,
      p_repeticoes_audio: met.repeticoesAudio || 0,
    });
    setBusy(false);
    if (error) { setErro('Não conseguimos salvar esta resposta. ' + error.message); throw error; }
    if (i + 1 >= fila.length) setEtapa(comps.length ? 'p2_intro' : 'fim');
    else setI((atual) => atual + 1);
  }

  async function decidirComp(r, marcados, ms) {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('enviar_comparacao_v3', {
      p_participante: pid, p_comparacao: r.id, p_marcados: marcados, p_tempo_ms: ms,
    });
    setBusy(false);
    if (error) { setErro('Não conseguimos salvar esta comparação. ' + error.message); return; }
    if (j + 1 >= comps.length) setEtapa('fim');
    else { setJ((atual) => atual + 1); window.scrollTo(0, 0); }
  }

  if (etapa === 'carregando') return <div className="tela"><p className="mut">Carregando…</p></div>;
  if (etapa === 'intro') return <Wizard onFim={iniciar} busy={busy} erro={erro} configuracoes={configuracoes} />;
  if (etapa === 'p1_intro') return <ParteIntro titulo={comps.length ? `Parte 1 de 2: ${total} conteúdos individuais` : `Teste: ${total} conteúdos individuais`} onOk={() => setEtapa('p1')}
      texto={['A classificação considera o conteúdo final apresentado. Se a imagem ou o som foi gerado por IA, a peça é IA, mesmo que a ideia, o roteiro ou o prompt sejam humanos.', 'Você verá conteúdos de origens diferentes, com perguntas variadas. Arraste para a esquerda quando achar que é IA, ou para a direita quando achar que é humano.', 'Nos áudios, o primeiro trecho depende da duração da gravação. Escute, classifique ou libere mais um trecho.']} />;
  if (etapa === 'p2_intro') return <ParteIntro titulo={`Parte 2 de 2: ${comps.length} comparações`} onOk={() => setEtapa('p2')}
      texto={[`Você concluiu a parte individual. Agora verá dois conteúdos por pergunta, mas cada par vale somente uma das ${totalDecisoes} decisões.`, 'Escolha nenhum, somente o primeiro, somente o segundo ou ambos, conforme a pergunta peça IA ou produções humanas. Os dois materiais podem ter a mesma origem.']} />;
  if (etapa === 'fim') return <Fim pid={pid} total={ler().nDecisoes || totalDecisoes || 40} />;
  if (etapa === 'p2') {
    const c = comps[j];
    return <Comparar key={c.id} rodada={c} n={jaRespondidas + fila.length + j} total={totalDecisoes}
      onConfirm={(m, ms) => decidirComp(c, m, ms)} busy={busy} erro={erro} />;
  }
  const c = fila[i];
  return <div className={"tela quiz" + (c.tipo === "audio" ? " quiz-audio" : c.tipo === "texto" ? " quiz-texto" : "")}>
    <header className="topo">
      <div className="barra"><i style={{ width: `${((jaRespondidas + i) / totalDecisoes) * 100}%` }} /></div>
      <span>{jaRespondidas + i + 1}/{totalDecisoes} decisões</span>
    </header>
    <SwipeCard key={c.id} item={c} primeiro={i === 0}
      pergunta={enunciado(true, c.enquadramento, c.tipo)} enquadramento={c.enquadramento} busy={busy} erro={erro}
      onDecide={(ia, ms, met) => decidir(c, ia, ms, met)} onConteudoCarregado={() => anteciparProximasImagens(fila, comps, i + 1)} />
  </div>;
}
