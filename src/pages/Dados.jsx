import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { exportarCSV } from '../lib/exportar';
import { TIPOS } from '../lib/opcoes';
import { f1 } from '../lib/formatos';

export default function Dados({ d, s, recarregar }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const linhas = useMemo(() => {
    const m = new Map(), c = new Map();
    d.respostas.forEach((r) => { const o = m.get(r.participante_id) || { n: 0, a: 0 }; o.n++; if (r.acertou) o.a++; m.set(r.participante_id, o); });
    (d.resp_comp || []).forEach((r) => c.set(r.participante_id, (c.get(r.participante_id) || 0) + 1));
    return [...d.participantes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((p) => ({ ...p, n: m.get(p.id)?.n || 0, a: m.get(p.id)?.a || 0, rod: c.get(p.id) || 0 }));
  }, [d]);

  async function recalcular() {
    if (!confirm('Recalcular todas as respostas com base no gabarito atual? Nada é apagado.')) return;
    setBusy(true); setMsg('');
    const { data, error } = await supabase.rpc('recalcular_respostas');
    setBusy(false);
    if (error) return setMsg('Erro: ' + error.message);
    setMsg(`Pronto: ${data.individuais_corrigidas} respostas individuais e ${data.comparacoes_corrigidas} de comparação foram corrigidas.` + (data.comparacoes_legadas ? ` ${data.comparacoes_legadas} respostas antigas de comparação não podem ser recalculadas.` : ''));
    recarregar();
  }

  const nome = (id) => { const c = d.conteudos.find((x) => x.id === id); return c ? `${TIPOS[c.tipo]} ${c.titulo || ''}`.trim() : 'conteúdo removido'; };

  return (
    <div className="dash">
      <div className="secao-topo">
        <div><h2>Dados</h2><p className="mut">Tudo o que foi coletado, exportação e manutenção. Nenhuma ação aqui apaga respostas.</p></div>
        <div className="chips">
          <button className="chip" disabled={!s.linhas.length} onClick={() => exportarCSV(s.linhas)}>Baixar CSV (analisados)</button>
          <button className="chip" disabled={busy} onClick={recalcular}>Recalcular todas as respostas</button>
        </div>
      </div>
      {msg && <p className="aviso">{msg}</p>}
      <section className="painel larga">
        <h2>Participantes ({linhas.length})</h2>
        <div className="rolagem tabela-alta">
          <table>
            <thead><tr><th>Quando</th><th>Idade</th><th>Escolaridade</th><th>Usa IA</th><th>Acertos</th><th>%</th><th>Comparações</th><th>Status</th></tr></thead>
            <tbody>
              {linhas.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{p.faixa_etaria}</td><td>{p.escolaridade}</td><td>{p.freq_ia}</td>
                  <td>{p.a}/{p.n}</td><td>{p.n ? f1((100 * p.a) / p.n, 0) : '—'}</td><td>{p.rod}</td>
                  <td>{p.finalizado ? 'Finalizou' : 'Parcial'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="painel larga">
        <h2>Histórico de correções de gabarito</h2>
        {!(d.correcoes || []).length ? <p className="mut">Nenhuma correção feita ainda.</p> : (
          <div className="rolagem tabela-alta">
            <table>
              <thead><tr><th>Quando</th><th>Conteúdo</th><th>De → Para</th><th>Respostas conferidas</th><th>Mudaram</th></tr></thead>
              <tbody>
                {d.correcoes.map((x, i) => (
                  <tr key={i}>
                    <td>{new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{nome(x.conteudo_id)}</td><td>{x.de ? 'IA' : 'Real'} → {x.para ? 'IA' : 'Real'}</td><td>{x.afetadas}</td><td>{x.alteradas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
