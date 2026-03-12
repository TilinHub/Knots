import type { CSDisk, Point2D } from '../../types/cs';
import type { EnvelopeSegment } from '../envelope/contactGraph';

function normalizeAngle(a: number): number {
  const TWO_PI = 2 * Math.PI;
  let r = a % TWO_PI;
  if (r <= -Math.PI) r += TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  return r;
}

function sweepAngle(start: number, end: number, ccw: boolean): number {
  const TWO_PI = 2 * Math.PI;
  // Paso 1: obtener delta mínimo en (-π, π]
  let delta = normalizeAngle(end - start);
  // Paso 2: solo ajustar si cae en cuadrante equivocado
  if (ccw && delta <= 0) delta += TWO_PI;   // asegura (0, 2π]
  if (!ccw && delta > 0) delta -= TWO_PI;   // asegura [-2π, 0)

  // Paso 3: Optimización C1. Un arco > π en la secuencia base siempre 
  // es el lado equivocado del hull, tomar el reverso (menor a π)
  if (Math.abs(delta) > Math.PI) {
    delta = delta > 0 ? delta - TWO_PI : delta + TWO_PI;
  }

  return delta;
}

/**
 * Calcula una envolvente que sigue el orden estricto de una secuencia de discos.
 * Corrige errores topológicos (kinks, overlaps) forzando el paso por cada nodo en orden,
 * aplicando tangentes externas LSL o RSR según la chiralidad solicitada.
 *
 * @param sequence El arreglo de discos en el orden que deben conectarse.
 * @param chirality 'L' para tangentes izquierdas (bordes externos usuales), 'R' para derechas.
 * @param isClosedLoop Si es true, conecta el último disco con el primero.
 * @returns Un arreglo ordenado de segmentos ARC y LSL/RSR listos para el renderizado.
 */
export function computeSequenceEnvelope(
  sequence: CSDisk[],
  chirality: 'L' | 'R' = 'L',
  isClosedLoop: boolean = false
): EnvelopeSegment[] {
  if (sequence.length < 2) return [];

  const segments: EnvelopeSegment[] = [];
  const TWO_PI = 2 * Math.PI;

  // Colección de tangencias
  const tangents: Array<{ p1: Point2D; p2: Point2D; alpha: number; d1: CSDisk; d2: CSDisk }> = [];

  const loopLen = isClosedLoop ? sequence.length : sequence.length - 1;

  // Paso 1 & 2: Calcular el orden y cada par (C_n, C_n+1)
  for (let i = 0; i < loopLen; i++) {
    const d1 = sequence[i];
    const d2 = sequence[(i + 1) % sequence.length];

    // Distancia D
    const dx = d2.center.x - d1.center.x;
    const dy = d2.center.y - d1.center.y;
    const distSq = dx * dx + dy * dy;
    const D = Math.sqrt(distSq);

    // Ignorar casos degenerados (centros superpuestos casi idénticos)
    if (D < Math.abs(d1.visualRadius - d2.visualRadius) + 1e-4) continue;

    // Ángulo de la línea entre centros
    const phi = Math.atan2(dy, dx);

    // Relación de tangencia usando ACos
    // Math.max/min evita NaN por errores de flotación como 1.00000000000002
    const ratio = (d1.visualRadius - d2.visualRadius) / D;
    const gamma = Math.acos(Math.max(-1, Math.min(1, ratio)));

    // Determinamos el ángulo del punto de contacto al borde del radió exacto.
    // LSL (Left) resta gamma, RSR (Right) suma gamma
    const alpha = chirality === 'L' ? phi - gamma : phi + gamma;

    const p1: Point2D = {
      x: d1.center.x + d1.visualRadius * Math.cos(alpha),
      y: d1.center.y + d1.visualRadius * Math.sin(alpha),
    };

    const p2: Point2D = {
      x: d2.center.x + d2.visualRadius * Math.cos(alpha),
      y: d2.center.y + d2.visualRadius * Math.sin(alpha),
    };

    tangents.push({ p1, p2, alpha, d1, d2 });
  }

  // Paso 3 & 4: Ensamblar arcos y las rectas tangenciales calculadas
  for (let i = 0; i < tangents.length; i++) {
    const currentTangent = tangents[i];

    // Trazar el arco en el disco actual para enlazar con la tangente previa,
    // garantizando continuidad C1
    if (i > 0 || isClosedLoop) {
      const prevTangent = tangents[(i - 1 + tangents.length) % tangents.length];
      const d = currentTangent.d1;

      let startAngle = prevTangent.alpha;
      let endAngle = currentTangent.alpha;

      // Calcular la diferencia orientada para asegurar bucles sin enrollamiento erróneo
      const ccw = chirality === 'L';
      const delta = sweepAngle(startAngle, endAngle, ccw);
      const arcLength = Math.abs(delta) * d.visualRadius;

      segments.push({
        type: 'ARC',
        center: d.center,
        radius: d.visualRadius, // Fallback si se usa property equivocada en types
        startAngle,
        endAngle,
        chirality,
        length: arcLength,
        diskId: d.id,
      });
    }

    // Trazar el segmento de recta entre los puntos tangenciales
    const len = Math.hypot(
      currentTangent.p2.x - currentTangent.p1.x,
      currentTangent.p2.y - currentTangent.p1.y
    );
    
    segments.push({
      type: chirality === 'L' ? 'LSL' : 'RSR',
      start: currentTangent.p1,
      end: currentTangent.p2,
      length: len,
      startDiskId: currentTangent.d1.id,
      endDiskId: currentTangent.d2.id,
    });
  }

  return segments;
}
