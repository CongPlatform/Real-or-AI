import { useEffect, useRef, useState } from 'react';
import { etapasDeAudio, tempoLegivel } from '../lib/etapasAudio';

// A reprodução parte do início e só pode avançar até a etapa liberada.
// Cada solicitação desbloqueia uma parcela maior do arquivo, proporcional à duração.
function AudioProgressivo({ item, onMetricas, onPrimeiroTrecho, onCarregado }) {
  const player = useRef(null);
  const quadro = useRef(null);
  const limiteAtual = useRef(0);
  const tempoAnterior = useRef(0);
  const ouvido = useRef(0);
  const pedidos = useRef(0);
  const primeiroConcluido = useRef(false);
  const ultimaPintura = useRef(0);
  const [etapas, setEtapas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [trechoConcluido, setTrechoConcluido] = useState(false);
  const [erro, setErro] = useState('');

  const duracao = etapas.at(-1) || 0;
  const liberado = etapas[indice] || 0;
  const proximaEtapa = etapas[indice + 1];
  const podeMais = trechoConcluido && proximaEtapa !== undefined;
  const progresso = duracao ? Math.min(100, tempo / duracao * 100) : 0;
  const limitePercentual = duracao ? Math.min(100, liberado / duracao * 100) : 0;
  const notificar = () => onMetricas?.({
    segundosReproduzidos: Math.round(ouvido.current * 10) / 10,
    pedidosMais: pedidos.current,
  });

  const contar = (a) => {
    if (!a) return;
    const delta = a.currentTime - tempoAnterior.current;
    // Mudanças por seek, saltos ou buffering não são tratadas como tempo ouvido.
    if (delta > 0 && delta < 1.6) ouvido.current += delta;
    tempoAnterior.current = a.currentTime;
    notificar();
  };

  const pararNoLimite = (a) => {
    const fim = limiteAtual.current;
    if (!a || !fim || a.currentTime < fim - 0.035) return false;
    contar(a);
    a.pause();
    if (a.currentTime > fim) a.currentTime = fim;
    tempoAnterior.current = a.currentTime;
    setTempo(a.currentTime);
    setTrechoConcluido(true);
    if (!primeiroConcluido.current) {
      primeiroConcluido.current = true;
      onPrimeiroTrecho?.();
    }
    return true;
  };

  const verificar = (instante) => {
    const a = player.current;
    if (!a || a.paused) return;
    if (pararNoLimite(a)) return;
    if (instante - ultimaPintura.current > 80) {
      ultimaPintura.current = instante;
      setTempo(a.currentTime);
    }
    quadro.current = requestAnimationFrame(verificar);
  };

  async function reproduzir() {
    const a = player.current;
    if (!a || !duracao) return;
    if (!a.paused) { a.pause(); return; }
    if (a.currentTime >= limiteAtual.current - 0.07) {
      a.currentTime = 0;
      tempoAnterior.current = 0;
      setTempo(0);
      setTrechoConcluido(false);
    }
    try { await a.play(); setErro(''); }
    catch { setErro('Não foi possível reproduzir. Tente novamente.'); }
  }

  async function ouvirMais() {
    const a = player.current;
    if (!a || !podeMais) return;
    // Como nos jogos de adivinhar músicas, cada etapa recomeça do início.
    // Os segundos reproduzidos contabilizam também o que foi escutado novamente.
    a.pause();
    a.currentTime = 0;
    tempoAnterior.current = 0;
    limiteAtual.current = proximaEtapa;
    pedidos.current += 1;
    setTempo(0);
    setIndice((atual) => atual + 1);
    setTrechoConcluido(false);
    notificar();
    try { await a.play(); setErro(''); }
    catch { setErro('Não foi possível continuar. Use o botão de reprodução.'); }
  }

  useEffect(() => {
    onMetricas?.({ segundosReproduzidos: 0, pedidosMais: 0 });
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
      player.current?.pause();
    };
  }, [item.id]);

  return <div className="audio-jogo" onPointerDown={(e) => e.stopPropagation()}>
    <audio ref={player} src={item.url} preload="metadata"
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (!Number.isFinite(d) || d <= 0) {
          setErro('Este áudio não informa sua duração. Converta o arquivo para MP3 e tente novamente.');
          return;
        }
        const limites = etapasDeAudio(d);
        limiteAtual.current = limites[0];
        setEtapas(limites);
        setIndice(0);
        onCarregado?.();
      }}
      onPlay={() => {
        setTocando(true);
        if (quadro.current !== null) cancelAnimationFrame(quadro.current);
        quadro.current = requestAnimationFrame(verificar);
      }}
      onPause={(e) => {
        contar(e.currentTarget);
        setTocando(false);
        if (quadro.current !== null) cancelAnimationFrame(quadro.current);
      }}
      onTimeUpdate={(e) => { contar(e.currentTarget); pararNoLimite(e.currentTarget); }}
      onSeeking={(e) => {
        const a = e.currentTarget;
        if (limiteAtual.current > 0 && a.currentTime > limiteAtual.current) {
          a.currentTime = Math.max(0, limiteAtual.current - 0.05);
        }
        tempoAnterior.current = a.currentTime;
      }}
      onEnded={(e) => {
        contar(e.currentTarget);
        setTocando(false);
        pararNoLimite(e.currentTarget);
      }}
      onError={() => setErro('Falha no carregamento do áudio. Verifique a conexão ou o arquivo.')} />

    <div className="audio-jogo-topo">
      <span className="audio-jogo-etapa">Escuta {Math.min(indice + 1, etapas.length || 1)} de {etapas.length || '…'}</span>
      <span className="audio-jogo-liberado">{duracao ? `${tempoLegivel(liberado)} disponíveis` : 'Preparando…'}</span>
    </div>
    <div className="audio-jogo-marcas" aria-label="Etapas de escuta">
      {etapas.map((t, n) => <span key={n} className={n <= indice ? 'desbloqueado' : ''}
        title={`Até ${tempoLegivel(t)}`} />)}
    </div>
    <div className="audio-jogo-trilha" role="progressbar" aria-label="Trecho reproduzido"
      aria-valuenow={Math.min(100, Math.round(progresso))} aria-valuemin={0} aria-valuemax={100}>
      <div className="audio-jogo-janela" style={{ width: `${limitePercentual}%` }} />
      <div className="audio-jogo-preenchido" style={{ width: `${progresso}%` }} />
      <div className="audio-jogo-cursor" style={{ left: `${progresso}%` }} />
    </div>
    <div className="audio-jogo-tempos"><span>{tempoLegivel(tempo)}</span><span>{tempoLegivel(duracao)}</span></div>

    <div className="audio-jogo-controle">
      <button type="button" className="audio-jogo-reiniciar" onClick={() => {
        const a = player.current;
        if (a) {
          a.pause(); a.currentTime = 0; tempoAnterior.current = 0;
          setTempo(0); setTrechoConcluido(false);
        }
      }} disabled={!duracao} aria-label="Repetir desde o início" title="Repetir desde o início">↺</button>
      <button type="button" className="audio-jogo-play" onClick={reproduzir} disabled={!duracao}
        aria-label={tocando ? 'Pausar áudio' : 'Reproduzir áudio'}>
        {tocando ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8z" /></svg>}
      </button>
      <span className="audio-jogo-duracao"><strong>{Math.round(limitePercentual)}%</strong><small> liberado</small></span>
    </div>
    {podeMais ? <button type="button" className="audio-jogo-mais" onClick={ouvirMais}>
      Ouvir mais · {tempoLegivel(proximaEtapa)} <span aria-hidden="true">→</span>
    </button> : <p className="audio-jogo-instrucao">{
      trechoConcluido ? 'Você pode responder ou repetir o trecho.' :
        tocando ? 'Reproduzindo o trecho disponível…' :
          'Ouça um trecho, depois responda ou peça mais tempo.'
    }</p>}
    {erro && <p role="alert" className="erro">{erro}</p>}
  </div>;
}

