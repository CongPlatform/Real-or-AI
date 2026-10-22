import { useEffect, useState } from 'react';
import { criarItem } from '../lib/conteudosStorage';
import { ACCEPT, FORMATOS, arquivoValido, nomeArquivoSemExtensao, tamanhoFormatado } from '../lib/arquivosLote';

// Miniatura local: não envia nada ao servidor até o botão de cadastro ser acionado.
function PreviaLocal({ arquivo, tipo }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const proxima = URL.createObjectURL(arquivo);
    setUrl(proxima);
    return () => URL.revokeObjectURL(proxima);
  }, [arquivo]);
  if (!url) return null;
  if (tipo === 'audio') return <audio className="lote-player" src={url} controls preload="none" />;
  return <video className="lote-player lote-video" src={url} controls preload="metadata" playsInline />;
}

export default function ImportacaoMidiasEmLote({ tipo, recarregar }) {
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const nomes = tipo === 'audio' ? { plural: 'áudios', singular: 'áudio' } : { plural: 'vídeos', singular: 'vídeo' };
  const concluidos = arquivos.filter((item) => item.status === 'sucesso').length;
  const pendentes = arquivos.length - concluidos;
  const semClassificacao = arquivos.some((item) => item.status !== 'sucesso' && typeof item.ia !== 'boolean');
  const todasIA = arquivos.length > 0 && arquivos.every((item) => item.ia === true);
  const todasReais = arquivos.length > 0 && arquivos.every((item) => item.ia === false);

  const atualizar = (id, alteracoes) => setArquivos((anteriores) =>
    anteriores.map((item) => item.id === id ? { ...item, ...alteracoes } : item));

  function selecionar(e) {
    const selecionados = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selecionados.length) return;
    const validos = selecionados.filter((arquivo) => arquivoValido(tipo, arquivo));
    const ignorados = selecionados.length - validos.length;
    // Não mantém nenhum item da seleção anterior: o usuário vê exatamente o lote atual.
    setArquivos(validos.map((arquivo) => ({
      id: crypto.randomUUID(), arquivo,
      titulo: nomeArquivoSemExtensao(arquivo.name),
      ia: null, status: 'pendente', erro: '',
    })));
    setAviso((ignorados ? `${ignorados} arquivo(s) vazio(s) ou com formato incompatível foram ignorados. ` : '') +
      (validos.length ? `${validos.length} arquivo(s) selecionado(s). Confira os títulos e marque IA ou Real antes de enviar.` :
        `Selecione ${FORMATOS[tipo].join(', ').toUpperCase()}.`));
  }

  function definirTodos(ia) {
    setArquivos((anteriores) => anteriores.map((item) =>
      item.status === 'sucesso' ? item : { ...item, ia }));
  }

  async function importar() {
    if (enviando || !pendentes || semClassificacao) return;
    const aEnviar = arquivos.filter((item) => item.status !== 'sucesso');
    setEnviando(true);
    setAviso('');
    let sucesso = 0;
    let falha = 0;
    try {
      // Envio sequencial para reduzir falhas em conexões lentas.
      for (const item of aEnviar) {
        atualizar(item.id, { status: 'enviando', erro: '' });
        try {
          await criarItem(tipo, { arq: item.arquivo, ia: item.ia },
            item.titulo.trim() || nomeArquivoSemExtensao(item.arquivo.name));
          atualizar(item.id, { status: 'sucesso', erro: '' });
          sucesso += 1;
        } catch (erro) {
          atualizar(item.id, { status: 'erro', erro: erro?.message || 'Erro desconhecido.' });
          falha += 1;
        }
      }
      setAviso(`${sucesso} ${nomes.plural} cadastrado(s) nesta tentativa.` +
        (falha ? ` ${falha} falha(s): é possível reenviar apenas os que falharam.` : ''));
      if (sucesso) recarregar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="painel larga">
      <h2>Importar {nomes.plural} em lote</h2>
      <p className="mut">Selecione vários arquivos de uma vez. O nome interno será preenchido com o nome do arquivo sem a extensão (por exemplo, <code>{tipo === 'audio' ? 'audio_ia_01.mp3' : 'video_real_01.mp4'}</code> → <code>{tipo === 'audio' ? 'audio_ia_01' : 'video_real_01'}</code>).</p>
      <div className="form-cont" style={{ marginTop: 12 }}>
        <label className="lote-nome">
          <span>Arquivos {tipo === 'audio' ? 'MP3, WAV, OGG ou M4A' : 'MP4 ou WEBM'}</span>
          <input type="file" multiple accept={ACCEPT[tipo]} disabled={enviando}
            aria-label={`Selecionar vários ${nomes.plural}`} onChange={selecionar} />
        </label>
        <p className="mut">A importação cria conteúdos individuais. Você pode ouvir ou assistir antes de salvar. Arquivos grandes podem ultrapassar o limite configurado no Supabase Storage; se um envio falhar, comprima o arquivo e faça nova seleção.</p>
        {arquivos.length > 0 && (
          <>
            <div className="chips">
              <button type="button" className={'chip' + (todasIA ? ' on' : '')}
                disabled={enviando || !pendentes} onClick={() => definirTodos(true)}>Todos são IA</button>
              <button type="button" className={'chip' + (todasReais ? ' on' : '')}
                disabled={enviando || !pendentes} onClick={() => definirTodos(false)}>Todos são reais</button>
            </div>
            <p className="mut" role="status">{concluidos} de {arquivos.length} cadastrados. Os já concluídos não serão reenviados nesta lista.</p>
            {semClassificacao && <p className="aviso">Classifique os arquivos como IA ou Real para habilitar o envio.</p>}
            <div className="lote-lista midias-lista">
              {arquivos.map((item) => (
                <div className="lote-item" key={item.id}>
                  <div className="lote-item-topo">
                    <p className="lote-original" title={item.arquivo.name}>{item.arquivo.name}</p>
                    <span className={'lote-status ' + item.status}>
                      {item.status === 'pendente' ? 'Aguardando' :
                        item.status === 'enviando' ? 'Enviando…' :
                        item.status === 'sucesso' ? 'Cadastrado' : 'Falhou'}
                    </span>
                  </div>
                  <span className="mut lote-tamanho">{tamanhoFormatado(item.arquivo.size)}</span>
                  <label className="lote-nome">
                    <span>Nome interno</span>
                    <input value={item.titulo} disabled={enviando || item.status === 'sucesso'}
                      onChange={(e) => atualizar(item.id, { titulo: e.target.value })} />
                  </label>
                  <details className="lote-detalhes">
                    <summary>{tipo === 'audio' ? 'Ouvir áudio' : 'Assistir vídeo'}</summary>
                    <PreviaLocal arquivo={item.arquivo} tipo={tipo} />
                  </details>
                  <div className="chips">
                    <button type="button" className={'chip' + (item.ia === true ? ' on' : '')}
                      disabled={enviando || item.status === 'sucesso'}
                      onClick={() => atualizar(item.id, { ia: true })}>IA</button>
                    <button type="button" className={'chip' + (item.ia === false ? ' on' : '')}
                      disabled={enviando || item.status === 'sucesso'}
                      onClick={() => atualizar(item.id, { ia: false })}>Real</button>
                  </div>
                  {item.arquivo.size > 6 * 1024 * 1024 && <p className="mut lote-tamanho">Arquivo maior que 6 MB: o envio convencional pode falhar em redes instáveis.</p>}
                  {item.erro && <p className="erro" role="alert">{item.erro}</p>}
                </div>
              ))}
            </div>
            <button className="cta" type="button" disabled={enviando || !pendentes || semClassificacao}
              onClick={importar}>
              {enviando ? `Enviando… ${concluidos}/${arquivos.length}` :
                pendentes ? `Cadastrar ${pendentes} ${nomes.plural}` : 'Todos cadastrados'}
            </button>
            <button type="button" className="link" disabled={enviando}
              onClick={() => { setArquivos([]); setAviso(''); }}>Limpar lista / começar outro lote</button>
          </>
        )}
        {aviso && <p className="mut" role="status">{aviso}</p>}
      </div>
    </section>
  );
}
