import { useEffect, useRef, useState } from 'react';
import Midia from './Midia';
import { TIPOS } from '../lib/opcoes';

const LIMITE = 90;

// Esquerda = IA; direita = humano, independentemente do enunciado.
export default function SwipeCard({ item, onDecide, primeiro, pergunta, busy, erro, onConteudoCarregado }) {
  const [dx, setDx] = useState(0);
  const [saindo, setSaindo] = useState(0);
  const [arr, setArr] = useState(false);
  const [audioPronto, setAudioPronto] = useState(item.tipo !== 'audio');
  const [conteudoPronto, setConteudoPronto] = useState(item.tipo === 'texto');
  const ini = useRef(null);
  const metricas = useRef({ segundosReproduzidos: 0, pedidosMais: 0 });
  const t0 = useRef(performance.now());

  useEffect(() => { t0.current = performance.now(); }, [item.id]);

  const decidir = (dir) => {
    if (saindo || busy || !audioPronto || !conteudoPronto) return;
    setSaindo(dir);
    const ms = Math.round(performance.now() - t0.current);
    setTimeout(() => onDecide(dir < 0, ms, metricas.current).catch(() => setSaindo(0)), 220);
  };

  useEffect(() => {
    const k = (e) => {
      if (e.target?.closest?.('button, input, textarea, select')) return;
      if (e.key === 'ArrowLeft') decidir(-1);
      if (e.key === 'ArrowRight') decidir(1);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const down = (e) => { if (busy || !audioPronto || !conteudoPronto) return; ini.current = e.clientX; setArr(true); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (ini.current !== null) setDx(e.clientX - ini.current); };
  const up = () => {
    if (ini.current === null) return;
    ini.current = null; setArr(false);
    if (dx > LIMITE) decidir(1); else if (dx < -LIMITE) decidir(-1); else setDx(0);
  };

  const x = saindo ? saindo * 700 : dx;
  const forca = Math.min(Math.abs(x) / LIMITE, 1);

  return <>
    <h2 className="enunciado-teste">{pergunta}</h2>
    <div className="palco">
      <div className="carta" style={{ transform: `translateX(${x}px) rotate(${x / 18}deg)`,
        transition: arr ? 'none' : 'transform .22s ease',
        background: x ? `color-mix(in srgb, ${x > 0 ? 'var(--real)' : 'var(--ia)'} ${Math.round(forca * 30)}%, #fff)` : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="tag">{TIPOS[item.tipo]}</span>
        <div className="conteudo"><Midia item={item} progressivo={item.tipo === 'audio'}
          onMetricas={(m) => { metricas.current = m; }} onPrimeiroTrecho={() => setAudioPronto(true)}
          onCarregado={() => { t0.current = performance.now(); setConteudoPronto(true); onConteudoCarregado?.(); }} /></div>
        <b className="selo real" style={{ opacity: x > 0 ? forca : 0 }}>Humano</b>
        <b className="selo ia" style={{ opacity: x < 0 ? forca : 0 }}>IA</b>
      </div>
    </div>
    {primeiro && <p className="dica">Arraste: esquerda = IA, direita = humano. Ou use os botões.</p>}
    {!conteudoPronto && <p className="dica">Preparando conteúdo…</p>}
    {conteudoPronto && !audioPronto && <p className="dica">Escute o primeiro trecho de áudio antes de responder.</p>}
    {erro && <p className="erro" role="alert">{erro}</p>}
    <div className="botoes">
      <button type="button" className="b ia" disabled={busy || !audioPronto || !conteudoPronto || !!saindo}
        onClick={() => decidir(-1)}>Feito por IA</button>
      <button type="button" className="b real" disabled={busy || !audioPronto || !conteudoPronto || !!saindo}
        onClick={() => decidir(1)}>Feito por humano</button>
    </div>
  </>;
}
