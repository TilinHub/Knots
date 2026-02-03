import React from 'react';
import { CSCanvas } from './CSCanvas';
import { useEditorState } from './hooks/useEditorState';
import { useRollingMode } from './hooks/useRollingMode';
import { useKnotState } from './hooks/useKnotState';
import { useDubinsState } from './hooks/useDubinsState'; // NEW
import { usePersistentDubins } from './hooks/usePersistentDubins'; // NEW [PERSISTENT]
import { EditorHeader } from './components/EditorHeader';
import { useMemo } from 'react';
import type { CSDisk } from '../../core/types/cs';
import { computeDiskHull, computeHullLength, computeHullMetrics } from '../../core/geometry/diskHull';
import { EditorSidebar } from './components/EditorSidebar';

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

  // Only pass disks to knot state for graph building
  const diskBlocks = React.useMemo(() => editorState.blocks.filter((b): b is CSDisk => b.kind === 'disk'), [editorState.blocks]);
  const knotState = useKnotState({ blocks: diskBlocks });

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
  const persistentDubins = usePersistentDubins(contactDisks); // [NEW]


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

  // Use simple toggle
  const handleToggleKnotMode = knotState.actions.toggleMode;

  // 2. Event Handlers (can be simple wrappers or passed directly)
  // handleDiskClick logic was conceptually here but passed directly below for cleaner code

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
        showEnvelope={editorState.showEnvelope} // [NEW]
        onToggleEnvelope={() => editorActions.setShowEnvelope(!editorState.showEnvelope)} // [NEW]
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
            // Rolling Mode Props - Optional in CSCanvas props
            // Note: rollingMode prop might not exist on CSCanvas yet if it wasn't updated.
            // Assuming CSCanvas accepts 'rollingMode' based on context or ignoring if handled internally via props spread
            // For now passing them as originally intended in the refactor plan.
            {...(rollingState.isActive ? {
              rollingMode: true,
              pivotDiskId: rollingState.pivotDiskId,
              rollingDiskId: rollingState.rollingDiskId,
              theta: rollingState.theta,
              showTrail: rollingState.showTrail,
              onDiskClick: rollingState.selectDisk, // Rolling always takes precedence if active? Or handle priority.
              // If both Dubins and Rolling are active (unlikely), we should decide priority.
              // Assuming mutually exclusive or Rolling > Dubins.
            } : {
              // If Dubins is active, we want to capture clicks.
              // If Knot Mode is active, we ALSO want to capture clicks.
              onDiskClick: dubinsState.state.isActive
                ? (diskId) => persistentDubins.actions.handleDiskClick(diskId)
                : knotState.mode === 'knot'
                  ? knotState.actions.toggleDisk
                  : undefined
            })}

            knotMode={knotState.mode === 'knot'}
            // OLD: knot={knotState.knot}
            // NEW: pass sequences/paths for rendering
            knotPath={knotState.knotPath}
            knotSequence={knotState.diskSequence}
            onKnotSegmentClick={() => { }}


            showContactDisks={editorState.showContactDisks}
            showEnvelope={editorState.showEnvelope} // [NEW]

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
