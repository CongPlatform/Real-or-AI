import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
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

function Wizard({ onFim, busy, erro }) {
  const [i, setI] = useState(-1);
  const [r, setR] = useState({ faixa: '', genero: '', esc: '', freq: '', usos: [], conf: 0 });

  if (i < 0) {
    return (
      <div className="tela centro largo inicio-tela">
        <div className="cartao hero inicio-cartao">
          <div className="inicio-cabecalho">
            <span className="inicio-simbolo" aria-hidden="true"><span>R</span><span>IA?</span></span>
            <span className="inicio-etiqueta">PESQUISA ESCOLAR · MATEMÁTICA AVANÇADA</span>
          </div>
          <h1 className="inicio-titulo">Real <span>ou IA?</span></h1>
          <p className="inicio-chamada">Você consegue distinguir conteúdos criados por pessoas daqueles produzidos por inteligência artificial?</p>
          <div className="inicio-fatos" aria-label="Como funciona">
            <span><strong>6</strong> perguntas iniciais</span>
            <span><strong>40</strong> decisões</span>
            <span><strong>4</strong> formatos</span>
          </div>
          <div className="inicio-definicao">
            <div className="inicio-definicao-titulo"><span aria-hidden="true">?</span><strong>O que consideramos IA?</strong></div>
            <p>Vale a origem do <strong>conteúdo final</strong>. Um vídeo com roteiro humano e imagens geradas por IA, por exemplo, é classificado como IA. O mesmo critério vale para imagens, textos e áudios.</p>
          </div>
          <p className="inicio-rodape">O teste é anônimo. Nos áudios, você pode ouvir mais trechos antes de responder.</p>
          <button type="button" className="cta inicio-botao" onClick={() => setI(0)}>Começar pesquisa <span aria-hidden="true">→</span></button>
        </div>
      </div>
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
            <button className="cta" disabled={!ok || busy} onClick={() => (ultima ? onFim(r) : setI(i + 1))}>
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
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const chaveCompartilhamento = `realia_resultado_compartilhado_v18_${pid || 'sem_id'}`;
  const [liberado, setLiberado] = useState(() => {
    try { return Boolean(pid && localStorage.getItem(`realia_resultado_compartilhado_v18_${pid}`) === '1'); }
    catch { return false; }
  });

  function liberarResultado() {
    setLiberado(true);
    try { localStorage.setItem(chaveCompartilhamento, '1'); } catch { /* navegador sem storage */ }
  }

  // Compartilhamento nativo: liberar somente quando a janela fechar.
  // Não existe desbloqueio ANTES de chamar navigator.share.
  async function compartilhar() {
    if (compartilhando) return;
    const url = window.location.origin + window.location.pathname;
    const dados = {
      title: 'Real ou IA?',
      text: 'Eu participei do Real ou IA? Você consegue identificar quais conteúdos foram feitos por inteligência artificial? Faça o teste também!',
      url
    };
    if (typeof navigator.share === 'function') {
      setCompartilhando(true);
      try {
        await navigator.share(dados);
        liberarResultado();
      } catch (e) {
        // Cancelar/fechar a folha de compartilhamento também significa que ela foi fechada.
        if (e?.name === 'AbortError') liberarResultado();
        else { setShareMsg('Use uma das opções para compartilhar o desafio.'); setOpcoesAbertas(true); }
      } finally {
        setCompartilhando(false);
      }
      return;
    }
    // Desktop sem Web Share API: abrir opções locais; desbloquear ao FECHAR essa janela.
    setShareMsg('');
    setOpcoesAbertas(true);
  }

  function fecharOpcoes() {
    setOpcoesAbertas(false);
    liberarResultado();
  }

  const urlCompartilhar = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
  const textoCompartilhar = encodeURIComponent('Eu fiz o teste Real ou IA? Faça também: ' + urlCompartilhar);
  const menuCompartilhamento = opcoesAbertas && <div className="v18-share-overlay" role="presentation">
    <div className="v18-share-dialog" role="dialog" aria-modal="true" aria-label="Compartilhar o desafio">
      <h2>Compartilhe o desafio</h2>
      <p>Escolha onde quer enviar o link para um amigo.</p>
      <a href={`https://wa.me/?text=${textoCompartilhar}`} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a>
      <a href={`mailto:?subject=${encodeURIComponent('Real ou IA?')}&body=${textoCompartilhar}`}>Compartilhar por e-mail</a>
      <button type="button" onClick={copiarLink}>Copiar link</button>
      {shareMsg && <p role="status">{shareMsg}</p>}
      <button className="v18-share-fechar" type="button" onClick={fecharOpcoes}>Fechar compartilhamento e ver resultado</button>
    </div>
  </div>;

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
    salvar({ resultado: data, concluido: true });
    setRes(data);
  }

  if (!res) {
    return <div className="tela centro largo"><div className="cartao">
      <h2 className="pergunta">Última pergunta</h2>
      <p className="mut">Considerando todas as {total} decisões (classificações individuais e comparações), quantas você acha que acertou?</p>
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
    <button className="cta" type="button" disabled={compartilhando} onClick={compartilhar}>{compartilhando?'Compartilhamento aberto…':'Compartilhar e ver meus resultados'}</button>
    {menuCompartilhamento}
    {shareMsg && !opcoesAbertas && <p role="status">{shareMsg}</p>}
    <span className="v16-share-caption">Seu teste já foi salvo.</span>
  </div></div>;

  const acertosIndividuais = Number(res.acertos) || 0;
  const totalIndividuais = Number(res.total) || 0;
  const acertosComparacoes = Number(res.comp?.acertos) || 0;
  const totalComparacoes = Number(res.comp?.total) || 0;
  const acertosGerais = acertosIndividuais + acertosComparacoes;
  const totalGeral = totalIndividuais + totalComparacoes;
  const pct = Math.round((100 * acertosGerais) / Math.max(totalGeral, 1));
  if (detalhado) return <ResultadoDetalhado pid={pid} onVoltar={() => setDetalhado(false)} />;
  const url = window.location.origin + window.location.pathname;
  return <div className="tela centro largo"><div className="cartao">
    <h2 className="pergunta">Seu resultado</h2>
    <div className="resultado"><b>{pct}%</b><span>Total: {acertosGerais} de {totalGeral} decisões corretas</span></div>
    <p className="mut">Parte 1: {acertosIndividuais} de {totalIndividuais} classificações individuais corretas.</p>
    <div className="tipos">{Object.entries(res.por_tipo || {}).map(([t,v]) => <div key={t} className="linha-tipo">
      <span>{TIPOS[t] || t}</span><div className="barra"><i style={{width:`${v.total ? 100*v.acertos/v.total : 0}%`}}/></div><em>{v.acertos}/{v.total}</em>
    </div>)}</div>
    {res.comp?.total > 0 && <p className="mut">Parte 2: você acertou as duas peças em {res.comp.acertos} de {res.comp.total} comparações.</p>}
    <div className="detalhe-acoes">
      <button type="button" className="cta" onClick={() => setDetalhado(true)}>Ver minhas respostas detalhadas</button>
      <button type="button" className="v16-share-sec" onClick={compartilhar}>Compartilhar novamente</button>
    </div>
    <div className="v16-share-alternativas">
      <a href={`https://wa.me/?text=${encodeURIComponent('Eu fiz o teste Real ou IA? Faça também: '+url)}`} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a>
      <button type="button" onClick={copiarLink}>Copiar link</button>
    </div>
    {shareMsg && <p role="status" className="mut">{shareMsg}</p>}
    {menuCompartilhamento}
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
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  function instalarRoteiro(roteiro, comIntro = false) {
    const individuais = roteiro.filter((r) => r.kind === 'individual');
    const comparacoes = roteiro.filter((r) => r.kind === 'comparacao');
    const pendentes = individuais.filter((r) => !r.respondida);
    const paresPendentes = comparacoes.filter((r) => !r.respondida);
    if (![30, 40].includes(roteiro.length)) throw new Error('O banco não conseguiu recuperar um roteiro válido.');
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
        salvar({ pid: data, concluido: false, resultado: null });
        return data;
      }
      const tinhaSessaoLocal = !!ler().pid;
      let participante = ler().pid || await cadastrar();
      let resposta = await supabase.rpc('obter_teste_v3', { p_participante: participante });
      // Uma limpeza entre a abertura da página e o clique em "Começar"
      // também pode invalidar o ID. Tentar UMA vez com novo participante.
      if (resposta.error && tinhaSessaoLocal && sessaoLocalInvalida(resposta.error)) {
        limparSessaoLocal();
        participante = await cadastrar();
        resposta = await supabase.rpc('obter_teste_v3', { p_participante: participante });
      }
      if (resposta.error) throw resposta.error;
      salvar({ pid: participante, concluido: false, resultado: null });
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
  if (etapa === 'intro') return <Wizard onFim={iniciar} busy={busy} erro={erro} />;
  if (etapa === 'p1_intro') return <ParteIntro titulo={comps.length ? `Parte 1 de 2: ${total} conteúdos individuais` : `Teste: ${total} conteúdos individuais`} onOk={() => setEtapa('p1')}
      texto={['A classificação considera o conteúdo final apresentado. Se a imagem ou o som foi gerado por IA, a peça é IA, mesmo que a ideia, o roteiro ou o prompt sejam humanos.', 'Você verá conteúdos de origens diferentes, com perguntas variadas. Arraste para a esquerda quando achar que é IA, ou para a direita quando achar que é humano.', 'Nos áudios, o primeiro trecho depende da duração da gravação. Escute, classifique ou libere mais um trecho.']} />;
  if (etapa === 'p2_intro') return <ParteIntro titulo={`Parte 2 de 2: ${comps.length} comparações`} onOk={() => setEtapa('p2')}
      texto={[`Você concluiu a parte individual. Agora verá dois conteúdos por pergunta, mas cada par vale somente uma das ${totalDecisoes} decisões.`, 'Escolha nenhum, somente o primeiro, somente o segundo ou ambos, conforme a pergunta peça IA ou produções humanas. Os dois materiais podem ter a mesma origem.']} />;
  if (etapa === 'fim') return <Fim pid={pid} total={ler().nDecisoes || totalDecisoes} />;
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
