import React from 'react';
import type { CheckResult } from './checks'; // Type-only import
import type { CriticalityResult } from './criticality'; // Type-only import
import { Button } from '../../../ui/Button';

interface AnalysisResultsPanelProps {
    metrics: CheckResult[];
    combinatorial: CheckResult;
    criticality: CriticalityResult | null;
    onClose: () => void;
}

export const AnalysisResultsPanel: React.FC<AnalysisResultsPanelProps> = ({
    metrics, combinatorial, criticality, onClose
}) => {
    const failedMetrics = metrics.filter(m => !m.passed);
    const passedMetrics = metrics.filter(m => m.passed);

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1000,
            width: '400px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            overflowY: 'auto'
        }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                Analysis Results
            </h2>

            {/* Status Summary */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <strong>Geometric Checks:</strong>
                    {failedMetrics.length === 0 && combinatorial.passed
                        ? <span style={{ color: 'var(--accent-success)' }}>PASSED</span>
                        : <span style={{ color: 'var(--accent-error)' }}>FAILED ({failedMetrics.length} errors)</span>
                    }
                </div>
                {failedMetrics.length > 0 && (
                    <div style={{ background: 'rgba(255,0,0,0.1)', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                        {failedMetrics.slice(0, 3).map((m, i) => (
                            <div key={i}>• {m.message} ({m.value.toExponential(2)})</div>
                        ))}
                        {failedMetrics.length > 3 && <div>...and {failedMetrics.length - 3} more</div>}
                    </div>
                )}
            </div>

            {/* Criticality */}
            {criticality && (
                <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Criticality Test</h3>
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                        Result: <strong style={{ color: criticality.isCritical ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                            {criticality.isCritical ? 'CRITICAL' : 'NOT CRITICAL'}
                        </strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        ||r||: {criticality.normR.toExponential(4)} <br />
                        Ratio: {criticality.ratio.toExponential(4)}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} variant="primary">Close</Button>
            </div>
        </div>
    );
};
