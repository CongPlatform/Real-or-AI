import { useRef, useState } from 'react';

export default function Midia({ item }) {
  const ref = useRef(null);
  const [tocando, setTocando] = useState(false);
  const alterna = () => { const m = ref.current; if (m) (m.paused ? m.play() : m.pause()); };
  const botao = (
    <button className="tocar" onPointerDown={(e) => e.stopPropagation()} onClick={alterna}>
      {tocando ? 'Pausar' : 'Tocar'}
    </button>
  );
  if (item.tipo === 'imagem') return <img className="m-img" src={item.url} alt="" draggable={false} />;
  if (item.tipo === 'texto') return <p className="m-texto">{item.texto}</p>;
  const props = {
    ref, src: item.url, playsInline: true, preload: 'auto',
    onPlay: () => setTocando(true), onPause: () => setTocando(false), onEnded: () => setTocando(false),
  };
  if (item.tipo === 'video') return <div className="m-video"><video {...props} loop />{botao}</div>;
  return <div className="m-audio"><audio {...props} />{botao}</div>;
}
