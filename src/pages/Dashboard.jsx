import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine, LabelList,
} from 'recharts';
import { analisar } from '../lib/stats';
import { FREQ, TIPOS } from '../lib/opcoes';

const META = 100;
const f1 = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '—');
const fp = (p) => (!Number.isFinite(p) ? '—' : p < 0.001 ? '< 0,001' : f1(p, 3));
const COR = { real: '#C6F432', ia: '#5B3DF5', ref: '#FF5C5C', ink: '#14122B', sol: '#FFC247' };

function Barras({ dados, y = 'media', cor = COR.ink, dominio = [0, 100], unid = '%', linhaReferencia = 50, rotulo = 'Média', longo = false }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={longo ? -25 : 0} textAnchor={longo ? 'end' : 'middle'} height={longo ? 78 : 30} />
        <YAxis domain={dominio} tick={{ fontSize: 11 }} unit={unid} allowDecimals={false} />
        <Tooltip formatter={(v) => [f1(v) + unid, rotulo]} />
        {linhaReferencia !== false && <ReferenceLine y={linhaReferencia} stroke={COR.ref} strokeDasharray="4 4" />}
        <Bar dataKey={y} fill={cor} stroke={COR.ink} strokeWidth={2} radius={[6, 6, 0, 0]}>
          <LabelList dataKey={y} position="top" formatter={(v) => f1(v, unid === '%' ? 0 : 0)} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function exportar(linhas) {
  const tipos = Object.keys(TIPOS);
  const cab = ['id', 'faixa_etaria', 'genero', 'escolaridade', 'freq_ia', 'usos_ia', 'confianca', 'estimativa_acertos', 'respostas', 'acertos', 'pct', ...tipos.map((t) => 'pct_' + t), 'comp_exato_pct', 'comp_item_pct'];
  const lin = linhas.map((l) => [
    l.id, l.faixa_etaria, l.genero || '', l.escolaridade, l.freq_ia, (l.usos_ia || []).join('+'), l.confianca,
    l.estimativa_acertos ?? '', l.n, l.acertos, f1(l.pct, 2),
    ...tipos.map((t) => (l.tipos[t] ? f1((100 * l.tipos[t].a) / l.tipos[t].n, 2) : '')),
    l.comp ? f1(l.comp.exato, 2) : '', l.comp ? f1(l.comp.item, 2) : '',
  ]);
  const csv = '\ufeff' + [cab, ...lin].map((r) => r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'resultados-real-ou-ia.csv'; a.click();
}


const ROTULOS_ENQUADRAMENTO = { neutro: 'Neutra', ia: 'Pergunta sobre IA', humano: 'Pergunta sobre humano' };
const media = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
function exportarRespostas(extras) {
  const cab = ['participante_id','tipo_rodada','conteudo_id','tipo','enquadramento','era_ia','resposta_ia','acertou','tempo_ms','segundos_reproduzidos','pedidos_mais','numero_ia_no_par','marcados_ia'];
  const individuais = (extras.individuais || []).map((r) => [r.participante_id,'individual',r.conteudo_id,r.tipo,r.enquadramento,r.era_ia,r.resposta_ia,r.acertou,r.tempo_ms,r.segundos_reproduzidos,r.pedidos_mais,'','']);
  const comparacoes = (extras.comparacoes || []).map((r) => [r.participante_id,'comparacao',r.comparacao_id,r.tipo,r.enquadramento,'','',r.acertou,r.tempo_ms,'','',r.n_reais_ia,r.n_marcados_ia]);
  const csv = '\ufeff' + [cab,...individuais,...comparacoes].map((x) => x.map((v) => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'respostas-por-enunciado-e-audio.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function DadosEnquadramento({ extras }) {
  if (!extras) return null;
  const ind = extras.individuais || [];
  const comp = extras.comparacoes || [];
  if (!ind.length && !comp.length) return <section className="painel larga"><h2>Enquadramento das perguntas e escuta dos áudios</h2><p className="mut">Os dados aparecerão depois que alguém realizar o novo teste de 30 decisões.</p></section>;
  const conteudo = (linhas) => ['neutro','ia','humano'].map((chave) => {
    const x = linhas.filter((r) => r.enquadramento === chave);
    return { chave, n: x.length, taxa: media(x.map((r) => Number(r.acertou))), ia: media(x.map((r) => Number(r.resposta_ia))), segundos: media(x.map((r) => (+r.tempo_ms || 0) / 1000)) };
  });
  const audios = ind.filter((r) => r.tipo === 'audio');
  return <section className="painel larga">
    <h2>Formulação das perguntas e escuta progressiva</h2>
    <p className="mut">A formulação é sorteada e registrada, sem revelar a origem correta. Diferenças entre grupos são exploratórias até haver amostra suficiente.</p>
    <div className="acoes"><span className="mut">{ind.length} decisões individuais · {comp.length} comparações</span>
      <button className="link" onClick={() => exportarRespostas(extras)}>CSV por pergunta e escuta</button></div>
    <h3>Perguntas individuais</h3>
    <div className="rolagem"><table><thead><tr><th>Formulação</th><th>Respostas</th><th>Acertos</th><th>Disse IA</th><th>Tempo médio (s)</th></tr></thead>
      <tbody>{conteudo(ind).map((r) => <tr key={r.chave}><td>{ROTULOS_ENQUADRAMENTO[r.chave]}</td><td>{r.n}</td><td>{f1(100*r.taxa)}%</td><td>{f1(100*r.ia)}%</td><td>{f1(r.segundos)}</td></tr>)}</tbody></table></div>
    <h3>Formulação × modalidade (classificação individual)</h3>
    <div className="rolagem"><table><thead><tr><th>Modalidade</th><th>Formulação</th><th>Respostas</th><th>Acertos</th><th>Classificou como IA</th></tr></thead>
    <tbody>{['imagem','texto','audio','video'].flatMap((tipo) => ['neutro','ia','humano'].map((frame) => {
      const x = ind.filter((r) => r.tipo === tipo && r.enquadramento === frame);
      return x.length ? <tr key={`${tipo}-${frame}`}><td>{TIPOS[tipo]}</td><td>{ROTULOS_ENQUADRAMENTO[frame]}</td><td>{x.length}</td>
        <td>{f1(100 * media(x.map((r) => Number(r.acertou))))}%</td><td>{f1(100 * media(x.map((r) => Number(r.resposta_ia))))}%</td></tr> : null;
    }))}</tbody></table></div>
    <h3>Comparações (ambos os itens devem estar corretos)</h3>
    <div className="rolagem"><table><thead><tr><th>Formulação</th><th>Respostas</th><th>Acertos exatos</th><th>Tempo médio (s)</th></tr></thead>
      <tbody>{conteudo(comp).map((r) => <tr key={r.chave}><td>{ROTULOS_ENQUADRAMENTO[r.chave]}</td><td>{r.n}</td><td>{f1(100*r.taxa)}%</td><td>{f1(r.segundos)}</td></tr>)}</tbody></table></div>
    <h3>Áudios com escuta por trechos</h3>
    <div className="rolagem"><table><thead><tr><th>Respostas</th><th>Segundos realmente reproduzidos (média)</th><th>Pedidos de mais áudio (média)</th><th>Acertos</th></tr></thead>
      <tbody><tr><td>{audios.length}</td><td>{f1(media(audios.map((r) => +r.segundos_reproduzidos || 0)))}</td>
        <td>{f1(media(audios.map((r) => +r.pedidos_mais || 0)))}</td><td>{f1(100*media(audios.map((r) => Number(r.acertou))))}%</td></tr></tbody></table></div>
  </section>;
}

export default function Dashboard({ dados, atual, extras }) {
  const s = useMemo(() => analisar(dados), [dados]);
  const g = s.geral;
  const sig = g.p < 0.05;
  const { ia_ia, ia_real, real_ia, real_real } = s.conf;
  const nIA = ia_ia + ia_real, nReal = real_ia + real_real;
  const tipoDados = s.porTipo.filter((t) => t.n > 0);

  return (
    <div className="dash">
      <div className="barra-meta">
        <div className="meta-txt"><b>{s.fin}</b> de {META} participantes completos <span className="mut">({s.total - s.fin} em andamento · {s.nResp} respostas)</span></div>
        <div className="barra"><i style={{ width: `${Math.min(100, (100 * s.fin) / META)}%` }} /></div>
        <div className="acoes">
          <span className="mut">Atualizado às {atual?.toLocaleTimeString('pt-BR')}</span>
          <button className="link" onClick={() => exportar(s.linhas)} disabled={!s.linhas.length}>Baixar CSV</button>
        </div>
      </div>

      {s.linhas.length < 2 ? <p className="mut">Aguardando as primeiras respostas completas para calcular.</p> : (<>
        <div className="kpis">
          <div><b>{f1(g.media)}%</b><span>média de acerto</span></div>
          <div><b>{f1(g.mediana)}%</b><span>mediana</span></div>
          <div><b>{f1(g.desvio)}</b><span>desvio padrão (p.p.)</span></div>
          <div><b>{f1(g.ic[0], 0)}–{f1(g.ic[1], 0)}%</b><span>IC 95% da média</span></div>
        </div>
        <p className="leitura">
          Média de {f1(g.media)}% contra 50% do puro chute: t = {f1(g.t, 2)}, p {fp(g.p) === '< 0,001' ? '' : '= '}{fp(g.p)}.{' '}
          {sig ? (g.media > 50 ? 'As pessoas acertam mais do que o acaso (diferença significativa a 5%).' : 'As pessoas acertam menos do que o acaso (diferença significativa a 5%).') : 'Não há evidência de que as pessoas se saiam diferente do acaso (a 5%).'}
        </p>

        <section className="painel larga">
          <h2>Estatística descritiva (acerto por participante, em %)</h2>
          <div className="rolagem">
            <table>
              <thead><tr><th>Grupo</th><th>n</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>Variância</th><th>Mín</th><th>Q1</th><th>Q3</th><th>Máx</th><th>CV %</th><th>Erro pad.</th><th>IC 95%</th><th>p (vs 50%)</th><th>Tempo med. (s)</th></tr></thead>
              <tbody>
                {[{ nome: 'Geral', ...g }, ...tipoDados].map((r) => (
                  <tr key={r.nome}>
                    <td><b>{r.nome}</b></td><td>{r.n}</td><td>{f1(r.media)}</td><td>{f1(r.mediana)}</td><td>{f1(r.desvio)}</td><td>{f1(r.variancia)}</td>
                    <td>{f1(r.min, 0)}</td><td>{f1(r.q1)}</td><td>{f1(r.q3)}</td><td>{f1(r.max, 0)}</td><td>{f1(r.cv, 0)}</td><td>{f1(r.ep, 2)}</td>
                    <td>{f1(r.ic[0])}–{f1(r.ic[1])}</td><td>{fp(r.p)}</td><td>{r.tempoMed != null ? f1(r.tempoMed) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Fórmulas usadas</summary>
            <p>Média x̄ = Σx / n · Variância amostral s² = Σ(x − x̄)² / (n − 1) · Desvio s = √s² · Erro padrão = s / √n · CV = s / x̄ · IC 95% = x̄ ± 1,96·EP · t = (x̄ − 50) / EP (p pela aproximação normal, bom para n grande) · Pearson r = Σ(x−x̄)(y−ȳ) / √(Σ(x−x̄)²·Σ(y−ȳ)²) · Quartis por interpolação linear.</p>
          </details>
        </section>

        {s.comp.n > 0 && (<>
          <section className="painel larga">
            <h2>Comparações (2 conteúdos por rodada, % por participante)</h2>
            <p className="mut">Acerto exato = acertou os dois itens da rodada. Chutando, a pessoa acerta 25% das rodadas e 50% dos itens.</p>
            <div className="rolagem">
              <table>
                <thead><tr><th>Grupo</th><th>n</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>Mín</th><th>Máx</th><th>IC 95%</th><th>Acaso %</th><th>p (vs acaso)</th></tr></thead>
                <tbody>
                  {[
                    { nome: 'Geral · resposta exata', acaso: 25, ...s.comp.exato },
                    { nome: 'Geral · por item', acaso: 50, ...s.comp.item },
                    ...s.comp.porCen.map((r) => ({ ...r, nome: r.nome + ' (exata)', acaso: 25 })),
                    ...s.comp.porTipo.filter((r) => r.n > 0).map((r) => ({ ...r, nome: r.nome + ' (exata)', acaso: 25 })),
                  ].map((r) => (
                    <tr key={r.nome}>
                      <td><b>{r.nome}</b></td><td>{r.n}</td><td>{f1(r.media)}</td><td>{f1(r.mediana)}</td><td>{f1(r.desvio)}</td>
                      <td>{f1(r.min, 0)}</td><td>{f1(r.max, 0)}</td><td>{f1(r.ic[0])}–{f1(r.ic[1])}</td><td>{r.acaso}</td><td>{fp(r.p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grade">
            <section className="painel"><h2>Acerto exato por cenário da rodada</h2><Barras dados={s.comp.porCen} cor={COR.ia} linhaReferencia={25} /></section>
            <section className="painel">
              <h2>Quanto marcaram “IA” em cada cenário</h2>
              <Barras dados={s.comp.tend} cor={COR.sol} linhaReferencia={false} rotulo="Marcaram IA" />
              <p className="mut">Se acertassem sempre, seria 0%, 50% e 100%.</p>
            </section>
            <section className="painel"><h2>Acerto exato por tipo (comparação)</h2><Barras dados={s.comp.porTipo.filter((t) => t.n > 0)} cor={COR.real} linhaReferencia={25} /></section>
            <section className="painel">
              <h2>Individual × comparação (acerto por item)</h2>
              <Barras dados={[{ nome: 'Individual', media: g.media }, { nome: 'Comparação', media: s.comp.item.media }]} cor={COR.ia} />
              <p className="mut">Diferença média pareada (comparação − individual): {f1(s.comp.dif.media)} p.p. · t = {f1(s.comp.dif.t, 2)} · p {fp(s.comp.dif.p)}</p>
            </section>
          </div>
        </>)}

        <div className="grade">
          <section className="painel"><h2>Acerto médio por tipo de conteúdo</h2><Barras dados={tipoDados} cor={COR.ia} /></section>
          <section className="painel"><h2>Distribuição das notas (nº de pessoas)</h2><Barras dados={s.hist} y="n" dominio={[0, 'auto']} unid="" linhaReferencia={false} rotulo="Pessoas" cor={COR.ia} /></section>
          <section className="painel"><h2>Acerto por faixa etária</h2><Barras dados={s.porFaixa} cor={COR.real} /></section>
          <section className="painel">
            <h2>Acerto por frequência de uso de IA</h2><Barras dados={s.porFreq} cor={COR.ia} />
            <p className="mut">Correlação (frequência × acerto): r = {f1(s.rFreq, 2)}</p>
          </section>
          <section className="painel">
            <h2>Acerto por autoavaliação (1 a 5)</h2><Barras dados={s.porConf} cor={COR.sol} />
            <p className="mut">Correlação (confiança × acerto): r = {f1(s.rConf, 2)}</p>
          </section>
          <section className="painel"><h2>Acerto por escolaridade</h2><Barras dados={s.porEsc} cor={COR.real} longo /></section>
          <section className="painel">
            <h2>Estimado × real</h2>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 10, right: 12, left: -10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Real" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="Estimado" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke={COR.ref} strokeDasharray="4 4" />
                <Tooltip formatter={(v) => f1(v) + '%'} />
                <Scatter data={s.calib} fill={COR.ia} fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="mut">Acima da linha = a pessoa achou que acertou mais do que acertou. Viés médio: {f1(s.vies.media)} p.p. (p {fp(s.vies.p)}) · r = {f1(s.rCalib, 2)}</p>
          </section>
          <section className="painel">
            <h2>Para que as pessoas usam IA</h2>
            <Barras dados={s.usos} y="n" dominio={[0, 'auto']} unid="" linhaReferencia={false} rotulo="Pessoas" cor={COR.real} />
          </section>
          <section className="painel">
            <h2>Matriz de confusão (todas as respostas)</h2>
            <table className="conf">
              <thead><tr><th /><th>Disse “IA”</th><th>Disse “Real”</th></tr></thead>
              <tbody>
                <tr><th>Era IA</th><td className="ok">{ia_ia}</td><td>{ia_real}</td></tr>
                <tr><th>Era real</th><td>{real_ia}</td><td className="ok">{real_real}</td></tr>
              </tbody>
            </table>
            <p className="mut">
              Acerto quando era IA: {f1((100 * ia_ia) / (nIA || NaN))}% · acerto quando era real: {f1((100 * real_real) / (nReal || NaN))}%.
              {' '}Chamaram de “IA” {f1((100 * (ia_ia + real_ia)) / (nIA + nReal || NaN))}% das vezes.
            </p>
          </section>
        </div>
      </>)}
      <DadosEnquadramento extras={extras} />
    </div>
  );
}
