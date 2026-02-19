import React from 'react';

import { Button } from '../../../ui/Button';
import type { CheckResult } from './checks'; // Type-only import
import type { CriticalityResult } from './criticality'; // Type-only import

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
    pdfReport?: {
        c: { id: number, p: { x: number, y: number } }[];
        E: { i: number, j: number, dist: number, valid: boolean }[];
        T: {
            id: string, alpha: number, k: number,
            p: { x: number, y: number },
            n: { x: number, y: number },
            t: { x: number, y: number },
            epsilon: number,
            validDist: boolean
        }[];
        matrices: {
            A_dims: string, A_rank: number,
            Tc_dims: string, Tc_rank: number,
            Tw_dims: string, Tw_rank: number,
            L_dims: string, L_rank: number
        };
        S: { alpha: string, beta: string }[];
        A: { alpha: string, beta: string, k: number, sigma: number }[];
        Phi: { gc: number[], gw: number[] };
        Criticality: {
            isCritical: boolean,
            r_norm: number,
            ratio: number,
            Q_red: number | undefined
        };
    };
    onClose: () => void;
}

const TEX_FONT = '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif';

// Variable usually italic in math
const MathVar = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontFamily: TEX_FONT, fontStyle: 'italic' }}>
        {children}
    </span>
);

// Numbers/Operators usually roman (upright)
const MathNum = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontFamily: TEX_FONT, fontStyle: 'normal' }}>
        {children}
    </span>
);

// Generic wrapper (defaults to italic for backward compat with simple variables)
const MathText = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontFamily: TEX_FONT, fontStyle: 'italic' }}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: TEX_FONT }}>
            {value}
            {sub && <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>{sub}</span>}
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

const ChecklistSection = ({ title, children }: { title: React.ReactNode, children: React.ReactNode }) => (
    <div style={{ marginBottom: '24px' }}>
        <h3 style={{
            borderBottom: '2px solid var(--border)',
            paddingBottom: '4px',
            marginBottom: '12px',
            fontSize: '14px',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
        }}>
            {title}
        </h3>
        {children}
    </div>
);

