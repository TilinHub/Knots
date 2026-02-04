import React, { useMemo, useState } from 'react';
import type { CSDisk } from '../../../core/types/cs';
import { calculateJacobianMatrix } from '../../../core/geometry/contactGraph';
import { Button } from '../../../ui/Button';

interface ContactMatrixViewerProps {
    disks: CSDisk[];
}

export const ContactMatrixViewer: React.FC<ContactMatrixViewerProps> = ({ disks }) => {
    const { matrix, contacts } = useMemo(() => calculateJacobianMatrix(disks), [disks]);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        // Format for spreadsheet copy (tab separated)
        const header = disks.map((_, i) => `x${i}\ty${i}`).join('\t');
        const rows = matrix.map((row) =>
            row.map(val => val.toFixed(4)).join('\t')
        ).join('\n');

        navigator.clipboard.writeText(`Contact Matrix A(c)\n${header}\n${rows}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (disks.length === 0) return null;

    if (matrix.length === 0) {
        return (
            <div style={{
                marginTop: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                fontSize: '13px'
            }}>
                No contacts detected. (Disks too far apart)
            </div>
        );
    }

    // Grid size calculation
    const numCols = disks.length * 2;
    const colWidth = 35; // Wider for floats

    return (
        <div style={{
            marginTop: 'var(--space-md)',
            padding: 'var(--space-md)',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            overflowX: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    margin: 0
                }}>
                    Rigidity Matrix A(c)
                </h3>
                <Button variant="secondary" onClick={handleCopy} style={{ fontSize: '10px', padding: '2px 8px' }}>
                    {copied ? 'Copied!' : 'Copy'}
                </Button>
            </div>

            <div style={{ display: 'flex' }}>
                {/* Row Labels (Contact Pairs) */}
                <div style={{ display: 'flex', flexDirection: 'column', marginRight: '8px', paddingTop: '24px' }}>
                    {contacts.map((c, i) => (
                        <div key={`row-label-${i}`} style={{ height: '20px', lineHeight: '20px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {c.index1}-{c.index2}
                        </div>
                    ))}
                </div>

                <div>
                    {/* Column Labels (Top) - Grouped per disk */}
                    <div style={{ display: 'flex', marginBottom: '4px' }}>
                        {disks.map((d, i) => (
                            <div key={`col-group-${i}`} style={{ width: `${colWidth * 2}px`, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{i}</div>
                                <div style={{ display: 'flex' }}>
                                    <div style={{ width: `${colWidth}px`, fontSize: '9px', color: 'var(--text-secondary)' }}>x</div>
                                    <div style={{ width: `${colWidth}px`, fontSize: '9px', color: 'var(--text-secondary)' }}>y</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Matrix Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, ${colWidth}px)`, gap: '1px' }}>
                        {matrix.flat().map((val, idx) => {
                            const isZero = Math.abs(val) < 0.0001;
                            const isNegative = val < 0;
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        height: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        // Highlight non-zero values
                                        background: isZero ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                        // Color logic: Red for negative, Blue for positive (if significant)
                                        color: isZero ? 'var(--text-tertiary)' : (isNegative ? 'var(--accent-error)' : 'var(--accent-primary)'),
                                        fontSize: '10px',
                                        borderRadius: '2px',
                                        fontWeight: isZero ? 'normal' : 'bold',
                                        border: isZero ? 'none' : '1px solid var(--border)'
                                    }}
                                    title={val.toString()}
                                >
                                    {isZero ? '0' : val.toFixed(2)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                * Rows represent contact constraints (u_ij). Columns represent disk configuration (x, y).
            </div>
        </div>
    );
};
