import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FAIXAS, GENEROS, ESCOLARIDADES, FREQ, USOS, TIPOS } from '../lib/opcoes';
import SwipeCard from '../components/SwipeCard';
import Midia from '../components/Midia';
import { prepararImagensDaSessao, anteciparProximasImagens } from '../lib/precarregarMidias';
import { prepararProximoAudio } from '../lib/precarregarAudios';

const LS = 'realia_v3';
const ler = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const salvar = (d) => { try { localStorage.setItem(LS, JSON.stringify({ ...ler(), ...d })); } catch { /* ignora */ } };

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
      <div className="tela centro largo">
        <div className="cartao hero">
          <div className="pilha" aria-hidden="true">
            <div className="mini fundo" />
            <div className="mini frente"><span className="selo-mini">Sem IA</span></div>
          </div>
          <h1>Real<br />ou IA?</h1>
          <p>Pesquisa de matemática avançada. Primeiro 6 perguntas rápidas, depois você decide o que foi feito por IA. São 30 decisões; o teste é anônimo e inclui áudios com escuta por trechos.</p>
          <p className="definicao-origem"><strong>O que conta como IA?</strong> Classificamos pela origem do conteúdo final. Se as imagens de um vídeo foram geradas por IA, ele será considerado IA mesmo com roteiro humano. Para áudio, imagem e texto vale a mesma regra: o que importa é o material final apresentado, e não apenas a ideia, o roteiro ou o comando usado para produzi-lo.</p>
          <button className="cta" style={{ alignSelf: 'stretch' }} onClick={() => setI(0)}>Começar</button>
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
  const [m, setM] = useState({});
  const t0 = useRef(performance.now());
  const itens = rodada.conteudos;
  const pronto = itens.every((c) => m[c.id] !== undefined);
  const rotulos = rotulosDaPergunta(rodada.enquadramento);
  return (
    <div className="comp">
      <header className="topo">
        <div className="barra"><i style={{ width: `${(n / total) * 100}%` }} /></div>
        <span>{n + 1}/{total}</span>
      </header>
      <div className="bloco-pergunta"><span className="bloco-pergunta-etiqueta">COMPARE E DECIDA</span><h2 className="enunciado-teste">{enunciado(false, rodada.enquadramento, rodada.tipo)}</h2></div>
      <p className="mut">Avalie cada conteúdo separadamente. Ambos podem ter a mesma origem ou origens diferentes.</p>
      <div className="comp-grade">
        {itens.map((c, k) => (
          <div className="comp-item" key={c.id}>
            <span className="tag">Conteúdo {k + 1}</span>
            <div className="conteudo"><Midia item={c} /></div>
            <div className="escolha">
              <button className={'op ia' + (m[c.id] === true ? ' on' : '')}
                disabled={busy} onClick={() => setM((x) => ({ ...x, [c.id]: true }))}>{rotulos.ia}</button>
              <button className={'op real' + (m[c.id] === false ? ' on' : '')}
                disabled={busy} onClick={() => setM((x) => ({ ...x, [c.id]: false }))}>{rotulos.humano}</button>
            </div>
          </div>
        ))}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="cta" disabled={!pronto || busy}
        onClick={() => onConfirm(itens.filter((c) => m[c.id]).map((c) => c.id), Math.round(performance.now() - t0.current))}>
        {busy ? 'Salvando…' : 'Confirmar'}
      </button>
    </div>
  );
}

