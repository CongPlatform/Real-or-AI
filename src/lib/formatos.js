export const f1 = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '—');
export const fp = (p) => (!Number.isFinite(p) ? '—' : p < 0.001 ? '< 0,001' : f1(p, 3));
export const ptxt = (p) => (fp(p).startsWith('<') ? fp(p) : '= ' + fp(p));
