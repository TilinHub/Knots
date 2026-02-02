import React, { useMemo } from 'react';
import type { CSDisk } from '../../../core/types/cs';
import { calculateAdjacencyMatrix } from '../../../core/geometry/contactGraph';
import { Button } from '../../../ui/Button';

interface ContactMatrixViewerProps {
    disks: CSDisk[];
}

export const ContactMatrixViewer: React.FC<ContactMatrixViewerProps> = ({ disks }) => {
    const matrix = useMemo(() => calculateAdjacencyMatrix(disks), [disks]);

    const handleCopy = () => {
        const text = matrix.map(row => row.join(' ')).join('\n');
        navigator.clipboard.writeText(text);
    };

    if (disks.length === 0) return null;

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
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase'
                }}>
                    Matriz de Contacto
                </h3>
                <Button variant="secondary" onClick={handleCopy} style={{ fontSize: '10px', padding: '2px 8px' }}>
                    Copiar
                </Button>
            </div>

            <div style={{ display: 'flex' }}>
                {/* Row Labels (Left) */}
                <div style={{ display: 'flex', flexDirection: 'column', marginRight: '8px', paddingTop: '24px' }}>
                    {disks.map((d, i) => (
                        <div key={`row-label-${i}`} style={{ height: '20px', lineHeight: '20px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {i}
                        </div>
                    ))}
                </div>

                <div>
                    {/* Column Labels (Top) */}
                    <div style={{ display: 'flex', marginBottom: '4px' }}>
                        {disks.map((d, i) => (
                            <div key={`col-label-${i}`} style={{ width: '20px', textAlign: 'center', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {i}
                            </div>
                        ))}
                    </div>

                    {/* Matrix Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${disks.length}, 20px)`, gap: '1px' }}>
                        {matrix.flat().map((val, idx) => (
                            <div
                                key={idx}
                                style={{
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: val ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: val ? 'white' : 'var(--text-tertiary)',
                                    fontSize: '11px',
                                    borderRadius: '2px',
                                    fontWeight: val ? 'bold' : 'normal'
                                }}
                            >
                                {val}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
