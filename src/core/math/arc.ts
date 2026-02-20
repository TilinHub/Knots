export function polarToCartesian(c: { x: number; y: number }, r: number, angleRad: number) {
  return { x: c.x + r * Math.cos(angleRad), y: c.y + r * Math.sin(angleRad) };
}

// Normaliza a [0, 2π)
export function normAngle(a: number) {
  const t = 2 * Math.PI;
  return ((a % t) + t) % t;
}

export function arcToSvgPathD(params: {
  c: { x: number; y: number };
  r: number;
  startAngle: number; // rad
  endAngle: number; // rad
  sweep: 'ccw' | 'cw';
}) {
  const { c, r, sweep } = params;

  const a0 = normAngle(params.startAngle);
  const a1 = normAngle(params.endAngle);

  const start = polarToCartesian(c, r, a0);
  const end = polarToCartesian(c, r, a1);

  // delta según sentido
  const rawDelta =
    sweep === 'ccw'
      ? a1 >= a0
        ? a1 - a0
        : a1 + 2 * Math.PI - a0
      : a0 >= a1
        ? a0 - a1
        : a0 + 2 * Math.PI - a1;

  // SVG large-arc-flag es 1 si el arco es > 180°
  const largeArcFlag = rawDelta > Math.PI ? 1 : 0;

  // SVG sweep-flag: 1 es “positivo” en el sistema de SVG; como SVG usa eje Y hacia abajo,
  // en práctica lo más estable es mapearlo así y ajustar si ves el arco al revés:
  const sweepFlag = sweep === 'ccw' ? 1 : 0;

  // 'A rx ry xAxisRotation largeArcFlag sweepFlag x y'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}
