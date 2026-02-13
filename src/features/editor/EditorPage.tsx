import React, { useMemo } from 'react';
import { CSCanvas } from './CSCanvas';
import { useEditorState } from './hooks/useEditorState';
import { useRollingMode } from '../rolling/logic/useRollingMode';
import { useKnotState } from '../knot/logic/useKnotState';
import { useDubinsState } from '../dubins/logic/useDubinsState';
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
    // Build a lookup map for current disk positions
    const diskLookup = new Map<string, { center: { x: number, y: number }, radius: number }>();
    diskBlocks.forEach(d => diskLookup.set(d.id, { center: d.center, radius: d.visualRadius }));

    const paths = editorState.savedKnots.map(knot => {
      // 1. Priority: Topological Reconstruction (True Elastic "Academic" Fix)
      // If we have chiralities, we can rebuild the path from the SEQUENCE on the current graph.
      if (knot.chiralities && knot.chiralities.length > 0) {
        try {
          // Build graph from CURRENT positions (including rolling)
          // [REVERT] Back to true to strict check. Use logging to find WHY it fails.
          const graph = buildBoundedCurvatureGraph(contactDisksForGraph, true);

          // Solve for the path using the saved sequence and chiralities
          const result = findEnvelopePath(graph, knot.diskSequence, knot.chiralities);

          if (result.path && result.path.length > 0) {
            console.log(`[Reconstruct] SUCCESS Knot ${knot.id}: len=${result.path.length}`);
            return { id: knot.id, color: knot.color, path: result.path };
          } else {
            // If implicit failure (empty path), warn
            console.warn(`[Reconstruct] FAILURE Knot ${knot.id}: Empty path. Seq=${knot.diskSequence} Chiral=${knot.chiralities}`);
            // [TODO] Fallback to lastGoodEnvelope?
          }
        } catch (e) {
          console.error(`[Reconstruct] EXCEPTION Knot ${knot.id}:`, e);
        }
      }

      // 2. Fallback: use anchorSequence (Material Points)
      if (knot.anchorSequence && knot.anchorSequence.length >= 2) {
        const absolutePoints = knot.anchorSequence.map((anchor: any) => {
          const disk = diskBlocks.find(b => b.id === anchor.diskId);
          if (!disk) return null;

          // [FIX] Apply Rolling Rotation to Anchors if needed
          // The contactDisksForGraph ALREADY has the updated center for rolling disk.
          // But visualRadius is static.
          // We need to match the "spinAngle" logic from CSCanvas if we want material points to rotate.
          // However, `useEditorState` / `EditorPage` doesn't easily have `theta` or `spinAngle` access simply.
          // Actually `rollingState` has `theta`.
          // But simpler is to rely on Topological Reconstruction (Step 1) which avoids this.
          // If we are here, Step 1 failed (maybe no chiralities).

          // Just use simple position mapping for now as fallback.
          return {
            x: disk.center.x + disk.visualRadius * Math.cos(anchor.angle),
            y: disk.center.y + disk.visualRadius * Math.sin(anchor.angle)
          };
        }).filter(Boolean) as { x: number, y: number }[];

        if (absolutePoints.length >= 2) {
          const result = findEnvelopePathFromPoints(absolutePoints, contactDisksForGraph);
          return { id: knot.id, color: knot.color, path: result.path };
        }
      }

      // 3. Last Result: Use frozen path (static)
      // If frozenPath exists and we failed to reconstruct, just show it (it might be detached)
      if ((knot as any).frozenPath) {
        return { id: knot.id, color: knot.color, path: (knot as any).frozenPath };
      }

      return { id: knot.id, color: knot.color, path: [] };
    });

    return { savedKnotPaths: paths, accumulatedObstacles: [] }; // Reset obstacles for now
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
