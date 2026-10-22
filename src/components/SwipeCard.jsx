import { useEffect, useRef, useState } from 'react';
import Midia from './Midia';
import { TIPOS } from '../lib/opcoes';

const LIMITE = 90;

// direita (+1) = sem IA | esquerda (-1) = IA
export default function SwipeCard({ item, onDecide, primeiro }) {
  const [dx, setDx] = useState(0);
  const [saindo, setSaindo] = useState(0);
  const [arr, setArr] = useState(false);
  const ini = useRef(null);
  const t0 = useRef(performance.now());

  useEffect(() => { t0.current = performance.now(); }, [item.id]);

  const decidir = (dir) => {
    if (saindo) return;
    setSaindo(dir);
    const ms = Math.round(performance.now() - t0.current);
    setTimeout(() => onDecide(dir < 0, ms), 220);
  };

  useEffect(() => {
    const k = (e) => { if (e.key === 'ArrowLeft') decidir(-1); if (e.key === 'ArrowRight') decidir(1); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const down = (e) => { ini.current = e.clientX; setArr(true); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (ini.current !== null) setDx(e.clientX - ini.current); };
  const up = () => {
    if (ini.current === null) return;
    ini.current = null; setArr(false);
    if (dx > LIMITE) decidir(1); else if (dx < -LIMITE) decidir(-1); else setDx(0);
  };

  const x = saindo ? saindo * 700 : dx;
  const forca = Math.min(Math.abs(x) / LIMITE, 1);

  return (
    <>
      <div className="palco">
        <div
          className="carta"
          style={{ transform: `translateX(${x}px) rotate(${x / 18}deg)`, transition: arr ? 'none' : 'transform .22s ease', background: x ? `color-mix(in srgb, ${x > 0 ? 'var(--real)' : 'var(--ia)'} ${Math.round(forca * 30)}%, #fff)` : undefined }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        >
          <span className="tag">{TIPOS[item.tipo]}</span>
          <div className="conteudo"><Midia item={item} /></div>
          <b className="selo real" style={{ opacity: x > 0 ? forca : 0 }}>Sem IA</b>
          <b className="selo ia" style={{ opacity: x < 0 ? forca : 0 }}>IA</b>
        </div>
      </div>
      {primeiro && <p className="dica">Arraste a carta (ou use as setas ← →): direita = sem IA, esquerda = IA.</p>}
      <div className="botoes">
        <button className="b ia" onClick={() => decidir(-1)}>Feito por IA</button>
        <button className="b real" onClick={() => decidir(1)}>Sem IA</button>
      </div>
    </>
  );
}
