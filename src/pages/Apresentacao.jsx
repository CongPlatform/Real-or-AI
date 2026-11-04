import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SLIDES, Slide } from '../slides/slides';

const LS = 'realia_slides_v1';
const IDS = SLIDES.map((d) => d.id);

function inicial() {
  let x = null;
  try { x = JSON.parse(localStorage.getItem(LS)); } catch { /* ignora */ }
  const ord = (x?.ordem || []).filter((i) => IDS.includes(i));
  return {
    ordem: [...ord, ...IDS.filter((i) => !ord.includes(i))],
    marcados: x?.marcados ? x.marcados.filter((i) => IDS.includes(i)) : SLIDES.filter((d) => d.padrao).map((d) => d.id),
  };
}

function Apresentar({ lista, s, onFechar }) {
  const [i, setI] = useState(0);
  const [k, setK] = useState(1);
  useEffect(() => {
    const f = () => setK(Math.min(innerWidth / 1280, innerHeight / 720));
    f(); addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    const t = (e) => {
      if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) setI((n) => Math.min(n + 1, lista.length - 1));
      if (['ArrowLeft', 'PageUp'].includes(e.key)) setI((n) => Math.max(n - 1, 0));
      if (e.key === 'Escape') onFechar();
    };
    addEventListener('keydown', t);
    return () => removeEventListener('keydown', t);
  }, [lista.length, onFechar]);
  return (
    <div className="apres" onClick={(e) => { if (!e.target.closest('.apres-barra')) setI((n) => Math.min(n + 1, lista.length - 1)); }}>
      <div style={{ width: 1280 * k, height: 720 * k }}>
        <div style={{ transform: `scale(${k})`, transformOrigin: 'top left', width: 1280, height: 720 }}>
          <Slide def={lista[i]} s={s} />
        </div>
      </div>
      <div className="apres-barra">
        <button onClick={() => setI((n) => Math.max(n - 1, 0))}>←</button>
        <span>{i + 1}/{lista.length}</span>
        <button onClick={() => setI((n) => Math.min(n + 1, lista.length - 1))}>→</button>
        <button onClick={onFechar}>Sair</button>
      </div>
    </div>
  );
}

export default function Apresentacao({ s }) {
  const [est, setEst] = useState(inicial);
  const [rodando, setRodando] = useState(false);
  const [imp, setImp] = useState(false);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(est)); } catch { /* ignora */ } }, [est]);

  const lista = useMemo(
    () => est.ordem.filter((id) => est.marcados.includes(id)).map((id) => SLIDES.find((d) => d.id === id)).filter((d) => d.ok(s)),
    [est, s],
  );

  useEffect(() => {
    if (!imp) return undefined;
    const fim = () => setImp(false);
    addEventListener('afterprint', fim);
    const t = setTimeout(() => window.print(), 500);
    return () => { clearTimeout(t); removeEventListener('afterprint', fim); };
  }, [imp]);

  const alterna = (id) => setEst((e) => ({ ...e, marcados: e.marcados.includes(id) ? e.marcados.filter((x) => x !== id) : [...e.marcados, id] }));
  const mover = (id, d) => setEst((e) => {
    const o = [...e.ordem], a = o.indexOf(id), b = a + d;
    if (b < 0 || b >= o.length) return e;
    [o[a], o[b]] = [o[b], o[a]];
    return { ...e, ordem: o };
  });
  const iniciar = () => { try { document.documentElement.requestFullscreen?.(); } catch { /* ignora */ } setRodando(true); };
  const fechar = () => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* ignora */ } setRodando(false); };

  return (
    <div className="dash">
      <div className="secao-topo">
        <div>
          <h2>Apresentação</h2>
          <p className="mut">Marque os slides que entram, mude a ordem com ↑ ↓ e apresente em tela cheia (setas do teclado ou toque). Os números vêm sempre dos dados atuais e cada slide mostra quantas pessoas e respostas ele considera.</p>
        </div>
        <div className="chips">
          <button className="cta" disabled={!lista.length} onClick={iniciar}>Apresentar ({lista.length})</button>
          <button className="chip" disabled={!lista.length} onClick={() => setImp(true)}>Salvar em PDF</button>
          <button className="chip" onClick={() => setEst((e) => ({ ...e, marcados: SLIDES.filter((d) => d.padrao).map((d) => d.id) }))}>Só os recomendados</button>
          <button className="chip" onClick={() => setEst((e) => ({ ...e, marcados: IDS }))}>Todos</button>
        </div>
      </div>

      <div className="picker">
        {est.ordem.map((id, n) => {
          const d = SLIDES.find((x) => x.id === id);
          const disp = d.ok(s), on = est.marcados.includes(id) && disp;
          return (
            <div key={id} className={'pick' + (on ? '' : ' off')}>
              <input type="checkbox" checked={on} disabled={!disp} onChange={() => alterna(id)} aria-label={d.nome} />
              <div className="thumb">{disp ? <div><Slide def={d} s={s} /></div> : <span className="mut">sem dados</span>}</div>
              <div><b>{d.nome}</b>{d.padrao && <span className="sel real" style={{ marginLeft: 8 }}>recomendado</span>}{!disp && <p className="mut">Ainda não há dados para este slide.</p>}</div>
              <div className="mover">
                <button className="chip" disabled={n === 0} onClick={() => mover(id, -1)} aria-label="Subir">↑</button>
                <button className="chip" disabled={n === est.ordem.length - 1} onClick={() => mover(id, 1)} aria-label="Descer">↓</button>
              </div>
            </div>
          );
        })}
      </div>

      {rodando && lista.length > 0 && <Apresentar lista={lista} s={s} onFechar={fechar} />}
      {imp && createPortal(<div className="so-impressao">{lista.map((d) => <Slide key={d.id} def={d} s={s} />)}</div>, document.body)}
    </div>
  );
}
