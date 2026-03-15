import { Logger } from '../../app/Logger';
import type { ContactDisk } from '../types/contactGraph';
import type { Point2D } from '../types/cs';
import type { BoundedCurvatureGraph, EnvelopeSegment, TangentSegment, ArcSegment } from '../geometry/envelope/contactGraph';
import type { EnvelopePoint } from '../types/knot';
import { intersectsAnyDiskStrict } from '../geometry/envelope/collision';

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

// -------------------------------------------------------------------------------------------------
// Helper: match points with small tolerance to avoid strict float equality issues
function matchPoint(p1: Point2D | undefined, p2: Point2D | undefined, tol = 0.1): boolean {
  if (!p1 || !p2) return false;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy < tol * tol;
}

/**
 * Given an ordered array of EnvelopePoints (in draw order),
 * assigns prev/next links to form a doubly-linked chain.
 * Does NOT create a cycle — first.prev = null, last.next = null.
 * Returns a new array (immutable input).
 */
export function buildEnvelopeChain(points: EnvelopePoint[]): EnvelopePoint[] {
  if (!points || points.length === 0) return [];
  return points.map((p, i) => ({
    ...p,
    prev: i > 0 ? points[i - 1].id : null,
    next: i < points.length - 1 ? points[i + 1].id : null,
  }));
}

// -------------------------------------------------------------------------------------------------
// Unified Entry Point
export function findEnvelopePath(
  graph: BoundedCurvatureGraph,
  diskIds: string[],
  orderedAnchorsOrChiralities?: Point2D[] | ('L' | 'R')[],
  fixedChiralitiesOrStrict?: ('L' | 'R')[] | boolean,
  strictChirality: boolean = true,
): EnvelopePathResult {
  // Disambiguate overloaded 3rd/4th params for back-compat:
  // Old call: findEnvelopePath(graph, ids, chiralities?, strict?)
  // New call: findEnvelopePath(graph, ids, orderedAnchors?, chiralities?, strict?)
  let orderedAnchors: Point2D[] | undefined;
  let fixedChiralities: ('L' | 'R')[] | undefined;

  if (
    orderedAnchorsOrChiralities &&
    orderedAnchorsOrChiralities.length > 0 &&
    typeof (orderedAnchorsOrChiralities[0] as Point2D).x === 'number'
  ) {
    // New signature: 3rd param is Point2D[]
    orderedAnchors = orderedAnchorsOrChiralities as Point2D[];
    fixedChiralities = fixedChiralitiesOrStrict as ('L' | 'R')[] | undefined;
  } else {
    // Old signature: 3rd param is chiralities
    fixedChiralities = orderedAnchorsOrChiralities as ('L' | 'R')[] | undefined;
    if (typeof fixedChiralitiesOrStrict === 'boolean') {
      strictChirality = fixedChiralitiesOrStrict;
    }
  }

  // If orderedAnchors provided, always use memory-based (anchors are the ground truth)
  if (orderedAnchors && orderedAnchors.length >= diskIds.length - 1) {
    return findEnvelopePathWithMemory(graph, diskIds, orderedAnchors, fixedChiralities, strictChirality);
  }

  // Otherwise fall back to envelopePoints-based detection (deduplicate consecutive disk IDs first)
  const uniqueIds = diskIds.filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
  const hasEnvelopePoints = uniqueIds.every(id => {
    const d = graph.nodes.get(id) as ContactDisk & { envelopePoints?: EnvelopePoint[] };
    return d && d.envelopePoints && d.envelopePoints.length > 0;
  });

  if (hasEnvelopePoints) {
    return findEnvelopePathWithMemory(graph, diskIds, undefined, fixedChiralities, strictChirality);
  } else {
    return findEnvelopePathLegacy(graph, diskIds, fixedChiralities, strictChirality);
  }
}