function Fim({ pid, total }) {
  const [res, setRes] = useState(ler().resultado || null);
  const [est, setEst] = useState(Math.round(total / 2));
  const [busy, setBusy] = useState(false);

  async function ver() {
    setBusy(true);
    const { data, error } = await supabase.rpc('finalizar_participante_v3', { p_participante: pid, p_estimativa: est });
    setBusy(false);
    if (error) return alert('Não foi possível enviar. Tente de novo.');
    salvar({ resultado: data, concluido: true });
    setRes(data);
  }

  if (!res) {
    return (
      <div className="tela centro largo">
        <div className="cartao">
          <h2 className="pergunta">Última pergunta</h2>
          <p className="mut">Nas {total} decisões individuais, quantas você acha que acertou?</p>
          <div className="estima"><b>{est}</b><span>de {total}</span></div>
          <input type="range" min="0" max={total} value={est} onChange={(e) => setEst(+e.target.value)} />
          <button className="cta" disabled={busy} onClick={ver}>{busy ? 'Enviando…' : 'Ver meu resultado'}</button>
        </div>
      </div>
    );
  }
  const pct = Math.round((100 * res.acertos) / Math.max(res.total, 1));
  return (
    <div className="tela centro largo">
      <div className="cartao">
        <h2 className="pergunta">Obrigado!</h2>
        <div className="resultado"><b>{pct}%</b><span>Parte 1: você acertou {res.acertos} de {res.total}</span></div>
        <div className="tipos">
          {Object.entries(res.por_tipo || {}).map(([t, v]) => (
            <div key={t} className="linha-tipo">
              <span>{TIPOS[t]}</span>
              <div className="barra"><i style={{ width: `${(100 * v.acertos) / v.total}%` }} /></div>
              <em>{v.acertos}/{v.total}</em>
            </div>
          ))}
        </div>
        {res.comp?.total > 0 && <p className="mut">Parte 2: você acertou os dois conteúdos em {res.comp.acertos} de {res.comp.total} comparações.</p>}
        <p className="mut">Suas respostas já entraram na pesquisa. Passe o link para um amigo!</p>
      </div>
    </div>
  );
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
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  function instalarRoteiro(roteiro, comIntro = false) {
    const individuais = roteiro.filter((r) => r.kind === 'individual');
    const comparacoes = roteiro.filter((r) => r.kind === 'comparacao');
    const pendentes = individuais.filter((r) => !r.respondida);
    const paresPendentes = comparacoes.filter((r) => !r.respondida);
    if (roteiro.length !== 30) throw new Error('O banco não conseguiu sortear 30 decisões válidas.');
    setTotal(individuais.length);
    setJaRespondidas(roteiro.filter((r) => r.respondida).length);
    salvar({ nIndividuais: individuais.length });
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
    (async () => {
      const s = ler();
      try {
        if (s.pid) setPid(s.pid);
        if (s.concluido) return setEtapa('fim');
        if (s.pid) {
          const { data, error } = await supabase.rpc('obter_teste_v3', { p_participante: s.pid });
          if (error) throw error;
          instalarRoteiro(await adicionarGanhosDeAudio(data));
          return;
        }
      } catch (e) { setErro(e.message || 'Erro ao recuperar seu teste.'); }
      setEtapa('intro');
    })();
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
      let participante = ler().pid;
      if (!participante) {
        const { data, error } = await supabase.rpc('registrar_participante', {
          p_faixa: f.faixa, p_genero: f.genero || null, p_escolaridade: f.esc,
          p_freq: f.freq, p_usos: f.usos, p_confianca: f.conf,
        });
        if (error) throw error;
        participante = data;
        salvar({ pid: participante, concluido: false, resultado: null });
      }
      const { data: roteiro, error: erroRoteiro } = await supabase.rpc('obter_teste_v3', { p_participante: participante });
      if (erroRoteiro) throw erroRoteiro;
      salvar({ pid: participante, concluido: false, resultado: null });
      setPid(participante);
      instalarRoteiro(await adicionarGanhosDeAudio(roteiro), true);
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
  if (etapa === 'p1_intro') return <ParteIntro titulo="Parte 1: um conteúdo por vez" onOk={() => setEtapa('p1')}
      texto={['A classificação considera o conteúdo final apresentado. Se a imagem ou o som foi gerado por IA, a peça é IA, mesmo que a ideia, o roteiro ou o prompt sejam humanos.', 'Você verá conteúdos de origens diferentes, com perguntas variadas. Arraste para a esquerda quando achar que é IA, ou para a direita quando achar que é humano.', 'Nos áudios, o primeiro trecho depende da duração da gravação. Escute, classifique ou libere mais um trecho.']} />;
  if (etapa === 'p2_intro') return <ParteIntro titulo="Parte 2: comparações" onOk={() => setEtapa('p2')}
      texto={['Agora aparecerão dois conteúdos. Classifique cada um independentemente: ambos podem ser reais, ambos podem ser IA, ou podem ser diferentes.', 'Não é preciso escolher obrigatoriamente um de cada.']} />;
  if (etapa === 'fim') return <Fim pid={pid} total={total || ler().nIndividuais || 24} />;
  if (etapa === 'p2') {
    const c = comps[j];
    return <Comparar key={c.id} rodada={c} n={jaRespondidas + fila.length + j} total={30}
      onConfirm={(m, ms) => decidirComp(c, m, ms)} busy={busy} erro={erro} />;
  }
  const c = fila[i];
  return <div className={"tela quiz" + (c.tipo === "audio" ? " quiz-audio" : c.tipo === "texto" ? " quiz-texto" : "")}>
    <header className="topo">
      <div className="barra"><i style={{ width: `${((jaRespondidas + i) / 30) * 100}%` }} /></div>
      <span>{jaRespondidas + i + 1}/30 decisões</span>
    </header>
    <SwipeCard key={c.id} item={c} primeiro={i === 0}
      pergunta={enunciado(true, c.enquadramento, c.tipo)} enquadramento={c.enquadramento} busy={busy} erro={erro}
      onDecide={(ia, ms, met) => decidir(c, ia, ms, met)} onConteudoCarregado={() => anteciparProximasImagens(fila, comps, i + 1)} />
  </div>;
}
