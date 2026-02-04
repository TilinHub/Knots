import React from 'react';
import type { CheckResult } from './checks'; // Type-only import
import type { CriticalityResult } from './criticality'; // Type-only import
import { Button } from '../../../ui/Button';

interface Counts { N: number; E: number; T: number; S: number; A: number; }
interface MatrixDims { A_dims: string; Tc_dims: string; L_dims: string; }

// Duplicate this here or share from analyzer.ts if exporting it?
// To avoid conflicts, let's redefine partial interface for props
interface AnalysisResultsPanelProps {
    counts?: Counts;
    metrics: CheckResult[];
    combinatorial: CheckResult;
    global?: CheckResult[];
    matrices?: MatrixDims;
    criticality: CriticalityResult | null;
    quadratic?: number;
    onClose: () => void;
}

export const AnalysisResultsPanel: React.FC<AnalysisResultsPanelProps> = ({
    counts, metrics, combinatorial, global, matrices, criticality, quadratic, onClose
}) => {
    const failedMetrics = metrics.filter(m => !m.passed);
    const failedGlobal = global ? global.filter(m => !m.passed) : [];

    // Group metrics by type for clear display if needed, but list is fine.

    const ResultRow = ({ label, value, passed, detail }: { label: string, value: string, passed: boolean, detail?: string }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <div style={{ textAlign: 'right' }}>
                <span style={{ color: passed ? 'var(--accent-success)' : 'var(--accent-error)', fontWeight: 'bold' }}>
                    {value}
                </span>
                {detail && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{detail}</div>}
            </div>
        </div>
    );

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 1000,
            width: '500px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)' // Use mono for data
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>📊 CS Diagram Analysis</h2>
                <Button onClick={onClose} variant="secondary" style={{ padding: '4px 8px' }}>✕</Button>
            </div>

            {/* 1. Counts Table */}
            {counts && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>N</div><strong>{counts.N}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>|E|</div><strong>{counts.E}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>|T|</div><strong>{counts.T}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>|S|</div><strong>{counts.S}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>|A|</div><strong>{counts.A}</strong></div>
                </div>
            )}

            {/* 2. Checks Summary */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Validation</h3>

                <ResultRow label="Combinatorial (C0)" value={combinatorial.passed ? "PASS" : "FAIL"} passed={combinatorial.passed} detail={!combinatorial.passed ? combinatorial.message : undefined} />
                <ResultRow
                    label="Geometric Checks"
                    value={failedMetrics.length === 0 ? "PASS" : `FAIL (${failedMetrics.length})`}
                    passed={failedMetrics.length === 0}
                />

                {failedMetrics.length > 0 && (
                    <div style={{ background: 'rgba(255,0,0,0.1)', padding: '8px', borderRadius: '4px', fontSize: '12px', marginTop: '4px' }}>
                        {failedMetrics.slice(0, 3).map((m, i) => (
                            <div key={i}>• {m.message} (res: {m.value.toExponential(2)})</div>
                        ))}
                    </div>
                )}

                {global && (
                    <ResultRow
                        label="Global Checks (G1-G3)"
                        value={failedGlobal.length === 0 ? "PASS" : `FAIL (${failedGlobal.length})`}
                        passed={failedGlobal.length === 0}
                    />
                )}
            </div>

            {/* 3. Matrices */}
            {matrices && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Linear Algebra</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                            A: <strong>{matrices.A_dims}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                            Tc: <strong>{matrices.Tc_dims}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                            L: <strong>{matrices.L_dims}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Criticality */}
            {criticality && (
                <div style={{ marginBottom: '20px', padding: '16px', background: criticality.isCritical ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)', borderRadius: '8px', border: `1px solid ${criticality.isCritical ? 'var(--accent-success)' : 'var(--accent-warning)'}` }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Criticality Test</span>
                        <strong style={{ color: criticality.isCritical ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                            {criticality.isCritical ? 'CRITICAL' : 'NOT CRITICAL'}
                        </strong>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>||r||</span>
                        <span style={{ fontFamily: 'monospace' }}>{criticality.normR.toExponential(6)}</span>

                        <span style={{ color: 'var(--text-secondary)' }}>Ratio</span>
                        <span style={{ fontFamily: 'monospace' }}>{criticality.ratio.toExponential(6)}</span>
                    </div>
                </div>
            )}

            {/* 5. Quadratic (Optional) */}
            {quadratic !== undefined && (
                <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Optional Quadratic Test</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Q_red(r): <strong style={{ color: 'var(--text-primary)' }}>{quadratic.toExponential(4)}</strong>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} variant="primary">Close Report</Button>
            </div>
        </div>
    );
};