const AnalysisChecklist = ({ report }: { report: NonNullable<AnalysisResultsPanelProps['pdfReport']> }) => {
    return (
        <div style={{ padding: '0 4px', fontSize: '13px' }}>
            <div style={{ marginBottom: '16px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                Reporte de conformidad con Sección 1.12 del Protocolo.
            </div>

            <ChecklistSection title={<span>1. Geometría de Discos (<MathText>c<sub>i</sub></MathText>)</span>}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '4px' }}>ID</th>
                            <th style={{ padding: '4px' }}><MathText>c<sub>i</sub></MathText> <MathNum>= (x, y)</MathNum></th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.c.map(d => (
                            <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '4px' }}>{d.id}</td>
                                <td style={{ padding: '4px', fontFamily: 'monospace' }}>
                                    ({d.p.x.toFixed(4)}, {d.p.y.toFixed(4)})
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ChecklistSection>

            <ChecklistSection title={<span>2. Contactos (<MathText>ℰ</MathText>)</span>}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '4px' }}>Pair <MathNum>{`{i, j}`}</MathNum></th>
                            <th style={{ padding: '4px' }}>Dist check <MathNum>||</MathNum><MathText>c<sub>i</sub></MathText><MathNum> - </MathNum><MathText>c<sub>j</sub></MathText><MathNum>|| = 2</MathNum></th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.E.map((c, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '4px' }}><MathText>{`{${c.i}, ${c.j}}`}</MathText></td>
                                <td style={{ padding: '4px', fontFamily: 'monospace', color: c.valid ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                                    {c.dist.toFixed(4)} {c.valid ? "✓" : "✗"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </ChecklistSection>

            <ChecklistSection title={<span>3. Tangencias (<MathText>𝒯</MathText>)</span>}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '4px' }}><MathText>α</MathText></th>
                                <th style={{ padding: '4px' }}><MathText>k</MathText><MathNum>(α)</MathNum></th>
                                <th style={{ padding: '4px' }}><MathText>p<sub>α</sub></MathText></th>
                                <th style={{ padding: '4px' }}><MathText>n<sub>α</sub></MathText></th>
                                <th style={{ padding: '4px' }}><MathText>t<sub>α</sub></MathText></th>
                                <th style={{ padding: '4px' }}><MathText>ε<sub>α</sub></MathText></th>
                                <th style={{ padding: '4px' }}>Check</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.T.map((t) => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '4px' }}>{t.id}</td>
                                    <td style={{ padding: '4px' }}>{t.k}</td>
                                    <td style={{ padding: '4px', fontFamily: 'monospace' }}>({t.p.x.toFixed(3)}, {t.p.y.toFixed(3)})</td>
                                    <td style={{ padding: '4px', fontFamily: 'monospace' }}>({t.n.x.toFixed(3)}, {t.n.y.toFixed(3)})</td>
                                    <td style={{ padding: '4px', fontFamily: 'monospace' }}>({t.t.x.toFixed(3)}, {t.t.y.toFixed(3)})</td>
                                    <td style={{ padding: '4px' }}>{t.epsilon > 0 ? "+1" : "-1"}</td>
                                    <td style={{ padding: '4px', color: t.validDist ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                                        {t.validDist ? "✓" : "✗"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChecklistSection>

            <ChecklistSection title={<span>4. Matrices (<MathText>L</MathText><MathNum>(c)</MathNum>)</span>}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <DataRow label={<span><MathText>A</MathText><MathNum>(c)</MathNum></span>} value={report.matrices.A_dims} sub={`Rank ${report.matrices.A_rank}`} />
                    <DataRow label={<span><MathText>T<sub>c</sub></MathText><MathNum>(c)</MathNum></span>} value={report.matrices.Tc_dims} sub={`Rank ${report.matrices.Tc_rank}`} />
                    <DataRow label={<span><MathText>T<sub>ω</sub></MathText><MathNum>(c)</MathNum></span>} value={report.matrices.Tw_dims} sub={`Rank ${report.matrices.Tw_rank}`} />
                    <DataRow label={<span><MathText>L</MathText><MathNum>(c)</MathNum></span>} value={report.matrices.L_dims} sub={`Rank ${report.matrices.L_rank}`} />
                </div>
            </ChecklistSection>

            <ChecklistSection title={<span>5. Combinatoria (<MathText>𝒮</MathText><MathNum>, </MathNum><MathText>𝒜</MathText>)</span>}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Segmentos (<MathText>α</MathText> <MathNum>→</MathNum> <MathText>β</MathText>)</strong>
                        {report.S.map((s, i) => (
                            <div key={i}><MathText>{s.alpha}</MathText> <MathNum>→</MathNum> <MathText>{s.beta}</MathText></div>
                        ))}
                    </div>
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Arcos (<MathText>α</MathText> <MathNum>→</MathNum> <MathText>β</MathText><MathNum>, </MathNum><MathText>k</MathText><MathNum>, </MathNum><MathText>σ</MathText>)</strong>
                        {report.A.map((a, i) => (
                            <div key={i}><MathText>{a.alpha}</MathText> <MathNum>→</MathNum> <MathText>{a.beta}</MathText><MathNum>, k={a.k}, σ={a.sigma > 0 ? '+' : '-'}</MathNum></div>
                        ))}
                    </div>
                </div>
            </ChecklistSection>

            <ChecklistSection title={<span>6. Funcional (<MathText>Φ</MathText>)</span>}>
                <div style={{ marginBottom: '8px' }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}><MathText>g<sub>c</sub> ∈ ℝ<sup>2N</sup></MathText></strong>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                        [{report.Phi.gc.map(v => v.toExponential(2)).join(', ')}]
                    </div>
                </div>
                <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}><MathText>g<sub>ω</sub> ∈ ℝ<sup>|𝒯|</sup></MathText></strong>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                        [{report.Phi.gw.map(v => v.toExponential(2)).join(', ')}]
                    </div>
                </div>
            </ChecklistSection>

            <ChecklistSection title={<span>7. Criticidad y Segunda Variación</span>}>
                <div style={{ background: report.Criticality.isCritical ? 'rgba(0,255,0,0.05)' : 'rgba(255,0,0,0.05)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Result:</span>
                        <strong style={{ color: report.Criticality.isCritical ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                            {report.Criticality.isCritical ? "CRITICAL" : "NOT CRITICAL"}
                        </strong>
                    </div>
                    <DataRow label={<MathText>||r||</MathText>} value={report.Criticality.r_norm.toExponential(6)} />
                    <DataRow label="Ratio" value={report.Criticality.ratio.toExponential(6)} />

                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span><MathText>Q<sub>red</sub>(r)</MathText> <span style={{ fontSize: '10px' }}>(Segunda Variación)</span></span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {report.Criticality.Q_red !== undefined ? report.Criticality.Q_red.toExponential(4) : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>
            </ChecklistSection>
        </div>
    );
};

export const AnalysisResultsPanel: React.FC<AnalysisResultsPanelProps> = ({
    counts, metrics, combinatorial, global, matrices, vectors, gauge, criticality, quadratic, instanceData, pdfReport, onClose
}) => {
    const failedMetrics = metrics.filter(m => !m.passed);
    const failedGlobal = global ? global.filter(m => !m.passed) : [];
    const [instanceExpanded, setInstanceExpanded] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'summary' | 'pdf'>('summary');

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

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                <button
                    onClick={() => setActiveTab('summary')}
                    style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'summary' ? '2px solid var(--accent-primary)' : 'none',
                        color: activeTab === 'summary' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                    }}
                >
                    Resumen
                </button>
                {pdfReport && (
                    <button
                        onClick={() => setActiveTab('pdf')}
                        style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'pdf' ? '2px solid var(--accent-primary)' : 'none',
                            color: activeTab === 'pdf' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                        }}
                    >
                        Reporte Final (PDF)
                    </button>
                )}
            </div>

            {activeTab === 'summary' ? (
                <>
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
                                    Table with <MathText>N</MathText><MathNum>, </MathNum><MathText>c<sub>i</sub></MathText><MathNum>, </MathNum><MathText>ℰ</MathText><MathNum>, |</MathNum><MathText>ℰ</MathText><MathNum>|, |</MathNum><MathText>𝒯</MathText><MathNum>|, |</MathNum><MathText>𝒮</MathText><MathNum>|, |</MathNum><MathText>𝒜</MathText><MathNum>|</MathNum>
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
                            <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathNum>|</MathNum><MathText>ℰ</MathText><MathNum>|</MathNum></div><strong>{counts.E}</strong></div>
                            <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathNum>|</MathNum><MathText>𝒯</MathText><MathNum>|</MathNum></div><strong>{counts.T}</strong></div>
                            <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathNum>|</MathNum><MathText>𝒮</MathText><MathNum>|</MathNum></div><strong>{counts.S}</strong></div>
                            <div><div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MathNum>|</MathNum><MathText>𝒜</MathText><MathNum>|</MathNum></div><strong>{counts.A}</strong></div>
                        </div>
                    )}

                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>VALIDATION</h3>

                        <ResultRow
                            label={<span><MathNum>(</MathNum><MathText>C</MathText><MathNum>0)</MathNum> verificacion del ciclo orientado</span>}
                            value={combinatorial.passed ? "PASS" : "FAIL"}
                            passed={combinatorial.passed}
                            detail={!combinatorial.passed ? combinatorial.message : undefined}
                        />

                        <DetailedResultRow
                            label={<span>Verificaciones metricas <MathNum>(</MathNum><MathText>S</MathText><MathNum>1)-(</MathNum><MathText>S</MathText><MathNum>2), (</MathNum><MathText>A</MathText><MathNum>1)-(</MathNum><MathText>A</MathText><MathNum>3)</MathNum></span>}
                            failedItems={failedMetrics}
                        />

                        <DetailedResultRow
                            label={<span>Chequeos globales <MathNum>(</MathNum><MathText>G</MathText><MathNum>1)-(</MathNum><MathText>G</MathText><MathNum>3)</MathNum></span>}
                            failedItems={failedGlobal}
                        />
                    </div>

                    {/* Matrices & Vectors */}
                    {matrices && vectors && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>MATRICES</h3>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                                    <DataRow label={<span><MathText>A</MathText><MathNum>(c)</MathNum></span>} value={matrices.A.dims} sub={`Rank ${matrices.A.rank}`} />
                                    <DataRow label={<span><MathText>T<sub>c</sub></MathText><MathNum>(c)</MathNum></span>} value={matrices.Tc.dims} sub={`Rank ${matrices.Tc.rank}`} />
                                    <DataRow label={<span><MathText>T<sub>ω</sub></MathText><MathNum>(c)</MathNum></span>} value={matrices.Tw.dims} sub={`Rank ${matrices.Tw.rank}`} />
                                    <DataRow label={<span><MathText>L</MathText><MathNum>(c)</MathNum></span>} value={matrices.L.dims} sub={`Rank ${matrices.L.rank}`} />
                                </div>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>VECTORS</h3>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                                    <DataRow label={<MathText>g<sub>c</sub></MathText>} value={`||·|| = ${vectors.gc.norm.toExponential(4)}`} sub={vectors.gc.dims} />
                                    <DataRow label={<MathText>g<sub>ω</sub></MathText>} value={`||·|| = ${vectors.gw.norm.toExponential(4)}`} sub={vectors.gw.dims} />
                                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }}></div>
                                    <DataRow label={<span><MathText>g</MathText><MathNum><sub>red</sub></MathNum></span>} value={`||·|| = ${vectors.gred.norm.toExponential(4)}`} sub={vectors.gred.dims} />
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
                                    <DataRow label={<span><MathText>V</MathText><MathNum><sub>Roll</sub></MathNum></span>} value={gauge.dims.V_Roll} />
                                    <DataRow label={<MathText>W</MathText>} value={gauge.dims.W} />
                                    <DataRow label={<span><MathText>U</MathText><MathNum><sub>g</sub></MathNum></span>} value={gauge.dims.Ug} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Residuals</div>
                                    <DataRow label={<span><MathNum>||</MathNum><MathText>A U</MathText><MathNum>||</MathNum></span>} value={gauge.checks.AUc.toExponential(2)} />
                                    <DataRow label={<span><MathNum>||</MathNum><MathText>U<sup>T</sup>U <MathNum>-</MathNum> I</MathText><MathNum>||</MathNum></span>} value={gauge.checks.UtU_I.toExponential(2)} />
                                    <DataRow label={<span><MathNum>||</MathNum><MathText>W<sup>T</sup>W <MathNum>-</MathNum> I</MathText><MathNum>||</MathNum></span>} value={gauge.checks.WtW_I.toExponential(2)} />
                                    <DataRow label={<span><MathNum>||</MathNum><MathText>U<MathNum><sub>g</sub><sup>T</sup></MathNum>W</MathText><MathNum>||</MathNum></span>} value={gauge.checks.UgtW.toExponential(2)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Criticality */}
                    {criticality && (
                        <div style={{ background: criticality.isCritical ? 'rgba(0,255,0,0.05)' : 'rgba(255,0,0,0.05)', padding: '16px', borderRadius: '8px', marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px' }}>
                                    Criticidad: <MathText>r</MathText> <MathNum>=</MathNum> <MathText>U</MathText><MathNum><sub>g</sub><sup>T</sup></MathNum> <MathText>g</MathText><MathNum><sub>red</sub></MathNum>
                                </h4>
                                <span style={{ fontWeight: 'bold', color: criticality.isCritical ? 'var(--accent-success)' : 'var(--accent-error)' }}>{criticality.isCritical ? "CRITICAL" : "NOT CRITICAL"}</span>
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                                <div><MathNum>||</MathNum><MathText>r</MathText><MathNum>||</MathNum> &nbsp;&nbsp; {criticality.normR.toExponential(6)}</div>
                                <div>Ratio &nbsp; {criticality.ratio.toExponential(6)}</div>
                            </div>

                            {quadratic !== undefined && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                    <strong style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                        (Opcional) Evaluacion de <MathText>Q<sub>red</sub></MathText>
                                    </strong>
                                    <div style={{ fontFamily: 'monospace' }}>
                                        <MathText>Q</MathText><MathNum><sub>red</sub>(</MathNum><MathText>r</MathText><MathNum>)</MathNum>: {quadratic.toExponential(4)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                pdfReport && <AnalysisChecklist report={pdfReport} />
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} variant="primary">Close Report</Button>
            </div>
        </div>
    );
};
