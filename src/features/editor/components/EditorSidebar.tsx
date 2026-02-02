import { RollingModePanel } from './RollingModePanel';
import { GraphsPanel } from './GraphsPanel';
import { ViewControls } from './ViewControls';
import { BlockList } from './BlockList';
import { Button } from '../../../ui/Button';
import { ContactMatrixViewer } from './ContactMatrixViewer';
import type { CSBlock, CSDisk } from '../../../core/types/cs';
import type React from 'react'; // For React.Dispatch types if used in interfaces

interface EditorState {
    blocks: CSBlock[];
    selectedBlockId: string | null;
    selectedBlock: CSBlock | undefined;
    sidebarOpen: boolean;
    showGrid: boolean;
    gridSpacing: number;
    angleUnit: 'deg' | 'rad';
    showContactDisks: boolean;
    showValidation: boolean;
    nonDiskBlocks: CSBlock[];
    diskBlocks: CSDisk[];
    validation: { valid: boolean; errors: any[] };
    lengthInfo: { totalLength: number };
}

interface EditorActions {
    setBlocks: React.Dispatch<React.SetStateAction<CSBlock[]>>;
    setSelectedBlockId: (id: string | null) => void;
    setSidebarOpen: (open: boolean) => void;
    setShowGrid: (show: boolean) => void;
    setGridSpacing: (spacing: number) => void;
    setAngleUnit: (unit: 'deg' | 'rad') => void;
    setShowContactDisks: (show: boolean) => void;
    setShowValidation: (show: boolean) => void;
    addSegment: () => void;
    addArc: () => void;
    addDisk: () => void;
    deleteBlock: (id: string) => void;
    updateBlock: (id: string, updates: Partial<CSBlock>) => void;
}

interface RollingState {
    isActive: boolean;
    pivotDiskId: string | null;
    rollingDiskId: string | null;
    theta: number;
    speed: number;
    direction: 1 | -1;
    isAnimating: boolean;
    showTrail: boolean;
    toggleAnimation: () => void;
    setTheta: (theta: number) => void;
    setSpeed: (speed: number) => void;
    setDirection: (dir: 1 | -1) => void;
    setShowTrail: (show: boolean) => void;
    resetSelection: () => void;
    getCurrentPosition: () => { x: number; y: number } | null;
}

interface EditorSidebarProps {
    isOpen: boolean;
    rollingMode: boolean;
    rollingState: RollingState;
    editorState: EditorState;
    actions: EditorActions;
    dubinsState?: any;
}

