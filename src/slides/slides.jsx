import { f1, fp, ptxt } from '../lib/formatos';
import { BarrasFixas, Dispersao } from '../components/Graficos';
import { TIPOS } from '../lib/opcoes';

const COR = { real: '#C6F432', ia: '#5B3DF5', sol: '#FFC247' };

const Topo = ({ t, sub }) => (<header><h2 className="s-titulo">{t}</h2>{sub && <p className="s-sub">{sub}</p>}</header>);
const Kpi = ({ v, l, cor, branco }) => (
  <div className="s-kpi" style={{ background: cor, color: branco ? '#fff' : undefined }}><b>{v}</b><span>{l}</span></div>
);

export function conclusoes(s) {
  const g = s.geral, b = s.balanceada, out = [];
  out.push(`${s.totais.participantes} pessoas deram ${s.totais.respostas} respostas. O acerto médio foi ${f1(g.media)}% (IC 95%: ${f1(g.ic[0])}–${f1(g.ic[1])}%), ${g.p < 0.05 ? (g.media > 50 ? 'acima' : 'abaixo') + ' do acaso' : 'sem diferença clara do acaso'} (p ${ptxt(g.p)}).`);
  if (s.tipoPool.length > 1) {
    const o = [...s.tipoPool].sort((a, c) => c.pct - a.pct), u = o[o.length - 1];
    out.push(`Tipo mais fácil: ${o[0].nome} (${f1(o[0].pct, 0)}% de acerto). Mais difícil: ${u.nome} (${f1(u.pct, 0)}%).`);
  }
  if (Number.isFinite(b.sens) && Number.isFinite(b.esp)) out.push(`Quando o conteúdo era IA, as pessoas acertaram ${f1(b.sens, 0)}%; quando era real, ${f1(b.esp, 0)}%.`);
  if (s.calib.length > 2 && Number.isFinite(s.vies.media)) out.push(`Em média, as pessoas ${s.vies.media > 0 ? 'superestimaram' : 'subestimaram'} o próprio desempenho em ${f1(Math.abs(s.vies.media), 0)} pontos percentuais.`);
  if (Number.isFinite(s.rFreq)) out.push(`Correlação entre usar IA com frequência e acertar: r = ${f1(s.rFreq, 2)} (correlação não prova causa).`);
  if (s.comp.n > 0) out.push(`Nas comparações, ${f1(s.comp.exato.media, 0)}% das rodadas tiveram os dois itens certos (chute puro: 25%).`);
  return out;
}

function Coluna({ titulo, itens }) {
  return (
    <div className="s-col">
      <h3>{titulo}</h3>
      {itens.map((it) => (
        <div className="s-item" key={it.id}>
          <div className="s-prev">
            {it.tipo === 'imagem' && it.url ? <img src={it.url} alt="" />
              : it.tipo === 'texto' ? <small>{String(it.texto || '').slice(0, 110)}…</small> : TIPOS[it.tipo]}
          </div>
          <div><b>{f1(it.pct, 0)}% acertaram</b><span>{it.eh_ia ? 'Era IA' : 'Era real'} · {TIPOS[it.tipo]} · {it.n} respostas</span></div>
        </div>
      ))}
    </div>
  );
}

const Tab = ({ linhas }) => (
  <table className="s-tab">
    <thead><tr><th>Grupo</th><th>Pessoas</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>Variância</th><th>IC 95%</th></tr></thead>
    <tbody>
      {linhas.map((r) => (
        <tr key={r.nome}><td>{r.nome}</td><td>{r.n}</td><td>{f1(r.media)}</td><td>{f1(r.mediana)}</td><td>{f1(r.desvio)}</td><td>{f1(r.variancia)}</td><td>{f1(r.ic[0], 0)}–{f1(r.ic[1], 0)}</td></tr>
      ))}
    </tbody>
  </table>
);

const melhorPior = (a) => { const o = [...a].filter((x) => Number.isFinite(x.pct)).sort((p, q) => q.pct - p.pct); return [o[0], o[o.length - 1]]; };

