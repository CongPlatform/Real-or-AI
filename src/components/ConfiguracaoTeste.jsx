import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
const inicial=[{modo:'completo',individuais:20,comparacoes:20,ativo:true},{modo:'reduzido',individuais:10,comparacoes:10,ativo:true}];
export default function ConfiguracaoTeste(){
 const [linhas,setLinhas]=useState(inicial),[aviso,setAviso]=useState(''),[salvando,setSalvando]=useState(false);
 useEffect(()=>{supabase.rpc('configuracoes_teste_v19').then(({data,error})=>{if(!error&&data?.length)setLinhas(data);else if(error)setAviso(error.message);});},[]);
 const editar=(i,campo,valor)=>setLinhas(atual=>atual.map((l,k)=>i===k?{...l,[campo]:valor}:l));
 async function salvar(){setSalvando(true);setAviso('');const {error}=await supabase.rpc('admin_salvar_configuracoes_v19',{p_config:linhas});setAviso(error?error.message:'Configurações salvas. As sessões já iniciadas não são alteradas.');setSalvando(false);}
 return <section className="painel larga"><h2>Configurar modalidades do teste</h2><p className="mut">Defina o total de decisões de cada parte. Configurações novas valem apenas para próximas sessões. Mantenha estoque suficiente.</p>
 {linhas.map((l,i)=><div className="cartao" key={l.modo} style={{marginBottom:12,padding:16}}><h3>Teste {l.modo}</h3><label>Parte 1 — individuais <input type="number" min="0" max="200" value={l.individuais} onChange={e=>editar(i,'individuais',Number(e.target.value))}/></label><label>Parte 2 — comparações <input type="number" min="0" max="200" value={l.comparacoes} onChange={e=>editar(i,'comparacoes',Number(e.target.value))}/></label><label><input type="checkbox" checked={l.ativo} onChange={e=>editar(i,'ativo',e.target.checked)}/> Disponível aos participantes</label><p><strong>{Number(l.individuais)+Number(l.comparacoes)} decisões</strong></p></div>)}
 <button className="cta" type="button" disabled={salvando||linhas.some(l=>l.individuais<0||l.comparacoes<0||l.individuais+l.comparacoes<1||l.individuais>200||l.comparacoes>200)} onClick={salvar}>Salvar configurações</button>{aviso&&<p role="status">{aviso}</p>}</section>;
}