export const EditorSidebar = ({
    isOpen,
    rollingMode,
    rollingState,
    editorState,
    actions,
    dubinsState,
}: EditorSidebarProps) => {
    if (!isOpen) return null;

    const { showContactDisks } = editorState;

    return (
        <aside
            style={{
                width: '320px',
                borderLeft: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* ROLLING MODE PANEL */}
            {rollingMode && (
                <RollingModePanel
                    pivotDiskId={rollingState.pivotDiskId}
                    rollingDiskId={rollingState.rollingDiskId}
                    theta={rollingState.theta}
                    speed={rollingState.speed}
                    direction={rollingState.direction}
                    isAnimating={rollingState.isAnimating}
                    showTrail={rollingState.showTrail}
                    diskBlocks={editorState.diskBlocks}
                    onToggleAnimation={rollingState.toggleAnimation}
                    onThetaChange={rollingState.setTheta}
                    onSpeedChange={rollingState.setSpeed}
                    onDirectionChange={rollingState.setDirection}
                    onShowTrailChange={rollingState.setShowTrail}
                    onResetSelection={rollingState.resetSelection}
                    onCommitPosition={() => {
                        const newPos = rollingState.getCurrentPosition();
                        if (newPos && rollingState.rollingDiskId) {
                            actions.updateBlock(rollingState.rollingDiskId, { center: newPos });
                            rollingState.resetSelection();
                        }
                    }}
                />
            )}

            {/* CONTACT MATRIX FOR ROLLING MODE (Dynamic) */}
            {rollingMode && rollingState.pivotDiskId && rollingState.rollingDiskId && (
                <div style={{ padding: '0 var(--space-md) var(--space-md)' }}>
                    <ContactMatrixViewer disks={(() => {
                        // Calculate dynamic positions for the matrix
                        // We need to clone the disks and update the rolling one
                        const currentPos = rollingState.getCurrentPosition();
                        if (!currentPos) return editorState.diskBlocks;
                        return editorState.diskBlocks.map(d => {
                            if (d.id === rollingState.rollingDiskId) {
                                return { ...d, center: currentPos };
                            }
                            return d;
                        });
                    })()} />
                </div>
            )}



            {/* CONTACT DISKS INFO PANEL */}
            {showContactDisks && (
                <div
                    style={{
                        padding: 'var(--space-md)',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                    }}
                >
                    <h2
                        style={{
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 'var(--fw-semibold)',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--space-sm)',
                        }}
                    >
                        🔵 Grafos de Contacto
                    </h2>
                    <div
                        style={{
                            padding: 'var(--space-md)',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            fontSize: 'var(--fs-body)',
                            color: 'var(--text-primary)',
                            lineHeight: '1.6',
                        }}
                    >
                        <p style={{ marginBottom: 'var(--space-sm)' }}>
                            Los <strong>discos de contacto</strong> representan las regiones vacías del diagrama del nudo.
                        </p>
                        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                            Cada disco se posiciona en el centro de una región cerrada formada por los segmentos y arcos del diagrama.
                        </p>
                    </div>

                    <div style={{ marginTop: 'var(--space-md)' }}>
                        <Button
                            onClick={() => actions.setShowContactDisks(false)}
                            variant="secondary"
                            style={{ width: '100%' }}
                        >
                            Ocultar Discos
                        </Button>
                    </div>

                    {/* CONTACT MATRIX VIEWER - NEW */}
                    <ContactMatrixViewer disks={editorState.diskBlocks} />
                </div>
            )}

            {/* GRAPHS PANEL (Visible when Contact Disks are enabled) */}
            {showContactDisks && (
                <GraphsPanel onLoadScene={(disks) => {
                    // Replace all blocks with new disks
                    actions.setBlocks(disks);
                    // Clear selection
                    actions.setSelectedBlockId(null);
                    // Ensure dubins state is reset if relevant
                    if (dubinsState) {
                        dubinsState.actions.setStartConfig(null);
                        dubinsState.actions.setEndConfig(null);
                    }
                }} />
            )}

            {/* STANDARD EDITOR TOOLS */}
            {!rollingMode && !showContactDisks && (
                <>
                    <ViewControls
                        showGrid={editorState.showGrid}
                        onToggleGrid={actions.setShowGrid}
                        gridSpacing={editorState.gridSpacing}
                        onGridSpacingChange={actions.setGridSpacing}
                        angleUnit={editorState.angleUnit}
                        onAngleUnitChange={actions.setAngleUnit}
                    />
                    <BlockList
                        blocks={editorState.blocks}
                        selectedBlockId={editorState.selectedBlockId}
                        onSelectBlock={actions.setSelectedBlockId as any} // Cast if types slightly mismatch (null vs undefined implied)
                        onUpdateBlock={actions.updateBlock}
                        onDeleteBlock={actions.deleteBlock}
                    />

                    {dubinsState && (
                        <div style={{ padding: 'var(--space-md)', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: 'var(--fs-caption)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>DUBINS PATHS</span>
                                <Button
                                    onClick={() => {
                                        dubinsState.actions.setStartConfig(null);
                                        dubinsState.actions.setEndConfig(null);
                                        // Also clear disks if logic requires (though setStartConfig(null) in proper logic should ideally clear everything, 
                                        // or we manually clear disk IDs if we could access them. useDubinsState actions should ideally have a 'reset' method)
                                    }}
                                    variant="secondary"
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                    Limpiar
                                </Button>
                            </div>

                            {/* Max Paths Control */}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    Caminos visibles: {dubinsState.state.maxPathsToShow}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="6"
                                    step="1"
                                    value={dubinsState.state.maxPathsToShow}
                                    onChange={(e) => dubinsState.actions.setMaxPathsToShow(parseInt(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Disk Selection Status (Optional but helpful) */}
                            {(dubinsState.state.startDiskId || dubinsState.state.endDiskId) && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '4px' }}>
                                    {dubinsState.state.startDiskId && <div>Start: {dubinsState.state.startDiskId}</div>}
                                    {dubinsState.state.endDiskId && <div>End: {dubinsState.state.endDiskId}</div>}
                                </div>
                            )}

                        </div>
                    )}

                    <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: 'var(--fs-caption)', marginBottom: '8px', color: 'var(--text-secondary)' }}>Agregar</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <Button onClick={actions.addSegment} variant="secondary" style={{ fontSize: 'var(--fs-caption)' }}>+ Segmento</Button>
                            <Button onClick={actions.addArc} variant="secondary" style={{ fontSize: 'var(--fs-caption)' }}>+ Arco</Button>
                            <Button onClick={actions.addDisk} variant="secondary" style={{ fontSize: 'var(--fs-caption)' }}>+ Disco</Button>
                        </div>
                    </div>
                </>
            )}

            {/* CONTACT MATRIX IN MANUAL MODE */}
            {!rollingMode && !showContactDisks && editorState.diskBlocks.length > 0 && (
                <div style={{ padding: '0 var(--space-md) var(--space-md)', borderTop: '1px solid var(--border)' }}>
                    <ContactMatrixViewer disks={editorState.diskBlocks} />
                </div>
            )}

        </aside>
    );
};
