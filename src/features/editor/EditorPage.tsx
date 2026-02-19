import React, { useMemo } from 'react';

import { Logger } from '../../core/utils/Logger';

import { buildBoundedCurvatureGraph, calculateBitangents, findEnvelopePath, findEnvelopePathFromPoints } from '../../core/geometry/contactGraph';
import { computeDiskHull, computeHullLength, computeHullMetrics } from '../../core/geometry/diskHull';
import type { CSDisk } from '../../core/types/cs';
import { useDubinsState } from '../dubins/logic/useDubinsState';
import { useKnotState } from '../knot/logic/useKnotState';
import { useRollingMode } from '../rolling/logic/useRollingMode';
import { EditorHeader } from './components/EditorHeader';
import { EditorSidebar } from './components/EditorSidebar';
import { CSCanvas } from './CSCanvas';
import { useContactGraph } from './hooks/useContactGraph';
import { useEditorState } from './hooks/useEditorState';
import { usePersistentDubins } from './hooks/usePersistentDubins';

interface EditorPageProps {
  onBackToGallery?: () => void;
  initialKnot?: {
    id: number;
    name: string;
    nodes: number[];
    edges: [number, number][];
  };
}

/**
 * Página principal del editor de diagramas CS (Refactorizada)
 * Actúa como orquestador conectando lógica (hooks) con UI (components).
 */
