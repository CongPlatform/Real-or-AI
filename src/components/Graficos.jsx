import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, LabelList, ScatterChart, Scatter } from 'recharts';

const INK = '#14122B';

// gráficos de tamanho fixo (usados nos slides: funcionam igual na tela, no zoom e na impressão)
export function BarrasFixas({ dados, y = 'pct', x = 'rotulo', w = 600, h = 380, cor = '#5B3DF5', dominio = [0, 100], unid = '%', linha = 50, fonte = 17, angulo = 0 }) {
  return (
    <BarChart width={w} height={h} data={dados} margin={{ top: 30, right: 16, left: 0, bottom: angulo ? 30 : 6 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={x} tick={{ fontSize: fonte - 3, fill: INK }} interval={0} angle={angulo} textAnchor={angulo ? 'end' : 'middle'} height={angulo ? 80 : 32} />
      <YAxis domain={dominio} tick={{ fontSize: fonte - 3, fill: INK }} unit={unid} allowDecimals={false} width={52} />
      {linha !== false && <ReferenceLine y={linha} stroke="#FF5C5C" strokeWidth={2} strokeDasharray="6 6" />}
      <Bar dataKey={y} fill={cor} stroke={INK} strokeWidth={2.5} radius={[6, 6, 0, 0]} isAnimationActive={false}>
        <LabelList dataKey={y} position="top" formatter={(v) => (Number.isFinite(v) ? Math.round(v) : '')} style={{ fontSize: fonte, fontWeight: 800, fill: INK }} />
      </Bar>
    </BarChart>
  );
}

export function Dispersao({ pontos, w = 600, h = 380 }) {
  return (
    <ScatterChart width={w} height={h} margin={{ top: 16, right: 20, left: 6, bottom: 30 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis type="number" dataKey="x" domain={[0, 100]} unit="%" tick={{ fontSize: 14, fill: INK }} label={{ value: 'Acerto real', position: 'insideBottom', offset: -16, fontSize: 16 }} />
      <YAxis type="number" dataKey="y" domain={[0, 100]} unit="%" tick={{ fontSize: 14, fill: INK }} width={56} label={{ value: 'Acerto estimado', angle: -90, position: 'insideLeft', offset: 4, fontSize: 16 }} />
      <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#FF5C5C" strokeWidth={2} strokeDasharray="6 6" />
      <Scatter data={pontos} fill="#5B3DF5" fillOpacity={0.65} stroke={INK} isAnimationActive={false} />
    </ScatterChart>
  );
}
