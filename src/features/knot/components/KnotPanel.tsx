import React, { useState } from 'react';
import { Button } from '../../../ui/Button';
import { ContactMatrixViewer } from '../../editor/components/ContactMatrixViewer';
import { convertEditorToProtocol } from '../../analysis/first_variation/converter';
import { analyzeDiagram, type AnalysisReport } from '../../analysis/first_variation/analyzer';
import { AnalysisResultsPanel } from '../../analysis/first_variation/AnalysisResultsPanel';

interface KnotPanelProps {
    knotState: any;
    editorState: any;
    actions: any;
}

export const KnotPanel: React.FC<KnotPanelProps> = ({ knotState, editorState, actions }) => {
    const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);

    return (
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
        </div>
    );
};
