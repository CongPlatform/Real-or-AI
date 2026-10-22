import { useEffect, useRef, useState } from 'react';

// Escuta de 8 em 8 segundos, inspirada em jogos de identificação musical.
// Trechos ainda não liberados nunca ficam disponíveis pela barra de tempo.
function AudioProgressivo({ item, onMetricas, onPrimeiroTrecho, onCarregado }) {
  const player = useRef(null);
  const limiteAtual = useRef(8);
  const anterior = useRef(0);
  const ouvido = useRef(0);
  const pedidos = useRef(0);
  const notificouPrimeiro = useRef(false);
  const quadro = useRef(null);
  const ultimaAtualizacao = useRef(0);
  const [duracao, setDuracao] = useState(0);
  const [liberado, setLiberado] = useState(8);
  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [trechoConcluido, setTrechoConcluido] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');

  const contar = (audio) => {
    if (!audio) return;
    const t = audio.currentTime;
    const delta = t - anterior.current;
    // Voltar ao início ou saltar no áudio não conta como escuta.
    if (!audio.paused && delta > 0 && delta < 2.5) ouvido.current += delta;
    anterior.current = t;
    onMetricas?.({ segundosReproduzidos: Math.round(ouvido.current * 10) / 10, pedidosMais: pedidos.current });
  };

  const limite = () => Math.min(limiteAtual.current, Number.isFinite(duracao) && duracao > 0 ? duracao : limiteAtual.current);

  const pararNoLimite = (audio) => {
    if (!audio || audio.currentTime < limite() - 0.045) return false;
    audio.pause();
    if (audio.currentTime > limite()) audio.currentTime = limite();
    anterior.current = audio.currentTime;
    setTempo(audio.currentTime);
    setTrechoConcluido(true);
    const primeiro = Math.min(8, duracao || 8);
    if (!notificouPrimeiro.current && audio.currentTime >= primeiro - 0.15) {
      notificouPrimeiro.current = true;
      onPrimeiroTrecho?.();
    }
    return true;
  };

  // requestAnimationFrame impede que oscilação do evento timeupdate libere muito além dos 8 s.
  const verificar = (agora) => {
    const audio = player.current;
    if (!audio || audio.paused) return;
    if (pararNoLimite(audio)) return;
    if (agora - ultimaAtualizacao.current > 90) {
      ultimaAtualizacao.current = agora;
      setTempo(audio.currentTime);
    }
    quadro.current = requestAnimationFrame(verificar);
  };

  const iniciarReproducao = async () => {
    const audio = player.current;
    if (!audio || !carregado) return;
    if (!audio.paused) { audio.pause(); return; }
    // O botão principal repete do início se o trecho disponível já terminou.
    if (audio.currentTime >= limite() - .10) {
      audio.currentTime = 0;
      anterior.current = 0;
      setTrechoConcluido(false);
      setTempo(0);
    }
    try { await audio.play(); setErro(''); }
    catch { setErro('Não foi possível reproduzir este áudio. Tente novamente.'); }
  };

  const ouvirMais = async () => {
    const audio = player.current;
    if (!audio || !trechoConcluido) return;
    const novo = Math.min(liberado + 8, duracao || liberado + 8);
    if (novo <= liberado + .05) return;
    pedidos.current += 1;
    limiteAtual.current = novo;
    setLiberado(novo);
    setTrechoConcluido(false);
    onMetricas?.({ segundosReproduzidos: Math.round(ouvido.current * 10) / 10, pedidosMais: pedidos.current });
    // Continua exatamente de onde o trecho anterior parou.
    try { await audio.play(); setErro(''); }
    catch { setErro('Não foi possível continuar a reprodução. Use o botão central.'); }
  };

  useEffect(() => {
    onMetricas?.({ segundosReproduzidos: 0, pedidosMais: 0 });
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
      player.current?.pause();
    };
  }, [item.id]);

  const disponivel = Math.min(liberado, duracao || liberado);
  const totalSegmentos = Math.max(1, Math.min(12, Math.ceil((duracao || 40) / 8)));
  const progresso = duracao ? Math.min(100, tempo / duracao * 100) : 0;
  const limitePercentual = duracao ? Math.min(100, disponivel / duracao * 100) : 20;
  const podeMais = trechoConcluido && duracao > liberado + .1;
  const horas = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return <div className="audio-jogo" onPointerDown={(e) => e.stopPropagation()}>
    <audio ref={player} src={item.url} preload="metadata"
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) setDuracao(d);
        setCarregado(true);
        onCarregado?.();
      }}
      onPlay={() => {
        setTocando(true);
        if (quadro.current !== null) cancelAnimationFrame(quadro.current);
        quadro.current = requestAnimationFrame(verificar);
      }}
      onPause={(e) => { contar(e.currentTarget); setTocando(false); if (quadro.current !== null) cancelAnimationFrame(quadro.current); }}
      onTimeUpdate={(e) => { contar(e.currentTarget); pararNoLimite(e.currentTarget); }}
      onSeeking={(e) => {
        const audio = e.currentTarget;
        if (audio.currentTime > limite()) audio.currentTime = Math.max(0, limite() - .04);
        anterior.current = audio.currentTime;
      }}
      onEnded={(e) => { contar(e.currentTarget); setTocando(false); pararNoLimite(e.currentTarget); }}
      onError={() => setErro('Não foi possível carregar este áudio. Verifique a conexão.')} />

    <div className="audio-jogo-topo">
      <span className="audio-jogo-etapa">{trechoConcluido ? 'Trecho concluído' : `Trecho ${Math.max(1, Math.ceil(liberado / 8))}`}</span>
      <span className="audio-jogo-liberado">{Math.round(disponivel)}s liberados</span>
    </div>
    <div className="audio-jogo-marcas" aria-hidden="true">
      {Array.from({ length: totalSegmentos }, (_, n) => <span key={n} className={n / totalSegmentos * 100 < limitePercentual ? 'desbloqueado' : ''} />)}
    </div>
    <div className="audio-jogo-trilha" role="progressbar" aria-label="Progresso de reprodução do áudio"
      aria-valuenow={Math.floor(tempo)} aria-valuemin={0} aria-valuemax={Math.ceil(duracao || liberado)}>
      <div className="audio-jogo-janela" style={{ width: `${limitePercentual}%` }} />
      <div className="audio-jogo-preenchido" style={{ width: `${progresso}%` }} />
      <div className="audio-jogo-cursor" style={{ left: `${progresso}%` }} />
    </div>
    <div className="audio-jogo-tempos"><span>{horas(tempo)}</span><span>{duracao ? horas(duracao) : 'Carregando…'}</span></div>

    <div className="audio-jogo-controle">
      <button type="button" className="audio-jogo-reiniciar" onClick={() => {
        const a = player.current;
        if (a) { a.pause(); a.currentTime = 0; anterior.current = 0; setTempo(0); setTrechoConcluido(false); }
      }} disabled={!carregado} aria-label="Voltar ao início" title="Voltar ao início">↺</button>
      <button type="button" className="audio-jogo-play" onClick={iniciarReproducao} disabled={!carregado}
        aria-label={tocando ? 'Pausar áudio' : 'Reproduzir áudio'}>
        {tocando ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8z" /></svg>}
      </button>
      <span className="audio-jogo-duracao">{Math.round(disponivel)}s</span>
    </div>
    {podeMais ? <button type="button" className="audio-jogo-mais" onClick={ouvirMais}>+ Ouvir mais 8 segundos <span aria-hidden="true">→</span></button>
      : <p className="audio-jogo-instrucao">{trechoConcluido ? 'Você já pode classificar ou ouvir novamente.' : tocando ? 'Escutando…' : 'Toque em reproduzir para ouvir o trecho.'}</p>}
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
  if (item.tipo === 'texto') return <p className="m-texto">{item.texto}</p>;
  if (item.tipo === 'audio' && progressivo) return <AudioProgressivo item={item} onMetricas={onMetricas} onPrimeiroTrecho={onPrimeiroTrecho} onCarregado={onCarregado} />;
  const props = {
    ref, src: item.url, playsInline: true, preload: 'metadata',
    onLoadedMetadata: () => onCarregado?.(),
    onPlay: () => setTocando(true), onPause: () => setTocando(false), onEnded: () => setTocando(false),
  };
  if (item.tipo === 'video') return <div className="m-video"><video {...props} loop />{botao}</div>;
  return <div className="m-audio"><audio {...props} />{botao}</div>;
}
