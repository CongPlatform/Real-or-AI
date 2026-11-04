import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TIPOS } from '../lib/opcoes';
import { statsConteudos } from '../lib/stats';
import { f1 } from '../lib/formatos';

function Previa({ c }) {
  if (c.tipo === 'texto') return <p>{c.texto}</p>;
  if (!c.url) return <span className="mut">Sem prévia (rode o schema.sql atualizado).</span>;
  if (c.tipo === 'imagem') return <img src={c.url} alt="" loading="lazy" />;
  if (c.tipo === 'audio') return <audio controls preload="none" src={c.url} />;
  return <video controls preload="metadata" playsInline src={c.url} />;
}

export default function Revisao({ d, recarregar }) {
  const [tipo, setTipo] = useState('todos');
  const [gab, setGab] = useState('todos');
  const [ordem, setOrdem] = useState('suspeitos');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(null);
  const st = useMemo(() => statsConteudos(d), [d]);

  const itens = useMemo(() => {
    const ativa = new Map((d.comparacoes || []).map((c) => [c.id, c.ativo]));
    let l = d.conteudos.map((c) => {
      const e = st.get(c.id) || { n: 0, a: 0, ia: 0 };
      return { ...c, ...e, pct: e.n ? (100 * e.a) / e.n : NaN, pctIA: e.n ? (100 * e.ia) / e.n : NaN, arquivado: c.comparacao_id ? !ativa.get(c.comparacao_id) : !c.ativo };
    });
    if (tipo !== 'todos') l = l.filter((c) => c.tipo === tipo);
    if (gab === 'ia') l = l.filter((c) => c.eh_ia && !c.arquivado);
    if (gab === 'real') l = l.filter((c) => !c.eh_ia && !c.arquivado);
    if (gab === 'arquivados') l = l.filter((c) => c.arquivado);
    if (ordem === 'suspeitos') l.sort((a, b) => (b.n >= 5) - (a.n >= 5) || (Number.isFinite(a.pct) ? a.pct : 101) - (Number.isFinite(b.pct) ? b.pct : 101));
    if (ordem === 'respostas') l.sort((a, b) => b.n - a.n);
    if (ordem === 'recentes') l.reverse();
    return l;
  }, [d, st, tipo, gab, ordem]);

  const suspeito = (c) => c.n >= 8 && c.pct < 30;

  async function mudar(c, novo) {
    if (c.eh_ia === novo) return;
    const alvo = novo ? 'IA' : 'Real (sem IA)';
    if (!confirm(`Mudar "${c.titulo || TIPOS[c.tipo]}" para ${alvo}?\n\nAs ${c.n} respostas já dadas serão recalculadas. Nada é apagado e dá para desfazer mudando de novo.`)) return;
    setBusy(c.id); setMsg('');
    const { data, error } = await supabase.rpc('corrigir_origem', { p_conteudo: c.id, p_eh_ia: novo });
    setBusy(null);
    if (error) return setMsg('Erro: ' + error.message);
    setMsg(`Corrigido para ${alvo}: ${data.respostas} respostas conferidas, ${data.mudaram} mudaram de certo para errado ou o contrário.` + (data.comp_legadas ? ` ${data.comp_legadas} respostas antigas de comparação não guardaram os itens marcados e não podem ser recalculadas.` : ''));
    recarregar();
  }

  async function arquivar(c) {
    const tabela = c.comparacao_id ? 'comparacoes' : 'conteudos';
    const id = c.comparacao_id || c.id;
    const { error } = await supabase.from(tabela).update({ ativo: c.arquivado }).eq('id', id);
    if (error) setMsg('Erro: ' + error.message); else recarregar();
  }

  return (
    <div className="dash">
      <div className="secao-topo">
        <div>
          <h2>Revisar conteúdos</h2>
          <p className="mut">Veja, ouça e confirme se cada gabarito está certo. Ao corrigir, todas as respostas já dadas são recalculadas na hora. Arquivar tira o item do teste sem apagar nenhuma resposta.</p>
        </div>
      </div>
      <div className="rev-filtros">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={gab} onChange={(e) => setGab(e.target.value)}>
          <option value="todos">Qualquer gabarito</option><option value="ia">Só IA</option><option value="real">Só reais</option><option value="arquivados">Arquivados</option>
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
          <option value="suspeitos">Menor acerto primeiro (mais suspeitos)</option><option value="respostas">Mais respondidos</option><option value="recentes">Mais recentes</option>
        </select>
        <span className="mut">{itens.length} itens</span>
      </div>
      {msg && <p className="aviso">{msg}</p>}
      <div className="rev-grid">
        {itens.map((c) => (
          <article key={c.id} className={'rev-card' + (c.arquivado ? ' arquivado' : '')}>
            <div className="rev-midia"><Previa c={c} /></div>
            <div className="rev-corpo">
              <div className="rev-meta">
                <span>{TIPOS[c.tipo]}{c.comparacao_id ? ` · comparação, item ${c.posicao || '?'}` : ''}</span>
                <span>{c.titulo || '—'}</span>
              </div>
              <div className="rev-stats">
                {c.n ? <>{c.n} respostas · <b>{f1(c.pct, 0)}% acertaram</b> · {f1(c.pctIA, 0)}% disseram “IA”</> : 'Sem respostas ainda'}
                {suspeito(c) && <div className="rev-alerta">Acerto muito baixo: confira se o gabarito está certo.</div>}
                {c.arquivado && <div>Arquivado (fora do teste)</div>}
              </div>
              <div className="rev-acoes">
                <button className={'op ia' + (c.eh_ia ? ' on' : '')} disabled={busy === c.id} onClick={() => mudar(c, true)}>É IA</button>
                <button className={'op real' + (c.eh_ia === false ? ' on' : '')} disabled={busy === c.id} onClick={() => mudar(c, false)}>É real</button>
              </div>
              <button className="link" onClick={() => arquivar(c)}>{c.arquivado ? 'Reativar no teste' : c.comparacao_id ? 'Arquivar a rodada' : 'Arquivar (sem apagar)'}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
