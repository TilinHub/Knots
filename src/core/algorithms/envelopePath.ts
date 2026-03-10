import { Logger } from '../../app/store/Logger';
import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import type { BoundedCurvatureGraph, EnvelopeSegment, TangentSegment, ArcSegment } from '../geometry/envelope/contactGraph';
export type EnvelopePathResult = {
  path: EnvelopeSegment[];
  chiralities: ('L' | 'R')[];
};

export function calcArc(
  d: ContactDisk,
  angleIn: number,
  angleOut: number,
  chirality: 'L' | 'R',
): number {
  const PI2 = 2 * Math.PI;
  let delta = angleOut - angleIn;
  while (delta <= -Math.PI) delta += PI2;
  while (delta > Math.PI) delta -= PI2;
  if (chirality === 'L') {
    if (delta <= 0) delta += PI2;
  } else {
    if (delta >= 0) delta -= PI2;
    delta = Math.abs(delta);
  }
  return delta * d.radius;
}

export function calcShortArc(
  d: ContactDisk,
  angleIn: number,
  angleOut: number,
): { length: number; chirality: 'L' | 'R' } {
  const lLen = calcArc(d, angleIn, angleOut, 'L');
  const rLen = calcArc(d, angleIn, angleOut, 'R');
  return lLen <= rLen ? { length: lLen, chirality: 'L' } : { length: rLen, chirality: 'R' };
}

