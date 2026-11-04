import { FAIXAS, ESCOLARIDADES, FREQ, USOS, TIPOS } from './opcoes';

export const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
export const variancia = (a) => {
  if (a.length < 2) return NaN;
  const m = media(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); // amostral (n-1)
};
export const desvio = (a) => Math.sqrt(variancia(a));
export const quantil = (a, q) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const p = (s.length - 1) * q, b = Math.floor(p);
  return s[b + 1] === undefined ? s[b] : s[b] + (p - b) * (s[b + 1] - s[b]);
};
function erf(x) {
  const sg = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sg * y;
}
export const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

export function pearson(xs, ys) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pts.length < 3) return NaN;
  const mx = media(pts.map((p) => p[0])), my = media(pts.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// Estatística descritiva + IC 95% + teste t de uma amostra contra mu0 (aprox. normal p/ n grande)
export function resumo(a, mu0 = 50) {
  const n = a.length, m = media(a), s = desvio(a), ep = s / Math.sqrt(n), t = (m - mu0) / ep;
  return {
    n, media: m, mediana: quantil(a, 0.5), desvio: s, variancia: variancia(a),
    min: n ? Math.min(...a) : NaN, max: n ? Math.max(...a) : NaN, q1: quantil(a, 0.25), q3: quantil(a, 0.75),
    cv: (s / m) * 100, ep, ic: [Math.max(0, m - 1.96 * ep), Math.min(100, m + 1.96 * ep)],
    t, p: 2 * (1 - normalCdf(Math.abs(t))),
  };
}

const pc = (a, n) => (n ? (100 * a) / n : NaN);

// Por grupo: média POR PESSOA (para desvio) e % POR RESPOSTA (acertos ÷ respostas) — esta é a usada nos gráficos,
// porque pondera cada pessoa pelo que ela realmente respondeu (versão reduzida e completa juntas).
const grupo = (linhas, campo, ordem) =>
  ordem.map((k) => {
    const L = linhas.filter((l) => String(l[campo]) === String(k));
    const a = L.map((l) => l.pct);
    const resp = L.reduce((s, l) => s + l.n, 0), ac = L.reduce((s, l) => s + l.acertos, 0);
    return { nome: `${k} (n=${L.length})`, rotulo: String(k), pessoas: L.length, n: L.length, media: media(a), desvio: desvio(a), respostas: resp, acertos: ac, pct: pc(ac, resp) };
  }).filter((g) => g.pessoas > 0);

export const CEN = ['Nenhum é IA', 'Um é IA', 'Todos são IA'];

// opts.parciais = true inclui quem respondeu mas não chegou ao fim
export function analisar(d, opts = {}) {
  const todos = d.participantes || [];
  const respAll = d.respostas || [];
  const comResp = new Set(respAll.map((r) => r.participante_id));
  const base = opts.parciais ? todos.filter((p) => p.finalizado || comResp.has(p.id)) : todos.filter((p) => p.finalizado);
  const ids = new Set(base.map((p) => p.id));
  const resp = respAll.filter((r) => ids.has(r.participante_id));
  const rc0 = (d.resp_comp || []).filter((r) => ids.has(r.participante_id));

  const mapa = new Map();
  resp.forEach((r) => {
    const o = mapa.get(r.participante_id) || { n: 0, a: 0, t: {} };
    o.n++; if (r.acertou) o.a++;
    const t = o.t[r.tipo] || (o.t[r.tipo] = { n: 0, a: 0 });
    t.n++; if (r.acertou) t.a++;
    mapa.set(r.participante_id, o);
  });
  const mc = new Map();
  rc0.forEach((r) => {
    const o = mc.get(r.participante_id) || { n: 0, ex: 0, it: 0, ni: 0, t: {}, c: {} };
    o.n++; if (r.acertou) o.ex++; o.it += r.acertos_itens; o.ni += r.n_itens;
    const t = o.t[r.tipo] || (o.t[r.tipo] = { n: 0, ex: 0 }); t.n++; if (r.acertou) t.ex++;
    const c = o.c[r.n_reais_ia] || (o.c[r.n_reais_ia] = { n: 0, ex: 0 }); c.n++; if (r.acertou) c.ex++;
    mc.set(r.participante_id, o);
  });
  const compDe = (o) => ({ n: o.n, exato: (100 * o.ex) / o.n, item: (100 * o.it) / o.ni, t: o.t, c: o.c });

  const linhas = base.filter((p) => mapa.has(p.id)).map((p) => {
    const o = mapa.get(p.id);
    return { ...p, n: o.n, acertos: o.a, pct: (100 * o.a) / o.n, tipos: o.t, comp: mc.has(p.id) ? compDe(mc.get(p.id)) : null };
  });
  const idsL = new Set(linhas.map((l) => l.id));
  const rc = rc0.filter((r) => idsL.has(r.participante_id));
  const pcts = linhas.map((l) => l.pct);

  const vm = new Map();
  linhas.forEach((l) => vm.set(l.n, (vm.get(l.n) || 0) + 1));
  const versoes = [...vm].map(([itens, pessoas]) => ({ itens, pessoas })).sort((a, b) => a.itens - b.itens);
  const totais = {
    participantes: linhas.length, respostas: resp.length, rodadas: rc.length, cadastrados: todos.length,
    parciaisFora: opts.parciais ? 0 : todos.filter((p) => !p.finalizado && comResp.has(p.id)).length,
  };

  const tipoPool = Object.keys(TIPOS).map((t) => {
    const R = resp.filter((r) => r.tipo === t);
    const a = R.filter((r) => r.acertou).length;
    return { chave: t, nome: TIPOS[t], rotulo: TIPOS[t], respostas: R.length, acertos: a, pct: pc(a, R.length), pessoas: new Set(R.map((r) => r.participante_id)).size };
  }).filter((x) => x.respostas > 0);

  const porTipo = Object.keys(TIPOS).map((t) => {
    const a = linhas.filter((l) => l.tipos[t]).map((l) => (100 * l.tipos[t].a) / l.tipos[t].n);
    const tempos = resp.filter((r) => r.tipo === t && r.tempo_ms != null).map((r) => r.tempo_ms / 1000);
    return { chave: t, nome: TIPOS[t], ...resumo(a), tempoMed: quantil(tempos, 0.5) };
  });

  const c = { ia_ia: 0, ia_real: 0, real_ia: 0, real_real: 0 };
  resp.forEach((r) => { c[(r.eh_ia ? 'ia' : 'real') + '_' + (r.resposta_ia ? 'ia' : 'real')]++; });
  const nIA = c.ia_ia + c.ia_real, nReal = c.real_ia + c.real_real;
  const sens = pc(c.ia_ia, nIA), esp = pc(c.real_real, nReal);
  const balanceada = { sens, esp, bal: (sens + esp) / 2, nIA, nReal };

  const hist = Array.from({ length: 10 }, (_, i) => ({ nome: `${i * 10}–${i * 10 + 10}`, n: 0 }));
  pcts.forEach((p) => { hist[Math.min(9, Math.floor(p / 10))].n++; });

  const calib = linhas.filter((l) => l.estimativa_acertos != null).map((l) => ({ x: l.pct, y: (100 * l.estimativa_acertos) / l.n }));
  const dif = calib.map((p) => p.y - p.x);

  const cont = new Map((d.conteudos || []).map((x) => [x.id, x]));
  const im = new Map();
  resp.forEach((r) => { const o = im.get(r.conteudo_id) || { n: 0, a: 0 }; o.n++; if (r.acertou) o.a++; im.set(r.conteudo_id, o); });
  const itens = [...im].map(([id, o]) => ({ ...(cont.get(id) || {}), id, n: o.n, a: o.a, pct: pc(o.a, o.n) }))
    .filter((x) => x.tipo && x.n >= 5).sort((x, y) => x.pct - y.pct);

  const cl = linhas.filter((l) => l.comp);
  const pool = (R, nome) => { const a = R.filter((x) => x.acertou).length; return { nome, rotulo: nome, respostas: R.length, acertos: a, pct: pc(a, R.length), pessoas: new Set(R.map((x) => x.participante_id)).size }; };
  const comp = {
    n: cl.length, nResp: rc.length,
    exato: resumo(cl.map((l) => l.comp.exato), 25),
    item: resumo(cl.map((l) => l.comp.item), 50),
    dif: resumo(cl.map((l) => l.comp.item - l.pct), 0),
    porTipo: Object.keys(TIPOS).map((t) => ({
      chave: t, nome: TIPOS[t],
      ...resumo(cl.filter((l) => l.comp.t[t]).map((l) => (100 * l.comp.t[t].ex) / l.comp.t[t].n), 25),
    })),
    porCen: [0, 1, 2].map((k) => ({
      nome: CEN[k],
      ...resumo(cl.filter((l) => l.comp.c[k]).map((l) => (100 * l.comp.c[k].ex) / l.comp.c[k].n), 25),
    })),
    cenPool: [0, 1, 2].map((k) => pool(rc.filter((x) => x.n_reais_ia === k), CEN[k])).filter((x) => x.respostas > 0),
    tipoPool: Object.keys(TIPOS).map((t) => pool(rc.filter((x) => x.tipo === t), TIPOS[t])).filter((x) => x.respostas > 0),
    tend: [0, 1, 2].map((k) => {
      const r = rc.filter((x) => x.n_reais_ia === k);
      const mi = r.reduce((s, x) => s + x.n_marcados_ia, 0), ni = r.reduce((s, x) => s + x.n_itens, 0);
      return { nome: CEN[k], media: ni ? (100 * mi) / ni : NaN };
    }),
  };

  return {
    totais, versoes, linhas, comp, geral: resumo(pcts), porTipo, tipoPool, conf: c, balanceada, hist, calib, vies: resumo(dif, 0), itens,
    porFaixa: grupo(linhas, 'faixa_etaria', FAIXAS),
    porEsc: grupo(linhas, 'escolaridade', ESCOLARIDADES),
    porFreq: grupo(linhas, 'freq_ia', FREQ),
    porConf: grupo(linhas, 'confianca', [1, 2, 3, 4, 5]),
    usos: USOS.map((u) => ({ nome: u, n: linhas.filter((p) => (p.usos_ia || []).includes(u)).length })),
    rConf: pearson(linhas.map((l) => l.confianca), pcts),
    rFreq: pearson(linhas.map((l) => FREQ.indexOf(l.freq_ia)), pcts),
    rCalib: pearson(calib.map((p) => p.x), calib.map((p) => p.y)),
  };
}

// estatística por conteúdo (todas as respostas, para a tela de revisão)
export function statsConteudos(d) {
  const m = new Map();
  const at = (id) => { if (!m.has(id)) m.set(id, { n: 0, a: 0, ia: 0 }); return m.get(id); };
  (d.respostas || []).forEach((r) => { const o = at(r.conteudo_id); o.n++; if (r.acertou) o.a++; if (r.resposta_ia) o.ia++; });
  const porComp = new Map();
  (d.conteudos || []).forEach((c) => { if (c.comparacao_id) { if (!porComp.has(c.comparacao_id)) porComp.set(c.comparacao_id, []); porComp.get(c.comparacao_id).push(c); } });
  (d.resp_comp || []).forEach((r) => {
    if (!r.marcados) return;
    (porComp.get(r.comparacao_id) || []).forEach((c) => {
      const o = at(c.id), marc = r.marcados.includes(c.id);
      o.n++; if (marc) o.ia++; if (marc === !!c.eh_ia) o.a++;
    });
  });
  return m;
}
