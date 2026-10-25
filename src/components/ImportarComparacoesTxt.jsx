import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { criarItem } from '../lib/conteudosStorage';
import { analisarComparacoesTxt } from '../lib/comparacoesTxt';

// Apenas administração: nunca expõe gabarito aos participantes.
export default function ImportarComparacoesTxt({ recarregar }) {
  const [entrada, setEntrada] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [analisado, setAnalisado] = useState(false);
  const [status, setStatus] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erroArquivo, setErroArquivo] = useState('');
  const resultado = useMemo(() => analisarComparacoesTxt(entrada), [entrada]);
  const pares = resultado.grupos.flatMap((g) => g.pares);
  const concluido = pares.filter((p) => status[p.key]?.estado === 'sucesso').length;
  const temSalvos = concluido > 0;
  const pendentes = pares.filter((p) => status[p.key]?.estado !== 'sucesso');
  const pronto = analisado && entrada.trim() && !resultado.erros.length && pendentes.length > 0;

  function mudarEntrada(s) {
    setEntrada(s); setStatus({}); setAnalisado(false); setErroArquivo(''); setNomeArquivo('');
  }
  async function selecionarArquivo(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!/\.txt$/i.test(arquivo.name) || arquivo.size > 1024 * 1024) {
      setErroArquivo('Selecione um arquivo .txt de até 1 MB.');
      return;
    }
    try {
      mudarEntrada((await arquivo.text()).replace(/^\uFEFF/, ''));
      setNomeArquivo(arquivo.name);
    } catch {
      setErroArquivo('Não foi possível ler o arquivo TXT.');
    }
  }

  async function cadastrarPar(par) {
    let id = null;
    try {
      const { data, error } = await supabase.from('comparacoes')
        .insert({ tipo: 'texto', codigo_importacao: par.codigo, ativo: false })
        .select('id').single();
      if (error) throw error;
      id = data.id;
      for (const [indice, item] of par.itens.entries()) {
        await criarItem('texto', { texto: item.texto, ia: item.ia },
          item.id, { comparacao_id: id, posicao: indice + 1 });
      }
      const { error: ativacao } = await supabase.from('comparacoes')
        .update({ ativo: true }).eq('id', id);
      if (ativacao) throw ativacao;
      return { estado: 'sucesso', mensagem: 'Cadastrada com gabarito automático.' };
    } catch (e) {
      if (id) {
        // A exclusão em cascata remove os textos e respectivos gabaritos deste par.
        const { error: revert } = await supabase.from('comparacoes').delete().eq('id', id);
        if (revert) return { estado: 'erro', mensagem: `${e.message || 'Erro ao cadastrar.'} A reversão falhou; verifique o par inativo ${par.codigo} no Supabase.` };
      }
      return { estado: 'erro', mensagem: e.code === '23505'
        ? `Já existe ${par.codigo} cadastrado como comparação de texto. Não foi duplicado.`
        : e.message || 'Falha ao cadastrar.' };
    }
  }

  async function importar() {
    if (enviando || !pronto) return;
    setEnviando(true);
    let salvos = 0;
    try {
      for (const par of pendentes) {
        setStatus((s) => ({ ...s, [par.key]: { estado: 'enviando', mensagem: 'Salvando as duas peças...' } }));
        const proximo = await cadastrarPar(par);
        setStatus((s) => ({ ...s, [par.key]: proximo }));
        if (proximo.estado === 'sucesso') salvos++;
      }
      if (salvos) await recarregar();
    } finally { setEnviando(false); }
  }

  function limpar() { mudarEntrada(''); }

  return <section className="painel larga importar-comparacoes-txt">
    <h2>Importar comparações de texto por TXT (gabarito automático)</h2>
    <p className="mut">Envie o TXT <strong>identificado para o administrador</strong>, com quatro textos em cada grupo (2 IA + 2 HUMANOS). O sistema reconhece o grupo e o gabarito sozinho, criando <strong>duas comparações IA × humano</strong> por grupo. Não envie a versão sem gabarito.</p>
    <label className="lote-nome" htmlFor="comparacoes-txt-arquivo"><span>Escolha o TXT administrativo</span></label>
    <input id="comparacoes-txt-arquivo" type="file" accept=".txt,text/plain" disabled={enviando || temSalvos} onChange={selecionarArquivo} />
    {nomeArquivo && <p className="mut">Arquivo: {nomeArquivo}</p>}
    {erroArquivo && <p className="erro" role="alert">{erroArquivo}</p>}
    <details className="comparacao-zip-exemplos">
      <summary>Formato esperado (também aceita C1.0 - IA sem os traços)</summary>
      <pre className="codigo">{'--- GRUPO #1 ---\n--- C1.0 - IA ---\nTexto gerado por IA.\n\n--- C1.1 - HUMANO ---\nTexto humano original.\n\n--- C1.2 - IA ---\nOutro texto gerado por IA.\n\n--- C1.3 - REAL ---\nOutro texto humano.'}</pre>
      <p className="mut">Os números após o ponto são os índices dos quatro textos, de 0 a 3. O importador não confunde esses índices com os pares C1.P1 e C1.P2.</p>
    </details>
    <label className="lote-nome" htmlFor="comparacoes-txt-colagem"><span>Ou cole o conteúdo do TXT</span></label>
    <textarea id="comparacoes-txt-colagem" className="textos-colagem" rows="7"
      placeholder="--- C1.0 - IA ---\n...\n--- C1.1 - HUMANO ---\n..."
      value={entrada} disabled={enviando || temSalvos}
      onChange={(e) => mudarEntrada(e.target.value)} />
    {!analisado && <button type="button" className="cta" disabled={!entrada.trim() || enviando}
      onClick={() => setAnalisado(true)}>Analisar grupos e gabaritos</button>}
    {analisado && <>
      <p className="mut" role="status">{resultado.grupos.length} grupo(s), {resultado.totalTextos} texto(s), {resultado.totalPares} par(es) válidos. {concluido} par(es) cadastrado(s).</p>
      {!!resultado.erros.length && <div className="lote-erros" role="alert"><strong>Corrija o arquivo antes de importar:</strong><ul>{resultado.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      <div className="comparacao-zip-grupos">
        {resultado.grupos.map((g) => <article className="comparacao-zip-grupo" key={g.codigo}>
          <div className="comparacao-zip-titulo"><strong>Grupo {g.codigo}</strong>
            <span className="lote-status">{g.itens.length}/4 textos · {g.itens.filter((x) => x.ia).length} IA · {g.itens.filter((x) => !x.ia).length} humanos</span></div>
          {g.itens.map((it) => <p className="comparacao-zip-peca" key={it.id}>
            <span><b>{it.id}</b> · {it.ia ? 'IA' : 'Humano'}</span>
            <span className="texto-previa">{it.texto.slice(0, 160)}{it.texto.length > 160 ? '…' : ''}</span>
          </p>)}
          {g.pares.map((p) => <p className="mut" key={p.key}>
            <b>{p.codigo}:</b> {p.itens.map((it) => it.id).join(' × ')} · {status[p.key]?.estado === 'sucesso' ? 'Cadastrado' : status[p.key]?.estado === 'enviando' ? 'Salvando…' : 'Aguardando'}
            {status[p.key]?.estado === 'erro' && <span className="erro" role="alert"> — {status[p.key].mensagem}</span>}
          </p>)}
        </article>)}
      </div>
      <button type="button" className="cta" disabled={enviando || !pronto} onClick={importar}>
        {enviando ? 'Importando comparações…' : `Cadastrar ${pendentes.length} comparação(ões) com gabarito`}
      </button>
    </>}
    <button type="button" className="link" disabled={enviando} onClick={limpar}>
      {temSalvos ? 'Preparar outra importação' : 'Limpar seleção'}
    </button>
    <p className="mut">O gabarito é salvo na tabela protegida <code>gabarito</code>. Os participantes não recebem os rótulos IA/Humano nem os nomes internos.</p>
  </section>;
}
