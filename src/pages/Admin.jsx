import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import Dashboard from './Dashboard';
import Conteudos from '../components/Conteudos';
import LimpezaPesquisa from '../components/LimpezaPesquisa';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  async function entrar(e) {
    e.preventDefault(); setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro('E-mail ou senha incorretos.');
  }
  return (
    <div className="tela centro"><form className="cartao form-login" onSubmit={entrar}>
      <h1>Área do admin</h1>
      <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      {erro && <p className="erro">{erro}</p>}
      <button className="cta">Entrar</button>
    </form></div>
  );
}

function Painel({ sair }) {
  const [d, setD] = useState(null);
  const [avancado, setAvancado] = useState(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('stats');
  const [atual, setAtual] = useState(null);
  const tm = useRef();

  const carregar = useCallback(async () => {
    const [principal, adicional] = await Promise.all([
      supabase.rpc('admin_dados'), supabase.rpc('admin_analise_v4'),
    ]);
    if (principal.error) return setErro(principal.error.message);
    setD(principal.data);
    setAvancado(adicional.error ? null : adicional.data);
    setErro(adicional.error ? 'Instale supabase/PATCH_ESTATISTICAS_V4.sql e atualize. ' + adicional.error.message : '');
    setAtual(new Date());
  }, []);

  useEffect(() => {
    carregar();
    const gatilho = () => { clearTimeout(tm.current); tm.current = setTimeout(carregar, 800); };
    const ch = supabase.channel('respostas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respostas' }, gatilho)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respostas_comp' }, gatilho)
      .subscribe();
    const iv = setInterval(carregar, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [carregar]);

  return (
    <div className="admin">
      <header className="admin-topo">
        <h1>Real ou IA? <small>admin</small></h1>
        <nav>
          <button className={aba === 'stats' ? 'on' : ''} onClick={() => setAba('stats')}>Estatísticas</button>
          <button className={aba === 'cont' ? 'on' : ''} onClick={() => setAba('cont')}>Conteúdos</button>
          <button className={aba === 'limpeza' ? 'on' : ''} onClick={() => setAba('limpeza')}>Limpar dados</button>
          <button onClick={sair}>Sair</button>
        </nav>
      </header>
      {erro && <p className="erro">{erro}</p>}
      {!d ? <p className="mut">Carregando…</p> : aba === 'stats'
        ? avancado ? <Dashboard dados={d} atual={atual} avancado={avancado} atualizar={carregar} />
          : <div className="painel"><h2>Atualização estatística pendente</h2><p>Execute primeiro o arquivo <code>supabase/PATCH_ESTATISTICAS_V4.sql</code> no SQL Editor.</p></div>
        : aba === 'cont' ? <Conteudos lista={d.conteudos} comparacoes={d.comparacoes || []} recarregar={carregar} /> : <LimpezaPesquisa atualizar={carregar} />}
    </div>
  );
}

export default function Admin() {
  const [sess, setSess] = useState(undefined);
  const [ok, setOk] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSess(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSess(s));
    return () => l.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!sess) return setOk(null);
    supabase.rpc('sou_admin').then(({ data }) => setOk(!!data));
  }, [sess]);

  if (sess === undefined) return <div className="tela"><p className="mut">Carregando…</p></div>;
  if (!sess) return <Login />;
  if (ok === null) return <div className="tela"><p className="mut">Verificando acesso…</p></div>;
  if (!ok) {
    return (
      <div className="tela">
        <h1>Sem permissão</h1>
        <p className="mut">Esta conta não está na tabela <code>admins</code>. Rode no SQL Editor:</p>
        <pre className="codigo">{`insert into public.admins (user_id) values ('${sess.user.id}');`}</pre>
        <button className="cta" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    );
  }
  return <Painel sair={() => supabase.auth.signOut()} />;
}