export default function Midia({ item, progressivo = false, onMetricas, onPrimeiroTrecho, onCarregado }) {
  const ref = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [falha, setFalha] = useState(false);
  const alterna = () => { const m = ref.current; if (m) (m.paused ? m.play().catch(() => setFalha(true)) : m.pause()); };
  const botao = (
    <button type="button" className="tocar" onPointerDown={(e) => e.stopPropagation()} onClick={alterna}>
      {tocando ? 'Pausar' : 'Tocar'}
    </button>
  );
  if (item.tipo === 'imagem') return <div className="imagem-receptaculo">
    {!carregado && !falha && <p className="mut imagem-carregando">Preparando imagem…</p>}
    {falha && <p role="alert" className="erro">Não foi possível carregar esta imagem.</p>}
    <img className="m-img" src={item.url} alt="Conteúdo para identificar" draggable={false}
      loading="eager" decoding="async" fetchPriority="high"
      onLoad={() => { setCarregado(true); onCarregado?.(); }}
      onError={() => setFalha(true)} style={{ display: carregado ? 'block' : 'none' }}/>
  </div>;
  if (item.tipo === 'texto') return <article className="m-texto" lang="pt-BR" data-no-swipe="true">{item.texto || ''}</article>;
  if (item.tipo === 'audio' && progressivo) return <AudioProgressivo item={item} onMetricas={onMetricas} onPrimeiroTrecho={onPrimeiroTrecho} onCarregado={onCarregado} />;
  const props = {
    ref, src: item.url, playsInline: true, preload: 'metadata',
    onLoadedMetadata: () => onCarregado?.(),
    onPlay: () => setTocando(true), onPause: () => setTocando(false), onEnded: () => setTocando(false),
  };
  if (item.tipo === 'video') return <div className="m-video"><video {...props} loop />{botao}</div>;
  return <div className="m-audio"><audio {...props} />{botao}</div>;
}
