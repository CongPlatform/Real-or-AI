import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { analisar } from '../lib/stats';
import { Resumo, Analises } from './Dashboard';
import Apresentacao from './Apresentacao';
import Dados from './Dados';
import Revisao from '../components/Revisao';
import Conteudos from '../components/Conteudos';
import '../admin.css';

const ABAS = [
  { id: 'resumo', nome: 'Resumo' },
  { id: 'graficos', nome: 'Gráficos' },
  { id: 'apresentacao', nome: 'Apresentação' },
  { id: 'revisao', nome: 'Revisar conteúdos' },
  { id: 'cadastro', nome: 'Cadastrar' },
  { id: 'dados', nome: 'Dados' },
];

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
    <div className="tela centro">
      <form className="cartao form-login" onSubmit={entrar}>
        <h1>Área do admin</h1>
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="erro">{erro}</p>}
        <button className="cta">Entrar</button>
      </form>
    </div>
  );
}

function Painel({ sair }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState(() => sessionStorage.getItem('realia_aba') || 'resumo');
  const [parciais, setParciais] = useState(false);
  const [atual, setAtual] = useState(null);
  const tm = useRef();

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_dados');
    if (error) return setErro(error.message);
    setErro(''); setD(data); setAtual(new Date());
  }, []);

  useEffect(() => {
    carregar();
    const gatilho = () => { clearTimeout(tm.current); tm.current = setTimeout(carregar, 800); };
    const ch = supabase.channel('respostas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respostas' }, gatilho)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respostas_comp' }, gatilho)
      .subscribe();
    const iv = setInterval(carregar, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [carregar]);

  useEffect(() => { try { sessionStorage.setItem('realia_aba', aba); } catch { /* ignora */ } }, [aba]);
  const s = useMemo(() => (d ? analisar(d, { parciais }) : null), [d, parciais]);

  return (
    <div className="shell">
      <nav className="lado">
        <h1>Real ou IA?<small>admin</small></h1>
        {ABAS.map((a) => <button key={a.id} className={'item' + (aba === a.id ? ' on' : '')} onClick={() => setAba(a.id)}>{a.nome}</button>)}
        <button className="item rodape" onClick={sair}>Sair</button>
      </nav>
      <main className="principal">
        {erro && <p className="erro">{erro}</p>}
        {!d ? <p className="mut">Carregando…</p> : (<>
          {aba === 'resumo' && <Resumo s={s} atual={atual} parciais={parciais} setParciais={setParciais} />}
          {aba === 'graficos' && <Analises s={s} />}
          {aba === 'apresentacao' && <Apresentacao s={s} />}
          {aba === 'revisao' && <Revisao d={d} recarregar={carregar} />}
          {aba === 'cadastro' && (<div className="dash"><div className="secao-topo"><h2>Cadastrar conteúdos</h2></div><Conteudos lista={d.conteudos} comparacoes={d.comparacoes || []} recarregar={carregar} /></div>)}
          {aba === 'dados' && <Dados d={d} s={s} recarregar={carregar} />}
        </>)}
      </main>
    </div>
  );
}

export default function Admin() {
  const [sess, setSess] = useState(undefined);
  const [ok, setOk] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSess(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, x) => setSess(x));
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
