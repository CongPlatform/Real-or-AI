import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine, LabelList,
} from 'recharts';
import { f1, fp } from '../lib/formatos';

export const META = 100;
const COR = { real: '#C6F432', ia: '#5B3DF5', ref: '#FF5C5C', ink: '#14122B', sol: '#FFC247' };

const Dica = ({ active, payload, rotulo, unid }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="dica-g">
      <b>{p.rotulo || p.nome}</b>
      <div>{rotulo}: {f1(payload[0].value)}{unid}</div>
      {p.respostas != null && <div>{p.acertos} de {p.respostas} respostas</div>}
      {p.pessoas != null && <div>{p.pessoas} pessoas</div>}
    </div>
  );
};

function Barras({ dados, y = 'pct', x = 'nome', cor = COR.ia, dominio = [0, 100], unid = '%', ref = 50, rotulo = 'Acerto', longo = false }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} interval={0} angle={longo ? -25 : 0} textAnchor={longo ? 'end' : 'middle'} height={longo ? 78 : 30} />
        <YAxis domain={dominio} tick={{ fontSize: 11 }} unit={unid} allowDecimals={false} />
        <Tooltip content={<Dica rotulo={rotulo} unid={unid} />} />
        {ref !== false && <ReferenceLine y={ref} stroke={COR.ref} strokeDasharray="4 4" />}
        <Bar dataKey={y} fill={cor} stroke={COR.ink} strokeWidth={2} radius={[6, 6, 0, 0]}>
          <LabelList dataKey={y} position="top" formatter={(v) => f1(v, 0)} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const LinhaTab = ({ r, acaso }) => (
  <tr>
    <td><b>{r.nome}</b></td><td>{r.n}</td><td>{f1(r.media)}</td><td>{f1(r.mediana)}</td><td>{f1(r.desvio)}</td><td>{f1(r.variancia)}</td>
    <td>{f1(r.min, 0)}</td><td>{f1(r.q1)}</td><td>{f1(r.q3)}</td><td>{f1(r.max, 0)}</td><td>{f1(r.cv, 0)}</td><td>{f1(r.ep, 2)}</td>
    <td>{f1(r.ic[0])}–{f1(r.ic[1])}</td><td>{acaso}</td><td>{fp(r.p)}</td>
  </tr>
);