export function EditorPage({ onBackToGallery, initialKnot }: EditorPageProps) {
  // 1. Logic & State (Custom Hooks)
  const { state: editorState, actions: editorActions } = useEditorState(initialKnot);
  const rollingState = useRollingMode({ blocks: editorState.blocks });
  // New Catalog Mode
  const [catalogMode, setCatalogMode] = React.useState(false);

  // Only pass disks to knot state for graph building
  const diskBlocks = React.useMemo(() => editorState.blocks.filter((b): b is CSDisk => b.kind === 'disk'), [editorState.blocks]);
  // Compute graph for persistent knots (shared with KnotState internally, but we need it here for saved knots)
  const contactDisksForGraph = useMemo(() => {
    // If rolling, get the dynamic position
    const rollingPos = rollingState.isActive ? rollingState.getCurrentPosition() : null;

    return diskBlocks.map(d => ({
      id: d.id,
      center: (rollingState.isActive && d.id === rollingState.rollingDiskId && rollingPos)
        ? rollingPos
        : d.center,
      radius: d.visualRadius, // CRITICAL FIX: Use visual radius for envelope calculation!
      regionId: 'temp',
      color: d.color || 'blue'
    }));
  }, [diskBlocks, rollingState.isActive, rollingState.rollingDiskId, rollingState.theta, rollingState.getCurrentPosition]);

  const graph = useContactGraph(contactDisksForGraph);

  // ── Geometric Reconstruction from frozenPath (tex.pdf algorithm) ──
  // For N disks: walk the saved topology, recompute each tangent/arc
  // from current disk positions using bitangent formulas.
  // NEW: validates tangent segments against ALL disks and reroutes around obstacles.

  // Helper: does line segment (ax,ay)→(bx,by) penetrate circle (cx,cy,r)?
  function segmentHitsCircle(
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, r: number
  ): boolean {
    const dx = bx - ax, dy = by - ay;
    const fx = ax - cx, fy = ay - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-12) return false; // Degenerate segment
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false; // No intersection
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    // Chord must be inside the segment (not just touching endpoints)
    const EPS = 0.05;
    if (t1 > EPS && t1 < 1 - EPS) return true;
    if (t2 > EPS && t2 < 1 - EPS) return true;
    // Also check if a significant chord exists inside the segment
    const tEnter = Math.max(t1, EPS);
    const tExit = Math.min(t2, 1 - EPS);
    return tEnter < tExit;
  }

  // Find the CLOSEST blocking disk for a tangent segment
  function findBlockingDisk(
    tangent: any,
    diskLookup: Map<string, { center: { x: number, y: number }, radius: number }>
  ): string | null {
    const startId = tangent.startDiskId || tangent._startDiskId;
    const endId = tangent.endDiskId || tangent._endDiskId;
    if (!tangent.start || !tangent.end) return null;

    let closestId: string | null = null;
    let closestT = Infinity;

    for (const [id, disk] of diskLookup) {
      if (id === startId || id === endId) continue;
      if (segmentHitsCircle(
        tangent.start.x, tangent.start.y,
        tangent.end.x, tangent.end.y,
        disk.center.x, disk.center.y, disk.radius
      )) {
        // Compute t-parameter of closest approach
        const dx = tangent.end.x - tangent.start.x;
        const dy = tangent.end.y - tangent.start.y;
        const fx = tangent.start.x - disk.center.x;
        const fy = tangent.start.y - disk.center.y;
        const t = -(fx * dx + fy * dy) / (dx * dx + dy * dy);
        if (t < closestT) {
          closestT = t;
          closestId = id;
        }
      }
    }
    return closestId;
  }

  // Reroute a tangent around a blocking disk → [tangent1, arc, tangent2]
  function rerouteAroundDisk(
    tangent: any,
    blockingId: string,
    diskLookup: Map<string, { center: { x: number, y: number }, radius: number }>,
    depth: number = 0
  ): any[] {
    if (depth > 3) return [tangent]; // Prevent infinite recursion

    const startId = tangent.startDiskId || tangent._startDiskId;
    const endId = tangent.endDiskId || tangent._endDiskId;
    const d1 = diskLookup.get(startId);
    const dObs = diskLookup.get(blockingId);
    const d2 = diskLookup.get(endId);
    if (!d1 || !dObs || !d2) return [tangent];

    // Compute bitangents from startDisk→obstacle and obstacle→endDisk
    const d1c = { id: startId, center: d1.center, radius: d1.radius, regionId: '', color: '' };
    const dObsc = { id: blockingId, center: dObs.center, radius: dObs.radius, regionId: '', color: '' };
    const d2c = { id: endId, center: d2.center, radius: d2.radius, regionId: '', color: '' };

    const tangents1 = calculateBitangents(d1c, dObsc);
    const tangents2 = calculateBitangents(dObsc, d2c);

    // Find the best valid pair (shortest total path that doesn't itself cross any disk)
    let bestResult: any[] | null = null;
    let bestLength = Infinity;

    for (const t1 of tangents1) {
      for (const t2 of tangents2) {
        // Compute arc angles on obstacle disk
        const a1 = Math.atan2(t1.end.y - dObs.center.y, t1.end.x - dObs.center.x);
        const a2 = Math.atan2(t2.start.y - dObs.center.y, t2.start.x - dObs.center.x);

        // Compute both arc directions
        let deltaL = a2 - a1;
        while (deltaL <= 0) deltaL += 2 * Math.PI;
        let deltaR = a1 - a2;
        while (deltaR <= 0) deltaR += 2 * Math.PI;

        // Use the SHORTER arc (elastic band takes the shortest path around)
        const chirality = deltaL < deltaR ? 'L' : 'R';
        const arcLen = Math.min(deltaL, deltaR) * dObs.radius;
        const totalLen = (t1.length || 0) + arcLen + (t2.length || 0);

        if (totalLen < bestLength) {
          // Check that the new tangent segments don't cross the obstacle disk
          const t1blocks = findBlockingDisk(t1, diskLookup);
          const t2blocks = findBlockingDisk(t2, diskLookup);

          let segments: any[] = [];

          // Recursively reroute if these sub-tangents also cross disks
          if (t1blocks) {
            segments.push(...rerouteAroundDisk(t1, t1blocks, diskLookup, depth + 1));
          } else {
            segments.push(t1);
          }

          segments.push({
            type: 'ARC',
            center: dObs.center,
            radius: dObs.radius,
            startAngle: a1,
            endAngle: a2,
            chirality,
            length: arcLen,
            diskId: blockingId
          });

          if (t2blocks) {
            segments.push(...rerouteAroundDisk(t2, t2blocks, diskLookup, depth + 1));
          } else {
            segments.push(t2);
          }

          bestLength = totalLen;
          bestResult = segments;
        }
      }
    }

    return bestResult || [tangent];
  }

  function reconstructFromFrozenPath(
    frozenPath: any[],
    diskLookup: Map<string, { center: { x: number, y: number }, radius: number }>
  ): any[] {
    // Step 1: Recompute each TANGENT segment from current disk positions
    const recomputed: (any | null)[] = frozenPath.map((seg) => {
      if (seg.type === 'ARC') return null; // Will fill later

      const startDiskId = seg._startDiskId || seg.startDiskId;
      const endDiskId = seg._endDiskId || seg.endDiskId;
      const d1Data = diskLookup.get(startDiskId);
      const d2Data = diskLookup.get(endDiskId);

      if (!d1Data || !d2Data) return { ...seg };

      const d1 = { id: startDiskId, center: d1Data.center, radius: d1Data.radius, regionId: '', color: '' };
      const d2 = { id: endDiskId, center: d2Data.center, radius: d2Data.radius, regionId: '', color: '' };

      const tangents = calculateBitangents(d1, d2);
      const tangentType = seg.type;
      const match = tangents.find((t: { type: string }) => t.type === tangentType);

      if (match) return { ...match };

      // Fallback: project using stored angles
      if (seg._startAngle !== undefined && seg._endAngle !== undefined) {
        return {
          ...seg,
          start: {
            x: d1Data.center.x + d1Data.radius * Math.cos(seg._startAngle),
            y: d1Data.center.y + d1Data.radius * Math.sin(seg._startAngle)
          },
          end: {
            x: d2Data.center.x + d2Data.radius * Math.cos(seg._endAngle),
            y: d2Data.center.y + d2Data.radius * Math.sin(seg._endAngle)
          },
          length: 0
        };
      }

      return { ...seg };
    });

    // Step 1.5: Validate tangents → reroute any that cross a disk
    // This produces an EXPANDED path (tangents that cross disks become [t1, arc, t2])
    const expandedPath: any[] = [];
    for (let i = 0; i < frozenPath.length; i++) {
      const seg = frozenPath[i];
      if (seg.type === 'ARC') {
        expandedPath.push({ ...seg, _originalIndex: i }); // Keep original ARC info
      } else {
        const recomp = recomputed[i];
        if (!recomp) continue;

        const blockingId = findBlockingDisk(recomp, diskLookup);
        if (blockingId) {
          // Reroute around the blocking disk
          const rerouted = rerouteAroundDisk(recomp, blockingId, diskLookup);
          expandedPath.push(...rerouted);
        } else {
          expandedPath.push(recomp);
        }
      }
    }

    // Step 2: Build final path — recalculate arcs between tangents
    const result: any[] = [];
    const nn = expandedPath.length;

    // Helper: find nearest tangent BEFORE index (with wraparound)
    function findPrevTangent(idx: number): any | null {
      for (let j = 1; j <= nn; j++) {
        const k = (idx - j + nn) % nn;
        if (expandedPath[k].type !== 'ARC') return expandedPath[k];
      }
      return null;
    }

    // Helper: find nearest tangent AFTER index (with wraparound)
    function findNextTangent(idx: number): any | null {
      for (let j = 1; j <= nn; j++) {
        const k = (idx + j) % nn;
        if (expandedPath[k].type !== 'ARC') return expandedPath[k];
      }
      return null;
    }

    for (let i = 0; i < nn; i++) {
      const seg = expandedPath[i];

      if (seg.type !== 'ARC') {
        result.push(seg);
      } else {
        const diskId = seg.diskId;
        const diskData = diskLookup.get(diskId);
        if (!diskData) { result.push({ ...seg }); continue; }

        let startAngle = seg.startAngle;
        let endAngle = seg.endAngle;

        // Previous tangent → arc start
        const prev = findPrevTangent(i);
        if (prev) {
          if (prev.endDiskId === diskId && prev.end) {
            startAngle = Math.atan2(prev.end.y - diskData.center.y, prev.end.x - diskData.center.x);
          } else if (prev.startDiskId === diskId && prev.start) {
            startAngle = Math.atan2(prev.start.y - diskData.center.y, prev.start.x - diskData.center.x);
          }
        }

        // Next tangent → arc end
        const next = findNextTangent(i);
        if (next) {
          if (next.startDiskId === diskId && next.start) {
            endAngle = Math.atan2(next.start.y - diskData.center.y, next.start.x - diskData.center.x);
          } else if (next.endDiskId === diskId && next.end) {
            endAngle = Math.atan2(next.end.y - diskData.center.y, next.end.x - diskData.center.x);
          }
        }

        const PI2 = 2 * Math.PI;
        let delta = endAngle - startAngle;
        if (seg.chirality === 'L') {
          while (delta <= 0) delta += PI2;
        } else {
          while (delta >= 0) delta -= PI2;
          delta = Math.abs(delta);
        }

        result.push({
          type: 'ARC',
          center: diskData.center,
          radius: diskData.radius,
          startAngle,
          endAngle,
          chirality: seg.chirality,
          length: delta * diskData.radius,
          diskId
        });
      }
    }

    return result;
  }

  // Compute paths for saved knots — GEOMETRIC RECONSTRUCTION from frozenPath
  // Based on tex.pdf: tangent points pα are NOT fixed —
  // they are recomputed from disk centers + tangent type (LSL/RSR/LSR/RSL).
  const { savedKnotPaths, accumulatedObstacles } = useMemo(() => {
    // Build a lookup map for current disk positions
    const diskLookup = new Map<string, { center: { x: number, y: number }, radius: number }>();
    diskBlocks.forEach(d => diskLookup.set(d.id, { center: d.center, radius: d.visualRadius }));

    // Also include rolling positions
    if (rollingState.isActive && rollingState.rollingDiskId) {
      const pos = rollingState.getCurrentPosition();
      if (pos) {
        const rolling = diskBlocks.find(d => d.id === rollingState.rollingDiskId);
        if (rolling) {
          diskLookup.set(rolling.id, { center: pos, radius: rolling.visualRadius });
        }
      }
    }

    const paths = editorState.savedKnots.map(knot => {
      // ── PRIMARY: Geometric Reconstruction from frozenPath ──
      // This walks the saved topology and recomputes each segment
      // from current disk positions. Works for N disks.
      if (knot.frozenPath && knot.frozenPath.length > 0) {
        try {
          const reconstructed = reconstructFromFrozenPath(knot.frozenPath, diskLookup);
          if (reconstructed && reconstructed.length > 0) {
            return { id: knot.id, color: knot.color, path: reconstructed };
          }
        } catch (e) {
          Logger.warn('EditorPage', `[Reconstruct] Geometric failed for Knot ${knot.id}: ${e}`);
        }
      }

      // ── FALLBACK: Topological Solver (for knots saved without frozenPath) ──
      if (knot.chiralities && knot.chiralities.length > 0) {
        try {
          const graph = buildBoundedCurvatureGraph(contactDisksForGraph, true, [], false);
          const result = findEnvelopePath(graph, knot.diskSequence, knot.chiralities, true);
          if (result.path && result.path.length > 0) {
            return { id: knot.id, color: knot.color, path: result.path };
          }
        } catch (e) {
          Logger.warn('EditorPage', `[Reconstruct] Solver fallback failed for Knot ${knot.id}`);
        }
      }

      // ── LAST RESORT: Static frozenPath (detached but visible) ──
      if (knot.frozenPath) {
        return { id: knot.id, color: knot.color, path: knot.frozenPath };
      }

      return { id: knot.id, color: knot.color, path: [] };
    });

    return { savedKnotPaths: paths, accumulatedObstacles: [] };
  }, [editorState.savedKnots, contactDisksForGraph, diskBlocks, rollingState.isActive, rollingState.rollingDiskId, rollingState.getCurrentPosition]);



  // Map CSDisk to ContactDisk for Dubins logic
  const contactDisks = useMemo(() => {
    // If rolling, get the dynamic position
    const rollingPos = rollingState.isActive ? rollingState.getCurrentPosition() : null;

    return editorState.diskBlocks.map(d => ({
      id: d.id,
      center: (rollingState.isActive && d.id === rollingState.rollingDiskId && rollingPos)
        ? rollingPos
        : d.center,
      radius: d.visualRadius,
      color: 'blue',
      regionId: 'temp'
    }));
  }, [editorState.diskBlocks, rollingState.isActive, rollingState.rollingDiskId, rollingState.theta, rollingState.getCurrentPosition]);

  const dubinsState = useDubinsState(contactDisks); // Pass disks
  const persistentDubins = usePersistentDubins(contactDisks);

  // Active Knot State - Now receives ALL obstacles from saved knots
  const knotState = useKnotState({
    blocks: diskBlocks,
    obstacleSegments: accumulatedObstacles
  });


  const hullMetrics = useMemo(() => {
    // Only calculate if we are in Penny Graph mode (disks only, no segments)
    // or if the user wants to see the hull length specifically.
    const disks = editorState.diskBlocks;
    if (disks.length < 2) return { totalLength: 0, tangentLength: 0, arcLength: 0 };

    // We need to map to simple disks
    const simpleDisks = disks.map(d => ({
      id: d.id,
      x: d.center.x,
      y: d.center.y,
      r: d.visualRadius
    }));

    const hull = computeDiskHull(simpleDisks);
    return computeHullMetrics(hull);
  }, [editorState.diskBlocks]);

  const lengthHelpers = useMemo(() => {
    // [NEW] Create lookup for disk centers to calculate "Graph Length" (center-to-center)
    const diskMap = new Map<string, { x: number, y: number }>();
    diskBlocks.forEach(d => diskMap.set(d.id, d.center));

    // Helper to calc tangent length (Graph Length)
    const getTangentLen = (seg: any) => {
      if (seg.type === 'ARC') return 0;
      const c1 = diskMap.get(seg.startDiskId);
      const c2 = diskMap.get(seg.endDiskId);
      if (c1 && c2) {
        return Math.sqrt(Math.pow(c2.x - c1.x, 2) + Math.pow(c2.y - c1.y, 2));
      }
      return seg.length; // Fallback
    };
    return { diskMap, getTangentLen };
  }, [diskBlocks]);

  const savedKnotsMetrics = useMemo(() => {
    // [NEW] Calculate metrics for SAVED knots
    return savedKnotPaths.reduce((acc, knot) => {
      knot.path.forEach((seg: any) => {
        if (seg.type === 'ARC') {
          acc.arcLength += seg.length;
        } else {
          acc.tangentLength += lengthHelpers.getTangentLen(seg);
        }
      });
      return acc;
    }, { tangentLength: 0, arcLength: 0 });
  }, [savedKnotPaths, lengthHelpers]);

  const knotMetrics = useMemo(() => {
    if (knotState.mode !== 'knot') return null;

    // Active knot metrics
    let tangentLength = 0;
    let arcLength = 0;

    if (knotState.knotPath) {
      knotState.knotPath.forEach(seg => {
        if (seg.type === 'ARC') {
          arcLength += seg.length;
        } else {
          tangentLength += lengthHelpers.getTangentLen(seg);
        }
      });
    }

    // Combine ACTIVE + SAVED
    const totalTangent = tangentLength + savedKnotsMetrics.tangentLength;
    const totalArc = arcLength + savedKnotsMetrics.arcLength;

    return {
      totalLength: totalTangent + totalArc,
      tangentLength: totalTangent,
      arcLength: totalArc
    };
  }, [knotState.mode, knotState.knotPath, savedKnotsMetrics, lengthHelpers]);

  // Use simple toggle
  const handleToggleKnotMode = knotState.actions.toggleMode;

  // 2. Event Handlers (can be simple wrappers or passed directly)

  // 3. Render
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      <EditorHeader
        initialKnotName={initialKnot?.name}
        onBackToGallery={onBackToGallery}
        rollingMode={rollingState.isActive}
        onToggleRollingMode={rollingState.toggleMode}
        knotMode={knotState.mode === 'knot'}
        onToggleKnotMode={handleToggleKnotMode}
        dubinsMode={dubinsState.state.isActive}
        onToggleDubinsMode={dubinsState.actions.toggleMode}
        showContactDisks={editorState.showContactDisks}
        onToggleContactDisks={() => editorActions.setShowContactDisks(!editorState.showContactDisks)}
        showEnvelope={editorState.showEnvelope}
        onToggleEnvelope={() => editorActions.setShowEnvelope(!editorState.showEnvelope)}
        // Catalog Mode
        catalogMode={catalogMode}
        onToggleCatalogMode={() => {
          const newState = !catalogMode;
          setCatalogMode(newState);
          if (newState) {
            editorActions.setSidebarOpen(true);
          }
        }}
        // View Controls Props
        showGrid={editorState.showGrid}
        onToggleGrid={editorActions.setShowGrid}
        gridSpacing={editorState.gridSpacing}
        onGridSpacingChange={editorActions.setGridSpacing}
        angleUnit={editorState.angleUnit}
        onAngleUnitChange={editorActions.setAngleUnit}
        // Appearance Controls
        diskColor={editorState.diskColor}
        onDiskColorChange={editorActions.setDiskColor}
        envelopeColor={editorState.envelopeColor}
        onEnvelopeColorChange={editorActions.setEnvelopeColor}
        savedEnvelopeColor={editorState.savedEnvelopeColor} // [NEW]
        onSavedEnvelopeColorChange={editorActions.setSavedEnvelopeColor} // [NEW]
        // Transparency
        transparentDisks={editorState.transparentDisks}
        onToggleTransparentDisks={() => editorActions.setTransparentDisks(!editorState.transparentDisks)}

        nonDiskBlocksCount={editorState.nonDiskBlocks.length}
        diskBlocksCount={editorState.diskBlocks.length}
        validation={editorState.validation}
        // Hack: Override lengthInfo if we have hullMetrics or Dubins Metrics
        lengthInfo={
          dubinsState.state.isActive
            ? {
              totalLength: persistentDubins.state.totalLength,
              tangentLength: persistentDubins.state.totalLength,
              arcLength: 0
            }
            : knotState.mode === 'knot' && knotMetrics
              ? knotMetrics
              : (savedKnotPaths.length > 0) // [NEW] Prioritize Saved Knots if they exist
                ? {
                  totalLength: knotMetrics?.totalLength || (savedKnotsMetrics.tangentLength + savedKnotsMetrics.arcLength),
                  tangentLength: knotMetrics?.tangentLength || savedKnotsMetrics.tangentLength,
                  arcLength: knotMetrics?.arcLength || savedKnotsMetrics.arcLength
                }
                : (editorState.nonDiskBlocks.length === 0 && editorState.diskBlocks.length > 1
                  ? { totalLength: hullMetrics.totalLength, tangentLength: hullMetrics.tangentLength, arcLength: hullMetrics.arcLength }
                  : editorState.lengthInfo)
        }
        sidebarOpen={editorState.sidebarOpen}
        onToggleSidebar={() => editorActions.setSidebarOpen(!editorState.sidebarOpen)}
        onShowValidationDetails={() => editorActions.setShowValidation(true)}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <CSCanvas
            blocks={editorState.blocks}
            selectedBlockId={editorState.selectedBlockId}
            onSelectBlock={editorActions.setSelectedBlockId}
            onUpdateBlock={editorActions.updateBlock}
            showGrid={editorState.showGrid}
            gridSpacing={editorState.gridSpacing}
            // Appearance
            diskColor={editorState.diskColor}
            envelopeColor={editorState.envelopeColor}
            savedEnvelopeColor={editorState.savedEnvelopeColor} // [NEW]
            transparentDisks={editorState.transparentDisks}
            // Rolling Mode / Interaction Logic
            {...(rollingState.isActive ? {
              rollingMode: true,
              pivotDiskId: rollingState.pivotDiskId,
              rollingDiskId: rollingState.rollingDiskId,
              theta: rollingState.theta,
              showTrail: rollingState.showTrail,
              onDiskClick: rollingState.selectDisk,
              currentPath: rollingState.currentPath, // [NEW] Pass computed path
            } : {
              // Click Priority: Dubins > Knot > Select
              onDiskClick: dubinsState.state.isActive
                ? (diskId, point) => persistentDubins.actions.handleDiskClick(diskId, point)
                : knotState.mode === 'knot'
                  ? knotState.actions.toggleDisk
                  : undefined
            })}

            knotState={knotState} // [NEW] Pass the full state object!
            knotMode={knotState.mode === 'knot'}
            knotPath={knotState.knotPath}
            knotSequence={knotState.diskSequence}
            anchorSequence={knotState.anchorPoints} // [FIX] Use calculated points, NOT dynamic anchors!
            savedKnotPaths={savedKnotPaths} // Pass computed persistent knots
            onKnotSegmentClick={() => { }}
            onKnotPointClick={knotState.actions.extendSequenceWithPoint} // [NEW] Link interaction

            showContactDisks={editorState.showContactDisks}
            showEnvelope={editorState.showEnvelope}

            // Dubins
            dubinsMode={dubinsState.state.isActive}
            dubinsPaths={(dubinsState.state.computedPaths || []).slice(0, dubinsState.state.maxPathsToShow)}
            dubinsStart={dubinsState.state.startConfig}
            dubinsEnd={dubinsState.state.endConfig}
            dubinsVisibleTypes={dubinsState.state.visiblePaths}
            startDiskId={dubinsState.state.startDiskId}
            endDiskId={dubinsState.state.endDiskId}
            onSetDubinsStart={dubinsState.actions.setStartConfig}
            onSetDubinsEnd={dubinsState.actions.setEndConfig}

            // Persistent Dubins Props
            persistentDubinsState={persistentDubins.state}
            persistentDubinsActions={persistentDubins.actions}
          />
        </div>

        <EditorSidebar
          isOpen={editorState.sidebarOpen}
          rollingMode={rollingState.isActive}
          rollingState={rollingState}
          dubinsState={dubinsState}
          knotMode={knotState.mode === 'knot'}
          knotState={knotState}
          editorState={editorState}
          actions={editorActions}
          catalogMode={catalogMode}
        />
      </div>

      {/* VALIDATION DIALOG */}
      {editorState.showValidation && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '100%' }}>
            <h3>Validación</h3>
            {editorState.validation.valid ? (
              <p style={{ color: 'var(--accent-valid)' }}>El diagrama es válido.</p>
            ) : (
              <ul style={{ color: 'var(--accent-error)' }}>
                {editorState.validation.errors.map((e: any, i: number) => <li key={i}>{e.message || JSON.stringify(e)}</li>)}
              </ul>
            )}
            <button onClick={() => editorActions.setShowValidation(false)} style={{ marginTop: '10px' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
