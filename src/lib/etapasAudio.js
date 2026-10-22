// Limites cumulativos de escuta, relativos à duração REAL do arquivo.
// 60 segundos => 1, 3, 5, 10, 20, 35, 50 e 60 segundos.
// Áudios curtos: quatro etapas; evita fragmentar uma frase em décimos de segundo.
export function etapasDeAudio(duracao) {
  if (!Number.isFinite(duracao) || duracao <= 0) return [];
  const razoes = duracao < 20
    ? [0.25, 0.5, 0.75, 1]
    : [1 / 60, 3 / 60, 5 / 60, 10 / 60, 20 / 60, 35 / 60, 50 / 60, 1];
  const valores = [];
  for (const fracao of razoes) {
    const segundos = Math.min(duracao, Math.max(duracao < 20 ? 0.5 : 1, Math.round(duracao * fracao * 10) / 10));
    if (segundos > (valores.at(-1) ?? 0) + 0.05) valores.push(segundos);
  }
  if (!valores.length || valores[valores.length - 1] < duracao - 0.05) valores.push(duracao);
  return valores;
}

export function tempoLegivel(segundos) {
  if (!Number.isFinite(segundos)) return '—';
  if (segundos < 60) return `${Number(segundos.toFixed(1)).toString().replace('.', ',')} s`;
  const m = Math.floor(segundos / 60);
  const s = segundos - m * 60;
  return `${m}min ${Number(s.toFixed(1)).toString().replace('.', ',')}s`;
}
