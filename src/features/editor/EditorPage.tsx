import React, { useMemo } from 'react';
import { CSCanvas } from './CSCanvas';
import { useEditorState } from './hooks/useEditorState';
import { useRollingMode } from './hooks/useRollingMode';
import { useKnotState } from './hooks/useKnotState';
import { useDubinsState } from './hooks/useDubinsState';
import { usePersistentDubins } from './hooks/usePersistentDubins';
import { EditorHeader } from './components/EditorHeader';
import type { CSDisk } from '../../core/types/cs';
import { computeDiskHull, computeHullLength, computeHullMetrics } from '../../core/geometry/diskHull';
import { EditorSidebar } from './components/EditorSidebar';
import { useContactGraph } from './hooks/useContactGraph';
import { findEnvelopePath, findEnvelopePathFromPoints, buildBoundedCurvatureGraph } from '../../core/geometry/contactGraph';

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

  // Compute paths for saved knots — elastic: follows disk movements, preserves topology
  const { savedKnotPaths, accumulatedObstacles } = useMemo(() => {
    const accumulated: { p1: { x: number, y: number }, p2: { x: number, y: number } }[] = [];

    // Build a lookup map for current disk positions
    const diskLookup = new Map<string, { center: { x: number, y: number }, radius: number }>();
    diskBlocks.forEach(d => diskLookup.set(d.id, { center: d.center, radius: d.visualRadius }));

    const paths = editorState.savedKnots.map(knot => {
      // Use frozenPath for topology-preserving elastic reconstruction
      const frozen = (knot as any).frozenPath;
      if (frozen && frozen.length > 0) {
        // Build a full graph (no collision filtering) to get ALL tangent lines for current positions
        const fullGraph = buildBoundedCurvatureGraph(contactDisksForGraph, false);

        // Deep copy for reconstruction
        const reconstructed: any[] = frozen.map((s: any) => ({ ...s }));

        // --- Pass 1: Recalculate TANGENT segments ---
        for (let i = 0; i < reconstructed.length; i++) {
          const seg = reconstructed[i];
          if (seg.type === 'ARC') continue;

          // Only do graph lookup for REAL disk-to-disk tangents
          // (original IDs must both exist in the disk lookup, not 'start'/'end'/'point')
          const origStartIsRealDisk = diskLookup.has(seg.startDiskId);
          const origEndIsRealDisk = diskLookup.has(seg.endDiskId);

          if (origStartIsRealDisk && origEndIsRealDisk) {
            // Real disk-to-disk: find matching bitangent edge in current graph
            const match = fullGraph.edges.find((e: any) =>
              e.startDiskId === seg.startDiskId && e.endDiskId === seg.endDiskId && e.type === seg.type
            );
            if (match) {
              reconstructed[i] = { ...seg, start: match.start, end: match.end, length: match.length };
            }
          } else {
            // Point-to-disk or direct line: reconstruct from relative angles
            const sId = seg._startDiskId || seg.startDiskId;
            const eId = seg._endDiskId || seg.endDiskId;
            const sDisk = diskLookup.get(sId);
            const eDisk = diskLookup.get(eId);

            const newStart = sDisk && seg._startAngle !== undefined
              ? {
                x: sDisk.center.x + sDisk.radius * Math.cos(seg._startAngle),
                y: sDisk.center.y + sDisk.radius * Math.sin(seg._startAngle)
              }
              : seg.start;
            const newEnd = eDisk && seg._endAngle !== undefined
              ? {
                x: eDisk.center.x + eDisk.radius * Math.cos(seg._endAngle),
                y: eDisk.center.y + eDisk.radius * Math.sin(seg._endAngle)
              }
              : seg.end;

            const dx = newEnd.x - newStart.x;
            const dy = newEnd.y - newStart.y;
            reconstructed[i] = { ...seg, start: newStart, end: newEnd, length: Math.sqrt(dx * dx + dy * dy) };
          }
        }

        // --- Pass 2: Refit ARC segments between consecutive tangent endpoints ---
        for (let i = 0; i < reconstructed.length; i++) {
          const seg = reconstructed[i];
          if (seg.type !== 'ARC') continue;

          const disk = diskLookup.get(seg.diskId);
          if (!disk) continue;

          let startAngle = seg.startAngle;
          let endAngle = seg.endAngle;

          // Arc start = arrival point of previous tangent (its 'end' point on this disk)
          if (i > 0 && 'end' in reconstructed[i - 1]) {
            const prevEnd = reconstructed[i - 1].end;
            startAngle = Math.atan2(prevEnd.y - disk.center.y, prevEnd.x - disk.center.x);
          }

          // Arc end = departure point of next tangent (its 'start' point on this disk)
          if (i < reconstructed.length - 1 && 'start' in reconstructed[i + 1]) {
            const nextStart = reconstructed[i + 1].start;
            endAngle = Math.atan2(nextStart.y - disk.center.y, nextStart.x - disk.center.x);
          }

          // Use shortest arc (same as pathfinder's calcShortArc)
          const PI2 = 2 * Math.PI;
          let deltaL = endAngle - startAngle;
          while (deltaL <= 0) deltaL += PI2;        // L (CCW) arc: positive delta
          let deltaR = startAngle - endAngle;
          while (deltaR <= 0) deltaR += PI2;        // R (CW) arc: positive delta

          const useL = deltaL <= deltaR;
          const arcLen = useL ? deltaL : deltaR;
          const chirality = useL ? 'L' : 'R';

          reconstructed[i] = {
            ...seg,
            center: disk.center,
            radius: disk.radius,
            startAngle,
            endAngle,
            chirality,
            length: arcLen * disk.radius
          };
        }

        reconstructed.forEach((seg: any) => {
          if ('start' in seg) accumulated.push({ p1: seg.start, p2: seg.end });
        });
        return { id: knot.id, color: knot.color, path: reconstructed };
      }

      // Fallback: use anchorSequence + pathfinder (for knots saved without frozenPath)
      if (knot.anchorSequence && knot.anchorSequence.length >= 2) {
        const absolutePoints = knot.anchorSequence.map((anchor: any) => {
          const disk = diskBlocks.find(b => b.id === anchor.diskId);
          if (!disk) return null;
          return {
            x: disk.center.x + disk.visualRadius * Math.cos(anchor.angle),
            y: disk.center.y + disk.visualRadius * Math.sin(anchor.angle)
          };
        }).filter(Boolean) as { x: number, y: number }[];

        if (absolutePoints.length >= 2) {
          const result = findEnvelopePathFromPoints(absolutePoints, contactDisksForGraph);
          result.path.forEach((seg: any) => {
            if ('start' in seg) accumulated.push({ p1: seg.start, p2: seg.end });
          });
          return { id: knot.id, color: knot.color, path: result.path };
        }
      }

      // Legacy fallback
      const existingDiskIds = new Set(diskBlocks.map(d => d.id));
      const validSequence = knot.diskSequence.filter((id: string) => existingDiskIds.has(id));
      if (validSequence.length < 2) return { id: knot.id, color: knot.color, path: [] };
      const tempGraph = buildBoundedCurvatureGraph(contactDisksForGraph, true, accumulated, true);
      const result = findEnvelopePath(tempGraph, validSequence, knot.chiralities);
      result.path.forEach((seg: any) => {
        if ('start' in seg) accumulated.push({ p1: seg.start, p2: seg.end });
      });
      return { id: knot.id, color: knot.color, path: result.path };
    });

    return { savedKnotPaths: paths, accumulatedObstacles: accumulated };
  }, [editorState.savedKnots, contactDisksForGraph, diskBlocks]);


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
            // Rolling Mode / Interaction Logic
            {...(rollingState.isActive ? {
              rollingMode: true,
              pivotDiskId: rollingState.pivotDiskId,
              rollingDiskId: rollingState.rollingDiskId,
              theta: rollingState.theta,
              showTrail: rollingState.showTrail,
              onDiskClick: rollingState.selectDisk,
            } : {
              // Click Priority: Dubins > Knot > Select
              onDiskClick: dubinsState.state.isActive
                ? (diskId) => persistentDubins.actions.handleDiskClick(diskId)
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