export function Resumo({ s, atual, parciais, setParciais }) {
  const g = s.geral, t = s.totais, sig = g.p < 0.05;
  return (
    <div className="dash">
      <div className="secao-topo"><div><h2>Resumo</h2><p className="mut">Atualizado às {atual?.toLocaleTimeString('pt-BR')}</p></div></div>

      <div className="barra-meta">
        <div><b>{t.participantes}</b> de {META} participantes <span className="mut">({t.cadastrados} cadastrados no total)</span></div>
        <div className="barra"><i style={{ width: `${Math.min(100, (100 * t.participantes) / META)}%` }} /></div>
      </div>

      <section className="painel larga">
        <h2>O que está sendo contado</h2>
        <div className="escopo-linhas">
          <div><b>{t.participantes}</b> participantes analisados</div>
          <div><b>{t.respostas}</b> respostas individuais</div>
          {t.rodadas > 0 && <div><b>{t.rodadas}</b> rodadas de comparação</div>}
        </div>
        {s.versoes.length > 0 && <p className="mut">Itens respondidos por pessoa: {s.versoes.map((v) => `${v.itens} itens (${v.pessoas} pessoas)`).join(' · ')}. Todas as versões do teste entram juntas, e cada percentual usa só o que a pessoa realmente respondeu.</p>}
        <label className="check">
          <input type="checkbox" checked={parciais} onChange={(e) => setParciais(e.target.checked)} />
          Incluir quem respondeu mas não finalizou{!parciais && t.parciaisFora > 0 ? ` (${t.parciaisFora} pessoas ficam de fora)` : ''}
        </label>
      </section>

      {s.linhas.length < 2 ? <p className="mut">Aguardando as primeiras respostas para calcular.</p> : (<>
        <div className="kpis">
          <div><b>{f1(g.media)}%</b><span>média de acerto por pessoa</span></div>
          <div><b>{f1(g.mediana)}%</b><span>mediana</span></div>
          <div><b>{f1(g.desvio)}</b><span>desvio padrão (p.p.)</span></div>
          <div><b>{f1(g.ic[0], 0)}–{f1(g.ic[1], 0)}%</b><span>IC 95% da média</span></div>
        </div>
        <p className="leitura">
          Média de {f1(g.media)}% contra 50% do puro chute: t = {f1(g.t, 2)}, p {fp(g.p) === '< 0,001' ? '' : '= '}{fp(g.p)}.{' '}
          {sig ? (g.media > 50 ? 'As pessoas acertam mais do que o acaso (diferença significativa a 5%).' : 'As pessoas acertam menos do que o acaso (diferença significativa a 5%).') : 'Não há evidência de que as pessoas se saiam diferente do acaso (a 5%).'}
        </p>
        <section className="painel larga">
          <h2>Estatística descritiva (acerto por pessoa, em %)</h2>
          <div className="rolagem">
            <table>
              <thead><tr><th>Grupo</th><th>Pessoas</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>Variância</th><th>Mín</th><th>Q1</th><th>Q3</th><th>Máx</th><th>CV %</th><th>Erro pad.</th><th>IC 95%</th><th>Acaso %</th><th>p</th></tr></thead>
              <tbody>
                <LinhaTab r={{ nome: 'Geral', ...g }} acaso={50} />
                {s.porTipo.filter((r) => r.n > 0).map((r) => <LinhaTab key={r.nome} r={r} acaso={50} />)}
                {s.comp.n > 0 && <>
                  <LinhaTab r={{ nome: 'Comparação · rodada exata', ...s.comp.exato }} acaso={25} />
                  <LinhaTab r={{ nome: 'Comparação · por item', ...s.comp.item }} acaso={50} />
                </>}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Fórmulas usadas</summary>
            <p>Média x̄ = Σx / n · Variância amostral s² = Σ(x − x̄)² / (n − 1) · Desvio s = √s² · Erro padrão = s / √n · CV = s / x̄ · IC 95% = x̄ ± 1,96·EP · t = (x̄ − acaso) / EP (p pela aproximação normal) · Pearson r = Σ(x−x̄)(y−ȳ) / √(Σ(x−x̄)²·Σ(y−ȳ)²) · Nos gráficos, % de acerto = respostas corretas ÷ respostas dadas.</p>
          </details>
        </section>
      </>)}
    </div>
  );
}

