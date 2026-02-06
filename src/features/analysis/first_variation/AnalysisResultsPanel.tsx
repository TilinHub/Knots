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
    instanceData?: {
        disks: { id: number, center: { x: number, y: number } }[];
        contacts: { diskA: number, diskB: number }[];
    };
    onClose: () => void;
}

const MathText = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontFamily: '"Times New Roman", Times, serif', fontStyle: 'italic' }}>
        {children}
    </span>
);

const ResultRow = ({ label, value, passed, detail }: { label: React.ReactNode, value: string, passed: boolean, detail?: string }) => (
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

const DataRow = ({ label, value, sub }: { label: React.ReactNode, value: string, sub?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'monospace' }}>
            {value}
            {sub && <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>{sub}</span>}
        </span>
    </div>
);

const DetailedResultRow = ({ label, failedItems }: { label: React.ReactNode, failedItems: CheckResult[] }) => {
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

export const AnalysisResultsPanel: React.FC<AnalysisResultsPanelProps> = ({
    counts, metrics, combinatorial, global, matrices, vectors, gauge, criticality, quadratic, instanceData, onClose
}) => {
    const failedMetrics = metrics.filter(m => !m.passed);
    const failedGlobal = global ? global.filter(m => !m.passed) : [];
    const [instanceExpanded, setInstanceExpanded] = React.useState(false);

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
            width: '600px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>📊 CS Diagram Analysis (Protocol)</h2>
                <Button onClick={onClose} variant="secondary" style={{ padding: '4px 8px' }}>✕</Button>
            </div>

            {/* 0. Instance Data (Extended) */}
            {instanceData && (
                <div style={{ marginBottom: '20px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div
                        onClick={() => setInstanceExpanded(!instanceExpanded)}
                        style={{
                            padding: '10px 12px',
                            background: 'var(--bg-tertiary)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <span>
                            Table with <MathText>N, c<sub>i</sub>, ℰ, |ℰ|, |𝒯|, |𝒮|, |𝒜|</MathText>
                        </span>
                        <span>{instanceExpanded ? '▲' : '▼'}</span>
                    </div>

                    {instanceExpanded && (
                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', fontSize: '12px' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                                    Centers (<MathText>c<sub>i</sub></MathText>)
                                </strong>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '4px' }}>
                                    {instanceData.disks.map(d => (
                                        <div key={d.id} style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                            {d.id}: ({d.center.x.toFixed(4)}, {d.center.y.toFixed(4)})
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                                    Contacts (<MathText>ℰ</MathText>)
                                </strong>
                                <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {instanceData.contacts.length > 0
                                        ? instanceData.contacts.map((c, i) => `{${c.diskA},${c.diskB}}`).join(', ')
                                        : "None"}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 1. Counts Table */}
            {counts && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathText>N</MathText></div><strong>{counts.N}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathText>|ℰ|</MathText></div><strong>{counts.E}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathText>|𝒯|</MathText></div><strong>{counts.T}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathText>|𝒮|</MathText></div><strong>{counts.S}</strong></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathText>|𝒜|</MathText></div><strong>{counts.A}</strong></div>
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>VALIDATION</h3>

                <ResultRow
                    label={<span><MathText>(C0)</MathText> verificacion del ciclo orientado</span>}
                    value={combinatorial.passed ? "PASS" : "FAIL"}
                    passed={combinatorial.passed}
                    detail={!combinatorial.passed ? combinatorial.message : undefined}
                />

                <DetailedResultRow
                    label={<span>Verificaciones metricas <MathText>(S1)-(S2), (A1)-(A3)</MathText></span>}
                    failedItems={failedMetrics}
                />

                <DetailedResultRow
                    label={<span>Chequeos globales <MathText>(G1)-(G3)</MathText></span>}
                    failedItems={failedGlobal}
                />
            </div>

            {/* Matrices & Vectors */}
            {matrices && vectors && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>MATRICES</h3>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                            <DataRow label={<MathText>A(c)</MathText>} value={matrices.A.dims} sub={`Rank ${matrices.A.rank}`} />
                            <DataRow label={<MathText>T<sub>c</sub>(c)</MathText>} value={matrices.Tc.dims} sub={`Rank ${matrices.Tc.rank}`} />
                            <DataRow label={<MathText>T<sub>ω</sub>(c)</MathText>} value={matrices.Tw.dims} sub={`Rank ${matrices.Tw.rank}`} />
                            <DataRow label={<MathText>L(c)</MathText>} value={matrices.L.dims} sub={`Rank ${matrices.L.rank}`} />
                        </div>
                    </div>
                    <div>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>VECTORS</h3>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                            <DataRow label={<MathText>g<sub>c</sub></MathText>} value={`||·|| = ${vectors.gc.norm.toExponential(4)}`} sub={vectors.gc.dims} />
                            <DataRow label={<MathText>g<sub>ω</sub></MathText>} value={`||·|| = ${vectors.gw.norm.toExponential(4)}`} sub={vectors.gw.dims} />
                            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}></div>
                            <DataRow label={<MathText>g<sub>red</sub></MathText>} value={`||·|| = ${vectors.gred.norm.toExponential(4)}`} sub={vectors.gred.dims} />
                        </div>
                    </div>
                </div>
            )}

            {/* Gauge */}
            {gauge && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>GAUGE CHECKING</h3>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Dimensions</div>
                            <DataRow label={<MathText>U</MathText>} value={gauge.dims.U} />
                            <DataRow label={<MathText>V<sub>Roll</sub></MathText>} value={gauge.dims.V_Roll} />
                            <DataRow label={<MathText>W</MathText>} value={gauge.dims.W} />
                            <DataRow label={<MathText>U<sub>g</sub></MathText>} value={gauge.dims.Ug} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Residuals</div>
                            <DataRow label={<MathText>||A U||</MathText>} value={gauge.checks.AUc.toExponential(2)} />
                            <DataRow label={<MathText>||U<sup>T</sup>U - I||</MathText>} value={gauge.checks.UtU_I.toExponential(2)} />
                            <DataRow label={<MathText>||W<sup>T</sup>W - I||</MathText>} value={gauge.checks.WtW_I.toExponential(2)} />
                            <DataRow label={<MathText>||U<sub>g</sub><sup>T</sup>W||</MathText>} value={gauge.checks.UgtW.toExponential(2)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Criticality */}
            {criticality && (
                <div style={{ background: 'rgba(255,0,0,0.05)', padding: '16px', borderRadius: '8px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px' }}>
                            Criticidad: <MathText>r = U<sub>g</sub><sup>T</sup> g<sub>red</sub></MathText>
                        </h4>
                        <span style={{ fontWeight: 'bold' }}>{criticality.isCritical ? "CRITICAL" : "NOT CRITICAL"}</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        <div><MathText>||r||</MathText> &nbsp;&nbsp; {criticality.normR.toExponential(6)}</div>
                        <div>Ratio &nbsp; {criticality.ratio.toExponential(6)}</div>
                    </div>

                    {quadratic !== undefined && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                            <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                (Opcional) Evaluacion de <MathText>Q<sub>red</sub></MathText>
                            </strong>
                            <div style={{ fontFamily: 'monospace' }}>
                                <MathText>Q<sub>red</sub>(r)</MathText>: {quadratic.toExponential(4)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} variant="primary">Close Report</Button>
            </div>
        </div>
    );
};