// Original Viterbi-based pathfinder for disk sequences (used by saved knots).
export function findEnvelopePath(
  graph: BoundedCurvatureGraph,
  diskIds: string[],
  fixedChiralities?: ('L' | 'R')[],
  strictChirality: boolean = true,
): EnvelopePathResult {
  Logger.debug('ContactGraph', 'Finding Envelope Path', {
    diskIds,
    fixedChiralities,
    strictChirality,
  });
  if (diskIds.length < 2) return { path: [], chiralities: [] };

  const states: ('L' | 'R')[] = ['L', 'R'];
  const CHIRALITY_MISMATCH_PENALTY = 10000;

  // dp[chirality] = { cost, path, angle }
  type DPEntry = { cost: number; path: EnvelopeSegment[]; angle: number };
  let prev = new Map<string, DPEntry>();

  // Initialize: Start with both chiralities at first disk, cost 0
  states.forEach((s) => {
    // If strict and mismatch, skip (unless strict=false, then penalty)
    if (fixedChiralities && fixedChiralities[0] && fixedChiralities[0] !== s) {
      if (strictChirality) return;
      prev.set(s, { cost: CHIRALITY_MISMATCH_PENALTY, path: [], angle: 0 });
    } else {
      prev.set(s, { cost: 0, path: [], angle: 0 });
    }
  });

  const chirResult: ('L' | 'R')[] = [];

  for (let step = 1; step < diskIds.length; step++) {
    const fromDiskId = diskIds[step - 1];
    const toDiskId = diskIds[step];
    const fromDisk = graph.nodes.get(fromDiskId);
    const toDisk = graph.nodes.get(toDiskId);
    if (!fromDisk || !toDisk) continue;

    const next = new Map<string, DPEntry>();

    // Soft Constraint: Iterate ALL states, apply penalty if mismatch
    const possibleStates = states;

    for (const toChir of possibleStates) {
      let bestCost = Infinity;
      let bestPath: EnvelopeSegment[] = [];
      let bestAngle = 0;

      // Penalty for Arriving State Mismatch
      let arrivalPenalty = 0;
      if (fixedChiralities && fixedChiralities[step] && fixedChiralities[step] !== toChir) {
        if (strictChirality) continue; // Skip in strict mode
        arrivalPenalty = CHIRALITY_MISMATCH_PENALTY;
      }

      for (const fromChir of possibleStates) {
        const prevEntry = prev.get(fromChir);
        if (!prevEntry) continue;
        if (prevEntry.cost === Infinity) continue;

        // Buscar aristas con chirality exacta (fromChir -> toChir)
        let matchingEdges = graph.edges.filter(
          (e) =>
            e.startDiskId === fromDiskId &&
            e.endDiskId === toDiskId &&
            e.type.startsWith(fromChir) &&
            e.type.endsWith(toChir),
        );

        // Fallback 1: Si no hay arista exacta y modo no-estricto, usar cualquier arista entre esos discos
        if (matchingEdges.length === 0 && !strictChirality) {
          matchingEdges = graph.edges.filter(
            (e) => e.startDiskId === fromDiskId && e.endDiskId === toDiskId,
          );
        }

        // Fallback 2: Buscar en dirección inversa y revertir (el grafo puede tener solo una dirección)
        if (matchingEdges.length === 0) {
          matchingEdges = graph.edges
            .filter(
              (e) =>
                e.startDiskId === toDiskId &&
                e.endDiskId === fromDiskId &&
                e.type.startsWith(toChir) &&
                e.type.endsWith(fromChir),
            )
            .map((e) => ({
              ...e,
              start: e.end,
              end: e.start,
              startDiskId: e.endDiskId,
              endDiskId: e.startDiskId,
            }));
        }

        const allEdges = matchingEdges;

        for (const edge of allEdges) {
          // Arc on departure disk
          const depAngle = Math.atan2(
            edge.start.y - fromDisk.center.y,
            edge.start.x - fromDisk.center.x,
          );
          const arcLen = step > 1 ? calcArc(fromDisk, prevEntry.angle, depAngle, fromChir) : 0;

          const totalCost = prevEntry.cost + arcLen + edge.length + arrivalPenalty;
          if (totalCost < bestCost) {
            bestCost = totalCost;
            const newPath = [...prevEntry.path];
            if (arcLen > 1e-4 && step > 1) {
              newPath.push({
                type: 'ARC',
                center: fromDisk.center,
                radius: fromDisk.radius,
                startAngle: prevEntry.angle,
                endAngle: depAngle,
                chirality: fromChir,
                length: arcLen,
                diskId: fromDiskId,
              });
            }
            newPath.push(edge);
            bestPath = newPath;
            bestAngle = Math.atan2(edge.end.y - toDisk.center.y, edge.end.x - toDisk.center.x);
          }
        }
      }

      if (bestCost < Infinity) {
        next.set(toChir, { cost: bestCost, path: bestPath, angle: bestAngle });
      }
    }

    prev = next;
  }

  // Pick best final state
  let bestFinal: DPEntry | null = null;
  let bestChir: 'L' | 'R' = 'L';
  for (const s of states) {
    const entry = prev.get(s);
    if (entry && (!bestFinal || entry.cost < bestFinal.cost)) {
      bestFinal = entry;
      bestChir = s;
    }
  }

  if (!bestFinal) {
    // Silenced 'No valid envelope path found' to prevent console spam
    // during continuous EditorPage evaluation of constrained topologies.
    return { path: [], chiralities: [] };
  }

  // [FIX FOR CONTINUITY: Add closing arc if closed sequence]
  if (diskIds.length > 2 && diskIds[0] === diskIds[diskIds.length - 1]) {
    const firstDiskId = diskIds[0];
    const firstDisk = graph.nodes.get(firstDiskId);

    // Find the first tangent segment to get the departure angle
    const firstTangent = bestFinal.path.find(
      (s) => s.type !== 'ARC' && s.startDiskId === firstDiskId,
    ) as TangentSegment | undefined;

    if (firstDisk && firstTangent) {
      const depAngle = Math.atan2(
        firstTangent.start.y - firstDisk.center.y,
        firstTangent.start.x - firstDisk.center.x,
      );
      const arrAngle = bestFinal.angle;

      // Infer starting chirality from the tangent type (e.g., 'RSR' -> 'R', 'LSL' -> 'L')
      let firstChir: 'L' | 'R' = 'L';
      if (firstTangent.type.startsWith('R')) {
        firstChir = 'R';
      }

      const closingArcLen = calcArc(firstDisk, arrAngle, depAngle, firstChir);

      if (closingArcLen > 1e-4) {
        bestFinal.path.push({
          type: 'ARC',
          center: firstDisk.center,
          radius: firstDisk.radius,
          startAngle: arrAngle,
          endAngle: depAngle,
          chirality: firstChir,
          length: closingArcLen,
          diskId: firstDiskId,
        });
      }
    }
  }

  Logger.debug('ContactGraph', 'Envelope Path Found', {
    cost: bestFinal.cost,
    pathLength: bestFinal.path.length,
  });
  return { path: bestFinal.path, chiralities: [] };
}
