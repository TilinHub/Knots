import { computeDiskHull, type HullSegment } from '../../../core/geometry/diskHull';
import type { CSDisk } from '../../../core/types/cs';
import { dist } from '../../analysis/first_variation/geometry';
import type {
  Arc,
  Contact,
  CSDiagram,
  Segment,
  Tangency,
  Tolerances,
} from '../../analysis/first_variation/types';

/**
 * Converts a set of visual Disks into a rigorous CSDiagram using the Convex Hull
 * as the topology definition.
 */
export function convertDisksToDiagram(disks: CSDisk[]): CSDiagram | null {
  if (disks.length < 2) return null;

  // 1. Compute Convex Hull to get the envelope topology
  // We map CSDisk to the simple properties needed by computeDiskHull
  const simpleDisks = disks.map((d) => ({
    id: d.id,
    x: d.center.x,
    y: d.center.y,
    r: d.visualRadius,
  }));

  const hull = computeDiskHull(simpleDisks);
  if (hull.segments.length === 0) return null;

  // 2. Build CSDiagram components
  const tangencies: Tangency[] = [];
  const segments: Segment[] = [];
  const arcs: Arc[] = [];
  const contacts: Contact[] = [];

  // Map to keep track of created tangencies to avoid duplication logic complexity
  // Key: "diskId-type" where type is 'in' (arrival) or 'out' (departure)
  // Actually, following the loop:
  // Arc (Disk i) -> starts at t_in, ends at t_out
  // Tangent (Disk i->j) -> starts at t_out (from i), ends at t_in (at j)

  // We iterate segments. They come interleaved: Arc, Tangent, Arc, Tangent...
  // But computeDiskHull implementation:
  // "Interleave Arcs and Tangents" loop:
  // Pushes Arc (curr), then Tangent (curr -> next)

  // So for each disk in the hull, we generate:
  // 1 Tangency OUT (at end of Arc / start of Tangent)
  // 1 Tangency IN (at end of Tangent / start of Arc) -- Wait, handled by previous/next iteration?

  // Let's iterate the HullSegments directly.
  // They are ordered CCW.

  // We need to assign IDs to tangencies.
  // Let's use sequential IDs for simplicity and matching the matrix rows easily?
  // Or descriptive IDs? Descriptive is better for debugging.

  hull.segments.forEach((seg, index) => {
    if (seg.type === 'tangent') {
      // Tangent Segment: From Disk1 to Disk2
      const tStartId = `t-${seg.disk1.id}-out`;
      const tEndId = `t-${seg.disk2.id}-in`;

      // Identify indices in the provided disks array (for CSDiagram referencing)
      const idx1 = disks.findIndex((d) => d.id === seg.disk1.id);
      const idx2 = disks.findIndex((d) => d.id === seg.disk2.id);

      // Create Tangency points if they don't exist yet?
      // We should just define them.
      // Note: In CSDiagram, tangencies are a list.
      // We will add them to the list. Uniqueness check is needed?
      // Yes, because Arcs will also refer to them.

      // Actually, let's just create the objects and push distinct ones later.
      // Tangent starts at 'from' (on disk1). This is 't-disk1-out'.
      // Tangent ends at 'to' (on disk2). This is 't-disk2-in'.

      segments.push({
        startTangencyId: tStartId,
        endTangencyId: tEndId,
      });

      // Ensure these tangencies are in our list
      if (!tangencies.find((t) => t.id === tStartId)) {
        tangencies.push({
          id: tStartId,
          diskIndex: idx1,
          point: { x: seg.from.x, y: seg.from.y },
        });
      }
      if (!tangencies.find((t) => t.id === tEndId)) {
        tangencies.push({
          id: tEndId,
          diskIndex: idx2,
          point: { x: seg.to.x, y: seg.to.y },
        });
      }
    } else if (seg.type === 'arc') {
      // Arc Segment: On Disk
      const tStartId = `t-${seg.disk.id}-in`; // Arriving from previous tangent
      const tEndId = `t-${seg.disk.id}-out`; // Leaving for next tangent

      const idx = disks.findIndex((d) => d.id === seg.disk.id);

      // Calculate Delta Theta
      let delta = seg.endAngle - seg.startAngle;
      while (delta <= 0) delta += 2 * Math.PI; // Ensure positive CCW

      arcs.push({
        startTangencyId: tStartId,
        endTangencyId: tEndId,
        diskIndex: idx,
        deltaTheta: delta,
      });

      // Ensure tangencies exist (Arc Start = prev Tangent End, Arc End = next Tangent Start)
      // The coordinates should match exactly what is in the HullSegment
      if (!tangencies.find((t) => t.id === tStartId)) {
        tangencies.push({
          id: tStartId,
          diskIndex: idx,
          point: { x: seg.startPoint.x, y: seg.startPoint.y },
        });
      }
      if (!tangencies.find((t) => t.id === tEndId)) {
        tangencies.push({
          id: tEndId,
          diskIndex: idx,
          point: { x: seg.endPoint.x, y: seg.endPoint.y },
        });
      }
    }
  });

  // 3. Detect Contacts
  // We check all pairs of disks for contact (dist approx sum of radii)
  // Tolerance slightly loose to handle floating point noise from UI placement
  const CONTACT_TOLERANCE = 1.0;

  for (let i = 0; i < disks.length; i++) {
    for (let j = i + 1; j < disks.length; j++) {
      const d1 = disks[i];
      const d2 = disks[j];
      const d = dist(d1.center, d2.center);
      const sumR = d1.visualRadius + d2.visualRadius;

      if (Math.abs(d - sumR) < CONTACT_TOLERANCE) {
        contacts.push({ diskA: i, diskB: j });
      }
    }
  }

  // 4. Diagram Assembly
  // Prepare disks in the format expected by CSDiagram { index, center }
  // Note: CSDiagram disks must be in order 0..N-1 matching the input array
  const diagDisks = disks.map((d, i) => ({
    index: i,
    center: { x: d.center.x, y: d.center.y }, // Visual center
    // Note: Diagram logic usually assumes Unit Radius for math checks?
    // Instructions.pdf: "1.2 Datos del diagrama... radios 1".
    // If our disks have visualRadius != 1, the checks "||p - c|| - 1" will FAIL.
    // We must NORMALIZE the diagram or update the tolerances/checks.
    // The Protocol checks specificially: "||p - c|| - 1 <= tol".
    // This implies the math is HARDCODED for radius=1.
    // So we should SCALE the diagram down to radius=1 for analysis.
  }));

  // SCALING LOGIC
  // We assume all disks have roughly the same radius?
  // If not, the protocol allows varying radii?
  // "Un conjunto de N discos D_1...D_N de radio 1" (Section 1.1) -> YES, FIXED RADIUS 1.
  // Our UI allows varying radii? Usually not in Knot Mode (all same size).
  // Let's assume uniform scaling factor based on the first disk.

  const scaleFactor = 1.0 / disks[0].visualRadius;

  const scaledDisks = diagDisks.map((d) => ({
    index: d.index,
    center: { x: d.center.x * scaleFactor, y: d.center.y * scaleFactor },
  }));

  const scaledTangencies = tangencies.map((t) => ({
    ...t,
    point: { x: t.point.x * scaleFactor, y: t.point.y * scaleFactor },
  }));

  // 5. Geometric Regularization (Snap to Exact Contacts)
  // To satisfy "Total Exactness" requested by user, we must adjust the centers
  // such that dist(ci, cj) is EXACTLY (Ri + Rj).
  // We use a simple iterative projection solver.
  const REGULARIZATION_STEPS = 50;
  const regularizationDisks = scaledDisks.map((d) => ({ ...d }));

  for (let step = 0; step < REGULARIZATION_STEPS; step++) {
    let maxErr = 0;
    for (const c of contacts) {
      const d1 = regularizationDisks[c.diskA];
      const d2 = regularizationDisks[c.diskB];

      // Current distance
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const currentDist = Math.sqrt(dx * dx + dy * dy);

      // Target distance (Radius is 1.0 in scaled diagram)
      // Wait, we scaled everything by ScaleFactor.
      // visualRadius[i] * ScaleFactor approx 1.0?
      // Yes, if we assume equal radii.
      // If radii differ, we need to know the Scaled Radii.
      // Let's assume Unit Radii for the diagram protocol as per Instructions.
      const targetDist = 2.0; // 1.0 + 1.0

      const err = currentDist - targetDist;
      if (Math.abs(err) > maxErr) maxErr = Math.abs(err);

      // Correction vector (move each 0.5 * err towards/away)
      // if err > 0 (too far), move closer.
      // if err < 0 (too close), move apart.
      const correction = err * 0.5;
      const ux = dx / currentDist;
      const uy = dy / currentDist;

      // Move d1 towards d2
      d1.center.x += ux * correction;
      d1.center.y += uy * correction;

      // Move d2 away from d1 (or rather, towards eq)
      d2.center.x -= ux * correction;
      d2.center.y -= uy * correction;
    }
    if (maxErr < 1e-6) break;
  }

  // Update tangencies based on new regularized centers?
  // Tangencies depend on centers.
  // Tangency point is midpoint for equal radii?
  // Instructions: p_alpha = ci + Ri u_ij ??
  // Actually, we must Re-calculate tangency points based on new centers to be consistent!
  // And what about Arc tangencies? They rely on Hull Topology.
  // If we move disks, Topology might change?
  // We assume movement is small (regularization), so topology (who touches who) stays same.
  // We just update coordinates.

  // Re-computing Tangency Points
  // Tangency at contact (if any): midpoint.
  // Tangency at hull (Arc/Tangent transition):
  // "Tangent segment leaves d1 at t-out and enters d2 at t-in".
  // We can re-compute the outer tangent between the new centers.

  // Let's rebuild the specific points for the kept topology.
  // We have `tangencies` list. We need to update their `point` coordinates.

  const regularizedTangencies = scaledTangencies.map((t) => ({ ...t })); // Clone

  // Map for fast lookup by ID
  const tMap = new Map();
  regularizedTangencies.forEach((t) => tMap.set(t.id, t));

  // 1. Update Tangencies from Hull Segments (Outer Tangents)
  // We iterate the identified segments and re-calculate the geometric tangent points
  // for the NEW centers.
  // NOTE: This assumes the original 'segments' list (from hull) still maps correctly
  // to the pairs in `regularizationDisks`.

  segments.forEach((seg) => {
    // Find corresponding disk indices
    // Tangency IDs: startTangencyId, endTangencyId
    // start is on diskA (leaving), end is on diskB (entering)
    const tStart = tMap.get(seg.startTangencyId);
    const tEnd = tMap.get(seg.endTangencyId);

    if (tStart && tEnd) {
      const d1 = regularizationDisks[tStart.diskIndex];
      const d2 = regularizationDisks[tEnd.diskIndex];

      // Compute outer tangent for these two disks (Radius 1.0)
      // Vector d1->d2
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Unit vector
      const ux = dx / d;
      const uy = dy / d;

      // Normal (Left) = (-uy, ux)
      const nx = -uy;
      const ny = ux;

      // Tangent points on surface (Radius 1.0)
      // p1 = c1 + n
      // p2 = c2 + n

      tStart.point = { x: d1.center.x + nx, y: d1.center.y + ny };
      tEnd.point = { x: d2.center.x + nx, y: d2.center.y + ny };
    }
  });

  // 2. Update Arc Tangencies?
  // Arc tangencies are the SAME points as Segment tangencies, just shared.
  // Since we updated tStart/tEnd of segments, and Arcs use those same IDs/Points,
  // we effectively updated the Arc endpoints too.
  // (Tangency objects are shared/unique by ID).

  // Tolerances
  // Strict again!
  const tolerances: Tolerances = {
    met: 1e-5,
    geo: 1e-5,
    lin: 1e-6,
  };

  return {
    tolerances,
    disks: regularizationDisks,
    contacts,
    tangencies: regularizedTangencies,
    segments,
    arcs,
  };
}