// -------------------------------------------------------------------------------------------------
// New algorithm using EnvelopePoint sequential memory
function findEnvelopePathWithMemory(
  graph: BoundedCurvatureGraph,
  diskIds: string[],
  orderedAnchors?: Point2D[], // anchor[i] = desired departure point at diskIds[i]
  fixedChiralities?: ('L' | 'R')[],
  strictChirality: boolean = true,
): EnvelopePathResult {
  Logger.debug('ContactGraph', 'Finding Envelope Path (With Memory)', { diskIds, fixedChiralities, strictChirality });
  if (diskIds.length < 2) return { path: [], chiralities: [] };

  const CHIRALITY_MISMATCH_PENALTY = 10000;

  // dp[arrivalId] = { cost, path, angle, arrivalChirality }
  // At step = 0, we don't have an arrival point, we use 'START'.
  type DPEntry = { cost: number; path: EnvelopeSegment[]; angle: number; arrivalChirality?: 'L' | 'R' };
  let prev = new Map<string, DPEntry>();
  prev.set('START', { cost: 0, path: [], angle: 0 });

  for (let step = 1; step < diskIds.length; step++) {
    const fromDiskId = diskIds[step - 1];
    const toDiskId = diskIds[step];
    const fromDisk = graph.nodes.get(fromDiskId) as ContactDisk & { envelopePoints?: EnvelopePoint[] };
    const toDisk = graph.nodes.get(toDiskId) as ContactDisk & { envelopePoints?: EnvelopePoint[] };
    
    if (!fromDisk || !toDisk) continue;
    // Only require envelopePoints when orderedAnchors are NOT available
    if (!orderedAnchors && (!fromDisk.envelopePoints || !toDisk.envelopePoints)) continue;

    const next = new Map<string, DPEntry>();

    for (const [arrId, prevEntry] of prev.entries()) {
      let validQs: EnvelopePoint[] = [];

      // --- OrderedAnchors path: use the pre-ordered anchor for this step directly ---
      if (orderedAnchors && orderedAnchors[step - 1]) {
        const anchorPos = orderedAnchors[step - 1];
        validQs = [{
          id: `ordered-${step - 1}`,
          diskId: fromDiskId,
          position: anchorPos,
          angle: Math.atan2(
            anchorPos.y - fromDisk.center.y,
            anchorPos.x - fromDisk.center.x,
          ),
          prev: null,
          next: null,
          segmentId: 'main',
        }];
      } else if (arrId === 'START') {
        // At the very first disk, all envelope points are valid potential departure points
        validQs = fromDisk.envelopePoints ?? [];
      } else {
        // Arrived at P, the only valid departure is P.next
        const P = (fromDisk.envelopePoints ?? []).find(ep => ep.id === arrId);
        if (P && P.next) {
          const Q = (fromDisk.envelopePoints ?? []).find(ep => ep.id === P.next);
          if (Q) validQs.push(Q);
        }
      }

      for (const Q of validQs) {
        // Find edges STARTING at the designated departure point Q
        const candidateEdges = graph.edges.filter(
          (e) => e.startDiskId === fromDiskId && e.endDiskId === toDiskId
        );

        let matchingEdges: typeof candidateEdges = candidateEdges;
        if (candidateEdges.length > 1) {
          const best = candidateEdges.reduce((b, e) => {
            const db = Math.hypot(b.start.x - Q.position.x, b.start.y - Q.position.y);
            const de = Math.hypot(e.start.x - Q.position.x, e.start.y - Q.position.y);
            return de < db ? e : b;
          });
          matchingEdges = [best];
        }

        // Fallback for reversed edges (common in undirected graphs)
        if (matchingEdges.length === 0) {
          const reversed = graph.edges
            .filter((e) => e.startDiskId === toDiskId && e.endDiskId === fromDiskId)
            .map((e) => ({
              ...e,
              start: e.end,
              end: e.start,
              startDiskId: e.endDiskId,
              endDiskId: e.startDiskId,
            }));
          if (reversed.length > 0) matchingEdges = [reversed[0]];
        }

        for (const edge of matchingEdges) {
          // Identify traversal chiralities based on tangent type
          const fromChir = edge.type.charAt(0) === 'L' ? 'L' : 'R';
          const toChir = edge.type.charAt(edge.type.length - 1) === 'L' ? 'L' : 'R';
          
          // Legacy support: Add mismatch penalty if fixedChiralities constrain us 
          // (though memory-based should ideally ignore this)
          let arrivalPenalty = 0;
          if (fixedChiralities && fixedChiralities[step] && fixedChiralities[step] !== toChir) {
            if (strictChirality) continue;
            arrivalPenalty = CHIRALITY_MISMATCH_PENALTY;
          }

          const depAngle = Math.atan2(edge.start.y - fromDisk.center.y, edge.start.x - fromDisk.center.x);
          const arcLen = step > 1 ? calcArc(fromDisk, prevEntry.angle, depAngle, fromChir) : 0;

          const totalCost = prevEntry.cost + arcLen + edge.length + arrivalPenalty;
          
          // Find the new arrival state on the target disk
          // When using orderedAnchors the toDisk may have no envelopePoints — use a synthetic one
          const toDiskEPs = toDisk.envelopePoints ?? [];
          if (!orderedAnchors && toDiskEPs.length === 0) continue;

          // Synthetic arrival point keyed by edge endpoint when no EPs exist
          const R = toDiskEPs.length > 0 ? toDiskEPs.reduce((closest, ep) => {
            const dc = Math.hypot(closest.position.x - edge.end.x, closest.position.y - edge.end.y);
            const de = Math.hypot(ep.position.x - edge.end.x, ep.position.y - edge.end.y);
            return de < dc ? ep : closest;
          }) : {
            id: `synthetic-${toDiskId}-${step}`,
            diskId: toDiskId,
            position: edge.end,
            angle: Math.atan2(edge.end.y - toDisk.center.y, edge.end.x - toDisk.center.x),
            prev: null as string | null,
            next: null as string | null,
            segmentId: 'main',
          };

          // Select best path to R
          const existingNext = next.get(R.id);
          if (!existingNext || totalCost < existingNext.cost) {
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
            
            next.set(R.id, {
              cost: totalCost,
              path: newPath,
              angle: Math.atan2(edge.end.y - toDisk.center.y, edge.end.x - toDisk.center.x),
              arrivalChirality: toChir
            });
          }
        }
      }
    }
    prev = next;
  }

  // Pick best final state
  let bestFinal: DPEntry | null = null;
  for (const entry of prev.values()) {
    if (!bestFinal || entry.cost < bestFinal.cost) bestFinal = entry;
  }

  if (!bestFinal) return { path: [], chiralities: [] };

  // Continuity logic for closed sequences
  if (diskIds.length > 2 && diskIds[0] === diskIds[diskIds.length - 1]) {
    const firstDiskId = diskIds[0];
    const firstDisk = graph.nodes.get(firstDiskId) as ContactDisk & { envelopePoints?: EnvelopePoint[] };
    const firstTangent = bestFinal.path.find(s => s.type !== 'ARC' && s.startDiskId === firstDiskId) as TangentSegment | undefined;

    if (firstDisk && firstTangent) {
      const depAngle = Math.atan2(firstTangent.start.y - firstDisk.center.y, firstTangent.start.x - firstDisk.center.x);
      const arrAngle = bestFinal.angle;
      let firstChir: 'L' | 'R' = 'L';
      if (firstTangent.type.startsWith('R')) firstChir = 'R';
      
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

  // Post-validation: remove tangent segments that pass through any disk they shouldn't
  const allDisksMemory = Array.from(graph.nodes.values());
  const validatedPathMemory = bestFinal.path.filter((seg) => {
    if (seg.type === 'ARC') return true;
    const tan = seg as TangentSegment;
    return !intersectsAnyDiskStrict(tan.start, tan.end, allDisksMemory, tan.startDiskId, tan.endDiskId);
  });
  bestFinal.path = validatedPathMemory;

  Logger.debug('ContactGraph', 'Envelope Path Found (Memory)', {
    cost: bestFinal.cost,
    pathLength: bestFinal.path.length,
  });
  return { path: bestFinal.path, chiralities: [] };
}

// -------------------------------------------------------------------------------------------------
// Original Viterbi-based pathfinder (fallback for old saves without envelopePoints)
function findEnvelopePathLegacy(
  graph: BoundedCurvatureGraph,
  diskIds: string[],
  fixedChiralities?: ('L' | 'R')[],
  strictChirality: boolean = true,
): EnvelopePathResult {
  Logger.debug('ContactGraph', 'Finding Envelope Path (Legacy)', {
    diskIds,
    fixedChiralities,
    strictChirality,
  });
  if (diskIds.length < 2) return { path: [], chiralities: [] };

  const states: ('L' | 'R')[] = ['L', 'R'];
  const CHIRALITY_MISMATCH_PENALTY = 10000;

  // Compute a geometry-proportional chirality penalty: prefer a chirality flip
  // over wrapping more than ~180° around any disk.
  let maxR = 1;
  graph.nodes.forEach(d => { if (d.radius > maxR) maxR = d.radius; });
  const DYNAMIC_CHIRALITY_PENALTY = Math.PI * maxR * 1.5;

  // dp[chirality] = { cost, path, angle }
  type DPEntry = { cost: number; path: EnvelopeSegment[]; angle: number };
  let prev = new Map<string, DPEntry>();

  // Initialize: Start with both chiralities at first disk, cost 0
  states.forEach((s) => {
    if (fixedChiralities && fixedChiralities[0] && fixedChiralities[0] !== s) {
      if (strictChirality) return;
      prev.set(s, { cost: DYNAMIC_CHIRALITY_PENALTY, path: [], angle: 0 });
    } else {
      prev.set(s, { cost: 0, path: [], angle: 0 });
    }
  });

  for (let step = 1; step < diskIds.length; step++) {
    const fromDiskId = diskIds[step - 1];
    const toDiskId = diskIds[step];
    const fromDisk = graph.nodes.get(fromDiskId);
    const toDisk = graph.nodes.get(toDiskId);
    if (!fromDisk || !toDisk) continue;

    const next = new Map<string, DPEntry>();
    const possibleStates = states;

    for (const toChir of possibleStates) {
      let bestCost = Infinity;
      let bestPath: EnvelopeSegment[] = [];
      let bestAngle = 0;

      let arrivalPenalty = 0;
      if (fixedChiralities && fixedChiralities[step] && fixedChiralities[step] !== toChir) {
        if (strictChirality) continue;
        arrivalPenalty = DYNAMIC_CHIRALITY_PENALTY;
      }

      for (const fromChir of possibleStates) {
        const prevEntry = prev.get(fromChir);
        if (!prevEntry) continue;
        if (prevEntry.cost === Infinity) continue;

        let matchingEdges = graph.edges.filter(
          (e) =>
            e.startDiskId === fromDiskId &&
            e.endDiskId === toDiskId &&
            e.type.startsWith(fromChir) &&
            e.type.endsWith(toChir),
        );

        if (matchingEdges.length === 0 && !strictChirality) {
          matchingEdges = graph.edges.filter(
            (e) => e.startDiskId === fromDiskId && e.endDiskId === toDiskId,
          );
        }

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
    return { path: [], chiralities: [] };
  }

  if (diskIds.length > 2 && diskIds[0] === diskIds[diskIds.length - 1]) {
    const firstDiskId = diskIds[0];
    const firstDisk = graph.nodes.get(firstDiskId);
    const firstTangent = bestFinal.path.find(
      (s) => s.type !== 'ARC' && s.startDiskId === firstDiskId,
    ) as TangentSegment | undefined;

    if (firstDisk && firstTangent) {
      const depAngle = Math.atan2(
        firstTangent.start.y - firstDisk.center.y,
        firstTangent.start.x - firstDisk.center.x,
      );
      const arrAngle = bestFinal.angle;

      let firstChir: 'L' | 'R' = 'L';
      if (firstTangent.type.startsWith('R')) firstChir = 'R';

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

  // Post-validation: remove tangent segments that pass through any disk they shouldn't
  const allDisksLegacy = Array.from(graph.nodes.values());
  const validatedPathLegacy = bestFinal.path.filter((seg) => {
    if (seg.type === 'ARC') return true;
    const tan = seg as TangentSegment;
    return !intersectsAnyDiskStrict(tan.start, tan.end, allDisksLegacy, tan.startDiskId, tan.endDiskId);
  });
  bestFinal.path = validatedPathLegacy;

  Logger.debug('ContactGraph', 'Envelope Path Found', {
    cost: bestFinal.cost,
    pathLength: bestFinal.path.length,
  });
  return { path: bestFinal.path, chiralities: [] };
}
