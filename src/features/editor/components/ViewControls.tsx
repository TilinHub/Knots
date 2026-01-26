import type React from 'react';

interface ViewControlsProps {
    showGrid: boolean;
    onToggleGrid: (show: boolean) => void;
    gridSpacing: number;
    onGridSpacingChange: (spacing: number) => void;
    angleUnit: 'deg' | 'rad';
    onAngleUnitChange: (unit: 'deg' | 'rad') => void;
}

export const ViewControls = ({
    showGrid,
    onToggleGrid,
    gridSpacing,
    onGridSpacingChange,
    angleUnit,
    onAngleUnitChange,
}: ViewControlsProps) => {
    return (
        <div
            style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
            }}
        >
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
                Vista
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>Grilla</span>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => onToggleGrid(e.target.checked)}
                        style={{ marginRight: '6px' }}
                    />
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                        {showGrid ? 'Visible' : 'Oculta'}
                    </span>
                </label>
            </div>

            {showGrid && (
                <div style={{ marginBottom: 'var(--space-sm)' }}>
                    <label
                        style={{
                            fontSize: 'var(--fs-caption)',
                            color: 'var(--text-secondary)',
                            display: 'block',
                            marginBottom: '4px',
                        }}
                    >
                        Espaciado: {gridSpacing}px
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="50"
                        step="5"
                        value={gridSpacing}
                        onChange={(e) => onGridSpacingChange(Number(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>Ángulos</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => onAngleUnitChange('deg')}
                        style={{
                            padding: '4px 8px',
                            fontSize: 'var(--fs-caption)',
                            background: angleUnit === 'deg' ? 'var(--bg-primary)' : 'transparent',
                            border: `1px solid ${angleUnit === 'deg' ? 'var(--border)' : 'transparent'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: angleUnit === 'deg' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        grados
                    </button>
                    <button
                        onClick={() => onAngleUnitChange('rad')}
                        style={{
                            padding: '4px 8px',
                            fontSize: 'var(--fs-caption)',
                            background: angleUnit === 'rad' ? 'var(--bg-primary)' : 'transparent',
                            border: `1px solid ${angleUnit === 'rad' ? 'var(--border)' : 'transparent'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: angleUnit === 'rad' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        radianes
                    </button>
                </div>
            </div>
        </div>
    );
};
