import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { medirAudio } from '../lib/analiseAudio';
const f=(n)=>Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';
export default function NormalizarAudios({ recarregar }) {
  const [itens,setItens]=useState([]);
  const [medicoes,setMedicoes]=useState({});
  const [status,setStatus]=useState('');
  const [rodando,setRodando]=useState(false);
  const cancelar=useRef(false);
  const [erro,setErro]=useState('');
  async function listar() {
    const {data,error}=await supabase.from('conteudos')
      .select('id,titulo,url,audio_gain_db,audio_rms_dbfs,audio_peak_dbfs')
      .eq('tipo','audio').order('created_at',{ascending:true});
    if(error) setErro(error.message); else { setItens(data||[]); setErro(''); }
  }
  useEffect(()=>{ listar(); return ()=>{cancelar.current=true;}; },[]);
  async function medir() {
    if(rodando) return;
    cancelar.current=false; setRodando(true);setErro('');
    const r={};let erros=0;
    try {
      for(let i=0;i<itens.length;i++){
        if(cancelar.current)break;
        const item=itens[i];setStatus(`Analisando ${i+1}/${itens.length}: ${item.titulo||'Áudio'}`);
        try {r[item.id]=await medirAudio(item.url);}
        catch(e){r[item.id]={erro:e.message||'Falha na leitura.'};erros++;}
        setMedicoes({...r});
      }
      setStatus(cancelar.current?'Análise interrompida.':`Análise concluída. ${erros} falha(s).`);
    }finally{setRodando(false);}
  }
  async function aplicar() {
    if(rodando)return;
    const pronto=itens.filter(i=>medicoes[i.id]&&!medicoes[i.id].erro);
    if(!pronto.length)return;
    setRodando(true);setErro('');let sucessos=0,erros=0;
    try{
      for(const item of pronto){
        const m=medicoes[item.id];setStatus(`Salvando ganhos: ${sucessos+erros+1}/${pronto.length}`);
        const {error}=await supabase.from('conteudos').update({
          audio_gain_db:m.ganhoDB,audio_rms_dbfs:m.rmsDB,
          audio_peak_dbfs:m.picoDB,audio_analisado_em:new Date().toISOString(),
        }).eq('id',item.id);
        if(error){erros++;setErro(error.message);}else sucessos++;
      }
      setStatus(`${sucessos} ganho(s) salvo(s), ${erros} falha(s). Os áudios originais não foram alterados.`);
      await listar();recarregar?.();
    }finally{setRodando(false);}
  }
  const resultados=itens.filter(i=>medicoes[i.id]);
  const baixos=resultados.filter(i=>medicoes[i.id].ganhoDB>0);
  return <section className="painel larga audio-auditoria">
    <h2>Auditoria de volume dos áudios</h2>
    <p className="mut">Analisa automaticamente RMS e pico de cada arquivo, sugere um ganho limitado para evitar distorção e permite aplicar as correções em lote. Não substitui normalização LUFS profissional. Não altera nem reenvia os originais.</p>
    <p className="mut"><strong>{itens.length}</strong> arquivos · <strong>{resultados.length}</strong> analisados nesta sessão · <strong>{baixos.length}</strong> com ganho recomendado</p>
    <div className="acoes">
      <button className="cta" disabled={rodando||!itens.length} onClick={medir}>Analisar todos os áudios</button>
      <button className="cta" disabled={rodando||!resultados.some(i=>!medicoes[i.id].erro)} onClick={aplicar}>Aplicar ganhos analisados</button>
      {rodando&&<button className="link" onClick={()=>{cancelar.current=true;}}>Parar após este arquivo</button>}
      <button className="link" disabled={rodando} onClick={listar}>Atualizar lista</button>
    </div>
    {status&&<p role="status" className="mut">{status}</p>}{erro&&<p role="alert" className="erro">{erro}</p>}
    <div className="rolagem"><table><thead><tr><th>Áudio</th><th>RMS (dBFS)</th><th>Pico (dBFS)</th><th>Ganho sugerido</th><th>Ganho salvo</th></tr></thead>
      <tbody>{itens.map(item=>{
        const m=medicoes[item.id];return <tr key={item.id}><td>{item.titulo||item.id.slice(0,8)}</td>
          <td>{m?.erro?'Falhou':m?f(m.rmsDB):item.audio_rms_dbfs==null?'—':f(Number(item.audio_rms_dbfs))}</td>
          <td>{m?.erro?'—':m?f(m.picoDB):item.audio_peak_dbfs==null?'—':f(Number(item.audio_peak_dbfs))}</td>
          <td>{m?.erro?m.erro:m?`+${f(m.ganhoDB)} dB`:'—'}</td>
          <td>{f(Number(item.audio_gain_db||0))} dB</td></tr>;
      })}</tbody></table></div>
    <p className="mut">Análises completas baixam temporariamente os áudios no navegador do administrador, um por vez. Use Wi-Fi; arquivos grandes podem levar mais tempo. A reprodução com ganho depende de acesso CORS ao arquivo no Storage.</p>
  </section>;
}
