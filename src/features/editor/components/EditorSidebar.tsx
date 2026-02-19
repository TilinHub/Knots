import type React from 'react';
import { useState } from 'react';

import type { CSBlock, CSDisk } from '../../../core/types/cs';
import { Button } from '../../../ui/Button';
import { AnalysisResultsPanel } from '../../analysis/first_variation/AnalysisResultsPanel';
import { type AnalysisReport, analyzeDiagram } from '../../analysis/first_variation/analyzer';
import { convertEditorToProtocol } from '../../analysis/first_variation/converter';
import { CatalogPanel } from '../../catalog/CatalogPanel';
import { KnotPanel } from '../../knot/components/KnotPanel';
import { RollingPanel } from '../../rolling/components/RollingPanel';
import { BlockList } from './BlockList';
import { ContactMatrixViewer } from './ContactMatrixViewer';
import { GraphsPanel } from './GraphsPanel';

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
    savedKnots: { id: string; name: string; diskSequence: string[]; color?: string; chiralities?: ('L' | 'R')[]; frozenPath?: any[] }[];
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
                            knotState.actions.setSequence(entry.diskSequence);

                            // [FIX] Restore Chiralities for exact topology reproduction
                            // We check where chiralities are stored in the entry. 
                            // Usually in the result combinatorial data or top level?
                            // For now, check if entry has it (needs type update maybe) or if result has it.
                            const chiralities = (entry as any).chiralities || ((entry.results?.[0] as any)?.combinatorial?.chiralities);

                            if (chiralities && Array.isArray(chiralities) && knotState.actions.setChiralities) {
                                knotState.actions.setChiralities(chiralities);
                            }
                        }
                    }
                }} />
            )}

            {/* ROLLING MODE PANEL */}
            {rollingMode && (
                <RollingPanel
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
                <KnotPanel
                    knotState={knotState}
                    editorState={editorState}
                    actions={actions}
                />
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
                                                const diagram = convertEditorToProtocol(editorState.diskBlocks, knot.diskSequence, { tolerance: 1e-4, chiralities: knot.chiralities, frozenPath: knot.frozenPath });
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
