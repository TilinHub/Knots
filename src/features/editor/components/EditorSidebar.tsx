import { RollingModePanel } from './RollingModePanel';
import { GraphsPanel } from './GraphsPanel';
import { CatalogPanel } from '../../catalog/CatalogPanel';
import { BlockList } from './BlockList';
import { Button } from '../../../ui/Button';
import { ContactMatrixViewer } from './ContactMatrixViewer';
import type { CSBlock, CSDisk } from '../../../core/types/cs';
import type React from 'react';
import { useState } from 'react';
import { AnalysisResultsPanel } from '../../analysis/first_variation/AnalysisResultsPanel';
import { analyzeDiagram, type AnalysisReport } from '../../analysis/first_variation/analyzer';
import { convertEditorToProtocol } from '../../analysis/first_variation/converter';

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
    savedKnots: { id: string; name: string; diskSequence: string[]; color?: string; chiralities?: ('L' | 'R')[] }[];
    envelopeColor?: string; // [NEW]
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
    addSavedKnot: (diskSequence: string[], chiralities?: ('L' | 'R')[], anchorSequence?: any[]) => void;
    deleteSavedKnot: (id: string) => void;
    setEnvelopeColor?: (color: string) => void;
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
    knotMode?: boolean;
    knotState?: any;
    catalogMode?: boolean;
}

