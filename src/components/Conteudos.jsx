import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TIPOS } from '../lib/opcoes';

const CEN = ['nenhum é IA', 'um é IA', 'todos são IA'];
const vazio = () => ({ arq: null, texto: '', ia: true });
const aceita = (t) => (t === 'imagem' ? 'image/*' : t === 'audio' ? 'audio/*' : 'video/*');

async function subir(tipo, arq) {
  const ext = arq.name.split('.').pop().toLowerCase();
  const path = `${tipo}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from('midia').upload(path, arq, { contentType: arq.type });
  if (up.error) throw up.error;
  return supabase.storage.from('midia').getPublicUrl(path).data.publicUrl;
}

async function criarItem(tipo, it, titulo, extra) {
  const url = tipo === 'texto' ? null : await subir(tipo, it.arq);
  const { data, error } = await supabase.from('conteudos')
    .insert({ tipo, titulo: titulo || null, url, texto: tipo === 'texto' ? it.texto.trim() : null, ...extra }).select('id').single();
  if (error) throw error;
  const g = await supabase.from('gabarito').insert({ conteudo_id: data.id, eh_ia: it.ia });
  if (g.error) { await supabase.from('conteudos').delete().eq('id', data.id); throw g.error; }
}

function Editor({ it, onChange, tipo, rotulo }) {
  return (
    <div className="editor">
      {rotulo && <h3>{rotulo}</h3>}
      {tipo === 'texto'
        ? <textarea rows="4" placeholder="Cole o texto aqui" value={it.texto} onChange={(e) => onChange({ texto: e.target.value })} />
        : <input type="file" accept={aceita(tipo)} onChange={(e) => onChange({ arq: e.target.files[0] || null })} />}
      <div className="chips">
        <button type="button" className={'chip' + (it.ia ? ' on' : '')} onClick={() => onChange({ ia: true })}>É feito por IA</button>
        <button type="button" className={'chip' + (!it.ia ? ' on' : '')} onClick={() => onChange({ ia: false })}>É real (sem IA)</button>
      </div>
    </div>
  );
}

export default function Conteudos({ lista, comparacoes, recarregar }) {
  const [modo, setModo] = useState('indiv');
  const [tipo, setTipo] = useState('imagem');
  const [titulo, setTitulo] = useState('');
  const [itens, setItens] = useState([vazio(), vazio()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const setItem = (k) => (p) => setItens((a) => a.map((x, n) => (n === k ? { ...x, ...p } : x)));
  const n = modo === 'indiv' ? 1 : 2;
  const completo = itens.slice(0, n).every((it) => (tipo === 'texto' ? it.texto.trim() : it.arq));

  async function salvar(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    const form = e.target; let compId = null;
    try {
      if (modo === 'indiv') await criarItem(tipo, itens[0], titulo, {});
      else {
        const c = await supabase.from('comparacoes').insert({ tipo }).select('id').single();
        if (c.error) throw c.error;
        compId = c.data.id;
        for (let k = 0; k < 2; k++) await criarItem(tipo, itens[k], titulo ? `${titulo}-${k + 1}` : null, { comparacao_id: compId, posicao: k + 1 });
      }
      setItens([vazio(), vazio()]); setTitulo(''); form.reset();
      setMsg('Adicionado.'); recarregar();
    } catch (err) {
      if (compId) await supabase.from('comparacoes').delete().eq('id', compId);
      setMsg(err.message || 'Erro ao salvar.');
    } finally { setBusy(false); }
  }

  async function apagar(tabela, id) {
    if (!confirm('Apagar? As respostas dadas a isso também serão apagadas.')) return;
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) setMsg(error.message); else recarregar();
  }

  const indiv = lista.filter((c) => !c.comparacao_id);
  const comps = comparacoes.map((c) => {
    const it = lista.filter((x) => x.comparacao_id === c.id);
    return { ...c, nIA: it.filter((x) => x.eh_ia).length, nItens: it.length };
  });

  return (
    <div className="grade">
      <section className="painel">
        <h2>Adicionar</h2>
        <form className="form-cont" onSubmit={salvar}>
          <div className="chips">
            <button type="button" className={'chip' + (modo === 'indiv' ? ' on' : '')} onClick={() => setModo('indiv')}>Individual (parte 1)</button>
            <button type="button" className={'chip' + (modo === 'comp' ? ' on' : '')} onClick={() => setModo('comp')}>Comparação (parte 2)</button>
          </div>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setItens([vazio(), vazio()]); }}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="Nome interno neutro (ex.: img-07)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          {itens.slice(0, n).map((it, k) => (
            <Editor key={tipo + modo + k} it={it} tipo={tipo} onChange={setItem(k)} rotulo={modo === 'comp' ? `Conteúdo ${k + 1}` : null} />
          ))}
          {msg && <p className="mut">{msg}</p>}
          <button className="cta" disabled={busy || !completo}>{busy ? 'Enviando…' : 'Adicionar'}</button>
        </form>
      </section>

      <section className="painel">
        <h2>Cobertura por tipo</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Tipo</th><th>Individuais</th><th>Comparações</th></tr></thead>
            <tbody>
              {Object.entries(TIPOS).map(([k, v]) => {
                const i = indiv.filter((c) => c.tipo === k), cc = comps.filter((c) => c.tipo === k);
                return (
                  <tr key={k}>
                    <td><b>{v}</b></td>
                    <td>{i.length} ({i.filter((c) => c.eh_ia).length} IA · {i.filter((c) => !c.eh_ia).length} real)</td>
                    <td>{cc.length} ({[0, 1, 2].map((q) => `${cc.filter((c) => c.nIA === q).length} ${CEN[q]}`).join(' · ')})</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="painel larga">
        <h2>Individuais ({indiv.length})</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Tipo</th><th>Nome</th><th>Gabarito</th><th /></tr></thead>
            <tbody>
              {indiv.map((c) => (
                <tr key={c.id}>
                  <td>{TIPOS[c.tipo]}</td><td>{c.titulo || '—'}</td>
                  <td><span className={'sel ' + (c.eh_ia ? 'ia' : 'real')}>{c.eh_ia ? 'IA' : 'Real'}</span></td>
                  <td><button className="link" onClick={() => apagar('conteudos', c.id)}>Apagar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 style={{ marginTop: 20 }}>Comparações ({comps.length})</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Tipo</th><th>Itens</th><th>Gabarito</th><th /></tr></thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id}>
                  <td>{TIPOS[c.tipo]}</td>
                  <td>{lista.filter((x) => x.comparacao_id === c.id).map((x) => x.titulo || '—').join(' | ')}</td>
                  <td><span className="sel real">{CEN[c.nIA]}</span></td>
                  <td><button className="link" onClick={() => apagar('comparacoes', c.id)}>Apagar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
