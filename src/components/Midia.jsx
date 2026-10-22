import { useEffect, useRef, useState } from 'react';

// A liberação é real: a reprodução é pausada no limite, e avançar a barra não o ultrapassa.
function AudioProgressivo({ item, onMetricas, onPrimeiroTrecho, onCarregado }) {
  const ref = useRef(null);
  const ultimo = useRef(0);
  const ouvindo = useRef(0);
  const pedidos = useRef(0);
  const avisou = useRef(false);
  const [duracao, setDuracao] = useState(0);
  const [liberado, setLiberado] = useState(8);
  const [tocando, setTocando] = useState(false);
  const [trechoPronto, setTrechoPronto] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    onMetricas?.({ segundosReproduzidos: 0, pedidosMais: 0 });
    return () => { if (ref.current) ref.current.pause(); };
  }, [item.id]);

  const terminoTrecho = () => {
    const primeiro = Math.min(8, duracao || 8);
    if (!avisou.current && (ref.current?.currentTime || 0) >= primeiro - 0.15) {
      avisou.current = true;
      onPrimeiroTrecho?.();
    }
    setTrechoPronto(true);
  };

  const atualizar = () => {
    const a = ref.current;
    if (!a) return;
    const t = a.currentTime;
    const delta = t - ultimo.current;
    // Conta apenas tempo de áudio reproduzido; saltos na linha do tempo não contam.
    if (!a.paused && delta > 0 && delta < 1.5) ouvindo.current += delta;
    ultimo.current = t;
    onMetricas?.({ segundosReproduzidos: Math.round(ouvindo.current * 10) / 10, pedidosMais: pedidos.current });
    if (t >= Math.min(liberado, duracao || liberado) - 0.06) {
      a.pause();
      terminoTrecho();
    }
  };

  const tocar = async () => {
    const a = ref.current;
    if (!a) return;
    if (!a.paused) return a.pause();
    if (a.currentTime >= Math.min(liberado, duracao || liberado) - .1) {
      a.currentTime = 0;
      ultimo.current = 0;
    }
    try { await a.play(); setErro(''); } catch { setErro('Não foi possível reproduzir. Tente novamente.'); }
  };

  const ampliar = () => {
    const novo = Math.min(duracao || liberado + 8, liberado + 8);
    if (novo <= liberado) return;
    pedidos.current += 1;
    setLiberado(novo);
    setTrechoPronto(false);
    onMetricas?.({ segundosReproduzidos: Math.round(ouvindo.current * 10) / 10, pedidosMais: pedidos.current });
  };

  return <div className="audio-progressivo">
    <audio ref={ref} src={item.url} preload="metadata"
      onLoadedMetadata={(e) => { setDuracao(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0); onCarregado?.(); }}
      onPlay={() => setTocando(true)} onPause={() => setTocando(false)}
      onTimeUpdate={atualizar} onSeeking={() => {
        const a = ref.current;
        if (a && a.currentTime > liberado) a.currentTime = Math.max(0, liberado - .15);
        ultimo.current = a?.currentTime || 0;
      }}
      onEnded={() => { setTocando(false); terminoTrecho(); }} />
    <button type="button" className="tocar" onPointerDown={(e) => e.stopPropagation()} onClick={tocar}>
      {tocando ? 'Pausar' : 'Ouvir áudio'}
    </button>
    <p className="mut audio-progresso">{duracao ? `Trecho disponível: ${Math.min(liberado, Math.ceil(duracao))} s de ${Math.ceil(duracao)} s` : 'Carregando duração…'}</p>
    {trechoPronto && duracao > liberado + .15 &&
      <button type="button" className="cta ouvir-mais" onPointerDown={(e) => e.stopPropagation()} onClick={ampliar}>
        Ouvir mais 8 segundos
      </button>}
    {trechoPronto && <p className="mut audio-progresso">Você já pode responder ou ouvir novamente.</p>}
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
    {!carregado && !falha && <p className="mut imagem-carregando">Carregando imagem…</p>}
    {falha && <p role="alert" className="erro">Não foi possível carregar esta imagem.</p>}
    <img className="m-img" src={item.url} alt="Conteúdo para identificar" draggable={false}
      loading="eager" decoding="async" fetchPriority="high" onLoad={() => { setCarregado(true); onCarregado?.(); }}
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