export const SLIDES = [
  { id: 'capa', nome: 'Capa', padrao: true, semRodape: true, ok: () => true,
    render: (s) => (
      <div className="s-capa">
        <div className="s-selo">Pesquisa de matemática avançada</div>
        <h2 className="s-titulo s-gigante">Real ou IA?</h2>
        <p className="s-sub">Será que a gente percebe o que foi feito por inteligência artificial?</p>
        <p className="s-sub"><b>{s.totais.participantes} participantes · {s.totais.respostas} respostas</b></p>
      </div>) },

  { id: 'amostra', nome: 'Quem respondeu', padrao: true, ok: (s) => s.porFaixa.length > 0,
    render: (s) => (<>
      <Topo t="Quem respondeu" sub="Todas as versões do teste entram juntas na análise" />
      <div className="s-corpo">
        <div className="s-kpis">
          <Kpi v={s.totais.participantes} l="participantes" cor={COR.real} />
          <Kpi v={s.totais.respostas} l="respostas individuais" />
          {s.totais.rodadas > 0 && <Kpi v={s.totais.rodadas} l="rodadas de comparação" />}
          <p className="s-nota">Itens por pessoa: {s.versoes.map((v) => `${v.itens} (${v.pessoas} pessoas)`).join(' · ')}</p>
        </div>
        <BarrasFixas dados={s.porFaixa} y="pessoas" dominio={[0, 'auto']} unid="" ref={false} />
      </div>
    </>) },

  { id: 'geral', nome: 'Resultado geral', padrao: true, ok: (s) => s.geral.n > 1,
    render: (s) => { const g = s.geral; return (<>
      <Topo t={g.p < 0.05 ? `Acertamos ${f1(g.media, 0)}%: ${g.media > 50 ? 'melhor' : 'pior'} que o chute` : `Acertamos ${f1(g.media, 0)}%: perto do chute`}
        sub={`Média por pessoa contra 50% de acaso: t = ${f1(g.t, 2)}, p ${ptxt(g.p)}`} />
      <div className="s-corpo">
        <div className="s-kpis">
          <Kpi v={`${f1(g.media)}%`} l="média de acerto" cor={COR.real} />
          <Kpi v={`${f1(g.mediana)}%`} l="mediana" />
          <Kpi v={f1(g.desvio)} l="desvio padrão (p.p.)" />
          <Kpi v={`${f1(g.ic[0], 0)}–${f1(g.ic[1], 0)}%`} l="IC 95% da média" cor={COR.ia} branco />
        </div>
        <div><BarrasFixas dados={s.hist} y="n" x="nome" dominio={[0, 'auto']} unid="" ref={false} cor={COR.sol} w={620} h={360} /><p className="s-nota">Quantas pessoas em cada faixa de acerto (%)</p></div>
      </div>
    </>); } },

  { id: 'tipo', nome: 'Acerto por tipo', padrao: true, ok: (s) => s.tipoPool.length > 1,
    render: (s) => { const [m, p] = melhorPior(s.tipoPool); return (<>
      <Topo t="Qual tipo de conteúdo engana mais?" sub={`Mais fácil: ${m.nome} (${f1(m.pct, 0)}%) · Mais difícil: ${p.nome} (${f1(p.pct, 0)}%)`} />
      <div className="s-corpo">
        <BarrasFixas dados={s.tipoPool} w={640} />
        <div className="s-kpis">{s.tipoPool.map((t) => <p key={t.chave} className="s-nota"><b>{t.nome}:</b> {t.acertos} acertos em {t.respostas} respostas ({t.pessoas} pessoas)</p>)}</div>
      </div>
    </>); } },

  { id: 'ia_real', nome: 'IA × real (matriz)', padrao: true, ok: (s) => s.balanceada.nIA > 0 && s.balanceada.nReal > 0,
    render: (s) => { const c = s.conf, b = s.balanceada; return (<>
      <Topo t={b.sens < b.esp ? 'É mais difícil perceber a IA do que o real' : 'Percebemos a IA melhor do que o real'} sub={`Acurácia balanceada: ${f1(b.bal, 0)}% (média entre acertar a IA e acertar o real)`} />
      <div className="s-corpo">
        <table className="s-conf">
          <thead><tr><th /><th>Disse “IA”</th><th>Disse “Real”</th></tr></thead>
          <tbody>
            <tr><th>Era IA</th><td className="ok">{c.ia_ia}</td><td>{c.ia_real}</td></tr>
            <tr><th>Era real</th><td>{c.real_ia}</td><td className="ok">{c.real_real}</td></tr>
          </tbody>
        </table>
        <div className="s-kpis">
          <Kpi v={`${f1(b.sens, 0)}%`} l={`acerto quando era IA (${b.nIA} respostas)`} cor={COR.ia} branco />
          <Kpi v={`${f1(b.esp, 0)}%`} l={`acerto quando era real (${b.nReal} respostas)`} cor={COR.real} />
        </div>
      </div>
    </>); } },

  { id: 'idade', nome: 'Acerto por faixa etária', padrao: true, ok: (s) => s.porFaixa.length > 1,
    render: (s) => { const [m] = melhorPior(s.porFaixa); return (<>
      <Topo t="A idade muda o resultado?" sub={`Maior acerto: ${m.rotulo} (${f1(m.pct, 0)}%). Entre parênteses, o nº de pessoas de cada grupo.`} />
      <div className="s-corpo"><BarrasFixas dados={s.porFaixa} x="nome" w={900} h={400} cor={COR.real} /></div>
    </>); } },

  { id: 'confianca', nome: 'Estimado × real', padrao: true, ok: (s) => s.calib.length > 2,
    render: (s) => (<>
      <Topo t={s.vies.media > 0 ? 'A gente acha que acerta mais do que acerta' : 'A gente acerta mais do que acha'}
        sub={`Viés médio: ${f1(s.vies.media)} p.p. (p ${ptxt(s.vies.p)}) · correlação r = ${f1(s.rCalib, 2)}`} />
      <div className="s-corpo"><Dispersao pontos={s.calib} w={640} h={400} /><p className="s-nota">Cada ponto é uma pessoa. Acima da linha vermelha = achou que acertou mais do que acertou.</p></div>
    </>) },

  { id: 'comparacao', nome: 'Comparações (2 itens)', padrao: true, ok: (s) => s.comp.cenPool.length > 0,
    render: (s) => (<>
      <Topo t="Comparando dois conteúdos" sub="Acertar a rodada = acertar os dois itens. Chutando, o acerto seria de 25%." />
      <div className="s-corpo">
        <BarrasFixas dados={s.comp.cenPool} ref={25} w={600} />
        <div className="s-kpis">
          <Kpi v={`${f1(s.comp.exato.media, 0)}%`} l="rodadas com os dois itens certos" cor={COR.real} />
          <Kpi v={`${f1(s.comp.item.media, 0)}%`} l="itens certos nas comparações" />
          <Kpi v={`${f1(s.geral.media, 0)}%`} l="itens certos no modo individual" />
        </div>
      </div>
    </>) },

  { id: 'enganosos', nome: 'Os que mais enganaram', padrao: true, ok: (s) => s.itens.length >= 2,
    render: (s) => { const k = Math.min(3, Math.floor(s.itens.length / 2)); return (<>
      <Topo t="Os conteúdos que mais enganaram" sub="e os que quase todo mundo acertou (mínimo de 5 respostas cada)" />
      <div className="s-corpo s-duas"><Coluna titulo="Mais enganosos" itens={s.itens.slice(0, k)} /><Coluna titulo="Mais fáceis" itens={s.itens.slice(-k).reverse()} /></div>
    </>); } },

  { id: 'conclusao', nome: 'Conclusões', padrao: true, ok: (s) => s.geral.n > 1,
    render: (s) => (<><Topo t="O que a pesquisa mostrou" /><div className="s-corpo"><ul className="s-lista">{conclusoes(s).map((t, i) => <li key={i}>{t}</li>)}</ul></div></>) },

  { id: 'tabela', nome: 'Tabela de estatísticas', padrao: false, ok: (s) => s.geral.n > 1,
    render: (s) => (<><Topo t="Estatística descritiva" sub="Percentual de acerto por pessoa (%)" /><div className="s-corpo"><Tab linhas={[{ nome: 'Geral', ...s.geral }, ...s.porTipo.filter((r) => r.n > 1)]} /></div></>) },

  { id: 'freq', nome: 'Acerto por uso de IA', padrao: false, ok: (s) => s.porFreq.length > 1,
    render: (s) => (<>
      <Topo t="Quem usa mais IA acerta mais?" sub={`Correlação entre frequência de uso e acerto: r = ${f1(s.rFreq, 2)} (correlação não prova causa)`} />
      <div className="s-corpo"><BarrasFixas dados={s.porFreq} x="nome" w={900} h={400} cor={COR.ia} /></div>
    </>) },

  { id: 'esc', nome: 'Acerto por escolaridade', padrao: false, ok: (s) => s.porEsc.length > 1,
    render: (s) => (<><Topo t="E a escolaridade?" /><div className="s-corpo"><BarrasFixas dados={s.porEsc} x="nome" w={1000} h={420} cor={COR.real} angulo={-20} /></div></>) },

  { id: 'usos', nome: 'Para que usam IA', padrao: false, ok: (s) => s.usos.some((u) => u.n > 0),
    render: (s) => (<><Topo t="Para que as pessoas usam IA" sub="Cada pessoa podia marcar mais de uma opção" /><div className="s-corpo"><BarrasFixas dados={s.usos} x="nome" y="n" dominio={[0, 'auto']} unid="" ref={false} w={900} h={400} cor={COR.sol} /></div></>) },

  { id: 'tempo', nome: 'Tempo por tipo', padrao: false, ok: (s) => s.porTipo.some((t) => Number.isFinite(t.tempoMed)),
    render: (s) => (<><Topo t="Quanto tempo levamos para decidir" sub="Mediana, em segundos" /><div className="s-corpo"><BarrasFixas dados={s.porTipo.filter((t) => Number.isFinite(t.tempoMed)).map((t) => ({ rotulo: t.nome, v: t.tempoMed }))} y="v" dominio={[0, 'auto']} unid="s" ref={false} w={800} h={400} cor={COR.ia} /></div></>) },
];

export function Slide({ def, s }) {
  return (
    <section className="slide">
      {def.render(s)}
      {!def.semRodape && (
        <footer className="s-rodape">
          <span>Pesquisa “Real ou IA?”</span>
          <span>n = {s.totais.participantes} participantes · {s.totais.respostas} respostas{s.totais.rodadas > 0 ? ` · ${s.totais.rodadas} comparações` : ''}</span>
        </footer>
      )}
    </section>
  );
}
