import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const CONFIRMACAO = 'APAGAR DADOS DE TESTE';
export default function LimpezaPesquisa({atualizar}) {
  const [status,setStatus]=useState(null);
  const [senha,setSenha]=useState('');
  const [frase,setFrase]=useState('');
  const [backup,setBackup]=useState(false);
  const [esperando,setEsperando]=useState(false);
  const [erro,setErro]=useState('');
  const [resultado,setResultado]=useState(null);
  async function carregar() {
    const {data,error}=await supabase.rpc('admin_status_limpeza_v5');
    if(error)setErro(`Não foi possível consultar a segurança da limpeza. Execute o SQL v5. ${error.message}`);
    else {setStatus(data);setErro('');}
  }
  useEffect(()=>{carregar();},[]);
  const preenchido=status?.configurada && backup && senha.length>0 && frase===CONFIRMACAO && !esperando;
  async function apagar(e) {
    e.preventDefault();
    if(!preenchido)return;
    setErro('');setResultado(null);setEsperando(true);
    try {
      const {data,error}=await supabase.rpc('admin_apagar_pesquisa_v5',{p_senha:senha,p_confirmacao:frase});
      if(error)throw error;
      if(!data?.ok) {setErro(data?.mensagem||'Não foi possível executar a limpeza.');return;}
      setResultado(data);
      // Esta limpeza invalidou também o teste salvo neste navegador.
      // Apenas o identificador local é descartado; nenhuma outra preferência é tocada.
      try { localStorage.removeItem('realia_v3'); } catch { /* armazenamento indisponível */ }
      setSenha('');setFrase('');setBackup(false);
      await atualizar?.();
      await carregar();
    }catch(err){setErro(err.message||'Erro inesperado ao limpar dados.');}
    finally{setEsperando(false);setSenha('');}
  }
  return <section className="painel limpeza-pesquisa">
    <h2>Limpeza dos testes (irreversível)</h2>
    <p className="mut">Use somente antes de iniciar a coleta oficial. Exclui participantes, respostas individuais, respostas de comparação e sorteios já realizados. <strong>Não exclui imagens, textos, áudios, vídeos, gabarito, pares cadastrados nem arquivos do Storage.</strong></p>
    {resultado?.ok&&<div className="aviso" role="status">Limpeza concluída: {resultado.participantes_apagados} participantes, {resultado.respostas_apagadas} respostas individuais e {resultado.comparacoes_apagadas} comparações removidas.</div>}
    {erro&&<p role="alert" className="erro">{erro}</p>}
    {status&&<div className="auditoria-grid">
      <div><strong>{status.participantes}</strong><span>Participantes cadastrados</span></div>
      <div><strong>{status.respostas}</strong><span>Respostas individuais</span></div>
      <div><strong>{status.comparacoes}</strong><span>Respostas de comparação</span></div>
    </div>}
    {status&&!status.configurada&&<p className="aviso">Senha ainda não configurada. Após instalar o SQL v5, defina uma senha exclusiva no SQL Editor conforme as instruções do ZIP.</p>}
    {status?.bloqueada_ate&&<p className="aviso">Muitas tentativas incorretas. Nova tentativa após {new Date(status.bloqueada_ate).toLocaleString('pt-BR')}.</p>}
    <form className="form-limpeza" onSubmit={apagar}>
      <label className="checagem"><input type="checkbox" checked={backup} onChange={e=>setBackup(e.target.checked)}/> Já exportei os CSVs que preciso e entendo que os dados removidos não poderão ser recuperados por esta ferramenta.</label>
      <label>Digite <code>{CONFIRMACAO}</code> para confirmar:
        <input value={frase} onChange={e=>setFrase(e.target.value)} placeholder={CONFIRMACAO} autoComplete="off" spellCheck="false" />
      </label>
      <label>Senha exclusiva de limpeza:
        <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Senha definida no Supabase" autoComplete="off"/>
      </label>
      <button className="cta cta-perigo" type="submit" disabled={!preenchido||!!status?.bloqueada_ate}>{esperando?'Apagando dados…':'Apagar participantes e respostas'}</button>
    </form>
    <p className="mut">Proteção no banco de dados: exige usuário administrador autenticado, senha validada no servidor e frase de confirmação. Há bloqueio temporário após cinco tentativas incorretas.</p>
  </section>;
}
