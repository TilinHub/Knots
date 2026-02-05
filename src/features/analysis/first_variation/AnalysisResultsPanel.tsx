import React from 'react';
import type { CheckResult } from './checks'; // Type-only import
import type { CriticalityResult } from './criticality'; // Type-only import
import { Button } from '../../../ui/Button';

// Redefine interface to match analyzer.ts update
interface MatrixInfo { dims: string; rank: number; }
interface VectorInfo { dims: string; norm: number; }
interface GaugeInfo {
    dims: { U: string; V_Roll: string; W: string; Ug: string };
    checks: {
        AUc: number;
        UtU_I: number;
        WtW_I: number;
        UgtW: number;
    };
}

interface AnalysisResultsPanelProps {
    counts?: { N: number; E: number; T: number; S: number; A: number; };
    metrics: CheckResult[];
    combinatorial: CheckResult;
    global?: CheckResult[];
    matrices?: {
        A: MatrixInfo;
        Tc: MatrixInfo;
        Tw: MatrixInfo;
        L: MatrixInfo;
    };
    vectors?: {
        gc: VectorInfo;
        gw: VectorInfo;
        gred: VectorInfo;
    };
    gauge?: GaugeInfo;
    criticality: CriticalityResult | null;
    quadratic?: number;
    onClose: () => void;
}

export const AnalysisResultsPanel: React.FC<AnalysisResultsPanelProps> = ({
    counts, metrics, combinatorial, global, matrices, vectors, gauge, criticality, quadratic, onClose
}) => {
    const failedMetrics = metrics.filter(m => !m.passed);
    const failedGlobal = global ? global.filter(m => !m.passed) : [];

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

    const DataRow = ({ label, value, sub }: { label: string, value: string, sub?: string }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontFamily: 'monospace' }}>
                {value}
                {sub && <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>{sub}</span>}
            </span>
        </div>
    );

    const DetailedResultRow = ({ label, failedItems }: { label: string, failedItems: CheckResult[] }) => {
        const [expanded, setExpanded] = React.useState(false);
        const passed = failedItems.length === 0;

        return (
            <div style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', cursor: passed ? 'default' : 'pointer', fontSize: '13px', alignItems: 'center' }}
                    onClick={() => !passed && setExpanded(!expanded)}
                >
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ color: passed ? 'var(--accent-success)' : 'var(--accent-error)', fontWeight: 'bold' }}>
                            {passed ? "PASS" : `FAIL (${failedItems.length})`} <span style={{ fontSize: '10px', verticalAlign: 'middle' }}>{!passed && (expanded ? '▼' : '▶')}</span>
                        </span>
                    </div>
                </div>
                {expanded && !passed && (
                    <div style={{ background: 'rgba(255,0,0,0.05)', padding: '8px', marginTop: '4px', borderRadius: '4px', fontSize: '12px' }}>
                        {failedItems.map((m, i) => (
                            <div key={i} style={{ marginBottom: '4px', color: 'var(--accent-error)' }}>
                                • {m.message} {m.value > 0 && <span style={{ opacity: 0.7 }}>(val: {m.value.toExponential(2)})</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

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
            width: '600px', // Wider to fit more data
            maxWidth: '95vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>📊 CS Diagram Analysis (Protocol)</h2>
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

                <DetailedResultRow
                    label="Geometric Checks (S1-S2, A1-A3)"
                    failedItems={failedMetrics}
                />

                {global && (
                    <DetailedResultRow
                        label="Global Checks (G1-G3)"
                        failedItems={failedGlobal}
                    />
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* 3. Matrices */}
                {matrices && (
                    <div>
                        <h3 style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Matrices</h3>
                        <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px' }}>
                            <DataRow label="A(c)" value={matrices.A.dims} sub={`Rank ${matrices.A.rank}`} />
                            <DataRow label="Tc(c)" value={matrices.Tc.dims} sub={`Rank ${matrices.Tc.rank}`} />
                            <DataRow label="Tw(c)" value={matrices.Tw.dims} sub={`Rank ${matrices.Tw.rank}`} />
                            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}></div>
                            <DataRow label="L(c)" value={matrices.L.dims} sub={`Rank ${matrices.L.rank}`} />
                        </div>
                    </div>
                )}

                {/* 4. Vectors */}
                {vectors && (
                    <div>
                        <h3 style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Vectors</h3>
                        <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px' }}>
                            <DataRow label="gc" value={`||gc|| = ${vectors.gc.norm.toExponential(4)}`} sub={vectors.gc.dims} />
                            <DataRow label="gw" value={`||gw|| = ${vectors.gw.norm.toExponential(4)}`} sub={vectors.gw.dims} />
                            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}></div>
                            <DataRow label="gred" value={`||gred|| = ${vectors.gred.norm.toExponential(4)}`} sub={vectors.gred.dims} />
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Gauge */}
            {gauge && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Gauge Checking</h3>
                    <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Dimensions</div>
                            <DataRow label="U" value={gauge.dims.U} />
                            <DataRow label="VRoll" value={gauge.dims.V_Roll} />
                            <DataRow label="W" value={gauge.dims.W} />
                            <DataRow label="Ug" value={gauge.dims.Ug} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Residuals</div>
                            <DataRow label="‖A U‖" value={gauge.checks.AUc.toExponential(2)} />
                            <DataRow label="‖Uᵀ U - I‖" value={gauge.checks.UtU_I.toExponential(2)} />
                            <DataRow label="‖Wᵀ W - I‖" value={gauge.checks.WtW_I.toExponential(2)} />
                            <DataRow label="‖Ugᵀ W‖" value={gauge.checks.UgtW.toExponential(2)} />
                        </div>
                    </div>
                </div>
            )}


            {/* 6. Criticality */}
            {criticality && (
                <div style={{ marginBottom: '20px', padding: '16px', background: criticality.isCritical ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)', borderRadius: '8px', border: `1px solid ${criticality.isCritical ? 'var(--accent-success)' : 'var(--accent-warning)'}` }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Criticality Test</span>
                        <strong style={{ color: criticality.isCritical ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                            {criticality.isCritical ? 'CRITICAL' : 'NOT CRITICAL'}
                        </strong>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>‖r‖</span>
                        <span style={{ fontFamily: 'monospace' }}>{criticality.normR.toExponential(6)}</span>

                        <span style={{ color: 'var(--text-secondary)' }}>Ratio</span>
                        <span style={{ fontFamily: 'monospace' }}>{criticality.ratio.toExponential(6)}</span>
                    </div>
                </div>
            )}

            {/* 7. Quadratic (Optional) */}
            {quadratic !== undefined && (
                <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '4px' }}>Second Variation (Quadratic Stability Test)</h3>
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