export const EditorSidebar = ({
    isOpen,
    rollingMode,
    rollingState,
    editorState,
    actions,
    dubinsState,
    knotMode = false,
    knotState,
    catalogMode = false,
}: EditorSidebarProps) => {
    if (!isOpen) return null;

    const { showContactDisks } = editorState;
    const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);

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
            {/* CATALOG MODE PANEL */}
            {catalogMode && (
                <CatalogPanel onLoadEntry={(entry) => {
                    // Load the first stable result into the editor
                    if (entry.results.length > 0) {
                        const res = entry.results[0];
                        actions.setBlocks(res.finalConfig.blocks);
                        actions.setSelectedBlockId(null);

                        // We also need to set the knot sequence if we want to visualize the envelope!
                        // The entry doesn't explicitly store the sequence string[] currently?
                        // CatalogEntry has `initialConfig` and `results`.
                        // We should modify CatalogEntry to strictly store the sequence.
                        // For now, let's assume simple sequence "d0", "d1"... based on blocks?
                        // Or try to detect it again.

                        // Better: Just load the blocks for now. The user can use Knot Mode to recreate it?
                        // Ideally we pass the sequence.
                        // I will update catalogTypes.ts to include `diskSequence`.

                        if (entry.diskSequence && knotState?.actions?.setSequence) {
                            // [FIX] Load Chiralities if available for exact reproduction
                            // We need to expose setChiralities in knotState?
                            // Or findEnvelopePath will just find the best one again.
                            // If we want EXACT match, we need to enforce chiralities.
                            // For now, let's just set sequence and let Editor re-solve.
                            // The user complained about "Preview differs from Generated".
                            // If Editor re-solves to same solution, it matches.
                            // If Preview used passed Chiralities, and Editor re-solves to different... mismatch.
                            // So we SHOULD pass chiralities to Editor too?
                            // But Editor is interactive. It finds "Auto" path.
                            // Unless we set "Fixed Topology" mode?
                            knotState.actions.setSequence(entry.diskSequence);
                        }
                    }
                }} />
            )}

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

            {/* KNOT MODE PANEL */}
            {knotMode && knotState && (
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
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
                        🧶 Knot Construction
                    </h2>
                    <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Select disks in sequence to wrap the envelope around them.
                        <br />
                        <strong>Sequence:</strong> {knotState.diskSequence.length} disks
                    </div>

                    {/* Color Picker for Active Knot */}
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <label>Color:</label>
                        <input
                            type="color"
                            value={editorState.envelopeColor || '#FF0000'}
                            onChange={(e) => actions.setEnvelopeColor?.(e.target.value)}
                            style={{ border: 'none', width: '24px', height: '24px', cursor: 'pointer', background: 'none' }}
                        />
                        <span style={{ color: 'var(--text-tertiary)' }}>{editorState.envelopeColor}</span>
                    </div>


                    <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <Button
                            onClick={actions.addDisk}
                            variant="secondary"
                            style={{ width: '100%', fontSize: '12px' }}
                        >
                            + Add Disk
                        </Button>
                        <Button
                            onClick={() => {
                                const lastDisk = editorState.diskBlocks[editorState.diskBlocks.length - 1];
                                if (lastDisk) actions.deleteBlock(lastDisk.id);
                            }}
                            variant="secondary"
                            style={{ width: '100%', fontSize: '12px', borderColor: 'var(--accent-error)', color: 'var(--accent-error)' }}
                            disabled={editorState.diskBlocks.length === 0}
                        >
                            - Remove Disk
                        </Button>
                    </div>


                    {knotState.diskSequence.length > 2 && (
                        <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '12px' }}>
                            {knotState.diskSequence[0] === knotState.diskSequence[knotState.diskSequence.length - 1]
                                ? "✅ Loop Closed"
                                : "⚠️ Loop Open (Click the green start disk to close)"
                            }
                        </div>
                    )}

                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                        <Button
                            onClick={() => {
                                // Save with frozen path - the knotPath is the EXACT geometry computed now
                                (actions.addSavedKnot as any)(
                                    knotState.diskSequence,
                                    knotState.chiralities,
                                    knotState.anchorSequence,
                                    knotState.knotPath // Freeze the actual path geometry
                                );
                                knotState.actions.clearSequence();
                            }}
                            variant="primary"
                            style={{ flex: 1 }}
                            disabled={knotState.diskSequence.length < 2}
                        >
                            Save Envelope
                        </Button>
                        <Button
                            onClick={knotState.actions.clearSequence}
                            variant="secondary"
                            style={{ width: '80px', borderColor: 'var(--accent-error)', color: 'var(--accent-error)' }}
                            disabled={knotState.diskSequence.length === 0}
                        >
                            Clear
                        </Button>
                    </div>

                    <div>
                        <Button
                            onClick={() => {
                                const diagram = convertEditorToProtocol(editorState.diskBlocks, knotState.diskSequence, {
                                    tolerance: 1e-4,
                                    chiralities: knotState.chiralities,
                                    anchorSequence: knotState.anchorSequence // [NEW]
                                });
                                const report = analyzeDiagram(diagram);
                                setAnalysisReport(report);
                            }}
                            variant="secondary"
                            style={{ marginTop: '8px', width: '100%', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                            disabled={knotState.diskSequence.length < 2}
                            title={knotState.diskSequence.length < 2 ? "Add more disks" : "Run Full Analysis (First & Second Variation)"}
                        >
                            🔍 Analyze Diagram (Full Protocol)
                        </Button>
                    </div>

                    {/* Matrix Viewer in Knot Mode */}
                    {editorState.diskBlocks.length > 0 && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <ContactMatrixViewer disks={editorState.diskBlocks} />
                        </div>
                    )}


                </div>
            )}


            {/* CONTACT MATRIX FOR ROLLING MODE (Dynamic) */}
            {
                rollingMode && rollingState.pivotDiskId && rollingState.rollingDiskId && (
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
                )
            }



            {/* CONTACT DISKS INFO PANEL */}
            {
                showContactDisks && (
                    <div
                        style={{
                            padding: 'var(--space-md)',
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-primary)',
                        }}
                    >
                        <h2
                            style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 'var(--space-sm)',
                            }}
                        >
                            🔵 Contact Graphs
                        </h2>
                        <div
                            style={{
                                padding: 'var(--space-md)',
                                background: 'var(--bg-secondary)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                lineHeight: '1.6',
                            }}
                        >
                            <p style={{ marginBottom: 'var(--space-sm)' }}>
                                The <strong>contact disks</strong> represent the empty regions of the knot diagram.
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Each disk is positioned at the center of a closed region formed by the segments and arcs of the diagram.
                            </p>
                        </div>

                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <Button
                                onClick={() => actions.setShowContactDisks(false)}
                                variant="secondary"
                                style={{ width: '100%' }}
                            >
                                Hide Disks
                            </Button>
                        </div>

                        {/* CONTACT MATRIX VIEWER - NEW */}
                        <ContactMatrixViewer disks={editorState.diskBlocks} />
                    </div>
                )
            }

            {/* GRAPHS PANEL (Visible when Contact Disks are enabled) */}
            {
                showContactDisks && (
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
                )
            }

            {/* SAVED KNOTS LIST (Visible in Standard & Knot Mode) */}
            {
                !rollingMode && !showContactDisks && editorState.savedKnots?.length > 0 && (
                    <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 'var(--fw-semibold)',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            Saved Envelopes
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {editorState.savedKnots.map((knot, i) => (
                                <div key={knot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: knot.color || '#FF8C00' }}></div>
                                        <span>{knot.name || `Knot ${i + 1}`} ({knot.diskSequence.length} disks)</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={() => {
                                                const diagram = convertEditorToProtocol(editorState.diskBlocks, knot.diskSequence, { tolerance: 1e-4, chiralities: knot.chiralities });
                                                const report = analyzeDiagram(diagram);
                                                setAnalysisReport(report);
                                            }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                            title="Analyze Saved Envelope"
                                        >
                                            🔍
                                        </button>
                                        <button
                                            onClick={() => actions.deleteSavedKnot(knot.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1 }}
                                            title="Delete"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* STANDARD EDITOR TOOLS */}
            {
                !rollingMode && !knotMode && !showContactDisks && (
                    <>
                        {/* BLOCK LIST - Expands to fill space */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                            <BlockList
                                blocks={editorState.blocks}
                                selectedBlockId={editorState.selectedBlockId}
                                onSelectBlock={actions.setSelectedBlockId as any}
                                onUpdateBlock={actions.updateBlock}
                                onDeleteBlock={actions.deleteBlock}
                            />
                        </div>

                        {/* Matrix Viewer - Above Add Element */}
                        {editorState.diskBlocks.length > 0 && (
                            <div style={{ padding: '0 var(--space-md) var(--space-md)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
                                <ContactMatrixViewer disks={editorState.diskBlocks} />
                            </div>
                        )}

                        {/* Add Element - Fixed at bottom */}
                        <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
                            <h3 style={{ fontSize: '11px', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Add Element</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                <Button onClick={actions.addDisk} variant="secondary" style={{ fontSize: '12px' }}>+ Disk</Button>
                            </div>
                        </div>
                    </>
                )
            }


            {/* ANALYSIS RESULTS MODAL */}
            {
                analysisReport && (
                    <AnalysisResultsPanel
                        counts={analysisReport.counts}
                        metrics={analysisReport.metrics}
                        combinatorial={analysisReport.combinatorial}
                        global={analysisReport.global}
                        matrices={analysisReport.matrices}
                        vectors={analysisReport.vectors}
                        gauge={analysisReport.gauge}
                        criticality={analysisReport.criticality}
                        quadratic={analysisReport.quadratic}
                        onClose={() => setAnalysisReport(null)}
                    />
                )
            }

        </aside >
    );
};
