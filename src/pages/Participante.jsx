import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FAIXAS, GENEROS, ESCOLARIDADES, FREQ, USOS, TIPOS } from '../lib/opcoes';
import SwipeCard from '../components/SwipeCard';
import Midia from '../components/Midia';

const LS = 'realia_v2';
const ler = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const salvar = (d) => { try { localStorage.setItem(LS, JSON.stringify({ ...ler(), ...d })); } catch { /* ignora */ } };
const embaralhar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviarRpc(nome, args) {
  for (let t = 0; t < 4; t++) {
    const { error } = await supabase.rpc(nome, args);
    if (!error) return;
    await pausa(800 * (t + 1));
  }
  console.error('Resposta não enviada', nome, args);
}

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
          <p>Pesquisa de matemática avançada. Primeiro 6 perguntas rápidas, depois você decide o que foi feito por IA. Leva poucos minutos e é anônima.</p>
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

function Comparar({ rodada, n, total, onConfirm }) {
  const [m, setM] = useState({});
  const t0 = useRef(performance.now());
  const itens = rodada.conteudos;
  const pronto = itens.every((c) => m[c.id] !== undefined);
  return (
    <div className="comp">
      <header className="topo">
        <div className="barra"><i style={{ width: `${(n / total) * 100}%` }} /></div>
        <span>{n + 1}/{total}</span>
      </header>
      <p className="mut">Marque, para cada conteúdo, se foi feito por IA ou não. Pode ser que nenhum, só um ou os dois sejam de IA.</p>
      <div className="comp-grade">
        {itens.map((c, k) => (
          <div className="comp-item" key={c.id}>
            <span className="tag">Conteúdo {k + 1}</span>
            <div className="conteudo"><Midia item={c} /></div>
            <div className="escolha">
              <button className={'op ia' + (m[c.id] === true ? ' on' : '')} onClick={() => setM((x) => ({ ...x, [c.id]: true }))}>Feito por IA</button>
              <button className={'op real' + (m[c.id] === false ? ' on' : '')} onClick={() => setM((x) => ({ ...x, [c.id]: false }))}>Sem IA</button>
            </div>
          </div>
        ))}
      </div>
      <button className="cta" disabled={!pronto} onClick={() => onConfirm(itens.filter((c) => m[c.id]).map((c) => c.id), Math.round(performance.now() - t0.current))}>
        Confirmar
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
    const { data, error } = await supabase.rpc('finalizar_participante', { p_participante: pid, p_estimativa: est });
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
          <p className="mut">Na parte 1 (um conteúdo por vez), quantos dos {total} você acha que acertou?</p>
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
        {res.comp?.total > 0 && <p className="mut">Parte 2: você acertou os dois conteúdos em {res.comp.acertos} de {res.comp.total} rodadas.</p>}
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
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  async function carregar(feitos = [], feitosComp = []) {
    const [a, b] = await Promise.all([
      supabase.from('conteudos').select('id,tipo,url,texto').eq('ativo', true).is('comparacao_id', null),
      supabase.from('comparacoes').select('id,tipo,conteudos(id,tipo,url,texto)').eq('ativo', true),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    setTotal(a.data.length);
    const cs = b.data
      .filter((c) => (c.conteudos || []).length === 2 && !feitosComp.includes(c.id))
      .map((c) => ({ ...c, conteudos: embaralhar(c.conteudos) }));
    return { q: embaralhar(a.data.filter((c) => !feitos.includes(c.id))), cs: embaralhar(cs) };
  }

  useEffect(() => {
    (async () => {
      const s = ler();
      try {
        if (s.pid) setPid(s.pid);
        if (s.concluido) return setEtapa('fim');
        if (s.pid) {
          const { q, cs } = await carregar(s.feitos || [], s.feitosComp || []);
          setFila(q); setComps(cs);
          return setEtapa(q.length ? 'p1' : cs.length ? 'p2_intro' : 'fim');
        }
      } catch { setErro('Não foi possível carregar. Verifique sua conexão.'); }
      setEtapa('intro');
    })();
  }, []);

  async function iniciar(f) {
    setBusy(true); setErro('');
    try {
      const { q, cs } = await carregar();
      if (!q.length && !cs.length) throw new Error('vazio');
      const { data, error } = await supabase.rpc('registrar_participante', {
        p_faixa: f.faixa, p_genero: f.genero || null, p_escolaridade: f.esc, p_freq: f.freq, p_usos: f.usos, p_confianca: f.conf,
      });
      if (error) throw error;
      salvar({ pid: data, feitos: [], feitosComp: [], concluido: false, resultado: null });
      setPid(data); setFila(q); setComps(cs); setI(0); setJ(0);
      setEtapa(q.length ? 'p1_intro' : 'p2_intro');
    } catch (e) {
      setErro(e.message === 'vazio' ? 'Ainda não há conteúdos cadastrados.' : 'Erro ao iniciar. Tente de novo.');
    } finally { setBusy(false); }
  }

  function decidir(c, ia, ms) {
    enviarRpc('enviar_resposta', { p_participante: pid, p_conteudo: c.id, p_resposta_ia: ia, p_tempo_ms: ms });
    salvar({ feitos: [...(ler().feitos || []), c.id] });
    if (i + 1 >= fila.length) setEtapa(comps.length ? 'p2_intro' : 'fim'); else setI(i + 1);
  }

  function decidirComp(r, marcados, ms) {
    enviarRpc('enviar_comparacao', { p_participante: pid, p_comparacao: r.id, p_marcados: marcados, p_tempo_ms: ms });
    salvar({ feitosComp: [...(ler().feitosComp || []), r.id] });
    if (j + 1 >= comps.length) setEtapa('fim'); else { setJ(j + 1); window.scrollTo(0, 0); }
  }

  if (etapa === 'carregando') return <div className="tela"><p className="mut">Carregando…</p></div>;
  if (etapa === 'intro') return <Wizard onFim={iniciar} busy={busy} erro={erro} />;
  if (etapa === 'p1_intro') {
    return <ParteIntro titulo="Parte 1: um conteúdo por vez" onOk={() => setEtapa('p1')}
      texto={['Você vai ver conteúdos em imagem, áudio, texto e vídeo, um de cada vez. Para cada um, diga se foi feito por IA ou não.', 'Em computador, arraste a carta com o mouse ou use as setas do teclado.']} />;
  }
  if (etapa === 'p2_intro') {
    return <ParteIntro titulo="Parte 2: dois conteúdos por vez" onOk={() => setEtapa('p2')}
      texto={['Agora aparecem dois conteúdos do mesmo tipo. Marque, para cada um, se foi feito por IA.', 'Não existe padrão: em cada rodada, nenhum, só um ou os dois podem ser de IA.']} />;
  }
  if (etapa === 'fim') return <Fim pid={pid} total={total || ler().feitos?.length || 0} />;
  if (etapa === 'p2') {
    return <Comparar key={comps[j].id} rodada={comps[j]} n={j} total={comps.length} onConfirm={(m, ms) => decidirComp(comps[j], m, ms)} />;
  }
  const c = fila[i];
  return (
    <div className="tela quiz">
      <header className="topo">
        <div className="barra"><i style={{ width: `${(i / fila.length) * 100}%` }} /></div>
        <span>{i + 1}/{fila.length}</span>
      </header>
      <SwipeCard key={c.id} item={c} primeiro={i === 0} onDecide={(ia, ms) => decidir(c, ia, ms)} />
    </div>
  );
}