export function Analises({ s }) {
  const c = s.conf, b = s.balanceada;
  if (s.linhas.length < 2) return <div className="dash"><div className="secao-topo"><h2>Gráficos</h2></div><p className="mut">Aguardando as primeiras respostas.</p></div>;
  return (
    <div className="dash">
      <div className="secao-topo"><div><h2>Gráficos</h2><p className="mut">% de acerto = respostas corretas ÷ respostas dadas (todas as versões juntas). Passe o mouse para ver quantas respostas e pessoas há em cada barra.</p></div></div>

      <h3 className="grupo-t">Resultado geral</h3>
      <div className="grade">
        <section className="painel"><h2>Acerto por tipo de conteúdo</h2><Barras dados={s.tipoPool} x="rotulo" cor={COR.ia} /></section>
        <section className="painel"><h2>Distribuição das notas (nº de pessoas)</h2><Barras dados={s.hist} y="n" dominio={[0, 'auto']} unid="" ref={false} rotulo="Pessoas" cor={COR.sol} /></section>
        <section className="painel">
          <h2>Matriz de confusão</h2>
          <table className="conf">
            <thead><tr><th /><th>Disse “IA”</th><th>Disse “Real”</th></tr></thead>
            <tbody>
              <tr><th>Era IA</th><td className="ok">{c.ia_ia}</td><td>{c.ia_real}</td></tr>
              <tr><th>Era real</th><td>{c.real_ia}</td><td className="ok">{c.real_real}</td></tr>
            </tbody>
          </table>
          <p className="mut">Acerto quando era IA: {f1(b.sens)}% · quando era real: {f1(b.esp)}% · acurácia balanceada: {f1(b.bal)}%.</p>
        </section>
        <section className="painel"><h2>Tempo mediano por tipo (s)</h2><Barras dados={s.porTipo.filter((t) => Number.isFinite(t.tempoMed)).map((t) => ({ nome: t.nome, v: t.tempoMed }))} y="v" dominio={[0, 'auto']} unid="s" ref={false} rotulo="Tempo" cor={COR.ia} /></section>
      </div>

      <h3 className="grupo-t">Perfil de quem respondeu</h3>
      <div className="grade">
        <section className="painel"><h2>Acerto por faixa etária</h2><Barras dados={s.porFaixa} cor={COR.real} /></section>
        <section className="painel"><h2>Acerto por escolaridade</h2><Barras dados={s.porEsc} cor={COR.real} longo /></section>
        <section className="painel"><h2>Acerto por frequência de uso de IA</h2><Barras dados={s.porFreq} cor={COR.ia} /><p className="mut">Correlação (frequência × acerto): r = {f1(s.rFreq, 2)}</p></section>
        <section className="painel"><h2>Acerto por autoavaliação (1 a 5)</h2><Barras dados={s.porConf} cor={COR.sol} /><p className="mut">Correlação (autoavaliação × acerto): r = {f1(s.rConf, 2)}</p></section>
        <section className="painel"><h2>Para que usam IA</h2><Barras dados={s.usos} x="nome" y="n" dominio={[0, 'auto']} unid="" ref={false} rotulo="Pessoas" cor={COR.real} /></section>
        <section className="painel">
          <h2>Estimado × real</h2>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 12, left: -10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Real" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Estimado" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke={COR.ref} strokeDasharray="4 4" />
              <Tooltip formatter={(v) => f1(v) + '%'} />
              <Scatter data={s.calib} fill={COR.ia} fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="mut">Acima da linha = achou que acertou mais do que acertou. Viés médio: {f1(s.vies.media)} p.p. (p {fp(s.vies.p)}) · r = {f1(s.rCalib, 2)}</p>
        </section>
      </div>

      {s.comp.n > 0 && (<>
        <h3 className="grupo-t">Comparações (2 conteúdos por rodada)</h3>
        <p className="mut">Acertar a rodada = acertar os dois itens. Chutando, a pessoa acerta 25% das rodadas e 50% dos itens.</p>
        <div className="grade">
          <section className="painel"><h2>Rodadas certas por cenário</h2><Barras dados={s.comp.cenPool} x="rotulo" cor={COR.ia} ref={25} /></section>
          <section className="painel"><h2>Rodadas certas por tipo</h2><Barras dados={s.comp.tipoPool} x="rotulo" cor={COR.real} ref={25} /></section>
          <section className="painel"><h2>Quanto marcaram “IA” em cada cenário</h2><Barras dados={s.comp.tend} y="media" ref={false} rotulo="Marcaram IA" cor={COR.sol} /><p className="mut">Se acertassem sempre: 0%, 50% e 100%.</p></section>
          <section className="painel">
            <h2>Individual × comparação (por item)</h2>
            <Barras dados={[{ nome: 'Individual', pct: s.geral.media }, { nome: 'Comparação', pct: s.comp.item.media }]} cor={COR.ia} />
            <p className="mut">Diferença média pareada: {f1(s.comp.dif.media)} p.p. · t = {f1(s.comp.dif.t, 2)} · p {fp(s.comp.dif.p)}</p>
          </section>
        </div>
      </>)}
    </div>
  );
}
