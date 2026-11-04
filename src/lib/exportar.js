import { TIPOS } from './opcoes';
import { f1 } from './formatos';

export function exportarCSV(linhas) {
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
