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
import { findEnvelopePath, buildBoundedCurvatureGraph } from '../../core/geometry/contactGraph';

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

  // Compute paths for saved knots with Sequential Priority (Elastic Conflict Resolution)
  const { savedKnotPaths, accumulatedObstacles } = useMemo(() => {
    const existingDiskIds = new Set(diskBlocks.map(d => d.id));
    const accumulated: { p1: { x: number, y: number }, p2: { x: number, y: number } }[] = [];

    // We need to rebuild the graph for each knot to respect previous obstacles
    // Ideally we would optimize this, but for < 10 knots it's fast enough.

    const paths = editorState.savedKnots.map(knot => {
      // Filter sequence
      const validSequence = knot.diskSequence.filter(id => existingDiskIds.has(id));

      if (validSequence.length < 2) {
        return { id: knot.id, color: knot.color, path: [] };
      }

      // Build graph respecting CURRENT obstacles
      // We assume contactDisksForGraph is stable-ish
      const tempGraph = buildBoundedCurvatureGraph(contactDisksForGraph, true, accumulated); // Import this function!

      const result = findEnvelopePath(tempGraph, validSequence, knot.chiralities);

      // Add TANGENT segments of this result to obstacles for next knots
      result.path.forEach(seg => {
        if ('start' in seg) { // It's a TangentSegment
          accumulated.push({ p1: seg.start, p2: seg.end });
        }
      });

      return {
        id: knot.id,
        color: knot.color,
        path: result.path
      };
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

  const knotMetrics = useMemo(() => {
    if (knotState.mode !== 'knot' || !knotState.knotPath) return null;
    let tangentLength = 0;
    let arcLength = 0;
    knotState.knotPath.forEach(seg => {
      // TangentSegment types: 'LSL', 'RSR', 'LSR', 'RSL'
      // EnvelopeSegment type: 'ARC' or TangentType
      if (seg.type === 'ARC') {
        arcLength += seg.length;
      } else {
        tangentLength += seg.length;
      }
    });
    return { totalLength: tangentLength + arcLength, tangentLength, arcLength };
  }, [knotState.mode, knotState.knotPath]);

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

            knotMode={knotState.mode === 'knot'}
            knotPath={knotState.knotPath}
            knotSequence={knotState.diskSequence}
            savedKnotPaths={savedKnotPaths} // Pass computed persistent knots
            onKnotSegmentClick={() => { }}

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
